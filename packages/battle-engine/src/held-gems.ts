import type { BattlerState } from "./types.js";
import { heldItemIsActive } from "./ability-item-control.js";

const GEM_TYPES: Record<string, string> = {
  NORMALGEM: "NORMAL", FIGHTINGGEM: "FIGHTING", FLYINGGEM: "FLYING",
  POISONGEM: "POISON", GROUNDGEM: "GROUND", ROCKGEM: "ROCK",
  BUGGEM: "BUG", GHOSTGEM: "GHOST", STEELGEM: "STEEL",
  FIREGEM: "FIRE", WATERGEM: "WATER", GRASSGEM: "GRASS",
  ELECTRICGEM: "ELECTRIC", PSYCHICGEM: "PSYCHIC", ICEGEM: "ICE",
  DRAGONGEM: "DRAGON", DARKGEM: "DARK", FAIRYGEM: "FAIRY",
};

/** The Ruby damage hook excludes the three Pledge functions. */
export function matchingHeldGem(battler: BattlerState, moveType: string,
  functionCode: string, magicRoomTurns?: number): string | null {
  if (functionCode === "106" || functionCode === "107" || functionCode === "108") return null;
  const item = battler.heldItem;
  return item !== null && GEM_TYPES[item] === moveType
    && heldItemIsActive(battler, magicRoomTurns) ? item : null;
}

export const ALL_HELD_GEMS = Object.freeze(Object.keys(GEM_TYPES));
