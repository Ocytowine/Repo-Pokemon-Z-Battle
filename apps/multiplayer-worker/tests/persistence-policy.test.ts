import type { ClientMessage } from "@pokemon-z-battle/multiplayer-protocol";
import { describe, expect, it } from "vitest";
import { ROOM_CHECKPOINT_IDLE_MS, ROOM_CHECKPOINT_MAX_MS, roomCheckpointDelay,
  roomPersistenceMode } from "../src/persistence-policy.js";

function message(type: ClientMessage["type"]): ClientMessage {
  return { type, version: 15 } as ClientMessage;
}

describe("room persistence policy", () => {
  it("does not persist pure transport or presentation messages", () => {
    expect(roomPersistenceMode(message("ping"))).toBe("none");
    expect(roomPersistenceMode(message("requestSnapshot"))).toBe("none");
    expect(roomPersistenceMode(message("emitSourceSound"))).toBe("none");
  });

  it("checkpoints recoverable realtime positions", () => {
    expect(roomPersistenceMode(message("moveAvatar"))).toBe("checkpoint");
    expect(roomPersistenceMode(message("setSourceActors"))).toBe("checkpoint");
  });

  it("keeps gameplay and narrative mutations write-through", () => {
    for (const type of ["setSourceWorld", "setSourceScene", "interact", "openSourceBattle",
      "submitAction", "submitReplacement", "ackBattleSettlement", "leaveRoom"] as const) {
      expect(roomPersistenceMode(message(type))).toBe("immediate");
    }
  });

  it("debounces short bursts without postponing a continuous checkpoint forever", () => {
    expect(roomCheckpointDelay(10_000, 10_050)).toBe(ROOM_CHECKPOINT_IDLE_MS);
    expect(roomCheckpointDelay(10_000, 10_000 + ROOM_CHECKPOINT_MAX_MS - 400)).toBe(400);
    expect(roomCheckpointDelay(10_000, 10_000 + ROOM_CHECKPOINT_MAX_MS)).toBe(0);
  });
});
