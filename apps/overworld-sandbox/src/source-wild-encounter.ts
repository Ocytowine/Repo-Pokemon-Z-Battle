import type { RandomSource } from "@pokemon-z-battle/battle-engine";
import type { ImportedEncounterTable, ImportedMap, ImportedTileset } from "./imported-map.js";
import type { SourceFishingRod } from "./source-event-state.js";

const GRASS_TAGS = new Set([2, 10, 11, 14]);
const NEUTRAL_TAG = 13;
const BRIDGE_TAG = 15;

export interface WildEncounterRoll {
  readonly steps: number;
  readonly encounter: { readonly species: string; readonly level: number } | null;
}

export type SourceEncounterMethod = "Land" | "Cave" | "OldRod" | "GoodRod" | "SuperRod";

export const SOURCE_FISHING_RODS: readonly SourceFishingRod[] = ["SUPERROD", "GOODROD", "OLDROD"];

export function sourceFishingMethod(rod: SourceFishingRod): Extract<SourceEncounterMethod,
"OldRod" | "GoodRod" | "SuperRod"> {
  return ({ OLDROD: "OldRod", GOODROD: "GoodRod", SUPERROD: "SuperRod" } as const)[rod];
}

export function sourceFishingEncounterMethod(table: ImportedEncounterTable | null,
  rod: SourceFishingRod): Extract<SourceEncounterMethod, "OldRod" | "GoodRod" | "SuperRod"> | null {
  const requested = sourceFishingMethod(rod);
  const available = (method: SourceEncounterMethod): boolean => table?.methods.some((entry) =>
    entry.method === method && entry.slots.length > 0) === true;
  if (available(requested)) return requested;
  // Z 2.12 FR defines the upper rods but ships only OldRod tables. Keep their
  // better bite timing while using that sole species table instead of making them inert.
  return requested !== "OldRod" && available("OldRod") ? "OldRod" : null;
}

export function sourceFishingMethodAvailable(table: ImportedEncounterTable | null, rod: SourceFishingRod): boolean {
  return sourceFishingEncounterMethod(table, rod) !== null;
}

/** Uses an owned preference when viable, otherwise falls back to an owned rod backed by the current map. */
export function resolveSourceFishingRod(preferred: SourceFishingRod | undefined,
  inventory: Readonly<Record<string, number>>, table: ImportedEncounterTable | null): SourceFishingRod | null {
  const owned = SOURCE_FISHING_RODS.filter((rod) => (inventory[rod] ?? 0) > 0);
  if (preferred !== undefined && owned.includes(preferred) && sourceFishingMethodAvailable(table, preferred)) {
    return preferred;
  }
  return owned.find((rod) => sourceFishingMethodAvailable(table, rod))
    ?? (preferred !== undefined && owned.includes(preferred) ? preferred : owned[0] ?? null);
}

export interface SourceFishingAttempt {
  readonly waitMs: number;
  readonly bite: boolean;
  readonly hookWindowMs: number;
  readonly encounter: WildEncounterRoll["encounter"];
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

export function rollEncounterForMethod(table: ImportedEncounterTable | null, method: SourceEncounterMethod,
  rng: RandomSource): WildEncounterRoll["encounter"] {
  const slots = table?.methods.find((candidate) => candidate.method === method)?.slots ?? [];
  if (slots.length === 0) return null;
  const totalWeight = slots.reduce((total, slot) => total + slot.weight, 0);
  let choice = rng.nextInt(totalWeight);
  const slot = slots.find((candidate) => {
    if (choice < candidate.weight) return true;
    choice -= candidate.weight;
    return false;
  });
  if (slot === undefined) throw new Error(`Table de rencontre ${method} incohérente.`);
  return { species: slot.species,
    level: slot.minimumLevel + rng.nextInt(slot.maximumLevel - slot.minimumLevel + 1) };
}

export function rollStepEncounter(table: ImportedEncounterTable | null, terrainTag: number,
  previousSteps: number, rng: RandomSource): WildEncounterRoll {
  const cave = table?.methods.some((method) => method.method === "Cave") === true;
  if (cave && terrainTag === 12) return { steps: previousSteps, encounter: null };
  const method: SourceEncounterMethod | null = cave ? "Cave" : isGrassTerrain(terrainTag) ? "Land" : null;
  if (table === null || method === null) return { steps: previousSteps, encounter: null };
  const slots = table.methods.find((candidate) => candidate.method === method)?.slots ?? [];
  const density = method === "Cave" ? table.rates.cave : table.rates.land;
  if (slots.length === 0 || density <= 0) return { steps: previousSteps, encounter: null };
  const steps = previousSteps + 1;
  if (steps <= 3 || rng.nextInt(180 * 16) >= density * 16) return { steps, encounter: null };
  return { steps: 0, encounter: rollEncounterForMethod(table, method, rng) };
}

export function rollLandEncounter(table: ImportedEncounterTable | null, terrainTag: number, previousSteps: number,
  rng: RandomSource): WildEncounterRoll {
  return rollStepEncounter(table, terrainTag, previousSteps, rng);
}

export function planFishingAttempt(table: ImportedEncounterTable | null,
  method: Extract<SourceEncounterMethod, "OldRod" | "GoodRod" | "SuperRod">,
  leadAbility: string | null, rng: RandomSource,
  encounterMethod: Extract<SourceEncounterMethod, "OldRod" | "GoodRod" | "SuperRod"> = method): SourceFishingAttempt {
  const speedup = leadAbility === "STICKYHOLD" || leadAbility === "SUCTIONCUPS";
  const firstWait = 2 + rng.nextInt(10);
  const waitUnits = speedup ? Math.min(firstWait, 2 + rng.nextInt(10)) : firstWait;
  const rodType = method === "OldRod" ? 1 : method === "GoodRod" ? 2 : 3;
  const biteChance = Math.min(100, Math.floor((40 + 25 * rodType) * (speedup ? 1.5 : 1)));
  const hasEncounter = table?.methods.some((candidate) => candidate.method === encounterMethod
    && candidate.slots.length > 0) === true;
  const bite = hasEncounter && rng.nextInt(100) < biteChance;
  if (!bite) return { waitMs: waitUnits * 500, bite: false, hookWindowMs: 0, encounter: null };
  const hookWindowMs = (20 + rng.nextInt(21)) * 25;
  return { waitMs: waitUnits * 500, bite: true, hookWindowMs,
    encounter: rollEncounterForMethod(table, encounterMethod, rng) };
}
