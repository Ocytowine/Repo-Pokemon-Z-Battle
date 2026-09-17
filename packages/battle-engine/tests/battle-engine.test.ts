import { describe, expect, it } from "vitest";
import {
  MINIMAL_MOVE_CATALOG,
  SeededRandom,
  calculateDamage,
  resolveTurn,
  typeEffectiveness,
  type BattleSide,
  type BattleState,
  type BattleTrace,
  type BattlerState,
  type RandomSource,
} from "../src/index.js";

class ScriptedRandom implements RandomSource {
  private index = 0;

  public constructor(private readonly values: readonly number[]) {}

  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index++];
    if (value === undefined || value < 0 || value >= maxExclusive) {
      throw new Error(`Missing or invalid scripted RNG value for nextInt(${maxExclusive}).`);
    }
    return value;
  }
}

function battler(side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
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
    moves: [{ move, pp: move.pp }],
    ...overrides,
  };
}

function battle(player = battler("player"), opponent = battler("opponent")): BattleState {
  return { turn: 1, status: "active", winner: null, battlers: { player, opponent } };
}

describe("Pokemon Z reference calculations", () => {
  it("matches the neutral level 50 damage formula, variance and STAB", () => {
    const trace: BattleTrace[] = [];
    const damage = calculateDamage(
      "player",
      battler("player"),
      battler("opponent"),
      MINIMAL_MOVE_CATALOG.TACKLE,
      new ScriptedRandom([1, 15]),
      trace,
    );

    expect(damage).toBe(29);
    expect(trace.at(-1)).toMatchObject({ type: "damage", baseDamage: 19, critical: false, variance: 100, stab: 1.5, effectiveness: 1, result: 29 });
  });

  it("matches STAB and super-effective rounding for Water Gun", () => {
    const attacker = battler("player", { types: ["WATER"] });
    const defender = battler("opponent", { types: ["FIRE"] });
    const damage = calculateDamage("player", attacker, defender, MINIMAL_MOVE_CATALOG.WATERGUN, new ScriptedRandom([1, 15]), []);
    expect(damage).toBe(64);
  });

  it("supports weaknesses, dual-type multipliers and immunities from types.txt", () => {
    expect(typeEffectiveness("WATER", ["FIRE", "ROCK"])).toBe(4);
    expect(typeEffectiveness("NORMAL", ["GHOST"])).toBe(0);
    expect(typeEffectiveness("GRASS", ["FIRE", "ROCK"])).toBe(1);
  });

  it("matches the default 1/16 critical hit and 1.5 multiplier", () => {
    const attacker = battler("player", { stages: { ...battler("player").stages, attack: -6 } });
    const defender = battler("opponent", { stages: { ...battler("opponent").stages, defense: 6 } });
    const damage = calculateDamage("player", attacker, defender, MINIMAL_MOVE_CATALOG.TACKLE, new ScriptedRandom([0, 15]), []);
    expect(damage).toBe(44);
  });
});

describe("resolveTurn", () => {
  it("uses move priority before speed and skips a fainted battler", () => {
    const quickAttack = MINIMAL_MOVE_CATALOG.QUICKATTACK;
    const player = battler("player", {
      stats: { maxHp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 1 },
      moves: [{ move: quickAttack, pp: quickAttack.pp }],
    });
    const opponent = battler("opponent", { hp: 1 });
    const result = resolveTurn(battle(player, opponent), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new ScriptedRandom([99, 1, 15]));

    expect(result.events).toContainEqual({ type: "actionOrdered", order: ["player", "opponent"] });
    expect(result.events).toContainEqual({ type: "actionSkipped", side: "opponent", reason: "fainted" });
    expect(result.state).toMatchObject({ status: "finished", winner: "player", turn: 2 });
    expect(result.state.battlers.opponent.hp).toBe(0);
  });

  it("draws a speed tie exactly like Pokemon Z", () => {
    const opponent = battler("opponent", { stats: { ...battler("opponent").stats, speed: 100 } });
    const result = resolveTurn(battle(battler("player"), opponent), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new ScriptedRandom([0, 99, 1, 15, 99, 1, 15]));
    expect(result.events[1]).toEqual({ type: "actionOrdered", order: ["opponent", "player"] });
    expect(result.trace[2]).toEqual({ type: "rng", purpose: "speed-tie", maxExclusive: 2, value: 0 });
  });

  it("does not consume an accuracy draw for a move whose accuracy is zero", () => {
    const swift = MINIMAL_MOVE_CATALOG.SWIFT;
    const player = battler("player", { moves: [{ move: swift, pp: swift.pp }] });
    const result = resolveTurn(battle(player), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new ScriptedRandom([1, 15, 99, 1, 15]));
    const purposes = result.trace.filter((entry) => entry.type === "rng").map((entry) => entry.purpose);
    expect(purposes).toEqual(["critical", "damage-variance", "accuracy", "critical", "damage-variance"]);
  });

  it("is reproducible with the same seed and does not mutate its input", () => {
    const initial = battle();
    const snapshot = structuredClone(initial);
    const actions = { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } } as const;
    const first = resolveTurn(initial, actions, new SeededRandom(0x5eed));
    const second = resolveTurn(initial, actions, new SeededRandom(0x5eed));
    expect(first).toEqual(second);
    expect(initial).toEqual(snapshot);
  });

  it("spends PP on a miss and exposes every RNG draw", () => {
    const inaccurate = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 50 };
    const player = battler("player", { moves: [{ move: inaccurate, pp: 1 }] });
    const result = resolveTurn(battle(player), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new ScriptedRandom([50, 99, 1, 15]));
    expect(result.events).toContainEqual({ type: "moveMissed", side: "player", move: "TACKLE" });
    expect(result.state.battlers.player.moves[0]?.pp).toBe(0);
  });
});
