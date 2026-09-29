import { describe, expect, it } from "vitest";
import { createSourceGridMotion, sampleSourceGridMotion } from "../src/source-grid-motion.js";

describe("source grid motion", () => {
  it("interpolates one logical tile with one alternating walking pose", () => {
    const motion = createSourceGridMotion({ x: 4, y: 3 }, { x: 5, y: 3 }, "right", 1_000,
      { duration: 160, walkingPattern: 3 });
    expect(sampleSourceGridMotion(motion, 1_000)).toEqual({ x: 4, y: 3, direction: "right", pattern: 0, complete: false });
    expect(sampleSourceGridMotion(motion, 1_040)).toEqual({ x: 4.25, y: 3, direction: "right", pattern: 0, complete: false });
    expect(sampleSourceGridMotion(motion, 1_120)).toEqual({ x: 4.75, y: 3, direction: "right", pattern: 3, complete: false });
    expect(sampleSourceGridMotion(motion, 1_160)).toEqual({ x: 5, y: 3, direction: "right", pattern: 0, complete: true });
  });

  it("clamps samples before and after the movement interval", () => {
    const motion = createSourceGridMotion({ x: 2, y: 7 }, { x: 2, y: 6 }, "up", 500, { duration: 100 });
    expect(sampleSourceGridMotion(motion, 450)).toMatchObject({ x: 2, y: 7, complete: false });
    expect(sampleSourceGridMotion(motion, 700)).toMatchObject({ x: 2, y: 6, pattern: 0, complete: true });
  });

  it("rejects an invalid duration", () => {
    expect(() => createSourceGridMotion({ x: 0, y: 0 }, { x: 1, y: 0 }, "right", 0, { duration: 0 })).toThrow("timing");
  });
});
