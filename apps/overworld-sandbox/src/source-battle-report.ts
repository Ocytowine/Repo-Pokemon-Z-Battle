import type { BattleTrace, DoubleBattleEvent, PositionedTeamBattleAction, TeamBattleEvent,
  TeamBattleState } from "@pokemon-z-battle/battle-engine";
import type { SourceBattleContext, SourceBattleSettlement } from "@pokemon-z-battle/multiplayer-protocol";
import type { SourceBattleOutcome } from "./source-battle-controller.js";

export const SOURCE_BATTLE_REPORT_SCHEMA_VERSION = 1 as const;

export interface SourceBattleReportTurn {
  readonly kind: "turn" | "replacement";
  readonly turn: number;
  readonly recordedAt: string;
  readonly actions: readonly PositionedTeamBattleAction[] | null;
  readonly before: TeamBattleState;
  readonly after: TeamBattleState;
  readonly events: readonly (TeamBattleEvent | DoubleBattleEvent)[];
  readonly trace: readonly BattleTrace[];
}

export interface SourceBattleReportSettlement {
  readonly recordedAt: string;
  readonly settlement: SourceBattleSettlement | null;
  readonly outcome: SourceBattleOutcome;
  readonly moneyBefore: number;
  readonly moneyAfter: number;
}

export interface SourceBattleReport {
  readonly schemaVersion: typeof SOURCE_BATTLE_REPORT_SCHEMA_VERSION;
  readonly battleId: string;
  readonly mode: "solo" | "coop";
  readonly viewerSide: "player" | "opponent";
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly context: SourceBattleContext | null;
  readonly initialState: TeamBattleState;
  readonly turns: readonly SourceBattleReportTurn[];
  readonly settlements: readonly SourceBattleReportSettlement[];
  readonly finalState: TeamBattleState | null;
  readonly endReason: "won" | "lost" | "escaped" | "captured" | "closed" | null;
}

export interface SourceBattleReportSummary {
  readonly available: boolean;
  readonly active: boolean;
  readonly battleId: string | null;
  readonly mode: "solo" | "coop" | null;
  readonly turns: number;
  readonly endReason: SourceBattleReport["endReason"];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Personal, presentation-only diagnostic journal. It contains battle projections,
 * never the player's complete bag or save, and is not persisted or replicated.
 */
export class SourceBattleReportStore {
  private currentReport: SourceBattleReport | null = null;
  private completedReport: SourceBattleReport | null = null;

  public start(input: {
    readonly battleId: string;
    readonly mode: "solo" | "coop";
    readonly viewerSide: "player" | "opponent";
    readonly state: TeamBattleState;
    readonly context?: SourceBattleContext | null;
  }): void {
    if (this.currentReport?.battleId === input.battleId) return;
    this.currentReport = {
      schemaVersion: SOURCE_BATTLE_REPORT_SCHEMA_VERSION,
      battleId: input.battleId,
      mode: input.mode,
      viewerSide: input.viewerSide,
      startedAt: new Date().toISOString(),
      endedAt: null,
      context: clone(input.context ?? null),
      initialState: clone(input.state),
      turns: [],
      settlements: [],
      finalState: null,
      endReason: null,
    };
  }

  public recordTurn(input: {
    readonly battleId: string;
    readonly before: TeamBattleState;
    readonly after: TeamBattleState;
    readonly events: readonly (TeamBattleEvent | DoubleBattleEvent)[];
    readonly trace?: readonly BattleTrace[];
    readonly actions?: readonly PositionedTeamBattleAction[] | null;
    readonly kind?: SourceBattleReportTurn["kind"];
  }): void {
    const report = this.reportFor(input.battleId);
    if (report === null) return;
    const kind = input.kind ?? "turn";
    const duplicate = report.turns.some((turn) => turn.kind === kind && turn.turn === input.before.turn
      && JSON.stringify(turn.after) === JSON.stringify(input.after));
    if (duplicate) return;
    this.currentReport = { ...report, turns: [...report.turns, {
      kind, turn: input.before.turn,
      recordedAt: new Date().toISOString(),
      actions: clone(input.actions ?? null),
      before: clone(input.before),
      after: clone(input.after),
      events: clone(input.events),
      trace: clone(input.trace ?? []),
    }] };
  }

  public recordSettlement(input: {
    readonly battleId: string;
    readonly settlement?: SourceBattleSettlement | null;
    readonly outcome: SourceBattleOutcome;
    readonly moneyBefore: number;
    readonly moneyAfter: number;
  }): void {
    const report = this.reportFor(input.battleId);
    if (report === null) return;
    const settlements = [...report.settlements, {
      recordedAt: new Date().toISOString(),
      settlement: clone(input.settlement ?? null),
      outcome: clone(input.outcome),
      moneyBefore: input.moneyBefore,
      moneyAfter: input.moneyAfter,
    }];
    this.currentReport = { ...report, settlements };
  }

  public finish(battleId: string, finalState: TeamBattleState,
    reason: NonNullable<SourceBattleReport["endReason"]>): void {
    const report = this.reportFor(battleId);
    if (report === null) return;
    const completed: SourceBattleReport = { ...report, endedAt: new Date().toISOString(),
      finalState: clone(finalState), endReason: reason };
    this.currentReport = null;
    this.completedReport = completed;
  }

  public get report(): SourceBattleReport | null {
    return this.currentReport ?? this.completedReport;
  }

  public get summary(): SourceBattleReportSummary {
    const report = this.report;
    return { available: report !== null, active: this.currentReport !== null,
      battleId: report?.battleId ?? null, mode: report?.mode ?? null,
      turns: report?.turns.filter((entry) => entry.kind === "turn").length ?? 0,
      endReason: report?.endReason ?? null };
  }

  public serialize(): string | null {
    const report = this.report;
    return report === null ? null : `${JSON.stringify(report, null, 2)}\n`;
  }

  private reportFor(battleId: string): SourceBattleReport | null {
    return this.currentReport?.battleId === battleId ? this.currentReport : null;
  }
}
