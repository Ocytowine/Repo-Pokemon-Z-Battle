import { describe, expect, it } from "vitest";
import { sourceAspectFrameSize } from "../src/source-aspect-frame.js";

describe("sourceAspectFrameSize", () => {
  it("fits a regional map by height in a wide Android menu", () => {
    expect(sourceAspectFrameSize(700, 250, 3 / 2)).toEqual({ width: 375, height: 250 });
  });

  it("fits a regional map by width when the available area is narrow", () => {
    expect(sourceAspectFrameSize(250, 400, 3 / 2)).toEqual({ width: 250, height: 250 / 1.5 });
  });

  it("does not apply a stale zero-sized measurement", () => {
    expect(sourceAspectFrameSize(0, 250, 3 / 2)).toEqual({ width: 0, height: 0 });
  });
});
