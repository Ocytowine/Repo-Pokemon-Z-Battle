import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattlerState,
  type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: () => 0 };

function pokemon(id: string, move: BattleMove, speed: number): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"], hp: 200,
    stats: { maxHp: 200, attack: 80, defense: 80, specialAttack: 80, specialDefense: 80, speed },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move, pp: move.pp }] };
}

function retaliation(code: "071" | "072" | "073"): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.TACKLE, id: 1500 + Number.parseInt(code, 16),
    internalName: `RETALIATION${code}`, name: code, functionCode: code,
    category: "Physical", power: 1, priority: -5, accuracy: 0 };
}

describe("Pokemon Z retaliation functions", () => {
  it.each([
    ["071", MINIMAL_MOVE_CATALOG.TACKLE, 2],
    ["072", MINIMAL_MOVE_CATALOG.WATERGUN, 2],
    ["073", MINIMAL_MOVE_CATALOG.TACKLE, 1.5],
  ] as const)("%s answers the last actual hit", (code, attack, multiplier) => {
    const state = createTeamBattleState({ player: [pokemon("counter", retaliation(code), 50)],
      opponent: [pokemon("attacker", attack, 100)] });
    const result = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "move", moveIndex: 0 } }, rng);
    const incoming = result.events.find((event) => event.type === "damageApplied" && event.target === "player");
    const returned = result.events.find((event) => event.type === "damageApplied" && event.target === "opponent");
    expect(incoming?.type).toBe("damageApplied");
    expect(returned).toMatchObject({ type: "damageApplied",
      amount: Math.floor((incoming as { amount: number }).amount * multiplier) });
    expect(result.state.teams.player.members[0]!.volatile?.retaliation)
      .toMatchObject({ turn: 1, last: { attackerId: "attacker" } });
  });

  it("fails without a same-turn matching hit and does not reuse a previous turn", () => {
    const state = createTeamBattleState({ player: [pokemon("counter", retaliation("072"), 50)],
      opponent: [pokemon("attacker", MINIMAL_MOVE_CATALOG.TACKLE, 100)] });
    const wrongCategory = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(wrongCategory.events).toContainEqual(expect.objectContaining({ type: "moveFailed", side: "player" }));
    const next = resolveTeamTurn(wrongCategory.state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, rng);
    expect(next.events).toContainEqual(expect.objectContaining({ type: "moveFailed", side: "player" }));
  });

  it("uses only the last actual hit of a multi-hit attack", () => {
    const doubleHit = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "DOUBLEHIT",
      functionCode: "0BD" as const, power: 15, accuracy: 0 };
    const state = createTeamBattleState({ player: [pokemon("counter", retaliation("071"), 50)],
      opponent: [pokemon("attacker", doubleHit, 100)] });
    const result = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "move", moveIndex: 0 } }, rng);
    const hits = result.events.filter((event) => event.type === "damageApplied" && event.target === "player");
    const response = result.events.find((event) => event.type === "damageApplied" && event.target === "opponent");
    expect(hits).toHaveLength(2);
    expect(response).toMatchObject({ type: "damageApplied", amount: hits[1]!.amount * 2 });
  });

  it("auto-targets the actual attacker in doubles, not the manually selected opponent", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("counter", retaliation("071"), 50),
        pokemon("ally", MINIMAL_MOVE_CATALOG.TACKLE, 40)],
      opponent: [pokemon("decoy", MINIMAL_MOVE_CATALOG.TACKLE, 100),
        pokemon("attacker", MINIMAL_MOVE_CATALOG.TACKLE, 90)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 0 } } },
    ], rng);
    expect(result.state.teams.opponent.members[0]!.hp).toBe(200);
    expect(result.state.teams.opponent.members[1]!.hp).toBeLessThan(200);
    expect(result.state.teams.player.members[0]!.volatile?.retaliation?.physical?.attackerId)
      .toBe("attacker");
  });
});
