import { describe, expect, it } from "vitest";
import { createPersistentPokemon, playerPartyToBattleTeam, type PlayerCreationCatalog }
  from "@pokemon-z-battle/player-state";
import { createTeamBattleState, type SharedBattleParticipation } from "@pokemon-z-battle/battle-engine";
import type { SourceBattleSettlement } from "@pokemon-z-battle/multiplayer-protocol";
import { createSourceEventState } from "../src/source-event-state.js";
import { applySourceBattleSettlement } from "../src/source-shared-battle-settlement.js";

const catalog: PlayerCreationCatalog = {
  moves: [{ id: 1, internalName: "TACKLE", name: "Charge", functionCode: "000", power: 40,
    type: "NORMAL", category: "Physical", accuracy: 100, pp: 35, priority: 0, effectChance: 0 }],
  pokemon: [{ internalName: "PIKACHU", name: "Pikachu", types: ["ELECTRIC"],
    baseStats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
    abilities: ["STATIC"], growthRate: "Medium", baseExperience: 112, genderRate: "Female50Percent",
    happiness: 70, levelUpMoves: [{ level: 1, move: "TACKLE" }] }],
};

describe("shared source battle settlement", () => {
  it("merges owned resources and rewards exactly once without rebuilding the persistent Pokemon", () => {
    const pokemon = createPersistentPokemon("host-mon", "PIKACHU", 5, catalog);
    const team = playerPartyToBattleTeam({ schemaVersion: 1, activeIndex: 0, members: [pokemon] }, catalog);
    const defeated = { ...team.members[0]!, id: "wild-mon" };
    const finalState = { ...createTeamBattleState({ player: team.members, opponent: [defeated] }),
      status: "finished" as const, winner: "player" as const,
      teams: { player: { activeIndex: 0, members: [{ ...team.members[0]!, hp: 5,
        moves: [{ ...team.members[0]!.moves[0]!, pp: 2 }] }] },
      opponent: { activeIndex: 0, members: [{ ...defeated, hp: 0 }] } } };
    const participation: SharedBattleParticipation = { battleOwnerId: "host", format: "single", camps: {
      player: { trainerIds: ["host"], members: [{ ownerId: "host", battler: team.members[0]! }],
        activeMemberId: pokemon.id },
      opponent: { trainerIds: [], members: [{ ownerId: null, battler: defeated }], activeMemberId: defeated.id },
    } };
    const settlement: SourceBattleSettlement = { settlementId: "battle-1-host", battleId: "battle-1",
      ownerId: "host", narrativeOwnerId: "host", outcome: "won", participation, state: finalState,
      tactical: { ownerId: "host", side: "player", won: true, resourceMemberIds: [pokemon.id],
        defeatCredits: [{ turn: 1, defeatedBattler: defeated, participantCount: 1,
          recipientMemberIds: [pokemon.id] }] },
      experience: { trainerBattle: false, levelCap: 17, experienceDisabled: false,
        boostTenPercent: false, boostTwentyPercent: false },
      money: { kind: "fixed", amount: 500 }, items: [{ itemId: "POTION", quantity: 2 }],
      consumedItems: [{ itemId: "POTION", quantity: 1 }], healParty: false };
    const initial = { ...createSourceEventState(), party: { schemaVersion: 1 as const, activeIndex: 0,
      members: [pokemon] }, inventory: { POTION: 1 } };
    const applied = applySourceBattleSettlement(initial, settlement, "host", catalog);
    expect(applied).toMatchObject({ applied: true, moneyDelta: 500,
      state: { money: 3500, inventory: { POTION: 2 }, appliedBattleSettlementIds: ["battle-1-host"],
        party: { members: [{ id: "host-mon", hp: 7, moves: [{ pp: 2 }] }] } } });
    expect(applied.gains[0]).toMatchObject({ recipientMemberId: "host-mon", gained: 113 });
    expect(applied.state.party.members[0]?.metadata).toEqual(pokemon.metadata);
    expect(applySourceBattleSettlement(applied.state, settlement, "host", catalog))
      .toEqual({ state: applied.state, applied: false, gains: [], moneyDelta: 0 });
  });
});
