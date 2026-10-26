import { heldItemIsActive } from "./ability-item-control.js";
import type { BattlerState } from "./types.js";

export function superEvioliteApplies(battler: BattlerState, magicRoomTurns = 0): boolean {
  return battler.heldItem === "SUPEREVIOLITE" && battler.canEvolveTwice === true
    && heldItemIsActive(battler, magicRoomTurns);
}

export function tablaEsquiApplies(battler: BattlerState, magicRoomTurns = 0): boolean {
  return battler.heldItem === "TABLAESQUI" && battler.species === "BIBAREL"
    && heldItemIsActive(battler, magicRoomTurns);
}

export function zStatItemSpeed(battler: BattlerState, speed: number, magicRoomTurns = 0): number {
  return superEvioliteApplies(battler, magicRoomTurns) || tablaEsquiApplies(battler, magicRoomTurns)
    ? Math.max(1, Math.round(speed * 1.5)) : speed;
}
