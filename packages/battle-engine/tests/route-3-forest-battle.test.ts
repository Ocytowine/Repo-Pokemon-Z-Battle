import { describe, expect, it } from "vitest";
import { calculateDamage, MINIMAL_MOVE_CATALOG, resolveTurn,
  type BattleMove, type BattleSide, type BattleState, type BattlerState, type RandomSource } from "../src/index.js";

class ScriptedRandom implements RandomSource {
  private index = 0;
  public constructor(private readonly values: readonly number[]) {}
  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index++];
    if (value === undefined || value < 0 || value >= maxExclusive) throw new Error(`RNG ${maxExclusive} manquant.`);
    return value;
  }
}

function battler(side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const move = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return { id: side, species: "EEVEE", name: side, level: 30, types: ["NORMAL"], hp: 100,
    stats: { maxHp: 100, attack: 80, defense: 80, specialAttack: 80, specialDefense: 80,
      speed: side === "player" ? 90 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    majorStatus: null, ability: null, heldItem: null, moves: [{ move, pp: move.pp }], ...overrides };
}

function battle(player: BattlerState, opponent = battler("opponent")): BattleState {
  return { turn: 1, status: "active", winner: null, battlers: { player, opponent } };
}

function move(internalName: string, functionCode: BattleMove["functionCode"], category: BattleMove["category"],
  power = 0, effectChance = 0): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName, name: internalName, functionCode, category, power,
    accuracy: 0, effectChance };
}

describe("Route 3 to Bois-en-Tronc battle dependencies", () => {
  it("ports the two-stage trainer stat moves and Recover", () => {
    for (const [testedMove, stat, expected] of [
      [move("AMNESIA", "033", "Status"), "specialDefense", 2],
      [move("SCREECH", "04C", "Status"), "defense", -2],
      [move("FAKETEARS", "04F", "Status"), "specialDefense", -2],
    ] as const) {
      const player = battler("player", { moves: [{ move: testedMove, pp: 10 }] });
      const result = resolveTurn(battle(player), { player: { kind: "move", moveIndex: 0 },
        opponent: { kind: "move", moveIndex: 0 } }, new ScriptedRandom([99, 1, 15]));
      const target = expected > 0 ? result.state.battlers.player : result.state.battlers.opponent;
      expect(target.stages[stat]).toBe(expected);
    }
    const recover = move("RECOVER", "0D5", "Status");
    const healed = resolveTurn(battle(battler("player", { hp: 20, moves: [{ move: recover, pp: 10 }] })),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([99, 1, 15]));
    expect(healed.events).toContainEqual(expect.objectContaining({ type: "hpRestored", side: "player", amount: 50 }));
  });

  it("resolves Double Kick as exactly two hits", () => {
    const doubleKick = move("DOUBLEKICK", "0BD", "Physical", 30);
    const result = resolveTurn(battle(battler("player", { moves: [{ move: doubleKick, pp: 30 }] }),
      battler("opponent", { hp: 500, stats: { ...battler("opponent").stats, maxHp: 500 } })),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
    new ScriptedRandom([1, 15, 1, 15, 99, 1, 15]));
    expect(result.events.filter((event) => event.type === "damageApplied" && event.source === "player")).toHaveLength(2);
  });

  it("resolves Twineedle as two hits with one poison chance per landed hit", () => {
    const twineedle = move("TWINEEDLE", "0BE", "Physical", 25, 20);
    const result = resolveTurn(battle(battler("player", { ability: "CORROSION",
      moves: [{ move: twineedle, pp: 20 }] }),
      battler("opponent", { types: ["STEEL"], hp: 500,
        stats: { ...battler("opponent").stats, maxHp: 500 } })),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
    new ScriptedRandom([1, 15, 1, 15, 99, 0, 99, 1, 15]));
    expect(result.events.filter((event) => event.type === "damageApplied" && event.source === "player")).toHaveLength(2);
    expect(result.state.battlers.opponent.majorStatus).toEqual({ kind: "poison", toxicCounter: null });
    expect(result.events).toContainEqual({ type: "statusApplied", source: "player",
      target: "opponent", status: "poison" });
  });

  it("applies both source screens and sport fields to their matching damage category", () => {
    const attacker = battler("player", { types: ["ELECTRIC"] });
    const target = battler("opponent");
    const electric = { ...MINIMAL_MOVE_CATALOG.WATERGUN, type: "ELECTRIC" };
    const plain = calculateDamage("player", attacker, target, electric, new ScriptedRandom([1, 15]), []);
    const reduced = calculateDamage("player", attacker, target, electric, new ScriptedRandom([1, 15]), [],
      { reflect: false, lightScreen: true, luckyChant: false, mudSport: true, waterSport: false });
    expect(reduced).toBeLessThan(plain / 2);
  });

  it("uses the shared deterministic abilities for the route trainers", () => {
    const boosted = calculateDamage("player", battler("player", { ability: "PIELHERBACEA", types: ["GRASS"] }),
      battler("opponent", { types: ["WATER"] }), MINIMAL_MOVE_CATALOG.TACKLE,
      new ScriptedRandom([1, 15]), []);
    const neutral = calculateDamage("player", battler("player"), battler("opponent", { types: ["WATER"] }),
      MINIMAL_MOVE_CATALOG.TACKLE, new ScriptedRandom([1, 15]), []);
    expect(boosted).toBeGreaterThan(neutral);
    const unaware = calculateDamage("player", battler("player", { stages: { ...battler("player").stages, attack: 6 } }),
      battler("opponent", { ability: "UNAWARE" }), MINIMAL_MOVE_CATALOG.TACKLE,
      new ScriptedRandom([1, 15]), []);
    expect(unaware).toBe(neutral);
  });
});
