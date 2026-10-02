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

  it("keeps regular Surf movement separate from embark and disembark jumps", () => {
    expect(resolveSourceMovement(world("000070070"),
      { x: 1, y: 1, direction: "down", mode: "surf" },
      { direction: "down", mode: "surf" })).toEqual({ moved: true,
      avatar: { x: 1, y: 2, direction: "down", mode: "surf", action: "step" } });
  });

  it("leaves Surf by validating the shore instead of the water-tile exit mask", () => {
    const shore = { ...world("000070000"), passages: "ffff0ff8f" };
    expect(resolveSourceMovement(shore,
      { x: 1, y: 1, direction: "down", mode: "surf" },
      { direction: "down", mode: "surf" })).toEqual({ moved: true,
      avatar: { x: 1, y: 2, direction: "down", mode: "walk", action: "surf-transition" } });
  });

  it("uses the source-facing passage for ledges without requiring an outgoing ledge passage", () => {
    const oneWayLedge = { ...world("000010000"), passages: "0100800f0" };
    expect(resolveSourceMovement(oneWayLedge, { x: 1, y: 0, direction: "down" },
      { direction: "down" })).toMatchObject({ moved: true,
      avatar: { x: 1, y: 2, action: "ledge-jump" } });
    expect(resolveSourceMovement({ ...oneWayLedge, passages: "0200800f0" },
      { x: 1, y: 0, direction: "down" }, { direction: "down" }).moved).toBe(false);
  });

  it("respects occupied cells for solo and cooperative callers", () => {
    expect(resolveSourceMovement(world(), { x: 1, y: 1, direction: "down" }, { direction: "right" },
      [{ x: 2, y: 1 }]).moved).toBe(false);
  });
});
