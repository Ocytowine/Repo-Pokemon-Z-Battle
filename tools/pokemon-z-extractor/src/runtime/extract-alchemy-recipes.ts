import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ScriptManifestEntry } from "./extract-scripts.js";

export interface ExtractedAlchemyIngredient {
  readonly itemId: string;
  readonly quantity: number;
}

export interface ExtractedAlchemyRecipe {
  readonly unlockLevel: number;
  readonly output: ExtractedAlchemyIngredient;
  readonly ingredients: readonly ExtractedAlchemyIngredient[];
}

export interface ExtractedAlchemyCatalog {
  readonly schemaVersion: "1.0.0";
  readonly unlockVariableId: number;
  readonly recipes: readonly ExtractedAlchemyRecipe[];
}

export function parseAlchemyRecipes(source: string): ExtractedAlchemyCatalog {
  const variable = /^\s*RECETAS_CRAFTEO\s*=\s*(\d+)\s*$/mu.exec(source);
  if (variable === null) throw new Error("Variable de recettes d'Alchimie introuvable.");
  const unlockVariableId = Number(variable[1]);
  if (!Number.isSafeInteger(unlockVariableId) || unlockVariableId < 1) {
    throw new Error("Variable de recettes d'Alchimie invalide.");
  }
  const recipes: ExtractedAlchemyRecipe[] = [];
  const pattern = /if\s+\$game_variables\[RECETAS_CRAFTEO\]\s*>=\s*(\d+)\s+stock\.push\(\[\s*:([A-Za-z][A-Za-z0-9_]*)\s*,\s*\[([\s\S]*?)\]\s*\]\)\s+end/gu;
  for (const match of source.matchAll(pattern)) {
    const unlockLevel = Number(match[1]);
    const outputId = match[2];
    const body = match[3];
    if (!Number.isSafeInteger(unlockLevel) || unlockLevel < 0 || outputId === undefined || body === undefined) {
      throw new Error("Recette d'Alchimie invalide.");
    }
    const ingredients = [...body.matchAll(/:([A-Za-z][A-Za-z0-9_]*)\s*,\s*(\d+)/gu)].map((ingredient) => ({
      itemId: ingredient[1]!, quantity: Number(ingredient[2]),
    }));
    const remainder = body.replaceAll(/:([A-Za-z][A-Za-z0-9_]*)\s*,\s*(\d+)/gu, "").replaceAll(/[\s,]/gu, "");
    if (ingredients.length === 0 || remainder !== "" || ingredients.some(({ quantity }) =>
      !Number.isSafeInteger(quantity) || quantity < 1)) {
      throw new Error(`Ingredients invalides pour la recette ${outputId}.`);
    }
    recipes.push({ unlockLevel, output: { itemId: outputId, quantity: 1 }, ingredients });
  }
  if (recipes.length === 0) throw new Error("Aucune recette d'Alchimie extraite.");
  const outputs = new Set<string>();
  for (const recipe of recipes) {
    if (outputs.has(recipe.output.itemId)) throw new Error(`Recette dupliquee : ${recipe.output.itemId}.`);
    outputs.add(recipe.output.itemId);
  }
  return { schemaVersion: "1.0.0", unlockVariableId, recipes: recipes.sort((left, right) =>
    left.unlockLevel - right.unlockLevel) };
}

export async function extractAlchemyRecipes(outputDirectory: string,
  scripts: readonly ScriptManifestEntry[]): Promise<ExtractedAlchemyCatalog> {
  for (const script of scripts) {
    const source = await readFile(path.join(outputDirectory, ...script.file.split("/")), "utf8");
    if (source.includes("RECETAS_CRAFTEO") && source.includes("stock.push")) return parseAlchemyRecipes(source);
  }
  throw new Error("Script d'Alchimie Pokemon introuvable.");
}
