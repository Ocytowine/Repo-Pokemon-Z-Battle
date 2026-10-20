import { describe, expect, it } from "vitest";
import { parseSourceMegaEvolutionCatalog, sourceMegaActivationAvailable,
  sourceMegaEvolutionForPokemon } from "../src/source-mega-evolution.js";

const sourceCatalog = {
  schemaVersion: "1.1.0",
  activationItems: ["BRAZALESPIRITUAL"],
  disableSwitchId: 34,
  records: [{ species: "VENUSAUR", heldItem: "VENUSAURITE", form: 1,
    baseStats: { hp: 80, attack: 100, defense: 123, speed: 80, specialAttack: 122, specialDefense: 120 },
    types: ["GRASS", "POISON"], ability: "THICKFAT" }],
};

describe("source Mega Evolution catalog", () => {
  it("parses source records and resolves a species/stone pair", () => {
    const catalog = parseSourceMegaEvolutionCatalog(sourceCatalog);
    expect(sourceMegaEvolutionForPokemon(catalog, "VENUSAUR", "VENUSAURITE"))
      .toMatchObject({ species: "VENUSAUR", heldItem: "VENUSAURITE", form: 1,
        ability: "THICKFAT", types: ["GRASS", "POISON"] });
    expect(sourceMegaEvolutionForPokemon(catalog, "VENUSAUR", "CHARIZARDITEX")).toBeUndefined();
  });

  it("requires an activation item and honors the source disable switch", () => {
    const catalog = parseSourceMegaEvolutionCatalog(sourceCatalog);
    expect(sourceMegaActivationAvailable(catalog, { BRAZALESPIRITUAL: 1 }, {})).toBe(true);
    expect(sourceMegaActivationAvailable(catalog, {}, {})).toBe(false);
    expect(sourceMegaActivationAvailable(catalog, { BRAZALESPIRITUAL: 1 }, { "34": true })).toBe(false);
  });

  it("stays unavailable while the source catalog is loading", () => {
    expect(sourceMegaActivationAvailable(null, { BRAZALESPIRITUAL: 1 }, {})).toBe(false);
    expect(sourceMegaActivationAvailable(undefined, { BRAZALESPIRITUAL: 1 }, {})).toBe(false);
  });

  it("rejects malformed source records", () => {
    expect(() => parseSourceMegaEvolutionCatalog({ ...sourceCatalog,
      records: [{ species: "VENUSAUR", heldItem: "VENUSAURITE", form: 0 }] }))
      .toThrow("Définition de Méga-Évolution invalide");
  });
});
