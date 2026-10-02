import { describe, expect, it } from "vitest";
import type { PersistentPokemon, PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import { createEmptyPlayerParty, createEmptyPlayerPokemonStorage } from "@pokemon-z-battle/player-state";
import { createSourcePokemonCollection, filterSourcePokemonCollection, sourcePokemonIconUrl }
  from "../src/source-pokemon-collection.js";

const pokemon = (id: string, species: string, level: number, stat: number): PersistentPokemon => ({
  id, species, nickname: null, level, experience: 0,
  stats: { maxHp: stat, attack: stat, defense: stat, specialAttack: stat, specialDefense: stat, speed: stat },
  hp: stat, majorStatus: null, ability: null, heldItem: null,
  moves: [{ internalName: "TACKLE", pp: 35, maxPp: 35 }],
});
const catalog = { pokemon: [
  { id: 1, internalName: "BULBASAUR", name: "Bulbizarre", types: ["GRASS", "POISON"],
    baseStats: { hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 } },
  { id: 4, internalName: "CHARMANDER", name: "Salamèche", types: ["FIRE"],
    baseStats: { hp: 39, attack: 52, defense: 43, specialAttack: 60, specialDefense: 50, speed: 65 } },
  { id: 6, internalName: "CHARIZARD", name: "Dracaufeu", types: ["FIRE", "FLYING"],
    baseStats: { hp: 78, attack: 84, defense: 78, specialAttack: 109, specialDefense: 85, speed: 100 } },
], moves: [] } as PlayerCreationCatalog;

describe("shared Pokemon collection presentation", () => {
  it("combines team and ranch with reusable power scores and classic icon paths", () => {
    const party = { ...createEmptyPlayerParty(), activeIndex: 0, members: [pokemon("a", "BULBASAUR", 5, 10)] };
    const ranch = { ...createEmptyPlayerPokemonStorage(), members: [pokemon("b", "CHARIZARD", 36, 80)] };
    expect(createSourcePokemonCollection(party, ranch, catalog)).toMatchObject([
      { location: "team", number: 1, currentPower: 60, potentialPower: 318 },
      { location: "ranch", number: 6, currentPower: 480, potentialPower: 534 },
    ]);
    expect(sourcePokemonIconUrl(6)).toBe("/__pokemon-z/source/Graphics/Icons/icon006.png");
  });

  it("combines name, dual-type, number and power filters before sorting", () => {
    const ranch = { ...createEmptyPlayerPokemonStorage(), members: [
      pokemon("a", "BULBASAUR", 5, 10), pokemon("b", "CHARMANDER", 12, 30), pokemon("c", "CHARIZARD", 36, 80),
    ] };
    const collection = createSourcePokemonCollection(createEmptyPlayerParty(), ranch, catalog);
    const filters = { query: "drac", firstType: "FIRE", secondType: "FLYING", minimumNumber: 4,
      maximumNumber: 10, minimumCurrentPower: 400, minimumPotentialPower: 500, sort: "potential-power" as const };
    expect(filterSourcePokemonCollection(collection, filters).map((entry) => entry.pokemon.species)).toEqual(["CHARIZARD"]);
  });

  it("sorts current and potential strength independently", () => {
    const ranch = { ...createEmptyPlayerPokemonStorage(), members: [
      pokemon("a", "BULBASAUR", 50, 100), pokemon("b", "CHARIZARD", 5, 20),
    ] };
    const collection = createSourcePokemonCollection(createEmptyPlayerParty(), ranch, catalog);
    const base = { query: "", firstType: null, secondType: null, minimumNumber: null, maximumNumber: null,
      minimumCurrentPower: null, minimumPotentialPower: null };
    expect(filterSourcePokemonCollection(collection, { ...base, sort: "current-power" })[0]?.pokemon.species).toBe("BULBASAUR");
    expect(filterSourcePokemonCollection(collection, { ...base, sort: "potential-power" })[0]?.pokemon.species).toBe("CHARIZARD");
  });
});
