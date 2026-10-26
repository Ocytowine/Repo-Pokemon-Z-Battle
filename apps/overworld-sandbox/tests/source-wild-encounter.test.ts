import { describe, expect, it } from "vitest";
import type { RandomSource } from "@pokemon-z-battle/battle-engine";
import { isGrassTerrain, planFishingAttempt, resolveSourceFishingRod, rollEncounterForMethod,
  rollLandEncounter, rollStepEncounter,
  sourceFishingEncounterMethod,
  terrainTagAt } from "../src/source-wild-encounter.js";

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
const encounters = { mapId: 7, rates: { land: 12, cave: 2, water: 2 }, landRate: 12, land: [
  { species: "BIDOOF", minimumLevel: 3, maximumLevel: 5, weight: 20 },
  { species: "FLETCHLING", minimumLevel: 3, maximumLevel: 5, weight: 80 },
], methods: [{ method: "Land", slots: [
  { species: "BIDOOF", minimumLevel: 3, maximumLevel: 5, weight: 20 },
  { species: "FLETCHLING", minimumLevel: 3, maximumLevel: 5, weight: 80 },
] }] } as const;

describe("source wild encounters", () => {
  it("applies the two source flutes after rolling a wild level", () => {
    expect(rollEncounterForMethod(encounters, "Land", new ScriptedRandom([0, 1, 2]), undefined, "high"))
      .toEqual({ species: "BIDOOF", level: 7 });
    expect(rollEncounterForMethod(encounters, "Land", new ScriptedRandom([0, 1, 2]), undefined, "low"))
      .toEqual({ species: "BIDOOF", level: 1 });
  });
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

  it("uses Cave across the whole map but excludes ice like the source", () => {
    const cave = { ...encounters, methods: [{ method: "Cave", slots: [
      { species: "ZUBAT", minimumLevel: 6, maximumLevel: 6, weight: 100 },
    ] }] } as const;
    expect(rollStepEncounter(cave, 0, 3, new ScriptedRandom([0, 0, 0])))
      .toEqual({ steps: 0, encounter: { species: "ZUBAT", level: 6 } });
    expect(rollStepEncounter(cave, 12, 3, new ScriptedRandom([])))
      .toEqual({ steps: 3, encounter: null });
  });

  it("applies the source 50% type-amulet filter and falls back when no species matches", () => {
    const types = (species: string): readonly string[] => species === "FLETCHLING"
      ? ["NORMAL", "FLYING"] : ["NORMAL"];
    expect(rollStepEncounter(encounters, 2, 3, new ScriptedRandom([0, 0, 0, 1]),
      { type: "FLYING", speciesTypes: types })).toEqual({
      steps: 0, encounter: { species: "FLETCHLING", level: 4 },
    });
    expect(rollStepEncounter(encounters, 2, 3, new ScriptedRandom([0, 0, 0, 0]),
      { type: "WATER", speciesTypes: types })).toEqual({
      steps: 0, encounter: { species: "BIDOOF", level: 3 },
    });
  });

  it("plans rod timing, bite odds and the weighted encounter from the saved RNG", () => {
    const fishing = { ...encounters, methods: [{ method: "OldRod", slots: [
      { species: "MAGIKARP", minimumLevel: 4, maximumLevel: 6, weight: 100 },
    ] }] } as const;
    expect(planFishingAttempt(fishing, "OldRod", null, new ScriptedRandom([0, 0, 20, 0, 2])))
      .toEqual({ waitMs: 1_000, bite: true, hookWindowMs: 1_000,
        encounter: { species: "MAGIKARP", level: 6 } });
  });

  it("keeps an owned favorite and otherwise selects the strongest rod backed by the current map", () => {
    const fishing = { ...encounters, methods: [{ method: "OldRod", slots: [
      { species: "MAGIKARP", minimumLevel: 4, maximumLevel: 6, weight: 100 },
    ] }] } as const;
    const inventory = { OLDROD: 1, GOODROD: 1, SUPERROD: 1 };
    expect(resolveSourceFishingRod("GOODROD", inventory, fishing)).toBe("GOODROD");
    expect(resolveSourceFishingRod("OLDROD", inventory, fishing)).toBe("OLDROD");
    expect(resolveSourceFishingRod(undefined, inventory, fishing)).toBe("SUPERROD");
    expect(resolveSourceFishingRod("GOODROD", { OLDROD: 1 }, fishing)).toBe("OLDROD");
    expect(resolveSourceFishingRod(undefined, {}, fishing)).toBeNull();
    expect(sourceFishingEncounterMethod(fishing, "GOODROD")).toBe("OldRod");
    expect(planFishingAttempt(fishing, "GoodRod", null,
      new ScriptedRandom([0, 0, 20, 0, 2]), "OldRod")).toMatchObject({ bite: true,
      encounter: { species: "MAGIKARP", level: 6 } });
  });
});
