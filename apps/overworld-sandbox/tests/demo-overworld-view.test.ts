import { describe, expect, it } from "vitest";
import { demoEventText } from "../src/demo-overworld-view.js";

describe("demo overworld view", () => {
  it("formats demo events outside the application orchestrator", () => {
    expect(demoEventText({ type: "avatarMoved", playerId: "player", mapId: "meadow",
      from: { x: 1, y: 2 }, to: { x: 2, y: 2 } })).toBe("player avance vers 2,2");
    expect(demoEventText({ type: "itemGranted", playerId: "opponent", interactionId: "berry",
      itemId: "ORAN_BERRY", quantity: 2, policy: "PERSONAL" })).toBe("opponent reçoit 2 × ORAN_BERRY");
  });
});
