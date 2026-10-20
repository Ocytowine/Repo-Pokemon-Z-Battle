import type { SourceEventState, SourceTypeAmuletState } from "./source-event-state.js";

export const SOURCE_TYPE_AMULET_STEPS = 500;

export const SOURCE_TYPE_AMULETS = Object.freeze({
  AMULETOBICHO: "BUG",
  AMULETOSINIESTRO: "DARK",
  AMULETODRAGON: "DRAGON",
  AMULETOELECTRICO: "ELECTRIC",
  AMULETOHADA: "FAIRY",
  AMULETOLUCHA: "FIGHTING",
  AMULETOFUEGO: "FIRE",
  AMULETOVOLADOR: "FLYING",
  AMULETOFANTASMA: "GHOST",
  AMULETOPLANTA: "GRASS",
  AMULETOTIERRA: "GROUND",
  AMULETOHIELO: "ICE",
  AMULETONORMAL: "NORMAL",
  AMULETOVENENO: "POISON",
  AMULETOPSIQUICO: "PSYCHIC",
  AMULETOROCA: "ROCK",
  AMULETOACERO: "STEEL",
  AMULETOAGUA: "WATER",
} satisfies Readonly<Record<string, string>>);

export type SourceTypeAmuletItem = keyof typeof SOURCE_TYPE_AMULETS;

export interface SourceTypeAmuletResult {
  readonly ok: boolean;
  readonly message: string;
  readonly state: SourceEventState;
}

export interface SourceTypeAmuletStepResult {
  readonly state: SourceEventState;
  readonly expired: boolean;
}

export function isSourceTypeAmulet(itemId: string): itemId is SourceTypeAmuletItem {
  return Object.hasOwn(SOURCE_TYPE_AMULETS, itemId);
}

/** Personal field effect: the Bag and countdown never enter the shared Coop world state. */
export function activateSourceTypeAmulet(state: SourceEventState, itemId: string,
  itemName = itemId): SourceTypeAmuletResult {
  if (!isSourceTypeAmulet(itemId)) return { ok: false, message: "Cet objet n’est pas une amulette de type.", state };
  if (state.typeAmulet !== null) {
    return { ok: false, message: "La dernière amulette utilisée fait encore effet.", state };
  }
  const quantity = state.inventory[itemId] ?? 0;
  if (quantity < 1) return { ok: false, message: `${itemName} n’est plus dans le Sac.`, state };
  const inventory = { ...state.inventory };
  if (quantity === 1) delete inventory[itemId];
  else inventory[itemId] = quantity - 1;
  const typeAmulet: SourceTypeAmuletState = {
    itemId, type: SOURCE_TYPE_AMULETS[itemId], stepsRemaining: SOURCE_TYPE_AMULET_STEPS,
  };
  return { ok: true, message: `${itemName} est activée pour ${SOURCE_TYPE_AMULET_STEPS} pas.`,
    state: { ...state, inventory, typeAmulet } };
}

/** Pokemon Z does not count steps taken on ice for this effect. */
export function advanceSourceTypeAmulet(state: SourceEventState, terrainTag: number): SourceTypeAmuletStepResult {
  if (state.typeAmulet === null || terrainTag === 12) return { state, expired: false };
  const stepsRemaining = state.typeAmulet.stepsRemaining - 1;
  if (stepsRemaining > 0) {
    return { state: { ...state, typeAmulet: { ...state.typeAmulet, stepsRemaining } }, expired: false };
  }
  return { state: { ...state, typeAmulet: null }, expired: true };
}
