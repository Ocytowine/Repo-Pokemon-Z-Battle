import type { SourceEventState } from "./source-event-state.js";
import { activateSourceTypeAmulet, isSourceTypeAmulet } from "./source-type-amulet.js";

export interface SourceFieldItemContext {
  readonly mapId: number;
  readonly x: number;
  readonly y: number;
}

export interface SourceFieldItemResult {
  readonly ok: boolean;
  readonly message: string;
  readonly state: SourceEventState;
  readonly sharedWorldChanged: boolean;
}

export function isSourceFieldItem(itemId: string): boolean {
  return isSourceTypeAmulet(itemId) || itemId === "TALISMANMALVO";
}

/** Shared entry point for Bag items whose target is the field rather than a Pokemon. */
export function useSourceFieldItem(state: SourceEventState, itemId: string, itemName: string,
  context: SourceFieldItemContext): SourceFieldItemResult {
  if (isSourceTypeAmulet(itemId)) {
    const result = activateSourceTypeAmulet(state, itemId, itemName);
    return { ...result, sharedWorldChanged: false };
  }
  if (itemId === "TALISMANMALVO") {
    if ((state.inventory[itemId] ?? 0) < 1) {
      return { ok: false, message: `${itemName} n’est plus dans le Sac.`, state, sharedWorldChanged: false };
    }
    if (context.mapId !== 190 || context.x !== 74 || context.y !== 25) {
      return { ok: true, message: "Vous levez le talisman, mais rien ne se passe.", state,
        sharedWorldChanged: false };
    }
    return { ok: true, message: "Le talisman commence à briller intensément !",
      state: { ...state, switches: { ...state.switches, "412": true } }, sharedWorldChanged: true };
  }
  return { ok: false, message: "Cet objet ne peut pas être utilisé sur le terrain.", state,
    sharedWorldChanged: false };
}
