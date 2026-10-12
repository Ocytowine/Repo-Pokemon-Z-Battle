import type { SourceMovementAction, SourceMovementMode } from "@pokemon-z-battle/multiplayer-protocol";
import type { PlayerPartyState } from "@pokemon-z-battle/player-state";
import type { Direction, GridPoint } from "@pokemon-z-battle/overworld-engine";

export const SOURCE_FIELD_TERRAIN = {
  none: 0,
  ledge: 1,
  grass: 2,
  sand: 3,
  rock: 4,
  deepWater: 5,
  stillWater: 6,
  water: 7,
  waterfall: 8,
  waterfallCrest: 9,
  tallGrass: 10,
  underwaterGrass: 11,
  ice: 12,
  neutral: 13,
  sootGrass: 14,
  bridge: 15,
  puddle: 16,
  lakeReflection: 17,
} as const;

interface FieldMap {
  readonly width: number;
  readonly height: number;
  readonly layers: {
    readonly lower: readonly number[];
    readonly middle: readonly number[];
    readonly upper: readonly number[];
  };
}

interface FieldTileset {
  readonly terrainTags: readonly number[];
  readonly passages: readonly number[];
}

export interface SourceFieldVisualState {
  readonly bushDepth: number;
  readonly reflection: boolean;
  readonly shadow: boolean;
}

export interface SourceFieldStepFeedback {
  readonly sound: string | null;
  readonly animationId: number | null;
}

export interface SourceFieldMark extends GridPoint {
  readonly kind: "footprint" | "water-ripple";
  readonly direction: Direction;
  readonly mounted: boolean;
  readonly startedAt: number;
}

export const SOURCE_FIELD_MARK_DURATION = 1_500;

function tileIdsAt(map: FieldMap, x: number, y: number): readonly number[] {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return [];
  const index = y * map.width + x;
  return [map.layers.upper[index] ?? 0, map.layers.middle[index] ?? 0, map.layers.lower[index] ?? 0];
}

export function sourceFieldTerrainAt(map: FieldMap, tileset: FieldTileset, x: number, y: number): number {
  for (const tileId of tileIdsAt(map, x, y)) {
    const terrain = tileset.terrainTags[tileId] ?? 0;
    if (terrain !== 0) return terrain;
  }
  return 0;
}

export function sourceFieldTileIsBush(map: FieldMap, tileset: FieldTileset, x: number, y: number): boolean {
  return tileIdsAt(map, x, y).some((tileId) => ((tileset.passages[tileId] ?? 0) & 0x40) !== 0);
}

export function sourceFieldTerrainReflects(terrain: number): boolean {
  return terrain === SOURCE_FIELD_TERRAIN.stillWater || terrain === SOURCE_FIELD_TERRAIN.puddle
    || terrain === SOURCE_FIELD_TERRAIN.lakeReflection;
}

export function sourceFieldVisualState(map: FieldMap, tileset: FieldTileset, x: number, y: number,
  mode: SourceMovementMode = "walk", airborne = false, alwaysOnTop = false): SourceFieldVisualState {
  const bushDepth = airborne || alwaysOnTop || !sourceFieldTileIsBush(map, tileset, x, y) ? 0 : 12;
  return {
    bushDepth,
    reflection: !airborne && !alwaysOnTop && sourceFieldTerrainReflects(sourceFieldTerrainAt(map, tileset, x, y + 1)),
    shadow: bushDepth === 0 && mode !== "surf" && mode !== "dive",
  };
}

export function sourceFieldMovementStartFeedback(moved: boolean,
  action: SourceMovementAction): SourceFieldStepFeedback {
  if (!moved) return { sound: "bump", animationId: null };
  if (action === "ledge-jump") return { sound: "jump", animationId: null };
  return { sound: null, animationId: null };
}

export function sourceFieldMovementFinishFeedback(terrain: number,
  action: SourceMovementAction): SourceFieldStepFeedback {
  return {
    sound: terrain === SOURCE_FIELD_TERRAIN.grass || terrain === SOURCE_FIELD_TERRAIN.sootGrass
      ? "se_step_run_grass" : null,
    animationId: action === "ledge-jump" ? 2 : null,
  };
}

export function sourceFieldMarksForStep(map: FieldMap, tileset: FieldTileset,
  from: GridPoint, to: GridPoint, direction: Direction, mode: SourceMovementMode,
  startedAt: number): readonly SourceFieldMark[] {
  const marks: SourceFieldMark[] = [];
  if (sourceFieldTerrainAt(map, tileset, from.x, from.y) === SOURCE_FIELD_TERRAIN.sand) {
    marks.push({ kind: "footprint", ...from, direction, mounted: mode === "mount", startedAt });
  }
  const destination = sourceFieldTerrainAt(map, tileset, to.x, to.y);
  if (destination === SOURCE_FIELD_TERRAIN.stillWater || destination === SOURCE_FIELD_TERRAIN.water
    || destination === SOURCE_FIELD_TERRAIN.lakeReflection) {
    marks.push({ kind: "water-ripple", ...to, direction, mounted: false, startedAt });
  }
  return marks;
}

export function sourceFieldMarkActive(mark: SourceFieldMark, now: number): boolean {
  return now >= mark.startedAt && now - mark.startedAt < SOURCE_FIELD_MARK_DURATION;
}

/** Règle personnelle du jeu source : tous les 128 pas, chaque Pokémon conscient a une chance sur deux. */
export function applySourceWalkingHappiness(party: PlayerPartyState, mapId: number,
  shouldGain: () => boolean): PlayerPartyState {
  let changed = false;
  const members = party.members.map((pokemon) => {
    const happiness = pokemon.metadata.happiness;
    if (pokemon.hp <= 0 || pokemon.metadata.eggSteps > 0 || happiness === null || !shouldGain()) return pokemon;
    const baseGain = 1 + (happiness < 200 ? 1 : 0)
      + (pokemon.metadata.origin.mapId === mapId ? 1 : 0)
      + (pokemon.metadata.origin.ball === "LUXURYBALL" ? 1 : 0);
    const gain = pokemon.heldItem === "SOOTHEBELL" ? Math.floor(baseGain * 1.5) : baseGain;
    const nextHappiness = Math.min(255, happiness + gain);
    if (nextHappiness === happiness) return pokemon;
    changed = true;
    return { ...pokemon, metadata: { ...pokemon.metadata, happiness: nextHappiness } };
  });
  return changed ? { ...party, members } : party;
}
