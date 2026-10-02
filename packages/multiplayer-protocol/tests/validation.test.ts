import { describe, expect, it } from "vitest";
import {
  MAX_CLIENT_MESSAGE_BYTES,
  ProtocolValidationError,
  createNetworkPlayerProfile,
  createDefaultNetworkPlayerProfile,
  normalizeRoomCode,
  parseClientMessage,
  parseNetworkPlayerProfile,
  parseSourceSceneSnapshot,
  parseSourceWorldHostState,
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
      version: 8,
      requestId: "request-7",
      battleId: "battle-1",
      turn: 3,
      action: { kind: "move", moveIndex: 2 },
    };
    expect(parseClientMessage(serializeMessage(message))).toEqual(message);
    expect(() => parseClientMessage(JSON.stringify({ ...message, damage: 999 }))).toThrow("submitAction mal formé");
  });

  it("validates every client message shape strictly", () => {
    expect(parseClientMessage('{"type":"setReady","version":8,"requestId":"r1","ready":true}')).toMatchObject({ type: "setReady", ready: true });
    expect(parseClientMessage('{"type":"requestSnapshot","version":8,"requestId":"r2"}')).toMatchObject({ type: "requestSnapshot" });
    expect(parseClientMessage('{"type":"ping","version":8,"nonce":"n1"}')).toMatchObject({ type: "ping" });
    expect(() => parseClientMessage('{"type":"ping","version":1,"nonce":"n1"}')).toThrow("version de protocole");
    expect(() => parseClientMessage('{"type":"setReady","version":8,"requestId":"r1","ready":1}')).toThrow("setReady mal formé");
    expect(() => parseClientMessage('{"type":"submitAction","version":8,"requestId":"r1","battleId":"b1","turn":1,"action":{"kind":"move","moveIndex":4}}')).toThrow("submitAction mal formé");
  });

  it("accepts team switches and forced replacements", () => {
    expect(parseClientMessage('{"type":"submitAction","version":8,"requestId":"s1","battleId":"b1","turn":1,"action":{"kind":"switch","teamIndex":5}}')).toMatchObject({ action: { kind: "switch", teamIndex: 5 } });
    expect(parseClientMessage('{"type":"submitReplacement","version":8,"requestId":"r1","battleId":"b1","turn":2,"teamIndex":1}')).toMatchObject({ type: "submitReplacement", teamIndex: 1 });
    expect(() => parseClientMessage('{"type":"submitReplacement","version":8,"requestId":"r1","battleId":"b1","turn":2,"teamIndex":6}')).toThrow("submitReplacement mal formé");
  });

  it("accepts only directional overworld intentions with a positive sequence", () => {
    expect(parseClientMessage('{"type":"moveAvatar","version":8,"requestId":"w1","direction":"left","sequence":3}')).toMatchObject({ type: "moveAvatar", direction: "left", sequence: 3 });
    expect(parseClientMessage('{"type":"interact","version":8,"requestId":"i1"}')).toMatchObject({ type: "interact" });
    expect(() => parseClientMessage('{"type":"interact","version":8,"requestId":"i1","interactionId":"secret"}')).toThrow("interact mal formé");
    expect(() => parseClientMessage('{"type":"moveAvatar","version":8,"requestId":"w1","direction":"teleport","sequence":3}')).toThrow("moveAvatar mal formé");
    expect(() => parseClientMessage('{"type":"moveAvatar","version":8,"requestId":"w1","direction":"left","sequence":0}')).toThrow("moveAvatar mal formé");
  });

  it("validates a cosmetic profile update without gameplay data", () => {
    const profile = createNetworkPlayerProfile("legacy-2", { ...createDefaultPlayerProfile(), displayName: "Lina" });
    const message: ClientMessage = { type: "setProfile", version: 8, requestId: "profile-1", profile };
    expect(parseClientMessage(serializeMessage(message))).toEqual(message);
    expect(() => parseClientMessage(JSON.stringify({ ...message, profile: { ...profile, party: [] } })))
      .toThrow("setProfile mal formé");
  });

  it("validates a compact source-world topology and rejects computed avatars", () => {
    const world = { mapId: 3, width: 2, height: 2, passages: "ffff", blockedPoints: [{ x: 1, y: 1 }],
      host: { x: 0, y: 0, direction: "down" }, story: { switches: { "67": true }, variables: { "20": 3 },
        selfSwitches: { "3:7:A": true } } } as const;
    expect(parseSourceWorldHostState(world)).toEqual(world);
    const message: ClientMessage = { type: "setSourceWorld", version: 8, requestId: "source-1", world };
    expect(parseClientMessage(serializeMessage(message))).toEqual(message);
    expect(() => parseClientMessage(JSON.stringify({ ...message, world: { ...world, avatars: {} } })))
      .toThrow("setSourceWorld mal formé");
    expect(() => parseSourceWorldHostState({ ...world, passages: "fff" })).toThrow("Passages");
  });

  it("validates a read-only source scene without accepting arbitrary presentation commands", () => {
    const scene = { mapId: 3, sequenceActive: true,
      dialogue: { label: "Crisanto", text: "Regarde !", choices: [] },
      actors: [{ eventId: 7, x: 12, y: 8, direction: "left" as const, pattern: 1, opacity: 255 }],
      presentation: { id: 1, kind: "screen-tone", data: { tone: { red: 0, green: 0, blue: 0, gray: 255 } } } };
    expect(parseSourceSceneSnapshot(scene)).toEqual(scene);
    const message: ClientMessage = { type: "setSourceScene", version: 8, requestId: "scene-1", scene };
    expect(parseClientMessage(serializeMessage(message))).toEqual(message);
    expect(() => parseSourceSceneSnapshot({ ...scene,
      presentation: { id: 2, kind: "execute-ruby", data: {} } })).toThrow("Commande visuelle");
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
