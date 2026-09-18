import { MINIMAL_MOVE_CATALOG, SeededRandom, createTeamBattleState, type BattleSide, type BattlerState, type TeamBattleState } from "@pokemon-z-battle/battle-engine";
import { describe, expect, it } from "vitest";
import { AuthoritativeBattleRoom } from "../src/index.js";

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

function ready(requestId: string) {
  return { type: "setReady", version: 4, requestId, ready: true } as const;
}

describe("authoritative battle room", () => {
  it("assigns two stable seats and rejects a third player", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1));
    expect(room.connect("alice").side).toBe("player");
    expect(room.connect("bob").side).toBe("opponent");
    expect(room.connect("alice")).toMatchObject({ side: "player", reconnected: true });
    expect(() => room.connect("charlie")).toThrow("ROOM_FULL");
  });

  it("persists the room, pending intentions and RNG position", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(19));
    room.reserve("alice");
    expect(room.snapshot().players[0]).toMatchObject({ playerId: "alice", connected: false });
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("ready-a"));
    room.receive("bob", ready("ready-b"));
    room.receive("alice", { type: "submitAction", version: 4, requestId: "move-a", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });

    const state = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(state.rngState), state);
    expect(restored.snapshot()).toEqual(room.snapshot());
    const secondAction = { type: "submitAction", version: 4, requestId: "move-b", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } } as const;
    const uninterruptedOutput = room.receive("bob", secondAction);
    const restoredOutput = restored.receive("bob", secondAction);
    expect(restoredOutput).toEqual(uninterruptedOutput);
    expect(restoredOutput.some((entry) => entry.message.type === "turnResolved")).toBe(true);
  });

  it("starts only after both players are ready and resolves only after both intentions", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(24_301));
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("ready-a"));
    expect(room.snapshot().phase).toBe("waiting");
    room.receive("bob", ready("ready-b"));
    expect(room.snapshot()).toMatchObject({ phase: "battle", battle: { id: "ABC234-1", state: { turn: 1 } } });

    const first = room.receive("alice", { type: "submitAction", version: 4, requestId: "move-a", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(first.map((entry) => entry.message.type)).toEqual(["ack"]);
    expect(room.snapshot().battle?.state.turn).toBe(1);
    const second = room.receive("bob", { type: "submitAction", version: 4, requestId: "move-b", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(second.map((entry) => entry.message.type)).toEqual(["ack", "turnResolved", "snapshot"]);
    expect(room.snapshot().battle?.state.turn).toBe(2);
  });

  it("deduplicates requests and rejects stale or duplicate turn actions", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(7));
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("ready-a"));
    const firstReady = room.receive("bob", ready("ready-b"));
    const repeatedReady = room.receive("bob", ready("ready-b"));
    expect(repeatedReady[0]?.message).toEqual(firstReady[0]?.message);

    const action = { type: "submitAction", version: 4, requestId: "move-a", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } } as const;
    room.receive("alice", action);
    expect(room.receive("alice", action)[0]?.message.type).toBe("ack");
    const duplicate = room.receive("alice", { ...action, requestId: "move-a-2" });
    expect(duplicate[0]?.message).toMatchObject({ type: "error", code: "ACTION_ALREADY_SUBMITTED" });
    const stale = room.receive("bob", { ...action, requestId: "move-b", battleId: "wrong" });
    expect(stale[0]?.message).toMatchObject({ type: "error", code: "STALE_BATTLE" });
  });

  it("accepts a forced replacement before the following turn", () => {
    const room = new AuthoritativeBattleRoom("ABC234", battleWithReserve, new SeededRandom(7));
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("ready-a"));
    room.receive("bob", ready("ready-b"));
    room.receive("alice", { type: "submitAction", version: 4, requestId: "move-a", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    room.receive("bob", { type: "submitAction", version: 4, requestId: "move-b", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(room.snapshot().battle?.state.replacementRequired).toEqual(["opponent"]);

    const replacement = room.receive("bob", { type: "submitReplacement", version: 4, requestId: "replace-b", battleId: "ABC234-1", turn: 2, teamIndex: 1 });
    expect(replacement.map((entry) => entry.message.type)).toEqual(["ack", "replacementResolved", "snapshot"]);
    expect(room.snapshot().battle?.state.teams.opponent.activeIndex).toBe(1);
    expect(room.snapshot().battle?.state.replacementRequired).toEqual([]);
  });
});
