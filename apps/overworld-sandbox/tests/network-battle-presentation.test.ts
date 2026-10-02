import { describe, expect, it } from "vitest";
import { networkBattleEventsForViewer, networkBattleForViewer } from "../src/network-battle-presentation.js";
import { MINIMAL_MOVE_CATALOG, createTeamBattleState, type BattlerState } from "@pokemon-z-battle/battle-engine";

function battler(id: string): BattlerState {
  return { id, species: id, name: id, level: 5, types: ["NORMAL"], hp: 20,
    stats: { maxHp: 20, attack: 10, defense: 10, specialAttack: 10, specialDefense: 10, speed: 10 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 10 }] };
}

describe("network battle presentation", () => {
  it("presents the guest as the local player and mirrors event sides", () => {
    const state = createTeamBattleState({ player: [battler("host")], opponent: [battler("guest")] });
    expect(networkBattleForViewer(state, "opponent").teams.player.members[0]?.id).toBe("guest");
    expect(networkBattleEventsForViewer([
      { type: "moveUsed", side: "opponent", move: "TACKLE" },
      { type: "damageApplied", source: "opponent", target: "player", amount: 3, hp: 17,
        critical: false, effectiveness: 1 },
    ], "opponent")).toEqual([
      { type: "moveUsed", side: "player", move: "TACKLE" },
      { type: "damageApplied", source: "player", target: "opponent", amount: 3, hp: 17,
        critical: false, effectiveness: 1 },
    ]);
  });
});
