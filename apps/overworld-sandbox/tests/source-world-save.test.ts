import { describe, expect, it, vi } from "vitest";
import { SOURCE_WORLD_SAVE_KEY, clearSourceWorldSave, createSourceWorldSave, loadSourceWorldSave,
  parseSourceWorldSave, persistSourceWorldSave, sourceEventStateForLaunch } from "../src/source-world-save.js";
import { createSourceEventState } from "../src/source-event-state.js";

describe("source world save", () => {
  it("creates and parses a versioned map position", () => {
    const eventState = createSourceEventState();
    const save = createSourceWorldSave(3, 15, 16, "down", 1234, "walk", eventState);
    expect(parseSourceWorldSave(save)).toEqual({ schemaVersion: 2, mapId: 3, x: 15, y: 16,
      direction: "down", movementMode: "walk", savedAt: 1234, eventState });
    expect(createSourceWorldSave(3, 15, 16, "down", 1234, "surf", eventState).movementMode).toBe("surf");
  });

  it("migrates a legacy position-only save without inventing a narrative snapshot", () => {
    expect(parseSourceWorldSave({ schemaVersion: 1, mapId: 3, x: 15, y: 16,
      direction: "down", savedAt: 1234 })).toEqual({ schemaVersion: 2, mapId: 3, x: 15, y: 16,
      direction: "down", movementMode: "walk", savedAt: 1234, eventState: null });
  });

  it("restores the manual narrative snapshot on a cold launch but preserves a Coop reconnect", () => {
    const savedState = { ...createSourceEventState(), switches: { "trainer:won": false } };
    const workingState = { ...createSourceEventState(), switches: { "trainer:won": true } };
    const save = createSourceWorldSave(3, 15, 16, "down", 1234, "walk", savedState);
    expect(sourceEventStateForLaunch(workingState, save, false).switches["trainer:won"]).toBe(false);
    expect(sourceEventStateForLaunch(workingState, save, true).switches["trainer:won"]).toBe(true);
    expect(sourceEventStateForLaunch(workingState,
      parseSourceWorldSave({ schemaVersion: 1, mapId: 3, x: 15, y: 16,
        direction: "down", savedAt: 1234 }), false)).toBe(workingState);
  });

  it.each([
    null, {}, { schemaVersion: 3, mapId: 3, x: 1, y: 1, direction: "down", savedAt: 1 },
    { schemaVersion: 2, mapId: 3, x: 1, y: 1, direction: "down", savedAt: 1, eventState: null },
    { schemaVersion: 1, mapId: 0, x: 1, y: 1, direction: "down", savedAt: 1 },
    { schemaVersion: 1, mapId: 3, x: -1, y: 1, direction: "down", savedAt: 1 },
    { schemaVersion: 1, mapId: 3, x: 1, y: 1, direction: "diagonal", savedAt: 1 },
    { schemaVersion: 1, mapId: 3, x: 1, y: 1, direction: "down", movementMode: "flight", savedAt: 1 },
  ])("rejects an invalid position %#", (value) => {
    expect(() => parseSourceWorldSave(value)).toThrow("Sauvegarde de position invalide");
  });

  it("persists, reloads and removes malformed data", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: vi.fn((key: string) => { values.delete(key); }) };
    const save = createSourceWorldSave(7, 4, 8, "left", 5678, "walk", createSourceEventState());
    persistSourceWorldSave(storage, save);
    expect(loadSourceWorldSave(storage)).toEqual(save);
    values.set(SOURCE_WORLD_SAVE_KEY, "not-json");
    expect(loadSourceWorldSave(storage)).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith(SOURCE_WORLD_SAVE_KEY);
  });

  it("does not remove the independent avatar laboratory profile", () => {
    const values = new Map([[SOURCE_WORLD_SAVE_KEY, "world"],
      ["pokemon-z-battle.avatar-lab-profile.v1", "avatar"],
      ["pokemon-z-battle.active-player-profile.v1", "active-avatar"]]);
    clearSourceWorldSave({ removeItem: (key) => { values.delete(key); } });
    expect(values.get("pokemon-z-battle.avatar-lab-profile.v1")).toBe("avatar");
    expect(values.get("pokemon-z-battle.active-player-profile.v1")).toBe("active-avatar");
  });
});
