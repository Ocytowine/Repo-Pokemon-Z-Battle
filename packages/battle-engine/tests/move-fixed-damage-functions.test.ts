import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createTeamBattleState, resolveTeamTurn,
  type BattleMove, type BattlerState, type RandomSource } from "../src/index.js";

const zero: RandomSource = { nextInt: () => 0 };
const miss: RandomSource = { nextInt: () => 99 };

function battler(id: string, overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 200, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: id === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 200, majorStatus: null,
    ability: null, heldItem: null, moves: [{ move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 20 }], ...overrides };
}

function move(code: BattleMove["functionCode"], type = "NORMAL", accuracy = 100): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.TACKLE, functionCode: code, internalName: `MOVE${code}`,
    name: `MOVE${code}`, type, category: "Physical", power: 1, accuracy,
    effectChance: 0 };
}

function use(code: BattleMove["functionCode"], player: Partial<BattlerState> = {},
  opponent: Partial<BattlerState> = {}, type = "NORMAL", rng = zero, accuracy = 100) {
  const state = createTeamBattleState({ player: [battler("player", { ...player,
    moves: [{ move: move(code, type, accuracy), pp: 10 }] })],
  opponent: [battler("opponent", opponent)] });
  return resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
    opponent: { kind: "wait" } }, rng);
}

describe("Pokemon Z fixed-damage move functions", () => {
  it.each([["06A", 20], ["06B", 40]] as const)("%s deals exactly %i HP", (code, amount) => {
    const result = use(code, {}, { stats: { ...battler("opponent").stats, defense: 999 } },
      code === "06B" ? "DRAGON" : "NORMAL");
    expect(result.state.teams.opponent.members[0]!.hp).toBe(200 - amount);
    expect(result.events).toContainEqual(expect.objectContaining({
      type: "damageApplied", amount, critical: false,
    }));
    const immune = use(code, {}, { types: [code === "06B" ? "FAIRY" : "GHOST"] },
      code === "06B" ? "DRAGON" : "NORMAL");
    expect(immune.state.teams.opponent.members[0]!.hp).toBe(200);
  });

  it("halves current HP for Super Fang, rounded down with a minimum of one", () => {
    expect(use("06C", {}, { hp: 75 }).state.teams.opponent.members[0]!.hp).toBe(38);
    expect(use("06C", {}, { hp: 1 }).state.teams.opponent.members[0]!.hp).toBe(0);
  });

  it("does not scale fixed damage with Parental Bond", () => {
    const result = use("06A", { ability: "PARENTALBOND" });
    expect(result.state.teams.opponent.members[0]!.hp).toBe(180);
    expect(result.events.filter((event) => event.type === "damageApplied")).toHaveLength(1);
  });

  it("makes Endeavor fail unless the user's HP is strictly lower", () => {
    expect(use("06E", { hp: 31 }, { hp: 93 }).state.teams.opponent.members[0]!.hp).toBe(31);
    const failed = use("06E", { hp: 93 }, { hp: 31 });
    expect(failed.state.teams.opponent.members[0]!.hp).toBe(31);
    expect(failed.events).toContainEqual(expect.objectContaining({ type: "moveFailed" }));
  });

  it("uses OHKO level-based accuracy without accuracy stages and blocks Sturdy", () => {
    const landed = use("070", {}, {}, "GROUND", zero, 30);
    expect(landed.state.teams.opponent.members[0]!.hp).toBe(0);
    const tooLow = use("070", { level: 49 }, {}, "GROUND", zero, 30);
    expect(tooLow.state.teams.opponent.members[0]!.hp).toBe(200);
    expect(tooLow.trace).not.toContainEqual(expect.objectContaining({
      type: "rng", purpose: "accuracy",
    }));
    const missed = use("070", {}, {}, "GROUND", miss, 30);
    expect(missed.events).toContainEqual(expect.objectContaining({ type: "moveMissed" }));
    const sturdy = use("070", {}, { ability: "STURDY", hp: 100 }, "GROUND", zero, 30);
    expect(sturdy.state.teams.opponent.members[0]!.hp).toBe(100);
    expect(sturdy.events).toContainEqual(expect.objectContaining({
      type: "abilityActivated", ability: "STURDY", effect: "block-move",
    }));
    const breaker = use("070", { ability: "MOLDBREAKER" }, { ability: "STURDY", hp: 100 },
      "GROUND", zero, 30);
    expect(breaker.state.teams.opponent.members[0]!.hp).toBe(0);
  });
});
