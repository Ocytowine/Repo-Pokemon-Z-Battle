import { MINIMAL_MOVE_CATALOG, attemptPokemonCapture, createTeamBattleState, resolveTeamTurn,
  type BattlerState, type RandomSource } from "../src/index.js";
import { describe, expect, it } from "vitest";

class ZeroRandom implements RandomSource { public nextInt(): number { return 0; } }

function battler(id: string, capture = false): BattlerState {
  return { id, species: id.toUpperCase(), name: id, level: 10, types: ["NORMAL"],
    stats: { maxHp: 30, attack: 20, defense: 20, specialAttack: 20, specialDefense: 20, speed: 25 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    hp: 10, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: MINIMAL_MOVE_CATALOG.TACKLE, pp: MINIMAL_MOVE_CATALOG.TACKLE.pp }],
    ...(capture ? { capture: { rate: 45, baseSpeed: 25, weight: 100 } } : {}) };
}

describe("Pokemon Z capture", () => {
  it("uses the four-shake formula and the unconditional Master Ball", () => {
    const target = battler("wild", true);
    expect(attemptPokemonCapture("POKEBALL", target, { turn: 1, actorLevels: [10] }, new ZeroRandom()))
      .toEqual({ shakes: 4, critical: false, success: true });
    expect(attemptPokemonCapture("MASTERBALL", target, { turn: 1, actorLevels: [10] }, new ZeroRandom()))
      .toEqual({ shakes: 4, critical: false, success: true });
  });

  it("ends the turn without an opposing attack after a successful capture", () => {
    const state = createTeamBattleState({ player: [battler("hero")], opponent: [battler("wild", true)] });
    const result = resolveTeamTurn(state, { player: { kind: "capture", ballId: "MASTERBALL" },
      opponent: { kind: "move", moveIndex: 0 } }, new ZeroRandom());
    expect(result.state).toMatchObject({ status: "finished", winner: "player", turn: 2 });
    expect(result.state.teams.player.members[0]?.hp).toBe(10);
    expect(result.events).toContainEqual({ type: "captureAttempted", side: "player", ballId: "MASTERBALL",
      target: "wild", shakes: 4, critical: false, success: true });
  });
});
