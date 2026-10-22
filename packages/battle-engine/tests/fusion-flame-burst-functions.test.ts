import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattlerState,
  type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: () => 0 };

function pokemon(id: string, move: BattleMove, speed: number,
  overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"], hp: 200,
    stats: { maxHp: 200, attack: 80, defense: 80, specialAttack: 80, specialDefense: 80, speed },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move, pp: move.pp }], ...overrides };
}

function move(code: "074" | "079" | "07A"): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.TACKLE, id: 1800 + Number.parseInt(code, 16),
    internalName: `MOVE${code}`, name: code, functionCode: code, power: 30,
    category: "Special", accuracy: 0 };
}

describe("Pokemon Z Flame Burst and reciprocal Fusion moves", () => {
  it.each([["079", "07A"], ["07A", "079"]] as const)(
    "%s arms a same-turn double-damage response from %s", (firstCode, secondCode) => {
      const state = createTeamBattleState({ player: [pokemon("first", move(firstCode), 100)],
        opponent: [pokemon("second", move(secondCode), 50)] });
      const result = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
        opponent: { kind: "move", moveIndex: 0 } }, rng);
      const hits = result.events.filter((event) => event.type === "damageApplied" && event.amount > 0);
      expect(hits).toHaveLength(2);
      expect(hits[1]!.amount).toBe(hits[0]!.amount * 2);
      expect(result.state.effects).toMatchObject({ fusionBoltTurn: null, fusionFlareTurn: null });
    });

  it("does not arm Fusion after an immune hit or carry its marker into another turn", () => {
    const bolt = { ...move("079"), type: "ELECTRIC" };
    const flare = move("07A");
    const immune = createTeamBattleState({ player: [pokemon("first", bolt, 100)],
      opponent: [pokemon("second", flare, 50, { types: ["GROUND"] })] });
    const missed = resolveTeamTurn(immune, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(missed.events.filter((event) => event.type === "damageApplied" && event.amount > 0))
      .toHaveLength(1);
    expect(missed.state.effects).toMatchObject({ fusionBoltTurn: null, fusionFlareTurn: null });
    const next = resolveTeamTurn(missed.state, { player: { kind: "wait" },
      opponent: { kind: "move", moveIndex: 0 } }, rng);
    const firstFlare = missed.events.find((event) => event.type === "damageApplied" && event.target === "player");
    const secondFlare = next.events.find((event) => event.type === "damageApplied" && event.target === "player");
    expect(secondFlare?.type === "damageApplied" ? secondFlare.amount : null)
      .toBe(firstFlare?.type === "damageApplied" ? firstFlare.amount : null);
  });

  it("shares Fusion markers across allied slots in doubles", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("bolt", move("079"), 100), pokemon("flare", move("07A"), 90)],
      opponent: [pokemon("target-a", MINIMAL_MOVE_CATALOG.TACKLE, 50),
        pokemon("target-b", MINIMAL_MOVE_CATALOG.TACKLE, 40)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 1 } } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    const damage = result.events.flatMap((event) => event.type === "positionedActionResolved"
      ? event.events : []).filter((event) => event.type === "damageApplied" && event.amount > 0);
    expect(damage).toHaveLength(2);
    expect(damage[1]!.amount).toBe(damage[0]!.amount * 2);
    expect(result.state.effects).toMatchObject({ fusionBoltTurn: null, fusionFlareTurn: null });
  });

  it("Flame Burst damages only the target's living, unguarded partner in doubles", () => {
    const burst = move("074");
    const start = (ability: BattlerState["ability"] | null) => createDoubleTeamBattleState({
      player: [pokemon("caster", burst, 100), pokemon("friend", MINIMAL_MOVE_CATALOG.TACKLE, 80)],
      opponent: [pokemon("target", MINIMAL_MOVE_CATALOG.TACKLE, 60),
        pokemon("partner", MINIMAL_MOVE_CATALOG.TACKLE, 50, { ability })],
    });
    const actions = [
      { actor: { side: "player" as const, slot: 0 }, action: { kind: "move" as const,
        moveIndex: 0, target: { side: "opponent" as const, slot: 0 } } },
      { actor: { side: "player" as const, slot: 1 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 0 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 1 }, action: { kind: "wait" as const } },
    ];
    const hit = resolveDoubleTeamTurn(start(null), actions, rng);
    expect(hit.state.teams.opponent.members[1]!.hp).toBe(188);
    expect(hit.events).toContainEqual(expect.objectContaining({ type: "positionedActionResolved",
      targets: [{ side: "opponent", slot: 1 }], events: [expect.objectContaining({
        type: "collateralDamage", amount: 12, hp: 188,
      })] }));
    const guarded = resolveDoubleTeamTurn(start("MAGICGUARD"), actions, rng);
    expect(guarded.state.teams.opponent.members[1]!.hp).toBe(200);
  });
});
