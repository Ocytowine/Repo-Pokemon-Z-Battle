import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleSide, type BattlerState, type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: () => 0 };
const tackle = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0 };
const water = { ...MINIMAL_MOVE_CATALOG.WATERGUN, accuracy: 0 };

function mon(id: string, side: BattleSide, item: string | null = null, speed = 100): BattlerState {
  return { id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 500, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 500, majorStatus: null, ability: null,
    heldItem: item, moves: [{ move: tackle, pp: 10 }, { move: water, pp: 10 }] };
}

describe("objets Choix", () => {
  it("boosts the matching attack stat and respects held-item suppression", () => {
    const target = mon("target", "opponent");
    const damage = (item: string | null, move: typeof tackle, magicRoomTurns = 0) => calculateDamage(
      "player", mon("user", "player", item), target, move, rng, [],
      { reflect: false, lightScreen: false, luckyChant: false, mudSport: false,
        waterSport: false, magicRoomTurns });
    expect(damage("CHOICEBAND", tackle)).toBeGreaterThan(damage(null, tackle));
    expect(damage("CHOICEBAND", water)).toBe(damage(null, water));
    expect(damage("CHOICESPECS", water)).toBeGreaterThan(damage(null, water));
    expect(damage("CHOICESPECS", tackle)).toBe(damage(null, tackle));
    expect(damage("CHOICEBAND", tackle, 2)).toBe(damage(null, tackle));
  });

  it("locks the first used move, releases it when suppressed, and restores it afterward", () => {
    const start = createTeamBattleState({ player: [mon("user", "player", "CHOICEBAND")],
      opponent: [mon("target", "opponent")] });
    const act = { player: { kind: "move" as const, moveIndex: 1 }, opponent: { kind: "wait" as const } };
    const first = resolveTeamTurn(start, { ...act, player: { kind: "move", moveIndex: 0 } }, rng);
    expect(first.state.teams.player.members[0]!.volatile?.choiceLockedMove).toBe(tackle.internalName);
    const locked = resolveTeamTurn(first.state, act, rng);
    expect(locked.events).toContainEqual({ type: "moveUsed", side: "player", move: tackle.internalName });
    const suppressed = resolveTeamTurn({ ...locked.state, effects: { ...locked.state.effects!, magicRoomTurns: 2 } }, act, rng);
    expect(suppressed.events).toContainEqual({ type: "moveUsed", side: "player", move: water.internalName });
    const restored = resolveTeamTurn({ ...suppressed.state, effects: { ...suppressed.state.effects!, magicRoomTurns: 0 } }, act, rng);
    expect(restored.events).toContainEqual({ type: "moveUsed", side: "player", move: tackle.internalName });
  });

  it("applies Scarf speed and the choice lock in doubles", () => {
    const player = mon("fast", "player", "CHOICESCARF", 80);
    const opponent = mon("rival", "opponent", null, 100);
    const start = createDoubleTeamBattleState({ player: [player], opponent: [opponent] });
    const actions = [
      { actor: { side: "player" as const, slot: 0 }, action: { kind: "move" as const, moveIndex: 0 } },
      { actor: { side: "opponent" as const, slot: 0 }, action: { kind: "move" as const, moveIndex: 0 } },
    ];
    const first = resolveDoubleTeamTurn(start, actions, rng);
    expect(first.events.find((event) => event.type === "teamActionOrdered")?.order[0]?.side).toBe("player");
    const next = resolveDoubleTeamTurn(first.state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 1 } }, actions[1]!,
    ], rng);
    expect(next.events.some((event) => event.type === "positionedActionResolved"
      && event.actor.side === "player" && event.events.some((inner) => inner.type === "moveUsed"
        && inner.move === tackle.internalName))).toBe(true);
  });
});
