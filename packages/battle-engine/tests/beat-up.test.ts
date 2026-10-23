import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide,
  type BattlerState, type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: (max) => max - 1 };
function pokemon(id: string, side: BattleSide, code: BattleMove["functionCode"] = "000",
  overrides: Partial<BattlerState> = {}): BattlerState {
  const move: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: code,
    functionCode: code, power: 1, accuracy: 0, effectChance: 0 };
  return { id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 500, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 100 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 500, majorStatus: null, ability: null, heldItem: null, baseAttack: 50,
    moves: [{ move, pp: 10 }], ...overrides };
}

describe("Beat Up participants", () => {
  it("uses one hit per eligible party member and each species' base Attack", () => {
    const active = pokemon("active", "player", "0C1", { baseAttack: 50 });
    const strong = pokemon("strong", "player", "000", { baseAttack: 150 });
    const poisoned = pokemon("poisoned", "player", "000", { baseAttack: 150,
      majorStatus: { kind: "poison", toxicCounter: null } });
    const fainted = pokemon("fainted", "player", "000", { baseAttack: 150, hp: 0 });
    const state = createTeamBattleState({ player: [active, strong, poisoned, fainted],
      opponent: [pokemon("target", "opponent")] });
    const result = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, rng);
    const hits = result.events.filter((event) => event.type === "damageApplied"
      && event.source === "player");
    expect(hits).toHaveLength(2);
    const traces = result.trace.filter((entry) => entry.type === "damage" && entry.side === "player");
    expect(traces).toHaveLength(2);
    expect(traces[1]!.baseDamage).toBeGreaterThan(traces[0]!.baseDamage);
    expect(result.state.teams.player.members[0]?.moves[0]?.pp).toBe(9);
  });

  it("includes a healthy active partner in doubles and survives snapshot restoration", () => {
    const state = createDoubleTeamBattleState({ player: [pokemon("attacker", "player", "0C1"),
      pokemon("ally", "player", "000", { baseAttack: 120 })],
    opponent: [pokemon("target", "opponent"), pokemon("other", "opponent")] });
    const actions = [
      { actor: { side: "player" as const, slot: 0 }, action: { kind: "move" as const,
        moveIndex: 0, target: { side: "opponent" as const, slot: 0 } } },
      { actor: { side: "player" as const, slot: 1 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 0 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 1 }, action: { kind: "wait" as const } },
    ];
    const result = resolveDoubleTeamTurn(JSON.parse(JSON.stringify(state)) as typeof state, actions, rng);
    const attack = result.events.find((event) => event.type === "positionedActionResolved"
      && event.actor.side === "player" && event.actor.slot === 0);
    expect(attack?.type === "positionedActionResolved" ? attack.events.filter((event) =>
      event.type === "damageApplied") : []).toHaveLength(2);
  });
});
