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
}
