import { describe, expect, it, vi } from "vitest";
import type { ImportedMapAssets } from "../src/imported-map.js";
import { loadInitialSourceWorld, loadSourceTransfer, sourceCheckpointDestination, sourceDirection }
  from "../src/source-world-navigation.js";

function assets(mapId: number, width = 20, height = 15): ImportedMapAssets {
  return { map: { id: mapId, name: `Map ${mapId}`, width, height } } as ImportedMapAssets;
}

describe("source world navigation", () => {
  it("maps RPG Maker directions and preserves an unknown direction", () => {
    expect(sourceDirection(2, "left")).toBe("down");
    expect(sourceDirection(8, "left")).toBe("up");
    expect(sourceDirection(0, "left")).toBe("left");
  });

  it("repositions on the current map without loading it again", async () => {
    const current = assets(3);
    const loader = vi.fn();
    const result = await loadSourceTransfer(current, { x: 1, y: 2, direction: "left" },
      { eventId: 4, targetMapId: 3, targetX: 8, targetY: 9, direction: 6 }, loader);
    expect(loader).not.toHaveBeenCalled();
    expect(result).toEqual({ assets: current, changedMap: false,
      avatar: { x: 8, y: 9, direction: "right" } });
  });

  it("loads a different transfer destination", async () => {
    const target = assets(7);
    const loader = vi.fn(async () => target);
    const result = await loadSourceTransfer(assets(3), { x: 1, y: 2, direction: "up" },
      { eventId: 5, targetMapId: 7, targetX: 2, targetY: 3, direction: 0 }, loader);
    expect(loader).toHaveBeenCalledWith(7);
    expect(result.changedMap).toBe(true);
    expect(result.avatar).toEqual({ x: 2, y: 3, direction: "up" });
  });

  it("restores a valid save and discards an inaccessible one", async () => {
    const loader = vi.fn(async (mapId: number) => mapId === 9 ? assets(9, 10, 10) : assets(3));
    const base = { schemaVersion: 1 as const, mapId: 9, direction: "down" as const, savedAt: 1 };
    await expect(loadInitialSourceWorld({ ...base, x: 4, y: 5 }, loader)).resolves.toMatchObject({
      saveStatus: "restored", avatar: { x: 4, y: 5 }, assets: { map: { id: 9 } },
    });
    await expect(loadInitialSourceWorld({ ...base, x: 14, y: 5 }, loader)).resolves.toMatchObject({
      saveStatus: "discarded", avatar: { x: 28, y: 15 }, assets: { map: { id: 3 } },
    });
  });

  it("resolves the default and saved checkpoint destinations", () => {
    expect(sourceCheckpointDestination(null)).toEqual({ mapId: 3,
      avatar: { x: 28, y: 15, direction: "up" } });
    expect(sourceCheckpointDestination({ mapId: 10, x: 6, y: 7, direction: "down" })).toEqual({
      mapId: 10, avatar: { x: 6, y: 7, direction: "down" },
    });
  });
});
