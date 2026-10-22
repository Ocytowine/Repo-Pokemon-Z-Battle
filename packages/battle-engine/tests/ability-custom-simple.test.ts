import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, calculateDamage, createTeamBattleState, resolveTeamTurn,
  type BattleMove, type BattleSide, type BattleTrace, type BattlerState, type RandomSource } from "../src/index.js";
import { damageAbilityStatReaction } from "../src/ability-stat-reactions.js";
import { resolveLateEndOfTurnAbilities } from "../src/ability-end-turn.js";

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
  const move = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.GROWL;
  return {
    id: side, species: side === "player" ? "PIKACHU" : "EEVEE", name: side, level: 50,
    types: ["NORMAL"],
    stats: { maxHp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 100 : 90 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0,
      accuracy: 0, evasion: 0 },
    hp: 100, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move, pp: move.pp }], ...overrides,
  };
}

function contactMove(overrides: Partial<BattleMove> = {}): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0, flags: "a", ...overrides };
}

describe("Pokemon Z's simple custom abilities", () => {
  it("boosts only Electric damage at or below Sobrecarga's one-third HP threshold", () => {
    const move = contactMove({ internalName: "SPARK", name: "Étincelle", type: "ELECTRIC" });
    const trace: BattleTrace[] = [];
    const boosted = calculateDamage("player", battler("player", { hp: 33, ability: "SOBRECARGA" }),
      battler("opponent"), move, new ScriptedRandom([1, 15]), trace);
    const above = calculateDamage("player", battler("player", { hp: 34, ability: "SOBRECARGA" }),
      battler("opponent"), move, new ScriptedRandom([1, 15]), []);
    const wrongType = calculateDamage("player", battler("player", { hp: 33, ability: "SOBRECARGA" }),
      battler("opponent"), { ...move, type: "FIRE" }, new ScriptedRandom([1, 15]), []);

    expect(boosted).toBeGreaterThan(above);
    expect(wrongType).toBe(above);
    expect(trace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifiers: [{ ability: "SOBRECARGA", multiplier: 1.5 }] }));
  });

  it("activates Coraza Ira only when a hit crosses strictly through half HP", () => {
    const target = battler("opponent", { ability: "CORAZAIRA" });
    const move = contactMove();
    expect(damageAbilityStatReaction(target, move, 51, 49, false)).toMatchObject({
      ability: "CORAZAIRA", changes: [
        { stat: "specialAttack", delta: 1 }, { stat: "attack", delta: 1 },
      ],
    });
    expect(damageAbilityStatReaction(target, move, 51, 50, false)).toBeNull();
    expect(damageAbilityStatReaction(target, move, 50, 40, false)).toBeNull();

    const hit = resolveTeamTurn(createTeamBattleState({
      player: [battler("player", { moves: [{ move, pp: move.pp }] })],
      opponent: [battler("opponent", { hp: 60, ability: "CORAZAIRA" })],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } },
    new ScriptedRandom([1, 15]));
    expect(hit.state.teams.opponent.members[0]?.stages).toMatchObject({ attack: 1, specialAttack: 1 });
    expect(hit.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "CORAZAIRA", effect: "raise-stat" });
  });

  it("arms Dinamo and raises Special Defense only while Charge is inactive", () => {
    const move = contactMove();
    const charged = resolveTeamTurn(createTeamBattleState({
      player: [battler("player", { moves: [{ move, pp: move.pp }] })],
      opponent: [battler("opponent", { ability: "DINAMO", hp: 200,
        stats: { ...battler("opponent").stats, maxHp: 200 } })],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } },
    new ScriptedRandom([1, 15]));
    expect(charged.state.teams.opponent.members[0]).toMatchObject({
      stages: { specialDefense: 1 }, volatile: { chargeTurns: 1 },
    });
    expect(charged.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "DINAMO", effect: "charge" });

    const alreadyCharged = resolveTeamTurn(charged.state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } },
      new ScriptedRandom([1, 15]));
    expect(alreadyCharged.state.teams.opponent.members[0]?.stages.specialDefense).toBe(1);
    expect(alreadyCharged.events).not.toContainEqual(expect.objectContaining({
      type: "abilityActivated", ability: "DINAMO",
    }));
  });

  it("uses the source contact chances for Toque Magico and Relampagueo", () => {
    const move = contactMove();
    const magic = resolveTeamTurn(createTeamBattleState({
      player: [battler("player", { ability: "TOQUEMAGICO", moves: [{ move, pp: move.pp }] })],
      opponent: [battler("opponent")],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } },
    new ScriptedRandom([1, 15, 1, 3]));
    expect(magic.state.teams.opponent.members[0]?.volatile?.confusionTurns).toBe(5);
    expect(magic.events).toContainEqual({ type: "abilityActivated", side: "player",
      ability: "TOQUEMAGICO", effect: "inflict-status" });

    const lightning = resolveTeamTurn(createTeamBattleState({
      player: [battler("player", { ability: "RELAMPAGUEO", moves: [{ move, pp: move.pp }] })],
      opponent: [battler("opponent")],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } },
    new ScriptedRandom([1, 15, 2]));
    expect(lightning.state.teams.opponent.members[0]?.majorStatus).toEqual({ kind: "paralysis" });
    expect(lightning.events).toContainEqual({ type: "abilityActivated", side: "player",
      ability: "RELAMPAGUEO", effect: "inflict-status" });
  });

  it("stacks each distinct nightmare aura once and lets Magic Guard prevent both", () => {
    const sleeper = battler("player", { hp: 120, stats: { ...battler("player").stats, maxHp: 120 },
      majorStatus: { kind: "sleep", turnsRemaining: 2 } });
    const opponents = [battler("opponent", { ability: "BADDREAMS" }),
      battler("opponent", { id: "nightmare", ability: "GRANPESADILLA" })];
    const result = resolveLateEndOfTurnAbilities(sleeper, "player", opponents);
    expect(result.battler.hp).toBe(70);
    expect(result.events.filter((event) => event.type === "abilityDamage")).toEqual([
      expect.objectContaining({ ability: "BADDREAMS", amount: 20 }),
      expect.objectContaining({ ability: "GRANPESADILLA", amount: 30 }),
    ]);

    const protectedResult = resolveLateEndOfTurnAbilities({ ...sleeper, ability: "MAGICGUARD" },
      "player", opponents);
    expect(protectedResult.battler.hp).toBe(120);
    expect(protectedResult.events).toEqual([]);
  });
});
