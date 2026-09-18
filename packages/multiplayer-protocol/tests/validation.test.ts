import { describe, expect, it } from "vitest";
import {
  MAX_CLIENT_MESSAGE_BYTES,
  ProtocolValidationError,
  normalizeRoomCode,
  parseClientMessage,
  serializeMessage,
  type ClientMessage,
} from "../src/index.js";

describe("multiplayer protocol", () => {
  it("round-trips a move intent without accepting a computed result", () => {
    const message: ClientMessage = {
      type: "submitAction",
      version: 1,
      requestId: "request-7",
      battleId: "battle-1",
      turn: 3,
      action: { kind: "move", moveIndex: 2 },
    };
    expect(parseClientMessage(serializeMessage(message))).toEqual(message);
    expect(() => parseClientMessage(JSON.stringify({ ...message, damage: 999 }))).toThrow("submitAction mal formé");
  });

  it("validates every client message shape strictly", () => {
    expect(parseClientMessage('{"type":"setReady","version":1,"requestId":"r1","ready":true}')).toMatchObject({ type: "setReady", ready: true });
    expect(parseClientMessage('{"type":"requestSnapshot","version":1,"requestId":"r2"}')).toMatchObject({ type: "requestSnapshot" });
    expect(parseClientMessage('{"type":"ping","version":1,"nonce":"n1"}')).toMatchObject({ type: "ping" });
    expect(() => parseClientMessage('{"type":"ping","version":2,"nonce":"n1"}')).toThrow("version de protocole");
    expect(() => parseClientMessage('{"type":"setReady","version":1,"requestId":"r1","ready":1}')).toThrow("setReady mal formé");
    expect(() => parseClientMessage('{"type":"submitAction","version":1,"requestId":"r1","battleId":"b1","turn":1,"action":{"kind":"move","moveIndex":4}}')).toThrow("submitAction mal formé");
  });

  it("rejects malformed and oversized payloads", () => {
    expect(() => parseClientMessage("not-json")).toThrow(ProtocolValidationError);
    expect(() => parseClientMessage("x".repeat(MAX_CLIENT_MESSAGE_BYTES + 1))).toThrow("taille maximale");
  });

  it("normalizes human-entered room codes", () => {
    expect(normalizeRoomCode(" abcd29 ")).toBe("ABCD29");
    expect(() => normalizeRoomCode("ABC10I")).toThrow("Code de room invalide");
  });
});
