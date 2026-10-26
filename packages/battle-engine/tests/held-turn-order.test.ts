import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleSide, type BattlerState,
  type RandomSource } from "../src/index.js";
import { heldTurnOrderBracket, quickClawCanActivate } from "../src/held-turn-order.js";

function pokemon(side: BattleSide, speed: number, heldItem: string | null = null,
  ability: BattlerState["ability"] = null): BattlerState {
  const move = MINIMAL_MOVE_CATALOG.TACKLE;
  return { id: `${side}-${speed}`, species: "EEVEE", name: side, level: 50, types: ["NORMAL"],
    stats: { maxHp: 240, attack: 90, defense: 100, specialAttack: 90, specialDefense: 100, speed },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 240, majorStatus: null, ability, heldItem,
    moves: [{ move, pp: move.pp }] };
}

function rng(quickClawRoll: number): RandomSource {
  return { nextInt: (maximum) => maximum === 10 ? quickClawRoll : Math.max(0, maximum - 1) };
}

function firstMove(result: ReturnType<typeof resolveTeamTurn>): BattleSide {
  const ordered = result.events.find((event) => event.type === "teamActionOrdered");
  if (ordered?.type !== "teamActionOrdered") throw new Error("Missing action order.");
  return ordered.order.find((action) => action.kind === "move")!.side;
}

describe("source held turn-order items", () => {
  it("activates Quick Claw on rolls 0–1, without consuming it", () => {
    const state = createTeamBattleState({ player: [pokemon("player", 40, "QUICKCLAW")],
      opponent: [pokemon("opponent", 120)] });
    const actions = { player: { kind: "move" as const, moveIndex: 0 },
      opponent: { kind: "move" as const, moveIndex: 0 } };
    const activated = resolveTeamTurn(state, actions, rng(1));
    expect(firstMove(activated)).toBe("player");
    expect(activated.trace).toContainEqual(expect.objectContaining({ type: "rng", purpose: "quick-claw",
      maxExclusive: 10, value: 1 }));
    expect(activated.events).toContainEqual(expect.objectContaining({ type: "itemActivated", item: "QUICKCLAW" }));
    expect(activated.state.teams.player.members[0]!.heldItem).toBe("QUICKCLAW");
    expect(firstMove(resolveTeamTurn(state, actions, rng(2)))).toBe("opponent");
    const priorityState = createTeamBattleState({ player: [pokemon("player", 40, "QUICKCLAW")],
      opponent: [{ ...pokemon("opponent", 120),
        moves: [{ move: MINIMAL_MOVE_CATALOG.QUICKATTACK, pp: MINIMAL_MOVE_CATALOG.QUICKATTACK.pp }] }] });
    expect(firstMove(resolveTeamTurn(priorityState, actions, rng(0)))).toBe("opponent");
    expect(quickClawCanActivate(pokemon("player", 40, "QUICKCLAW"), 2)).toBe(false);
    expect(quickClawCanActivate(pokemon("player", 40, "QUICKCLAW", "KLUTZ"))).toBe(false);
  });

  it("puts Lagging Tail and Full Incense last within the same priority bracket", () => {
    const actions = { player: { kind: "move" as const, moveIndex: 0 },
      opponent: { kind: "move" as const, moveIndex: 0 } };
    for (const item of ["LAGGINGTAIL", "FULLINCENSE"]) {
      const state = createTeamBattleState({ player: [pokemon("player", 40)],
        opponent: [pokemon("opponent", 120, item)] });
      expect(firstMove(resolveTeamTurn(state, actions, rng(9)))).toBe("player");
      expect(state.teams.opponent.members[0]!.heldItem).toBe(item);
      const disabled = createTeamBattleState({ player: [pokemon("player", 40)],
        opponent: [pokemon("opponent", 120, item, "KLUTZ")] });
      expect(firstMove(resolveTeamTurn(disabled, actions, rng(9)))).toBe("opponent");
    }
    expect(heldTurnOrderBracket(pokemon("opponent", 120, "LAGGINGTAIL"), 2, false, null).lagging)
      .toBe(false);
  });

  it("uses the same brackets for positioned double actions", () => {
    const actions = [
      { actor: { side: "player" as const, slot: 0 }, action: { kind: "move" as const, moveIndex: 0,
        target: { side: "opponent" as const, slot: 0 } } },
      { actor: { side: "player" as const, slot: 1 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 0 }, action: { kind: "move" as const, moveIndex: 0,
        target: { side: "player" as const, slot: 0 } } },
      { actor: { side: "opponent" as const, slot: 1 }, action: { kind: "wait" as const } },
    ];
    const run = (playerItem: string | null, opponentItem: string | null) => resolveDoubleTeamTurn(
      createDoubleTeamBattleState({ player: [pokemon("player", 40, playerItem), pokemon("player", 30)],
        opponent: [pokemon("opponent", 120, opponentItem), pokemon("opponent", 20)] }), actions, rng(0));
    const firstSide = (result: ReturnType<typeof run>) => {
      const ordered = result.events.find((event) => event.type === "teamActionOrdered");
      return ordered?.type === "teamActionOrdered"
        ? ordered.order.find((entry) => entry.kind === "move")?.side : null;
    };
    expect(firstSide(run("QUICKCLAW", null))).toBe("player");
    expect(firstSide(run(null, "FULLINCENSE"))).toBe("player");
  });
});
