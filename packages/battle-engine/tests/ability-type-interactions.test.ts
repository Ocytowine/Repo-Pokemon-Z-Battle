import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn,
  type BattleMove, type BattleSide, type BattleTrace, type BattlerState, type RandomSource } from "../src/index.js";

const highRolls: RandomSource = { nextInt: (maximum) => Math.max(0, maximum - 1) };

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const source = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return {
    id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 240, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 240, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: { ...source, accuracy: 0 }, pp: source.pp }], ...overrides,
  };
}

function move(type: string, overrides: Partial<BattleMove> = {}): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: `TEST${type}`, name: type,
    type, power: 80, accuracy: 0, ...overrides };
}

function damage(attacker: BattlerState, defender: BattlerState, usedMove: BattleMove): {
  readonly value: number; readonly trace: BattleTrace[];
} {
  const trace: BattleTrace[] = [];
  return { value: calculateDamage("player", attacker, defender, usedMove, highRolls, trace), trace };
}

describe("Pokemon Z type-interaction abilities", () => {
  it("makes every Normalize move Normal and applies its 1.5 power boost", () => {
    const target = pokemon("target", "opponent");
    const water = move("WATER");
    const normal = move("NORMAL");
    const normalizedWater = damage(pokemon("normalize", "player", { ability: "NORMALIZE" }), target, water);
    const normalizedNormal = damage(pokemon("normalize", "player", { ability: "NORMALIZE" }), target, normal);
    expect(normalizedWater.value).toBe(normalizedNormal.value);
    expect(normalizedWater.value).toBeGreaterThan(damage(pokemon("plain", "player"), target, normal).value);
    expect(normalizedWater.trace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifiers: expect.arrayContaining([{ ability: "NORMALIZE", multiplier: 1.5 }]) }));
    expect(damage(pokemon("normalize", "player", { ability: "NORMALIZE" }),
      pokemon("ghost", "opponent", { types: ["GHOST"] }), water).value).toBe(0);
  });

  it.each([
    ["COLEOPTERO", "BUG", "GRASS", 1.2],
    ["PIELMALDITA", "GHOST", "GHOST", 1.2],
    ["PIELELECTRICA", "ELECTRIC", "WATER", 1.2],
    ["TINTINEO", "PSYCHIC", "POISON", 1],
  ] as const)("converts Normal moves with %s into %s using the exact source boost",
  (ability, effectiveType, targetType, abilityBoost) => {
    const normal = move("NORMAL");
    const attacker = pokemon("converter", "player", { ability });
    const converted = damage(attacker, pokemon("target", "opponent", { types: [targetType] }), normal);
    expect(converted.trace).toContainEqual(expect.objectContaining({ type: "damage", effectiveness: 2 }));
    if (abilityBoost === 1) {
      expect(converted.trace).toContainEqual(expect.objectContaining({ type: "damage",
        abilityModifiers: expect.not.arrayContaining([{ ability, multiplier: 1.2 }]) }));
    } else {
      expect(converted.trace).toContainEqual(expect.objectContaining({ type: "damage",
        abilityModifiers: expect.arrayContaining([{ ability, multiplier: abilityBoost }]) }));
    }
    const nonNormal = move("WATER");
    expect(damage(attacker, pokemon("plain", "opponent"), nonNormal).value)
      .toBe(damage(pokemon("plain", "player"), pokemon("plain", "opponent"), nonNormal).value);
    expect(effectiveType).not.toBe("NORMAL");
  });

  it("announces Tintineo once on entry", () => {
    const state = createTeamBattleState({ player: [pokemon("bell", "player", { ability: "TINTINEO" })],
      opponent: [pokemon("target", "opponent")] });
    const first = resolveTeamTurn(state,
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, highRolls);
    expect(first.events).toContainEqual({ type: "abilityActivated", side: "player",
      ability: "TINTINEO", effect: "announce" });
    const second = resolveTeamTurn(first.state,
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, highRolls);
    expect(second.events).not.toContainEqual(expect.objectContaining({ type: "abilityActivated",
      ability: "TINTINEO", effect: "announce" }));
  });

  it("uses the converted Electric type independently for each spread target", () => {
    const normal = move("NORMAL", { targetCode: "04" });
    const state = createDoubleTeamBattleState({
      player: [pokemon("converter", "player", { ability: "PIELELECTRICA",
        moves: [{ move: normal, pp: normal.pp }] }), pokemon("ally", "player")],
      opponent: [pokemon("absorber", "opponent", { ability: "VOLTABSORB", hp: 180 }),
        pokemon("open", "opponent")],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], highRolls);
    expect(result.state.teams.opponent.members[0]!.hp).toBe(240);
    expect(result.state.teams.opponent.members[1]!.hp).toBeLessThan(240);
  });

  it("boosts only Steel moves with Steelworker", () => {
    const target = pokemon("target", "opponent");
    const steel = move("STEEL");
    const boosted = damage(pokemon("worker", "player", { ability: "STEELWORKER" }), target, steel);
    expect(boosted.value).toBeGreaterThan(damage(pokemon("plain", "player"), target, steel).value);
    expect(boosted.trace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifiers: expect.arrayContaining([{ ability: "STEELWORKER", multiplier: 1.5 }]) }));
    expect(damage(pokemon("worker", "player", { ability: "STEELWORKER" }), target, move("WATER")).value)
      .toBe(damage(pokemon("plain", "player"), target, move("WATER")).value);
  });

  it.each([
    ["ALBINISMO", "ICE"],
    ["PEDANTE", "PSYCHIC"],
    ["INFLAMABLE", "FIRE"],
    ["TRANSPORTARROCA", "ROCK"],
    ["DRAGONSMAW", "DRAGON"],
  ] as const)("boosts only %s's matching %s effective type by 1.5", (ability, type) => {
    const matchingMove = move(type);
    const plainTarget = pokemon("target", "opponent");
    const boosted = damage(pokemon("booster", "player", { ability, types: [type] }), plainTarget, matchingMove);
    const neutral = damage(pokemon("plain", "player", { types: [type] }), plainTarget, matchingMove);
    expect(boosted.value).toBeGreaterThan(neutral.value);
    expect(boosted.trace).toContainEqual(expect.objectContaining({ type: "damage", stab: 1.5,
      abilityModifiers: expect.arrayContaining([{ ability, multiplier: 1.5 }]) }));
    expect(damage(pokemon("booster", "player", { ability }), plainTarget, move("WATER")).value)
      .toBe(damage(pokemon("plain", "player"), plainTarget, move("WATER")).value);
    expect(damage(pokemon("booster", "player", { ability }),
      pokemon("breaker-target", "opponent", { ability: "MOLDBREAKER" }), matchingMove).trace)
      .toContainEqual(expect.objectContaining({ type: "damage",
        abilityModifiers: expect.arrayContaining([{ ability, multiplier: 1.5 }]) }));
  });

  it("applies an offensive type boost to every target of a spread move", () => {
    const rock = move("ROCK", { targetCode: "04" });
    const state = createDoubleTeamBattleState({
      player: [pokemon("carrier", "player", { ability: "TRANSPORTARROCA",
        moves: [{ move: rock, pp: rock.pp }] }), pokemon("ally", "player")],
      opponent: [pokemon("first", "opponent"), pokemon("second", "opponent")],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], highRolls);
    const traces = result.trace.filter((entry): entry is Extract<BattleTrace, { type: "damage" }> =>
      entry.type === "damage" && entry.move === rock.internalName);
    expect(traces).toHaveLength(2);
    expect(traces.every((entry) => entry.abilityModifiers
      .some((modifier) => modifier.ability === "TRANSPORTARROCA" && modifier.multiplier === 1.5))).toBe(true);
  });

  it("reduces Flying and Rock damage with Canasto unless Mold Breaker bypasses it", () => {
    const basket = pokemon("basket", "opponent", { ability: "CANASTO" });
    const plain = pokemon("plain", "opponent");
    for (const type of ["FLYING", "ROCK"]) {
      const usedMove = move(type);
      const reduced = damage(pokemon("attacker", "player"), basket, usedMove);
      expect(reduced.value).toBeLessThan(damage(pokemon("attacker", "player"), plain, usedMove).value);
      expect(reduced.trace).toContainEqual(expect.objectContaining({ type: "damage",
        abilityModifiers: expect.arrayContaining([{ ability: "CANASTO", multiplier: 0.3 }]) }));
      expect(damage(pokemon("breaker", "player", { ability: "MOLDBREAKER" }), basket, usedMove).value)
        .toBe(damage(pokemon("breaker", "player", { ability: "MOLDBREAKER" }), plain, usedMove).value);
    }
    expect(damage(pokemon("attacker", "player"), basket, move("WATER")).value)
      .toBe(damage(pokemon("attacker", "player"), plain, move("WATER")).value);
  });

  it("lets Earth Eater block Ground damage and heal a capped quarter of maximum HP", () => {
    const ground = move("GROUND");
    const state = createTeamBattleState({
      player: [pokemon("attacker", "player", { moves: [{ move: ground, pp: ground.pp }] })],
      opponent: [pokemon("eater", "opponent", { ability: "EARTHEATER", hp: 200 })],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, highRolls);
    expect(result.state.teams.player.members[0]!.moves[0]!.pp).toBe(ground.pp - 1);
    expect(result.state.teams.opponent.members[0]!.hp).toBe(240);
    expect(result.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "EARTHEATER", effect: "absorb-type" });
    expect(result.events).toContainEqual({ type: "hpRestored", side: "opponent", source: "move",
      move: ground.internalName, amount: 40, hp: 240 });

    const full = createTeamBattleState({
      player: [pokemon("attacker", "player", { moves: [{ move: ground, pp: ground.pp }] })],
      opponent: [pokemon("eater", "opponent", { ability: "EARTHEATER" })],
    });
    const blockedAtFullHp = resolveTeamTurn(full,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, highRolls);
    expect(blockedAtFullHp.state.teams.opponent.members[0]!.hp).toBe(240);
    expect(blockedAtFullHp.events).not.toContainEqual(expect.objectContaining({ type: "hpRestored" }));
  });

  it("lets Mold Breaker and Normalize bypass Earth Eater for their respective effective types", () => {
    const ground = move("GROUND");
    const run = (ability: BattlerState["ability"]) => resolveTeamTurn(createTeamBattleState({
      player: [pokemon("attacker", "player", { ability, moves: [{ move: ground, pp: ground.pp }] })],
      opponent: [pokemon("eater", "opponent", { ability: "EARTHEATER" })],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, highRolls);
    for (const ability of ["MOLDBREAKER", "NORMALIZE"] as const) {
      const result = run(ability);
      expect(result.state.teams.opponent.members[0]!.hp).toBeLessThan(240);
      expect(result.events).not.toContainEqual(expect.objectContaining({ type: "abilityActivated",
        ability: "EARTHEATER" }));
    }
  });

  it("keeps a spread Ground move active against the non-Earth-Eater target", () => {
    const ground = move("GROUND", { targetCode: "04" });
    const state = createDoubleTeamBattleState({
      player: [pokemon("attacker", "player", { moves: [{ move: ground, pp: ground.pp }] }),
        pokemon("ally", "player")],
      opponent: [pokemon("eater", "opponent", { ability: "EARTHEATER", hp: 180 }),
        pokemon("open", "opponent")],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], highRolls);
    expect(result.state.teams.opponent.members[0]!.hp).toBe(240);
    expect(result.state.teams.opponent.members[1]!.hp).toBeLessThan(240);
  });
});
