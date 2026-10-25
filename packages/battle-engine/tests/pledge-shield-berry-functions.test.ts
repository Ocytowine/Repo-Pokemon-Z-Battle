import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattlerState,
  type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: () => 0 };
const move = (code: BattleMove["functionCode"], changes: Partial<BattleMove> = {}): BattleMove => ({
  ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: code, functionCode: code,
  power: 80, accuracy: 0, effectChance: 0, flags: "abef", ...changes });
function mon(id: string, selected: BattleMove, speed = 100, changes: Partial<BattlerState> = {}): BattlerState {
  return { id, name: id, species: "EEVEE", level: 50, types: ["NORMAL"],
    hp: 400, stats: { maxHp: 400, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed }, stages: { attack: 0, defense: 0,
      specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: selected, pp: 10 }], ...changes };
}
const act = (side: "player" | "opponent", slot: number) => ({
  actor: { side, slot }, action: { kind: "move" as const, moveIndex: 0 },
});

describe("Pledge, shields and berry-gated moves", () => {
  it("Dragon Hammer's source code 0 follows ordinary physical damage", () => {
    const initial = createTeamBattleState({ player: [mon("user", move("0", {
      type: "DRAGON", power: 90 }))], opponent: [mon("foe", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const result = resolveTeamTurn(initial, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, rng);
    expect(result.state.teams.opponent.members[0]?.hp).toBeLessThan(400);
  });
  it.each([["106", "107", "seaOfFireTurns", "opponent"],
    ["106", "108", "swampTurns", "opponent"],
    ["107", "108", "rainbowTurns", "player"]] as const)(
    "%s + %s combines into a shared side effect", (first, second, effect, side) => {
      const pledge = (code: "106" | "107" | "108") => move(code, {
        category: "Special", type: code === "106" ? "GRASS"
          : code === "107" ? "FIRE" : "WATER" });
      const initial = createDoubleTeamBattleState({ player: [mon("first", pledge(first), 130),
        mon("second", pledge(second), 60)], opponent: [mon("foe0", MINIMAL_MOVE_CATALOG.TACKLE, 80),
        mon("foe1", MINIMAL_MOVE_CATALOG.TACKLE, 70)] });
      const result = resolveDoubleTeamTurn(initial, [act("player", 0), act("player", 1),
        { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
        { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } }], rng);
      expect(result.state.effects?.sides[side][effect]).toBeGreaterThan(0);
      expect(result.state.teams.player.members[0]?.moves[0]?.pp).toBe(9);
      expect(result.state.teams.player.members[1]?.moves[0]?.pp).toBe(9);
      expect(result.state.teams.opponent.members[0]?.hp).toBeLessThan(400);
      expect(result.state.teams.opponent.members[0]?.hp).toBeGreaterThan(0);
      if (effect === "seaOfFireTurns") expect(result.events.some((event) =>
        event.type === "positionedActionResolved" && event.events.some((inner) =>
          inner.type === "pledgeDamage"))).toBe(true);
      const restored = JSON.parse(JSON.stringify(result.state)) as typeof result.state;
      expect(restored.effects?.sides[side][effect]).toBe(result.state.effects?.sides[side][effect]);
    });

  it("King's Shield lowers contact Attack, Spiky Shield hurts contact and status passes King's Shield", () => {
    for (const code of ["14B", "14C"] as const) {
      const initial = createTeamBattleState({ player: [mon("guard", move(code, {
        category: "Status", power: 0, targetCode: "10", priority: 4 }))],
      opponent: [mon("foe", move("000", { flags: "abef" }))] });
      const result = resolveTeamTurn(initial, { player: { kind: "move", moveIndex: 0 },
        opponent: { kind: "move", moveIndex: 0 } }, rng);
      expect(result.state.teams.player.members[0]?.hp).toBe(400);
      if (code === "14B") expect(result.state.teams.opponent.members[0]?.stages.attack).toBe(-2);
      else expect(result.state.teams.opponent.members[0]?.hp).toBeLessThan(400);
    }
    const statusAttack = createTeamBattleState({ player: [mon("guard", move("14B", {
      category: "Status", power: 0, targetCode: "10", priority: 4 }))],
    opponent: [mon("foe", move("003", { category: "Status", power: 0,
      accuracy: 0, flags: "bce" }))] });
    const statusResult = resolveTeamTurn(statusAttack, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(statusResult.state.teams.player.members[0]?.majorStatus?.kind).toBe("sleep");
  });

  it("158 requires an eaten berry while source 162 follows its ordinary damage class", () => {
    const gated = move("158", { type: "FAIRY", power: 110 });
    const initial = createTeamBattleState({ player: [mon("user", gated)],
      opponent: [mon("foe", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const actions = { player: { kind: "move" as const, moveIndex: 0 },
      opponent: { kind: "wait" as const } };
    const failed = resolveTeamTurn(initial, actions, rng);
    expect(failed.events).toContainEqual({ type: "moveFailed", side: "player",
      move: "158", reason: "condition" });
    const fed = createTeamBattleState({ player: [mon("user", gated, 100,
      { hp: 100, heldItem: "ORANBERRY" })],
    opponent: [mon("foe", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const eaten = resolveTeamTurn(fed, actions, rng);
    expect(eaten.state.teams.player.members[0]?.volatile?.belchReady).toBe(true);
    const afterBerry = resolveTeamTurn(eaten.state, actions, rng);
    expect(afterBerry.state.teams.opponent.members[0]?.hp).toBeLessThan(400);
    const plain = createTeamBattleState({ player: [mon("user", move("162", {
      type: "POISON", category: "Special", power: 130 }))],
    opponent: [mon("foe", MINIMAL_MOVE_CATALOG.TACKLE)] });
    expect(resolveTeamTurn(plain, actions, rng).state.teams.opponent.members[0]?.hp).toBeLessThan(400);
  });
});
