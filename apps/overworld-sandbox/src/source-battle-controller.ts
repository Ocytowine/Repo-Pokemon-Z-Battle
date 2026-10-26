import { activeBattlePositions, activeTeamIndices, chooseSourceBattleAction, closeSharedBattleSession,
  createSharedBattleLedger, createSharedBattleSession, recordSharedBattleTurn,
  resolveDoubleTeamTurn, SeededRandom, settleEscapedSharedBattleSession,
  settleSharedBattleSession, type BattlePosition, type BattleSide, type DoubleBattleEvent,
  type PositionedTeamBattleAction, type SharedBattleLedger, type SharedBattleParticipation,
  type SharedBattleSession, type TeamBattleAction,
  type TeamBattleEvent, type TeamBattleState } from "@pokemon-z-battle/battle-engine";
import { addPokemonToStorage, createPersistentPokemon, experienceAtLevel,
  storeProjectedBattleTeam, type PlayerCreationCatalog, type PlayerPartyState, type PokemonCreationContext,
  type PokemonZExperienceCalculation, type SharedBattleExperienceGain } from "@pokemon-z-battle/player-state";
import type { SourceBattleContext, SourceBattleSettlementOutcome } from "@pokemon-z-battle/multiplayer-protocol";
import {
  attemptSourceEncounterEscape,
  createSourceEncounterBattle,
  createSourceTrainerBattle,
  resolvePlayerReplacement,
  resolveSourceControlledReplacements,
  resolveSourceEncounterAction,
  settleSourceEncounter,
  settleSourceTrainerBattle,
  storeSourceEncounterParty,
  type ScaledWildExperienceCalculation,
  type SourceTrainerDefinition,
} from "./source-encounter.js";
import { completePendingEncounter, type SourceEventState } from "./source-event-state.js";
import { finishSourceWildBattleFieldEffects } from "./source-field-item.js";
import { addSourceMoney, sourceBattleExperiencePolicy, sourceDefeatLoss, sourceTrainerReward } from "./source-economy.js";
import type { SourceBattleReportStore } from "./source-battle-report.js";
import { sourceMegaActivationAvailable, type SourceMegaEvolutionCatalog } from "./source-mega-evolution.js";
import { hasSourceEncounterDynamicLevel, resolveSourceEncounterInitialEffects, resolveSourceEncounterLevel,
  type SourceEncounterModifierCatalog } from "./source-encounter-modifiers.js";

export interface SourceBattleResources {
  readonly catalog: PlayerCreationCatalog;
  readonly mapId: number;
  readonly battleback: string;
  readonly battleMusic: string | null;
  readonly victoryMusic: string | null;
  readonly megaEvolutions?: SourceMegaEvolutionCatalog;
  readonly encounterModifiers?: SourceEncounterModifierCatalog;
  readonly environment?: NonNullable<NonNullable<TeamBattleState["effects"]>["environment"]>;
}

export interface SourceBattlePresentation {
  readonly startBattle: (state: TeamBattleState, audio: {
    readonly battleMusic?: string | null;
    readonly victoryMusic?: string | null;
    readonly battleback?: string;
    readonly opponentTrainer?: { readonly id: number; readonly name: string };
    readonly initialOpponentStatBoost?: boolean;
  }) => Promise<void>;
  readonly playTurn: (before: TeamBattleState, events: readonly (TeamBattleEvent | DoubleBattleEvent)[]) => Promise<void>;
  readonly endBattle: (winner: BattleSide | null, outcome?: SourceBattleOutcome) => Promise<void> | void;
  readonly render: (state: TeamBattleState, battleback?: string) => Promise<void>;
}

export interface SourceBattleExperiencePresentation {
  readonly pokemonId: string;
  readonly pokemonName: string;
  readonly amount: number;
  readonly beforeLevel: number;
  readonly afterLevel: number;
  readonly beforeExperience: number;
  readonly afterExperience: number;
  readonly growthRate: string;
  readonly learnedMoves: readonly string[];
  readonly skippedMoves: readonly string[];
  readonly calculation: PokemonZExperienceCalculation | ScaledWildExperienceCalculation;
}

export interface SourceBattleOutcome {
  readonly experience?: SourceBattleExperiencePresentation;
  readonly experiences?: readonly SourceBattleExperiencePresentation[];
  readonly money?: number;
  readonly trainerDefeatText?: string;
  readonly escaped?: boolean;
  readonly captured?: { readonly name: string; readonly destination?: "team" | "ranch" };
  readonly experienceNotAwardedReason?: "capture" | "escaped" | "defeat" | "no-eligible-recipient";
}

export function sharedBattleExperiencePresentations(before: PlayerPartyState, after: PlayerPartyState,
  gains: readonly SharedBattleExperienceGain[], catalog: PlayerCreationCatalog,
): readonly SourceBattleExperiencePresentation[] {
  const experienceByPokemon = new Map(before.members.map((pokemon) => {
    const definition = catalog.pokemon.find((candidate) => candidate.internalName === pokemon.species);
    return [pokemon.id, definition === undefined ? pokemon.experience
      : Math.max(pokemon.experience, experienceAtLevel(pokemon.level, definition.growthRate))] as const;
  }));
  return gains.flatMap((gain) => {
    const previous = before.members.find((pokemon) => pokemon.id === gain.recipientMemberId);
    const next = after.members.find((pokemon) => pokemon.id === gain.recipientMemberId);
    const definition = next === undefined ? undefined
      : catalog.pokemon.find((pokemon) => pokemon.internalName === next.species);
    if (previous === undefined || next === undefined || definition === undefined) return [];
    const moveName = (internalName: string): string => catalog.moves
      .find((move) => move.internalName === internalName)?.name ?? internalName;
    const beforeExperience = experienceByPokemon.get(gain.recipientMemberId)
      ?? Math.max(previous.experience, experienceAtLevel(previous.level, definition.growthRate));
    const afterExperience = Math.min(next.experience, beforeExperience + gain.gained);
    experienceByPokemon.set(gain.recipientMemberId, afterExperience);
    return [{ pokemonId: gain.recipientMemberId, pokemonName: next.nickname ?? definition.name, amount: gain.gained,
      beforeLevel: gain.previousLevel, afterLevel: gain.nextLevel,
      beforeExperience, afterExperience, growthRate: definition.growthRate,
      learnedMoves: gain.learnedMoves.map(moveName), skippedMoves: gain.skippedMoves.map(moveName),
      calculation: gain.calculation }];
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
    pokemonId: reward.pokemonId,
    pokemonName: next.nickname ?? definition.name,
    amount: reward.amount,
    beforeLevel: previous.level,
    afterLevel: next.level,
    beforeExperience: Math.max(previous.experience, experienceAtLevel(previous.level, definition.growthRate)),
    afterExperience: next.experience,
    growthRate: definition.growthRate,
    learnedMoves: reward.learnedMoves.map(moveName),
    skippedMoves: reward.skippedMoves.map(moveName),
    calculation: reward.calculation,
  };
}

export interface SourceBattleCallbacks {
  readonly getEventState: () => SourceEventState;
  readonly updateEventState: (state: SourceEventState) => void;
  readonly getResources: () => SourceBattleResources | null;
  readonly getEvolutionHour?: () => number;
  readonly getPokemonCreationContext: (mapId: number, ballId: string) => PokemonCreationContext;
  readonly getExperienceLevelCap?: () => number;
  readonly setNotice: (notice: string) => void;
  /** Historique personnel uniquement : aucune donnée de Pokédex n'est répliquée par la room. */
  readonly recordPokedexSeen?: (species: readonly string[]) => void;
  readonly render: () => void;
  readonly battleReports?: SourceBattleReportStore;
  /** Owner-local presentation state; the captured Pokemon is already durable in the Ranch. */
  readonly onPokemonCaptured?: (pokemonId: string) => Promise<void> | void;
  readonly openSharedBattle?: (draft: { readonly context: Omit<SourceBattleContext, "narrativeOwnerId">;
    readonly playerTeam: TeamBattleState["teams"]["player"];
    readonly opponentTeam: TeamBattleState["teams"]["opponent"];
    readonly moveCatalog?: TeamBattleState["moveCatalog"] }) => boolean;
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
  private localParticipation: SharedBattleParticipation | null = null;
  private localLedger: SharedBattleLedger | null = null;
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
    let eventState = this.callbacks.getEventState();
    let encounter = eventState.pendingEncounter;
    const resources = this.callbacks.getResources();
    if (encounter === null || resources === null || this.active) return false;
    try {
      const levelContext = { mapId: resources.mapId, species: encounter.species, switches: eventState.switches };
      if (encounter.levelPolicyResolved !== true
        && hasSourceEncounterDynamicLevel(resources.encounterModifiers ?? { records: [] }, levelContext)) {
        const levelRng = new SeededRandom(eventState.wildEncounterRngState);
        const level = resolveSourceEncounterLevel(resources.encounterModifiers ?? { records: [] }, levelContext,
          eventState.party.members.map((pokemon) => pokemon.level), encounter.level,
        (maximum) => levelRng.nextInt(maximum));
        encounter = { ...encounter, level, levelPolicyResolved: true };
        eventState = { ...eventState, pendingEncounter: encounter, wildEncounterRngState: levelRng.snapshot() };
        this.callbacks.updateEventState(eventState);
      }
      const battle = createSourceEncounterBattle(eventState.party, encounter, resources.catalog,
        crypto.randomUUID(), resources.megaEvolutions,
        resources.megaEvolutions === undefined ? false : sourceMegaActivationAvailable(resources.megaEvolutions,
          eventState.inventory, eventState.switches),
        { ...resolveSourceEncounterInitialEffects(resources.encounterModifiers ?? { records: [] }, {
          mapId: resources.mapId, species: encounter.species, switches: eventState.switches,
        }), ...(eventState.fieldItemEffects.shinyNextWildEncounter ? { shiny: true as const } : {}) });
      const context = this.sharedContext(battle, resources, { origin: "source-wild",
        escapable: encounter.escapable, trainerBaseMoney: null, continuation: "pending-encounter",
        opponentTrainer: null });
      this.callbacks.recordPokedexSeen?.(battle.teams.opponent.members.map((pokemon) => pokemon.species));
      if (this.callbacks.openSharedBattle?.({ context, playerTeam: battle.teams.player,
        opponentTeam: battle.teams.opponent, moveCatalog: battle.moveCatalog }) === true) {
        this.sharedOpening = true;
        this.sharedContinuationPending = true;
        this.encounterCompletion = onComplete;
        this.callbacks.setNotice(`Combat partagé demandé contre ${encounter.species} niveau ${encounter.level}.`);
        this.callbacks.render();
        return true;
      }
      this.battle = battle;
      this.localSession = this.createLocalSession("source-wild", resources.mapId);
      this.startLocalTracking(battle);
      this.callbacks.battleReports?.start({ battleId: this.localSession.battleId, mode: "solo",
        viewerSide: "player", state: battle, context: { ...context, narrativeOwnerId: "local" } });
      this.rng = new SeededRandom(encounterSeed(encounter.species, encounter.level));
      this.escapeAttempts = 0;
      this.encounterCompletion = onComplete;
      void this.presentation.startBattle(this.battle,
        { battleMusic: resources.battleMusic, victoryMusic: resources.victoryMusic, battleback: resources.battleback,
          ...(encounter.initialStages !== undefined && Object.values(encounter.initialStages).some((stage) => stage > 0)
            ? { initialOpponentStatBoost: true } : {}) });
      this.callbacks.setNotice(`Combat lancé contre ${encounter.species} niveau ${encounter.level}.`);
    } catch (error) {
      this.battle = null;
      this.rng = null;
      this.encounterCompletion = null;
      this.localSession = null;
      this.localParticipation = null;
      this.localLedger = null;
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
      const battle = createSourceTrainerBattle(eventState.party, trainer, resources.catalog, audio.format ?? "single",
        () => crypto.randomUUID(), resources.megaEvolutions,
        resources.megaEvolutions === undefined ? false : sourceMegaActivationAvailable(resources.megaEvolutions,
          eventState.inventory, eventState.switches), resources.environment ?? "none");
      const context = this.sharedContext(battle, resources, { origin: "source-trainer", escapable: false,
        trainerBaseMoney: audio.baseMoney, continuation: "trainer-sequence",
        opponentTrainer: { id: audio.trainerTypeId, name: trainer.name },
        battleMusic: audio.battleMusic, victoryMusic: audio.victoryMusic, defeatText: audio.defeatText });
      this.callbacks.recordPokedexSeen?.(battle.teams.opponent.members.map((pokemon) => pokemon.species));
      if (this.callbacks.openSharedBattle?.({ context, playerTeam: battle.teams.player,
        opponentTeam: battle.teams.opponent, moveCatalog: battle.moveCatalog }) === true) {
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
      this.startLocalTracking(battle);
      this.callbacks.battleReports?.start({ battleId: this.localSession.battleId, mode: "solo",
        viewerSide: "player", state: battle, context: { ...context, narrativeOwnerId: "local" } });
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
      this.localSession = null;
      this.localParticipation = null;
      this.localLedger = null;
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
        const battleId = this.localSession?.battleId;
        const encounterCompletion = this.encounterCompletion;
        this.callbacks.updateEventState(finishSourceWildBattleFieldEffects({
          ...eventState,
          party: storeSourceEncounterParty(eventState.party, before),
          pendingEncounter: null,
          wildEncounterSteps: 0,
        }));
        if (this.localSession !== null) {
          this.localSession = closeSharedBattleSession(settleEscapedSharedBattleSession(this.localSession));
        }
        await this.presentation.endBattle(null, { escaped: true });
        if (battleId !== undefined) {
          this.callbacks.battleReports?.recordSettlement({ battleId,
            outcome: { escaped: true, experienceNotAwardedReason: "escaped" },
            moneyBefore: eventState.money, moneyAfter: eventState.money });
          this.callbacks.battleReports?.finish(battleId, before, "escaped");
        }
        this.clear();
        this.callbacks.setNotice("Fuite réussie : retour à l'exploration, sur la même case.");
        encounterCompletion?.(false);
      } else {
        await this.presentation.playTurn(before, result.turn.events);
        const replacements = resolveSourceControlledReplacements(result.turn.state);
        if (replacements.events.length > 0) {
          await this.presentation.playTurn(result.turn.state, replacements.events);
        }
        this.battle = replacements.state;
        this.recordLocalTurn(before, replacements.state, [...result.turn.events, ...replacements.events]);
        if (this.localSession !== null) {
          this.callbacks.battleReports?.recordTurn({ battleId: this.localSession.battleId, before,
            after: replacements.state, events: [...result.turn.events, ...replacements.events],
            trace: result.turn.trace, actions: [] });
        }
        if (this.battle.status === "finished") {
          const encounterCompletion = this.encounterCompletion;
          const settlement = settleSourceEncounter(eventState.party, this.battle,
            this.callbacks.getResources()?.catalog, this.callbacks.getEvolutionHour?.(), this.rng ?? undefined);
          const loss = sourceDefeatLoss({ ...eventState, party: settlement.party });
          this.callbacks.updateEventState({ ...eventState, party: settlement.party, money: eventState.money - loss });
          this.closeFinishedLocalSession(this.battle);
          const outcome: SourceBattleOutcome = { ...(loss > 0 ? { money: -loss } : {}),
            experienceNotAwardedReason: "defeat" };
          const battleId = this.localSession?.battleId;
          await this.presentation.endBattle(this.battle.winner, outcome);
          if (battleId !== undefined) {
            this.callbacks.battleReports?.recordSettlement({ battleId, outcome,
              moneyBefore: eventState.money, moneyAfter: eventState.money - loss });
            this.callbacks.battleReports?.finish(battleId, this.battle, "lost");
          }
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

  public async submitAction(moveIndex: number, activeSlot = 0, megaEvolution = false,
    target?: BattlePosition): Promise<void> {
    await this.submitTurnAction({ kind: "move", moveIndex,
      ...(megaEvolution ? { megaEvolution: true as const } : {}),
      ...(target === undefined ? {} : { target }) }, activeSlot);
  }

  public acknowledgeSharedBattleOpened(): void {
    this.sharedOpening = false;
  }

  /** Resumes the locally retained source continuation once the authoritative room has closed the battle. */
  public completeSharedBattle(outcome: SourceBattleSettlementOutcome,
    continuation: SourceBattleContext["continuation"]): boolean {
    if (!this.sharedContinuationPending) return false;
    const won = outcome === "won" || outcome === "captured";
    const encounterCompletion = this.encounterCompletion;
    const trainerCompletion = this.trainerCompletion;
    if (continuation === "pending-encounter") {
      const current = finishSourceWildBattleFieldEffects(this.callbacks.getEventState());
      if (outcome === "escaped") {
        this.callbacks.updateEventState({ ...current, pendingEncounter: null, wildEncounterSteps: 0 });
      } else if (won) {
        this.callbacks.updateEventState(completePendingEncounter(current));
      } else this.callbacks.updateEventState(current);
    }
    this.clear();
    this.callbacks.setNotice(outcome === "escaped"
      ? "Fuite réussie : retour à l'exploration, sur la même case."
      : outcome === "captured" ? "Capture réussie : le Pokémon rejoint votre collection personnelle."
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

  public async useItem(itemId: string, targetTeamIndex: number, activeSlot = 0,
    targetMoveIndex?: number): Promise<void> {
    await this.submitTurnAction({ kind: "item", itemId, targetTeamIndex,
      ...(targetMoveIndex === undefined ? {} : { targetMoveIndex }) }, activeSlot);
  }

  public async capture(ballId: string, activeSlot = 0, target?: BattlePosition): Promise<void> {
    await this.submitTurnAction({ kind: "capture", ballId, ...(target === undefined ? {} : { target }) }, activeSlot);
  }

  public async replacePokemon(teamIndex: number, activeSlot = 0): Promise<void> {
    if (this.battle === null || this.resolving) return;
    this.resolving = true;
    this.callbacks.render();
    try {
      const before = this.battle;
      const replacement = resolvePlayerReplacement(before, teamIndex, activeSlot);
      await this.presentation.playTurn(before, replacement.events);
      this.battle = replacement.state;
      this.recordLocalTurn(before, replacement.state, replacement.events);
      if (this.localSession !== null) {
        this.callbacks.battleReports?.recordTurn({ battleId: this.localSession.battleId, kind: "replacement",
          before, after: replacement.state, events: replacement.events, trace: [] });
      }
      this.callbacks.setNotice("Remplaçant envoyé au combat.");
    } catch (error) {
      this.callbacks.setNotice(error instanceof Error ? `Remplacement impossible : ${error.message}`
        : "Remplacement impossible.");
    } finally {
      this.resolving = false;
      this.callbacks.render();
    }
  }

  public get pendingDoubleSlots(): readonly number[] {
    return this.localDoubleActions.map((entry) => entry.actor.slot);
  }

  private async submitTurnAction(action: TeamBattleAction, activeSlot = 0): Promise<void> {
    if (this.battle === null || this.rng === null || this.resolving) return;
    const initialEventState = this.callbacks.getEventState();
    const consumedItemId = action.kind === "item" ? action.itemId : action.kind === "capture" ? action.ballId : null;
    if (consumedItemId !== null && (initialEventState.inventory[consumedItemId] ?? 0) <= 0) {
      this.callbacks.setNotice("Objet indisponible dans votre sac.");
      this.callbacks.render();
      return;
    }
    if ((action.kind === "item" || action.kind === "capture")
      && this.localDoubleActions.some((entry) => entry.action.kind === "item" || entry.action.kind === "capture")) {
      this.callbacks.setNotice("Un Dresseur ne peut utiliser qu'un objet par tour.");
      this.callbacks.render();
      return;
    }
    if (this.battle.format === "double") {
      const actor = { side: "player" as const, slot: activeSlot };
      if (!activeBattlePositions(this.battle).some((position) => position.side === actor.side && position.slot === actor.slot)) return;
      const activeIndex = activeTeamIndices(this.battle.teams.player)[activeSlot];
      if (activeIndex === undefined || this.battle.teams.player.members[activeIndex]!.hp <= 0) {
        this.localDoubleActions = this.localDoubleActions.filter((entry) => entry.actor.slot !== activeSlot);
        this.callbacks.setNotice("Ce Pokemon est K.O. et ne peut plus choisir d'action.");
        this.callbacks.render();
        return;
      }
      const requiredSlots = activeTeamIndices(this.battle.teams.player).flatMap((index, slot) =>
        this.battle!.teams.player.members[index]!.hp > 0 ? [slot] : []);
      this.localDoubleActions = this.localDoubleActions.filter((entry) => requiredSlots.includes(entry.actor.slot));
      this.localDoubleActions = [...this.localDoubleActions.filter((entry) => entry.actor.slot !== activeSlot), { actor, action }];
      if (requiredSlots.some((slot) => !this.localDoubleActions.some((entry) => entry.actor.slot === slot))) {
        this.callbacks.setNotice("Action du premier Pokemon enregistree. Choisissez celle du second.");
        this.callbacks.render();
        return;
      }
    }
    this.resolving = true;
    this.callbacks.render();
    try {
      let eventState = this.callbacks.getEventState();
      const before = this.battle;
      const itemPolicy = { context: "battle" as const, revivalAllowed: true,
        battleHealingAllowed: eventState.switches["666"] !== true };
      const resolutionRules = { opponentItemTheft: this.localSession?.origin !== "source-wild",
        wildBattle: this.localSession?.origin === "source-wild",
        escapable: eventState.pendingEncounter?.escapable === true };
      const submittedActions = before.format === "double" ? this.localDoubleActions.map((entry) => entry.action) : [action];
      let opponentItemChosen = false;
      const automaticOpponentActions = before.format !== "double" ? [] : activeTeamIndices(before.teams.opponent)
        .flatMap((index, slot) => before.teams.opponent.members[index]!.hp > 0 ? [slot] : []).map((slot) => {
        const action = chooseSourceBattleAction(before, "opponent", this.rng!, slot, !opponentItemChosen);
        if (action.kind === "item") opponentItemChosen = true;
        return { actor: { side: "opponent" as const, slot }, action };
      });
      let result;
      let reportedActions: readonly PositionedTeamBattleAction[];
      if (before.format === "double") {
        reportedActions = [...this.localDoubleActions, ...automaticOpponentActions];
        result = resolveDoubleTeamTurn(before, reportedActions, this.rng, itemPolicy, resolutionRules);
      } else {
        const singleResult = resolveSourceEncounterAction(before, action, this.rng, itemPolicy, resolutionRules);
        result = singleResult;
        reportedActions = [
          { actor: { side: "player", slot: 0 }, action: singleResult.actions.player },
          { actor: { side: "opponent", slot: 0 }, action: singleResult.actions.opponent },
        ];
      }
      const usedItems = submittedActions.flatMap((entry) => entry.kind === "item" ? [entry.itemId]
        : entry.kind === "capture" ? [entry.ballId] : []);
      if (usedItems.length > 0) {
        const inventory = { ...eventState.inventory };
        for (const itemId of usedItems) {
          const quantity = inventory[itemId] ?? 0;
          if (quantity <= 0) throw new Error("Objet indisponible dans votre sac.");
          if (quantity === 1) delete inventory[itemId]; else inventory[itemId] = quantity - 1;
        }
        eventState = { ...eventState, inventory };
        this.callbacks.updateEventState(eventState);
      }
      this.localDoubleActions = [];
      await this.presentation.playTurn(before, result.events);
      const moveEscaped = result.events.some((event) => event.type === "battleEscaped"
        || event.type === "positionedActionResolved"
          && event.events.some((inner) => inner.type === "battleEscaped"));
      if (moveEscaped) {
        const battleId = this.localSession?.battleId;
        const encounterCompletion = this.encounterCompletion;
        this.recordLocalTurn(before, result.state, result.events);
        if (battleId !== undefined) this.callbacks.battleReports?.recordTurn({ battleId, before,
          after: result.state, events: result.events, trace: result.trace, actions: reportedActions });
        this.callbacks.updateEventState(finishSourceWildBattleFieldEffects({ ...eventState,
          party: storeSourceEncounterParty(eventState.party, result.state),
          pendingEncounter: null, wildEncounterSteps: 0 }));
        if (this.localSession !== null) {
          this.localSession = closeSharedBattleSession(settleEscapedSharedBattleSession(this.localSession));
        }
        await this.presentation.endBattle(null, { escaped: true });
        if (battleId !== undefined) {
          this.callbacks.battleReports?.recordSettlement({ battleId,
            outcome: { escaped: true, experienceNotAwardedReason: "escaped" },
            moneyBefore: eventState.money, moneyAfter: eventState.money });
          this.callbacks.battleReports?.finish(battleId, result.state, "escaped");
        }
        this.clear();
        this.callbacks.setNotice("Le combat sauvage est terminé : retour à l'exploration.");
        encounterCompletion?.(false);
        return;
      }
      const replacements = resolveSourceControlledReplacements(result.state);
      const replacementState = replacements.state;
      const replacementEvents = replacements.events;
      if (replacementEvents.length > 0) await this.presentation.playTurn(result.state, replacementEvents);
      this.battle = replacementState;
      this.recordLocalTurn(before, replacementState, [...result.events, ...replacementEvents]);
      if (this.localSession !== null) {
        this.callbacks.battleReports?.recordTurn({ battleId: this.localSession.battleId, before,
          after: replacementState, events: [...result.events, ...replacementEvents], trace: result.trace,
          actions: reportedActions });
      }
      if (this.battle.status === "finished") {
        const captureEvent = result.events.flatMap((event) => event.type === "positionedActionResolved"
          ? [...event.events] : event.type === "captureAttempted" ? [event] : [])
          .find((event) => event.type === "captureAttempted" && event.success);
        if (captureEvent?.type === "captureAttempted") {
          const resources = this.callbacks.getResources();
          if (resources === null) throw new Error("Ressources de capture indisponibles.");
          const target = before.teams.opponent.members.find((member) => member.id === captureEvent.target);
          if (target === undefined) throw new Error("Pokémon capturé introuvable.");
          let pokemon = createPersistentPokemon(crypto.randomUUID(), target.species, target.level, resources.catalog,
            this.callbacks.getPokemonCreationContext(resources.mapId, captureEvent.ballId));
          pokemon = { ...pokemon,
            ability: target.ability,
            hp: captureEvent.ballId === "HEALBALL" ? pokemon.stats.maxHp : Math.min(target.hp, pokemon.stats.maxHp),
            majorStatus: captureEvent.ballId === "HEALBALL" ? null : target.majorStatus,
            moves: target.moves.map((slot) => ({ internalName: slot.move.internalName, pp: slot.pp, maxPp: slot.move.pp })),
            metadata: { ...pokemon.metadata,
              happiness: captureEvent.ballId === "FRIENDBALL" ? 200 : pokemon.metadata.happiness,
              form: target.appearance?.form ?? pokemon.metadata.form,
              shiny: target.appearance?.shiny ?? pokemon.metadata.shiny,
              gender: target.appearance?.gender ?? pokemon.metadata.gender } };
          const party = storeProjectedBattleTeam(eventState.party, before.teams.player,
            { retainTransferredHeldItems: true });
          const capturedState = { ...eventState, party,
            ranch: addPokemonToStorage(eventState.ranch, pokemon) };
          const nextState = completePendingEncounter(finishSourceWildBattleFieldEffects(capturedState));
          const encounterCompletion = this.encounterCompletion;
          const battleId = this.localSession?.battleId;
          this.closeFinishedLocalSession(this.battle);
          const outcome: SourceBattleOutcome = { captured: { name: target.name },
            experienceNotAwardedReason: "capture" };
          await this.presentation.endBattle("player", outcome);
          this.callbacks.updateEventState(nextState);
          if (battleId !== undefined) {
            this.callbacks.battleReports?.recordSettlement({ battleId, outcome,
              moneyBefore: eventState.money, moneyAfter: nextState.money });
            this.callbacks.battleReports?.finish(battleId, this.battle, "captured");
          }
          this.clear();
          this.callbacks.setNotice(`${target.name} capturé · choisissez son surnom et sa destination.`);
          await this.callbacks.onPokemonCaptured?.(pokemon.id);
          encounterCompletion?.(true);
          return;
        }
        const winner = this.battle.winner;
        const resources = this.callbacks.getResources();
        const trainerCompletion = this.trainerCompletion;
        const encounterCompletion = this.encounterCompletion;
        const trainerBattle = trainerCompletion !== null;
        let wildSettlement: ReturnType<typeof settleSourceEncounter> | null = null;
        let trainerGains: readonly SharedBattleExperienceGain[] = [];
        let nextState: SourceEventState;
        if (trainerBattle) {
          if (resources === null || this.localParticipation === null || this.localLedger === null) {
            throw new Error("Reglement local du combat de Dresseur incomplet.");
          }
          const experiencePolicy = sourceBattleExperiencePolicy(eventState);
          const levelCap = this.callbacks.getExperienceLevelCap?.() ?? experiencePolicy.levelCap;
          const trainerSettlement = settleSourceTrainerBattle(eventState.party, this.battle,
            this.localParticipation, this.localLedger, resources.catalog,
            { ...experiencePolicy, levelCap }, this.callbacks.getEvolutionHour?.(), this.rng ?? undefined);
          nextState = { ...eventState, party: trainerSettlement.party };
          trainerGains = trainerSettlement.gains;
        } else {
          wildSettlement = settleSourceEncounter(eventState.party, this.battle,
            resources?.catalog, this.callbacks.getEvolutionHour?.(), this.rng ?? undefined);
          nextState = { ...eventState, party: wildSettlement.party };
        }
        let moneyNotice = "";
        let moneyDelta = 0;
        const scatteredCoins = winner === "player" ? before.teams.player.members.reduce((sum, member) =>
          sum + (this.battle?.effects?.scatteredCoins?.[member.id] ?? 0), 0) : 0;
        if (winner === "player" && trainerCompletion !== null) {
          const amount = sourceTrainerReward(before.teams.opponent.members.map((member) => member.level),
            this.trainerAudio?.baseMoney ?? 0) + scatteredCoins;
          nextState = addSourceMoney(nextState, amount);
          moneyDelta = amount;
          if (amount > 0) moneyNotice = ` · +${amount.toLocaleString("fr-FR")} ₽`;
        } else if (winner === "player" && scatteredCoins > 0) {
          nextState = addSourceMoney(nextState, scatteredCoins);
          moneyDelta = scatteredCoins;
          moneyNotice = ` · +${scatteredCoins.toLocaleString("fr-FR")} ₽`;
        } else if (winner !== "player") {
          const amount = sourceDefeatLoss(nextState);
          nextState = { ...nextState, money: nextState.money - amount };
          moneyDelta = -amount;
          if (amount > 0) moneyNotice = ` · -${amount.toLocaleString("fr-FR")} ₽`;
        }
        const experience = wildSettlement?.experience === null || wildSettlement === null || resources === null
          ? undefined : battleExperiencePresentation(eventState.party, wildSettlement.party,
            wildSettlement.experience, resources.catalog);
        const experiences = resources === null ? []
          : sharedBattleExperiencePresentations(eventState.party, nextState.party, trainerGains, resources.catalog);
        const hasExperience = experience !== undefined || experiences.length > 0;
        const battleId = this.localSession?.battleId;
        this.closeFinishedLocalSession(this.battle);
        const outcome: SourceBattleOutcome = {
          ...(experience === undefined ? {} : { experience }),
          ...(experiences.length === 0 ? {} : { experiences }),
          ...(hasExperience ? {} : { experienceNotAwardedReason: winner === "player"
            ? "no-eligible-recipient" as const : "defeat" as const }),
          ...(moneyDelta === 0 ? {} : { money: moneyDelta }),
          ...(winner === "player" && trainerCompletion !== null && this.trainerAudio?.defeatText !== undefined
            ? { trainerDefeatText: this.trainerAudio.defeatText } : {}),
        };
        await this.presentation.endBattle(winner, outcome);
        if (trainerCompletion === null) {
          nextState = finishSourceWildBattleFieldEffects(nextState);
          if (wildSettlement?.completed === true) nextState = completePendingEncounter(nextState);
        }
        this.callbacks.updateEventState(nextState);
        if (battleId !== undefined) {
          this.callbacks.battleReports?.recordSettlement({ battleId, outcome,
            moneyBefore: eventState.money, moneyAfter: nextState.money });
          this.callbacks.battleReports?.finish(battleId, this.battle, winner === "player" ? "won" : "lost");
        }
        this.clear();
        const trainerSkippedMoves = trainerGains.flatMap((gain) => gain.skippedMoves);
        const skippedMoves = (wildSettlement?.experience?.skippedMoves ?? trainerSkippedMoves)
          .map((internalName) => resources?.catalog.moves
            .find((move) => move.internalName === internalName)?.name ?? internalName);
        const rewardAmount = wildSettlement?.experience?.amount
          ?? trainerGains.reduce((total, gain) => total + gain.gained, 0);
        const levelsGained = wildSettlement?.experience?.levelsGained
          ?? trainerGains.reduce((total, gain) => total + gain.nextLevel - gain.previousLevel, 0);
        this.callbacks.setNotice(winner === "player"
          ? `Victoire : l'équipe a été sauvegardée${rewardAmount <= 0 ? "." : ` · +${rewardAmount} EXP${levelsGained > 0 ? ` · +${levelsGained} niveau(x)` : ""}.`}${moneyNotice}${skippedMoves.length === 0 ? "" : ` Capacité(s) en attente d'un choix : ${skippedMoves.join(", ")}.`}`
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
    this.localParticipation = null;
    this.localLedger = null;
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
    const experience = sourceBattleExperiencePolicy(eventState);
    const levelCap = this.callbacks.getExperienceLevelCap?.() ?? experience.levelCap;
    return { origin: input.origin, mapId: resources.mapId, format: state.format ?? "single", escapable: input.escapable,
      healingItemsAllowed: eventState.switches["666"] !== true,
      presentation: { battlebackId: resources.battleback,
        battleMusicId: input.battleMusic === undefined ? resources.battleMusic : input.battleMusic,
        victoryMusicId: input.victoryMusic === undefined ? resources.victoryMusic : input.victoryMusic,
        opponentTrainer: input.opponentTrainer,
        defeatText: input.defeatText ?? null },
      rewards: { opponents, trainerBaseMoney: input.trainerBaseMoney,
        experience: { ...experience, levelCap } }, continuation: input.continuation };
  }

  private createLocalSession(origin: "source-wild" | "source-trainer", mapId: number): SharedBattleSession {
    this.localSequence += 1;
    return createSharedBattleSession({ battleId: `local-${mapId}-${this.localSequence}`, origin,
      narrativeOwnerId: "local", allowJoin: false });
  }

  private startLocalTracking(state: TeamBattleState): void {
    const camp = (side: BattleSide, ownerId: string | null) => {
      const team = state.teams[side];
      const activeIndices = team.activeIndices ?? [team.activeIndex];
      return {
        trainerIds: ownerId === null ? [] : [ownerId],
        members: team.members.map((battler) => ({ ownerId, battler })),
        activeMemberId: team.members[activeIndices[0]!]!.id,
        ...(team.activeIndices === undefined ? {} : {
          activeMemberIds: activeIndices.map((index) => team.members[index]!.id),
        }),
      };
    };
    this.localParticipation = { battleOwnerId: "local", format: state.format ?? "single",
      camps: { player: camp("player", "local"), opponent: camp("opponent", null) } };
    this.localLedger = createSharedBattleLedger(state);
  }

  private recordLocalTurn(before: TeamBattleState, after: TeamBattleState,
    events: readonly (TeamBattleEvent | DoubleBattleEvent)[]): void {
    if (this.localLedger === null) throw new Error("Registre local de participation absent.");
    this.localLedger = recordSharedBattleTurn(this.localLedger, before, after, events);
  }

  private closeFinishedLocalSession(state: TeamBattleState): void {
    if (this.localSession === null) throw new Error("Session locale de combat absente.");
    this.localSession = closeSharedBattleSession(settleSharedBattleSession(this.localSession, state));
  }
}
