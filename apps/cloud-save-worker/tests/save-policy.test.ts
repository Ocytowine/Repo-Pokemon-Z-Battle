import { describe, expect, it } from "vitest";
import { MAX_SAVE_BYTES, parseSavePath, revisionMatches, validSnapshot } from "../src/save-store.js";

describe("cloud save request policy", () => {
  it("accepts only the two private slot ids and explicit save kinds", () => {
    expect(parseSavePath("/api/saves/1/manual")).toEqual({ slot: 1, kind: "manual" });
    expect(parseSavePath("/api/saves/2/auto")).toEqual({ slot: 2, kind: "auto" });
    expect(parseSavePath("/api/saves/3/manual")).toBeNull();
    expect(parseSavePath("/api/saves/1/../../other")).toBeNull();
  });

  it("requires the exact parent revision before advancing a cloud head", () => {
    expect(revisionMatches(null, null)).toBe(true);
    expect(revisionMatches(null, "previous")).toBe(false);
    expect(revisionMatches("previous", "previous")).toBe(true);
    expect(revisionMatches("old", "new")).toBe(false);
  });

  it("rejects a save without the minimum complete local fields", () => {
    const snapshot = { schemaVersion: 1, savedAt: 1000, eventState: {}, worldSave: null,
      player: null, newGame: null, fieldShortcuts: null };
    expect(validSnapshot(snapshot)).toBe(true);
    expect(validSnapshot({ ...snapshot, eventState: null })).toBe(false);
    expect(validSnapshot({ ...snapshot, schemaVersion: 2 })).toBe(false);
    expect(MAX_SAVE_BYTES).toBeLessThan(2_000_000);
  });
});
