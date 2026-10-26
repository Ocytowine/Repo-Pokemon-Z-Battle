import { berriesBlockedBy, heldItemIsActive } from "./ability-item-control.js";
import type { BattlerState, HeldItem } from "./types.js";

/** Type-reduction berries actually declared in the source PBS catalog. */
export const RESIST_BERRY_TYPES: Readonly<Partial<Record<HeldItem, string>>> = {
  OCCABERRY: "FIRE", PASSHOBERRY: "WATER", WACANBERRY: "ELECTRIC",
  RINDOBERRY: "GRASS", YACHEBERRY: "ICE", CHOPLEBERRY: "FIGHTING",
  KEBIABERRY: "POISON", SHUCABERRY: "GROUND", COBABERRY: "FLYING",
  PAYAPABERRY: "PSYCHIC", TANGABERRY: "BUG", CHARTIBERRY: "ROCK",
  KASIBBERRY: "GHOST", HABANBERRY: "DRAGON", COLBURBERRY: "DARK",
  BABIRIBERRY: "STEEL", CHILANBERRY: "NORMAL", ROSELIBERRY: "FAIRY",
};

export function resistBerryApplies(item: HeldItem | null, type: string, effectiveness: number): boolean {
  return item !== null && RESIST_BERRY_TYPES[item] === type
    && (item === "CHILANBERRY" ? effectiveness > 0 : effectiveness > 1);
}

/** Custap is resolved while choosing turn order, not by the generic pinch hook. */
export function custapBerryReady(battler: BattlerState, opponents: readonly BattlerState[],
  magicRoomTurns = 0): boolean {
  return battler.hp > 0 && battler.heldItem === "CUSTAPBERRY"
    && heldItemIsActive(battler, magicRoomTurns) && !berriesBlockedBy(opponents)
    && battler.hp <= Math.floor(battler.stats.maxHp / (battler.ability === "GLUTTONY" ? 2 : 4));
}
