import type { BattleSide, TeamBattleEvent, TeamBattleState } from "@pokemon-z-battle/battle-engine";

export function oppositeBattleSide(side: BattleSide): BattleSide {
  return side === "player" ? "opponent" : "player";
}

export function networkBattleForViewer(state: TeamBattleState, viewer: BattleSide): TeamBattleState {
  if (viewer === "player") return state;
  return {
    ...state,
    winner: state.winner === null ? null : oppositeBattleSide(state.winner),
    teams: { player: state.teams.opponent, opponent: state.teams.player },
    replacementRequired: state.replacementRequired.map(oppositeBattleSide),
  };
}

export function networkBattleEventsForViewer(events: readonly TeamBattleEvent[], viewer: BattleSide): readonly TeamBattleEvent[] {
  if (viewer === "player") return events;
  return events.map((event) => {
    const mapped: Record<string, unknown> = { ...event };
    for (const key of ["side", "source", "target", "winner"] as const) {
      if (mapped[key] === "player" || mapped[key] === "opponent") mapped[key] = oppositeBattleSide(mapped[key]);
    }
    if (event.type === "actionOrdered") mapped.order = event.order.map(oppositeBattleSide);
    if (event.type === "teamActionOrdered") {
      mapped.order = event.order.map((entry) => ({ ...entry, side: oppositeBattleSide(entry.side) }));
    }
    return mapped as unknown as TeamBattleEvent;
  });
}
