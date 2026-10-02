import { describe, expect, it } from "vitest";
import { resolveSourceMovement, type SourceWorldHostState } from "../src/index.js";

function world(terrain = "000000000"): SourceWorldHostState {
  return { mapId: 1, width: 3, height: 3, passages: "fffffffff", terrain, blockedPoints: [],
    host: { x: 1, y: 1, direction: "down" }, follower: null,
    story: { switches: {}, variables: {}, selfSwitches: {} } };
}

describe("shared source movement resolver", () => {
  it("uses the same result shape for running and mounted movement", () => {
    expect(resolveSourceMovement(world(), { x: 1, y: 1, direction: "down" },
      { direction: "right", mode: "run" })).toEqual({ moved: true,
      avatar: { x: 2, y: 1, direction: "right", mode: "run", action: "step" } });
    expect(resolveSourceMovement(world("0000000a0"), { x: 1, y: 1, direction: "down", mode: "mount" },
      { direction: "down", mode: "mount" }).moved).toBe(false);
  });

  it("jumps ledges and enters water through explicit intents", () => {
    expect(resolveSourceMovement(world("000010000"), { x: 1, y: 0, direction: "down" },
      { direction: "down" })).toEqual({ moved: true,
      avatar: { x: 1, y: 2, direction: "down", mode: "walk", action: "ledge-jump" } });
    expect(resolveSourceMovement(world("000000070"), { x: 1, y: 1, direction: "down" },
      { direction: "down", mode: "surf" })).toEqual({ moved: true,
      avatar: { x: 1, y: 2, direction: "down", mode: "surf", action: "surf-transition" } });
  });

  it("respects occupied cells for solo and cooperative callers", () => {
    expect(resolveSourceMovement(world(), { x: 1, y: 1, direction: "down" }, { direction: "right" },
      [{ x: 2, y: 1 }]).moved).toBe(false);
  });
});
