import { describe, expect, it } from "vitest";
import { buildWebSocketUrl, parseStoredSession, parseTicket, reconnectDelay } from "../src/multiplayer-client.js";

const ticket = {
  protocolVersion: 15,
  roomCode: "ABC234",
  playerId: "player-1",
  side: "player",
  reconnectToken: "a".repeat(64),
  websocketPath: "/api/rooms/ABC234/socket",
} as const;

describe("overworld multiplayer client", () => {
  it("validates and restores a stored room ticket", () => {
    expect(parseTicket(ticket)).toEqual(ticket);
    expect(parseStoredSession(JSON.stringify({ serverUrl: "http://127.0.0.1:8787/", ticket }))).toEqual({
      serverUrl: "http://127.0.0.1:8787",
      ticket,
    });
    expect(buildWebSocketUrl("https://world.example", ticket)).toContain("wss://world.example/api/rooms/ABC234/socket");
  });

  it("rejects corrupted sessions and uses a bounded exponential retry", () => {
    expect(() => parseStoredSession("not-json")).toThrow("illisible");
    expect(() => parseTicket({ ...ticket, reconnectToken: "secret" })).toThrow("invalide");
    expect([0, 1, 2, 3, 8].map(reconnectDelay)).toEqual([500, 1_000, 2_000, 4_000, 8_000]);
  });
});
