import { describe, expect, it } from "vitest";
import { SOURCE_FIELD_TERRAIN, applySourceWalkingHappiness, sourceFieldMovementFinishFeedback, sourceFieldMovementStartFeedback,
  sourceFieldMarkActive, sourceFieldMarksForStep, sourceFieldTerrainAt, sourceFieldTerrainReflects,
  sourceFieldTileIsBush, sourceFieldVisualState }
  from "./source-field-effects.js";

const map = {
  width: 2, height: 2,
  layers: { lower: [1, 2, 3, 4], middle: [0, 0, 0, 0], upper: [0, 5, 0, 0] },
};
const tileset = {
  terrainTags: [0, SOURCE_FIELD_TERRAIN.grass, SOURCE_FIELD_TERRAIN.stillWater, 0, 0, SOURCE_FIELD_TERRAIN.puddle],
  passages: [0, 0x40, 0, 0, 0, 0],
};

describe("source field effects", () => {
  it("resolves the highest non-zero terrain tag and bush flag", () => {
    expect(sourceFieldTerrainAt(map, tileset, 1, 0)).toBe(SOURCE_FIELD_TERRAIN.puddle);
    expect(sourceFieldTileIsBush(map, tileset, 0, 0)).toBe(true);
  });

  it("matches the source reflection terrain family", () => {
    expect(sourceFieldTerrainReflects(SOURCE_FIELD_TERRAIN.stillWater)).toBe(true);
    expect(sourceFieldTerrainReflects(SOURCE_FIELD_TERRAIN.puddle)).toBe(true);
    expect(sourceFieldTerrainReflects(SOURCE_FIELD_TERRAIN.lakeReflection)).toBe(true);
    expect(sourceFieldTerrainReflects(SOURCE_FIELD_TERRAIN.water)).toBe(false);
  });

  it("hides the lower sprite and shadow in bushes", () => {
    expect(sourceFieldVisualState(map, tileset, 0, 0)).toEqual({ bushDepth: 12, reflection: false, shadow: false });
    expect(sourceFieldVisualState(map, tileset, 0, 0, "walk", true)).toEqual({
      bushDepth: 0, reflection: false, shadow: true,
    });
  });

  it("derives movement feedback without map-specific rules", () => {
    expect(sourceFieldMovementStartFeedback(false, "idle").sound).toBe("bump");
    expect(sourceFieldMovementStartFeedback(true, "ledge-jump").sound).toBe("jump");
    expect(sourceFieldMovementFinishFeedback(SOURCE_FIELD_TERRAIN.grass, "step").sound).toBe("se_step_run_grass");
    expect(sourceFieldMovementFinishFeedback(0, "ledge-jump").animationId).toBe(2);
  });

  it("creates source footprints and water ripples from terrain tags", () => {
    const waterMap = { ...map, layers: { ...map.layers, upper: [0, 0, 0, 0] } };
    const waterMarks = sourceFieldMarksForStep(waterMap, tileset,
      { x: 0, y: 0 }, { x: 1, y: 0 }, "right", "walk", 100);
    expect(waterMarks.map((mark) => mark.kind)).toEqual(["water-ripple"]);
    const sandMap = { ...map, layers: { ...map.layers, lower: [3, 2, 3, 4] } };
    const sandTileset = { ...tileset, terrainTags: [0, 0, SOURCE_FIELD_TERRAIN.water, SOURCE_FIELD_TERRAIN.sand] };
    const marks = sourceFieldMarksForStep(sandMap, sandTileset, { x: 0, y: 0 }, { x: 1, y: 0 }, "right", "mount", 100);
    expect(marks[0]).toMatchObject({ kind: "footprint", x: 0, y: 0, mounted: true });
    expect(sourceFieldMarkActive(marks[0]!, 1_599)).toBe(true);
    expect(sourceFieldMarkActive(marks[0]!, 1_600)).toBe(false);
  });

  it("applies the source walking happiness rule only to eligible Pokémon", () => {
    const pokemon = {
      id: "one", species: "TEST", nickname: null, level: 5, experience: 0,
      stats: { maxHp: 20, attack: 10, defense: 10, specialAttack: 10, specialDefense: 10, speed: 10 },
      hp: 20, majorStatus: null, ability: null, heldItem: "SOOTHEBELL", moves: [],
      metadata: { schemaVersion: 1, personalId: 1,
        ivs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
        evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
        nature: "HARDY", gender: null, happiness: 50, shiny: false, form: 0,
        owner: { trainerId: null, publicId: null, secretId: null, name: null, pronouns: null },
        origin: { method: "encounter", mapId: 3, level: 5, receivedAt: null, hatchedMapId: null, hatchedAt: null,
          ball: "LUXURYBALL" }, markings: 0, ribbons: [], pokerus: null, eggSteps: 0 },
    } as const;
    const party = { schemaVersion: 1, activeIndex: 0, members: [pokemon] } as const;
    expect(applySourceWalkingHappiness(party, 3, () => true).members[0]?.metadata.happiness).toBe(56);
    expect(applySourceWalkingHappiness(party, 3, () => false)).toBe(party);
  });
});
