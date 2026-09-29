import { describe, expect, it, vi } from "vitest";
import { SOURCE_WORLD_SAVE_KEY, createSourceWorldSave, loadSourceWorldSave,
  parseSourceWorldSave, persistSourceWorldSave } from "../src/source-world-save.js";

describe("source world save", () => {
  it("creates and parses a versioned map position", () => {
    const save = createSourceWorldSave(3, 15, 16, "down", 1234);
    expect(parseSourceWorldSave(save)).toEqual({ schemaVersion: 1, mapId: 3, x: 15, y: 16,
      direction: "down", savedAt: 1234 });
  });

  it.each([
    null, {}, { schemaVersion: 2, mapId: 3, x: 1, y: 1, direction: "down", savedAt: 1 },
    { schemaVersion: 1, mapId: 0, x: 1, y: 1, direction: "down", savedAt: 1 },
    { schemaVersion: 1, mapId: 3, x: -1, y: 1, direction: "down", savedAt: 1 },
    { schemaVersion: 1, mapId: 3, x: 1, y: 1, direction: "diagonal", savedAt: 1 },
  ])("rejects an invalid position %#", (value) => {
    expect(() => parseSourceWorldSave(value)).toThrow("Sauvegarde de position invalide");
  });

  it("persists, reloads and removes malformed data", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: vi.fn((key: string) => { values.delete(key); }) };
    const save = createSourceWorldSave(7, 4, 8, "left", 5678);
    persistSourceWorldSave(storage, save);
    expect(loadSourceWorldSave(storage)).toEqual(save);
    values.set(SOURCE_WORLD_SAVE_KEY, "not-json");
    expect(loadSourceWorldSave(storage)).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith(SOURCE_WORLD_SAVE_KEY);
  });
});
