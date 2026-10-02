import type { Direction } from "@pokemon-z-battle/overworld-engine";
import type { SourceMovementMode } from "@pokemon-z-battle/multiplayer-protocol";
import { sourceBadgeCount } from "./source-economy.js";
import type { SourceEventState } from "./source-event-state.js";
import type { ImportedMap, ImportedTileset } from "./imported-map.js";
import { terrainTagAt } from "./source-wild-encounter.js";

export const SOURCE_MOVEMENT_TEST_KEY = "pokemon-z-battle.movement-test-unlocks.v1";

export type SourceMovementCapability = "sprint" | "mount" | "climb" | "surf" | "dive" | "waterfall";

export interface SourceMovementUnlocks {
  readonly sprint: boolean;
  readonly mount: boolean;
  readonly climb: boolean;
  readonly surf: boolean;
  readonly dive: boolean;
  readonly waterfall: boolean;
  readonly testOverride: boolean;
}

const MOUNT_ITEMS = ["BICYCLE", "BICYCLE1", "BICYCLE2", "BICYCLE3", "BICYCLE4", "BICYCLE5", "BICYCLE6", "BICYCLE7"] as const;

function partyKnows(state: SourceEventState, move: string): boolean {
  return state.party.members.some((member) => member.moves.some((slot) => slot.internalName === move));
}

export function sourceMovementUnlocks(state: SourceEventState, testOverride: boolean): SourceMovementUnlocks {
  const badges = sourceBadgeCount(state);
  const hasMount = MOUNT_ITEMS.some((item) => (state.inventory[item] ?? 0) > 0);
  const unlocked = (value: boolean): boolean => testOverride || value;
  return {
    sprint: unlocked(state.runningShoes),
    mount: unlocked(hasMount),
    climb: unlocked((state.inventory.BICYCLE ?? 0) > 0),
    surf: unlocked(badges >= 5 && (state.inventory.SURFMONTURA ?? 0) > 0),
    dive: unlocked(badges >= 7 && partyKnows(state, "DIVE")),
    waterfall: unlocked(badges >= 8 && partyKnows(state, "WATERFALL")),
    testOverride,
  };
}

export function sourceMovementCapabilityLabel(capability: SourceMovementCapability): string {
  switch (capability) {
    case "sprint": return "Sprint";
    case "mount": return "Monture Chevroum";
    case "climb": return "Escalade avec Chevroum";
    case "surf": return "Monture Surf";
    case "dive": return "Plongée";
    case "waterfall": return "Cascade";
  }
}

export function loadSourceMovementTestOverride(storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(SOURCE_MOVEMENT_TEST_KEY) === "true";
}

export function persistSourceMovementTestOverride(storage: Pick<Storage, "setItem">, enabled: boolean): void {
  storage.setItem(SOURCE_MOVEMENT_TEST_KEY, String(enabled));
}

export const SOURCE_TERRAIN = Object.freeze({
  ledge: 1,
  deepWater: 5,
  stillWater: 6,
  water: 7,
  waterfall: 8,
  waterfallCrest: 9,
  tallGrass: 10,
  ice: 12,
  reflectionLake: 17,
});

export function sourceTerrainAt(map: ImportedMap, tileset: ImportedTileset, x: number, y: number): number {
  return terrainTagAt(map, tileset, x, y);
}

export function isSourceSurfableTerrain(tag: number): boolean {
  return tag === SOURCE_TERRAIN.deepWater || tag === SOURCE_TERRAIN.water
    || tag === SOURCE_TERRAIN.waterfall || tag === SOURCE_TERRAIN.waterfallCrest
    || tag === SOURCE_TERRAIN.reflectionLake;
}

export function sourceFacingPoint(x: number, y: number, direction: Direction): { readonly x: number; readonly y: number } {
  switch (direction) {
    case "up": return { x, y: y - 1 };
    case "down": return { x, y: y + 1 };
    case "left": return { x: x - 1, y };
    case "right": return { x: x + 1, y };
  }
}

export function sourceMovementDuration(mode: SourceMovementMode, action: string): number {
  if (action === "ledge-jump" || action === "surf-transition") return 260;
  if (action === "ice-slide") return 85;
  if (action === "waterfall" || action === "climb") return 180;
  if (mode === "mount") return 92;
  if (mode === "run" || mode === "surf" || mode === "dive") return 105;
  return 125;
}

export function sourceModeForInput(current: SourceMovementMode, sprintHeld: boolean,
  unlocks: SourceMovementUnlocks): SourceMovementMode {
  if (current === "surf" || current === "dive" || current === "mount") return current;
  return sprintHeld && unlocks.sprint ? "run" : "walk";
}

export function sourceMovementModeAllowed(mode: SourceMovementMode, unlocks: SourceMovementUnlocks): boolean {
  switch (mode) {
    case "walk": return true;
    case "run": return unlocks.sprint;
    case "mount": return unlocks.mount;
    case "surf": return unlocks.surf;
    case "dive": return unlocks.dive;
  }
}
