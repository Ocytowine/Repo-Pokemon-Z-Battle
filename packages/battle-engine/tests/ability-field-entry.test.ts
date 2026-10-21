import { MINIMAL_MOVE_CATALOG, activeBattlePositions, calculateDamage, createDoubleTeamBattleState,
  createTeamBattleState, resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide,
  type BattleTrace, type BattlerState, type RandomSource } from "../src/index.js";
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

describe("source entry stat and field abilities", () => {
  it.each([["ESPANTO", "specialAttack"], ["ILLUMINATE", "accuracy"]] as const)(
    "%s lowers the source stat of every opposing active Pokemon", (ability, stat) => {
      const state = createDoubleTeamBattleState({
        player: [pokemon("setter", "player", { ability }), pokemon("ally", "player")],
        opponent: [pokemon("foe1", "opponent"), pokemon("foe2", "opponent")],
      });
      expect(state.teams.opponent.members.slice(0, 2).map((member) => member.stages[stat])).toEqual([-1, -1]);
    });

  it("toggles Trick Room on entry and reverses equal-priority speed order", () => {
    const state = createTeamBattleState({
      player: [pokemon("rare", "player", { ability: "PRESENCIARARA" })],
      opponent: [pokemon("fast", "opponent")],
    });
    expect(state.effects).toMatchObject({ trickRoomTurns: 5 });
    const result = resolveTeamTurn(state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([1, 15, 1, 1, 15, 1]));
    expect(result.events).toContainEqual({ type: "teamActionOrdered", order: [
      { side: "player", kind: "move" }, { side: "opponent", kind: "move" },
    ] });
    expect(result.state.effects).toMatchObject({ trickRoomTurns: 4 });

    const cancelled = createTeamBattleState({
      player: [pokemon("rare", "player", { ability: "PRESENCIARARA" })],
      opponent: [pokemon("other", "opponent", { ability: "PRESENCIARARA" })],
    });
    expect(cancelled.effects).toMatchObject({ trickRoomTurns: 0 });
  });

  it("sets Electric Terrain in singles and doubles and keeps it authoritative", () => {
    const single = createTeamBattleState({ player: [pokemon("setter", "player", { ability: "ELECTRICSURGE" })],
      opponent: [pokemon("foe", "opponent")] });
    expect(single.effects).toMatchObject({ terrain: "electric", terrainTurns: 5 });
    const double = createDoubleTeamBattleState({
      player: [pokemon("setter", "player", { ability: "ELECTRICSURGE" }), pokemon("ally", "player")],
      opponent: [pokemon("foe1", "opponent"), pokemon("foe2", "opponent")],
    });
    const result = resolveDoubleTeamTurn(double, activeBattlePositions(double).map((actor) =>
      ({ actor, action: { kind: "wait" as const } })), { nextInt: () => 0 });
    expect(result.state.effects).toMatchObject({ terrain: "electric", terrainTurns: 4 });
  });

  it("boosts grounded Electric attacks and prevents grounded sleep", () => {
    const attacker = pokemon("attacker", "player", { types: ["ELECTRIC"] });
    const defender = pokemon("defender", "opponent");
    const electric: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, type: "ELECTRIC" };
    const normalTrace: BattleTrace[] = [];
    const terrainTrace: BattleTrace[] = [];
    const normal = calculateDamage("player", attacker, defender, electric,
      new ScriptedRandom([1, 15]), normalTrace);
    const boosted = calculateDamage("player", attacker, defender, electric,
      new ScriptedRandom([1, 15]), terrainTrace, { reflect: false, lightScreen: false, luckyChant: false,
        mudSport: false, waterSport: false, terrain: "electric" });
    expect(boosted).toBe(Math.round(normal * 1.5));

    const sleep: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "HYPNOSIS", category: "Status",
      type: "PSYCHIC", power: 0, accuracy: 0, functionCode: "003" };
    const state = createTeamBattleState({
      player: [pokemon("sleeper", "player", { moves: [{ move: sleep, pp: sleep.pp }] })],
      opponent: [pokemon("terrain", "opponent", { ability: "ELECTRICSURGE" })],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(result.state.teams.opponent.members[0]!.majorStatus).toBeNull();
    expect(result.events).toContainEqual(expect.objectContaining({ type: "statusApplicationFailed", status: "sleep" }));
  });
});
