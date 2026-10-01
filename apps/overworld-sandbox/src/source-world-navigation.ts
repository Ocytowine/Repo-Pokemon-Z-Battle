import type { Direction } from "@pokemon-z-battle/overworld-engine";
import { loadImportedMap, type ImportedAvatar, type ImportedMapAssets, type ImportedTransfer }
  from "./imported-map.js";
import type { SourceCheckpoint } from "./source-event-state.js";
import type { SourceWorldSave } from "./source-world-save.js";

export type SourceMapLoader = (mapId: number) => Promise<ImportedMapAssets>;

export interface LoadedSourceWorld {
  readonly assets: ImportedMapAssets;
  readonly avatar: ImportedAvatar;
}

export interface LoadedSourceTransfer extends LoadedSourceWorld {
  readonly changedMap: boolean;
}

export interface InitialSourceWorld extends LoadedSourceWorld {
  readonly saveStatus: "default" | "restored" | "discarded";
}

export function sourceDirection(direction: number, fallback: Direction): Direction {
  switch (direction) {
    case 2: return "down";
    case 4: return "left";
    case 6: return "right";
    case 8: return "up";
    default: return fallback;
  }
}

export async function loadSourceTransfer(current: ImportedMapAssets | null, avatar: ImportedAvatar,
  transfer: ImportedTransfer, loader: SourceMapLoader = loadImportedMap): Promise<LoadedSourceTransfer> {
  const changedMap = current === null || current.map.id !== transfer.targetMapId;
  const assets = changedMap ? await loader(transfer.targetMapId) : current;
  return { assets, changedMap, avatar: { x: transfer.targetX, y: transfer.targetY,
    direction: sourceDirection(transfer.direction, avatar.direction) } };
}

export async function loadSourceWorldAt(mapId: number, avatar: ImportedAvatar,
  loader: SourceMapLoader = loadImportedMap): Promise<LoadedSourceWorld> {
  return { assets: await loader(mapId), avatar };
}

export function sourceCheckpointDestination(checkpoint: SourceCheckpoint | null): {
  readonly mapId: number;
  readonly avatar: ImportedAvatar;
} {
  return checkpoint === null
    ? { mapId: 3, avatar: { x: 28, y: 15, direction: "up" } }
    : { mapId: checkpoint.mapId,
      avatar: { x: checkpoint.x, y: checkpoint.y, direction: checkpoint.direction } };
}

export async function loadSourceCheckpoint(checkpoint: SourceCheckpoint | null,
  loader: SourceMapLoader = loadImportedMap): Promise<LoadedSourceWorld> {
  const destination = sourceCheckpointDestination(checkpoint);
  return loadSourceWorldAt(destination.mapId, destination.avatar, loader);
}

export async function loadInitialSourceWorld(save: SourceWorldSave | null,
  loader: SourceMapLoader = loadImportedMap): Promise<InitialSourceWorld> {
  if (save === null) {
    const loaded = await loadSourceWorldAt(3, { x: 28, y: 15, direction: "up" }, loader);
    return { ...loaded, saveStatus: "default" };
  }
  try {
    const loaded = await loadSourceWorldAt(save.mapId,
      { x: save.x, y: save.y, direction: save.direction }, loader);
    if (save.x >= loaded.assets.map.width || save.y >= loaded.assets.map.height) {
      throw new Error("La position sauvegardée se trouve hors de la carte.");
    }
    return { ...loaded, saveStatus: "restored" };
  } catch {
    const loaded = await loadSourceWorldAt(3, { x: 28, y: 15, direction: "up" }, loader);
    return { ...loaded, saveStatus: "discarded" };
  }
}
