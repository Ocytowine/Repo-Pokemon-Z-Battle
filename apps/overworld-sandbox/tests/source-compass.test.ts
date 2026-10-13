import { describe, expect, it } from "vitest";
import type { PlayerDetailsCatalog } from "@pokemon-z-battle/player-state";
import { sourceCompassEntries } from "../src/source-compass.js";

const pokemon = (id: number, internalName: string, name: string) => ({ id, internalName, name, types: ["NORMAL"],
  baseStats: { hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1 }, abilities: [],
  hiddenAbilities: [], levelUpMoves: [], growthRate: "Medium", baseExperience: 1, genderRate: 127,
  happiness: 70, kind: "Test", pokedexEntry: "Test", effortPoints: {}, formNames: [], stepsToHatch: 1,
  height: 1, weight: 1 });
const catalog: PlayerDetailsCatalog = { pokemon: [pokemon(3, "THREE", "Trois"), pokemon(1, "ONE", "Un")],
  moves: [], abilities: [] } as unknown as PlayerDetailsCatalog;
const assets = { schemaVersion: "1", records: [] };
const encounter = { mapId: 7, landRate: 12, land: [], methods: [
  { method: "Land", slots: [
    { species: "THREE", minimumLevel: 2, maximumLevel: 3, weight: 20 },
    { species: "ONE", minimumLevel: 2, maximumLevel: 3, weight: 20 },
  ] },
  { method: "OldRod", slots: [
    { species: "THREE", minimumLevel: 2, maximumLevel: 3, weight: 70 },
  ] },
] } as const;

describe("source compass", () => {
  it("merges every encounter method, deduplicates species and sorts by Pokédex number", () => {
    expect(sourceCompassEntries(encounter, catalog, assets, ["THREE"])).toMatchObject([
      { species: "ONE", number: 1, caught: false, methods: ["Land"] },
      { species: "THREE", number: 3, caught: true, methods: ["Land", "OldRod"] },
    ]);
  });

  it("returns an empty list on a map without encounters", () => {
    expect(sourceCompassEntries(null, catalog, assets, [])).toEqual([]);
  });
});
