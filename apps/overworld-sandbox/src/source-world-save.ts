import type { Direction } from "@pokemon-z-battle/overworld-engine";
import type { SourceMovementMode } from "@pokemon-z-battle/multiplayer-protocol";
import { parseSourceEventState, type SourceEventState } from "./source-event-state.js";

export const SOURCE_WORLD_SAVE_KEY = "pokemon-z-battle.source-world-save.v1";
export const SOURCE_WORLD_SAVE_SCHEMA_VERSION = 2 as const;

export interface SourceWorldSave {
  readonly schemaVersion: typeof SOURCE_WORLD_SAVE_SCHEMA_VERSION;
  readonly mapId: number;
  readonly x: number;
  readonly y: number;
  readonly direction: Direction;
  readonly movementMode: SourceMovementMode;
  readonly savedAt: number;
  /** Null only while reading a legacy v1 save which stored the position alone. */
  readonly eventState: SourceEventState | null;
}

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

export function createSourceWorldSave(mapId: number, x: number, y: number, direction: Direction,
  savedAt = Date.now(), movementMode: SourceMovementMode = "walk",
  eventState: SourceEventState): SourceWorldSave {
  const value = { schemaVersion: SOURCE_WORLD_SAVE_SCHEMA_VERSION, mapId, x, y, direction, movementMode, savedAt,
    eventState };
  return parseSourceWorldSave(value);
}

export function parseSourceWorldSave(value: unknown): SourceWorldSave {
  if (!record(value) || value.schemaVersion !== 1 && value.schemaVersion !== SOURCE_WORLD_SAVE_SCHEMA_VERSION
    || !integer(value.mapId, 1, 999) || !integer(value.x, 0) || !integer(value.y, 0)
    || !["up", "down", "left", "right"].includes(String(value.direction))
    || !integer(value.savedAt, 1)) throw new Error("Sauvegarde de position invalide.");
  const movementMode = value.movementMode === undefined ? "walk" : String(value.movementMode);
  if (!["walk", "run", "mount", "surf", "dive"].includes(movementMode)) {
    throw new Error("Sauvegarde de position invalide.");
  }
  let eventState: SourceEventState | null = null;
  try {
    eventState = value.schemaVersion === 1 ? null : parseSourceEventState(value.eventState);
  } catch {
    throw new Error("Sauvegarde de position invalide.");
  }
  return { schemaVersion: SOURCE_WORLD_SAVE_SCHEMA_VERSION, mapId: value.mapId, x: value.x, y: value.y,
    direction: value.direction as Direction, movementMode: movementMode as SourceMovementMode, savedAt: value.savedAt,
    eventState };
}

export function loadSourceWorldSave(storage: Pick<Storage, "getItem" | "removeItem">): SourceWorldSave | null {
  const raw = storage.getItem(SOURCE_WORLD_SAVE_KEY);
  if (raw === null) return null;
  try {
    return parseSourceWorldSave(JSON.parse(raw) as unknown);
  } catch {
    storage.removeItem(SOURCE_WORLD_SAVE_KEY);
    return null;
  }
}

/**
 * A cold solo launch resumes the last explicit save. During a Coop reconnect in
 * the same tab, the working copy wins so an acknowledged settlement cannot be
 * rolled back before the room restores its authoritative battle.
 */
export function sourceEventStateForLaunch(workingState: SourceEventState, save: SourceWorldSave | null,
  reconnectingCoop: boolean): SourceEventState {
  return reconnectingCoop || save?.eventState === null || save?.eventState === undefined
    ? workingState : save.eventState;
}

export function persistSourceWorldSave(storage: Pick<Storage, "setItem">, save: SourceWorldSave): void {
  storage.setItem(SOURCE_WORLD_SAVE_KEY, JSON.stringify(save));
}

export function clearSourceWorldSave(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(SOURCE_WORLD_SAVE_KEY);
}
