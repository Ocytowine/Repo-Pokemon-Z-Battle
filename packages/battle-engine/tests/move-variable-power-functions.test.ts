import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  hiddenPowerTypeFromIvs,
  replaceFaintedPokemon, resolveDoubleTeamTurn, resolveTeamTurn,
  type BattleMove, type BattlerState, type RandomSource } from "../src/index.js";
import { effectiveMoveType } from "../src/move-properties.js";

const rng: RandomSource = { nextInt: (limit) => limit - 1 };
const move = (code: BattleMove["functionCode"]): BattleMove => ({ ...MINIMAL_MOVE_CATALOG.TACKLE,
  id: 2800, internalName: `TEST${code}`, functionCode: code, accuracy: 0 });
function battler(id: string, attack: BattleMove, changes: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"], hp: 200,
    stats: { maxHp: 200, attack: 80, defense: 80, specialAttack: 80, specialDefense: 80, speed: 50 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, majorStatus: null, ability: null,
    heldItem: null, moves: [{ move: attack, pp: 20 }], ...changes };
}
function damage(code: BattleMove["functionCode"], attacker: Partial<BattlerState>,
  defender: Partial<BattlerState>, referencePower: number): void {
  const attack = move(code);
  const user = battler("user", attack, attacker);
  const target = battler("target", MINIMAL_MOVE_CATALOG.TACKLE, defender);
  const actual = calculateDamage("player", user, target, attack, rng, []);
  const reference = calculateDamage("player", user, target,
    { ...attack, functionCode: "000", power: referencePower }, rng, []);
  expect(actual).toBe(reference);
}

describe("Pokemon Z variable power", () => {
  it.each([
    ["FISTPLATE", "FIGHTING"], ["SKYPLATE", "FLYING"], ["TOXICPLATE", "POISON"],
    ["EARTHPLATE", "GROUND"], ["STONEPLATE", "ROCK"], ["INSECTPLATE", "BUG"],
    ["SPOOKYPLATE", "GHOST"], ["IRONPLATE", "STEEL"], ["FLAMEPLATE", "FIRE"],
    ["SPLASHPLATE", "WATER"], ["MEADOWPLATE", "GRASS"], ["ZAPPLATE", "ELECTRIC"],
    ["MINDPLATE", "PSYCHIC"], ["ICICLEPLATE", "ICE"], ["DRACOPLATE", "DRAGON"],
    ["DREADPLATE", "DARK"], ["PIXIEPLATE", "FAIRY"],
    ["SHOCKDRIVE", "ELECTRIC"], ["BURNDRIVE", "FIRE"],
    ["CHILLDRIVE", "ICE"], ["DOUSEDRIVE", "WATER"],
  ] as const)("09F changes type from %s to %s", (item, type) => {
    const techno = item.endsWith("DRIVE");
    const attack = { ...move("09F"), internalName: techno ? "TECHNOBLAST" : "JUDGMENT" };
    const user = battler("user", attack, { heldItem: item });
    expect(effectiveMoveType(user, attack).type).toBe(type);
    expect(effectiveMoveType({ ...user, ability: "KLUTZ" }, attack).type).toBe("NORMAL");
    expect(effectiveMoveType({ ...user, volatile: { embargoTurns: 1 } }, attack).type).toBe("NORMAL");
  });

  it("09F leaves the type Normal without a matching active item, even under Normalize", () => {
    const judgment = { ...move("09F"), internalName: "JUDGMENT" };
    const techno = { ...judgment, internalName: "TECHNOBLAST" };
    const user = battler("user", judgment, { ability: "NORMALIZE" });
    expect(effectiveMoveType({ ...user, heldItem: "TABLANEUTRA" }, judgment))
      .toEqual({ type: "NORMAL", abilityBoost: 1 });
    expect(effectiveMoveType({ ...user, heldItem: "SHOCKDRIVE" }, judgment).type).toBe("NORMAL");
    expect(effectiveMoveType({ ...user, heldItem: "FLAMEPLATE" }, techno).type).toBe("NORMAL");
  });

  it("09F damage and the positioned double adapter use the held-item type", () => {
    const judgment = { ...move("09F"), internalName: "JUDGMENT", power: 80 };
    const user = battler("user", judgment, { heldItem: "FLAMEPLATE" });
    const target = battler("target", MINIMAL_MOVE_CATALOG.TACKLE, { types: ["GRASS"] });
    const context = { reflect: false, lightScreen: false, luckyChant: false,
      mudSport: false, waterSport: false };
    const expected = calculateDamage("player", user, target,
      { ...judgment, functionCode: "000", type: "FIRE" }, rng, [], context);
    const single = resolveTeamTurn(createTeamBattleState({ player: [user], opponent: [target] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(single.events).toContainEqual(expect.objectContaining({ type: "damageApplied",
      target: "opponent", amount: expected, effectiveness: 2 }));
    const double = resolveDoubleTeamTurn(createDoubleTeamBattleState({
      player: [user, battler("ally", MINIMAL_MOVE_CATALOG.TACKLE)],
      opponent: [target, battler("other", MINIMAL_MOVE_CATALOG.TACKLE)],
    }), [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(double.events).toContainEqual(expect.objectContaining({ type: "positionedActionResolved",
      actor: { side: "player", slot: 0 }, events: expect.arrayContaining([
        expect.objectContaining({ type: "damageApplied", amount: expected, effectiveness: 2 })]) }));
  });
  it("0A0 always crits unless armor or Lucky Chant blocks it", () => {
    const frostBreath = { ...move("0A0"), power: 60 };
    const user = battler("user", frostBreath);
    const target = battler("target", MINIMAL_MOVE_CATALOG.TACKLE);
    const context = { reflect: false, lightScreen: false, luckyChant: false,
      mudSport: false, waterSport: false };
    const trace: Parameters<typeof calculateDamage>[5] = [];
    calculateDamage("player", user, target, frostBreath, rng, trace, context);
    expect(trace).toContainEqual(expect.objectContaining({ type: "damage", critical: true }));
    expect(trace).not.toContainEqual(expect.objectContaining({ type: "rng", purpose: "critical" }));
    for (const [defender, chant] of [[{ ...target, ability: "BATTLEARMOR" as const }, false],
      [{ ...target, ability: "SHELLARMOR" as const }, false], [target, true]] as const) {
      const blocked: Parameters<typeof calculateDamage>[5] = [];
      calculateDamage("player", user, defender, frostBreath, rng, blocked,
        { ...context, luckyChant: chant });
      expect(blocked).toContainEqual(expect.objectContaining({ type: "damage", critical: false }));
    }
  });

  it("0A0 resolves a critical from either positioned double-battle owner", () => {
    const frostBreath = { ...move("0A0"), power: 60 };
    const state = createDoubleTeamBattleState({
      player: [battler("host", frostBreath), battler("ally", MINIMAL_MOVE_CATALOG.TACKLE)],
      opponent: [battler("guest", frostBreath), battler("ally2", MINIMAL_MOVE_CATALOG.TACKLE)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 0 } } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.trace.filter((entry) => entry.type === "damage" && entry.critical)).toHaveLength(2);
  });
  it.each([[50, 100, 60], [199, 100, 60], [200, 100, 80], [300, 100, 120],
    [400, 100, 150], [100, 0, 150]] as const)(
    "099 maps effective speeds %i/%i to %i power", (fast, slow, power) => {
      const electroBall = { ...move("099"), power: 1 };
      const user = battler("user", electroBall);
      const target = battler("target", MINIMAL_MOVE_CATALOG.TACKLE);
      const context = { reflect: false, lightScreen: false, luckyChant: false,
        mudSport: false, waterSport: false, attackerEffectiveSpeed: fast,
        defenderEffectiveSpeed: slow };
      expect(calculateDamage("player", user, target, electroBall, rng, [], context))
        .toBe(calculateDamage("player", user, target,
          { ...electroBall, functionCode: "000", power }, rng, [], context));
    });

  it("099 uses Tailwind, speed stages and weather at impact in singles", () => {
    const electroBall = { ...move("099"), power: 1 };
    const user = battler("user", electroBall, { stats: { ...battler("x", electroBall).stats, speed: 100 },
      stages: { ...battler("x", electroBall).stages, speed: 1 } });
    const target = battler("target", MINIMAL_MOVE_CATALOG.TACKLE);
    const state = resolveTeamTurn(createTeamBattleState({ player: [user], opponent: [target] }),
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, rng).state;
    const boosted = { ...state, effects: { ...state.effects!, weather: "rain" as const,
      sides: { ...state.effects!.sides, player: { ...state.effects!.sides.player, tailwindTurns: 2 } } } };
    const result = resolveTeamTurn(boosted, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, rng);
    const expected = calculateDamage("player", user, target,
      { ...electroBall, functionCode: "000", power: 150 }, rng, [],
      { reflect: false, lightScreen: false, luckyChant: false, mudSport: false,
        waterSport: false, weather: "rain" });
    expect(result.events).toContainEqual(expect.objectContaining({ type: "damageApplied",
      target: "opponent", amount: expected }));
  });

  it("099 includes Swift Swim only while rain is effective", () => {
    const electroBall = { ...move("099"), power: 1 };
    const user = battler("user", electroBall, { ability: "SWIFTSWIM",
      stats: { ...battler("x", electroBall).stats, speed: 100 } });
    const target = battler("target", MINIMAL_MOVE_CATALOG.TACKLE,
      { stats: { ...battler("x", electroBall).stats, speed: 80 } });
    const run = (suppressed: boolean) => {
      const defender = suppressed ? { ...target, ability: "CLOUDNINE" as const } : target;
      const state = resolveTeamTurn(createTeamBattleState({ player: [user], opponent: [defender] }),
        { player: { kind: "wait" }, opponent: { kind: "wait" } }, rng).state;
      return resolveTeamTurn({ ...state, effects: { ...state.effects!, weather: "rain" } },
        { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng).events
        .find((event) => event.type === "damageApplied" && event.target === "opponent");
    };
    const rainy = run(false);
    const suppressed = run(true);
    expect(rainy?.type === "damageApplied" ? rainy.amount : 0)
      .toBeGreaterThan(suppressed?.type === "damageApplied" ? suppressed.amount : 0);
  });

  it("099 uses the actual target's Tailwind in positioned doubles", () => {
    const electroBall = { ...move("099"), power: 1 };
    const user = battler("user", electroBall, { stats: { ...battler("x", electroBall).stats, speed: 100 } });
    const target = battler("target", MINIMAL_MOVE_CATALOG.TACKLE);
    const state = resolveDoubleTeamTurn(createDoubleTeamBattleState({
      player: [user, battler("ally", MINIMAL_MOVE_CATALOG.TACKLE)],
      opponent: [target, battler("other", MINIMAL_MOVE_CATALOG.TACKLE)],
    }), [
      { actor: { side: "player", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng).state;
    const boosted = { ...state, effects: { ...state.effects!, sides: { ...state.effects!.sides,
      opponent: { ...state.effects!.sides.opponent, tailwindTurns: 2 } } } };
    const result = resolveDoubleTeamTurn(boosted, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    const expected = calculateDamage("player", user, target,
      { ...electroBall, functionCode: "000", power: 60 }, rng, []);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "positionedActionResolved",
      actor: { side: "player", slot: 0 }, events: expect.arrayContaining([
        expect.objectContaining({ type: "damageApplied", amount: expected })]) }));
  });
  it("085 stores each side's last faint for the next turn, then expires the bonus", () => {
    const retaliate = move("085");
    const finisher = { ...move("000"), power: 200 };
    const start = createTeamBattleState({
      player: [battler("fallen", retaliate, { hp: 1 }), battler("reserve", retaliate)],
      opponent: [battler("foe", finisher)],
    });
    const first = resolveTeamTurn(start, { player: { kind: "wait" },
      opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(first.state.effects?.sides.player.lastFaintedTurn).toBe(1);
    expect(first.state.effects?.sides.opponent.lastFaintedTurn).toBeUndefined();
    const replaced = replaceFaintedPokemon(first.state, { player: 1 }, rng);
    const second = resolveTeamTurn(replaced.state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, rng);
    const hit = second.events.find((event) => event.type === "damageApplied" && event.target === "opponent");
    const user = replaced.state.teams.player.members[1]!;
    const target = replaced.state.teams.opponent.members[0]!;
    const baseline = calculateDamage("player", user, target, { ...retaliate, functionCode: "000",
      power: retaliate.power * 2 }, rng, []);
    expect(hit).toMatchObject({ type: "damageApplied", amount: baseline });
    const third = resolveTeamTurn(second.state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, rng);
    const expired = third.events.find((event) => event.type === "damageApplied" && event.target === "opponent");
    expect(expired).toMatchObject({ type: "damageApplied", amount: expect.any(Number) });
    expect(expired?.type === "damageApplied" ? expired.amount : 0).toBeLessThan(baseline);
  });

  it.each([null, "sun", "rain", "sand", "hail", "strong-winds"] as const)(
    "087 uses the weather-dependent type and doubles power under %s", (weather) => {
      const weatherBall = { ...move("087"), type: "NORMAL", category: "Special" as const };
      const user = battler("user", weatherBall, { types: ["WATER"] });
      const target = battler("target", MINIMAL_MOVE_CATALOG.TACKLE, { types: ["GRASS"] });
      const context = { reflect: false, lightScreen: false, luckyChant: false,
        mudSport: false, waterSport: false, weather };
      const actual = calculateDamage("player", user, target, weatherBall, rng, [], context);
      const type = weather === "sun" ? "FIRE" : weather === "rain" ? "WATER"
        : weather === "sand" ? "ROCK" : weather === "hail" ? "ICE" : "NORMAL";
      const reference = calculateDamage("player", user, target, { ...weatherBall, functionCode: "000",
        type, power: weather === null ? weatherBall.power : weatherBall.power * 2 }, rng, [], context);
      expect(actual).toBe(reference);
    });

  it("087 treats suppressed weather as clear in the shared turn resolver", () => {
    const weatherBall = { ...move("087"), category: "Special" as const };
    const create = (suppressor: boolean) => createTeamBattleState({
      player: [battler("user", weatherBall, { ability: "DRIZZLE" })],
      opponent: [battler("target", MINIMAL_MOVE_CATALOG.TACKLE,
        { ability: suppressor ? "CLOUDNINE" : null, types: ["FIRE"] })],
    });
    const hit = (suppressor: boolean) => resolveTeamTurn(create(suppressor), {
      player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" },
    }, rng).events.find((event) => event.type === "damageApplied" && event.target === "opponent");
    const clear = hit(true);
    const rainy = hit(false);
    expect(clear?.type).toBe("damageApplied");
    expect(rainy?.type === "damageApplied" ? rainy.amount : 0)
      .toBeGreaterThan(clear?.type === "damageApplied" ? clear.amount : 0);
  });

  it("087 passes its effective weather type to defensive absorption", () => {
    const weatherBall = { ...move("087"), category: "Special" as const };
    const state = createTeamBattleState({
      player: [battler("user", weatherBall, { ability: "DRIZZLE" })],
      opponent: [battler("target", MINIMAL_MOVE_CATALOG.TACKLE,
        { ability: "WATERABSORB", hp: 100 })],
    });
    const result = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, rng);
    expect(result.state.teams.opponent.members[0]!.hp).toBeGreaterThan(100);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "abilityActivated",
      ability: "WATERABSORB", effect: "absorb-type" }));
  });

  it("087 bypasses base Normalize and Pixilate type conversions as in the Ruby override", () => {
    const weatherBall = { ...move("087"), category: "Special" as const };
    const ghost = battler("ghost", MINIMAL_MOVE_CATALOG.TACKLE, { types: ["GHOST"] });
    const normalizer = battler("normalizer", weatherBall, { ability: "NORMALIZE" });
    const pixilate = battler("pixilate", weatherBall, { ability: "PIXILATE" });
    const context = { reflect: false, lightScreen: false, luckyChant: false,
      mudSport: false, waterSport: false };
    expect(calculateDamage("player", pixilate, ghost, weatherBall, rng, [], context)).toBe(0);
    expect(calculateDamage("player", normalizer, ghost, weatherBall, rng, [],
      { ...context, weather: "sun" })).toBeGreaterThan(0);
  });

  it("085 retains a partner's KO marker in double battles", () => {
    const strike = { ...move("000"), power: 200 };
    const state = createDoubleTeamBattleState({
      player: [battler("fallen", strike, { hp: 1 }), battler("ally", move("085"))],
      opponent: [battler("foe", strike), battler("foe2", strike)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 0 } } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.effects?.sides.player.lastFaintedTurn).toBe(1);
    expect(result.state.effects?.sides.opponent.lastFaintedTurn).toBeUndefined();
  });

  it("092 builds one shared side stack per consecutive turn and resets after a gap", () => {
    const echo = { ...move("092"), power: 40 };
    const target = battler("target", MINIMAL_MOVE_CATALOG.TACKLE, { hp: 1000,
      stats: { ...battler("target", echo).stats, maxHp: 1000 } });
    let state = createTeamBattleState({ player: [battler("user", echo)], opponent: [target] });
    const use = () => resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, rng);
    const first = use();
    expect(first.state.effects?.sides.player).toMatchObject({ echoedVoiceCount: 1, echoedVoiceLastTurn: 1 });
    state = first.state;
    const second = use();
    expect(second.state.effects?.sides.player).toMatchObject({ echoedVoiceCount: 2, echoedVoiceLastTurn: 2 });
    const firstHit = first.events.find((event) => event.type === "damageApplied" && event.target === "opponent");
    const secondHit = second.events.find((event) => event.type === "damageApplied" && event.target === "opponent");
    expect(secondHit?.type === "damageApplied" ? secondHit.amount : 0)
      .toBeGreaterThan(firstHit?.type === "damageApplied" ? firstHit.amount : 0);
    const gap = resolveTeamTurn(second.state, { player: { kind: "wait" }, opponent: { kind: "wait" } }, rng);
    state = gap.state;
    expect(use().state.effects?.sides.player).toMatchObject({ echoedVoiceCount: 1, echoedVoiceLastTurn: 4 });
  });

  it("092 counts two partners only once in the same double-battle turn", () => {
    const echo = { ...move("092"), power: 40 };
    const target = (id: string) => battler(id, MINIMAL_MOVE_CATALOG.TACKLE, { hp: 1000,
      stats: { ...battler(id, echo).stats, maxHp: 1000 } });
    const state = createDoubleTeamBattleState({
      player: [battler("a", echo), battler("b", echo)], opponent: [target("x"), target("y")],
    });
    const actions = [
      { actor: { side: "player" as const, slot: 0 }, action: { kind: "move" as const, moveIndex: 0,
        target: { side: "opponent" as const, slot: 0 } } },
      { actor: { side: "player" as const, slot: 1 }, action: { kind: "move" as const, moveIndex: 0,
        target: { side: "opponent" as const, slot: 1 } } },
      { actor: { side: "opponent" as const, slot: 0 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 1 }, action: { kind: "wait" as const } },
    ];
    const first = resolveDoubleTeamTurn(state, actions, rng);
    expect(first.state.effects?.sides.player).toMatchObject({ echoedVoiceCount: 1, echoedVoiceLastTurn: 1 });
    const second = resolveDoubleTeamTurn(first.state, actions, rng);
    expect(second.state.effects?.sides.player).toMatchObject({ echoedVoiceCount: 2, echoedVoiceLastTurn: 2 });
  });

  it("092 does not advance on a miss and caps consecutive turns at five", () => {
    const echo = { ...move("092"), power: 20 };
    const target = battler("target", MINIMAL_MOVE_CATALOG.TACKLE, { hp: 2000,
      stats: { ...battler("target", echo).stats, maxHp: 2000 } });
    const missed = resolveTeamTurn(createTeamBattleState({
      player: [battler("user", { ...echo, accuracy: 1 })], opponent: [target],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(missed.events).toContainEqual(expect.objectContaining({ type: "moveMissed", side: "player" }));
    expect(missed.state.effects?.sides.player.echoedVoiceCount).toBeUndefined();
    let state = createTeamBattleState({ player: [battler("user", echo)], opponent: [target] });
    for (let turn = 1; turn <= 6; turn += 1) {
      state = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
        opponent: { kind: "wait" } }, rng).state;
    }
    expect(state.effects?.sides.player).toMatchObject({ echoedVoiceCount: 5, echoedVoiceLastTurn: 6 });
  });

  it("uses exact source floors for happiness and HP, including minimum one", () => {
    damage("089", { happiness: 255 }, {}, 102);
    damage("089", { happiness: 0 }, {}, 1);
    damage("08A", { happiness: 0 }, {}, 102);
    damage("08A", { happiness: 255 }, {}, 1);
    damage("08B", { hp: 101 }, {}, 75);
    damage("08C", {}, { hp: 101 }, 60);
  });

  it("08E and 08F count all seven positive stat stages, ignore negatives and cap 08F", () => {
    damage("08E", { stages: { ...battler("x", move("08E")).stages,
      attack: 2, accuracy: 1, defense: -3 } }, {}, 80);
    damage("08F", {}, { stages: { ...battler("x", move("08F")).stages,
      specialAttack: 3, evasion: 2, speed: -2 } }, 160);
    damage("08F", {}, { stages: { attack: 6, defense: 6, specialAttack: 6,
      specialDefense: 6, speed: 6, accuracy: 6, evasion: 6 } }, 200);
  });

  it("090 derives source type from IV parity and fixes its power to 70", () => {
    expect(hiddenPowerTypeFromIvs({ hp: 0, attack: 0, defense: 0, speed: 0,
      specialAttack: 0, specialDefense: 0 })).toBe("FIGHTING");
    expect(hiddenPowerTypeFromIvs({ hp: 31, attack: 31, defense: 31, speed: 31,
      specialAttack: 31, specialDefense: 31 })).toBe("FAIRY");
    const hidden = { ...move("090"), power: 1, type: "NORMAL", category: "Special" as const };
    const user = battler("user", hidden, { hiddenPowerType: "FIGHTING" });
    const target = battler("target", MINIMAL_MOVE_CATALOG.TACKLE);
    expect(calculateDamage("player", user, target, hidden, rng, [])).toBe(
      calculateDamage("player", user, target, { ...hidden, functionCode: "000",
        type: "FIGHTING", power: 70 }, rng, []));
    expect(() => calculateDamage("player", { ...user, hiddenPowerType: undefined }, target,
      hidden, rng, [])).toThrow("Hidden Power requires");
  });

  it("090 chooses Physical only when raw Attack plus stage exceeds Sp. Attack plus stage", () => {
    const hidden = { ...move("090"), category: "Special" as const };
    const target = battler("target", MINIMAL_MOVE_CATALOG.TACKLE, { stats: {
      ...battler("target", hidden).stats, defense: 60, specialDefense: 180 } });
    const user = battler("user", hidden, { hiddenPowerType: "FIGHTING", stats: {
      ...battler("user", hidden).stats, attack: 79, specialAttack: 80 },
    stages: { ...battler("user", hidden).stages, attack: 1 } });
    const special = calculateDamage("player", user, target, hidden, rng, []);
    const physical = calculateDamage("player", { ...user, stages: { ...user.stages, attack: 2 } },
      target, hidden, rng, []);
    expect(physical).toBeGreaterThan(special);
  });

  it("097 maps PP remaining after payment to 40, 50, 60, 80, then 200 power", () => {
    const card = { ...move("097"), power: 1 };
    const target = battler("target", MINIMAL_MOVE_CATALOG.TACKLE, { hp: 5000,
      stats: { ...battler("target", card).stats, maxHp: 5000 } });
    let state = createTeamBattleState({ player: [{ ...battler("user", card),
      moves: [{ move: card, pp: 5 }] }], opponent: [target] });
    for (const power of [40, 50, 60, 80, 200]) {
      const user = state.teams.player.members[0]!;
      const defender = state.teams.opponent.members[0]!;
      const expected = calculateDamage("player", user, defender,
        { ...card, functionCode: "000", power }, rng, []);
      const result = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
        opponent: { kind: "wait" } }, rng);
      expect(result.events).toContainEqual(expect.objectContaining({ type: "damageApplied",
        target: "opponent", amount: expected }));
      state = result.state;
    }
    expect(state.teams.player.members[0]!.moves[0]!.pp).toBe(0);
  });

  it("097 uses the post-Pressure PP value when the target raises the cost", () => {
    const card = { ...move("097"), power: 1 };
    const user = { ...battler("user", card), moves: [{ move: card, pp: 5 }] };
    const target = battler("target", MINIMAL_MOVE_CATALOG.TACKLE, { ability: "PRESSURE" });
    const result = resolveTeamTurn(createTeamBattleState({ player: [user], opponent: [target] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(result.state.teams.player.members[0]!.moves[0]!.pp).toBe(3);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "damageApplied",
      target: "opponent", amount: calculateDamage("player", user, target,
        { ...card, functionCode: "000", power: 50 }, rng, []) }));
  });

  it.each([[0, 90], [4, 140], [7, 200]] as const)(
    "094 maps source roll %i to %i power", (roll, power) => {
      const present = { ...move("094"), power: 1 };
      const scripted: RandomSource = { nextInt: (limit) => limit === 10 ? roll : limit - 1 };
      const user = battler("user", present);
      const target = battler("target", MINIMAL_MOVE_CATALOG.TACKLE, { hp: 1000,
        stats: { ...battler("target", present).stats, maxHp: 1000 } });
      const expected = calculateDamage("player", user, target,
        { ...present, functionCode: "000", power }, scripted, []);
      const result = resolveTeamTurn(createTeamBattleState({ player: [user], opponent: [target] }),
        { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, scripted);
      expect(result.events).toContainEqual(expect.objectContaining({ type: "damageApplied",
        target: "opponent", amount: expected }));
    });

  it("094 heals one quarter, fails at full HP or immunity, and spends a Gem on healing", () => {
    const present = { ...move("094"), type: "FIGHTING", power: 1 };
    const scripted: RandomSource = { nextInt: (limit) => limit === 10 ? 8 : limit - 1 };
    const run = (target: BattlerState) => resolveTeamTurn(createTeamBattleState({
      player: [battler("user", present, { heldItem: "FIGHTINGGEM" })], opponent: [target],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, scripted);
    const healed = run(battler("target", MINIMAL_MOVE_CATALOG.TACKLE, { hp: 100 }));
    expect(healed.state.teams.opponent.members[0]!.hp).toBe(150);
    expect(healed.state.teams.player.members[0]!.heldItem).toBeNull();
    expect(healed.events).not.toContainEqual(expect.objectContaining({ type: "damageApplied" }));
    const full = run(battler("target", MINIMAL_MOVE_CATALOG.TACKLE));
    expect(full.events).toContainEqual(expect.objectContaining({ type: "moveFailed", side: "player" }));
    expect(full.state.teams.player.members[0]!.heldItem).toBe("FIGHTINGGEM");
    const immune = run(battler("target", MINIMAL_MOVE_CATALOG.TACKLE, { types: ["GHOST"], hp: 100 }));
    expect(immune.state.teams.opponent.members[0]!.hp).toBe(100);
    expect(immune.events).toContainEqual(expect.objectContaining({ type: "moveFailed", side: "player" }));
  });

  it("094 forces damaging-only rolls for Parental Bond's second hit", () => {
    const present = { ...move("094"), power: 1 };
    const scripted: RandomSource = { nextInt: (limit) => limit === 10 ? 0 : limit === 8 ? 7 : limit - 1 };
    const target = battler("target", MINIMAL_MOVE_CATALOG.TACKLE, { hp: 1000,
      stats: { ...battler("target", present).stats, maxHp: 1000 } });
    const result = resolveTeamTurn(createTeamBattleState({
      player: [battler("user", present, { ability: "PARENTALBOND" })], opponent: [target],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, scripted);
    expect(result.trace.filter((entry) => entry.type === "rng" && entry.purpose === "present")
      .map((entry) => entry.type === "rng" ? [entry.maxExclusive, entry.value] : []))
      .toEqual([[10, 0], [8, 7]]);
    expect(result.events.filter((event) => event.type === "damageApplied")).toHaveLength(2);
  });

  it("094 healing and 097 damage share the positioned double-battle adapter", () => {
    const present = { ...move("094"), power: 1 };
    const card = { ...move("097"), power: 1 };
    const scripted: RandomSource = { nextInt: (limit) => limit === 10 ? 8 : limit - 1 };
    const state = createDoubleTeamBattleState({
      player: [battler("healer", present), battler("striker", card)],
      opponent: [battler("wounded", MINIMAL_MOVE_CATALOG.TACKLE, { hp: 100 }),
        battler("target", MINIMAL_MOVE_CATALOG.TACKLE)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 1 } } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], scripted);
    expect(result.state.teams.opponent.members[0]!.hp).toBe(150);
    expect(result.state.teams.opponent.members[1]!.hp).toBeLessThan(200);
    expect(result.state.teams.player.members[1]!.moves[0]!.pp).toBe(19);
  });

  it("084 doubles when the target acted or did not choose a move", () => {
    const payback = move("084");
    const strike = MINIMAL_MOVE_CATALOG.TACKLE;
    const run = (targetAction: "move" | "wait") => resolveTeamTurn(createTeamBattleState({
      player: [battler("user", payback, { stats: { ...battler("x", payback).stats, speed: 30 } })],
      opponent: [battler("target", strike, { stats: { ...battler("x", strike).stats, speed: 80 } })],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: targetAction === "move"
      ? { kind: "move", moveIndex: 0 } : { kind: "wait" } }, rng);
    const acted = run("move");
    const waiting = run("wait");
    const first = acted.events.find((event) => event.type === "damageApplied" && event.target === "opponent");
    const second = waiting.events.find((event) => event.type === "damageApplied" && event.target === "opponent");
    expect(first).toMatchObject({ type: "damageApplied", amount: expect.any(Number) });
    expect(second).toMatchObject({ type: "damageApplied", amount: first?.type === "damageApplied" ? first.amount : 0 });
  });
});
