import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createTeamBattleState, resolveTeamTurn,
  type BattleMove, type BattlerState, type RandomSource } from "../src/index.js";

const zero: RandomSource = { nextInt: () => 0 };

function battler(id: string, moves: readonly BattleMove[], overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 200, attack: 80, defense: 80, specialAttack: 80,
      specialDefense: 80, speed: id === "player" ? 110 : 90 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 200, majorStatus: null,
    ability: null, heldItem: null, moves: moves.map((move) => ({ move, pp: move.pp })), ...overrides };
}

function status(code: BattleMove["functionCode"], targetCode = "00"): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.GROWL, id: Number.parseInt(code, 16) + 1000,
    internalName: `MOVE${code}`, name: `MOVE${code}`, functionCode: code,
    category: "Status", power: 0, accuracy: 0, effectChance: 0, targetCode };
}

function usedTargetMove(code: BattleMove["functionCode"], targetMove = MINIMAL_MOVE_CATALOG.TACKLE,
  playerMoves: readonly BattleMove[] = [status(code)]) {
  const state = createTeamBattleState({ player: [battler("player", playerMoves), battler("reserve", [MINIMAL_MOVE_CATALOG.TACKLE])],
    opponent: [battler("opponent", [targetMove])] });
  const first = resolveTeamTurn(state, { player: { kind: "wait" },
    opponent: { kind: "move", moveIndex: 0 } }, zero);
  return resolveTeamTurn(first.state, { player: { kind: "move", moveIndex: 0 },
    opponent: { kind: "wait" } }, zero);
}

describe("Pokemon Z copied moves and Conversion functions", () => {
  it("Mimic copies the target's last move temporarily and restores its own PP on withdrawal", () => {
    const copied = usedTargetMove("05C");
    expect(copied.state.teams.player.members[0]!.moves[0]).toMatchObject({
      move: { internalName: "TACKLE" }, pp: MINIMAL_MOVE_CATALOG.TACKLE.pp,
    });
    expect(copied.state.teams.player.members[0]!.volatile?.mimicOriginalSlots?.[0])
      .toMatchObject({ index: 0, slot: { move: { functionCode: "05C" } } });
    const switched = resolveTeamTurn(copied.state, {
      player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" },
    }, zero);
    expect(switched.state.teams.player.members[0]!.moves[0]!.move.functionCode).toBe("05C");
    expect(switched.state.teams.player.members[0]!.volatile).toBeUndefined();
    const failed = usedTargetMove("05C", MINIMAL_MOVE_CATALOG.TACKLE,
      [status("05C"), MINIMAL_MOVE_CATALOG.TACKLE]);
    expect(failed.events).toContainEqual(expect.objectContaining({ type: "moveFailed" }));
  });

  it("Sketch records a permanent replacement in the authoritative tactical state", () => {
    const sketched = usedTargetMove("05D");
    expect(sketched.state.teams.player.members[0]!.moves[0]!.move.internalName).toBe("TACKLE");
    expect(sketched.state.teams.player.members[0]!.sketchedMoveSlots)
      .toMatchObject([{ index: 0, move: { internalName: "TACKLE" } }]);
    const switched = resolveTeamTurn(sketched.state, {
      player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" },
    }, zero);
    expect(switched.state.teams.player.members[0]!.moves[0]!.move.internalName).toBe("TACKLE");
    expect(switched.state.teams.player.members[0]!.sketchedMoveSlots).toHaveLength(1);
  });

  it("Conversion chooses the first eligible other move type and restores it on switch", () => {
    const conversion = status("05E", "10");
    const fire = { ...MINIMAL_MOVE_CATALOG.TACKLE, id: 1002, internalName: "FIREMOVE", type: "FIRE" };
    const water = { ...MINIMAL_MOVE_CATALOG.TACKLE, id: 1003, internalName: "WATERMOVE", type: "WATER" };
    const state = createTeamBattleState({ player: [battler("player", [conversion, fire, water]),
      battler("reserve", [MINIMAL_MOVE_CATALOG.TACKLE])],
    opponent: [battler("opponent", [MINIMAL_MOVE_CATALOG.TACKLE])] });
    const result = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, zero);
    expect(result.state.teams.player.members[0]!.types).toEqual(["FIRE"]);
    expect(result.trace).toContainEqual(expect.objectContaining({ type: "rng", purpose: "conversion",
      maxExclusive: 1 }));
    const switched = resolveTeamTurn(result.state, { player: { kind: "switch", teamIndex: 1 },
      opponent: { kind: "wait" } }, zero);
    expect(switched.state.teams.player.members[0]!.types).toEqual(["NORMAL"]);
  });

  it("Conversion 2 uses the opponent's effective last move type and authoritative RNG", () => {
    const water = { ...MINIMAL_MOVE_CATALOG.TACKLE, type: "WATER", internalName: "WATERMOVE" };
    const result = usedTargetMove("05F", water);
    expect(result.state.teams.player.members[0]!.types).toEqual(["WATER"]);
    expect(result.trace).toContainEqual(expect.objectContaining({ type: "rng", purpose: "conversion2" }));
    const noHistory = createTeamBattleState({ player: [battler("player", [status("05F")])],
      opponent: [battler("opponent", [water])] });
    const failed = resolveTeamTurn(noHistory, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, zero);
    expect(failed.events).toContainEqual(expect.objectContaining({ type: "moveFailed" }));
  });
});
