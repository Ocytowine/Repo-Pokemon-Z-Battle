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
import { MINIMAL_MOVE_CATALOG } from "@pokemon-z-battle/battle-engine";

const duelTeam = { activeIndex: 0, members: [{ id: "p1", species: "EEVEE", name: "Eevee", level: 10,
  types: ["NORMAL"], stats: { maxHp: 30, attack: 20, defense: 20, specialAttack: 20, specialDefense: 20, speed: 20 },
  stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
  hp: 30, majorStatus: null, ability: null, heldItem: null,
  moves: [{ move: MINIMAL_MOVE_CATALOG.TACKLE, pp: MINIMAL_MOVE_CATALOG.TACKLE.pp }] }] };

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
      version: 12,
      requestId: "request-7",
      battleId: "battle-1",
      turn: 3,
      action: { kind: "move", moveIndex: 2 },
    };
    expect(parseClientMessage(serializeMessage(message))).toEqual(message);
    expect(() => parseClientMessage(JSON.stringify({ ...message, damage: 999 }))).toThrow("submitAction mal formé");
  });

  it("validates every client message shape strictly", () => {
    expect(parseClientMessage('{"type":"setReady","version":12,"requestId":"r1","ready":true}')).toMatchObject({ type: "setReady", ready: true });
    expect(parseClientMessage('{"type":"requestSnapshot","version":12,"requestId":"r2"}')).toMatchObject({ type: "requestSnapshot" });
    expect(parseClientMessage('{"type":"ping","version":12,"nonce":"n1"}')).toMatchObject({ type: "ping" });
    expect(parseClientMessage('{"type":"ackBattleSettlement","version":12,"requestId":"r3","settlementId":"battle-1-player"}'))
      .toMatchObject({ type: "ackBattleSettlement", settlementId: "battle-1-player" });
    expect(parseClientMessage('{"type":"closeSourceBattle","version":12,"requestId":"r4","battleId":"battle-1"}'))
      .toMatchObject({ type: "closeSourceBattle", battleId: "battle-1" });
    expect(() => parseClientMessage('{"type":"ping","version":1,"nonce":"n1"}')).toThrow("version de protocole");
    expect(() => parseClientMessage('{"type":"setReady","version":12,"requestId":"r1","ready":1}')).toThrow("setReady mal formé");
    expect(() => parseClientMessage('{"type":"submitAction","version":12,"requestId":"r1","battleId":"b1","turn":1,"action":{"kind":"move","moveIndex":4}}')).toThrow("submitAction mal formé");
    expect(() => parseClientMessage('{"type":"ackBattleSettlement","version":12,"requestId":"r3","settlementId":"bad id"}'))
      .toThrow("ackBattleSettlement mal forme");
  });

  it("accepts team switches and forced replacements", () => {
    expect(parseClientMessage('{"type":"submitAction","version":12,"requestId":"d1","battleId":"b1","turn":1,"activeSlot":1,"action":{"kind":"move","moveIndex":0,"target":{"side":"opponent","slot":1}}}'))
      .toMatchObject({ activeSlot: 1, action: { target: { side: "opponent", slot: 1 } } });
    expect(parseClientMessage('{"type":"submitAction","version":12,"requestId":"s1","battleId":"b1","turn":1,"action":{"kind":"switch","teamIndex":5}}')).toMatchObject({ action: { kind: "switch", teamIndex: 5 } });
    expect(parseClientMessage('{"type":"submitReplacement","version":12,"requestId":"r1","battleId":"b1","turn":2,"teamIndex":1}')).toMatchObject({ type: "submitReplacement", teamIndex: 1 });
    expect(() => parseClientMessage('{"type":"submitReplacement","version":12,"requestId":"r1","battleId":"b1","turn":2,"teamIndex":6}')).toThrow("submitReplacement mal formé");
    expect(parseClientMessage('{"type":"attemptBattleEscape","version":12,"requestId":"e1","battleId":"b1","turn":2}'))
      .toMatchObject({ type: "attemptBattleEscape", battleId: "b1", turn: 2 });
    expect(() => parseClientMessage('{"type":"attemptBattleEscape","version":12,"requestId":"e1","battleId":"b1","turn":0}'))
      .toThrow("attemptBattleEscape mal formé");
  });

  it("accepts only directional overworld intentions with a positive sequence", () => {
    expect(parseClientMessage('{"type":"moveAvatar","version":12,"requestId":"w1","direction":"left","sequence":3}')).toMatchObject({ type: "moveAvatar", direction: "left", sequence: 3 });
    expect(parseClientMessage('{"type":"interact","version":12,"requestId":"i1"}')).toMatchObject({ type: "interact" });
    expect(() => parseClientMessage('{"type":"interact","version":12,"requestId":"i1","interactionId":"secret"}')).toThrow("interact mal formé");
    expect(() => parseClientMessage('{"type":"moveAvatar","version":12,"requestId":"w1","direction":"teleport","sequence":3}')).toThrow("moveAvatar mal formé");
    expect(() => parseClientMessage('{"type":"moveAvatar","version":12,"requestId":"w1","direction":"left","sequence":0}')).toThrow("moveAvatar mal formé");
    expect(parseClientMessage('{"type":"setSourceFollower","version":12,"requestId":"f1","species":"FENNEKIN"}'))
      .toMatchObject({ type: "setSourceFollower", species: "FENNEKIN" });
    expect(parseClientMessage('{"type":"setSourceFollower","version":12,"requestId":"f2","species":"FENNEKIN","appearance":{"form":1,"shiny":true,"gender":"female"}}'))
      .toMatchObject({ type: "setSourceFollower", appearance: { form: 1, shiny: true, gender: "female" } });
    expect(() => parseClientMessage('{"type":"setSourceFollower","version":12,"requestId":"f1","species":"../secret"}'))
      .toThrow("setSourceFollower mal formé");
    expect(() => parseClientMessage('{"type":"setSourceFollower","version":12,"requestId":"f3","species":"FENNEKIN","appearance":{"form":0,"shiny":false,"gender":"male","trainerId":42}}'))
      .toThrow("setSourceFollower mal formé");
  });

  it("validates player challenges and never accepts a fainted active Pokémon", () => {
    const challenge = { type: "challengePlayer", version: 12, requestId: "duel-1", team: duelTeam };
    expect(parseClientMessage(JSON.stringify(challenge))).toMatchObject({ type: "challengePlayer", team: { activeIndex: 0 } });
    expect(parseClientMessage(JSON.stringify({ type: "respondPlayerChallenge", version: 12,
      requestId: "duel-2", accept: true, team: duelTeam }))).toMatchObject({ type: "respondPlayerChallenge", accept: true });
    expect(() => parseClientMessage(JSON.stringify({ ...challenge,
      team: { ...duelTeam, members: [{ ...duelTeam.members[0], hp: 0 }] } }))).toThrow("challengePlayer mal forme");
  });

  it("validates battle join proposals and responses", () => {
    expect(parseClientMessage(JSON.stringify({ type: "proposeBattleJoin", version: 12, requestId: "join-1",
      battleId: "battle-1", side: "opponent", team: duelTeam, finalMemberIds: ["p1"] })))
      .toMatchObject({ type: "proposeBattleJoin", side: "opponent" });
    expect(parseClientMessage(JSON.stringify({ type: "respondBattleJoin", version: 12, requestId: "join-2",
      battleId: "battle-1", accept: true }))).toMatchObject({ type: "respondBattleJoin", accept: true });
    expect(parseClientMessage(JSON.stringify({ type: "observeBattle", version: 12, requestId: "join-3",
      battleId: "battle-1" }))).toMatchObject({ type: "observeBattle", battleId: "battle-1" });
    expect(parseClientMessage(JSON.stringify({ type: "closeBattleJoinWindow", version: 12, requestId: "join-4",
      battleId: "battle-1" }))).toMatchObject({ type: "closeBattleJoinWindow", battleId: "battle-1" });
  });

  it("validates a bounded source battle opening without private save data", () => {
    const context = { origin: "source-wild", mapId: 3, format: "single", escapable: true,
      narrativeOwnerId: "host-1", presentation: { battlebackId: "forest",
        battleMusicId: "Battle wild", victoryMusicId: "Victory", opponentTrainer: null, defeatText: null },
      rewards: { opponents: [{ memberId: "p1", species: "EEVEE", level: 10, baseExperience: 65 }],
        trainerBaseMoney: null, experience: { levelCap: 17, experienceDisabled: false,
          boostTenPercent: false, boostTwentyPercent: false } }, continuation: "pending-encounter" } as const;
    const message: ClientMessage = { type: "openSourceBattle", version: 12, requestId: "source-battle-1",
      context, playerTeam: duelTeam, opponentTeam: duelTeam };
    expect(parseClientMessage(serializeMessage(message))).toEqual(message);
    const trainerMessage: ClientMessage = { ...message, context: { ...context, origin: "source-trainer",
      escapable: false, continuation: "trainer-sequence", presentation: { ...context.presentation,
        opponentTrainer: { id: 6, name: "Jean" }, defeatText: "Je dois encore m'entraîner !" },
      rewards: { ...context.rewards, trainerBaseMoney: 30 } } };
    expect(parseClientMessage(serializeMessage(trainerMessage))).toEqual(trainerMessage);
    expect(() => parseClientMessage(JSON.stringify({ ...message,
      context: { ...context, presentation: { ...context.presentation, battlebackId: "../secret" } } })))
      .toThrow("openSourceBattle mal forme");
    expect(() => parseClientMessage(JSON.stringify({ ...trainerMessage,
      context: { ...trainerMessage.context, presentation: { ...trainerMessage.context.presentation,
        defeatText: "x".repeat(501) } } }))).toThrow("openSourceBattle mal forme");
    expect(() => parseClientMessage(JSON.stringify({ ...message, privateParty: [] })))
      .toThrow("openSourceBattle mal forme");
  });

  it("validates source-map presence changes", () => {
    expect(parseClientMessage('{"type":"setSourcePresence","version":12,"requestId":"p1","attached":false,"avatar":null}'))
      .toMatchObject({ type: "setSourcePresence", attached: false });
    expect(parseClientMessage('{"type":"setSourcePresence","version":12,"requestId":"p2","attached":true,"avatar":{"x":1,"y":2,"direction":"up"}}'))
      .toMatchObject({ type: "setSourcePresence", attached: true, avatar: { x: 1, y: 2 } });
    expect(parseClientMessage('{"type":"setSourcePresence","version":12,"requestId":"p2b","attached":true,"avatar":{"x":1,"y":2,"direction":"up","mode":"surf","action":"step"}}'))
      .toMatchObject({ type: "setSourcePresence", avatar: { mode: "surf", action: "step" } });
    expect(() => parseClientMessage('{"type":"setSourcePresence","version":12,"requestId":"p2c","attached":true,"avatar":{"x":1,"y":2,"direction":"up","pattern":1}}'))
      .toThrow("setSourcePresence mal forme");
    expect(() => parseClientMessage('{"type":"setSourcePresence","version":12,"requestId":"p3","attached":true,"avatar":null}'))
      .toThrow("setSourcePresence mal forme");
  });

  it("accepts an explicit room departure without client-owned state", () => {
    expect(parseClientMessage(JSON.stringify({ type: "leaveRoom", version: 12,
      requestId: "leave-1" }))).toMatchObject({ type: "leaveRoom", requestId: "leave-1" });
    expect(() => parseClientMessage(JSON.stringify({ type: "leaveRoom", version: 12,
      requestId: "leave-2", side: "opponent" }))).toThrow("leaveRoom mal formé");
  });

  it("validates a cosmetic profile update without gameplay data", () => {
    const profile = createNetworkPlayerProfile("legacy-2", { ...createDefaultPlayerProfile(), displayName: "Lina" });
    const message: ClientMessage = { type: "setProfile", version: 12, requestId: "profile-1", profile };
    expect(parseClientMessage(serializeMessage(message))).toEqual(message);
    expect(() => parseClientMessage(JSON.stringify({ ...message, profile: { ...profile, party: [] } })))
      .toThrow("setProfile mal formé");
  });

  it("validates a compact source-world topology and rejects computed avatars", () => {
    const world = { mapId: 3, width: 2, height: 2, passages: "ffff", blockedPoints: [{ x: 1, y: 1 }],
      host: { x: 0, y: 0, direction: "down" },
      follower: { species: "FENNEKIN", x: 0, y: 1, direction: "up" },
      story: { switches: { "67": true }, variables: { "20": 3 },
        selfSwitches: { "3:7:A": true } } } as const;
    expect(parseSourceWorldHostState(world)).toEqual(world);
    expect(parseSourceWorldHostState({ ...world,
      follower: { ...world.follower, mode: "run", action: "step" } })).toMatchObject({
      follower: { species: "FENNEKIN", mode: "run", action: "step" },
    });
    const message: ClientMessage = { type: "setSourceWorld", version: 12, requestId: "source-1", world,
      relocateHost: false };
    expect(parseClientMessage(serializeMessage(message))).toEqual(message);
    expect(() => parseClientMessage(JSON.stringify({ ...message, world: { ...world, avatars: {} } })))
      .toThrow("setSourceWorld mal formé");
    expect(() => parseSourceWorldHostState({ ...world, passages: "fff" })).toThrow("Passages");
  });

  it("validates bounded source actors and rejects duplicate or client-computed fields", () => {
    const actors = [{ eventId: 7, x: 1, y: 2, direction: "left" as const, blocking: true,
      moveSpeed: 3, action: "step" as const }];
    const message: ClientMessage = { type: "setSourceActors", version: 12, requestId: "actors-1",
      mapId: 3, actors };
    expect(parseClientMessage(serializeMessage(message))).toEqual(message);
    expect(() => parseClientMessage(JSON.stringify({ ...message, actors: [...actors, actors[0]] })))
      .toThrow("setSourceActors mal forme");
    expect(() => parseClientMessage(JSON.stringify({ ...message,
      actors: [{ ...actors[0], action: "teleport" }] }))).toThrow("setSourceActors mal forme");
    expect(() => parseClientMessage(JSON.stringify({ ...message, actorRevision: 99 })))
      .toThrow("setSourceActors mal forme");
  });

  it("validates a read-only source scene without accepting arbitrary presentation commands", () => {
    const scene = { mapId: 3, sequenceActive: true,
      dialogue: { label: "Crisanto", text: "Regarde !", choices: [] },
      actors: [{ eventId: 7, x: 12, y: 8, direction: "left" as const, pattern: 1, opacity: 255 }],
      presentation: { id: 1, kind: "screen-tone", data: { tone: { red: 0, green: 0, blue: 0, gray: 255 } } } };
    expect(parseSourceSceneSnapshot(scene)).toEqual(scene);
    const message: ClientMessage = { type: "setSourceScene", version: 12, requestId: "scene-1", scene };
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
