import { describe, expect, it } from "vitest";
import { craftSourceAlchemyRecipe, parseSourceAlchemyCatalog, sourceAlchemyCraftLimit }
  from "../src/source-alchemy.js";
import { createSourceEventState } from "../src/source-event-state.js";

const catalog = parseSourceAlchemyCatalog({ schemaVersion: "1.0.0", unlockVariableId: 926, recipes: [
  { unlockLevel: 3, output: { itemId: "POLVOEXPLOSIVO", quantity: 1 }, ingredients: [
    { itemId: "BRASACANDENTE", quantity: 1 }, { itemId: "POLVOBRILLANTE", quantity: 1 },
  ] },
  { unlockLevel: 10, output: { itemId: "HACHAENDEBLE", quantity: 1 }, ingredients: [
    { itemId: "MADERA", quantity: 1 }, { itemId: "VIRUTASFERREAS", quantity: 1 },
  ] },
] });

describe("source alchemy", () => {
  it("applies one atomic personal inventory transaction", () => {
    const state = { ...createSourceEventState(), variables: { "926": 3 },
      inventory: { BRASACANDENTE: 2, POLVOBRILLANTE: 1 } };
    const result = craftSourceAlchemyRecipe(state, catalog, "POLVOEXPLOSIVO", 1);
    expect(result).toMatchObject({ ok: true, quantity: 1, state: {
      variables: { "926": 3 }, inventory: { BRASACANDENTE: 1, POLVOEXPLOSIVO: 1 },
    } });
    expect(state.inventory).toEqual({ BRASACANDENTE: 2, POLVOBRILLANTE: 1 });
  });

  it("uses shared story variables without copying them into personal state", () => {
    const personal = { ...createSourceEventState(), variables: { "926": 0 },
      inventory: { BRASACANDENTE: 1, POLVOBRILLANTE: 1 } };
    const result = craftSourceAlchemyRecipe(personal, catalog, "POLVOEXPLOSIVO", 1, { "926": 3 });
    expect(result).toMatchObject({ ok: true, state: { variables: { "926": 0 },
      inventory: { POLVOEXPLOSIVO: 1 } } });
  });

  it("crafts Pokemon Z's weak axe at the source menu unlock level", () => {
    const state = { ...createSourceEventState(), variables: { "926": 10 },
      inventory: { MADERA: 1, VIRUTASFERREAS: 1 } };
    expect(craftSourceAlchemyRecipe(state, catalog, "HACHAENDEBLE", 1)).toMatchObject({
      ok: true, state: { inventory: { HACHAENDEBLE: 1 } },
    });
    const locked = { ...state, variables: { "926": 9 } };
    expect(craftSourceAlchemyRecipe(locked, catalog, "HACHAENDEBLE", 1)).toEqual({
      ok: false, state: locked, reason: "locked",
    });
  });

  it("rejects locked recipes, missing ingredients and output overflow without partial mutation", () => {
    const ingredients = { BRASACANDENTE: 1, POLVOBRILLANTE: 1 };
    const locked = { ...createSourceEventState(), variables: { "926": 2 }, inventory: ingredients };
    expect(craftSourceAlchemyRecipe(locked, catalog, "POLVOEXPLOSIVO", 1)).toEqual({
      ok: false, state: locked, reason: "locked",
    });
    const missing = { ...locked, variables: { "926": 3 }, inventory: { BRASACANDENTE: 1 } };
    expect(craftSourceAlchemyRecipe(missing, catalog, "POLVOEXPLOSIVO", 1)).toEqual({
      ok: false, state: missing, reason: "missing-ingredients",
    });
    const full = { ...missing, inventory: { ...ingredients, POLVOEXPLOSIVO: 999 } };
    expect(craftSourceAlchemyRecipe(full, catalog, "POLVOEXPLOSIVO", 1)).toEqual({
      ok: false, state: full, reason: "bag-full",
    });
  });

  it("calculates the maximum craft count from every ingredient and the result slot", () => {
    const recipe = catalog.recipes[0]!;
    expect(sourceAlchemyCraftLimit({ BRASACANDENTE: 5, POLVOBRILLANTE: 3 }, recipe)).toBe(3);
    expect(sourceAlchemyCraftLimit({ BRASACANDENTE: 5, POLVOBRILLANTE: 3, POLVOEXPLOSIVO: 998 }, recipe)).toBe(1);
  });
});
