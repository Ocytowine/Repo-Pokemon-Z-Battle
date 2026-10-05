import { closeSharedBattleSession, createSharedBattleSession, SeededRandom, settleEscapedSharedBattleSession,
  settleSharedBattleSession, type BattleSide, type SharedBattleSession, type TeamBattleAction,
  type TeamBattleEvent, type TeamBattleState } from "@pokemon-z-battle/battle-engine";
import { experienceAtLevel, type PlayerCreationCatalog, type PlayerPartyState } from "@pokemon-z-battle/player-state";
import type { SourceBattleContext } from "@pokemon-z-battle/multiplayer-protocol";
import {
  applyAutomaticReplacements,
  attemptSourceEncounterEscape,
  createSourceEncounterBattle,
  createSourceTrainerBattle,
  resolveSourceEncounterAction,
  settleSourceEncounter,
  storeSourceEncounterParty,
  type SourceTrainerDefinition,
} from "./source-encounter.js";
import { completePendingEncounter, type SourceEventState } from "./source-event-state.js";
import { addSourceMoney, sourceBattleExperiencePolicy, sourceDefeatLoss, sourceTrainerReward } from "./source-economy.js";

export interface SourceBattleResources {
  readonly catalog: PlayerCreationCatalog;
  readonly mapId: number;
  readonly battleback: string;
  readonly battleMusic: string | null;
  readonly victoryMusic: string | null;
}

export interface SourceBattlePresentation {
  readonly startBattle: (state: TeamBattleState, audio: {
    readonly battleMusic?: string | null;
    readonly victoryMusic?: string | null;
    readonly battleback?: string;
    readonly opponentTrainer?: { readonly id: number; readonly name: string };
  }) => Promise<void>;
  readonly playTurn: (before: TeamBattleState, events: readonly TeamBattleEvent[]) => Promise<void>;
  readonly endBattle: (winner: BattleSide | null, outcome?: SourceBattleOutcome) => Promise<void> | void;
  readonly render: (state: TeamBattleState, battleback?: string) => Promise<void>;
}

export interface SourceBattleExperiencePresentation {
  readonly pokemonName: string;
  readonly amount: number;
  readonly beforeLevel: number;
  readonly afterLevel: number;
  readonly beforeExperience: number;
  readonly afterExperience: number;
  readonly growthRate: string;
  readonly learnedMoves: readonly string[];
  readonly skippedMoves: readonly string[];
}

export interface SourceBattleOutcome {
  readonly experience?: SourceBattleExperiencePresentation;
  readonly money?: number;
}

function battleExperiencePresentation(before: PlayerPartyState, after: PlayerPartyState,
  reward: NonNullable<ReturnType<typeof settleSourceEncounter>["experience"]>, catalog: PlayerCreationCatalog,
): SourceBattleExperiencePresentation | undefined {
  const previous = before.members.find((pokemon) => pokemon.id === reward.pokemonId);
  const next = after.members.find((pokemon) => pokemon.id === reward.pokemonId);
  if (previous === undefined || next === undefined) return undefined;
  const definition = catalog.pokemon.find((pokemon) => pokemon.internalName === next.species);
  if (definition === undefined) return undefined;
  const moveName = (internalName: string): string => catalog.moves.find((move) => move.internalName === internalName)?.name ?? internalName;
  return {
    pokemonName: next.nickname ?? definition.name,
    amount: reward.amount,
    beforeLevel: previous.level,
    afterLevel: next.level,
    beforeExperience: Math.max(previous.experience, experienceAtLevel(previous.level, definition.growthRate)),
    afterExperience: next.experience,
    growthRate: definition.growthRate,
    learnedMoves: reward.learnedMoves.map(moveName),
    skippedMoves: reward.skippedMoves.map(moveName),
  };
}

export interface SourceBattleCallbacks {
  readonly getEventState: () => SourceEventState;
  readonly updateEventState: (state: SourceEventState) => void;
  readonly getResources: () => SourceBattleResources | null;
  readonly setNotice: (notice: string) => void;
  readonly render: () => void;
  readonly openSharedBattle?: (draft: { readonly context: Omit<SourceBattleContext, "narrativeOwnerId">;
    readonly playerTeam: TeamBattleState["teams"]["player"];
    readonly opponentTeam: TeamBattleState["teams"]["opponent"] }) => boolean;
}

export interface SourceTrainerBattleAudio {
  readonly battleMusic: string | null;
  readonly victoryMusic: string | null;
  readonly baseMoney: number;
  readonly trainerTypeId: number;
}

function encounterSeed(species: string, level: number): number {
  let seed = 0x5eed0000 ^ level;
  for (const character of species) seed = Math.imul(seed ^ character.codePointAt(0)!, 16_777_619);
  return seed >>> 0;
}

export class SourceBattleController {
  private battle: TeamBattleState | null = null;
  private rng: SeededRandom | null = null;
  private escapeAttempts = 0;
  private resolving = false;
  private encounterCompletion: ((won: boolean) => void) | null = null;
  private trainerCompletion: ((won: boolean) => void) | null = null;
  private trainerAudio: SourceTrainerBattleAudio | null = null;
  private sharedOpening = false;
  private localSession: SharedBattleSession | null = null;
  private localSequence = 0;

  public constructor(
    private readonly presentation: SourceBattlePresentation,
    private readonly callbacks: SourceBattleCallbacks,
  ) {}

  public get current(): TeamBattleState | null {
    return this.battle;
  }

  public get active(): boolean {
    return this.battle !== null || this.sharedOpening;
  }

  public get animating(): boolean {
    return this.resolving;
  }

  public startPendingEncounter(onComplete: ((won: boolean) => void) | null = null): boolean {
    const eventState = this.callbacks.getEventState();
    const encounter = eventState.pendingEncounter;
    const resources = this.callbacks.getResources();
    if (encounter === null || resources === null || this.active) return false;
    try {
      const battle = createSourceEncounterBattle(eventState.party, encounter, resources.catalog,
        `wild-${encounter.species.toLowerCase()}`);
      const context = this.sharedContext(battle, resources, { origin: "source-wild",
        escapable: encounter.escapable, trainerBaseMoney: null, continuation: "pending-encounter",
        opponentTrainer: null });
      if (this.callbacks.openSharedBattle?.({ context, playerTeam: battle.teams.player,
        opponentTeam: battle.teams.opponent }) === true) {
        this.sharedOpening = true;
        this.encounterCompletion = onComplete;
        this.callbacks.setNotice(`Combat partagé demandé contre ${encounter.species} niveau ${encounter.level}.`);
        this.callbacks.render();
        return true;
      }
      this.battle = battle;
      this.localSession = this.createLocalSession("source-wild", resources.mapId);
      this.rng = new SeededRandom(encounterSeed(encounter.species, encounter.level));
      this.escapeAttempts = 0;
      this.encounterCompletion = onComplete;
      void this.presentation.startBattle(this.battle,
        { battleMusic: resources.battleMusic, victoryMusic: resources.victoryMusic, battleback: resources.battleback });
      this.callbacks.setNotice(`Combat lancé contre ${encounter.species} niveau ${encounter.level}.`);
    } catch (error) {
      this.battle = null;
      this.rng = null;
      this.encounterCompletion = null;
      if (encounter.escapable === true) {
        this.callbacks.updateEventState({ ...eventState, pendingEncounter: null, wildEncounterSteps: 0 });
      }
      this.callbacks.setNotice(error instanceof Error ? `Combat impossible : ${error.message}` : "Combat source impossible.");
      this.callbacks.render();
      return false;
    }
    this.callbacks.render();
    return true;
  }

  public startTrainerBattle(trainer: SourceTrainerDefinition, audio: SourceTrainerBattleAudio,
    onComplete: (won: boolean) => void): boolean {
    const eventState = this.callbacks.getEventState();
    const resources = this.callbacks.getResources();
    if (resources === null || this.active) return false;
    try {
      const battle = createSourceTrainerBattle(eventState.party, trainer, resources.catalog);
      const context = this.sharedContext(battle, resources, { origin: "source-trainer", escapable: false,
        trainerBaseMoney: audio.baseMoney, continuation: "trainer-sequence",
        opponentTrainer: { id: audio.trainerTypeId, name: trainer.name },
        battleMusic: audio.battleMusic, victoryMusic: audio.victoryMusic });
      if (this.callbacks.openSharedBattle?.({ context, playerTeam: battle.teams.player,
        opponentTeam: battle.teams.opponent }) === true) {
        this.sharedOpening = true;
        this.trainerCompletion = onComplete;
        this.trainerAudio = audio;
        this.callbacks.setNotice(`Combat partagé demandé contre ${trainer.name}.`);
        this.callbacks.render();
        return true;
      }
      this.battle = battle;
      this.localSession = this.createLocalSession("source-trainer", resources.mapId);
      this.rng = new SeededRandom(encounterSeed(`${trainer.trainerType}:${trainer.name}`, trainer.version));
      this.escapeAttempts = 0;
      this.trainerCompletion = onComplete;
      this.trainerAudio = audio;
      void this.presentation.startBattle(this.battle, { ...audio, battleback: resources.battleback,
        opponentTrainer: { id: audio.trainerTypeId, name: trainer.name } });
      this.callbacks.setNotice(`Combat de Dresseur lancé contre ${trainer.name}.`);
    } catch (error) {
      this.battle = null;
      this.rng = null;
      this.trainerCompletion = null;
      this.callbacks.setNotice(error instanceof Error ? `Combat impossible : ${error.message}` : "Combat de Dresseur impossible.");
      this.callbacks.render();
      return false;
    }
    this.callbacks.render();
    return true;
  }

  public renderVisuals(): void {
    const resources = this.callbacks.getResources();
    if (this.battle !== null) void this.presentation.render(this.battle, resources?.battleback ?? "snow");
  }

  public async escape(): Promise<void> {
    const eventState = this.callbacks.getEventState();
    if (this.battle === null || this.rng === null || this.resolving || eventState.pendingEncounter?.escapable !== true) return;
    this.resolving = true;
    this.callbacks.render();
    try {
      const before = this.battle;
      const result = attemptSourceEncounterEscape(before, this.escapeAttempts, this.rng);
      this.escapeAttempts += 1;
      if (result.escaped) {
        const encounterCompletion = this.encounterCompletion;
        this.callbacks.updateEventState({
          ...eventState,
          party: storeSourceEncounterParty(eventState.party, before),
          pendingEncounter: null,
          wildEncounterSteps: 0,
        });
        if (this.localSession !== null) {
          this.localSession = closeSharedBattleSession(settleEscapedSharedBattleSession(this.localSession));
        }
        await this.presentation.endBattle(null);
        this.clear();
        this.callbacks.setNotice("Fuite réussie : retour à l'exploration, sur la même case.");
        encounterCompletion?.(false);
      } else {
        await this.presentation.playTurn(before, result.turn.events);
        this.battle = applyAutomaticReplacements(result.turn.state);
        if (this.battle.status === "finished") {
          const encounterCompletion = this.encounterCompletion;
          const settlement = settleSourceEncounter(eventState.party, this.battle, this.callbacks.getResources()?.catalog);
          const loss = sourceDefeatLoss({ ...eventState, party: settlement.party });
          this.callbacks.updateEventState({ ...eventState, party: settlement.party, money: eventState.money - loss });
          this.closeFinishedLocalSession(this.battle);
          await this.presentation.endBattle(this.battle.winner, { ...(loss > 0 ? { money: -loss } : {}) });
          this.clear();
          this.callbacks.setNotice(`Fuite ratée et équipe vaincue : l'équipe a été restaurée, la rencontre peut être retentée.${loss > 0 ? ` · -${loss.toLocaleString("fr-FR")} ₽` : ""}`);
          encounterCompletion?.(false);
        } else {
          this.callbacks.setNotice("Fuite ratée : le Pokémon sauvage a pu attaquer.");
        }
      }
    } catch (error) {
      this.callbacks.setNotice(error instanceof Error ? `Fuite impossible : ${error.message}` : "Fuite impossible.");
    } finally {
      this.resolving = false;
      this.callbacks.render();
    }
  }

  public async submitAction(moveIndex: number): Promise<void> {
    await this.submitTurnAction({ kind: "move", moveIndex });
  }

  public acknowledgeSharedBattleOpened(): void {
    this.sharedOpening = false;
  }

  public async switchPokemon(teamIndex: number): Promise<void> {
    await this.submitTurnAction({ kind: "switch", teamIndex });
  }

  private async submitTurnAction(action: TeamBattleAction): Promise<void> {
    if (this.battle === null || this.rng === null || this.resolving) return;
    this.resolving = true;
    this.callbacks.render();
    try {
      const eventState = this.callbacks.getEventState();
      const before = this.battle;
      const result = resolveSourceEncounterAction(before, action, this.rng);
      await this.presentation.playTurn(before, result.events);
      this.battle = applyAutomaticReplacements(result.state);
      if (this.battle.status === "finished") {
        const winner = this.battle.winner;
        const resources = this.callbacks.getResources();
        const settlement = settleSourceEncounter(eventState.party, this.battle, resources?.catalog);
        let nextState = { ...eventState, party: settlement.party };
        const trainerCompletion = this.trainerCompletion;
        const encounterCompletion = this.encounterCompletion;
        let moneyNotice = "";
        let moneyDelta = 0;
        if (winner === "player" && trainerCompletion !== null) {
          const amount = sourceTrainerReward(before.teams.opponent.members.map((member) => member.level),
            this.trainerAudio?.baseMoney ?? 0);
          nextState = addSourceMoney(nextState, amount);
          moneyDelta = amount;
          if (amount > 0) moneyNotice = ` · +${amount.toLocaleString("fr-FR")} ₽`;
        } else if (winner !== "player") {
          const amount = sourceDefeatLoss(nextState);
          nextState = { ...nextState, money: nextState.money - amount };
          moneyDelta = -amount;
          if (amount > 0) moneyNotice = ` · -${amount.toLocaleString("fr-FR")} ₽`;
        }
        const experience = settlement.experience === null || resources === null ? undefined
          : battleExperiencePresentation(eventState.party, settlement.party, settlement.experience, resources.catalog);
        this.closeFinishedLocalSession(this.battle);
        await this.presentation.endBattle(winner, {
          ...(experience === undefined ? {} : { experience }),
          ...(moneyDelta === 0 ? {} : { money: moneyDelta }),
        });
        if (trainerCompletion === null && settlement.completed) nextState = completePendingEncounter(nextState);
        this.callbacks.updateEventState(nextState);
        this.clear();
        const skippedMoves = settlement.experience?.skippedMoves.map((internalName) => resources?.catalog.moves
          .find((move) => move.internalName === internalName)?.name ?? internalName) ?? [];
        const reward = settlement.experience;
        this.callbacks.setNotice(winner === "player"
          ? `Victoire : l'équipe a été sauvegardée${reward === null ? "." : ` · +${reward.amount} EXP${reward.levelsGained > 0 ? ` · +${reward.levelsGained} niveau(x)` : ""}.`}${moneyNotice}${skippedMoves.length === 0 ? "" : ` Capacité(s) en attente d'un choix : ${skippedMoves.join(", ")}.`}`
          : `Défaite : l'équipe a été restaurée et la rencontre reste disponible pour une nouvelle tentative.${moneyNotice}`);
        trainerCompletion?.(winner === "player");
        encounterCompletion?.(winner === "player");
      } else {
        const active = this.battle.teams.opponent.members[this.battle.teams.opponent.activeIndex];
        this.callbacks.setNotice(`Tour résolu${active === undefined ? "." : ` · ${active.name} possède encore ${active.hp} PV.`}`);
      }
    } catch (error) {
      this.callbacks.setNotice(error instanceof Error ? `Action refusée : ${error.message}` : "Action de combat impossible.");
    } finally {
      this.resolving = false;
      this.callbacks.render();
    }
  }

  private clear(): void {
    this.battle = null;
    this.rng = null;
    this.encounterCompletion = null;
    this.trainerCompletion = null;
    this.trainerAudio = null;
    this.sharedOpening = false;
    this.localSession = null;
  }

  private sharedContext(state: TeamBattleState, resources: SourceBattleResources, input: {
    readonly origin: "source-wild" | "source-trainer";
    readonly escapable: boolean;
    readonly trainerBaseMoney: number | null;
    readonly continuation: "pending-encounter" | "trainer-sequence";
    readonly opponentTrainer: { readonly id: number; readonly name: string } | null;
    readonly battleMusic?: string | null;
    readonly victoryMusic?: string | null;
  }): Omit<SourceBattleContext, "narrativeOwnerId"> {
    const eventState = this.callbacks.getEventState();
    const opponents = state.teams.opponent.members.map((member) => {
      const definition = resources.catalog.pokemon.find((candidate) => candidate.internalName === member.species);
      if (definition === undefined) throw new Error(`Espèce adverse absente du catalogue : ${member.species}.`);
      return { memberId: member.id, species: member.species, level: member.level,
        baseExperience: definition.baseExperience };
    });
    return { origin: input.origin, mapId: resources.mapId, format: "single", escapable: input.escapable,
      presentation: { battlebackId: resources.battleback,
        battleMusicId: input.battleMusic === undefined ? resources.battleMusic : input.battleMusic,
        victoryMusicId: input.victoryMusic === undefined ? resources.victoryMusic : input.victoryMusic,
        opponentTrainer: input.opponentTrainer },
      rewards: { opponents, trainerBaseMoney: input.trainerBaseMoney,
        experience: sourceBattleExperiencePolicy(eventState) }, continuation: input.continuation };
  }

  private createLocalSession(origin: "source-wild" | "source-trainer", mapId: number): SharedBattleSession {
    this.localSequence += 1;
    return createSharedBattleSession({ battleId: `local-${mapId}-${this.localSequence}`, origin,
      narrativeOwnerId: "local", allowJoin: false });
  }

  private closeFinishedLocalSession(state: TeamBattleState): void {
    if (this.localSession === null) throw new Error("Session locale de combat absente.");
    this.localSession = closeSharedBattleSession(settleSharedBattleSession(this.localSession, state));
  }
}
