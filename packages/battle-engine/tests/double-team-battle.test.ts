import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, resolveDoubleTeamTurn,
  type BattleSide, type BattlerState, type RandomSource } from "../src/index.js";
import { describe, expect, it } from "vitest";

const rng: RandomSource = { nextInt: () => 0 };

function pokemon(id: string, side: BattleSide, speed: number, targetCode = "00"): BattlerState {
  const base = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return { id, species: id.toUpperCase(), name: id, level: 30, types: ["NORMAL"],
    stats: { maxHp: 120, attack: 80, defense: 80, specialAttack: 80, specialDefense: 80, speed },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    hp: 120, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: { ...base, accuracy: 0, targetCode }, pp: base.pp }] };
}

describe("double team battles", () => {
  it("keeps two active slots per camp and resolves four independently targeted actions", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("p1", "player", 100), pokemon("p2", "player", 90)],
      opponent: [pokemon("o1", "opponent", 80), pokemon("o2", "opponent", 70)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 1 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 1 } } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 0 } } },
    ], rng);

    expect(result.state.teams.player.activeIndices).toEqual([0, 1]);
    expect(result.state.teams.opponent.activeIndices).toEqual([0, 1]);
    expect(result.state.teams.player.members.every((member) => member.hp < 120)).toBe(true);
    expect(result.state.teams.opponent.members.every((member) => member.hp < 120)).toBe(true);
    expect(result.events.filter((event) => event.type === "positionedActionResolved")).toHaveLength(4);
  });

  it("applies spread damage to both opposing slots with the double-battle reduction", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("p1", "player", 100, "04"), pokemon("p2", "player", 10)],
      opponent: [pokemon("o1", "opponent", 20), pokemon("o2", "opponent", 15)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.opponent.members[0]!.hp).toBeLessThan(120);
    expect(result.state.teams.opponent.members[1]!.hp).toBeLessThan(120);
    expect(result.state.teams.player.members[0]!.moves[0]!.pp).toBe(MINIMAL_MOVE_CATALOG.TACKLE.pp - 1);
  });

  it("lets one active slot spend its action healing an owned reserve", () => {
    const reserve = { ...pokemon("reserve", "player", 60), hp: 10 };
    const state = createDoubleTeamBattleState({
      player: [pokemon("p1", "player", 100), pokemon("p2", "player", 90), reserve],
      opponent: [pokemon("o1", "opponent", 80), pokemon("o2", "opponent", 70)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "item", itemId: "POTION", targetTeamIndex: 2 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.player.members[2]?.hp).toBe(30);
    expect(result.events).toContainEqual({ type: "trainerItemUsed", side: "player", itemId: "POTION",
      targetIndex: 2, target: "reserve", hpRestored: 20, statusCured: null, revived: false });
  });
});
