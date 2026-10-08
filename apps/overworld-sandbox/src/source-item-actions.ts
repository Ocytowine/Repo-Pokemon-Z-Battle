import { isHeldItemSupported, isPokemonItemUsableInField, pokemonItemTargetMode } from "@pokemon-z-battle/player-state";
import type { SourceActionWheelAction } from "./source-action-wheel.js";
import type { SourceShopItem } from "./source-economy.js";

export type SourceItemActionId = "use" | "teach" | "give" | "discard" | `specific:${string}`;
export type SourceItemSpecificAction = SourceActionWheelAction<`specific:${string}`>;

export interface SourceItemActionOptions {
  readonly quantity: number;
  readonly machineCompatibilityAvailable?: boolean;
  readonly specificActions?: readonly SourceItemSpecificAction[];
}

export interface SourceItemTargetFlow {
  readonly action: "use" | "give" | "teach";
  readonly stages: readonly ("pokemon" | "move" | "compatibility" | "replace-move" | "confirmation")[];
}

/** Keeps the source item identity while making the separately stored machine move visible in the Bag. */
export function sourceItemDisplayName(item: SourceShopItem, machineMoveName?: string): string {
  if (item.machineMove === null || item.machineMove === undefined || machineMoveName === undefined
    || machineMoveName.trim() === "") return item.name;
  if (item.name.toLocaleLowerCase("fr").includes(machineMoveName.toLocaleLowerCase("fr"))) return item.name;
  return `${item.name.replace(/[.\s]+$/u, "")} · ${machineMoveName}`;
}

/** Declares the UI stages independently from their future rules and mutations. */
export function sourceItemTargetFlow(item: SourceShopItem, action: "use" | "give" | "teach"): SourceItemTargetFlow {
  if (action === "give") return { action, stages: ["pokemon", "confirmation"] };
  if (action === "teach" || item.machineMove !== null && item.machineMove !== undefined) {
    return { action: "teach", stages: ["pokemon", "compatibility", "replace-move", "confirmation"] };
  }
  return { action, stages: ["pokemon", ...(pokemonItemTargetMode(item.internalName) === "move" ? ["move" as const] : []),
    "confirmation"] };
}

/** Pokemon Z sets INFINITETMS=true: key items, TMs and HMs cannot be discarded. */
export function isSourceItemDiscardable(item: SourceShopItem): boolean {
  return item.itemType !== 6 && item.fieldUse !== 3 && item.fieldUse !== 4;
}

/** Extension-ready item menu: item-specific actions are appended by feature modules through options. */
export function sourceItemActions(item: SourceShopItem,
  options: SourceItemActionOptions): readonly SourceActionWheelAction<SourceItemActionId>[] {
  const usable = isPokemonItemUsableInField(item.internalName);
  const giveable = isHeldItemSupported(item.internalName);
  const discardable = isSourceItemDiscardable(item) && options.quantity > 0;
  const primary: SourceActionWheelAction<SourceItemActionId> = item.machineMove !== null
    && item.machineMove !== undefined
    ? { id: "teach", label: "Apprendre", symbol: "CT", enabled: options.machineCompatibilityAvailable === true,
      hint: options.machineCompatibilityAvailable === true ? "Choisir un Pokémon compatible"
        : "Compatibilité CT/CS indisponible" }
    : { id: "use", label: "Utiliser", symbol: "+", enabled: usable,
      hint: usable ? "Utiliser hors combat" : "Effet terrain pas encore disponible" };
  return [
    primary,
    { id: "give", label: "Donner", symbol: "◇", enabled: giveable,
      hint: giveable ? "Faire tenir à un Pokémon" : "Effet tenu pas encore disponible" },
    { id: "discard", label: "Jeter", symbol: "×", enabled: discardable,
      hint: discardable ? "Choisir une quantité à jeter" : "Objet important impossible à jeter" },
    ...(options.specificActions ?? []),
  ];
}
