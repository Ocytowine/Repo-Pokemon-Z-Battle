import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide, type BattlerState,
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

describe("source PP and held-item control abilities", () => {
  it("makes an opposing move spend two PP with Pressure but leaves self-targeting moves unchanged", () => {
    const state = createTeamBattleState({
      player: [pokemon("attacker", "player")], opponent: [pokemon("pressure", "opponent", { ability: "PRESSURE" })],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([1, 15]));
    expect(result.state.teams.player.members[0]!.moves[0]!.pp).toBe(MINIMAL_MOVE_CATALOG.TACKLE.pp - 2);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "abilityActivated", ability: "PRESSURE",
      effect: "pressure" }));

    const focus: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "FOCUSENERGY",
      name: "Puissance", functionCode: "048", power: 0, category: "Status", targetCode: "10" };
    const selfState = createTeamBattleState({
      player: [pokemon("focused", "player", { moves: [{ move: focus, pp: focus.pp }] })],
      opponent: [pokemon("pressure", "opponent", { ability: "PRESSURE" })],
    });
    const selfResult = resolveTeamTurn(selfState,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([0]));
    expect(selfResult.state.teams.player.members[0]!.moves[0]!.pp).toBe(focus.pp - 1);
  });

  it("charges one additional PP for each Pressure target of a spread move", () => {
    const spread: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, targetCode: "04", accuracy: 0 };
    const state = createDoubleTeamBattleState({
      player: [pokemon("attacker", "player", { moves: [{ move: spread, pp: spread.pp }] }), pokemon("ally", "player")],
      opponent: [pokemon("pressure1", "opponent", { ability: "PRESSURE" }),
        pokemon("pressure2", "opponent", { ability: "PRESSURE" })],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([0, 1, 15, 1, 15]));
    expect(result.state.teams.player.members[0]!.moves[0]!.pp).toBe(spread.pp - 3);

    const lastPpState = createDoubleTeamBattleState({
      player: [pokemon("attacker", "player", { moves: [{ move: spread, pp: 1 }] }), pokemon("ally", "player")],
      opponent: [pokemon("pressure1", "opponent", { ability: "PRESSURE" }),
        pokemon("pressure2", "opponent", { ability: "PRESSURE" })],
    });
    const lastPpResult = resolveDoubleTeamTurn(lastPpState, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([0, 1, 15, 1, 15]));
    expect(lastPpResult.state.teams.player.members[0]!.moves[0]!.pp).toBe(0);
    expect(lastPpResult.state.teams.opponent.members.slice(0, 2).every((member) => member.hp < member.stats.maxHp)).toBe(true);
  });

  it("blocks opposing berries with Unnerve and lets them reactivate after it leaves", () => {
    const state = createTeamBattleState({
      player: [pokemon("berry", "player", { hp: 60, heldItem: "ORANBERRY" })],
      opponent: [pokemon("unnerve", "opponent", { ability: "UNNERVE" }), pokemon("reserve", "opponent")],
    });
    const blocked = resolveTeamTurn(state,
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(blocked.state.teams.player.members[0]).toMatchObject({ hp: 60, heldItem: "ORANBERRY" });
    const released = resolveTeamTurn(blocked.state,
      { player: { kind: "wait" }, opponent: { kind: "switch", teamIndex: 1 } }, new ScriptedRandom([]));
    expect(released.state.teams.player.members[0]).toMatchObject({ hp: 70, heldItem: null });
  });

  it("lets one Unnerve bearer block both opposing berries in double battles", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("unnerve", "player", { ability: "UNNERVE" }), pokemon("ally", "player")],
      opponent: [pokemon("berry1", "opponent", { hp: 60, heldItem: "ORANBERRY" }),
        pokemon("berry2", "opponent", { hp: 60, heldItem: "ORANBERRY" })],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([]));
    expect(result.state.teams.opponent.members.slice(0, 2).map((member) => [member.hp, member.heldItem]))
      .toEqual([[60, "ORANBERRY"], [60, "ORANBERRY"]]);
  });

  it("lets an ally's Unnerve block a defensive berry in a double battle", () => {
    const psychic: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "PSYCHICSTRIKE",
      type: "PSYCHIC", targetCode: "00", accuracy: 0 };
    const state = createDoubleTeamBattleState({
      player: [pokemon("attacker", "player", { moves: [{ move: psychic, pp: psychic.pp }] }),
        pokemon("unnerve", "player", { ability: "UNNERVE" })],
      opponent: [pokemon("berry", "opponent", { types: ["POISON"], heldItem: "PAYAPABERRY" }),
        pokemon("ally", "opponent")],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([0, 1, 15]));
    expect(result.state.teams.opponent.members[0]!.heldItem).toBe("PAYAPABERRY");
  });

  it("makes held items inert with Klutz without removing them", () => {
    const move: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0 };
    const target = pokemon("target", "opponent");
    const damage = (ability: BattlerState["ability"], heldItem: BattlerState["heldItem"]): number =>
      calculateDamage("player", pokemon("attacker", "player", { ability, heldItem }), target, move,
        new ScriptedRandom([1, 15]), [], { reflect: false, lightScreen: false, luckyChant: false,
          mudSport: false, waterSport: false });
    expect(damage("KLUTZ", "LIFEORB")).toBe(damage(null, null));
    expect(damage(null, "LIFEORB")).toBeGreaterThan(damage("KLUTZ", "LIFEORB"));

    const state = createTeamBattleState({
      player: [pokemon("klutz", "player", { ability: "KLUTZ", hp: 60, heldItem: "ORANBERRY" })],
      opponent: [pokemon("foe", "opponent")],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(result.state.teams.player.members[0]).toMatchObject({ hp: 60, heldItem: "ORANBERRY" });
  });

  it("doubles Unburden speed after an item is consumed and resets it on switch", () => {
    const fighting: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "FIGHTINGHIT",
      type: "FIGHTING", accuracy: 0 };
    const state = createTeamBattleState({
      player: [pokemon("unburden", "player", { ability: "UNBURDEN", heldItem: "FIGHTINGGEM",
        stats: { ...pokemon("unburden", "player").stats, speed: 60 }, moves: [{ move: fighting, pp: fighting.pp }] }),
        pokemon("reserve", "player")],
      opponent: [pokemon("fast", "opponent", { stats: { ...pokemon("fast", "opponent").stats, speed: 90 } })],
    });
    const consumed = resolveTeamTurn(state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([1, 15, 1, 15]));
    expect(consumed.events).toContainEqual({ type: "teamActionOrdered", order: [
      { side: "opponent", kind: "move" }, { side: "player", kind: "move" },
    ] });
    expect(consumed.state.teams.player.members[0]).toMatchObject({ heldItem: null,
      recyclableItem: "FIGHTINGGEM", volatile: { unburdened: true } });
    const accelerated = resolveTeamTurn(consumed.state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([1, 15, 1, 15]));
    expect(accelerated.events).toContainEqual({ type: "teamActionOrdered", order: [
      { side: "player", kind: "move" }, { side: "opponent", kind: "move" },
    ] });
    const switched = resolveTeamTurn(accelerated.state,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    const returned = resolveTeamTurn(switched.state,
      { player: { kind: "switch", teamIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(returned.state.teams.player.members[0]!.volatile?.unburdened).not.toBe(true);
  });

  it("lets Pickup recover the latest item consumed by another active battler", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("pickup", "player", { ability: "PICKUP" }), pokemon("ally", "player")],
      opponent: [pokemon("oran", "opponent", { hp: 60, heldItem: "ORANBERRY" }),
        pokemon("liechi", "opponent", { hp: 30, heldItem: "LIECHIBERRY" })],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([]));
    expect(result.state.teams.player.members[0]!.heldItem).toBe("LIECHIBERRY");
    expect(result.events).toContainEqual(expect.objectContaining({ type: "positionedActionResolved",
      events: expect.arrayContaining([{ type: "heldItemRecovered", side: "player", item: "LIECHIBERRY",
        ability: "PICKUP" }]) }));
  });

  it("restores a consumed berry with Harvest and immediately checks its activation", () => {
    const state = createTeamBattleState({
      player: [pokemon("harvest", "player", { ability: "HARVEST", hp: 60, heldItem: "ORANBERRY" })],
      opponent: [pokemon("foe", "opponent")],
    });
    const sunny = { ...state, effects: { sides: {
      player: { reflectTurns: 0, luckyChantTurns: 0 }, opponent: { reflectTurns: 0, luckyChantTurns: 0 },
    }, waterSportTurns: 0, weather: "sun" as const, weatherTurns: 5 } };
    const result = resolveTeamTurn(sunny,
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(result.state.teams.player.members[0]).toMatchObject({ hp: 80, heldItem: null,
      recyclableItem: "ORANBERRY", volatile: { unburdened: true } });
    expect(result.events).toContainEqual({ type: "heldItemRecovered", side: "player",
      item: "ORANBERRY", ability: "HARVEST" });
  });
});
