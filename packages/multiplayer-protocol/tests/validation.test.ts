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
import { MINIMAL_MOVE_CATALOG, SUPPORTED_HELD_ITEMS } from "@pokemon-z-battle/battle-engine";

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
      version: 15,
      requestId: "request-7",
      battleId: "battle-1",
      turn: 3,
      action: { kind: "move", moveIndex: 2 },
    };
    expect(parseClientMessage(serializeMessage(message))).toEqual(message);
    expect(() => parseClientMessage(JSON.stringify({ ...message, damage: 999 }))).toThrow("submitAction mal formé");
  });

  it("transports only an explicit Mega Evolution intent with a move", () => {
    const message: ClientMessage = { type: "submitAction", version: 15, requestId: "mega-1",
      battleId: "battle-1", turn: 3, action: { kind: "move", moveIndex: 1, megaEvolution: true } };
    expect(parseClientMessage(serializeMessage(message))).toEqual(message);
    expect(() => parseClientMessage(JSON.stringify({ ...message,
      action: { kind: "move", moveIndex: 1, megaEvolution: false } }))).toThrow("submitAction mal formé");
  });

  it("validates every client message shape strictly", () => {
    expect(parseClientMessage('{"type":"setReady","version":15,"requestId":"r1","ready":true}')).toMatchObject({ type: "setReady", ready: true });
    expect(parseClientMessage('{"type":"requestSnapshot","version":15,"requestId":"r2"}')).toMatchObject({ type: "requestSnapshot" });
    expect(parseClientMessage('{"type":"ping","version":15,"nonce":"n1"}')).toMatchObject({ type: "ping" });
    expect(parseClientMessage('{"type":"ackBattleSettlement","version":15,"requestId":"r3","settlementId":"battle-1-player"}'))
      .toMatchObject({ type: "ackBattleSettlement", settlementId: "battle-1-player" });
    expect(parseClientMessage('{"type":"closeSourceBattle","version":15,"requestId":"r4","battleId":"battle-1"}'))
      .toMatchObject({ type: "closeSourceBattle", battleId: "battle-1" });
    expect(() => parseClientMessage('{"type":"ping","version":1,"nonce":"n1"}')).toThrow("version de protocole");
    expect(() => parseClientMessage('{"type":"setReady","version":15,"requestId":"r1","ready":1}')).toThrow("setReady mal formé");
    expect(() => parseClientMessage('{"type":"submitAction","version":15,"requestId":"r1","battleId":"b1","turn":1,"action":{"kind":"move","moveIndex":4}}')).toThrow("submitAction mal formé");
    expect(() => parseClientMessage('{"type":"ackBattleSettlement","version":15,"requestId":"r3","settlementId":"bad id"}'))
      .toThrow("ackBattleSettlement mal forme");
  });

  it("accepts only bounded source field sounds", () => {
    expect(parseClientMessage(JSON.stringify({ type: "emitSourceSound", version: 15,
      requestId: "sound-1", mapId: 3, name: "Exit Door", volume: 80, pitch: 120 })))
      .toMatchObject({ type: "emitSourceSound", name: "Exit Door", volume: 80, pitch: 120 });
    expect(() => parseClientMessage(JSON.stringify({ type: "emitSourceSound", version: 15,
      requestId: "sound-2", mapId: 3, name: "../Secret", volume: 80, pitch: 100 })))
      .toThrow("emitSourceSound mal forme");
    expect(() => parseClientMessage(JSON.stringify({ type: "emitSourceSound", version: 15,
      requestId: "sound-3", mapId: 3, name: "Choose", volume: 101, pitch: 100 })))
      .toThrow("emitSourceSound mal forme");
  });

  it("accepts team switches and forced replacements", () => {
    expect(parseClientMessage('{"type":"submitAction","version":15,"requestId":"d1","battleId":"b1","turn":1,"activeSlot":1,"action":{"kind":"move","moveIndex":0,"target":{"side":"opponent","slot":1}}}'))
      .toMatchObject({ activeSlot: 1, action: { target: { side: "opponent", slot: 1 } } });
    expect(parseClientMessage('{"type":"submitAction","version":15,"requestId":"s1","battleId":"b1","turn":1,"action":{"kind":"switch","teamIndex":5}}')).toMatchObject({ action: { kind: "switch", teamIndex: 5 } });
    expect(parseClientMessage('{"type":"submitAction","version":15,"requestId":"i1","battleId":"b1","turn":1,"action":{"kind":"item","itemId":"POTION","targetTeamIndex":2}}'))
      .toMatchObject({ action: { kind: "item", itemId: "POTION", targetTeamIndex: 2 } });
    expect(parseClientMessage('{"type":"submitAction","version":15,"requestId":"i-pp","battleId":"b1","turn":1,"action":{"kind":"item","itemId":"ETHER","targetTeamIndex":0,"targetMoveIndex":2}}'))
      .toMatchObject({ action: { kind: "item", itemId: "ETHER", targetMoveIndex: 2 } });
    expect(() => parseClientMessage('{"type":"submitAction","version":15,"requestId":"i-pp-bad","battleId":"b1","turn":1,"action":{"kind":"item","itemId":"ETHER","targetTeamIndex":0}}'))
      .toThrow("submitAction mal formé");
    expect(() => parseClientMessage('{"type":"submitAction","version":15,"requestId":"i-extra","battleId":"b1","turn":1,"action":{"kind":"item","itemId":"POTION","targetTeamIndex":0,"targetMoveIndex":0}}'))
      .toThrow("submitAction mal formé");
    expect(() => parseClientMessage('{"type":"submitAction","version":15,"requestId":"i2","battleId":"b1","turn":1,"action":{"kind":"item","itemId":"MASTERBALL","targetTeamIndex":0}}'))
      .toThrow("submitAction mal formé");
    expect(parseClientMessage('{"type":"submitAction","version":15,"requestId":"c1","battleId":"b1","turn":1,"action":{"kind":"capture","ballId":"MASTERBALL"}}'))
      .toMatchObject({ action: { kind: "capture", ballId: "MASTERBALL" } });
    expect(parseClientMessage('{"type":"submitReplacement","version":15,"requestId":"r1","battleId":"b1","turn":2,"teamIndex":1}')).toMatchObject({ type: "submitReplacement", teamIndex: 1 });
    expect(() => parseClientMessage('{"type":"submitReplacement","version":15,"requestId":"r1","battleId":"b1","turn":2,"teamIndex":6}')).toThrow("submitReplacement mal formé");
    expect(parseClientMessage('{"type":"attemptBattleEscape","version":15,"requestId":"e1","battleId":"b1","turn":2}'))
      .toMatchObject({ type: "attemptBattleEscape", battleId: "b1", turn: 2 });
    expect(() => parseClientMessage('{"type":"attemptBattleEscape","version":15,"requestId":"e1","battleId":"b1","turn":0}'))
      .toThrow("attemptBattleEscape mal formé");
  });

  it("accepts only directional overworld intentions with a positive sequence", () => {
    expect(parseClientMessage('{"type":"moveAvatar","version":15,"requestId":"w1","direction":"left","sequence":3}')).toMatchObject({ type: "moveAvatar", direction: "left", sequence: 3 });
    expect(parseClientMessage('{"type":"interact","version":15,"requestId":"i1"}')).toMatchObject({ type: "interact" });
    expect(() => parseClientMessage('{"type":"interact","version":15,"requestId":"i1","interactionId":"secret"}')).toThrow("interact mal formé");
    expect(() => parseClientMessage('{"type":"moveAvatar","version":15,"requestId":"w1","direction":"teleport","sequence":3}')).toThrow("moveAvatar mal formé");
    expect(() => parseClientMessage('{"type":"moveAvatar","version":15,"requestId":"w1","direction":"left","sequence":0}')).toThrow("moveAvatar mal formé");
    expect(parseClientMessage('{"type":"setSourceFollower","version":15,"requestId":"f1","species":"FENNEKIN"}'))
      .toMatchObject({ type: "setSourceFollower", species: "FENNEKIN" });
    expect(parseClientMessage('{"type":"setSourceFollower","version":15,"requestId":"f2","species":"FENNEKIN","appearance":{"form":1,"shiny":true,"gender":"female"}}'))
      .toMatchObject({ type: "setSourceFollower", appearance: { form: 1, shiny: true, gender: "female" } });
    expect(() => parseClientMessage('{"type":"setSourceFollower","version":15,"requestId":"f1","species":"../secret"}'))
      .toThrow("setSourceFollower mal formé");
    expect(() => parseClientMessage('{"type":"setSourceFollower","version":15,"requestId":"f3","species":"FENNEKIN","appearance":{"form":0,"shiny":false,"gender":"male","trainerId":42}}'))
      .toThrow("setSourceFollower mal formé");
  });

  it("validates player challenges and never accepts a fainted active Pokémon", () => {
    const challenge = { type: "challengePlayer", version: 15, requestId: "duel-1", team: duelTeam };
    expect(parseClientMessage(JSON.stringify(challenge))).toMatchObject({ type: "challengePlayer", team: { activeIndex: 0 } });
    expect(parseClientMessage(JSON.stringify({ type: "respondPlayerChallenge", version: 15,
      requestId: "duel-2", accept: true, team: duelTeam }))).toMatchObject({ type: "respondPlayerChallenge", accept: true });
    expect(() => parseClientMessage(JSON.stringify({ ...challenge,
      team: { ...duelTeam, members: [{ ...duelTeam.members[0], hp: 0 }] } }))).toThrow("challengePlayer mal forme");
  });

  it("accepts supported two-turn and Beat Up functions from a guest roster", () => {
    for (const functionCode of ["0C1", "0C2", "0C4", "0C9", "0CE"]) {
      const team = { ...duelTeam, members: [{ ...duelTeam.members[0], baseAttack: 55,
        moves: [{ move: { ...MINIMAL_MOVE_CATALOG.TACKLE, functionCode }, pp: 10 }] }] };
      expect(parseClientMessage(JSON.stringify({ type: "challengePlayer", version: 15,
        requestId: "two-turn", team }))).toMatchObject({ team: { members: [{ baseAttack: 55 }] } });
    }
  });

  it("accepts capture facts in PvP responses and shared battle openings", () => {
    const captureTeam = { ...duelTeam, members: [{ ...duelTeam.members[0],
      capture: { rate: 190, baseSpeed: 90, weight: 69 } }] };
    expect(parseClientMessage(JSON.stringify({ type: "respondPlayerChallenge", version: 15,
      requestId: "duel-capture", accept: true, team: captureTeam })))
      .toMatchObject({ type: "respondPlayerChallenge", team: { members: [{ capture: { weight: 69 } }] } });

    const context = { origin: "source-wild", mapId: 3, format: "single", escapable: true,
      healingItemsAllowed: true, narrativeOwnerId: "host-1", presentation: { battlebackId: "forest",
        battleMusicId: "Battle wild", victoryMusicId: "Victory", opponentTrainer: null, defeatText: null },
      rewards: { opponents: [{ memberId: "p1", species: "EEVEE", level: 10, baseExperience: 65 }],
        trainerBaseMoney: null, experience: { levelCap: 17, experienceDisabled: false,
          boostTenPercent: false, boostTwentyPercent: false } }, continuation: "pending-encounter" } as const;
    expect(parseClientMessage(JSON.stringify({ type: "openSourceBattle", version: 15,
      requestId: "source-capture", context, playerTeam: captureTeam, opponentTeam: captureTeam,
      battleItems: { POKEBALL: 2 } })))
      .toMatchObject({ type: "openSourceBattle", opponentTeam: { members: [{ capture: { weight: 69 } }] } });
  });

  it("accepts bounded Mega Evolution metadata in battle teams", () => {
    const megaTeam = { ...duelTeam, members: [{ ...duelTeam.members[0],
      megaEvolution: { heldItem: "EEVEEITE", form: 1,
        stats: { maxHp: 40, attack: 30, defense: 30, specialAttack: 30, specialDefense: 30, speed: 30 },
        types: ["NORMAL"], ability: "RUNAWAY", activationAvailable: true } }] };
    expect(parseClientMessage(JSON.stringify({ type: "challengePlayer", version: 15,
      requestId: "duel-mega", team: megaTeam })))
      .toMatchObject({ team: { members: [{ megaEvolution: { heldItem: "EEVEEITE", form: 1,
        activationAvailable: true } }] } });
    expect(() => parseClientMessage(JSON.stringify({ type: "challengePlayer", version: 15,
      requestId: "duel-mega-invalid", team: { ...duelTeam, members: [{ ...duelTeam.members[0],
        megaEvolution: { ...megaTeam.members[0]!.megaEvolution, form: 0 } }] } })))
      .toThrow("challengePlayer mal forme");
  });

  it("accepts every engine-supported held item in PvP responses and shared battle openings", () => {
    const context = { origin: "source-wild", mapId: 3, format: "single", escapable: true,
      healingItemsAllowed: true, narrativeOwnerId: "host-1", presentation: { battlebackId: "forest",
        battleMusicId: "Battle wild", victoryMusicId: "Victory", opponentTrainer: null, defeatText: null },
      rewards: { opponents: [{ memberId: "p1", species: "EEVEE", level: 10, baseExperience: 65 }],
        trainerBaseMoney: null, experience: { levelCap: 17, experienceDisabled: false,
          boostTenPercent: false, boostTwentyPercent: false } }, continuation: "pending-encounter" } as const;

    for (const heldItem of SUPPORTED_HELD_ITEMS) {
      const team = { ...duelTeam, members: [{ ...duelTeam.members[0], heldItem }] };
      expect(parseClientMessage(JSON.stringify({ type: "challengePlayer", version: 15,
        requestId: `challenge-${heldItem}`, team })))
        .toMatchObject({ type: "challengePlayer", team: { members: [{ heldItem }] } });
      expect(parseClientMessage(JSON.stringify({ type: "respondPlayerChallenge", version: 15,
        requestId: `duel-${heldItem}`, accept: true, team })))
        .toMatchObject({ type: "respondPlayerChallenge", team: { members: [{ heldItem }] } });
      expect(parseClientMessage(JSON.stringify({ type: "openSourceBattle", version: 15,
        requestId: `wild-${heldItem}`, context, playerTeam: team, opponentTeam: duelTeam,
        battleItems: { POKEBALL: 2 } })))
        .toMatchObject({ type: "openSourceBattle", playerTeam: { members: [{ heldItem }] } });
    }

    const invalidTeam = { ...duelTeam, members: [{ ...duelTeam.members[0], heldItem: "NOT_AN_ITEM" }] };
    expect(() => parseClientMessage(JSON.stringify({ type: "respondPlayerChallenge", version: 15,
      requestId: "duel-invalid-item", accept: true, team: invalidTeam })))
      .toThrow("respondPlayerChallenge mal forme");
  });

  it("accepts Agility in shared battle openings", () => {
    const agility = { ...MINIMAL_MOVE_CATALOG.TACKLE, id: 1, internalName: "AGILITY", name: "Hâte",
      functionCode: "030" as const, power: 0, category: "Status" as const, accuracy: 0, pp: 30 };
    const agilityTeam = { ...duelTeam, members: [{ ...duelTeam.members[0],
      moves: [{ move: agility, pp: agility.pp }] }] };
    const context = { origin: "source-trainer", mapId: 14, format: "single", escapable: false,
      healingItemsAllowed: true, narrativeOwnerId: "host-1", presentation: { battlebackId: "forest",
        battleMusicId: "Battle trainer", victoryMusicId: "Victory", opponentTrainer: { id: 4, name: "Mélia" },
        defeatText: "Je dois encore m'entraîner !" }, rewards: { opponents: [{ memberId: "p1", species: "EEVEE",
          level: 10, baseExperience: 65 }], trainerBaseMoney: 30, experience: { levelCap: 17,
          experienceDisabled: false, boostTenPercent: false, boostTwentyPercent: false } },
      continuation: "trainer-sequence" } as const;

    expect(parseClientMessage(JSON.stringify({ type: "openSourceBattle", version: 15,
      requestId: "source-agility", context, playerTeam: duelTeam, opponentTeam: agilityTeam,
      battleItems: {} }))).toMatchObject({ opponentTeam: { members: [{ moves: [{ move: { functionCode: "030" } }] }] } });
  });

  it("accepts early-route move functions and volatile state in authoritative openings", () => {
    const context = { origin: "source-trainer", mapId: 16, format: "single", escapable: false,
      healingItemsAllowed: true, narrativeOwnerId: "host-1", presentation: { battlebackId: "cave",
        battleMusicId: "Battle trainer", victoryMusicId: "Victory", opponentTrainer: { id: 1, name: "Vin" },
        defeatText: "Perdu" }, rewards: { opponents: [{ memberId: "p1", species: "VENONAT", level: 9,
          baseExperience: 61 }], trainerBaseMoney: 30, experience: { levelCap: 17, experienceDisabled: false,
          boostTenPercent: false, boostTwentyPercent: false } }, continuation: "trainer-sequence" } as const;
    for (const functionCode of ["00F", "009", "012", "013", "01E", "022", "023", "027", "028", "048", "049",
      "04B", "04D", "077", "07B", "088", "093", "09A", "09E", "0A1", "0A2", "0A7", "0AA", "0AD",
      "0B9", "0BA", "0BC", "0BE", "0C0", "0CF", "0E8", "0F4", "10D", "10E", "110", "116"] as const) {
      const move = { ...MINIMAL_MOVE_CATALOG.TACKLE, functionCode };
      const team = { ...duelTeam, items: ["SUPERPOTION"], members: [{ ...duelTeam.members[0],
        heldItem: "SUPEREVIOLITE" as const, canEvolve: true, canEvolveTwice: true,
        volatile: { confusionTurns: 2, flinched: false, focusEnergy: 2, identified: true,
          disabledMove: null, disableTurns: 0, encoreMove: null, encoreTurns: 0, bindingMove: null,
          bindingTurns: 0, bindingSourceId: "p1", cursed: false, lastMoveUsed: "TACKLE", activeTurns: 1, protected: false,
          endured: false, protectRate: 2, tauntTurns: 0, rage: false }, moves: [{ move, pp: move.pp }] }] };
      expect(parseClientMessage(JSON.stringify({ type: "openSourceBattle", version: 15,
        requestId: `source-${functionCode}`, context, playerTeam: duelTeam, opponentTeam: team,
        battleItems: {} }))).toMatchObject({ opponentTeam: { items: ["SUPERPOTION"], members: [{ canEvolveTwice: true,
          volatile: { confusionTurns: 2, protectRate: 2 },
          moves: [{ move: { functionCode } }] }] } });
    }
  });

  it("validates battle join proposals and responses", () => {
    expect(parseClientMessage(JSON.stringify({ type: "proposeBattleJoin", version: 15, requestId: "join-1",
      battleId: "battle-1", side: "opponent", team: duelTeam, finalMemberIds: ["p1"], battleItems: { POTION: 2 } })))
      .toMatchObject({ type: "proposeBattleJoin", side: "opponent" });
    expect(parseClientMessage(JSON.stringify({ type: "respondBattleJoin", version: 15, requestId: "join-2",
      battleId: "battle-1", accept: true }))).toMatchObject({ type: "respondBattleJoin", accept: true });
    expect(parseClientMessage(JSON.stringify({ type: "observeBattle", version: 15, requestId: "join-3",
      battleId: "battle-1" }))).toMatchObject({ type: "observeBattle", battleId: "battle-1" });
    expect(parseClientMessage(JSON.stringify({ type: "requestBattleJoinWindow", version: 15,
      requestId: "join-call", battleId: "battle-1" })))
      .toMatchObject({ type: "requestBattleJoinWindow", battleId: "battle-1" });
    expect(parseClientMessage(JSON.stringify({ type: "closeBattleJoinWindow", version: 15, requestId: "join-4",
      battleId: "battle-1" }))).toMatchObject({ type: "closeBattleJoinWindow", battleId: "battle-1" });
  });

  it("validates a bounded source battle opening without private save data", () => {
    const context = { origin: "source-wild", mapId: 3, format: "single", escapable: true, healingItemsAllowed: true,
      narrativeOwnerId: "host-1", presentation: { battlebackId: "forest",
        battleMusicId: "Battle wild", victoryMusicId: "Victory", opponentTrainer: null, defeatText: null },
      rewards: { opponents: [{ memberId: "p1", species: "EEVEE", level: 10, baseExperience: 65 }],
        trainerBaseMoney: null, experience: { levelCap: 17, experienceDisabled: false,
          boostTenPercent: false, boostTwentyPercent: false } }, continuation: "pending-encounter" } as const;
    const message: ClientMessage = { type: "openSourceBattle", version: 15, requestId: "source-battle-1",
      context, playerTeam: duelTeam, opponentTeam: duelTeam, battleItems: { POTION: 2 } };
    expect(parseClientMessage(serializeMessage(message))).toEqual(message);
    const moveFormStats = { 0: duelTeam.members[0]!.stats,
      1: { ...duelTeam.members[0]!.stats, attack: 35 } };
    const withCatalog = { ...message, moveCatalog: [duelTeam.members[0]!.moves[0]!.move],
      playerTeam: { ...duelTeam, members: [{ ...duelTeam.members[0], moveFormStats }] } };
    expect(parseClientMessage(JSON.stringify(withCatalog))).toMatchObject({
      moveCatalog: [{ id: duelTeam.members[0]!.moves[0]!.move.id }],
      playerTeam: { members: [{ moveFormStats }] } });
    expect(parseClientMessage(JSON.stringify({ ...message, opponentTeam: { ...duelTeam,
      members: [{ ...duelTeam.members[0], ability: "CHEEKPOUCH" }] } })))
      .toMatchObject({ opponentTeam: { members: [{ ability: "CHEEKPOUCH" }] } });
    expect(() => parseClientMessage(JSON.stringify({ ...message, opponentTeam: { ...duelTeam,
      members: [{ ...duelTeam.members[0], ability: "bad ability" }] } }))).toThrow("openSourceBattle mal forme");
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
    expect(parseClientMessage('{"type":"setSourcePresence","version":15,"requestId":"p1","attached":false,"avatar":null,"mapId":7}'))
      .toMatchObject({ type: "setSourcePresence", attached: false });
    expect(parseClientMessage('{"type":"setSourcePresence","version":15,"requestId":"legacy","attached":false,"avatar":null}'))
      .toMatchObject({ type: "setSourcePresence", attached: false });
    expect(parseClientMessage('{"type":"setSourcePresence","version":15,"requestId":"p2","attached":true,"avatar":{"x":1,"y":2,"direction":"up"},"mapId":7}'))
      .toMatchObject({ type: "setSourcePresence", attached: true, avatar: { x: 1, y: 2 } });
    expect(parseClientMessage('{"type":"setSourcePresence","version":15,"requestId":"p2b","attached":true,"avatar":{"x":1,"y":2,"direction":"up","mode":"surf","action":"step"},"mapId":7}'))
      .toMatchObject({ type: "setSourcePresence", avatar: { mode: "surf", action: "step" } });
    expect(() => parseClientMessage('{"type":"setSourcePresence","version":15,"requestId":"p2c","attached":true,"avatar":{"x":1,"y":2,"direction":"up","pattern":1},"mapId":7}'))
      .toThrow("setSourcePresence mal forme");
    expect(() => parseClientMessage('{"type":"setSourcePresence","version":15,"requestId":"p3","attached":true,"avatar":null,"mapId":7}'))
      .toThrow("setSourcePresence mal forme");
  });

  it("accepts an explicit room departure without client-owned state", () => {
    expect(parseClientMessage(JSON.stringify({ type: "leaveRoom", version: 15,
      requestId: "leave-1" }))).toMatchObject({ type: "leaveRoom", requestId: "leave-1" });
    expect(() => parseClientMessage(JSON.stringify({ type: "leaveRoom", version: 15,
      requestId: "leave-2", side: "opponent" }))).toThrow("leaveRoom mal formé");
  });

  it("validates a cosmetic profile update without gameplay data", () => {
    const profile = createNetworkPlayerProfile("legacy-2", { ...createDefaultPlayerProfile(), displayName: "Lina" });
    const message: ClientMessage = { type: "setProfile", version: 15, requestId: "profile-1", profile };
    expect(parseClientMessage(serializeMessage(message))).toEqual(message);
    expect(() => parseClientMessage(JSON.stringify({ ...message, profile: { ...profile, party: [] } })))
      .toThrow("setProfile mal formé");
  });

  it("valide uniquement l'activation connue d'un effet de terrain", () => {
    const message: ClientMessage = { type: "activateSourceFieldEffect", version: 15,
      requestId: "truth-1", effect: "truth-lens" };
    expect(parseClientMessage(serializeMessage(message))).toEqual(message);
    expect(() => parseClientMessage(JSON.stringify({ ...message, effect: "inconnu" })))
      .toThrow("activateSourceFieldEffect mal formé");
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
    const message: ClientMessage = { type: "setSourceWorld", version: 15, requestId: "source-1", world,
      relocateHost: false };
    expect(parseClientMessage(serializeMessage(message))).toEqual(message);
    expect(() => parseClientMessage(JSON.stringify({ ...message, world: { ...world, avatars: {} } })))
      .toThrow("setSourceWorld mal formé");
    expect(() => parseSourceWorldHostState({ ...world, passages: "fff" })).toThrow("Passages");
    expect(parseSourceWorldHostState({ ...world, truthEvents: [
      { eventId: 9, mode: "hide", points: [{ x: 1, y: 0 }] },
    ] })).toMatchObject({ truthEvents: [{ eventId: 9, mode: "hide" }] });
  });

  it("validates bounded source actors and rejects duplicate or client-computed fields", () => {
    const actors = [{ eventId: 7, x: 1, y: 2, direction: "left" as const, blocking: true,
      moveSpeed: 3, action: "step" as const }];
    const message: ClientMessage = { type: "setSourceActors", version: 15, requestId: "actors-1",
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
      actors: [{ eventId: 7, x: 12, y: 8, direction: "left" as const, pattern: 1, opacity: 255,
        renderOffsetY: -12 }],
      presentation: { id: 1, kind: "screen-tone", data: { tone: { red: 0, green: 0, blue: 0, gray: 255 } } } };
    expect(parseSourceSceneSnapshot(scene)).toEqual(scene);
    const message: ClientMessage = { type: "setSourceScene", version: 15, requestId: "scene-1", scene };
    expect(parseClientMessage(serializeMessage(message))).toEqual(message);
    expect(() => parseSourceSceneSnapshot({ ...scene,
      presentation: { id: 2, kind: "execute-ruby", data: {} } })).toThrow("Commande visuelle");
    expect(() => parseSourceSceneSnapshot({ ...scene,
      actors: [{ ...scene.actors[0]!, renderOffsetY: -256 }] })).toThrow("Acteur de cinematique");
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
