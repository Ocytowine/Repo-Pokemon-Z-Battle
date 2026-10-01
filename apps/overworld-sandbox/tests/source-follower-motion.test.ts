import { describe, expect, it } from "vitest";
import type { ImportedMap } from "../src/imported-map.js";
import { SourceFollowerMotionController } from "../src/source-follower-motion.js";

const map: ImportedMap = { id: 3, name: "Test", width: 5, height: 5, tilesetId: 1,
  layers: { lower: Array(25).fill(384), middle: Array(25).fill(0), upper: Array(25).fill(0) },
  collision: { masks: Array(25).fill(15) }, transfers: [] };

describe("source follower motion", () => {
  it("places the follower behind the player and interpolates toward the vacated tile", () => {
    const follower = new SourceFollowerMotionController();
    follower.synchronize(true, map, { x: 2, y: 2, direction: "right" });
    expect(follower.pose(0)).toMatchObject({ x: 1, y: 2, direction: "right", pattern: 0 });
    follower.followPlayerStep({ x: 2, y: 2, direction: "right" }, { x: 3, y: 2, direction: "right" }, 100);
    expect(follower.pose(100)).toMatchObject({ x: 1, y: 2, direction: "right" });
    expect(follower.pose(162.5)).toMatchObject({ x: 1.5, y: 2, pattern: 1 });
    expect(follower.pose(225)).toMatchObject({ x: 2, y: 2, pattern: 0, complete: true });
  });

  it("uses another adjacent passable tile at a map edge", () => {
    const follower = new SourceFollowerMotionController();
    follower.reset(map, { x: 0, y: 2, direction: "right" });
    expect(follower.pose(0)).toMatchObject({ x: 0, y: 1 });
  });

  it("clears and recreates its transient position when disabled or changing map", () => {
    const follower = new SourceFollowerMotionController();
    follower.synchronize(true, map, { x: 2, y: 2, direction: "down" });
    follower.synchronize(false, map, { x: 2, y: 2, direction: "down" });
    expect(follower.pose(0)).toBeNull();
    follower.synchronize(true, { ...map, id: 7 }, { x: 3, y: 3, direction: "up" });
    expect(follower.pose(0)).toMatchObject({ x: 3, y: 4, direction: "up" });
  });
});
