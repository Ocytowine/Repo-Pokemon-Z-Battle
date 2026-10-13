import { describe, expect, it } from "vitest";
import { parseAlchemyRecipes } from "../src/runtime/extract-alchemy-recipes.js";

describe("alchemy recipe extraction", () => {
  it("extracts the unlock variable, mixed-case items and ingredient quantities without executing Ruby", () => {
    const catalog = parseAlchemyRecipes(`
      RECETAS_CRAFTEO = 926
      if $game_variables[RECETAS_CRAFTEO]>=3
        stock.push([:POLVOEXPLOSIVO,[
          :BRASACANDENTE,1,
          :POLVOBRILLANTE,1
        ]])
      end
      if $game_variables[RECETAS_CRAFTEO] >= 40
        stock.push([:ACapsula,[:GRAVASECA,1,:FIBRAELASTICA,2]])
      end
    `);

    expect(catalog).toEqual({ schemaVersion: "1.0.0", unlockVariableId: 926, recipes: [
      { unlockLevel: 3, output: { itemId: "POLVOEXPLOSIVO", quantity: 1 }, ingredients: [
        { itemId: "BRASACANDENTE", quantity: 1 }, { itemId: "POLVOBRILLANTE", quantity: 1 },
      ] },
      { unlockLevel: 40, output: { itemId: "ACapsula", quantity: 1 }, ingredients: [
        { itemId: "GRAVASECA", quantity: 1 }, { itemId: "FIBRAELASTICA", quantity: 2 },
      ] },
    ] });
  });

  it("rejects malformed or empty recipe definitions", () => {
    expect(() => parseAlchemyRecipes("RECETAS_CRAFTEO = 926"))
      .toThrow("Aucune recette");
    expect(() => parseAlchemyRecipes("RECETAS_CRAFTEO = nope"))
      .toThrow("Variable de recettes");
  });
});
