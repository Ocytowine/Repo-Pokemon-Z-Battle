import { SOURCE_BAG_SLOT_LIMIT } from "./source-economy.js";
import type { SourceEventState } from "./source-event-state.js";

export interface SourceAlchemyStack {
  readonly itemId: string;
  readonly quantity: number;
}

export interface SourceAlchemyRecipe {
  readonly unlockLevel: number;
  readonly output: SourceAlchemyStack;
  readonly ingredients: readonly SourceAlchemyStack[];
}

export interface SourceAlchemyCatalog {
  readonly unlockVariableId: number;
  readonly recipes: readonly SourceAlchemyRecipe[];
}

export type SourceAlchemyResult =
  | { readonly ok: true; readonly state: SourceEventState; readonly quantity: number }
  | { readonly ok: false; readonly state: SourceEventState;
    readonly reason: "unknown-recipe" | "locked" | "invalid-quantity" | "missing-ingredients" | "bag-full" };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStack(value: unknown): SourceAlchemyStack | null {
  if (!isRecord(value) || typeof value.itemId !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/u.test(value.itemId)
    || !Number.isSafeInteger(value.quantity)
    || (value.quantity as number) < 1) return null;
  return { itemId: value.itemId, quantity: value.quantity as number };
}

export function parseSourceAlchemyCatalog(value: unknown): SourceAlchemyCatalog {
  if (!isRecord(value) || value.schemaVersion !== "1.0.0" || !Number.isSafeInteger(value.unlockVariableId)
    || (value.unlockVariableId as number) < 1 || !Array.isArray(value.recipes)) {
    throw new Error("Le catalogue d'Alchimie est invalide.");
  }
  const recipes = value.recipes.map((entry) => {
    if (!isRecord(entry) || !Number.isSafeInteger(entry.unlockLevel) || (entry.unlockLevel as number) < 0
      || !Array.isArray(entry.ingredients)) throw new Error("Une recette d'Alchimie est invalide.");
    const output = parseStack(entry.output);
    const ingredients = entry.ingredients.map(parseStack);
    if (output === null || ingredients.length === 0 || ingredients.some((ingredient) => ingredient === null)) {
      throw new Error("Une recette d'Alchimie est invalide.");
    }
    return { unlockLevel: entry.unlockLevel as number, output,
      ingredients: ingredients as readonly SourceAlchemyStack[] };
  });
  if (new Set(recipes.map((recipe) => recipe.output.itemId)).size !== recipes.length) {
    throw new Error("Le catalogue d'Alchimie contient des recettes dupliquees.");
  }
  return { unlockVariableId: value.unlockVariableId as number, recipes };
}

export function sourceAlchemyUnlockLevel(catalog: SourceAlchemyCatalog,
  variables: Readonly<Record<string, number>>): number {
  const value = variables[String(catalog.unlockVariableId)] ?? 0;
  return Number.isSafeInteger(value) ? Math.max(0, value) : 0;
}

function recipeDeltas(recipe: SourceAlchemyRecipe): ReadonlyMap<string, number> {
  const deltas = new Map<string, number>();
  for (const ingredient of recipe.ingredients) {
    deltas.set(ingredient.itemId, (deltas.get(ingredient.itemId) ?? 0) - ingredient.quantity);
  }
  deltas.set(recipe.output.itemId, (deltas.get(recipe.output.itemId) ?? 0) + recipe.output.quantity);
  return deltas;
}

export function sourceAlchemyCraftLimit(inventory: Readonly<Record<string, number>>,
  recipe: SourceAlchemyRecipe): number {
  let maximum = Number.MAX_SAFE_INTEGER;
  for (const [itemId, delta] of recipeDeltas(recipe)) {
    const owned = inventory[itemId] ?? 0;
    if (delta < 0) maximum = Math.min(maximum, Math.floor(owned / -delta));
    else if (delta > 0) maximum = Math.min(maximum, Math.floor((SOURCE_BAG_SLOT_LIMIT - owned) / delta));
  }
  return maximum === Number.MAX_SAFE_INTEGER ? 0 : Math.max(0, maximum);
}

export function craftSourceAlchemyRecipe(state: SourceEventState, catalog: SourceAlchemyCatalog,
  outputItemId: string, quantity: number, storyVariables: Readonly<Record<string, number>> = state.variables): SourceAlchemyResult {
  const recipe = catalog.recipes.find((candidate) => candidate.output.itemId === outputItemId);
  if (recipe === undefined) return { ok: false, state, reason: "unknown-recipe" };
  if (recipe.unlockLevel > sourceAlchemyUnlockLevel(catalog, storyVariables)) {
    return { ok: false, state, reason: "locked" };
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1) return { ok: false, state, reason: "invalid-quantity" };
  const maximum = sourceAlchemyCraftLimit(state.inventory, recipe);
  if (quantity > maximum) {
    const missing = recipe.ingredients.some((ingredient) =>
      (state.inventory[ingredient.itemId] ?? 0) < ingredient.quantity * quantity);
    return { ok: false, state, reason: missing ? "missing-ingredients" : "bag-full" };
  }
  const inventory = { ...state.inventory };
  for (const [itemId, delta] of recipeDeltas(recipe)) {
    const next = (inventory[itemId] ?? 0) + delta * quantity;
    if (next === 0) delete inventory[itemId]; else inventory[itemId] = next;
  }
  return { ok: true, state: { ...state, inventory }, quantity };
}
