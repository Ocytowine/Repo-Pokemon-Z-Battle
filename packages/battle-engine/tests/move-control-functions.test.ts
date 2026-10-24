import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide,
  type BattlerState, type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: (max) => max - 1 };
const move = (code: BattleMove["functionCode"], category: BattleMove["category"] = "Physical"): BattleMove => ({
  ...MINIMAL_MOVE_CATALOG.TACKLE, functionCode: code, internalName: code,
  category, power: category === "Status" ? 0 : 50, accuracy: 0,
});
function pokemon(id: string, side: BattleSide, moves: readonly BattleMove[]): BattlerState {
  return { id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 300, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: side === "player" ? 100 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 300, majorStatus: null,
    ability: null, heldItem: null, moves: moves.map((entry) => ({ move: entry, pp: 10 })) };
}

describe("Torment and Imprison", () => {
  it("Torment blocks only a repeated move and survives battle serialization", () => {
    const first = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("target", "player", [move("000"), move("077")])],
      opponent: [pokemon("caster", "opponent", [move("0B7", "Status")])],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(first.state.teams.player.members[0]?.volatile?.tormented).toBe(true);
    const restored = JSON.parse(JSON.stringify(first.state)) as typeof first.state;
    const blocked = resolveTeamTurn(restored, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, rng);
    expect(blocked.events).toContainEqual({ type: "actionSkipped", side: "player", reason: "tormented" });
    expect(blocked.state.teams.player.members[0]?.moves[0]?.pp).toBe(9);
    const allowed = resolveTeamTurn(blocked.state, { player: { kind: "move", moveIndex: 1 },
      opponent: { kind: "wait" } }, rng);
    expect(allowed.state.teams.opponent.members[0]?.hp).toBeLessThan(blocked.state.teams.opponent.members[0]!.hp);
  });

  it("Imprison protects both teammates from matching moves in double battles", () => {
    const caster = pokemon("caster", "player", [move("0B8", "Status"), move("000")]);
    const state = createDoubleTeamBattleState({ player: [caster, pokemon("ally", "player", [move("077")])],
      opponent: [pokemon("enemy-a", "opponent", [move("000")]),
        pokemon("enemy-b", "opponent", [move("000")])] });
    const actions = [
      { actor: { side: "player" as const, slot: 0 }, action: { kind: "move" as const, moveIndex: 0 } },
      { actor: { side: "player" as const, slot: 1 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 0 }, action: { kind: "move" as const, moveIndex: 0 } },
      { actor: { side: "opponent" as const, slot: 1 }, action: { kind: "move" as const, moveIndex: 0 } },
    ];
    const first = resolveDoubleTeamTurn(state, actions, rng);
    expect(first.state.teams.player.members[0]?.hp).toBe(300);
    expect(first.state.teams.player.members[1]?.hp).toBe(300);
    expect(first.state.teams.player.members[0]?.volatile?.imprisoning).toBe(true);
    const restored = JSON.parse(JSON.stringify(first.state)) as typeof first.state;
    const second = resolveDoubleTeamTurn(restored, actions.map((entry) => entry.actor.side === "player"
      ? { ...entry, action: { kind: "wait" as const } } : entry), rng);
    expect(second.state.teams.player.members[0]?.hp).toBe(300);
    expect(second.state.teams.player.members[1]?.hp).toBe(300);
  });
});

describe("Magic Coat and Heal Block", () => {
  it("reflects a reflectable status move without reflecting it again", () => {
    const coat = { ...move("0B1", "Status"), targetCode: "10", priority: 4 };
    const torment = { ...move("0B7", "Status"), flags: "c" };
    const first = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("coated", "player", [coat])],
      opponent: [pokemon("caster", "opponent", [torment])],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(first.events).toContainEqual({ type: "moveReflected", source: "opponent", target: "player", move: "0B7" });
    expect(first.state.teams.player.members[0]?.volatile?.tormented).toBe(false);
    expect(first.state.teams.opponent.members[0]?.volatile?.tormented).toBe(true);
    expect(first.state.teams.player.members[0]?.volatile?.magicCoat).toBe(false);
  });

  it("blocks healing moves and residual recovery until the block expires", () => {
    const heal = { ...move("0D5", "Status"), targetCode: "10" };
    const first = resolveTeamTurn(createTeamBattleState({
      player: [{ ...pokemon("target", "player", [heal]), hp: 100,
        volatile: { aquaRing: true } }],
      opponent: [pokemon("caster", "opponent", [{ ...move("0BB", "Status"), priority: 1 }])],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(first.events).toContainEqual({ type: "actionSkipped", side: "player", reason: "heal-blocked" });
    expect(first.state.teams.player.members[0]?.hp).toBe(100);
    expect(first.state.teams.player.members[0]?.volatile?.healBlockTurns).toBe(4);
    const restored = JSON.parse(JSON.stringify(first.state)) as typeof first.state;
    const second = resolveTeamTurn(restored, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, rng);
    expect(second.events).toContainEqual({ type: "actionSkipped", side: "player", reason: "heal-blocked" });
    expect(second.state.teams.player.members[0]?.hp).toBe(100);
  });

  it("uses the same reflection and healing block in a double battle after snapshot restore", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("coated", "player", [{ ...move("0B1", "Status"), targetCode: "10", priority: 4 }]),
        { ...pokemon("healer", "player", [{ ...move("0D5", "Status"), targetCode: "10" }]), hp: 100 }],
      opponent: [pokemon("caster", "opponent", [{ ...move("0B7", "Status"), flags: "c" }]),
        pokemon("blocker", "opponent", [{ ...move("0BB", "Status"), priority: 1 }])],
    });
    const first = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 0 } } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 1 } } },
    ], rng);
    expect(first.state.teams.opponent.members[0]?.volatile?.tormented).toBe(true);
    expect(first.state.teams.player.members[1]?.volatile?.healBlockTurns).toBe(4);
    expect(first.state.teams.player.members[1]?.hp).toBe(100);
    const restored = JSON.parse(JSON.stringify(first.state)) as typeof first.state;
    const second = resolveDoubleTeamTurn(restored, [
      { actor: { side: "player", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "player", slot: 1 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(second.state.teams.player.members[1]?.hp).toBe(100);
  });
});

describe("Copycat and Me First", () => {
  it("copies the globally last move after a serialized turn, with its own PP", () => {
    const first = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("copy", "player", [move("0AF", "Status")])],
      opponent: [pokemon("original", "opponent", [move("000")])],
    }), { player: { kind: "wait" }, opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(first.state.effects?.lastMoveUsed?.functionCode).toBe("000");
    const restored = JSON.parse(JSON.stringify(first.state)) as typeof first.state;
    const copied = resolveTeamTurn(restored, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, rng);
    expect(copied.events).toContainEqual({ type: "moveUsed", side: "player", move: "000" });
    expect(copied.state.teams.player.members[0]?.moves[0]?.pp).toBe(9);
    expect(copied.state.teams.opponent.members[0]?.hp).toBeLessThan(300);
  });

  it("Me First copies a pending damaging move with boosted power, but fails after its target moved", () => {
    const state = createTeamBattleState({
      player: [pokemon("first", "player", [move("0B0", "Status")])],
      opponent: [pokemon("second", "opponent", [move("000")])],
    });
    const copied = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(copied.events).toContainEqual({ type: "moveUsed", side: "player", move: "000" });
    const standard = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("first", "player", [move("000")])],
      opponent: [pokemon("second", "opponent", [move("000")])],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(copied.state.teams.opponent.members[0]!.hp).toBeLessThan(standard.state.teams.opponent.members[0]!.hp);
    const slower = createTeamBattleState({ player: [{ ...pokemon("first", "player", [move("0B0", "Status")]),
      stats: { ...pokemon("first", "player", []).stats, speed: 50 } }],
    opponent: [pokemon("second", "opponent", [move("000")])] });
    const failed = resolveTeamTurn(slower, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(failed.events).toContainEqual({ type: "moveFailed", side: "player", move: "0B0", reason: "condition" });
  });

  it("resolves a copied spread move in doubles and retains the shared last move", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("first", "player", [move("0B0", "Status")]),
        pokemon("copy", "player", [move("0AF", "Status")])],
      opponent: [pokemon("source", "opponent", [{ ...move("000"), targetCode: "04" }]),
        pokemon("other", "opponent", [move("000")])],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.opponent.members[0]!.hp).toBeLessThan(300);
    expect(result.state.teams.opponent.members[1]!.hp).toBeLessThan(300);
    expect(result.state.effects?.lastMoveUsed?.functionCode).toBe("000");
  });
});

describe("Sleep Talk and Assist", () => {
  it("calls an eligible own move while asleep and leaves that move's PP intact", () => {
    const sleeper = { ...pokemon("sleeper", "player", [move("0B4", "Status"), move("000")]),
      majorStatus: { kind: "sleep" as const, turnsRemaining: 3 } };
    const result = resolveTeamTurn(createTeamBattleState({ player: [sleeper],
      opponent: [pokemon("target", "opponent", [move("077")])] }),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(result.events).toContainEqual({ type: "moveUsed", side: "player", move: "000" });
    expect(result.state.teams.opponent.members[0]!.hp).toBeLessThan(300);
    expect(result.state.teams.player.members[0]?.moves.map((slot) => slot.pp)).toEqual([9, 10]);
    expect(result.state.teams.player.members[0]?.majorStatus).toEqual({ kind: "sleep", turnsRemaining: 2 });
  });

  it("Assist uses an eligible reserve move even when its owner is fainted", () => {
    const result = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("caller", "player", [move("0B5", "Status")]),
        { ...pokemon("reserve", "player", [move("000")]), hp: 0 }],
      opponent: [pokemon("target", "opponent", [move("077")])],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(result.events).toContainEqual({ type: "moveUsed", side: "player", move: "000" });
    expect(result.state.teams.opponent.members[0]!.hp).toBeLessThan(300);
  });

  it("expands a called spread move to both opponents in doubles", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("caller", "player", [move("0B5", "Status")]),
        pokemon("partner", "player", [move("077")]),
        pokemon("reserve", "player", [{ ...move("000"), targetCode: "04" }])],
      opponent: [pokemon("target-a", "opponent", [move("077")]),
        pokemon("target-b", "opponent", [move("077")])],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.opponent.members[0]!.hp).toBeLessThan(300);
    expect(result.state.teams.opponent.members[1]!.hp).toBeLessThan(300);
    expect(result.trace).toContainEqual({ type: "rng", purpose: "called-move", maxExclusive: 2, value: 1 });
  });
});

describe("Snatch", () => {
  it("steals a flagged self-boost instead of granting it to its original user", () => {
    const snatch = { ...move("0B2", "Status"), targetCode: "10", priority: 4 };
    const boost = { ...move("02E", "Status"), targetCode: "10", flags: "d" };
    const first = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("thief", "player", [snatch])],
      opponent: [pokemon("booster", "opponent", [boost])],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(first.events).toContainEqual({ type: "moveSnatched", source: "opponent", target: "player", move: "02E" });
    expect(first.state.teams.player.members[0]?.stages.attack).toBe(2);
    expect(first.state.teams.opponent.members[0]?.stages.attack).toBe(0);
    expect(first.state.teams.player.members[0]?.volatile?.snatching).toBe(false);
  });

  it("routes a teammate's flagged move to the opposing snatcher in doubles", () => {
    const snatch = { ...move("0B2", "Status"), targetCode: "10", priority: 4 };
    const boost = { ...move("02E", "Status"), targetCode: "10", flags: "d" };
    const result = resolveDoubleTeamTurn(createDoubleTeamBattleState({
      player: [pokemon("thief", "player", [snatch]), pokemon("ally", "player", [move("077")])],
      opponent: [pokemon("booster", "opponent", [boost]), pokemon("other", "opponent", [move("077")])],
    }), [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.player.members[0]?.stages.attack).toBe(2);
    expect(result.state.teams.opponent.members[0]?.stages.attack).toBe(0);
  });
});
