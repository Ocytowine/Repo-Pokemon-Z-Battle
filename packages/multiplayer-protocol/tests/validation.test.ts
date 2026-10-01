import { describe, expect, it } from "vitest";
import {
  MAX_CLIENT_MESSAGE_BYTES,
  ProtocolValidationError,
  createNetworkPlayerProfile,
  createDefaultNetworkPlayerProfile,
  normalizeRoomCode,
  parseClientMessage,
  parseNetworkPlayerProfile,
  serializeMessage,
  type ClientMessage,
} from "../src/index.js";
import { createDefaultPlayerProfile } from "@pokemon-z-battle/player-state";

describe("multiplayer protocol", () => {
  it("defines a strict public cosmetic profile without gameplay state", () => {
    const networkProfile = createNetworkPlayerProfile("legacy-4", {
      ...createDefaultPlayerProfile(), displayName: "Ariane", pronouns: "feminine",
    });
    expect(parseNetworkPlayerProfile(networkProfile)).toEqual(networkProfile);
    expect(networkProfile).not.toHaveProperty("party");
    expect(networkProfile).not.toHaveProperty("story");
    expect(() => parseNetworkPlayerProfile({ ...networkProfile, party: { members: [] } })).toThrow("Profil réseau");
    expect(() => parseNetworkPlayerProfile({ ...networkProfile, visualPreset: "../../trainer" })).toThrow("Profil réseau");
    expect(() => parseNetworkPlayerProfile({ ...networkProfile,
      profile: { ...networkProfile.profile, money: 999_999 } })).toThrow("Profil réseau");
    expect(createDefaultNetworkPlayerProfile().visualPreset).toBe("legacy-0");
  });

  it("round-trips a move intent without accepting a computed result", () => {
    const message: ClientMessage = {
      type: "submitAction",
      version: 7,
      requestId: "request-7",
      battleId: "battle-1",
      turn: 3,
      action: { kind: "move", moveIndex: 2 },
    };
    expect(parseClientMessage(serializeMessage(message))).toEqual(message);
    expect(() => parseClientMessage(JSON.stringify({ ...message, damage: 999 }))).toThrow("submitAction mal formé");
  });

  it("validates every client message shape strictly", () => {
    expect(parseClientMessage('{"type":"setReady","version":7,"requestId":"r1","ready":true}')).toMatchObject({ type: "setReady", ready: true });
    expect(parseClientMessage('{"type":"requestSnapshot","version":7,"requestId":"r2"}')).toMatchObject({ type: "requestSnapshot" });
    expect(parseClientMessage('{"type":"ping","version":7,"nonce":"n1"}')).toMatchObject({ type: "ping" });
    expect(() => parseClientMessage('{"type":"ping","version":1,"nonce":"n1"}')).toThrow("version de protocole");
    expect(() => parseClientMessage('{"type":"setReady","version":7,"requestId":"r1","ready":1}')).toThrow("setReady mal formé");
    expect(() => parseClientMessage('{"type":"submitAction","version":7,"requestId":"r1","battleId":"b1","turn":1,"action":{"kind":"move","moveIndex":4}}')).toThrow("submitAction mal formé");
  });

  it("accepts team switches and forced replacements", () => {
    expect(parseClientMessage('{"type":"submitAction","version":7,"requestId":"s1","battleId":"b1","turn":1,"action":{"kind":"switch","teamIndex":5}}')).toMatchObject({ action: { kind: "switch", teamIndex: 5 } });
    expect(parseClientMessage('{"type":"submitReplacement","version":7,"requestId":"r1","battleId":"b1","turn":2,"teamIndex":1}')).toMatchObject({ type: "submitReplacement", teamIndex: 1 });
    expect(() => parseClientMessage('{"type":"submitReplacement","version":7,"requestId":"r1","battleId":"b1","turn":2,"teamIndex":6}')).toThrow("submitReplacement mal formé");
  });

  it("accepts only directional overworld intentions with a positive sequence", () => {
    expect(parseClientMessage('{"type":"moveAvatar","version":7,"requestId":"w1","direction":"left","sequence":3}')).toMatchObject({ type: "moveAvatar", direction: "left", sequence: 3 });
    expect(parseClientMessage('{"type":"interact","version":7,"requestId":"i1"}')).toMatchObject({ type: "interact" });
    expect(() => parseClientMessage('{"type":"interact","version":7,"requestId":"i1","interactionId":"secret"}')).toThrow("interact mal formé");
    expect(() => parseClientMessage('{"type":"moveAvatar","version":7,"requestId":"w1","direction":"teleport","sequence":3}')).toThrow("moveAvatar mal formé");
    expect(() => parseClientMessage('{"type":"moveAvatar","version":7,"requestId":"w1","direction":"left","sequence":0}')).toThrow("moveAvatar mal formé");
  });

  it("validates a cosmetic profile update without gameplay data", () => {
    const profile = createNetworkPlayerProfile("legacy-2", { ...createDefaultPlayerProfile(), displayName: "Lina" });
    const message: ClientMessage = { type: "setProfile", version: 7, requestId: "profile-1", profile };
    expect(parseClientMessage(serializeMessage(message))).toEqual(message);
    expect(() => parseClientMessage(JSON.stringify({ ...message, profile: { ...profile, party: [] } })))
      .toThrow("setProfile mal formé");
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
