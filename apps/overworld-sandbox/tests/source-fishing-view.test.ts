import { describe, expect, it } from "vitest";
import { sourceFishingVisualPattern } from "../src/source-fishing-view.js";

describe("source fishing presentation", () => {
  it("reads the source charset from frame 3 to frame 0 and holds the fishing pose", () => {
    expect([0, 50, 100, 150, 300].map((time) => sourceFishingVisualPattern(time))).toEqual([3, 2, 1, 0, 0]);
    expect([0, 50, 100, 150, 300].map((time) => sourceFishingVisualPattern(time, true))).toEqual([0, 1, 2, 3, 3]);
  });
});
