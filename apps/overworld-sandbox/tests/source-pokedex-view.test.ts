import { describe, expect, it } from "vitest";
import { filterSourcePokedexEntries, sourcePokedexEvolutionCondition,
  type SourcePokedexEntry, type SourcePokedexFilters }
  from "../src/source-pokedex-view.js";

const entry = (values: Pick<SourcePokedexEntry, "species" | "number" | "name" | "types" | "seen" | "caught"
  | "teamCount" | "ranchCount" | "evolved" | "released"> & Partial<SourcePokedexEntry>): SourcePokedexEntry => ({
  kind: "Pokémon test", pokedexEntry: "Une entrée Pokédex française.", height: 10, weight: 100,
  baseStats: { hp: 50, attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 50 },
  potentialPower: 300, abilities: [], evolutions: [], iconUrl: `${values.species}.png`, battlerUrl: null,
  battlerFrameWidth: null, battlerFrameHeight: null, battlerFrameCount: 1, footprintUrl: null, ...values,
});

const entries: readonly SourcePokedexEntry[] = [
  entry({ species: "FENNEKIN", number: 653, name: "Feunnec", types: ["FIRE"],
    seen: true, caught: true, teamCount: 1, ranchCount: 0, evolved: false, released: false }),
  entry({ species: "BRAIXEN", number: 654, name: "Roussil", types: ["FIRE"], potentialPower: 409,
    seen: true, caught: true, teamCount: 0, ranchCount: 0, evolved: true, released: true }),
  entry({ species: "FROAKIE", number: 656, name: "Grenousse", types: ["WATER"],
    seen: true, caught: false, teamCount: 0, ranchCount: 0, evolved: false, released: false }),
  entry({ species: "BULBASAUR", number: 1, name: "Bulbizarre", types: ["GRASS", "POISON"],
    seen: false, caught: false, teamCount: 0, ranchCount: 0, evolved: false, released: false }),
];

function filters(overrides: Partial<SourcePokedexFilters> = {}): SourcePokedexFilters {
  return { query: "", firstType: null, secondType: null, status: "all", potentialTier: "all", sort: "number", ...overrides };
}

describe("source Pokedex filters", () => {
  it("combines text, dual-type and historical status filters", () => {
    expect(filterSourcePokedexEntries(entries, filters({ firstType: "FIRE", status: "released" }))
      .map((entry) => entry.species)).toEqual(["BRAIXEN"]);
    expect(filterSourcePokedexEntries(entries, filters({ firstType: "GRASS", secondType: "POISON" }))
      .map((entry) => entry.species)).toEqual(["BULBASAUR"]);
    expect(filterSourcePokedexEntries(entries, filters({ query: "653" }))
      .map((entry) => entry.species)).toEqual(["FENNEKIN"]);
  });

  it("distinguishes observed, obtained and currently owned species", () => {
    expect(filterSourcePokedexEntries(entries, filters({ status: "seen" })).map((entry) => entry.species))
      .toEqual(["FROAKIE"]);
    expect(filterSourcePokedexEntries(entries, filters({ status: "current" })).map((entry) => entry.species))
      .toEqual(["FENNEKIN"]);
    expect(filterSourcePokedexEntries(entries, filters({ status: "unseen" })).map((entry) => entry.species))
      .toEqual(["BULBASAUR"]);
  });

  it("filters by the same potential tiers as the ranch", () => {
    expect(filterSourcePokedexEntries(entries, filters({ potentialTier: "moderate" }))
      .map((candidate) => candidate.species)).toEqual(["BRAIXEN"]);
  });
});

describe("source Pokedex evolution conditions", () => {
  const pokemonNames = new Map([["REMORAID", "Rémoraid"]]);
  const itemNames = new Map([["THUNDERSTONE", "Pierre Foudre"], ["KINGSROCK", "Roche Royale"]]);
  const moveNames = new Map([["ROLLOUT", "Roulade"]]);

  it("translates level, item and happiness methods", () => {
    expect(sourcePokedexEvolutionCondition("Level", "18", pokemonNames, itemNames, moveNames)).toBe("Niveau 18");
    expect(sourcePokedexEvolutionCondition("Item", "THUNDERSTONE", pokemonNames, itemNames, moveNames))
      .toBe("Utiliser Pierre Foudre");
    expect(sourcePokedexEvolutionCondition("HappinessNight", null, pokemonNames, itemNames, moveNames))
      .toBe("Bonheur élevé · de nuit");
  });

  it("translates party, move and held-item requirements", () => {
    expect(sourcePokedexEvolutionCondition("HasMove", "ROLLOUT", pokemonNames, itemNames, moveNames))
      .toBe("Gagner un niveau en connaissant Roulade");
    expect(sourcePokedexEvolutionCondition("HasInParty", "REMORAID", pokemonNames, itemNames, moveNames))
      .toBe("Gagner un niveau avec Rémoraid dans l’équipe");
    expect(sourcePokedexEvolutionCondition("DayHoldItem", "KINGSROCK", pokemonNames, itemNames, moveNames))
      .toBe("Gagner un niveau de jour en tenant Roche Royale");
  });
});
