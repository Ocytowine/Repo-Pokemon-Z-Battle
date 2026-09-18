import { describe, expect, it } from "vitest";
import { buildWebSocketUrl, normalizeServerUrl, parseMultiplayerTicket, parseServerMessage } from "../src/multiplayer-client.js";

const ticket = {
  protocolVersion: 6,
  roomCode: "ABC234",
  playerId: "player-1",
  side: "player",
  reconnectToken: "a".repeat(64),
  websocketPath: "/api/rooms/ABC234/socket",
} as const;

describe("multiplayer browser client", () => {
  it("validates tickets and builds authenticated websocket URLs", () => {
    expect(parseMultiplayerTicket(ticket)).toEqual(ticket);
    expect(buildWebSocketUrl("http://127.0.0.1:8787/", ticket)).toBe(
      `ws://127.0.0.1:8787/api/rooms/ABC234/socket?playerId=player-1&token=${"a".repeat(64)}`,
    );
    expect(buildWebSocketUrl("https://battle.example", ticket)).toMatch(/^wss:\/\/battle\.example/u);
  });

  it("rejects unsafe endpoints, invalid tickets and incompatible messages", () => {
    expect(normalizeServerUrl(" http://127.0.0.1:8787/// ")).toBe("http://127.0.0.1:8787");
    expect(() => normalizeServerUrl("ftp://example.test")).toThrow("HTTP ou HTTPS");
    expect(() => parseMultiplayerTicket({ ...ticket, reconnectToken: "secret" })).toThrow("Ticket multijoueur invalide");
    expect(() => parseServerMessage('{"type":"snapshot","version":4}')).toThrow("incompatible");
  });
});
