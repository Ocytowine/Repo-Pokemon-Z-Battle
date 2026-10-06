import { activeBattlePositions, activeTeamIndices, closeSharedBattleSession, createSharedBattleSession,
  replaceFaintedDoublePokemon, resolveDoubleTeamTurn, SeededRandom, settleEscapedSharedBattleSession,
  settleSharedBattleSession, type BattlePosition, type BattleSide, type DoubleBattleEvent,
  type PositionedTeamBattleAction, type SharedBattleSession, type TeamBattleAction,
  type TeamBattleEvent, type TeamBattleState } from "@pokemon-z-battle/battle-engine";
import { experienceAtLevel, type PlayerCreationCatalog, type PlayerPartyState,
  type SharedBattleExperienceGain } from "@pokemon-z-battle/player-state";
import type { SourceBattleContext, SourceBattleSettlementOutcome } from "@pokemon-z-battle/multiplayer-protocol";
import {
  attemptSourceEncounterEscape,
  createSourceEncounterBattle,
  createSourceTrainerBattle,
  resolveAutomaticReplacements,
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
  readonly playTurn: (before: TeamBattleState, events: readonly (TeamBattleEvent | DoubleBattleEvent)[]) => Promise<void>;
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
  readonly experiences?: readonly SourceBattleExperiencePresentation[];
  readonly money?: number;
  readonly trainerDefeatText?: string;
  readonly escaped?: boolean;
}

export function sharedBattleExperiencePresentations(before: PlayerPartyState, after: PlayerPartyState,
  gains: readonly SharedBattleExperienceGain[], catalog: PlayerCreationCatalog,
): readonly SourceBattleExperiencePresentation[] {
  return gains.flatMap((gain) => {
    const previous = before.members.find((pokemon) => pokemon.id === gain.recipientMemberId);
    const next = after.members.find((pokemon) => pokemon.id === gain.recipientMemberId);
    const definition = next === undefined ? undefined
      : catalog.pokemon.find((pokemon) => pokemon.internalName === next.species);
    if (previous === undefined || next === undefined || definition === undefined) return [];
    const moveName = (internalName: string): string => catalog.moves
      .find((move) => move.internalName === internalName)?.name ?? internalName;
    return [{ pokemonName: next.nickname ?? definition.name, amount: gain.gained,
      beforeLevel: gain.previousLevel, afterLevel: gain.nextLevel,
      beforeExperience: Math.max(previous.experience, experienceAtLevel(previous.level, definition.growthRate)),
      afterExperience: next.experience, growthRate: definition.growthRate,
      learnedMoves: gain.learnedMoves.map(moveName), skippedMoves: gain.skippedMoves.map(moveName) }];
  });
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
  readonly defeatText: string;
  readonly format?: "single" | "double";
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
  private sharedContinuationPending = false;
  private localSession: SharedBattleSession | null = null;
  private localSequence = 0;
  private localDoubleActions: PositionedTeamBattleAction[] = [];
  private startFailure: string | null = null;

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

  public get sharedContinuationReady(): boolean {
    return this.sharedContinuationPending;
  }

  public get lastStartFailure(): string | null {
    return this.startFailure;
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
        this.sharedContinuationPending = true;
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
    this.startFailure = null;
    const eventState = this.callbacks.getEventState();
    const resources = this.callbacks.getResources();
    if (resources === null) {
      this.startFailure = "Combat de Dresseur impossible : ressources de la carte indisponibles.";
      return false;
    }
    if (this.active) {
      this.startFailure = "Combat de Dresseur impossible : un autre combat est deja en cours d'ouverture.";
      return false;
    }
    try {
      const battle = createSourceTrainerBattle(eventState.party, trainer, resources.catalog, audio.format ?? "single");
      const context = this.sharedContext(battle, resources, { origin: "source-trainer", escapable: false,
        trainerBaseMoney: audio.baseMoney, continuation: "trainer-sequence",
        opponentTrainer: { id: audio.trainerTypeId, name: trainer.name },
        battleMusic: audio.battleMusic, victoryMusic: audio.victoryMusic, defeatText: audio.defeatText });
      if (this.callbacks.openSharedBattle?.({ context, playerTeam: battle.teams.player,
        opponentTeam: battle.teams.opponent }) === true) {
        this.sharedOpening = true;
        this.sharedContinuationPending = true;
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
      this.startFailure = error instanceof Error ? `Combat impossible : ${error.message}` : "Combat de Dresseur impossible.";
      this.callbacks.setNotice(this.startFailure);
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
        await this.presentation.endBattle(null, { escaped: true });
        this.clear();
        this.callbacks.setNotice("Fuite réussie : retour à l'exploration, sur la même case.");
        encounterCompletion?.(false);
      } else {
        await this.presentation.playTurn(before, result.turn.events);
        const replacements = resolveAutomaticReplacements(result.turn.state);
        if (replacements.events.length > 0) {
          await this.presentation.playTurn(result.turn.state, replacements.events);
        }
        this.battle = replacements.state;
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

  public async submitAction(moveIndex: number, activeSlot = 0, target?: BattlePosition): Promise<void> {
    await this.submitTurnAction({ kind: "move", moveIndex, ...(target === undefined ? {} : { target }) }, activeSlot);
  }

  public acknowledgeSharedBattleOpened(): void {
    this.sharedOpening = false;
  }

  /** Resumes the locally retained source continuation once the authoritative room has closed the battle. */
  public completeSharedBattle(outcome: SourceBattleSettlementOutcome,
    continuation: SourceBattleContext["continuation"]): boolean {
    if (!this.sharedContinuationPending) return false;
    const won = outcome === "won";
    const encounterCompletion = this.encounterCompletion;
    const trainerCompletion = this.trainerCompletion;
    if (continuation === "pending-encounter") {
      const current = this.callbacks.getEventState();
      if (outcome === "escaped") {
        this.callbacks.updateEventState({ ...current, pendingEncounter: null, wildEncounterSteps: 0 });
      } else if (won) {
        this.callbacks.updateEventState(completePendingEncounter(current));
      }
    }
    this.clear();
    this.callbacks.setNotice(outcome === "escaped"
      ? "Fuite réussie : retour à l'exploration, sur la même case."
      : won ? "Combat partagé remporté : reprise de l'aventure."
        : "Combat partagé perdu : retour à l'exploration.");
    if (continuation === "trainer-sequence") trainerCompletion?.(won);
    else encounterCompletion?.(won);
    this.callbacks.render();
    return true;
  }

  public async switchPokemon(teamIndex: number, activeSlot = 0): Promise<void> {
    await this.submitTurnAction({ kind: "switch", teamIndex, activeSlot }, activeSlot);
  }

  public get pendingDoubleSlots(): readonly number[] {
    return this.localDoubleActions.map((entry) => entry.actor.slot);
  }

  private async submitTurnAction(action: TeamBattleAction, activeSlot = 0): Promise<void> {
    if (this.battle === null || this.rng === null || this.resolving) return;
    if (this.battle.format === "double") {
      const actor = { side: "player" as const, slot: activeSlot };
      if (!activeBattlePositions(this.battle).some((position) => position.side === actor.side && position.slot === actor.slot)) return;
      this.localDoubleActions = [...this.localDoubleActions.filter((entry) => entry.actor.slot !== activeSlot), { actor, action }];
      const required = activeTeamIndices(this.battle.teams.player).filter((index) => this.battle!.teams.player.members[index]!.hp > 0).length;
      if (this.localDoubleActions.length < required) {
        this.callbacks.setNotice("Action du premier Pokemon enregistree. Choisissez celle du second.");
        this.callbacks.render();
        return;
      }
    }
    this.resolving = true;
    this.callbacks.render();
    try {
      const eventState = this.callbacks.getEventState();
      const before = this.battle;
      const result = before.format === "double"
        ? resolveDoubleTeamTurn(before, [
          ...this.localDoubleActions,
          ...activeTeamIndices(before.teams.opponent).map((_, slot) => {
            const battler = before.teams.opponent.members[activeTeamIndices(before.teams.opponent)[slot]!]!;
            const choices = battler.moves.map((entry, moveIndex) => ({ entry, moveIndex })).filter(({ entry }) => entry.pp > 0);
            const selected = choices[this.rng!.nextInt(choices.length)];
            if (selected === undefined) throw new Error("Le Pokemon adverse n'a aucune capacite disponible.");
            return { actor: { side: "opponent" as const, slot }, action: { kind: "move" as const, moveIndex: selected.moveIndex } };
          }),
        ], this.rng)
        : resolveSourceEncounterAction(before, action, this.rng);
      this.localDoubleActions = [];
      await this.presentation.playTurn(before, result.events);
      let replacementState = result.state;
      const replacementEvents: TeamBattleEvent[] = [];
      if (result.state.format === "double") {
        for (const position of [...(replacementState.slotReplacements ?? [])]) {
          const team = replacementState.teams[position.side];
          const active = activeTeamIndices(team);
          const next = team.members.findIndex((member, index) => member.hp > 0 && !active.includes(index));
          if (next < 0) continue;
          const fromIndex = active[position.slot]!;
          replacementEvents.push({ type: "pokemonSwitched", side: position.side, fromIndex, toIndex: next,
            from: team.members[fromIndex]!.id, to: team.members[next]!.id, reason: "replacement" });
          replacementState = replaceFaintedDoublePokemon(replacementState, position, next);
        }
      } else {
        const replacements = resolveAutomaticReplacements(result.state);
        replacementState = replacements.state;
        replacementEvents.push(...replacements.events);
      }
      if (replacementEvents.length > 0) await this.presentation.playTurn(result.state, replacementEvents);
      this.battle = replacementState;
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
          ...(winner === "player" && trainerCompletion !== null && this.trainerAudio?.defeatText !== undefined
            ? { trainerDefeatText: this.trainerAudio.defeatText } : {}),
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
    this.sharedContinuationPending = false;
    this.localSession = null;
    this.localDoubleActions = [];
  }

  private sharedContext(state: TeamBattleState, resources: SourceBattleResources, input: {
    readonly origin: "source-wild" | "source-trainer";
    readonly escapable: boolean;
    readonly trainerBaseMoney: number | null;
    readonly continuation: "pending-encounter" | "trainer-sequence";
    readonly opponentTrainer: { readonly id: number; readonly name: string } | null;
    readonly defeatText?: string | null;
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
    return { origin: input.origin, mapId: resources.mapId, format: state.format ?? "single", escapable: input.escapable,
      presentation: { battlebackId: resources.battleback,
        battleMusicId: input.battleMusic === undefined ? resources.battleMusic : input.battleMusic,
        victoryMusicId: input.victoryMusic === undefined ? resources.victoryMusic : input.victoryMusic,
        opponentTrainer: input.opponentTrainer,
        defeatText: input.defeatText ?? null },
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
