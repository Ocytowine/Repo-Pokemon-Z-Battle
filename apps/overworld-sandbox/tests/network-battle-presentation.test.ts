import { describe, expect, it } from "vitest";
import { networkBattleActionForServer, networkBattleEventsForViewer, networkBattleForViewer,
  networkBattleTrainerIds } from "../src/network-battle-presentation.js";
import { MINIMAL_MOVE_CATALOG, createTeamBattleState, type BattlerState,
  type SharedBattleParticipation } from "@pokemon-z-battle/battle-engine";

function battler(id: string): BattlerState {
  return { id, species: id, name: id, level: 5, types: ["NORMAL"], hp: 20,
    stats: { maxHp: 20, attack: 10, defense: 10, specialAttack: 10, specialDefense: 10, speed: 10 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 10 }] };
}

describe("network battle presentation", () => {
  it("maps a target selected from the opposing camp view back to authoritative sides", () => {
    expect(networkBattleActionForServer({ kind: "move", moveIndex: 0,
      target: { side: "opponent", slot: 1 } }, "opponent"))
      .toEqual({ kind: "move", moveIndex: 0, target: { side: "player", slot: 1 } });
    expect(networkBattleActionForServer({ kind: "move", moveIndex: 0,
      target: { side: "opponent", slot: 1 } }, "player"))
      .toEqual({ kind: "move", moveIndex: 0, target: { side: "opponent", slot: 1 } });
  });

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

  it("selects the trainer who owns the active battler instead of the room host side", () => {
    const participation: SharedBattleParticipation = {
      battleOwnerId: "guest-id", format: "double",
      camps: {
        player: {
          trainerIds: ["guest-id", "host-id"],
          members: [
            { ownerId: "guest-id", battler: battler("guest-lead") },
            { ownerId: "host-id", battler: battler("host-help") },
          ],
          activeMemberId: "guest-lead", activeMemberIds: ["guest-lead", "host-help"],
        },
        opponent: {
          trainerIds: [], members: [{ ownerId: null, battler: battler("wild") }],
          activeMemberId: "wild",
        },
      },
    };

    expect(networkBattleTrainerIds(participation, "player"))
      .toEqual({ player: "guest-id", opponent: null });
    expect(networkBattleTrainerIds(participation, "opponent"))
      .toEqual({ player: null, opponent: "guest-id" });
  });
});
