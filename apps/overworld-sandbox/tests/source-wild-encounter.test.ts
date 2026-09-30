import { describe, expect, it } from "vitest";
import type { RandomSource } from "@pokemon-z-battle/battle-engine";
import { isGrassTerrain, rollLandEncounter, terrainTagAt } from "../src/source-wild-encounter.js";

class ScriptedRandom implements RandomSource {
  #index = 0;
  constructor(private readonly values: readonly number[]) {}
  nextInt(maxExclusive: number): number {
    const value = this.values[this.#index++];
    if (value === undefined || value < 0 || value >= maxExclusive) throw new Error(`Tirage invalide pour ${maxExclusive}.`);
    return value;
  }
}

const map = { schemaVersion: "1.0.0", id: 7, name: "Route 1", width: 1, height: 1, tilesetId: 1,
  layers: { lower: [3], middle: [2], upper: [1] }, collision: { masks: [15] }, transfers: [],
  source: { file: "Map007.rxdata", sha256: "test" } } as const;
const tileset = { id: 1, tilesetName: "Field", autotileNames: [], priorities: [], terrainTags: [0, 15, 13, 2] } as const;
const encounters = { mapId: 7, landRate: 12, land: [
  { species: "BIDOOF", minimumLevel: 3, maximumLevel: 5, weight: 20 },
  { species: "FLETCHLING", minimumLevel: 3, maximumLevel: 5, weight: 80 },
] } as const;

describe("source wild encounters", () => {
  it("resolves the effective terrain from upper to lower layers while ignoring bridges and neutral tags", () => {
    expect(terrainTagAt(map, tileset, 0, 0)).toBe(2);
    expect(isGrassTerrain(2)).toBe(true);
    expect(isGrassTerrain(7)).toBe(false);
  });

  it("waits three eligible steps then uses source density, weights and level range", () => {
    expect(rollLandEncounter(encounters, 2, 0, new ScriptedRandom([]))).toEqual({ steps: 1, encounter: null });
    expect(rollLandEncounter(encounters, 2, 2, new ScriptedRandom([]))).toEqual({ steps: 3, encounter: null });
    expect(rollLandEncounter(encounters, 2, 3, new ScriptedRandom([192]))).toEqual({ steps: 4, encounter: null });
    expect(rollLandEncounter(encounters, 2, 3, new ScriptedRandom([0, 20, 2]))).toEqual({
      steps: 0, encounter: { species: "FLETCHLING", level: 5 },
    });
  });
});
