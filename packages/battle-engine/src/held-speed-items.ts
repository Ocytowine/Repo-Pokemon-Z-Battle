import { heldItemIsActive } from "./ability-item-control.js";
import type { BattlerState } from "./types.js";

export const TRAINING_SPEED_ITEMS = ["MACHOBRACE", "POWERWEIGHT", "POWERBRACER", "POWERBELT",
  "POWERANKLET", "POWERLENS", "POWERBAND"] as const;

/** Pokemon Z pbSpeed item hooks. Iron Ball's raw-item speed check is unconditional in Ruby. */
export function heldSpeedModifier(battler: BattlerState, speed: number, magicRoomTurns = 0): number {
  if (battler.heldItem === "IRONBALL") return Math.max(1, Math.round(speed / 2));
  if (!heldItemIsActive(battler, magicRoomTurns)) return speed;
  if ((TRAINING_SPEED_ITEMS as readonly string[]).includes(battler.heldItem!))
    return Math.max(1, Math.round(speed / 2));
  if (battler.heldItem === "QUICKPOWDER" && battler.species === "DITTO"
    && battler.transformOriginal === undefined) return speed * 2;
  if (battler.heldItem === "FLOATSTONE") return Math.max(1, Math.round(speed * 1.25));
  return speed;
}
