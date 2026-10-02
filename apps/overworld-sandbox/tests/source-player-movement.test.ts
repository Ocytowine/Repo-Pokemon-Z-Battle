import { describe, expect, it, vi } from "vitest";
import { createSourceEventState } from "../src/source-event-state.js";
import { loadSourceMovementTestOverride, persistSourceMovementTestOverride,
  sourceMovementUnlocks } from "../src/source-player-movement.js";

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
});
