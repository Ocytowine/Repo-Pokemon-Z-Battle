import { describe, expect, it } from "vitest";
import { DEFAULT_SOURCE_DEV_SETTINGS, parseSourceDevSettings, sourceDevLevelCap }
  from "../src/source-dev-tools.js";

describe("source developer settings", () => {
  it("keeps invalid or missing overrides out of narrative progression", () => {
    expect(parseSourceDevSettings(null)).toEqual(DEFAULT_SOURCE_DEV_SETTINGS);
    expect(parseSourceDevSettings({ levelCapOverride: 0 })).toEqual(DEFAULT_SOURCE_DEV_SETTINGS);
    expect(parseSourceDevSettings({ levelCapOverride: 101 })).toEqual(DEFAULT_SOURCE_DEV_SETTINGS);
  });

  it("applies an explicit local cap without changing the story cap", () => {
    const settings = parseSourceDevSettings({ levelCapOverride: 100 });
    expect(sourceDevLevelCap(17, settings)).toBe(100);
    expect(sourceDevLevelCap(17, DEFAULT_SOURCE_DEV_SETTINGS)).toBe(17);
  });
});
