import { describe, expect, it } from "vitest";
import type { PersistentPokemon, PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import { createEmptyPlayerParty, createEmptyPlayerPokemonStorage, createPersistentPokemonMetadata } from "@pokemon-z-battle/player-state";
import { createSourcePokemonCollection, filterSourcePokemonCollection, sourcePokemonIconUrl,
  sourcePokemonPowerTier }
  from "../src/source-pokemon-collection.js";

const pokemon = (id: string, species: string, level: number, stat: number,
  training?: { readonly iv: number; readonly ev: number }): PersistentPokemon => ({
  id, species, nickname: null, level, experience: 0,
  stats: { maxHp: stat, attack: stat, defense: stat, specialAttack: stat, specialDefense: stat, speed: stat },
  hp: stat, majorStatus: null, ability: null, heldItem: null,
  moves: [{ internalName: "TACKLE", pp: 35, maxPp: 35 }],
  metadata: training === undefined ? createPersistentPokemonMetadata(id, species, level) : {
    ...createPersistentPokemonMetadata(id, species, level),
    ivs: { hp: training.iv, attack: training.iv, defense: training.iv, specialAttack: training.iv,
      specialDefense: training.iv, speed: training.iv },
    evs: { hp: training.ev, attack: training.ev, defense: training.ev, specialAttack: training.ev,
      specialDefense: training.ev, speed: training.ev },
  },
});
const catalog = { pokemon: [
  { id: 1, internalName: "BULBASAUR", name: "Bulbizarre", types: ["GRASS", "POISON"],
    baseStats: { hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 }, genderRate: "FemaleOneEighth", happiness: 70 },
  { id: 4, internalName: "CHARMANDER", name: "Salamèche", types: ["FIRE"],
    baseStats: { hp: 39, attack: 52, defense: 43, specialAttack: 60, specialDefense: 50, speed: 65 }, genderRate: "FemaleOneEighth", happiness: 70 },
  { id: 6, internalName: "CHARIZARD", name: "Dracaufeu", types: ["FIRE", "FLYING"],
    baseStats: { hp: 78, attack: 84, defense: 78, specialAttack: 109, specialDefense: 85, speed: 100 }, genderRate: "FemaleOneEighth", happiness: 70 },
], moves: [{ id: 1, internalName: "TACKLE", name: "Charge", functionCode: "000", power: 40, type: "NORMAL",
  category: "Physical", accuracy: 100, pp: 35, priority: 0, effectChance: 0 }] } as PlayerCreationCatalog;

describe("shared Pokemon collection presentation", () => {
  it("combines team and ranch with reusable power scores and classic icon paths", () => {
    const party = { ...createEmptyPlayerParty(), activeIndex: 0, members: [pokemon("a", "BULBASAUR", 5, 10)] };
    const ranch = { ...createEmptyPlayerPokemonStorage(), members: [pokemon("b", "CHARIZARD", 36, 80)] };
    expect(createSourcePokemonCollection(party, ranch, catalog)).toMatchObject([
      { location: "team", number: 1, currentPower: 60, potentialPower: 318,
        moves: [{ internalName: "TACKLE", name: "Charge", type: "NORMAL", pp: 35, maxPp: 35 }] },
      { location: "ranch", number: 6, currentPower: 480, potentialPower: 534,
        moves: [{ internalName: "TACKLE", name: "Charge", type: "NORMAL", pp: 35, maxPp: 35 }] },
    ]);
    expect(sourcePokemonIconUrl(6)).toBe("/__pokemon-z/source/Graphics/Icons/icon006.png");
  });

  it("combines name, dual-type and six-tier potential filters before sorting", () => {
    const ranch = { ...createEmptyPlayerPokemonStorage(), members: [
      pokemon("a", "BULBASAUR", 5, 10), pokemon("b", "CHARMANDER", 12, 30), pokemon("c", "CHARIZARD", 36, 80),
    ] };
    const collection = createSourcePokemonCollection(createEmptyPlayerParty(), ranch, catalog);
    const filters = { query: "drac", firstType: "FIRE", secondType: "FLYING", potentialTier: "very-powerful" as const,
      minimumIvStars: "all" as const, minimumEvStars: "all" as const, sort: "potential-power" as const };
    expect(filterSourcePokemonCollection(collection, filters).map((entry) => entry.pokemon.species)).toEqual(["CHARIZARD"]);
  });

  it("sorts potential strength and level independently", () => {
    const ranch = { ...createEmptyPlayerPokemonStorage(), members: [
      pokemon("a", "BULBASAUR", 50, 100), pokemon("b", "CHARIZARD", 5, 20),
    ] };
    const collection = createSourcePokemonCollection(createEmptyPlayerParty(), ranch, catalog);
    const base = { query: "", firstType: null, secondType: null, potentialTier: "all" as const,
      minimumIvStars: "all" as const, minimumEvStars: "all" as const };
    expect(filterSourcePokemonCollection(collection, { ...base, sort: "level" })[0]?.pokemon.species).toBe("BULBASAUR");
    expect(filterSourcePokemonCollection(collection, { ...base, sort: "potential-power" })[0]?.pokemon.species).toBe("CHARIZARD");
  });

  it("uses the six potential bands and independent average IV/EV star filters", () => {
    expect([299, 300, 400, 450, 500, 600].map((score) => sourcePokemonPowerTier(score).id)).toEqual([
      "very-low", "low", "moderate", "good", "very-powerful", "super-powerful",
    ]);
    const ranch = { ...createEmptyPlayerPokemonStorage(), members: [
      pokemon("a", "BULBASAUR", 5, 10, { iv: 31, ev: 0 }),
      pokemon("b", "CHARIZARD", 36, 80, { iv: 10, ev: 70 }),
    ] };
    const collection = createSourcePokemonCollection(createEmptyPlayerParty(), ranch, catalog);
    const base = { query: "", firstType: null, secondType: null, potentialTier: "all" as const,
      sort: "number" as const };
    expect(filterSourcePokemonCollection(collection,
      { ...base, minimumIvStars: "four", minimumEvStars: "all" }).map((entry) => entry.pokemon.species))
      .toEqual(["BULBASAUR"]);
    expect(filterSourcePokemonCollection(collection,
      { ...base, minimumIvStars: "all", minimumEvStars: "four" }).map((entry) => entry.pokemon.species))
      .toEqual(["CHARIZARD"]);
  });
});
