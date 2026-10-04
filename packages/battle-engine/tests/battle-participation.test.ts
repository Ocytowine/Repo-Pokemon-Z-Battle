import { describe, expect, it } from "vitest";
import { activeBattleController, applyBattleJoin, approveBattleJoin, createSharedBattleLedger, proposeBattleJoin,
  recordSharedBattleTurn,
  type BattlerState, type SharedBattleParticipation } from "../src/index.js";

function pokemon(id: string): BattlerState {
  return { id, species: id.toUpperCase(), name: id, level: 5, types: ["NORMAL"],
    stats: { hp: 20, attack: 10, defense: 10, specialAttack: 10, specialDefense: 10, speed: 10 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    hp: 20, majorStatus: null, ability: null, heldItem: null, moves: [] };
}

function battle(format: "single" | "double" = "single"): SharedBattleParticipation {
  return { battleOwnerId: "host", format, camps: {
    player: { trainerIds: ["host"], members: [{ ownerId: "host", battler: pokemon("starter") }], activeMemberId: "starter" },
    opponent: { trainerIds: [], members: [{ ownerId: null, battler: pokemon("wild") }], activeMemberId: "wild" },
  } };
}

describe("shared battle participation", () => {
  it("merges an allied proposal only after both trainers approve it", () => {
    let proposal = proposeBattleJoin(battle(), { joinerId: "guest", side: "player", members: [pokemon("guest-mon")],
      finalMemberIds: ["starter", "guest-mon"] });
    expect(() => applyBattleJoin(battle(), proposal)).toThrow(/acceptée/u);
    proposal = approveBattleJoin(proposal, "host");
    const joined = applyBattleJoin(battle(), proposal);
    expect(joined.camps.player.trainerIds).toEqual(["host", "guest"]);
    expect(activeBattleController(joined, "player")).toBe("host");
  });

  it("lets the guest compose the opposing camp up to six Pokémon with host consent", () => {
    const contribution = [pokemon("g1"), pokemon("g2"), pokemon("g3")];
    let proposal = proposeBattleJoin(battle(), { joinerId: "guest", side: "opponent", members: contribution,
      finalMemberIds: ["g1", "g2", "g3"] });
    proposal = approveBattleJoin(proposal, "host");
    const joined = applyBattleJoin(battle(), proposal);
    expect(joined.camps.opponent.members).toHaveLength(3);
    expect(activeBattleController(joined, "opponent")).toBe("guest");
  });

  it("rejects double battles, full camps and rosters larger than six", () => {
    expect(() => proposeBattleJoin(battle("double"), { joinerId: "guest", side: "player", members: [pokemon("g")],
      finalMemberIds: ["starter", "g"] })).toThrow(/double/u);
    expect(() => proposeBattleJoin(battle(), { joinerId: "guest", side: "player",
      members: Array.from({ length: 6 }, (_, index) => pokemon(`g${index}`)),
      finalMemberIds: ["starter", ...Array.from({ length: 6 }, (_, index) => `g${index}`)] })).toThrow(/six/u);
  });

  it("records engaged and defeated Pokémon across active changes", () => {
    const first = pokemon("first");
    const reserve = pokemon("reserve");
    const foe = pokemon("foe");
    const before = { turn: 1, status: "active" as const, winner: null,
      teams: { player: { activeIndex: 0, members: [first, reserve] }, opponent: { activeIndex: 0, members: [foe] } },
      replacementRequired: [] };
    const after = { ...before, turn: 2, teams: { ...before.teams, player: { ...before.teams.player, activeIndex: 1 } } };
    const ledger = recordSharedBattleTurn(createSharedBattleLedger(before), before, after,
      [{ type: "fainted", side: "opponent" }]);
    expect(ledger.engagedMemberIds.player).toEqual(["first", "reserve"]);
    expect(ledger.defeatedMembers).toEqual([{ side: "opponent", battler: foe }]);
  });
});
