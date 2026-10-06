import type { BattleSide, DoubleBattleEvent, SharedBattleParticipation, TeamBattleEvent,
  TeamBattleState } from "@pokemon-z-battle/battle-engine";

export function oppositeBattleSide(side: BattleSide): BattleSide {
  return side === "player" ? "opponent" : "player";
}

function activeTrainerId(participation: SharedBattleParticipation, side: BattleSide): string | null {
  const camp = participation.camps[side];
  return camp.members.find((member) => member.battler.id === camp.activeMemberId)?.ownerId
    ?? camp.trainerIds[0] ?? null;
}

/** Resolves trainer identities from battle ownership, independently from host/guest room sides. */
export function networkBattleTrainerIds(participation: SharedBattleParticipation,
  viewer: BattleSide): { readonly player: string | null; readonly opponent: string | null } {
  return { player: activeTrainerId(participation, viewer),
    opponent: activeTrainerId(participation, oppositeBattleSide(viewer)) };
}

export function networkBattleForViewer(state: TeamBattleState, viewer: BattleSide): TeamBattleState {
  if (viewer === "player") return state;
  return {
    ...state,
    winner: state.winner === null ? null : oppositeBattleSide(state.winner),
    teams: { player: state.teams.opponent, opponent: state.teams.player },
    replacementRequired: state.replacementRequired.map(oppositeBattleSide),
    ...(state.slotReplacements === undefined ? {} : { slotReplacements: state.slotReplacements.map((position) =>
      ({ ...position, side: oppositeBattleSide(position.side) })) }),
  };
}

export function networkBattleEventsForViewer(events: readonly (TeamBattleEvent | DoubleBattleEvent)[], viewer: BattleSide): readonly (TeamBattleEvent | DoubleBattleEvent)[] {
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
    if (event.type === "positionedActionResolved") {
      mapped.actor = { ...event.actor, side: oppositeBattleSide(event.actor.side) };
      mapped.targets = event.targets.map((position) => ({ ...position, side: oppositeBattleSide(position.side) }));
      mapped.events = networkBattleEventsForViewer(event.events, viewer);
    }
    return mapped as unknown as TeamBattleEvent | DoubleBattleEvent;
  });
}
