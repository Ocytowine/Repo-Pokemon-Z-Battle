import type { BattleEvent, BattleSide, BattleTeam } from "./types.js";

/** Shared party mutation used by both one-active and two-active battle adapters. */
export function curePartyStatuses(team: BattleTeam, side: BattleSide,
  alreadyResolved: ReadonlySet<string>, blocked: ReadonlySet<string> = new Set()):
  { team: BattleTeam; events: readonly BattleEvent[] } {
  const events: BattleEvent[] = [];
  const members = team.members.map((member) => {
    if (alreadyResolved.has(member.id) || blocked.has(member.id)
      || member.hp <= 0 || member.majorStatus === null) return member;
    events.push({ type: "partyStatusCured", side, memberId: member.id, status: member.majorStatus.kind });
    return { ...member, majorStatus: null };
  });
  return { team: { ...team, members }, events };
}
