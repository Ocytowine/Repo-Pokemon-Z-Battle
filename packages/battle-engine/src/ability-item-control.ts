import type { BattleMove, BattlerState, HeldItem } from "./types.js";
import { NATURAL_GIFT_BERRIES } from "./natural-gift.js";

const PLATES = new Set<HeldItem>(["FISTPLATE", "SKYPLATE", "TOXICPLATE", "EARTHPLATE", "STONEPLATE",
  "INSECTPLATE", "SPOOKYPLATE", "IRONPLATE", "FLAMEPLATE", "SPLASHPLATE", "MEADOWPLATE", "ZAPPLATE",
  "MINDPLATE", "ICICLEPLATE", "DRACOPLATE", "DREADPLATE", "PIXIEPLATE", "TABLANEUTRA"]);

export function heldItemIsUnlosable(battler: BattlerState): boolean {
  return battler.ability === "MULTITYPE" && battler.heldItem !== null && PLATES.has(battler.heldItem);
}

export function heldItemIsActive(battler: BattlerState, magicRoomTurns = 0): boolean {
  return battler.heldItem !== null && battler.ability !== "KLUTZ"
    && (battler.volatile?.embargoTurns ?? 0) === 0 && magicRoomTurns <= 0;
}

export function hasActiveHeldItem<I extends HeldItem>(battler: BattlerState, item: I): battler is BattlerState & {
  readonly heldItem: I;
} {
  return battler.heldItem === item && heldItemIsActive(battler);
}

export function berriesBlockedBy(opponents: readonly BattlerState[]): boolean {
  return opponents.some((opponent) => opponent.hp > 0 && opponent.ability === "UNNERVE");
}

export function moveCanTriggerPressure(move: BattleMove): boolean {
  const target = (move.targetCode ?? "00").toUpperCase().replace(/^0X/u, "");
  return !["01", "10", "20", "40", "80", "100", "200"].includes(target);
}

export function isSupportedBerry(item: HeldItem | null): boolean {
  return item !== null && NATURAL_GIFT_BERRIES.has(item);
}

export function consumeHeldItem(battler: BattlerState, item: HeldItem, pickupUse: number,
  options: { readonly recyclable?: boolean; readonly pickup?: boolean } = {}): BattlerState {
  return {
    ...battler,
    heldItem: null,
    ...(options.recyclable === false ? {} : { recyclableItem: item }),
    volatile: {
      ...battler.volatile!,
      unburdened: true,
      ...(isSupportedBerry(item) ? { belchReady: true } : {}),
      ...(options.pickup === false ? {} : { pickupItem: item, pickupUse }),
    },
  };
}

export function removeHeldItem(battler: BattlerState): BattlerState {
  return { ...battler, heldItem: null, volatile: { ...battler.volatile!, unburdened: true } };
}
