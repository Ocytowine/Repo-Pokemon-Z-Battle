import { describe, expect, it } from "vitest";
import { createTeamBattleState, MINIMAL_MOVE_CATALOG, type BattlerState } from "@pokemon-z-battle/battle-engine";
import { sourceBattleReplacementSubmitted } from "../src/source-battle-overlay.js";

function battler(id: string): BattlerState {
  return { id, species: id, name: id, level: 5, types: ["NORMAL"], hp: 20,
    stats: { maxHp: 20, attack: 10, defense: 10, specialAttack: 10, specialDefense: 10, speed: 10 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 10 }] };
}

describe("source battle overlay", () => {
  it("hides a replacement picker as soon as that slot was submitted for the current turn", () => {
    const state = createTeamBattleState({ player: [battler("active"), battler("reserve")],
      opponent: [battler("opponent")] });
    expect(sourceBattleReplacementSubmitted(state, state.turn, [0], 0)).toBe(true);
    expect(sourceBattleReplacementSubmitted(state, state.turn - 1, [0], 0)).toBe(false);
    expect(sourceBattleReplacementSubmitted(state, state.turn, [1], 0)).toBe(false);
    expect(sourceBattleReplacementSubmitted(state, null, [], 0,
      { turn: state.turn, activeSlot: 0 })).toBe(true);
  });
});
