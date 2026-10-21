import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState, resolveDoubleTeamTurn,
  resolveTeamTurn, type BattleEffects, type BattleMove, type BattleSide, type BattlerState,
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
  const move = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0 };
  return { id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 160, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 110 : 90 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    hp: 160, majorStatus: null, ability: null, heldItem: null, moves: [{ move, pp: move.pp }], ...overrides };
}

function weatherEffects(weather: NonNullable<BattleEffects["weather"]>): BattleEffects {
  return { sides: { player: { reflectTurns: 0, luckyChantTurns: 0 },
    opponent: { reflectTurns: 0, luckyChantTurns: 0 } }, waterSportTurns: 0, weather, weatherTurns: 5 };
}

describe("source end-of-turn and status abilities", () => {
  it("halves sleep duration immediately with Early Bird", () => {
    const powder: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "SLEEPPOWDER", name: "Poudre Dodo",
      functionCode: "003", category: "Status", power: 0, accuracy: 0 };
    const state = createTeamBattleState({
      player: [pokemon("caster", "player", { moves: [{ move: powder, pp: powder.pp }] })],
      opponent: [pokemon("early", "opponent", { ability: "EARLYBIRD" })],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([2]));
    expect(result.state.teams.opponent.members[0]!.majorStatus).toEqual({ kind: "sleep", turnsRemaining: 2 });
  });

  it.each(["rain", "heavy-rain"] as const)("cures status with Hydration under %s", (weather) => {
    const state = createTeamBattleState({
      player: [pokemon("hydration", "player", { ability: "HYDRATION",
        majorStatus: { kind: "poison", toxicCounter: null } })],
      opponent: [pokemon("foe", "opponent", weather === "heavy-rain" ? { ability: "PRIMORDIALSEA" } : {})],
    });
    const result = resolveTeamTurn({ ...state, effects: weatherEffects(weather) },
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(result.state.teams.player.members[0]!.majorStatus).toBeNull();
    expect(result.state.teams.player.members[0]!.hp).toBe(160);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "abilityActivated", ability: "HYDRATION" }));
  });

  it("lets global weather suppression disable Hydration", () => {
    const state = createTeamBattleState({
      player: [pokemon("hydration", "player", { ability: "HYDRATION",
        majorStatus: { kind: "poison", toxicCounter: null } })],
      opponent: [pokemon("cloud", "opponent", { ability: "CLOUDNINE" })],
    });
    const result = resolveTeamTurn({ ...state, effects: weatherEffects("rain") },
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(result.state.teams.player.members[0]!.majorStatus?.kind).toBe("poison");
    expect(result.state.teams.player.members[0]!.hp).toBe(147);
  });

  it("replaces poison damage with one-eighth healing for Poison Heal", () => {
    const state = createTeamBattleState({
      player: [pokemon("healer", "player", { ability: "POISONHEAL", hp: 100,
        majorStatus: { kind: "poison", toxicCounter: 0 } })],
      opponent: [pokemon("foe", "opponent")],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(result.state.teams.player.members[0]).toMatchObject({ hp: 120,
      majorStatus: { kind: "poison", toxicCounter: 1 } });
  });

  it("raises Speed Boost each completed active turn but not on its switch-in turn", () => {
    const initial = createTeamBattleState({
      player: [pokemon("lead", "player"), pokemon("booster", "player", { ability: "SPEEDBOOST" })],
      opponent: [pokemon("foe", "opponent")],
    });
    const switched = resolveTeamTurn(initial,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(switched.state.teams.player.members[1]!.stages.speed).toBe(0);
    const stayed = resolveTeamTurn(switched.state,
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(stayed.state.teams.player.members[1]!.stages.speed).toBe(1);
  });

  it("applies Bad Dreams once in double battles even with two opposing bearers", () => {
    const sleeper = pokemon("sleeper", "player", { majorStatus: { kind: "sleep", turnsRemaining: 3 } });
    const state = createDoubleTeamBattleState({
      player: [sleeper, pokemon("ally", "player")],
      opponent: [pokemon("dream1", "opponent", { ability: "BADDREAMS" }),
        pokemon("dream2", "opponent", { ability: "BADDREAMS" })],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([]));
    expect(result.state.teams.player.members[0]!.hp).toBe(134);
    const damage = result.events.flatMap((event) => event.type === "positionedActionResolved" ? event.events : [])
      .filter((event) => event.type === "abilityDamage" && event.ability === "BADDREAMS");
    expect(damage).toHaveLength(1);
  });
});
