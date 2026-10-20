<<<<<<< HEAD
import type { BattleMove } from "./types.js";

const RECOIL_DIVISORS: Readonly<Partial<Record<BattleMove["functionCode"], number>>> = {
  "0FA": 4,
  "0FB": 3,
  "0FC": 2,
  "0FD": 3,
  "0FE": 3,
};

export function recoilDivisor(move: BattleMove): number | null {
  return RECOIL_DIVISORS[move.functionCode] ?? null;
}

export function isRecklessBoostedMove(move: BattleMove): boolean {
  return recoilDivisor(move) !== null || move.functionCode === "10B";
=======
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
>>>>>>> 52b0b9123ed2c596c96a1144d039db8d7777731e
}
