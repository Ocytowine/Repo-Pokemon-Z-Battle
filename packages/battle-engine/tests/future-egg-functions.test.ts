import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn,
  type BattleMove, type BattlerState, type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: () => 0 };
const sight: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "FUTURESIGHT",
  functionCode: "111", type: "PSYCHIC", category: "Special", power: 130,
  accuracy: 100, effectChance: 0, flags: "" };
const egg: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "TRUCOHUEVO",
  functionCode: "306", type: "WATER", category: "Special", power: 70,
  accuracy: 100, effectChance: 100, flags: "befn" };
function mon(id: string, move: BattleMove, changes: Partial<BattlerState> = {}): BattlerState {
  return { id, name: id, species: "EEVEE", level: 50, types: ["NORMAL"],
    hp: 400, stats: { maxHp: 400, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: 100 }, stages: { attack: 0, defense: 0,
      specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    majorStatus: null, ability: null, heldItem: null,
    moves: [{ move, pp: 10 }], ...changes };
}

describe("delayed attacks", () => {
  it("Future Sight lands two rounds later from the saved attacker and survives JSON restoration", () => {
    const initial = createTeamBattleState({ player: [mon("source", sight)],
      opponent: [mon("target", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const first = resolveTeamTurn(initial, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, rng);
    expect(first.state.teams.opponent.members[0]?.hp).toBe(400);
    expect(first.state.effects?.sides.opponent.futureSight?.[0]?.turns).toBe(2);
    const restored = JSON.parse(JSON.stringify(first.state)) as typeof first.state;
    const waits = { player: { kind: "wait" as const }, opponent: { kind: "wait" as const } };
    const second = resolveTeamTurn(restored, waits, rng);
    expect(second.state.teams.opponent.members[0]?.hp).toBe(400);
    expect(second.state.effects?.sides.opponent.futureSight?.[0]?.turns).toBe(1);
    const third = resolveTeamTurn(second.state, waits, rng);
    expect(third.state.teams.opponent.members[0]?.hp).toBeLessThan(400);
    expect(third.state.effects?.sides.opponent.futureSight).toEqual([]);
    expect(third.events.some((event) => event.type === "futureSightHit")).toBe(true);
  });

  it("Truco Huevo calls a supported status move without spending its PP", () => {
    const initial = createTeamBattleState({ player: [mon("source", egg)],
      opponent: [mon("target", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const result = resolveTeamTurn(initial, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, rng);
    expect(result.state.teams.player.members[0]?.stages.speed).toBe(2);
    expect(result.state.teams.player.members[0]?.moves).toHaveLength(1);
    expect(result.state.teams.player.members[0]?.moves[0]?.pp).toBe(9);
    expect(result.events).toContainEqual({ type: "calledMoveTriggered", side: "player", move: "AGILITY" });
  });

  it("Truco Huevo can call Future Sight and preserve its delayed strike", () => {
    const selectSight: RandomSource = { nextInt: (maximum) => maximum === 18 ? 10 : 0 };
    const initial = createTeamBattleState({ player: [mon("source", egg)],
      opponent: [mon("target", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const first = resolveTeamTurn(initial, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, selectSight);
    expect(first.events).toContainEqual({ type: "calledMoveTriggered", side: "player", move: "FUTURESIGHT" });
    expect(first.state.effects?.sides.opponent.futureSight?.[0]?.turns).toBe(2);
    const waits = { player: { kind: "wait" as const }, opponent: { kind: "wait" as const } };
    const second = resolveTeamTurn(first.state, waits, selectSight);
    const third = resolveTeamTurn(second.state, waits, selectSight);
    expect(third.events.some((event) => event.type === "futureSightHit")).toBe(true);
  });

  it("a called Bubble hits both opponents in double without charging another PP", () => {
    const selectBubble: RandomSource = { nextInt: (maximum) => maximum === 18 ? 11 : 0 };
    const initial = createDoubleTeamBattleState({ player: [mon("source", egg),
      mon("ally", MINIMAL_MOVE_CATALOG.TACKLE)],
    opponent: [mon("target0", MINIMAL_MOVE_CATALOG.TACKLE),
      mon("target1", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const result = resolveDoubleTeamTurn(initial, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } }], selectBubble);
    expect(result.state.teams.opponent.members[0]?.hp).toBeLessThan(400);
    expect(result.state.teams.opponent.members[1]?.hp).toBeLessThan(400);
    expect(result.state.teams.player.members[0]?.moves[0]?.pp).toBe(9);
  });

  it("Future Sight follows a double target slot when its occupant switches", () => {
    const initial = createDoubleTeamBattleState({ player: [mon("source", sight),
      mon("ally", MINIMAL_MOVE_CATALOG.TACKLE)],
    opponent: [mon("other", MINIMAL_MOVE_CATALOG.TACKLE),
      mon("withdrawn", MINIMAL_MOVE_CATALOG.TACKLE),
      mon("replacement", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const wait = (side: "player" | "opponent", slot: number) => ({
      actor: { side, slot }, action: { kind: "wait" as const } });
    const first = resolveDoubleTeamTurn(initial, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 1 } } },
      wait("player", 1), wait("opponent", 0), wait("opponent", 1)], rng);
    const second = resolveDoubleTeamTurn(first.state, [wait("player", 0), wait("player", 1),
      wait("opponent", 0),
      { actor: { side: "opponent", slot: 1 }, action: { kind: "switch", teamIndex: 2 } }], rng);
    const third = resolveDoubleTeamTurn(second.state, [wait("player", 0), wait("player", 1),
      wait("opponent", 0), wait("opponent", 1)], rng);
    expect(third.state.teams.opponent.members[1]?.hp).toBe(400);
    expect(third.state.teams.opponent.members[2]?.hp).toBeLessThan(400);
    expect(third.state.effects?.sides.opponent.futureSight).toEqual([]);
  });
});
