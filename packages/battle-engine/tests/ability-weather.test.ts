import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleEffects, type BattleMove, type BattleSide, type BattleTrace, type BattlerState,
  type RandomSource } from "../src/index.js";
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
    stats: { maxHp: 160, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 80 : 100 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    hp: 160, majorStatus: null, ability: null, heldItem: null, moves: [{ move, pp: move.pp }], ...overrides };
}

describe("source weather abilities", () => {
  const effects = (weather: NonNullable<BattleEffects["weather"]>, weatherTurns = 5): BattleEffects => ({
    sides: { player: { reflectTurns: 0, luckyChantTurns: 0 },
      opponent: { reflectTurns: 0, luckyChantTurns: 0 } },
    waterSportTurns: 0, weather, weatherTurns,
  });

  it.each([
    ["DRIZZLE", "rain"], ["DROUGHT", "sun"], ["SANDSTREAM", "sand"], ["SNOWWARNING", "hail"],
  ] as const)("sets five turns of weather with %s in single and double battles", (ability, weather) => {
    const single = createTeamBattleState({
      player: [pokemon("setter", "player", { ability })], opponent: [pokemon("foe", "opponent")],
    });
    expect(single.effects).toMatchObject({ weather, weatherTurns: 5 });
    const double = createDoubleTeamBattleState({
      player: [pokemon("setter", "player", { ability }), pokemon("ally", "player")],
      opponent: [pokemon("foe1", "opponent"), pokemon("foe2", "opponent")],
    });
    expect(double.effects).toMatchObject({ weather, weatherTurns: 5 });
  });

  it("applies source weather healing, Solar Power recoil and sand immunity", () => {
    const rain = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("dish", "player", { ability: "RAINDISH", hp: 100 })],
      opponent: [pokemon("rain", "opponent", { ability: "DRIZZLE" })],
    }), { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(rain.state.teams.player.members[0]!.hp).toBe(110);

    const sun = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("solar", "player", { ability: "SOLARPOWER" })],
      opponent: [pokemon("sun", "opponent", { ability: "DROUGHT" })],
    }), { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(sun.state.teams.player.members[0]!.hp).toBe(140);
    expect(sun.events).toContainEqual(expect.objectContaining({ type: "abilityDamage", ability: "SOLARPOWER", amount: 20 }));

    const sand = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("normal", "player")], opponent: [pokemon("sand", "opponent", { ability: "SANDSTREAM", types: ["ROCK"] })],
    }), { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(sand.state.teams.player.members[0]!.hp).toBe(150);
    expect(sand.state.teams.opponent.members[0]!.hp).toBe(160);
  });

  it("uses Sand Rush for order and Sand Veil for source evasion", () => {
    const rushed = createTeamBattleState({
      player: [pokemon("rush", "player", { ability: "SANDRUSH" })],
      opponent: [pokemon("setter", "opponent", { ability: "SANDSTREAM" })],
    });
    const order = resolveTeamTurn(rushed,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([0, 1, 15, 0, 1, 15]));
    expect(order.events).toContainEqual({ type: "teamActionOrdered", order: [
      { side: "player", kind: "move" }, { side: "opponent", kind: "move" },
    ] });

    const veil = createTeamBattleState({
      player: [pokemon("attacker", "player", { stats: { ...pokemon("x", "player").stats, speed: 120 } })],
      opponent: [pokemon("veil", "opponent", { ability: "SANDVEIL" })],
    });
    const miss = resolveTeamTurn({ ...veil, effects: { sides: {
      player: { reflectTurns: 0, luckyChantTurns: 0 }, opponent: { reflectTurns: 0, luckyChantTurns: 0 },
    }, waterSportTurns: 0, weather: "sand", weatherTurns: 5 } },
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([90]));
    expect(miss.events).toContainEqual({ type: "moveMissed", side: "player", move: "TACKLE" });
  });

  it("boosts Solar Power, Sand Force and the base sun/rain type modifiers", () => {
    const special = { ...MINIMAL_MOVE_CATALOG.ICEBEAM, type: "FIRE", accuracy: 0 };
    const physical = { ...MINIMAL_MOVE_CATALOG.TACKLE, type: "ROCK", accuracy: 0 };
    const defender = pokemon("target", "opponent");
    const damage = (attacker: BattlerState, move: BattleMove, weather: "sun" | "sand" | "rain"): number =>
      calculateDamage("player", attacker, defender, move, new ScriptedRandom([1, 15]), [] as BattleTrace[],
        { reflect: false, lightScreen: false, luckyChant: false, mudSport: false, waterSport: false, weather });
    expect(damage(pokemon("solar", "player", { ability: "SOLARPOWER" }), special, "sun"))
      .toBeGreaterThan(damage(pokemon("plain", "player"), special, "rain"));
    expect(damage(pokemon("sand", "player", { ability: "SANDFORCE" }), physical, "sand"))
      .toBeGreaterThan(damage(pokemon("plain", "player"), physical, "sand"));
  });

  it("applies Z's Rock special defense and Ice physical defense weather bonuses", () => {
    const special = { ...MINIMAL_MOVE_CATALOG.ICEBEAM, type: "WATER", accuracy: 0 };
    const physical = { ...MINIMAL_MOVE_CATALOG.TACKLE, type: "NORMAL", accuracy: 0 };
    const hit = (move: BattleMove, target: BattlerState, weather: "sand" | "hail" | null): number =>
      calculateDamage("player", pokemon("attacker", "player"), target, move,
        new ScriptedRandom([1, 15]), [] as BattleTrace[],
        { reflect: false, lightScreen: false, luckyChant: false, mudSport: false, waterSport: false, weather });
    const rock = pokemon("rock", "opponent", { types: ["ROCK"] });
    const ice = pokemon("ice", "opponent", { types: ["ICE"] });
    expect(hit(special, rock, "sand")).toBeLessThan(hit(special, rock, null));
    expect(hit(physical, ice, "hail")).toBeLessThan(hit(physical, ice, null));
  });

  it("ports Slush Rush and Poder Gelido as one hail-speed family", () => {
    for (const ability of ["SLUSHRUSH", "PODERGELIDO"] as const) {
      const state = createTeamBattleState({
        player: [pokemon("hail-runner", "player", { ability })],
        opponent: [pokemon("faster", "opponent")],
      });
      const result = resolveTeamTurn({ ...state, effects: effects("hail") },
        { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
        new ScriptedRandom([0, 1, 15, 0, 1, 15]));
      expect(result.events).toContainEqual({ type: "teamActionOrdered", order: [
        { side: "player", kind: "move" }, { side: "opponent", kind: "move" },
      ] });
    }
    const iceMove: BattleMove = { ...MINIMAL_MOVE_CATALOG.ICEBEAM, accuracy: 0 };
    const target = pokemon("target", "opponent");
    const damage = (ability: BattlerState["ability"]): number => calculateDamage("player",
      pokemon("attacker", "player", { ability }), target, iceMove, new ScriptedRandom([1, 15]), [],
      { reflect: false, lightScreen: false, luckyChant: false, mudSport: false, waterSport: false, weather: "hail" });
    expect(damage("PODERGELIDO")).toBeGreaterThan(damage(null));
  });

  it("makes Overcoat immune to sand and powder unless Mold Breaker bypasses it", () => {
    const powder: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "SLEEPPOWDER", name: "Poudre Dodo",
      functionCode: "003", category: "Status", power: 0, accuracy: 0, flags: "l" };
    const state = createTeamBattleState({
      player: [pokemon("powder", "player", { moves: [{ move: powder, pp: powder.pp }] })],
      opponent: [pokemon("coat", "opponent", { ability: "OVERCOAT" })],
    });
    const blocked = resolveTeamTurn({ ...state, effects: effects("sand") },
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(blocked.state.teams.opponent.members[0]!.majorStatus).toBeNull();
    expect(blocked.state.teams.opponent.members[0]!.hp).toBe(160);
    expect(blocked.events).toContainEqual(expect.objectContaining({ type: "abilityActivated", ability: "OVERCOAT" }));

    const bypass = resolveTeamTurn({ ...state, teams: { ...state.teams, player: { ...state.teams.player,
      members: [pokemon("breaker", "player", { ability: "MOLDBREAKER", moves: [{ move: powder, pp: powder.pp }] })] } } },
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([0]));
    expect(bypass.state.teams.opponent.members[0]!.majorStatus?.kind).toBe("sleep");
  });

  it.each(["AIRLOCK", "CLOUDNINE"] as const)("suppresses but preserves underlying weather with %s", (ability) => {
    const state = createTeamBattleState({
      player: [pokemon("solar", "player", { ability: "SOLARPOWER" })],
      opponent: [pokemon("suppressor", "opponent", { ability })],
    });
    const result = resolveTeamTurn({ ...state, effects: effects("sun") },
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(result.state.teams.player.members[0]!.hp).toBe(160);
    expect(result.state.effects).toMatchObject({ weather: "sun", weatherTurns: 4 });
  });

  it("lets an ally suppress weather globally in a double battle", () => {
    const sureHit: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0 };
    const state = createDoubleTeamBattleState({
      player: [pokemon("runner", "player", { ability: "SLUSHRUSH", moves: [{ move: sureHit, pp: sureHit.pp }] }),
        pokemon("air-lock", "player", { ability: "AIRLOCK" })],
      opponent: [pokemon("faster", "opponent", { moves: [{ move: sureHit, pp: sureHit.pp }] }),
        pokemon("snow", "opponent", { ability: "SNOWWARNING" })],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([0, 0, 1, 15, 1, 15]));
    const order = result.events.find((event) => event.type === "teamActionOrdered")?.order;
    expect(order?.slice(-2)).toEqual([
      { side: "opponent", kind: "move" }, { side: "player", kind: "move" },
    ]);
    expect(result.state.effects).toMatchObject({ weather: "hail", weatherTurns: 4 });
  });

  it.each([
    ["PRIMORDIALSEA", "heavy-rain", "FIRE"],
    ["DESOLATELAND", "harsh-sun", "WATER"],
    ["DELTASTREAM", "strong-winds", "ELECTRIC"],
  ] as const)("sets persistent extreme weather with %s", (ability, weather, moveType) => {
    const move: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, type: moveType, accuracy: 0 };
    const state = createTeamBattleState({
      player: [pokemon("owner", "player", { ability })],
      opponent: [pokemon("normal-weather", "opponent", { ability: "DRIZZLE", types: ["FLYING"],
        moves: [{ move, pp: move.pp }] })],
    });
    expect(state.effects).toMatchObject({ weather, weatherTurns: -1 });
    const result = resolveTeamTurn(state,
      { player: { kind: "wait" }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom(weather === "strong-winds" ? [1, 15] : []));
    expect(result.state.effects).toMatchObject({ weather, weatherTurns: -1 });
    if (weather !== "strong-winds") {
      expect(result.events).toContainEqual({ type: "moveFailed", side: "opponent", move: "TACKLE", reason: "condition" });
    }
  });

  it("neutralizes Flying weaknesses in strong winds and ends an extreme weather when its owner leaves", () => {
    const electric: BattleMove = { ...MINIMAL_MOVE_CATALOG.ICEBEAM, type: "ELECTRIC", accuracy: 0 };
    const attacker = pokemon("attacker", "player");
    const flying = pokemon("flying", "opponent", { types: ["FLYING"] });
    const trace: BattleTrace[] = [];
    calculateDamage("player", attacker, flying, electric, new ScriptedRandom([1, 15]), trace,
      { reflect: false, lightScreen: false, luckyChant: false, mudSport: false, waterSport: false,
        weather: "strong-winds" });
    expect(trace.find((entry) => entry.type === "damage")).toMatchObject({ effectiveness: 1 });

    const state = createTeamBattleState({
      player: [pokemon("owner", "player", { ability: "PRIMORDIALSEA" }), pokemon("reserve", "player")],
      opponent: [pokemon("foe", "opponent")],
    });
    const switched = resolveTeamTurn(state,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(switched.state.effects).toMatchObject({ weather: null, weatherTurns: 0 });
  });
});
