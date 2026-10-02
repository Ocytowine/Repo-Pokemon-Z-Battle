import { MINIMAL_MOVE_CATALOG, SeededRandom, createTeamBattleState, type BattleSide, type BattlerState, type TeamBattleState } from "@pokemon-z-battle/battle-engine";
import { describe, expect, it } from "vitest";
import { AuthoritativeBattleRoom } from "../src/index.js";
import { createDefaultNetworkPlayerProfile, createNetworkPlayerProfile } from "@pokemon-z-battle/multiplayer-protocol";
import { DEMO_WORLD_CATALOG, createDemoWorldState, createOverworldState, type OverworldCatalog } from "@pokemon-z-battle/overworld-engine";

const world = { catalog: DEMO_WORLD_CATALOG, initialState: createDemoWorldState() } as const;
const sourceWorld = { mapId: 3, width: 3, height: 3, passages: "fffffffff",
  blockedPoints: [{ x: 2, y: 1 }], host: { x: 1, y: 1, direction: "down" as const },
  follower: { species: "FENNEKIN", x: 0, y: 1, direction: "right" as const },
  story: { switches: { "67": true }, variables: {}, selfSwitches: {} } };
const worldWithSource = { ...world, sourceWorld } as const;

const syncedCatalog: OverworldCatalog = {
  maps: { test: { id: "test", name: "Test", width: 3, height: 1, blocked: [], transitions: [] } },
  interactions: [{ id: "sync", label: "Sync", kind: "switch", mapId: "test", at: { x: 1, y: 0 }, policy: "SYNCED", effect: { type: "flag", flag: "SYNC_DONE" } }],
};
const syncedWorld = {
  catalog: syncedCatalog,
  initialState: createOverworldState(syncedCatalog, [
    { id: "player", name: "J1", mapId: "test", x: 0, y: 0, direction: "right" },
    { id: "opponent", name: "J2", mapId: "test", x: 2, y: 0, direction: "left" },
  ]),
};

function battler(side: BattleSide): BattlerState {
  const move = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return {
    id: side,
    species: side === "player" ? "EEVEE" : "MEOWTH",
    name: side,
    level: 50,
    types: ["NORMAL"],
    stats: { maxHp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: side === "player" ? 100 : 90 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    hp: 100,
    majorStatus: null,
    ability: null,
    heldItem: null,
    moves: [{ move, pp: move.pp }],
  };
}

function initialBattle(): TeamBattleState {
  return createTeamBattleState({ player: [battler("player")], opponent: [battler("opponent")] });
}

function battleWithReserve(): TeamBattleState {
  return createTeamBattleState({
    player: [battler("player")],
    opponent: [{ ...battler("opponent"), hp: 1 }, { ...battler("opponent"), id: "opponent-reserve" }],
  });
}

function encounterBattle(encounter?: { readonly kind: "wild" | "trainer" }): TeamBattleState {
  if (encounter === undefined) return initialBattle();
  return createTeamBattleState({ player: [battler("player")], opponent: [{ ...battler("opponent"), hp: 1 }] });
}

function ready(requestId: string) {
  return { type: "setReady", version: 8, requestId, ready: true } as const;
}

describe("authoritative battle room", () => {
  it("starts a player duel only when facing the other avatar and resolves both players' actions", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const playerTeam = initialBattle().teams.player;
    const originalOpponentTeam = initialBattle().teams.opponent;
    const opponentTeam = { ...originalOpponentTeam,
      members: originalOpponentTeam.members.map((member) => ({ ...member, hp: 1 })) };

    const challenged = room.receive("alice", { type: "challengePlayer", version: 8,
      requestId: "duel-challenge", team: playerTeam });
    expect(challenged.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().duelChallenge).toEqual({ challenger: "player", challenged: "opponent" });

    room.receive("bob", { type: "respondPlayerChallenge", version: 8,
      requestId: "duel-accept", accept: true, team: opponentTeam });
    const battle = room.snapshot().battle;
    expect(battle).toMatchObject({ duel: true, state: { status: "active",
      teams: { player: { members: [{ id: "player" }] }, opponent: { members: [{ id: "opponent" }] } } } });
    expect(room.snapshot().duelChallenge).toBeNull();
    expect(battle).not.toBeNull();
    if (battle === null) return;

    expect(room.receive("alice", { type: "submitAction", version: 8, requestId: "duel-turn-player",
      battleId: battle.id, turn: 1, action: { kind: "move", moveIndex: 0 } })).toHaveLength(1);
    const resolved = room.receive("bob", { type: "submitAction", version: 8, requestId: "duel-turn-opponent",
      battleId: battle.id, turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(resolved.map((entry) => entry.message.type)).toEqual(["ack", "turnResolved", "snapshot"]);
    expect(room.snapshot().battle?.state.status).toBe("finished");
    const left = room.receive("alice", { type: "leaveBattle", version: 8,
      requestId: "duel-leave", battleId: battle.id });
    expect(left.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().battle).toBeNull();
  });

  it("hosts the source map, validates both movements and reserves story publication for the host", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    expect(room.snapshot().sourceWorld).toMatchObject({ mapId: 3,
      avatars: { player: { x: 1, y: 1 }, opponent: { x: 1, y: 2 } } });

    const blocked = room.receive("alice", { type: "moveAvatar", version: 8, requestId: "source-host-1",
      direction: "right", sequence: 1 });
    expect(blocked[1]?.message).toMatchObject({ type: "sourceWorldUpdated",
      state: { avatars: { player: { x: 1, y: 1, direction: "right" } } } });
    const guestFollower = room.receive("bob", { type: "setSourceFollower", version: 8,
      requestId: "source-guest-follower", species: "CHESPIN" });
    expect(guestFollower.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    room.receive("bob", { type: "moveAvatar", version: 8, requestId: "source-guest-1",
      direction: "left", sequence: 1 });
    expect(room.snapshot().sourceWorld?.avatars.opponent).toMatchObject({ x: 0, y: 2, direction: "left" });
    expect(room.snapshot().sourceWorld?.followers.opponent).toMatchObject({ species: "CHESPIN", x: 1, y: 2 });
    const blockedByGuestFollower = room.receive("alice", { type: "moveAvatar", version: 8,
      requestId: "source-host-follower-collision", direction: "down", sequence: 2 });
    expect(blockedByGuestFollower[1]?.message).toMatchObject({ type: "sourceWorldUpdated",
      state: { avatars: { player: { x: 1, y: 1, direction: "down" } } } });
    room.receive("alice", { type: "moveAvatar", version: 8, requestId: "source-host-2",
      direction: "left", sequence: 3 });
    expect(room.snapshot().sourceWorld).toMatchObject({ avatars: { player: { x: 0, y: 1 } },
      followers: { player: { species: "FENNEKIN", x: 1, y: 1 } } });

    const forbidden = room.receive("bob", { type: "setSourceWorld", version: 8,
      requestId: "source-guest-map", world: sourceWorld });
    expect(forbidden[0]?.message).toMatchObject({ type: "error", code: "HOST_ONLY" });
    const changed = { ...sourceWorld, mapId: 7, host: { x: 0, y: 0, direction: "right" as const } };
    room.receive("alice", { type: "setSourceWorld", version: 8, requestId: "source-host-map", world: changed });
    expect(room.snapshot().sourceWorld).toMatchObject({ mapId: 7, avatars: { player: { x: 0, y: 0 } } });
    expect(room.snapshot().sourceWorld?.followers.opponent?.species).toBe("CHESPIN");

    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState),
      worldWithSource, persisted);
    expect(restored.snapshot().sourceWorld).toEqual(room.snapshot().sourceWorld);
  });

  it("lets the guest leave and safely rejoin the shared source map", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");

    const away = room.receive("bob", { type: "setSourcePresence", version: 8,
      requestId: "guest-away", attached: false, avatar: null });
    expect(away.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().sourceWorld?.presence.opponent).toBe("away");
    const hostStep = room.receive("alice", { type: "moveAvatar", version: 8,
      requestId: "host-through-guest", direction: "down", sequence: 1 });
    expect(hostStep[1]?.message).toMatchObject({ type: "sourceWorldUpdated",
      state: { avatars: { player: { x: 1, y: 2 } } } });
    expect(room.receive("bob", { type: "moveAvatar", version: 8, requestId: "away-move",
      direction: "left", sequence: 1 })[0]?.message).toMatchObject({ type: "error", code: "INVALID_PHASE" });

    const joined = room.receive("bob", { type: "setSourcePresence", version: 8,
      requestId: "guest-return", attached: true, avatar: { x: 0, y: 2, direction: "right" } });
    expect(joined.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().sourceWorld).toMatchObject({ presence: { opponent: "shared" },
      avatars: { opponent: { x: 0, y: 2, direction: "right" } } });
  });

  it("publishes and persists a host-only read-only source scene", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const scene = { mapId: 3, sequenceActive: true,
      dialogue: { label: "Crisanto", text: "Attention !", choices: [] },
      actors: [{ eventId: 4, x: 1, y: 0, direction: "up" as const }], presentation: null };
    const forbidden = room.receive("bob", { type: "setSourceScene", version: 8,
      requestId: "guest-scene", scene });
    expect(forbidden[0]?.message).toMatchObject({ type: "error", code: "HOST_ONLY" });
    const published = room.receive("alice", { type: "setSourceScene", version: 8,
      requestId: "host-scene", scene });
    expect(published.map((entry) => entry.message.type)).toEqual(["ack", "sourceSceneUpdated"]);
    expect(room.snapshot().sourceScene).toEqual(scene);
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState),
      worldWithSource, persisted);
    expect(restored.snapshot().sourceScene).toEqual(scene);
  });

  it("publishes, updates and persists each player's cosmetic profile", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), world);
    const base = createDefaultNetworkPlayerProfile().profile;
    const ariane = createNetworkPlayerProfile("legacy-1", { ...base, displayName: "Ariane" });
    const lina = createNetworkPlayerProfile("legacy-4", { ...base, displayName: "Lina" });
    room.reserve("alice", ariane);
    room.connect("alice");
    expect(room.snapshot().players[0]?.profile).toEqual(ariane);

    const updated = room.receive("alice", { type: "setProfile", version: 8, requestId: "profile-1", profile: lina });
    expect(updated.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().players[0]?.profile).toEqual(lina);

    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState), world, persisted);
    expect(restored.snapshot().players[0]?.profile).toEqual(lina);
  });

  it("assigns two stable seats and rejects a third player", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), world);
    expect(room.connect("alice").side).toBe("player");
    expect(room.connect("bob").side).toBe("opponent");
    expect(room.connect("alice")).toMatchObject({ side: "player", reconnected: true });
    expect(() => room.connect("charlie")).toThrow("ROOM_FULL");
  });

  it("persists the room, pending intentions and RNG position", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(19), world);
    room.reserve("alice");
    expect(room.snapshot().players[0]).toMatchObject({ playerId: "alice", connected: false });
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("ready-a"));
    room.receive("bob", ready("ready-b"));
    room.receive("alice", { type: "moveAvatar", version: 8, requestId: "world-a-1", direction: "right", sequence: 1 });
    room.receive("alice", { type: "submitAction", version: 8, requestId: "move-a", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });

    const state = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(state.rngState), world, state);
    expect(restored.snapshot()).toEqual(room.snapshot());
    expect(restored.snapshot()).toMatchObject({ world: { avatars: { player: { x: 3 } } }, movementSequences: { player: 1 } });
    expect(restored.receive("alice", { type: "moveAvatar", version: 8, requestId: "world-a-stale", direction: "right", sequence: 1 })[0]?.message)
      .toMatchObject({ type: "error", code: "STALE_MOVEMENT" });
    const secondAction = { type: "submitAction", version: 8, requestId: "move-b", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } } as const;
    const uninterruptedOutput = room.receive("bob", secondAction);
    const restoredOutput = restored.receive("bob", secondAction);
    expect(restoredOutput).toEqual(uninterruptedOutput);
    expect(restoredOutput.some((entry) => entry.message.type === "turnResolved")).toBe(true);
  });

  it("starts only after both players are ready and resolves only after both intentions", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(24_301), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("ready-a"));
    expect(room.snapshot().phase).toBe("waiting");
    room.receive("bob", ready("ready-b"));
    expect(room.snapshot()).toMatchObject({ phase: "battle", battle: { id: "ABC234-1", state: { turn: 1 } } });

    const first = room.receive("alice", { type: "submitAction", version: 8, requestId: "move-a", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(first.map((entry) => entry.message.type)).toEqual(["ack"]);
    expect(room.snapshot().battle?.state.turn).toBe(1);
    const second = room.receive("bob", { type: "submitAction", version: 8, requestId: "move-b", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(second.map((entry) => entry.message.type)).toEqual(["ack", "turnResolved", "snapshot"]);
    expect(room.snapshot().battle?.state.turn).toBe(2);
  });

  it("deduplicates requests and rejects stale or duplicate turn actions", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(7), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("ready-a"));
    const firstReady = room.receive("bob", ready("ready-b"));
    const repeatedReady = room.receive("bob", ready("ready-b"));
    expect(repeatedReady[0]?.message).toEqual(firstReady[0]?.message);

    const action = { type: "submitAction", version: 8, requestId: "move-a", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } } as const;
    room.receive("alice", action);
    expect(room.receive("alice", action)[0]?.message.type).toBe("ack");
    const duplicate = room.receive("alice", { ...action, requestId: "move-a-2" });
    expect(duplicate[0]?.message).toMatchObject({ type: "error", code: "ACTION_ALREADY_SUBMITTED" });
    const stale = room.receive("bob", { ...action, requestId: "move-b", battleId: "wrong" });
    expect(stale[0]?.message).toMatchObject({ type: "error", code: "STALE_BATTLE" });
  });

  it("accepts a forced replacement before the following turn", () => {
    const room = new AuthoritativeBattleRoom("ABC234", battleWithReserve, new SeededRandom(7), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("ready-a"));
    room.receive("bob", ready("ready-b"));
    room.receive("alice", { type: "submitAction", version: 8, requestId: "move-a", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    room.receive("bob", { type: "submitAction", version: 8, requestId: "move-b", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(room.snapshot().battle?.state.replacementRequired).toEqual(["opponent"]);

    const replacement = room.receive("bob", { type: "submitReplacement", version: 8, requestId: "replace-b", battleId: "ABC234-1", turn: 2, teamIndex: 1 });
    expect(replacement.map((entry) => entry.message.type)).toEqual(["ack", "replacementResolved", "snapshot"]);
    expect(room.snapshot().battle?.state.teams.opponent.activeIndex).toBe(1);
    expect(room.snapshot().battle?.state.replacementRequired).toEqual([]);
  });

  it("resolves overworld intentions authoritatively and rejects stale sequences", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(3), world);
    room.connect("alice");
    room.connect("bob");
    const moved = room.receive("alice", { type: "moveAvatar", version: 8, requestId: "world-a-1", direction: "right", sequence: 1 });
    expect(moved.map((entry) => entry.message.type)).toEqual(["ack", "worldUpdated"]);
    expect(room.snapshot().world.avatars.player).toMatchObject({ x: 3, y: 4, direction: "right" });
    expect(moved[1]?.message).toMatchObject({ type: "worldUpdated", side: "player", sequence: 1 });

    const stale = room.receive("alice", { type: "moveAvatar", version: 8, requestId: "world-a-stale", direction: "left", sequence: 1 });
    expect(stale[0]?.message).toMatchObject({ type: "error", code: "STALE_MOVEMENT" });
    expect(room.snapshot().world.avatars.player).toMatchObject({ x: 3, y: 4 });
  });

  it("resolves cooperative interactions without accepting a client target", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(3), world);
    room.connect("alice");
    room.connect("bob");

    const personal = room.receive("alice", { type: "interact", version: 8, requestId: "interact-a" });
    expect(personal.map((entry) => entry.message.type)).toEqual(["ack", "interactionUpdated"]);
    expect(room.snapshot().world.players.player?.inventory.ORAN_BERRY).toBe(1);

    const shared = room.receive("bob", { type: "interact", version: 8, requestId: "interact-b" });
    expect(shared[1]?.message).toMatchObject({ type: "interactionUpdated", events: [expect.objectContaining({ type: "dialogueShown" }), expect.objectContaining({ type: "interactionCompleted", policy: "SHARED" })] });
    expect(room.snapshot().world.session.completedInteractions).toContain("meadow-guide");
  });

  it("locks the world during an encounter and persists the result on return", () => {
    const room = new AuthoritativeBattleRoom("ABC234", encounterBattle, new SeededRandom(3), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", { type: "moveAvatar", version: 8, requestId: "toward-wild", direction: "left", sequence: 1 });

    const started = room.receive("alice", { type: "interact", version: 8, requestId: "start-wild" });
    expect(started.map((entry) => entry.message.type)).toEqual(["ack", "interactionUpdated", "snapshot"]);
    const battleId = room.snapshot().battle?.id;
    expect(room.snapshot()).toMatchObject({ phase: "battle", battle: { state: { teams: { opponent: { members: [{ hp: 1 }] } } } } });
    expect(room.receive("bob", { type: "moveAvatar", version: 8, requestId: "locked", direction: "up", sequence: 1 })[0]?.message)
      .toMatchObject({ type: "error", code: "INVALID_PHASE" });
    expect(room.receive("bob", { type: "submitAction", version: 8, requestId: "observer-action", battleId: battleId!, turn: 1, action: { kind: "move", moveIndex: 0 } })[0]?.message)
      .toMatchObject({ type: "error", code: "INVALID_PHASE" });

    const finished = room.receive("alice", { type: "submitAction", version: 8, requestId: "encounter-action", battleId: battleId!, turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(finished.map((entry) => entry.message.type)).toEqual(["ack", "turnResolved", "snapshot"]);
    expect(room.snapshot()).toMatchObject({ phase: "waiting", battle: null });
    expect(room.snapshot().world.session.battleResults).toContainEqual({ encounterId: "wild-meadow-1", kind: "wild", winner: "player" });
  });

  it("restores a pending SYNCED interaction before the second participant", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(4), syncedWorld);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", { type: "interact", version: 8, requestId: "sync-a" });
    expect(room.snapshot().world.session.syncedParticipants.sync).toEqual(["player"]);

    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState), syncedWorld, persisted);
    restored.receive("bob", { type: "interact", version: 8, requestId: "sync-b" });
    expect(restored.snapshot().world.session.flags).toContain("SYNC_DONE");
    expect(restored.snapshot().world.session.completedInteractions).toContain("sync");
  });
});
