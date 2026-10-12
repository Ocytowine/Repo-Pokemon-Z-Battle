import { describe, expect, it } from "vitest";
import { sourceHealthAnimationDuration } from "../src/source-battle-visuals.js";

describe("source battle health animation", () => {
  it("keeps a readable minimum and caps a full health drain", () => {
    expect(sourceHealthAnimationDuration(100, 95, 100)).toBe(420);
    expect(sourceHealthAnimationDuration(100, 50, 100)).toBe(525);
    expect(sourceHealthAnimationDuration(100, 0, 100)).toBe(900);
  });
});
