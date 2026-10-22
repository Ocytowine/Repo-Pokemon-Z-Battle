import { hasMoldBreaker } from "./move-properties.js";
import type { BattlerState } from "./types.js";

/** Shared guard for opponent-imposed switching. Self-pivots deliberately bypass it. */
export function forcedSwitchBlockedByAbility(source: BattlerState, target: BattlerState): boolean {
  return target.hp > 0 && target.ability === "SUCTIONCUPS" && !hasMoldBreaker(source);
}
