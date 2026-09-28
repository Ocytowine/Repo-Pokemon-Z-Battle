import type { RandomSource } from "@pokemon-z-battle/battle-engine";
import type { ImportedEncounterTable, ImportedMap, ImportedTileset } from "./imported-map.js";

const GRASS_TAGS = new Set([2, 10, 11, 14]);
const NEUTRAL_TAG = 13;
const BRIDGE_TAG = 15;

export interface WildEncounterRoll {
  readonly steps: number;
  readonly encounter: { readonly species: string; readonly level: number } | null;
}

export function terrainTagAt(map: ImportedMap, tileset: ImportedTileset, x: number, y: number): number {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= map.width || y >= map.height) return 0;
  const cell = y * map.width + x;
  for (const layer of [map.layers.upper, map.layers.middle, map.layers.lower]) {
    const tileId = layer[cell];
    if (tileId === undefined) return 0;
    const tag = tileset.terrainTags[tileId] ?? 0;
    if (tag === BRIDGE_TAG) continue;
    if (tag > 0 && tag !== NEUTRAL_TAG) return tag;
  }
  return 0;
}

export function isGrassTerrain(tag: number): boolean {
  return GRASS_TAGS.has(tag);
}

export function rollLandEncounter(table: ImportedEncounterTable | null, terrainTag: number, previousSteps: number,
  rng: RandomSource): WildEncounterRoll {
  if (table === null || table.land.length === 0 || !isGrassTerrain(terrainTag)) {
    return { steps: previousSteps, encounter: null };
  }
  const steps = previousSteps + 1;
  if (steps <= 3 || rng.nextInt(180 * 16) >= table.landRate * 16) return { steps, encounter: null };
  const totalWeight = table.land.reduce((total, slot) => total + slot.weight, 0);
  let choice = rng.nextInt(totalWeight);
  const slot = table.land.find((candidate) => {
    if (choice < candidate.weight) return true;
    choice -= candidate.weight;
    return false;
  });
  if (slot === undefined) throw new Error("Table de rencontre terrestre incohérente.");
  const level = slot.minimumLevel + rng.nextInt(slot.maximumLevel - slot.minimumLevel + 1);
  return { steps: 0, encounter: { species: slot.species, level } };
}
