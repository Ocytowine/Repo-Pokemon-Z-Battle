import type { BattleEffects, BattleSide, BattleTeam } from "./types.js";

/** Persist the source LastRoundFainted marker after every route through a team turn. */
export function recordSideFaints(effects: BattleEffects | undefined,
  previous: Readonly<Record<BattleSide, BattleTeam>>,
  current: Readonly<Record<BattleSide, BattleTeam>>, turn: number): BattleEffects | undefined {
  if (effects === undefined) return undefined;
  const fainted = (side: BattleSide): boolean => current[side].members.some((member) =>
    member.hp === 0 && (previous[side].members.find((old) => old.id === member.id)?.hp ?? 0) > 0);
  return { ...effects, sides: {
    player: fainted("player") ? { ...effects.sides.player, lastFaintedTurn: turn } : effects.sides.player,
    opponent: fainted("opponent") ? { ...effects.sides.opponent, lastFaintedTurn: turn } : effects.sides.opponent,
  } };
}
