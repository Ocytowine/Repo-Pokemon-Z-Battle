import { SeededRandom, type BattleSide, type TeamBattleEvent, type TeamBattleState } from "@pokemon-z-battle/battle-engine";
import type { PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import {
  applyAutomaticReplacements,
  attemptSourceEncounterEscape,
  createSourceEncounterBattle,
  resolveSourceEncounterTurn,
  settleSourceEncounter,
  storeSourceEncounterParty,
} from "./source-encounter.js";
import { completePendingEncounter, type SourceEventState } from "./source-event-state.js";

export interface SourceBattleResources {
  readonly catalog: PlayerCreationCatalog;
  readonly battleback: string;
  readonly battleMusic: string | null;
  readonly victoryMusic: string | null;
}

export interface SourceBattlePresentation {
  readonly startBattle: (state: TeamBattleState, audio: {
    readonly battleMusic?: string | null;
    readonly victoryMusic?: string | null;
  }) => Promise<void>;
  readonly playTurn: (before: TeamBattleState, events: readonly TeamBattleEvent[]) => Promise<void>;
  readonly endBattle: (winner: BattleSide | null) => void;
  readonly render: (state: TeamBattleState, battleback?: string) => Promise<void>;
}

export interface SourceBattleCallbacks {
  readonly getEventState: () => SourceEventState;
  readonly updateEventState: (state: SourceEventState) => void;
  readonly getResources: () => SourceBattleResources | null;
  readonly setNotice: (notice: string) => void;
  readonly render: () => void;
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

  public constructor(
    private readonly presentation: SourceBattlePresentation,
    private readonly callbacks: SourceBattleCallbacks,
  ) {}

  public get current(): TeamBattleState | null {
    return this.battle;
  }

  public get active(): boolean {
    return this.battle !== null;
  }

  public get animating(): boolean {
    return this.resolving;
  }

  public startPendingEncounter(): void {
    const eventState = this.callbacks.getEventState();
    const encounter = eventState.pendingEncounter;
    const resources = this.callbacks.getResources();
    if (encounter === null || resources === null || this.battle !== null) return;
    try {
      this.battle = createSourceEncounterBattle(eventState.party, encounter, resources.catalog,
        `wild-${encounter.species.toLowerCase()}`);
      this.rng = new SeededRandom(encounterSeed(encounter.species, encounter.level));
      this.escapeAttempts = 0;
      void this.presentation.startBattle(this.battle,
        { battleMusic: resources.battleMusic, victoryMusic: resources.victoryMusic });
      this.callbacks.setNotice(`Combat lancé contre ${encounter.species} niveau ${encounter.level}.`);
    } catch (error) {
      this.battle = null;
      this.rng = null;
      this.callbacks.setNotice(error instanceof Error ? `Combat impossible : ${error.message}` : "Combat source impossible.");
    }
    this.callbacks.render();
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
        this.callbacks.updateEventState({
          ...eventState,
          party: storeSourceEncounterParty(eventState.party, before),
          pendingEncounter: null,
          wildEncounterSteps: 0,
        });
        this.presentation.endBattle(null);
        this.clear();
        this.callbacks.setNotice("Fuite réussie : retour à l'exploration, sur la même case.");
      } else {
        await this.presentation.playTurn(before, result.turn.events);
        this.battle = applyAutomaticReplacements(result.turn.state);
        if (this.battle.status === "finished") {
          const settlement = settleSourceEncounter(eventState.party, this.battle, this.callbacks.getResources()?.catalog);
          this.callbacks.updateEventState({ ...eventState, party: settlement.party });
          this.presentation.endBattle(this.battle.winner);
          this.clear();
          this.callbacks.setNotice("Fuite ratée et équipe vaincue : l'équipe a été restaurée, la rencontre peut être retentée.");
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
    if (this.battle === null || this.rng === null || this.resolving) return;
    this.resolving = true;
    this.callbacks.render();
    try {
      const eventState = this.callbacks.getEventState();
      const before = this.battle;
      const result = resolveSourceEncounterTurn(before, moveIndex, this.rng);
      await this.presentation.playTurn(before, result.events);
      this.battle = applyAutomaticReplacements(result.state);
      if (this.battle.status === "finished") {
        const winner = this.battle.winner;
        this.presentation.endBattle(winner);
        const resources = this.callbacks.getResources();
        const settlement = settleSourceEncounter(eventState.party, this.battle, resources?.catalog);
        let nextState = { ...eventState, party: settlement.party };
        if (settlement.completed) nextState = completePendingEncounter(nextState);
        this.callbacks.updateEventState(nextState);
        this.clear();
        const skippedMoves = settlement.experience?.skippedMoves.map((internalName) => resources?.catalog.moves
          .find((move) => move.internalName === internalName)?.name ?? internalName) ?? [];
        const reward = settlement.experience;
        this.callbacks.setNotice(winner === "player"
          ? `Victoire : l'équipe a été sauvegardée${reward === null ? "." : ` · +${reward.amount} EXP${reward.levelsGained > 0 ? ` · +${reward.levelsGained} niveau(x)` : ""}.`}${skippedMoves.length === 0 ? "" : ` Capacité(s) en attente d'un choix : ${skippedMoves.join(", ")}.`}`
          : "Défaite : l'équipe a été restaurée et la rencontre reste disponible pour une nouvelle tentative.");
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
  }
}
