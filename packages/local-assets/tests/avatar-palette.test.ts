import { describe, expect, it } from "vitest";
import { recolorAvatarPixels } from "../src/index.js";

describe("avatar semantic palette", () => {
  it("recolors stable outfit colors while protecting pixels that vary with identity", () => {
    const base = new Uint8ClampedArray([22, 52, 93, 255, 199, 72, 72, 255, 130, 90, 60, 255]);
    const light = new Uint8ClampedArray([22, 52, 93, 255, 199, 72, 72, 255, 220, 180, 130, 255]);
    const dark = new Uint8ClampedArray([22, 52, 93, 255, 199, 72, 72, 255, 70, 45, 35, 255]);
    const result = recolorAvatarPixels(base, [light, dark], { primary: "green", secondary: "purple", accent: "blue" });
    expect([...result.slice(0, 3)]).not.toEqual([...base.slice(0, 3)]);
    expect([...result.slice(4, 7)]).not.toEqual([...base.slice(4, 7)]);
    expect([...result.slice(8, 12)]).toEqual([...base.slice(8, 12)]);
  });

  it("keeps the source untouched when no identity comparison is available", () => {
    const base = new Uint8ClampedArray([22, 52, 93, 255]);
    expect(recolorAvatarPixels(base, [], { primary: "green", secondary: "purple", accent: "blue" })).toEqual(base);
  });

  it("preserves outlines and highlight contrast when an outfit role becomes white", () => {
    const base = new Uint8ClampedArray([8, 20, 38, 255, 70, 110, 165, 255]);
    const result = recolorAvatarPixels(base, [new Uint8ClampedArray(base)],
      { primary: "white", secondary: "white", accent: "white" });
    expect(result[0]).toBeLessThan(150);
    expect(result[4]).toBeGreaterThan(230);
    expect(result[4]! - result[0]!).toBeGreaterThan(80);
    expect(Math.max(result[0]!, result[1]!, result[2]!) - Math.min(result[0]!, result[1]!, result[2]!)).toBeLessThan(35);
  });
});
