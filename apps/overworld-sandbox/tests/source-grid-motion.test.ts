import { describe, expect, it } from "vitest";
import { createSourceGridMotion, sampleSourceGridMotion } from "../src/source-grid-motion.js";

describe("source grid motion", () => {
  it("interpolates one logical tile with one alternating walking pose", () => {
    const motion = createSourceGridMotion({ x: 4, y: 3 }, { x: 5, y: 3 }, "right", 1_000,
      { duration: 160, walkingPattern: 3 });
    expect(sampleSourceGridMotion(motion, 1_000)).toEqual({ x: 4, y: 3, direction: "right", pattern: 0, renderOffsetY: 0, complete: false });
    expect(sampleSourceGridMotion(motion, 1_040)).toEqual({ x: 4.25, y: 3, direction: "right", pattern: 0, renderOffsetY: 0, complete: false });
    expect(sampleSourceGridMotion(motion, 1_120)).toEqual({ x: 4.75, y: 3, direction: "right", pattern: 3, renderOffsetY: 0, complete: false });
    expect(sampleSourceGridMotion(motion, 1_160)).toEqual({ x: 5, y: 3, direction: "right", pattern: 0, renderOffsetY: 0, complete: true });
  });

  it("clamps samples before and after the movement interval", () => {
    const motion = createSourceGridMotion({ x: 2, y: 7 }, { x: 2, y: 6 }, "up", 500, { duration: 100 });
    expect(sampleSourceGridMotion(motion, 450)).toMatchObject({ x: 2, y: 7, complete: false });
    expect(sampleSourceGridMotion(motion, 700)).toMatchObject({ x: 2, y: 6, pattern: 0, complete: true });
  });

  it("rejects an invalid duration", () => {
    expect(() => createSourceGridMotion({ x: 0, y: 0 }, { x: 1, y: 0 }, "right", 0, { duration: 0 })).toThrow("timing");
  });

  it("adds a visible arc to ledge jumps", () => {
    const motion = createSourceGridMotion({ x: 4, y: 3 }, { x: 4, y: 5 }, "down", 1_000,
      { duration: 200, action: "ledge-jump" });
    expect(sampleSourceGridMotion(motion, 1_100).renderOffsetY).toBeLessThan(-10);
    expect(sampleSourceGridMotion(motion, 1_200).renderOffsetY).toBe(0);

    const surf = createSourceGridMotion({ x: 4, y: 3 }, { x: 4, y: 4 }, "down", 1_000,
      { duration: 200, action: "surf-transition" });
    expect(sampleSourceGridMotion(surf, 1_100).renderOffsetY).toBeLessThan(-10);
    expect(sampleSourceGridMotion(surf, 1_200).renderOffsetY).toBe(0);
  });
});
