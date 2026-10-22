import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide, type BattlerState,
  type RandomSource } from "../src/index.js";

class ScriptedRandom implements RandomSource {
  private index = 0;
  public constructor(private readonly values: readonly number[]) {}
  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index++];
    if (value === undefined || value < 0 || value >= maxExclusive) throw new Error(`Missing RNG for ${maxExclusive}.`);
    return value;
  }
}

const highRolls: RandomSource = { nextInt: (maximum) => Math.max(0, maximum - 1) };

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const move = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return { id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 240, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 80 : 100 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 240, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move, pp: move.pp }], ...overrides };
}

function statusMove(overrides: Partial<BattleMove> = {}): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.GROWL, accuracy: 80, ...overrides };
}

function firstMoveSide(result: ReturnType<typeof resolveTeamTurn>): BattleSide {
  const event = result.events.find((candidate) => candidate.type === "teamActionOrdered");
  if (event?.type !== "teamActionOrdered") throw new Error("Missing order event.");
  return event.order.find((action) => action.kind === "move")!.side;
}

describe("Pokemon Z accuracy and action-order abilities", () => {
  it("gives Victory Star's 1.1 accuracy multiplier to its user", () => {
    const move = statusMove();
    const run = (ability: BattlerState["ability"]) => resolveTeamTurn(createTeamBattleState({
      player: [pokemon("user", "player", { ability, moves: [{ move, pp: move.pp }] })],
      opponent: [pokemon("target", "opponent")],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([85]));
    expect(run(null).trace).toContainEqual(expect.objectContaining({ type: "accuracy", threshold: 80, hit: false }));
    expect(run("VICTORYSTAR").trace).toContainEqual(expect.objectContaining({ type: "accuracy", threshold: 88, hit: true }));
  });

  it("shares Victory Star from the active partner in a positioned double battle", () => {
    const move = statusMove({ targetCode: "00" });
    const state = createDoubleTeamBattleState({
      player: [pokemon("user", "player", { moves: [{ move, pp: move.pp }] }),
        pokemon("star", "player", { ability: "VICTORYSTAR" })],
      opponent: [pokemon("target", "opponent"), pokemon("other", "opponent")],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], new ScriptedRandom([999_999, 85]));
    expect(result.trace).toContainEqual(expect.objectContaining({ type: "accuracy", threshold: 88, hit: true }));
  });

  it("caps hostile status accuracy with Wonder Skin and lets Mold Breaker bypass it", () => {
    const move = statusMove({ accuracy: 100 });
    const run = (ability: BattlerState["ability"]) => resolveTeamTurn(createTeamBattleState({
      player: [pokemon("user", "player", { ability, moves: [{ move, pp: move.pp }] })],
      opponent: [pokemon("skin", "opponent", { ability: "WONDERSKIN" })],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([60]));
    expect(run(null).trace).toContainEqual(expect.objectContaining({ type: "accuracy", threshold: 50, hit: false }));
    expect(run("MOLDBREAKER").trace).toContainEqual(expect.objectContaining({ type: "accuracy", threshold: 100, hit: true }));
  });

  it("gives Triage +3 only to source healing moves outside its six exclusions", () => {
    const heal = statusMove({ internalName: "RECOVER", name: "Soin", functionCode: "0D5",
      accuracy: 0, priority: 0 });
    const priorityAttack = { ...MINIMAL_MOVE_CATALOG.SCRATCH, priority: 2 };
    const opponent = pokemon("fast", "opponent", { moves: [{ move: priorityAttack, pp: priorityAttack.pp }] });
    const triage = pokemon("healer", "player", { ability: "TRIAGE", hp: 100,
      moves: [{ move: heal, pp: heal.pp }] });
    expect(firstMoveSide(resolveTeamTurn(createTeamBattleState({ player: [triage], opponent: [opponent] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, highRolls))).toBe("player");

    const excluded = { ...heal, internalName: "AQUARING" };
    expect(firstMoveSide(resolveTeamTurn(createTeamBattleState({
      player: [{ ...triage, moves: [{ move: excluded, pp: excluded.pp }] }], opponent: [opponent],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, highRolls)))
      .toBe("opponent");
  });

  it("blocks positive-priority hostile moves with Queenly Majesty but not neutral moves", () => {
    const quick = { ...MINIMAL_MOVE_CATALOG.TACKLE, priority: 1 };
    const run = (ability: BattlerState["ability"], move = quick) => resolveTeamTurn(createTeamBattleState({
      player: [pokemon("user", "player", { ability, moves: [{ move, pp: move.pp }] })],
      opponent: [pokemon("queen", "opponent", { ability: "QUEENLYMAJESTY" })],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, highRolls);
    const blocked = run(null);
    expect(blocked.state.teams.opponent.members[0]!.hp).toBe(240);
    expect(blocked.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "QUEENLYMAJESTY", effect: "block-move" });
    expect(run("MOLDBREAKER").state.teams.opponent.members[0]!.hp).toBeLessThan(240);
    expect(run(null, MINIMAL_MOVE_CATALOG.TACKLE).state.teams.opponent.members[0]!.hp).toBeLessThan(240);
  });

  it("keeps Queenly Majesty target-scoped rather than protecting its partner", () => {
    const quick = { ...MINIMAL_MOVE_CATALOG.TACKLE, priority: 1, targetCode: "00" };
    const state = createDoubleTeamBattleState({
      player: [pokemon("user", "player", { moves: [{ move: quick, pp: quick.pp }] }), pokemon("ally", "player")],
      opponent: [pokemon("queen", "opponent", { ability: "QUEENLYMAJESTY" }), pokemon("plain", "opponent")],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 1 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], highRolls);
    expect(result.state.teams.opponent.members[1]!.hp).toBeLessThan(240);
    expect(result.events).not.toContainEqual(expect.objectContaining({ type: "abilityActivated",
      ability: "QUEENLYMAJESTY" }));
  });

  it("makes Stall act last inside its priority bracket, including in doubles", () => {
    const stalled = pokemon("stall", "player", { ability: "STALL",
      stats: { ...pokemon("stall", "player").stats, speed: 200 } });
    expect(firstMoveSide(resolveTeamTurn(createTeamBattleState({
      player: [stalled], opponent: [pokemon("slow", "opponent")],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, highRolls)))
      .toBe("opponent");
    const priority = { ...MINIMAL_MOVE_CATALOG.TACKLE, priority: 1 };
    expect(firstMoveSide(resolveTeamTurn(createTeamBattleState({
      player: [{ ...stalled, moves: [{ move: priority, pp: priority.pp }] }], opponent: [pokemon("slow", "opponent")],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, highRolls)))
      .toBe("player");

    const state = createDoubleTeamBattleState({
      player: [stalled, pokemon("ally", "player")],
      opponent: [pokemon("slow", "opponent"), pokemon("other", "opponent")],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 0 } } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], highRolls);
    const order = result.events.find((event) => event.type === "teamActionOrdered");
    expect(order?.type === "teamActionOrdered" ? order.order.filter((action) => action.kind === "move")[0]?.side : null)
      .toBe("opponent");
  });
});
