import type { SourceCheckpoint, SourceEventState } from "./source-event-state.js";
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
  readonly encounterRequested?: true;
  readonly transfer?: SourceCheckpoint;
}

const REPEL_STEPS: Readonly<Record<string, number>> = {
  REPEL: 100, SUPERREPEL: 200, MAXREPEL: 400,
};
const PERSONAL_FIELD_ITEMS = new Set(["BLACKFLUTE", "WHITEFLUTE", "HONEY", "ESCAPEROPE", "SHINYZADOR"]);

export function isSourceFieldItem(itemId: string): boolean {
  return isSourceTypeAmulet(itemId) || itemId === "TALISMANMALVO"
    || itemId in REPEL_STEPS || PERSONAL_FIELD_ITEMS.has(itemId);
}

function consumeFieldItem(state: SourceEventState, itemId: string): SourceEventState {
  const quantity = state.inventory[itemId] ?? 0;
  const inventory = { ...state.inventory };
  if (quantity <= 1) delete inventory[itemId]; else inventory[itemId] = quantity - 1;
  return { ...state, inventory };
}

/** The source decrements repel only on non-ice steps. */
export function advanceSourceRepel(state: SourceEventState, terrainTag: number): {
  readonly state: SourceEventState; readonly expired: boolean } {
  const remaining = state.fieldItemEffects.repelSteps;
  if (remaining <= 0 || terrainTag === 12) return { state, expired: false };
  return { state: { ...state, fieldItemEffects: { ...state.fieldItemEffects, repelSteps: remaining - 1 } },
    expired: remaining === 1 };
}

export function sourceRepelBlocksEncounter(state: SourceEventState, level: number): boolean {
  const lead = state.party.members.find((member) => member.hp > 0 && member.metadata.eggSteps <= 0);
  return state.fieldItemEffects.repelSteps > 0 && lead !== undefined && level <= lead.level;
}

export function finishSourceWildBattleFieldEffects(state: SourceEventState): SourceEventState {
  return state.fieldItemEffects.shinyNextWildEncounter
    ? { ...state, fieldItemEffects: { ...state.fieldItemEffects, shinyNextWildEncounter: false } } : state;
}

/** Shared entry point for Bag items whose target is the field rather than a Pokemon. */
export function useSourceFieldItem(state: SourceEventState, itemId: string, itemName: string,
  context: SourceFieldItemContext): SourceFieldItemResult {
  if (isSourceTypeAmulet(itemId)) {
    const result = activateSourceTypeAmulet(state, itemId, itemName);
    return { ...result, sharedWorldChanged: false };
  }
  if (itemId in REPEL_STEPS || PERSONAL_FIELD_ITEMS.has(itemId)) {
    if ((state.inventory[itemId] ?? 0) < 1) {
      return { ok: false, message: `${itemName} n’est plus dans le Sac.`, state, sharedWorldChanged: false };
    }
    const effects = state.fieldItemEffects;
    if (itemId in REPEL_STEPS) {
      if (effects.repelSteps > 0) return { ok: false, message: "Un Repousse est encore actif.", state,
        sharedWorldChanged: false };
      const steps = REPEL_STEPS[itemId]!;
      return { ok: true, message: `${itemName} est actif pour ${steps} pas.`, sharedWorldChanged: false,
        state: { ...consumeFieldItem(state, itemId), fieldItemEffects: { ...effects, repelSteps: steps } } };
    }
    if (itemId === "BLACKFLUTE" || itemId === "WHITEFLUTE") {
      const flute = itemId === "BLACKFLUTE" ? "high" : "low";
      return { ok: true, message: `${itemName} modifie le niveau des prochaines rencontres.`,
        state: { ...state, fieldItemEffects: { ...effects, flute } }, sharedWorldChanged: false };
    }
    if (itemId === "SHINYZADOR") {
      if (effects.shinyNextWildEncounter) return { ok: false,
        message: "Une Potion Brillante est déjà active.", state, sharedWorldChanged: false };
      return { ok: true, message: "Le prochain Pokémon sauvage sera chromatique.", sharedWorldChanged: false,
        state: { ...consumeFieldItem(state, itemId), fieldItemEffects: {
          ...effects, shinyNextWildEncounter: true } } };
    }
    if (itemId === "ESCAPEROPE") {
      if (effects.escapePoint === null) return { ok: false, message: "Impossible de sortir d’ici avec cet objet.",
        state, sharedWorldChanged: false };
      return { ok: true, message: `${itemName} vous ramène à l’entrée.`, sharedWorldChanged: false,
        transfer: effects.escapePoint, state: { ...consumeFieldItem(state, itemId),
          fieldItemEffects: { ...effects, escapePoint: null } } };
    }
    return { ok: true, message: `${itemName} répand un doux parfum.`, sharedWorldChanged: false,
      encounterRequested: true, state: consumeFieldItem(state, itemId) };
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
