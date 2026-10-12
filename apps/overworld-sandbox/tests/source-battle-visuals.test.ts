import { describe, expect, it } from "vitest";
import { sourceCaptureBallIndex, sourceHealthAnimationDuration } from "../src/source-battle-visuals.js";

describe("source battle health animation", () => {
  it("keeps a readable minimum and caps a full health drain", () => {
    expect(sourceHealthAnimationDuration(100, 95, 100)).toBe(420);
    expect(sourceHealthAnimationDuration(100, 50, 100)).toBe(525);
    expect(sourceHealthAnimationDuration(100, 0, 100)).toBe(900);
  });
});

describe("source capture ball", () => {
  it("uses the ball graphics indices from the source script", () => {
    expect(sourceCaptureBallIndex("POKEBALL")).toBe(0);
    expect(sourceCaptureBallIndex("QUICKBALL")).toBe(14);
    expect(sourceCaptureBallIndex("ULTRABALLCASERA")).toBe(27);
    expect(sourceCaptureBallIndex("UNKNOWN")).toBe(0);
  });
});
