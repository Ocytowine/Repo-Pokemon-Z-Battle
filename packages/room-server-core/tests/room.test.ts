import { MINIMAL_MOVE_CATALOG, SeededRandom, createTeamBattleState, type BattleSide, type BattlerState, type TeamBattleState } from "@pokemon-z-battle/battle-engine";
import { describe, expect, it } from "vitest";
import { AuthoritativeBattleRoom, PLAYER_RECONNECT_GRACE_MS } from "../src/index.js";
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
  return { type: "setReady", version: 12, requestId, ready: true } as const;
}

function sourceBattleContext(ownerId: string) {
  return { origin: "source-wild", mapId: 3, format: "single", escapable: true,
    narrativeOwnerId: ownerId, presentation: { battlebackId: "forest", battleMusicId: "Battle wild",
      victoryMusicId: "Victory", opponentTrainer: null, defeatText: null }, rewards: { opponents: [{ memberId: "opponent",
      species: "MEOWTH", level: 50, baseExperience: 58 }], trainerBaseMoney: null,
      experience: { levelCap: 17, experienceDisabled: false, boostTenPercent: false, boostTwentyPercent: false } },
    continuation: "pending-encounter" } as const;
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

    const challenged = room.receive("alice", { type: "challengePlayer", version: 12,
      requestId: "duel-challenge", team: playerTeam });
    expect(challenged.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().duelChallenge).toEqual({ challenger: "player", challenged: "opponent" });

    room.receive("bob", { type: "respondPlayerChallenge", version: 12,
      requestId: "duel-accept", accept: true, team: opponentTeam });
    const battle = room.snapshot().battle;
    expect(battle).toMatchObject({ duel: true, state: { status: "active",
      teams: { player: { members: [{ id: "player" }] }, opponent: { members: [{ id: "opponent" }] } } } });
    expect(room.snapshot().duelChallenge).toBeNull();
    expect(battle).not.toBeNull();
    if (battle === null) return;

    expect(room.receive("alice", { type: "submitAction", version: 12, requestId: "duel-turn-player",
      battleId: battle.id, turn: 1, action: { kind: "move", moveIndex: 0 } })).toHaveLength(1);
    const resolved = room.receive("bob", { type: "submitAction", version: 12, requestId: "duel-turn-opponent",
      battleId: battle.id, turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(resolved.map((entry) => entry.message.type)).toEqual(["ack", "turnResolved", "snapshot"]);
    expect(room.snapshot().battle?.state.status).toBe("finished");
    const left = room.receive("alice", { type: "leaveBattle", version: 12,
      requestId: "duel-leave", battleId: battle.id });
    expect(left.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().battle).toBeNull();

    const reverseChallenge = room.receive("bob", { type: "challengePlayer", version: 12,
      requestId: "duel-reverse", team: opponentTeam });
    expect(reverseChallenge.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().duelChallenge).toEqual({ challenger: "opponent", challenged: "player" });
    room.receive("bob", { type: "respondPlayerChallenge", version: 12,
      requestId: "duel-cancel", accept: false, team: null });
    expect(room.snapshot().duelChallenge).toBeNull();
  });

  it("clears a player challenge after refusal, cancellation or either participant disconnecting", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const playerTeam = initialBattle().teams.player;

    room.receive("alice", { type: "challengePlayer", version: 12,
      requestId: "duel-refused", team: playerTeam });
    const refused = room.receive("bob", { type: "respondPlayerChallenge", version: 12,
      requestId: "duel-refuse", accept: false, team: null });
    expect(refused.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().duelChallenge).toBeNull();

    room.receive("alice", { type: "challengePlayer", version: 12,
      requestId: "duel-cancelled", team: playerTeam });
    room.receive("alice", { type: "respondPlayerChallenge", version: 12,
      requestId: "duel-cancel", accept: false, team: null });
    expect(room.snapshot().duelChallenge).toBeNull();

    room.receive("alice", { type: "challengePlayer", version: 12,
      requestId: "duel-challenged-disconnect", team: playerTeam });
    room.disconnect("bob");
    expect(room.snapshot().duelChallenge).toBeNull();
    expect(room.receive("alice", { type: "respondPlayerChallenge", version: 12,
      requestId: "duel-stale", accept: false, team: null })[0]?.message)
      .toMatchObject({ type: "error", code: "INVALID_PHASE" });

    room.connect("bob");
    room.receive("alice", { type: "challengePlayer", version: 12,
      requestId: "duel-challenger-disconnect", team: playerTeam });
    room.disconnect("alice");
    expect(room.snapshot().duelChallenge).toBeNull();
  });

  it("removes a disconnected avatar from collisions, expires its grace and restores it safely", () => {
    let now = 1_000;
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource,
      undefined, () => now);
    room.connect("alice");
    room.connect("bob");

    room.disconnect("bob");
    expect(room.snapshot().players[1]).toMatchObject({ playerId: "bob", connected: false,
      connectionState: "reconnecting", reconnectUntil: 16_000 });
    room.receive("alice", { type: "moveAvatar", version: 12, requestId: "occupy-guest-cell",
      direction: "down", sequence: 1 });
    expect(room.snapshot().sourceWorld?.avatars.player).toMatchObject({ x: 1, y: 2 });

    now = 15_999;
    expect(room.expireDisconnectedPlayers()).toBeNull();
    now = 16_000;
    expect(room.expireDisconnectedPlayers()?.players[1]).toMatchObject({ connectionState: "left",
      reconnectUntil: null });
    expect(room.nextReconnectExpiry()).toBeNull();

    const restored = room.connect("bob");
    expect(restored.snapshot.players[1]).toMatchObject({ connected: true, connectionState: "connected" });
    expect(restored.snapshot.sourceWorld?.avatars.opponent).toMatchObject({ x: 0, y: 2 });

    const left = room.receive("bob", { type: "leaveRoom", version: 12, requestId: "leave-now" });
    expect(left.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().players[1]).toMatchObject({ connected: false, connectionState: "left",
      reconnectUntil: null });
  });

  it("releases a departed guest seat for a manual join without bypassing the reconnect grace", () => {
    let now = 1_000;
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource,
      undefined, () => now);
    room.connect("alice");
    room.connect("bob");

    room.disconnect("bob");
    expect(() => room.reserve("charlie")).toThrow("ROOM_FULL");
    now += PLAYER_RECONNECT_GRACE_MS;
    room.expireDisconnectedPlayers();
    expect(room.reserve("charlie")).toMatchObject({ side: "opponent", reconnected: false,
      replacedPlayerId: "bob" });
    expect(room.snapshot().players.map((player) => player.playerId)).toEqual(["alice", "charlie"]);

    const explicit = new AuthoritativeBattleRoom("DEF567", initialBattle, new SeededRandom(2), worldWithSource);
    explicit.connect("host");
    explicit.connect("guest");
    explicit.receive("guest", { type: "leaveRoom", version: 12, requestId: "guest-leave" });
    expect(explicit.reserve("replacement")).toMatchObject({ side: "opponent", replacedPlayerId: "guest" });
  });

  it("hosts the source map, validates both movements and reserves story publication for the host", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    expect(room.snapshot().sourceWorld).toMatchObject({ mapId: 3,
      avatars: { player: { x: 1, y: 1 }, opponent: { x: 1, y: 2 } } });

    const blocked = room.receive("alice", { type: "moveAvatar", version: 12, requestId: "source-host-1",
      direction: "right", sequence: 1 });
    expect(blocked[1]?.message).toMatchObject({ type: "sourceWorldUpdated",
      state: { avatars: { player: { x: 1, y: 1, direction: "right" } } } });
    const guestFollower = room.receive("bob", { type: "setSourceFollower", version: 12,
      requestId: "source-guest-follower", species: "CHESPIN",
      appearance: { form: 1, shiny: true, gender: "female" } });
    expect(guestFollower.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    room.receive("bob", { type: "moveAvatar", version: 12, requestId: "source-guest-1",
      direction: "left", sequence: 1 });
    expect(room.snapshot().sourceWorld?.avatars.opponent).toMatchObject({ x: 0, y: 2, direction: "left" });
    expect(room.snapshot().sourceWorld?.followers.opponent).toMatchObject({ species: "CHESPIN", x: 1, y: 2,
      appearance: { form: 1, shiny: true, gender: "female" } });
    const blockedByGuestFollower = room.receive("alice", { type: "moveAvatar", version: 12,
      requestId: "source-host-follower-collision", direction: "down", sequence: 2 });
    expect(blockedByGuestFollower[1]?.message).toMatchObject({ type: "sourceWorldUpdated",
      state: { avatars: { player: { x: 1, y: 1, direction: "down" } } } });
    room.receive("alice", { type: "moveAvatar", version: 12, requestId: "source-host-2",
      direction: "left", sequence: 3 });
    expect(room.snapshot().sourceWorld).toMatchObject({ avatars: { player: { x: 0, y: 1 } },
      followers: { player: { species: "FENNEKIN", x: 1, y: 1 } } });

    room.receive("alice", { type: "setSourceWorld", version: 12, requestId: "source-story-refresh",
      world: sourceWorld, relocateHost: false });
    expect(room.snapshot().sourceWorld?.avatars.player).toMatchObject({ x: 0, y: 1 });
    room.receive("alice", { type: "setSourceWorld", version: 12, requestId: "source-scripted-relocation",
      world: sourceWorld, relocateHost: true });
    expect(room.snapshot().sourceWorld?.avatars.player).toMatchObject({ x: 1, y: 1 });

    const forbidden = room.receive("bob", { type: "setSourceWorld", version: 12,
      requestId: "source-guest-map", world: sourceWorld });
    expect(forbidden[0]?.message).toMatchObject({ type: "error", code: "HOST_ONLY" });
    const changed = { ...sourceWorld, mapId: 7, host: { x: 0, y: 0, direction: "right" as const } };
    room.receive("alice", { type: "setSourceWorld", version: 12, requestId: "source-host-map", world: changed });
    expect(room.snapshot().sourceWorld).toMatchObject({ mapId: 7, presence: { opponent: "away" },
      avatars: { player: { x: 0, y: 0 } } });
    expect(room.snapshot().sourceWorld?.followers.opponent?.species).toBe("CHESPIN");

    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState),
      worldWithSource, persisted);
    expect(restored.snapshot().sourceWorld).toEqual(room.snapshot().sourceWorld);
  });

  it("uses host-published NPCs as authoritative collisions and restores them with the room", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const blockingActor = { eventId: 17, x: 2, y: 2, direction: "left" as const,
      blocking: true, moveSpeed: 3, action: "idle" as const };

    const published = room.receive("alice", { type: "setSourceActors", version: 12,
      requestId: "actors-blocking", mapId: 3, actors: [blockingActor] });
    expect(published.map((entry) => entry.message.type)).toEqual(["ack", "sourceActorsUpdated"]);
    expect(published[1]?.message).toMatchObject({ type: "sourceActorsUpdated", actorRevision: 1,
      actors: [blockingActor] });
    const blocked = room.receive("bob", { type: "moveAvatar", version: 12,
      requestId: "guest-blocked-by-npc", direction: "right", sequence: 1 });
    expect(blocked[1]?.message).toMatchObject({ type: "sourceWorldUpdated",
      state: { avatars: { opponent: { x: 1, y: 2, direction: "right" } } } });

    expect(room.receive("bob", { type: "setSourceActors", version: 12,
      requestId: "guest-cannot-move-npcs", mapId: 3, actors: [] })[0]?.message)
      .toMatchObject({ type: "error", code: "HOST_ONLY" });
    const movedActor = { ...blockingActor, x: 0, y: 0, direction: "up" as const, action: "step" as const };
    room.receive("alice", { type: "setSourceActors", version: 12,
      requestId: "actors-moved", mapId: 3, actors: [movedActor] });
    room.receive("bob", { type: "moveAvatar", version: 12,
      requestId: "guest-after-npc", direction: "right", sequence: 2 });
    expect(room.snapshot().sourceWorld).toMatchObject({ actorRevision: 2, actors: [movedActor],
      avatars: { opponent: { x: 2, y: 2 } } });

    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState),
      worldWithSource, persisted);
    expect(restored.snapshot().sourceWorld).toMatchObject({ actorRevision: 2, actors: [movedActor] });
    restored.connect("bob");
    expect(restored.snapshot().sourceWorld?.actors).toEqual([movedActor]);
  });

  it("applies the host narrative blockers to guest movement and restores them after reconnect", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");

    const blockedBySwitch = { ...sourceWorld, blockedPoints: [{ x: 2, y: 2 }],
      story: { ...sourceWorld.story, switches: { ...sourceWorld.story.switches, "90": true } } };
    room.receive("alice", { type: "setSourceWorld", version: 12, requestId: "narrative-switch",
      world: blockedBySwitch });
    const blocked = room.receive("bob", { type: "moveAvatar", version: 12,
      requestId: "guest-blocked-by-switch", direction: "right", sequence: 1 });
    expect(blocked[1]?.message).toMatchObject({ type: "sourceWorldUpdated",
      state: { avatars: { opponent: { x: 1, y: 2, direction: "right" } },
        blockedPoints: [{ x: 2, y: 2 }], story: { switches: { "90": true } } } });

    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState),
      worldWithSource, persisted);
    expect(restored.snapshot().sourceWorld).toMatchObject({ blockedPoints: [{ x: 2, y: 2 }],
      story: { switches: { "90": true } } });

    const openedBySelfSwitch = { ...sourceWorld, blockedPoints: [],
      story: { ...sourceWorld.story, selfSwitches: { "3:8:A": true } } };
    restored.receive("alice", { type: "setSourceWorld", version: 12, requestId: "narrative-self-switch",
      world: openedBySelfSwitch });
    const moved = restored.receive("bob", { type: "moveAvatar", version: 12,
      requestId: "guest-opened-by-self-switch", direction: "right", sequence: 2 });
    expect(moved[1]?.message).toMatchObject({ type: "sourceWorldUpdated",
      state: { avatars: { opponent: { x: 2, y: 2, direction: "right" } }, blockedPoints: [],
        story: { selfSwitches: { "3:8:A": true } } } });
  });

  it("lets the guest leave and safely rejoin the shared source map", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");

    const away = room.receive("bob", { type: "setSourcePresence", version: 12,
      requestId: "guest-away", attached: false, avatar: null });
    expect(away.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().sourceWorld?.presence.opponent).toBe("away");
    const hostStep = room.receive("alice", { type: "moveAvatar", version: 12,
      requestId: "host-through-guest", direction: "down", sequence: 1 });
    expect(hostStep[1]?.message).toMatchObject({ type: "sourceWorldUpdated",
      state: { avatars: { player: { x: 1, y: 2 } } } });
    expect(room.receive("bob", { type: "moveAvatar", version: 12, requestId: "away-move",
      direction: "left", sequence: 1 })[0]?.message).toMatchObject({ type: "error", code: "INVALID_PHASE" });

    const joined = room.receive("bob", { type: "setSourcePresence", version: 12,
      requestId: "guest-return", attached: true, avatar: { x: 0, y: 2, direction: "right" } });
    expect(joined.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().sourceWorld).toMatchObject({ presence: { opponent: "shared" },
      avatars: { opponent: { x: 0, y: 2, direction: "right" } } });

    room.receive("bob", { type: "setSourcePresence", version: 12,
      requestId: "guest-away-again", attached: false, avatar: null });
    const safeFallback = room.receive("bob", { type: "setSourcePresence", version: 12,
      requestId: "guest-return-occupied", attached: true, avatar: { x: 1, y: 2, direction: "up" } });
    expect(safeFallback.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().sourceWorld?.avatars.opponent).not.toMatchObject({ x: 1, y: 2 });
  });

  it("keeps an away guest outside the shared map until the host battle closes", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    room.receive("bob", { type: "setSourcePresence", version: 12,
      requestId: "guest-away-during-battle", attached: false, avatar: null });
    const initial = initialBattle();
    room.receive("alice", { type: "openSourceBattle", version: 12, requestId: "host-battle-before-return",
      context: sourceBattleContext("alice"), playerTeam: initial.teams.player,
      opponentTeam: initial.teams.opponent });

    expect(room.receive("bob", { type: "setSourcePresence", version: 12,
      requestId: "guest-return-during-battle", attached: true,
      avatar: { x: 0, y: 2, direction: "right" } })[0]?.message)
      .toMatchObject({ type: "error", code: "INVALID_PHASE" });
    expect(room.snapshot().sourceWorld?.presence.opponent).toBe("away");
  });

  it("publishes and persists a host-only read-only source scene", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const scene = { mapId: 3, sequenceActive: true,
      dialogue: { label: "Crisanto", text: "Attention !", choices: [] },
      actors: [{ eventId: 4, x: 1, y: 0, direction: "up" as const }], presentation: null };
    const forbidden = room.receive("bob", { type: "setSourceScene", version: 12,
      requestId: "guest-scene", scene });
    expect(forbidden[0]?.message).toMatchObject({ type: "error", code: "HOST_ONLY" });
    const published = room.receive("alice", { type: "setSourceScene", version: 12,
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

    const updated = room.receive("alice", { type: "setProfile", version: 12, requestId: "profile-1", profile: lina });
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
    room.receive("alice", { type: "moveAvatar", version: 12, requestId: "world-a-1", direction: "right", sequence: 1 });
    room.receive("alice", { type: "submitAction", version: 12, requestId: "move-a", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });

    const state = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(state.rngState), world, state);
    expect(restored.snapshot()).toEqual(room.snapshot());
    expect(restored.snapshot()).toMatchObject({ world: { avatars: { player: { x: 3 } } }, movementSequences: { player: 1 } });
    expect(restored.receive("alice", { type: "moveAvatar", version: 12, requestId: "world-a-stale", direction: "right", sequence: 1 })[0]?.message)
      .toMatchObject({ type: "error", code: "STALE_MOVEMENT" });
    const secondAction = { type: "submitAction", version: 12, requestId: "move-b", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } } as const;
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

    const first = room.receive("alice", { type: "submitAction", version: 12, requestId: "move-a", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(first.map((entry) => entry.message.type)).toEqual(["ack"]);
    expect(room.snapshot().battle?.state.turn).toBe(1);
    const second = room.receive("bob", { type: "submitAction", version: 12, requestId: "move-b", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
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

    const action = { type: "submitAction", version: 12, requestId: "move-a", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } } as const;
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
    room.receive("alice", { type: "submitAction", version: 12, requestId: "move-a", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    room.receive("bob", { type: "submitAction", version: 12, requestId: "move-b", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(room.snapshot().battle?.state.replacementRequired).toEqual(["opponent"]);

    const replacement = room.receive("bob", { type: "submitReplacement", version: 12, requestId: "replace-b", battleId: "ABC234-1", turn: 2, teamIndex: 1 });
    expect(replacement.map((entry) => entry.message.type)).toEqual(["ack", "replacementResolved", "snapshot"]);
    expect(room.snapshot().battle?.state.teams.opponent.activeIndex).toBe(1);
    expect(room.snapshot().battle?.state.replacementRequired).toEqual([]);
  });

  it("resolves overworld intentions authoritatively and rejects stale sequences", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(3), world);
    room.connect("alice");
    room.connect("bob");
    const moved = room.receive("alice", { type: "moveAvatar", version: 12, requestId: "world-a-1", direction: "right", sequence: 1 });
    expect(moved.map((entry) => entry.message.type)).toEqual(["ack", "worldUpdated"]);
    expect(room.snapshot().world.avatars.player).toMatchObject({ x: 3, y: 4, direction: "right" });
    expect(moved[1]?.message).toMatchObject({ type: "worldUpdated", side: "player", sequence: 1 });

    const stale = room.receive("alice", { type: "moveAvatar", version: 12, requestId: "world-a-stale", direction: "left", sequence: 1 });
    expect(stale[0]?.message).toMatchObject({ type: "error", code: "STALE_MOVEMENT" });
    expect(room.snapshot().world.avatars.player).toMatchObject({ x: 3, y: 4 });
  });

  it("resolves cooperative interactions without accepting a client target", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(3), world);
    room.connect("alice");
    room.connect("bob");

    const personal = room.receive("alice", { type: "interact", version: 12, requestId: "interact-a" });
    expect(personal.map((entry) => entry.message.type)).toEqual(["ack", "interactionUpdated"]);
    expect(room.snapshot().world.players.player?.inventory.ORAN_BERRY).toBe(1);

    const shared = room.receive("bob", { type: "interact", version: 12, requestId: "interact-b" });
    expect(shared[1]?.message).toMatchObject({ type: "interactionUpdated", events: [expect.objectContaining({ type: "dialogueShown" }), expect.objectContaining({ type: "interactionCompleted", policy: "SHARED" })] });
    expect(room.snapshot().world.session.completedInteractions).toContain("meadow-guide");
  });

  it("locks the world during an encounter and persists the result on return", () => {
    const room = new AuthoritativeBattleRoom("ABC234", encounterBattle, new SeededRandom(3), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", { type: "moveAvatar", version: 12, requestId: "toward-wild", direction: "left", sequence: 1 });

    const started = room.receive("alice", { type: "interact", version: 12, requestId: "start-wild" });
    expect(started.map((entry) => entry.message.type)).toEqual(["ack", "interactionUpdated", "snapshot"]);
    const battleId = room.snapshot().battle?.id;
    expect(room.snapshot()).toMatchObject({ phase: "battle", battle: { state: { teams: { opponent: { members: [{ hp: 1 }] } } } } });
    expect(room.receive("bob", { type: "moveAvatar", version: 12, requestId: "locked", direction: "up", sequence: 1 })[0]?.message)
      .toMatchObject({ type: "error", code: "INVALID_PHASE" });
    expect(room.receive("bob", { type: "submitAction", version: 12, requestId: "observer-action", battleId: battleId!, turn: 1, action: { kind: "move", moveIndex: 0 } })[0]?.message)
      .toMatchObject({ type: "error", code: "INVALID_PHASE" });

    const finished = room.receive("alice", { type: "submitAction", version: 12, requestId: "encounter-action", battleId: battleId!, turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(finished.map((entry) => entry.message.type)).toEqual(["ack", "turnResolved", "snapshot"]);
    expect(room.snapshot()).toMatchObject({ phase: "waiting", battle: null });
    expect(room.snapshot().world.session.battleResults).toContainEqual({ encounterId: "wild-meadow-1", kind: "wild", winner: "player" });
  });

  it("lets the guest join an encounter on the opposing camp after host approval and restores ownership", () => {
    const room = new AuthoritativeBattleRoom("ABC234", encounterBattle, new SeededRandom(7), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", { type: "moveAvatar", version: 12, requestId: "toward-join", direction: "left", sequence: 1 });
    room.receive("alice", { type: "interact", version: 12, requestId: "start-join" });
    const battle = room.snapshot().battle!;
    const guest = { ...battler("opponent"), id: "guest-mon", hp: 100 };
    const proposed = room.receive("bob", { type: "proposeBattleJoin", version: 12, requestId: "join-enemy",
      battleId: battle.id, side: "opponent", team: { activeIndex: 0, members: [guest] },
      finalMemberIds: [guest.id] });
    expect(proposed.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().battle?.joinProposal).toMatchObject({ joinerId: "bob", side: "opponent" });

    room.receive("alice", { type: "respondBattleJoin", version: 12, requestId: "accept-join",
      battleId: battle.id, accept: true });
    expect(room.snapshot().battle).toMatchObject({ participation: { camps: { opponent: {
      trainerIds: ["bob"], activeMemberId: "guest-mon", members: [{ ownerId: "bob" }],
    } } }, joinProposal: null });
    expect(room.receive("alice", { type: "submitAction", version: 12, requestId: "joined-host-action",
      battleId: battle.id, turn: 1, action: { kind: "move", moveIndex: 0 } })).toHaveLength(1);
    const resolved = room.receive("bob", { type: "submitAction", version: 12, requestId: "joined-guest-action",
      battleId: battle.id, turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(resolved.map((entry) => entry.message.type)).toEqual(["ack", "turnResolved", "snapshot"]);

    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", encounterBattle, new SeededRandom(persisted.rngState), world, persisted);
    expect(restored.snapshot().battle?.participation?.camps.opponent.members[0]).toMatchObject({ ownerId: "bob" });
    expect(restored.snapshot().battle?.ledger?.engagedMemberIds).toEqual({ player: ["player"], opponent: ["guest-mon"] });
  });

  it("opens, persists and settles a Pokemon Z battle through the authoritative room", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const playerTeam = initialBattle().teams.player;
    const opponentTeam = { ...initialBattle().teams.opponent,
      members: initialBattle().teams.opponent.members.map((member) => ({ ...member, hp: 1 })) };
    const forbidden = room.receive("bob", { type: "openSourceBattle", version: 12,
      requestId: "source-battle-guest", context: sourceBattleContext("bob"), playerTeam, opponentTeam });
    expect(forbidden[0]?.message).toMatchObject({ type: "error", code: "HOST_ONLY" });

    const opened = room.receive("alice", { type: "openSourceBattle", version: 12,
      requestId: "source-battle-host", context: sourceBattleContext("alice"), playerTeam, opponentTeam });
    expect(opened.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().battle).toMatchObject({ duel: false,
      session: { origin: "source-wild", lifecycle: "join-window", narrativeOwnerId: "alice" },
      sourceContext: { mapId: 3, continuation: "pending-encounter" },
      participation: { battleOwnerId: "alice" } });

    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState),
      worldWithSource, persisted);
    expect(restored.snapshot().battle).toEqual(room.snapshot().battle);
    const battle = restored.snapshot().battle!;
    restored.receive("alice", { type: "submitAction", version: 12, requestId: "source-battle-turn",
      battleId: battle.id, turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(restored.snapshot().battle).toMatchObject({ state: { status: "finished", winner: "player" },
      session: { lifecycle: "settling", settlementId: `${battle.id}:settlement` },
      sourceContext: { origin: "source-wild" } });
  });

  it("persists an explicit observer choice and lets only the host close the join window", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const playerTeam = initialBattle().teams.player;
    const opponentTeam = initialBattle().teams.opponent;
    room.receive("alice", { type: "openSourceBattle", version: 12, requestId: "open-observed",
      context: sourceBattleContext("alice"), playerTeam, opponentTeam });
    const battleId = room.snapshot().battle!.id;

    const unauthorizedAction = room.receive("bob", { type: "submitAction", version: 12,
      requestId: "observer-action-before-choice", battleId, turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(unauthorizedAction[0]?.message).toMatchObject({ type: "error", code: "INVALID_PHASE" });
    expect(room.snapshot().battle?.session.lifecycle).toBe("join-window");

    room.receive("bob", { type: "observeBattle", version: 12, requestId: "observe", battleId });
    expect(room.snapshot().battle?.observerIds).toEqual(["bob"]);
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState),
      worldWithSource, persisted);
    expect(restored.snapshot().battle?.observerIds).toEqual(["bob"]);
    expect(restored.receive("bob", { type: "closeBattleJoinWindow", version: 12,
      requestId: "guest-close", battleId })[0]?.message).toMatchObject({ type: "error", code: "HOST_ONLY" });
    expect(restored.receive("bob", { type: "proposeBattleJoin", version: 12, requestId: "observer-join",
      battleId, side: "player", team: playerTeam, finalMemberIds: ["player"] })[0]?.message)
      .toMatchObject({ type: "error", message: expect.stringContaining("observer") });
    const closed = restored.receive("alice", { type: "closeBattleJoinWindow", version: 12,
      requestId: "host-close", battleId });
    expect(closed.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(restored.snapshot().battle?.session.lifecycle).toBe("active");
  });

  it("requires the host to answer a valid composition before closing the join window", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const playerTeam = initialBattle().teams.player;
    const opponentTeam = initialBattle().teams.opponent;
    room.receive("alice", { type: "openSourceBattle", version: 12, requestId: "open-proposal",
      context: sourceBattleContext("alice"), playerTeam, opponentTeam });
    const battleId = room.snapshot().battle!.id;
    const guest = { ...battler("opponent"), id: "guest-source-mon" };
    room.receive("bob", { type: "proposeBattleJoin", version: 12, requestId: "source-proposal",
      battleId, side: "opponent", team: { activeIndex: 0, members: [guest] },
      finalMemberIds: ["opponent", guest.id] });
    expect(room.receive("alice", { type: "closeBattleJoinWindow", version: 12,
      requestId: "close-with-proposal", battleId })[0]?.message)
      .toMatchObject({ type: "error", message: expect.stringContaining("acceptee ou refusee") });
    room.receive("alice", { type: "respondBattleJoin", version: 12, requestId: "accept-source-proposal",
      battleId, accept: true });
    expect(room.snapshot().battle?.participation?.camps.opponent.members.map((member) => member.battler.id))
      .toEqual(["opponent", "guest-source-mon"]);
    room.receive("alice", { type: "closeBattleJoinWindow", version: 12,
      requestId: "close-after-approval", battleId });
    expect(room.snapshot().battle?.session.lifecycle).toBe("active");
  });

  it("keeps encounter credits when the host refuses a join proposal", () => {
    const room = new AuthoritativeBattleRoom("ABC234", encounterBattle, new SeededRandom(7), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", { type: "moveAvatar", version: 12, requestId: "toward-refusal", direction: "left", sequence: 1 });
    room.receive("alice", { type: "interact", version: 12, requestId: "start-refusal" });
    const battle = room.snapshot().battle!;
    const guest = { ...battler("opponent"), id: "refused-mon", hp: 100 };
    room.receive("bob", { type: "proposeBattleJoin", version: 12, requestId: "propose-refusal",
      battleId: battle.id, side: "opponent", team: { activeIndex: 0, members: [guest] }, finalMemberIds: [guest.id] });
    room.receive("alice", { type: "respondBattleJoin", version: 12, requestId: "refuse-join",
      battleId: battle.id, accept: false });
    expect(room.snapshot().battle).toMatchObject({ joinProposal: null,
      joinRefusal: { playerId: "bob", reason: expect.stringContaining("refusee") },
      ledger: { engagedMemberIds: { player: ["player"], opponent: ["opponent"] } } });
  });

  it("reserves global escape to the narrative owner and persists its settlement", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(2), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const initial = initialBattle();
    room.receive("alice", { type: "openSourceBattle", version: 12, requestId: "escape-open",
      context: sourceBattleContext("alice"), playerTeam: initial.teams.player, opponentTeam: initial.teams.opponent });
    const battle = room.snapshot().battle!;
    expect(room.receive("bob", { type: "attemptBattleEscape", version: 12, requestId: "escape-guest",
      battleId: battle.id, turn: 1 })[0]?.message).toMatchObject({ type: "error", code: "HOST_ONLY" });
    const escaped = room.receive("alice", { type: "attemptBattleEscape", version: 12,
      requestId: "escape-host", battleId: battle.id, turn: 1 });
    expect(escaped.map((entry) => entry.message.type)).toEqual(["ack", "battleSettlement", "battleEscaped", "snapshot"]);
    const settlement = escaped.find((entry) => entry.message.type === "battleSettlement")?.message;
    expect(settlement).toMatchObject({ type: "battleSettlement", settlement: { ownerId: "alice",
      battleId: battle.id, outcome: "escaped", money: { kind: "none" }, healParty: false } });
    expect(room.snapshot()).toMatchObject({ phase: "finished", battle: { escaped: true, escapeAttempts: 1,
      session: { lifecycle: "settling", settlementId: `${battle.id}:settlement` } } });
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle,
      new SeededRandom(persisted.rngState), worldWithSource, persisted);
    expect(restored.snapshot().battle).toMatchObject({ escaped: true, escapeAttempts: 1 });
    expect(restored.connect("alice").settlement).toMatchObject({ battleId: battle.id, ownerId: "alice" });
    expect(restored.receive("alice", { type: "ackBattleSettlement", version: 12,
      requestId: "escape-settlement-ack", settlementId: `${battle.id}-alice` })[0]?.message).toMatchObject({ type: "ack" });
    expect(restored.connect("alice").settlement).toBeNull();
  });

  it("keeps one private settlement per owner while a disconnected guest catches up", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(4), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const initial = initialBattle();
    const opponentTeam = { ...initial.teams.opponent,
      members: initial.teams.opponent.members.map((member) => ({ ...member, hp: 1 })) };
    room.receive("alice", { type: "openSourceBattle", version: 12, requestId: "settlement-open",
      context: sourceBattleContext("alice"), playerTeam: initial.teams.player, opponentTeam });
    const battleId = room.snapshot().battle!.id;
    const guest = { ...battler("player"), id: "guest-mon" };
    room.receive("bob", { type: "proposeBattleJoin", version: 12, requestId: "settlement-join", battleId,
      side: "player", team: { activeIndex: 0, members: [guest] }, finalMemberIds: ["player", guest.id] });
    room.receive("alice", { type: "respondBattleJoin", version: 12, requestId: "settlement-accept",
      battleId, accept: true });
    room.receive("alice", { type: "closeBattleJoinWindow", version: 12, requestId: "settlement-close", battleId });
    room.disconnect("bob");
    const resolved = room.receive("alice", { type: "submitAction", version: 12,
      requestId: "settlement-win", battleId, turn: 1, action: { kind: "move", moveIndex: 0 } });
    const settlements = resolved.filter((entry) => entry.message.type === "battleSettlement");
    expect(settlements).toHaveLength(2);
    expect(settlements.map((entry) => entry.audience)).toEqual([
      { playerId: "alice" }, { playerId: "bob" },
    ]);
    expect(room.connect("alice").settlement).toMatchObject({ outcome: "won", ownerId: "alice" });
    expect(room.connect("bob").settlement).toMatchObject({ outcome: "won", ownerId: "bob" });
    expect(room.receive("bob", { type: "closeSourceBattle", version: 12,
      requestId: "settlement-guest-close", battleId })[0]?.message).toMatchObject({ type: "error", code: "HOST_ONLY" });
    expect(room.receive("alice", { type: "closeSourceBattle", version: 12,
      requestId: "settlement-early-close", battleId })[0]?.message).toMatchObject({ type: "error", code: "INVALID_PHASE" });
    room.receive("alice", { type: "ackBattleSettlement", version: 12,
      requestId: "settlement-host-ack", settlementId: `${battleId}-alice` });
    expect(room.connect("alice").settlement).toBeNull();
    expect(room.connect("bob").settlement).not.toBeNull();
    expect(room.receive("alice", { type: "ackBattleSettlement", version: 12,
      requestId: "settlement-host-ack-again", settlementId: `${battleId}-alice` })[0]?.message)
      .toMatchObject({ type: "ack" });
    expect(room.receive("bob", { type: "ackBattleSettlement", version: 12,
      requestId: "settlement-wrong-owner", settlementId: `${battleId}-alice` })[0]?.message)
      .toMatchObject({ type: "error", code: "UNAUTHORIZED" });
    const closed = room.receive("alice", { type: "closeSourceBattle", version: 12,
      requestId: "settlement-host-close", battleId });
    expect(closed.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().battle).toBeNull();
    expect(room.connect("bob").settlement).toMatchObject({ ownerId: "bob", battleId });
  });

  it("suspends an owned active after disconnect and resumes the same turn", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(7), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const initial = initialBattle();
    room.receive("alice", { type: "openSourceBattle", version: 12, requestId: "resume-open",
      context: sourceBattleContext("alice"), playerTeam: initial.teams.player, opponentTeam: initial.teams.opponent });
    const battleId = room.snapshot().battle!.id;
    const guest = { ...battler("opponent"), id: "guest-active" };
    room.receive("bob", { type: "proposeBattleJoin", version: 12, requestId: "resume-join", battleId,
      side: "opponent", team: { activeIndex: 0, members: [guest] }, finalMemberIds: [guest.id] });
    room.receive("alice", { type: "respondBattleJoin", version: 12, requestId: "resume-accept", battleId,
      accept: true });
    expect(room.receive("bob", { type: "submitAction", version: 12, requestId: "resume-guest-before-drop",
      battleId, turn: 1, action: { kind: "move", moveIndex: 0 } })).toHaveLength(1);
    room.disconnect("bob");
    expect(room.receive("alice", { type: "submitAction", version: 12, requestId: "resume-host",
      battleId, turn: 1, action: { kind: "move", moveIndex: 0 } })).toHaveLength(1);
    expect(room.snapshot().battle?.state.turn).toBe(1);
    room.connect("bob");
    const resumed = room.receive("bob", { type: "submitAction", version: 12, requestId: "resume-guest-after-drop",
      battleId, turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(resumed.map((entry) => entry.message.type)).toContain("turnResolved");
    expect(room.snapshot().battle?.state.turn).toBe(2);
  });

  it("automatically replaces an unowned source Pokemon after a KO", () => {
    const room = new AuthoritativeBattleRoom("ABC234", battleWithReserve, new SeededRandom(4), worldWithSource);
    room.connect("alice");
    const initial = battleWithReserve();
    const context = { ...sourceBattleContext("alice"), rewards: {
      ...sourceBattleContext("alice").rewards,
      opponents: [
        ...sourceBattleContext("alice").rewards.opponents,
        { memberId: "opponent-reserve", species: "MEOWTH", level: 50, baseExperience: 58 },
      ],
    } };
    room.receive("alice", { type: "openSourceBattle", version: 12, requestId: "replace-open", context,
      playerTeam: initial.teams.player, opponentTeam: initial.teams.opponent });
    const battle = room.snapshot().battle!;
    const resolved = room.receive("alice", { type: "submitAction", version: 12, requestId: "replace-ko",
      battleId: battle.id, turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(resolved.map((entry) => entry.message.type)).toEqual(["ack", "turnResolved", "replacementResolved", "snapshot"]);
    expect(room.snapshot().battle?.state).toMatchObject({ replacementRequired: [],
      teams: { opponent: { activeIndex: 1 } } });
  });

  it("restores a pending SYNCED interaction before the second participant", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(4), syncedWorld);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", { type: "interact", version: 12, requestId: "sync-a" });
    expect(room.snapshot().world.session.syncedParticipants.sync).toEqual(["player"]);

    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState), syncedWorld, persisted);
    restored.receive("bob", { type: "interact", version: 12, requestId: "sync-b" });
    expect(restored.snapshot().world.session.flags).toContain("SYNC_DONE");
    expect(restored.snapshot().world.session.completedInteractions).toContain("sync");
  });
});
