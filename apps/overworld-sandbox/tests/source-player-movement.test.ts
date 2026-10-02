import { describe, expect, it, vi } from "vitest";
import { createSourceEventState } from "../src/source-event-state.js";
import { loadSourceMovementTestOverride, persistSourceMovementTestOverride,
  sourceMovementDuration, sourceMovementUnlocks, sourceMovementVisualMode,
  sourceMovementVisualOffset, sourceMovementVisualPattern } from "../src/source-player-movement.js";

describe("source player movement unlocks", () => {
  it("keeps progression requirements separate from the test override", () => {
    const initial = createSourceEventState();
    expect(sourceMovementUnlocks(initial, false)).toMatchObject({ sprint: false, mount: false,
      climb: false, surf: false, dive: false, waterfall: false, testOverride: false });
    expect(sourceMovementUnlocks(initial, true)).toMatchObject({ sprint: true, mount: true,
      climb: true, surf: true, dive: true, waterfall: true, testOverride: true });
    expect(initial.inventory).toEqual({});
    expect(initial.runningShoes).toBe(false);
  });

  it("persists the local test setting independently", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null,
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); }) };
    persistSourceMovementTestOverride(storage, true);
    expect(loadSourceMovementTestOverride(storage)).toBe(true);
    persistSourceMovementTestOverride(storage, false);
    expect(loadSourceMovementTestOverride(storage)).toBe(false);
  });

  it("separates water bobbing, Surf transitions and Chevroum timing", () => {
    expect(sourceMovementVisualMode("walk", "surf-transition")).toBe("surf");
    expect(sourceMovementVisualPattern("surf", 0, 750, false)).toBe(2);
    expect(sourceMovementVisualOffset("surf", 750)).toBe(18);
    expect(sourceMovementVisualPattern("walk", 3, 750, true)).toBe(3);
    expect(sourceMovementDuration("mount", "step")).toBeGreaterThan(100);
    expect(sourceMovementDuration("mount", "step")).toBeLessThan(sourceMovementDuration("walk", "step"));
  });
});
