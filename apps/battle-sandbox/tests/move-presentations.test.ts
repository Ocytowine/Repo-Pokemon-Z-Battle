import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG } from "@pokemon-z-battle/battle-engine";
import { MOVE_PRESENTATIONS, presentationFor, transformSourcePoint } from "../src/move-presentations.js";

describe("move presentations", () => {
  it("gives every supported move an explicit visual identity", () => {
    expect(Object.keys(MOVE_PRESENTATIONS).sort()).toEqual(Object.keys(MINIMAL_MOVE_CATALOG).sort());
    expect(new Set(Object.values(MOVE_PRESENTATIONS).map((entry) => entry.effect)).size).toBe(6);
  });

  it("provides a generic fallback for future moves", () => {
    expect(presentationFor({ ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "FUTURE_MOVE" })).toMatchObject({ effect: "impact", motion: "lunge" });
  });

  it("reverses the historical user/target animation line", () => {
    expect(transformSourcePoint(128, 224, true)).toEqual({ x: 384, y: 96 });
    expect(transformSourcePoint(384, 96, true)).toEqual({ x: 128, y: 224 });
    expect(transformSourcePoint(200, 150, false)).toEqual({ x: 200, y: 150 });
  });
});
