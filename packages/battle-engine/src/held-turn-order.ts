import { heldItemIsActive } from "./ability-item-control.js";
import type { BattlerState } from "./types.js";

/** The four held-item hooks in Pokemon Z's pbPriority routine. */
export const SOURCE_HELD_TURN_ORDER_ITEMS = ["CUSTAPBERRY", "QUICKCLAW", "LAGGINGTAIL", "FULLINCENSE"] as const;

export function isHeldTurnOrderItemSupported(item: string): boolean {
  return (SOURCE_HELD_TURN_ORDER_ITEMS as readonly string[]).includes(item);
}

export function quickClawCanActivate(battler: BattlerState, magicRoomTurns = 0): boolean {
  return battler.hp > 0 && battler.heldItem === "QUICKCLAW"
    && heldItemIsActive(battler, magicRoomTurns);
}

/** Custap and Quick Claw take precedence over both Stall and lagging held items. */
export function heldTurnOrderBracket(battler: BattlerState, magicRoomTurns: number,
  custapActivated: boolean, quickClawRoll: number | null): {
  readonly early: boolean; readonly lagging: boolean; readonly quickClaw: boolean } {
  const quickClaw = !custapActivated && quickClawRoll !== null
    && quickClawCanActivate(battler, magicRoomTurns) && quickClawRoll < 2;
  const lagging = !custapActivated && !quickClaw && (battler.ability === "STALL"
    || heldItemIsActive(battler, magicRoomTurns)
      && (battler.heldItem === "LAGGINGTAIL" || battler.heldItem === "FULLINCENSE"));
  return { early: custapActivated || quickClaw, lagging, quickClaw };
}
