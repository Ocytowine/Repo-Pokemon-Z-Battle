import type { BattleMove, BattlerState } from "./types.js";

const NORMAL_TYPE_CONVERSIONS = {
  AERILATE: "FLYING",
  LIQUIDVOICE: "WATER",
  PIELHERBACEA: "GRASS",
  PIELHELADA: "ICE",
  PIXILATE: "FAIRY",
} as const;

export interface EffectiveMoveType {
  readonly type: string;
  readonly abilityBoost: number;
}

/** Mirrors Pokemon Z's pbModifyType order, including its broad Liquid Voice branch. */
export function effectiveMoveType(attacker: BattlerState, move: BattleMove): EffectiveMoveType {
  if (move.type !== "NORMAL") return { type: move.type, abilityBoost: 1 };
  const ability = attacker.ability;
  if (ability === null || !(ability in NORMAL_TYPE_CONVERSIONS)) return { type: move.type, abilityBoost: 1 };
  return { type: NORMAL_TYPE_CONVERSIONS[ability as keyof typeof NORMAL_TYPE_CONVERSIONS], abilityBoost: 1.2 };
}

export function hasMoldBreaker(attacker: BattlerState): boolean {
  return attacker.ability === "MOLDBREAKER";
}

export function hasMoveFlag(move: BattleMove, flag: string): boolean {
  return move.flags?.includes(flag) === true;
}
