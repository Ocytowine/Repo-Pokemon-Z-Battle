import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn,
  type BattleMove, type BattleSide, type BattleTrace, type BattlerState, type RandomSource } from "../src/index.js";
import { describe, expect, it } from "vitest";

class ScriptedRandom implements RandomSource {
  private index = 0;
  public constructor(private readonly values: readonly number[]) {}
  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index++];
    if (value === undefined || value < 0 || value >= maxExclusive) throw new Error(`Missing RNG for ${maxExclusive}.`);
    return value;
  }
}

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const move = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return { id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 200, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    hp: 200, majorStatus: null, ability: null, heldItem: null, moves: [{ move, pp: move.pp }], ...overrides };
}

const context = { reflect: false, lightScreen: false, luckyChant: false, mudSport: false, waterSport: false };

function damage(attacker: BattlerState, defender: BattlerState, move: BattleMove,
  extra: Partial<typeof context & { defenderAlreadyMoved: boolean }> = {}): { value: number; trace: BattleTrace[] } {
  const trace: BattleTrace[] = [];
  return { value: calculateDamage("player", attacker, defender, move, new ScriptedRandom([1, 15]), trace,
    { ...context, ...extra }), trace };
}

describe("shared offensive and defensive ability modifiers", () => {
  it("applies Hustle's physical attack and accuracy tradeoff", () => {
    const plain = damage(pokemon("plain", "player"), pokemon("target", "opponent"), MINIMAL_MOVE_CATALOG.TACKLE).value;
    const hustle = damage(pokemon("hustle", "player", { ability: "HUSTLE" }),
      pokemon("target", "opponent"), MINIMAL_MOVE_CATALOG.TACKLE).value;
    expect(hustle).toBeGreaterThan(plain);

    const state = createTeamBattleState({
      player: [pokemon("hustle", "player", { ability: "HUSTLE" })],
      opponent: [pokemon("target", "opponent")],
    });
    const missed = resolveTeamTurn(state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([85]));
    expect(missed.events).toContainEqual({ type: "moveMissed", side: "player", move: "TACKLE" });
  });

  it("boosts Analytic only after the defender has acted or selected no move", () => {
    const attacker = pokemon("analytic", "player", { ability: "ANALYTIC" });
    const target = pokemon("target", "opponent");
    const before = damage(attacker, target, MINIMAL_MOVE_CATALOG.TACKLE).value;
    const after = damage(attacker, target, MINIMAL_MOVE_CATALOG.TACKLE, { defenderAlreadyMoved: true });
    expect(after.value).toBeGreaterThan(before);
    expect(after.trace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifiers: expect.arrayContaining([{ ability: "ANALYTIC", multiplier: 1.3 }]) }));

    const againstWait = resolveTeamTurn(createTeamBattleState({ player: [attacker], opponent: [target] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([0, 1, 15]));
    expect(againstWait.trace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifiers: expect.arrayContaining([{ ability: "ANALYTIC", multiplier: 1.3 }]) }));
  });

  it("derives Analytic from positioned action order in double battles", () => {
    const sureHit = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0 };
    const state = createDoubleTeamBattleState({
      player: [pokemon("analytic", "player", { ability: "ANALYTIC", stats: {
        ...pokemon("analytic", "player").stats, speed: 40 }, moves: [{ move: sureHit, pp: sureHit.pp }] }),
        pokemon("ally", "player")],
      opponent: [pokemon("fast-target", "opponent", { stats: {
        ...pokemon("fast-target", "opponent").stats, speed: 140 }, moves: [{ move: sureHit, pp: sureHit.pp }] }),
        pokemon("foe-ally", "opponent")],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 0 } } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([0, 0, 1, 15, 1, 15]));
    expect(result.trace).toContainEqual(expect.objectContaining({ type: "damage", side: "player",
      abilityModifiers: expect.arrayContaining([{ ability: "ANALYTIC", multiplier: 1.3 }]) }));

    const fasterAnalytic = createDoubleTeamBattleState({
      player: [pokemon("analytic", "player", { ability: "ANALYTIC", stats: {
        ...pokemon("analytic", "player").stats, speed: 160 }, moves: [{ move: sureHit, pp: sureHit.pp }] }),
        pokemon("ally", "player")],
      opponent: [pokemon("slow-target", "opponent", { stats: {
        ...pokemon("slow-target", "opponent").stats, speed: 40 }, moves: [{ move: sureHit, pp: sureHit.pp }] }),
        pokemon("foe-ally", "opponent")],
    });
    const beforeTarget = resolveDoubleTeamTurn(fasterAnalytic, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 0 } } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([0, 0, 1, 15, 1, 15]));
    const playerDamage = beforeTarget.trace.find((entry) => entry.type === "damage" && entry.side === "player");
    expect(playerDamage).toMatchObject({ type: "damage", abilityModifiers: [] });
  });

  it("uses Pokemon Z's exact cutting move catalogue for Cortante", () => {
    const cutter = pokemon("cutter", "player", { ability: "CORTANTE" });
    const target = pokemon("target", "opponent");
    const slash: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "SLASH", name: "Tranche" };
    expect(damage(cutter, target, slash).value).toBeGreaterThan(damage(pokemon("plain", "player"), target, slash).value);
    expect(damage(cutter, target, MINIMAL_MOVE_CATALOG.TACKLE).value)
      .toBe(damage(pokemon("plain", "player"), target, MINIMAL_MOVE_CATALOG.TACKLE).value);
  });

  it("halves physical and Psyshock-family damage with Fur Coat unless Mold Breaker bypasses it", () => {
    const fur = pokemon("fur", "opponent", { ability: "FURCOAT" });
    const plain = pokemon("plain", "opponent");
    expect(damage(pokemon("attacker", "player"), fur, MINIMAL_MOVE_CATALOG.TACKLE).value)
      .toBeLessThan(damage(pokemon("attacker", "player"), plain, MINIMAL_MOVE_CATALOG.TACKLE).value);
    expect(damage(pokemon("breaker", "player", { ability: "MOLDBREAKER" }), fur, MINIMAL_MOVE_CATALOG.TACKLE).value)
      .toBe(damage(pokemon("breaker", "player", { ability: "MOLDBREAKER" }), plain, MINIMAL_MOVE_CATALOG.TACKLE).value);
    const psyshock = { ...MINIMAL_MOVE_CATALOG.SWIFT, internalName: "PSYSHOCK",
      functionCode: "122" as BattleMove["functionCode"] };
    expect(damage(pokemon("attacker", "player"), fur, psyshock).value)
      .toBeLessThan(damage(pokemon("attacker", "player"), plain, psyshock).value);
  });

  it("ports Water Bubble's Water boost, Fire resistance and burn immunity", () => {
    const water = { ...MINIMAL_MOVE_CATALOG.WATERGUN, accuracy: 0 };
    const fire = { ...MINIMAL_MOVE_CATALOG.ICEBEAM, type: "FIRE", accuracy: 0 };
    const target = pokemon("target", "opponent");
    expect(damage(pokemon("bubble", "player", { ability: "WATERBUBBLE" }), target, water).value)
      .toBeGreaterThan(damage(pokemon("plain", "player"), target, water).value);
    expect(damage(pokemon("attacker", "player"), pokemon("bubble", "opponent", { ability: "WATERBUBBLE" }), fire).value)
      .toBeLessThan(damage(pokemon("attacker", "player"), target, fire).value);

    const burn: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "WILLOWISP", name: "Feu Follet",
      functionCode: "00A", category: "Status", power: 0, accuracy: 0 };
    const state = createTeamBattleState({
      player: [pokemon("burner", "player", { moves: [{ move: burn, pp: burn.pp }] })],
      opponent: [pokemon("bubble", "opponent", { ability: "WATERBUBBLE" })],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(result.state.teams.opponent.members[0]!.majorStatus).toBeNull();
    expect(result.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "WATERBUBBLE", effect: "prevent-status" });
  });

  it("uses Z's 1.5 special-defense multiplier for Ice Scales, including Psyshock", () => {
    const attacker = pokemon("attacker", "player");
    const plain = pokemon("plain", "opponent");
    const scales = pokemon("scales", "opponent", { ability: "ICESCALES" });
    const special = { ...MINIMAL_MOVE_CATALOG.WATERGUN, accuracy: 0 };
    const reduced = damage(attacker, scales, special);
    expect(reduced.value).toBeLessThan(damage(attacker, plain, special).value);
    expect(reduced.trace).toContainEqual(expect.objectContaining({ type: "damage", defense: 150,
      abilityModifiers: expect.arrayContaining([{ ability: "ICESCALES", multiplier: 2 / 3 }]) }));
    expect(damage(attacker, scales, MINIMAL_MOVE_CATALOG.TACKLE).value)
      .toBe(damage(attacker, plain, MINIMAL_MOVE_CATALOG.TACKLE).value);
    expect(damage(pokemon("breaker", "player", { ability: "MOLDBREAKER" }), scales, special).value)
      .toBe(damage(pokemon("breaker", "player", { ability: "MOLDBREAKER" }), plain, special).value);

    const psyshock = { ...special, internalName: "PSYSHOCK", functionCode: "122" as BattleMove["functionCode"] };
    expect(damage(attacker, scales, psyshock).trace).toContainEqual(expect.objectContaining({ type: "damage",
      defense: 150, abilityModifiers: expect.arrayContaining([{ ability: "ICESCALES", multiplier: 2 / 3 }]) }));
  });

  it("raises physical defense with Marvel Scale under every major status and respects Mold Breaker", () => {
    const attacker = pokemon("attacker", "player");
    const plain = pokemon("plain", "opponent", { majorStatus: { kind: "hemorrhage" } });
    const scale = pokemon("scale", "opponent", { ability: "MARVELSCALE",
      majorStatus: { kind: "hemorrhage" } });
    expect(damage(attacker, scale, MINIMAL_MOVE_CATALOG.TACKLE).value)
      .toBeLessThan(damage(attacker, plain, MINIMAL_MOVE_CATALOG.TACKLE).value);
    expect(damage(attacker, pokemon("healthy", "opponent", { ability: "MARVELSCALE" }),
      MINIMAL_MOVE_CATALOG.TACKLE).value).toBe(damage(attacker, pokemon("healthy", "opponent"),
      MINIMAL_MOVE_CATALOG.TACKLE).value);
    expect(damage(attacker, scale, MINIMAL_MOVE_CATALOG.WATERGUN).value)
      .toBe(damage(attacker, plain, MINIMAL_MOVE_CATALOG.WATERGUN).value);
    expect(damage(pokemon("breaker", "player", { ability: "MOLDBREAKER" }), scale,
      MINIMAL_MOVE_CATALOG.TACKLE).value).toBe(damage(pokemon("breaker", "player", { ability: "MOLDBREAKER" }),
      plain, MINIMAL_MOVE_CATALOG.TACKLE).value);
  });

  it("halves Defeatist's effective attack at exactly half HP for both damage categories", () => {
    const target = pokemon("target", "opponent");
    for (const move of [MINIMAL_MOVE_CATALOG.TACKLE, MINIMAL_MOVE_CATALOG.WATERGUN]) {
      const above = pokemon("above", "player", { ability: "DEFEATIST", hp: 101 });
      const threshold = pokemon("threshold", "player", { ability: "DEFEATIST", hp: 100 });
      expect(damage(threshold, target, move).value).toBeLessThan(damage(above, target, move).value);
      expect(damage(threshold, target, move).trace).toContainEqual(expect.objectContaining({ type: "damage",
        abilityModifiers: expect.arrayContaining([{ ability: "DEFEATIST", multiplier: 0.5 }]) }));
    }
  });

  it("keeps Fluffy's source Fire precedence over its contact reduction", () => {
    const attacker = pokemon("attacker", "player");
    const plain = pokemon("plain", "opponent");
    const fluffy = pokemon("fluffy", "opponent", { ability: "FLUFFY" });
    const contact = { ...MINIMAL_MOVE_CATALOG.TACKLE, flags: "a" };
    const nonContact = { ...contact, internalName: "PROJECTILE", flags: "" };
    expect(damage(attacker, fluffy, contact).value).toBeLessThan(damage(attacker, plain, contact).value);
    expect(damage(attacker, fluffy, nonContact).value).toBe(damage(attacker, plain, nonContact).value);

    const fireContact = { ...contact, internalName: "FIREPUNCH", type: "FIRE" };
    const fireRanged = { ...fireContact, internalName: "FLAMETHROWER", category: "Special" as const, flags: "" };
    expect(damage(attacker, fluffy, fireContact).value).toBeGreaterThan(damage(attacker, plain, fireContact).value);
    expect(damage(attacker, fluffy, fireContact).trace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifiers: expect.arrayContaining([{ ability: "FLUFFY", multiplier: 2 }]) }));
    expect(damage(attacker, fluffy, fireRanged).value).toBeGreaterThan(damage(attacker, plain, fireRanged).value);
    expect(damage(pokemon("breaker", "player", { ability: "MOLDBREAKER" }), fluffy, contact).value)
      .toBe(damage(pokemon("breaker", "player", { ability: "MOLDBREAKER" }), plain, contact).value);
  });

  it("applies the defensive modifier only to the targeted double-battle slot", () => {
    const sureHit = { ...MINIMAL_MOVE_CATALOG.WATERGUN, accuracy: 0 };
    const state = createDoubleTeamBattleState({
      player: [pokemon("attacker", "player", { moves: [{ move: sureHit, pp: sureHit.pp }] }),
        pokemon("ally", "player")],
      opponent: [pokemon("scales", "opponent", { ability: "ICESCALES" }),
        pokemon("plain", "opponent")],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], { nextInt: (maximum) => Math.max(0, maximum - 1) });
    expect(result.state.teams.opponent.members[0]?.hp).toBeLessThan(200);
    expect(result.state.teams.opponent.members[1]?.hp).toBe(200);
    expect(result.trace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifiers: expect.arrayContaining([{ ability: "ICESCALES", multiplier: 2 / 3 }]) }));
  });
});
