import { heldItemIsActive } from "./ability-item-control.js";
import type { BattlerState } from "./types.js";

export const CHOICE_HELD_ITEMS = ["CHOICEBAND", "CHOICESPECS", "CHOICESCARF"] as const;

export function choiceLockApplies(battler: BattlerState, magicRoomTurns = 0): boolean {
  return battler.ability === "PODERSABIO" || heldItemIsActive(battler, magicRoomTurns)
    && (CHOICE_HELD_ITEMS as readonly string[]).includes(battler.heldItem!);
}

/** Ruby only enforces a stored lock while that move remains in the moveset. */
export function choiceLockedMove(battler: BattlerState, magicRoomTurns = 0): string | null {
  const locked = battler.volatile?.choiceLockedMove ?? null;
  return locked !== null && choiceLockApplies(battler, magicRoomTurns)
    && battler.moves.some((slot) => slot.move.internalName === locked) ? locked : null;
}

export function choiceSpeed(battler: BattlerState, speed: number, magicRoomTurns = 0): number {
  return battler.heldItem === "CHOICESCARF" && heldItemIsActive(battler, magicRoomTurns)
    ? Math.max(1, Math.round(speed * 1.5)) : speed;
}
