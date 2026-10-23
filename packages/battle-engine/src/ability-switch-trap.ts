import { isGrounded } from "./ability-field-entry.js";
import { heldItemIsActive } from "./ability-item-control.js";
import type { BattlerState, ImplementedBattleAbility } from "./types.js";

export type SwitchTrapAbility = Extract<ImplementedBattleAbility, "ARENATRAP" | "MAGNETPULL" | "SHADOWTAG">;

/**
 * Returns the opposing ability preventing a voluntary switch.
 * Replacement after fainting and forced movement deliberately bypass this predicate.
 */
export function switchTrapAbility(battler: BattlerState,
  opponents: readonly BattlerState[], magicRoomTurns = 0): SwitchTrapAbility | null {
  if (battler.hp <= 0 || battler.types.includes("GHOST")
    || battler.heldItem === "SHEDSHELL" && heldItemIsActive(battler, magicRoomTurns)) return null;
  const active = opponents.filter((opponent) => opponent.hp > 0);
  if (battler.types.includes("STEEL") && active.some((opponent) => opponent.ability === "MAGNETPULL")) {
    return "MAGNETPULL";
  }
  if (isGrounded(battler) && active.some((opponent) => opponent.ability === "ARENATRAP")) return "ARENATRAP";
  if (battler.ability !== "SHADOWTAG" && active.some((opponent) => opponent.ability === "SHADOWTAG")) {
    return "SHADOWTAG";
  }
  return null;
}

export function assertVoluntarySwitchAllowed(battler: BattlerState,
  opponents: readonly BattlerState[], magicRoomTurns = 0): void {
  const ability = switchTrapAbility(battler, opponents, magicRoomTurns);
  if (ability !== null) throw new Error(`Cannot switch ${battler.id}: trapped by ${ability}.`);
}
