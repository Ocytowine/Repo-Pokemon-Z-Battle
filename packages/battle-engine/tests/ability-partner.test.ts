import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, resolveDoubleTeamTurn,
  type BattleMove, type BattleSide, type BattleTrace, type BattlerState, type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: (maximum) => Math.max(0, maximum - 1) };

function pokemon(id: string, side: BattleSide, speed = 80, overrides: Partial<BattlerState> = {}): BattlerState {
  const source = side === "player" ? MINIMAL_MOVE_CATALOG.SWIFT : MINIMAL_MOVE_CATALOG.SCRATCH;
  return {
    id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 160, attack: 90, defense: 90, specialAttack: 90, specialDefense: 90, speed },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 160, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: { ...source, accuracy: 0 }, pp: source.pp }], ...overrides,
  };
}

function spread(): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.SWIFT, internalName: "SURF", name: "Surf",
    type: "WATER", category: "Special", power: 80, accuracy: 0, targetCode: "08" };
}

function actions(move = true) {
  return [
    { actor: { side: "player" as const, slot: 0 }, action: move
      ? { kind: "move" as const, moveIndex: 0 } : { kind: "wait" as const } },
    { actor: { side: "player" as const, slot: 1 }, action: { kind: "wait" as const } },
    { actor: { side: "opponent" as const, slot: 0 }, action: { kind: "wait" as const } },
    { actor: { side: "opponent" as const, slot: 1 }, action: { kind: "wait" as const } },
  ];
}

describe("active partner abilities", () => {
  it.each(["PLUS", "MINUS"] as const)("boosts %s special damage with either partner talent", (ability) => {
    const attacker = pokemon("attacker", "player", 100, { ability });
    const target = pokemon("target", "opponent");
    const neutral = calculateDamage("player", attacker, target, MINIMAL_MOVE_CATALOG.SWIFT, rng, []);
    const trace: BattleTrace[] = [];
    const boosted = calculateDamage("player", attacker, target, MINIMAL_MOVE_CATALOG.SWIFT, rng, trace,
      { reflect: false, lightScreen: false, luckyChant: false, mudSport: false, waterSport: false,
        attackerPartnerAbility: ability === "PLUS" ? "MINUS" : "PLUS" });
    expect(boosted).toBeGreaterThan(neutral);
    expect(trace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifiers: expect.arrayContaining([{ ability, multiplier: 1.5 }]) }));
    const physical = calculateDamage("player", attacker, target, MINIMAL_MOVE_CATALOG.TACKLE, rng, [],
      { reflect: false, lightScreen: false, luckyChant: false, mudSport: false, waterSport: false,
        attackerPartnerAbility: "PLUS" });
    const neutralPhysical = calculateDamage("player", { ...attacker, ability: null }, target,
      MINIMAL_MOVE_CATALOG.TACKLE, rng, []);
    expect(physical).toBe(neutralPhysical);
  });

  it("does not activate Plus or Minus without a conscious active partner talent", () => {
    const attacker = pokemon("attacker", "player", 100, { ability: "PLUS" });
    const target = pokemon("target", "opponent");
    const neutral = calculateDamage("player", attacker, target, MINIMAL_MOVE_CATALOG.SWIFT, rng, []);
    const unrelated = calculateDamage("player", attacker, target, MINIMAL_MOVE_CATALOG.SWIFT, rng, [],
      { reflect: false, lightScreen: false, luckyChant: false, mudSport: false, waterSport: false,
        attackerPartnerAbility: "FRIENDGUARD" });
    expect(unrelated).toBe(neutral);
  });

  it("lets Friend Guard protect only its partner and lets Mold Breaker bypass it", () => {
    const attacker = pokemon("attacker", "player");
    const target = pokemon("target", "opponent");
    const neutral = calculateDamage("player", attacker, target, MINIMAL_MOVE_CATALOG.SWIFT, rng, []);
    const guarded = calculateDamage("player", attacker, target, MINIMAL_MOVE_CATALOG.SWIFT, rng, [],
      { reflect: false, lightScreen: false, luckyChant: false, mudSport: false, waterSport: false,
        defenderPartnerAbility: "FRIENDGUARD" });
    const bypassed = calculateDamage("player", { ...attacker, ability: "MOLDBREAKER" }, target,
      MINIMAL_MOVE_CATALOG.SWIFT, rng, [], { reflect: false, lightScreen: false, luckyChant: false,
        mudSport: false, waterSport: false, defenderPartnerAbility: "FRIENDGUARD" });
    expect(guarded).toBeLessThan(neutral);
    expect(bypassed).toBe(neutral);
  });

  it("uses the positioned partners for Plus and Friend Guard in a double battle", () => {
    const special = { ...MINIMAL_MOVE_CATALOG.SWIFT, accuracy: 0, targetCode: "00" };
    const attacker = pokemon("attacker", "player", 100, { ability: "PLUS",
      moves: [{ move: special, pp: special.pp }] });
    const state = createDoubleTeamBattleState({
      player: [attacker, pokemon("minus", "player", 90, { ability: "MINUS" })],
      opponent: [pokemon("target", "opponent", 80),
        pokemon("guard", "opponent", 70, { ability: "FRIENDGUARD" })],
    });
    const result = resolveDoubleTeamTurn(state, actions(), rng);
    const damageTrace = result.trace.find((entry) => entry.type === "damage");
    expect(damageTrace).toMatchObject({ abilityModifiers: expect.arrayContaining([
      { ability: "PLUS", multiplier: 1.5 }, { ability: "FRIENDGUARD", multiplier: 0.75 },
    ]) });
  });

  it("drops the Plus bonus when the active partner was knocked out earlier in the round", () => {
    const plus = pokemon("plus", "player", 50, { ability: "PLUS" });
    const minus = pokemon("minus", "player", 40, { ability: "MINUS", hp: 1 });
    const knockout = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0, power: 250 };
    const fastEnemy = pokemon("fast", "opponent", 120, {
      stats: { ...pokemon("fast", "opponent").stats, attack: 500, speed: 120 },
      moves: [{ move: knockout, pp: knockout.pp }],
    });
    const state = createDoubleTeamBattleState({ player: [plus, minus],
      opponent: [fastEnemy, pokemon("other", "opponent", 30)] });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 1 } } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.player.members[1]!.hp).toBe(0);
    const plusTrace = result.trace.find((entry) => entry.type === "damage" && entry.move === "SWIFT");
    expect(plusTrace).toMatchObject({ abilityModifiers: expect.not.arrayContaining([
      { ability: "PLUS", multiplier: 1.5 },
    ]) });
  });

  it("lets Telepathy ignore an allied spread hit while enemies still take damage", () => {
    const move = spread();
    const attacker = pokemon("attacker", "player", 100, { moves: [{ move, pp: move.pp }] });
    const telepathy = pokemon("ally", "player", 90, { ability: "TELEPATHY" });
    const state = createDoubleTeamBattleState({ player: [attacker, telepathy],
      opponent: [pokemon("enemy-a", "opponent"), pokemon("enemy-b", "opponent")] });
    const result = resolveDoubleTeamTurn(state, actions(), rng);
    const inner = result.events.flatMap((event) => event.type === "positionedActionResolved" ? event.events : []);
    expect(result.state.teams.player.members[1]!.hp).toBe(160);
    expect(result.state.teams.opponent.members.slice(0, 2).every((member) => member.hp < 160)).toBe(true);
    expect(inner).toContainEqual({ type: "abilityActivated", side: "player",
      ability: "TELEPATHY", effect: "block-move" });
  });

  it("lets an allied Mold Breaker bypass Telepathy", () => {
    const move = spread();
    const attacker = pokemon("attacker", "player", 100, { ability: "MOLDBREAKER",
      moves: [{ move, pp: move.pp }] });
    const telepathy = pokemon("ally", "player", 90, { ability: "TELEPATHY" });
    const state = createDoubleTeamBattleState({ player: [attacker, telepathy],
      opponent: [pokemon("enemy-a", "opponent"), pokemon("enemy-b", "opponent")] });
    const result = resolveDoubleTeamTurn(state, actions(), rng);
    expect(result.state.teams.player.members[1]!.hp).toBeLessThan(160);
  });
});
