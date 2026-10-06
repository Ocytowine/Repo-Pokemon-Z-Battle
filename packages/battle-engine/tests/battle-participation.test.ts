import { describe, expect, it } from "vitest";
import { activeBattleController, applyBattleJoin, approveBattleJoin, assertSharedBattleParticipation,
  canCaptureSharedBattleTarget, createTeamBattleState, replacementBattleController,
  createSharedBattleLedger, proposeBattleJoin, recordSharedBattleTurn,
  restoreSharedBattleLedger, sharedBattleOwnerSettlement,
  type BattlerState, type SharedBattleParticipation } from "../src/index.js";

function pokemon(id: string): BattlerState {
  return { id, species: id.toUpperCase(), name: id, level: 5, types: ["NORMAL"],
    stats: { maxHp: 20, attack: 10, defense: 10, specialAttack: 10, specialDefense: 10, speed: 10 },
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
  it("keeps capture on an unowned wild target and routes forced replacement by ownership", () => {
    const source = battle();
    const tactical = createTeamBattleState({ player: [pokemon("starter")], opponent: [pokemon("wild")] });
    expect(canCaptureSharedBattleTarget(source, tactical, "source-wild")).toBe(true);
    expect(canCaptureSharedBattleTarget(source, tactical, "source-trainer")).toBe(false);

    const guestWild = { ...source, camps: { ...source.camps, opponent: {
      trainerIds: ["guest"], members: [{ ownerId: "guest", battler: pokemon("wild") }], activeMemberId: "wild",
    } } };
    expect(canCaptureSharedBattleTarget(guestWild, tactical, "source-wild")).toBe(false);

    const reserve = pokemon("guest-reserve");
    const beforeReplacement = createTeamBattleState({ player: [pokemon("starter")],
      opponent: [pokemon("wild"), reserve] });
    const replacementState = { ...beforeReplacement, replacementRequired: ["opponent"] as const,
      teams: { ...beforeReplacement.teams, opponent: { ...beforeReplacement.teams.opponent,
        members: [{ ...pokemon("wild"), hp: 0 }, reserve] } } };
    const joined = { ...guestWild, camps: { ...guestWild.camps, opponent: { trainerIds: ["guest"],
      members: [{ ownerId: null, battler: pokemon("wild") }, { ownerId: "guest", battler: reserve }],
      activeMemberId: "wild" } } };
    expect(replacementBattleController(joined, replacementState, "opponent")).toBe("guest");
  });

  it("merges an allied proposal only after both trainers approve it", () => {
    let proposal = proposeBattleJoin(battle(), { joinerId: "guest", side: "player", members: [pokemon("guest-mon")],
      finalMemberIds: ["starter", "guest-mon"] });
    expect(() => applyBattleJoin(battle(), proposal)).toThrow(/acceptée/u);
    proposal = approveBattleJoin(proposal, "host");
    const joined = applyBattleJoin(battle(), proposal);
    expect(joined.camps.player.trainerIds).toEqual(["host", "guest"]);
    expect(joined.format).toBe("double");
    expect(joined.camps.player.activeMemberIds).toEqual(["starter", "guest-mon"]);
    expect(activeBattleController(joined, "player")).toBe("host");
  });

  it("lets the guest compose the opposing camp with at most three owned Pokémon", () => {
    const contribution = [pokemon("g1"), pokemon("g2"), pokemon("g3")];
    let proposal = proposeBattleJoin(battle(), { joinerId: "guest", side: "opponent", members: contribution,
      finalMemberIds: ["g1", "g2", "g3"] });
    proposal = approveBattleJoin(proposal, "host");
    const joined = applyBattleJoin(battle(), proposal);
    expect(joined.camps.opponent.members).toHaveLength(3);
    expect(activeBattleController(joined, "opponent")).toBe("guest");
  });

  it("accepts a second trainer in doubles and rejects full camps or rosters larger than six", () => {
    expect(proposeBattleJoin(battle("double"), { joinerId: "guest", side: "player", members: [pokemon("g")],
      finalMemberIds: ["starter", "g"] }).side).toBe("player");
    expect(() => proposeBattleJoin(battle(), { joinerId: "guest", side: "player",
      members: Array.from({ length: 6 }, (_, index) => pokemon(`g${index}`)),
      finalMemberIds: ["starter", ...Array.from({ length: 6 }, (_, index) => `g${index}`)] })).toThrow(/six/u);
    expect(() => proposeBattleJoin(battle(), { joinerId: "guest", side: "opponent",
      members: Array.from({ length: 4 }, (_, index) => pokemon(`g${index}`)),
      finalMemberIds: Array.from({ length: 4 }, (_, index) => `g${index}`) })).toThrow(/trois/u);
    expect(() => proposeBattleJoin(battle(), { joinerId: "guest", side: "player", members: [pokemon("g")],
      finalMemberIds: ["g"] })).toThrow(/retirer/u);
    const fainted = { ...pokemon("ko"), hp: 0 };
    expect(() => proposeBattleJoin(battle(), { joinerId: "guest", side: "opponent", members: [fainted],
      finalMemberIds: ["ko"] })).toThrow(/apte au combat/u);
  });

  it("selects a conscious active when a composition retained a fainted active", () => {
    const source = battle();
    const fainted = { ...source.camps.player.members[0]!.battler, hp: 0 };
    const withFaintedActive = { ...source, camps: { ...source.camps, player: { ...source.camps.player,
      members: [{ ownerId: "host", battler: fainted }] } } };
    let proposal = proposeBattleJoin(withFaintedActive, { joinerId: "guest", side: "player",
      members: [pokemon("guest-mon")], finalMemberIds: ["starter", "guest-mon"] });
    proposal = approveBattleJoin(proposal, "host");
    expect(applyBattleJoin(withFaintedActive, proposal).camps.player.activeMemberId).toBe("guest-mon");
  });

  it("rejects duplicate identities, cross-camp trainers and unknown owners", () => {
    const duplicatePokemon = battle();
    expect(() => assertSharedBattleParticipation({ ...duplicatePokemon, camps: { ...duplicatePokemon.camps,
      opponent: { ...duplicatePokemon.camps.opponent,
        members: [{ ownerId: null, battler: pokemon("starter") }], activeMemberId: "starter" } } }))
      .toThrow(/uniques entre les camps/u);
    expect(() => assertSharedBattleParticipation({ ...battle(), camps: {
      player: battle().camps.player,
      opponent: { trainerIds: ["host"], members: [{ ownerId: "host", battler: pokemon("wild") }],
        activeMemberId: "wild" },
    } })).toThrow(/deux camps/u);
    expect(() => assertSharedBattleParticipation({ ...battle(), camps: { ...battle().camps,
      player: { ...battle().camps.player, members: [{ ownerId: "stranger", battler: pokemon("starter") }] } } }))
      .toThrow(/propriétaire/u);
  });

  it("rejects a joining Pokemon whose identity already belongs to the opposing camp", () => {
    expect(() => proposeBattleJoin(battle(), { joinerId: "guest", side: "player",
      members: [pokemon("wild")], finalMemberIds: ["starter", "wild"] })).toThrow(/camp adverse/u);
  });

  it("refuses an approved proposal altered after its creation", () => {
    let proposal = proposeBattleJoin(battle(), { joinerId: "guest", side: "player", members: [pokemon("guest-mon")],
      finalMemberIds: ["starter", "guest-mon"] });
    proposal = approveBattleJoin(proposal, "host");
    const altered = { ...proposal, members: proposal.members.map((member) => member.battler.id === "starter"
      ? { ...member, battler: { ...member.battler, hp: 1 } } : member) };
    expect(() => applyBattleJoin(battle(), altered)).toThrow(/autoritaire/u);
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
    expect(ledger.defeatCredits).toEqual([{ turn: 1, defeatedSide: "opponent", defeatedBattler: foe,
      recipientSide: "player", eligibleMemberIds: ["first"] }]);
  });

  it("credits each defeated opponent only to Pokemon engaged against it", () => {
    const first = pokemon("first");
    const reserve = pokemon("reserve");
    const foe1 = pokemon("foe-1");
    const foe2 = pokemon("foe-2");
    const initial = { turn: 1, status: "active" as const, winner: null,
      teams: { player: { activeIndex: 0, members: [first, reserve] },
        opponent: { activeIndex: 0, members: [foe1, foe2] } }, replacementRequired: [] as const };
    const firstKo = { ...initial, turn: 2, teams: { ...initial.teams,
      opponent: { ...initial.teams.opponent, members: [{ ...foe1, hp: 0 }, foe2] } },
      replacementRequired: ["opponent"] as const };
    let ledger = recordSharedBattleTurn(createSharedBattleLedger(initial), initial, firstKo,
      [{ type: "fainted", side: "opponent" }, { type: "replacementRequired", side: "opponent" }]);
    const replaced = { ...firstKo, replacementRequired: [] as const,
      teams: { ...firstKo.teams, opponent: { ...firstKo.teams.opponent, activeIndex: 1 } } };
    ledger = recordSharedBattleTurn(ledger, firstKo, replaced,
      [{ type: "pokemonSwitched", side: "opponent", fromIndex: 0, toIndex: 1,
        from: "foe-1", to: "foe-2", reason: "replacement" }]);
    const secondKo = { ...replaced, turn: 3, status: "finished" as const, winner: "player" as const,
      teams: { player: { ...replaced.teams.player, activeIndex: 1 }, opponent: { ...replaced.teams.opponent,
        members: [{ ...foe1, hp: 0 }, { ...foe2, hp: 0 }] } } };
    ledger = recordSharedBattleTurn(ledger, replaced, secondKo,
      [{ type: "pokemonSwitched", side: "player", fromIndex: 0, toIndex: 1,
        from: "first", to: "reserve", reason: "voluntary" }, { type: "fainted", side: "opponent" }]);
    expect(ledger.defeatCredits.map((credit) => ({ defeated: credit.defeatedBattler.id,
      eligible: credit.eligibleMemberIds }))).toEqual([
      { defeated: "foe-1", eligible: ["first"] },
      { defeated: "foe-2", eligible: ["first", "reserve"] },
    ]);
    const participation: SharedBattleParticipation = { battleOwnerId: "host", format: "single", camps: {
      player: { trainerIds: ["host", "guest"], activeMemberId: "reserve", members: [
        { ownerId: "host", battler: first }, { ownerId: "guest", battler: reserve },
      ] },
      opponent: { trainerIds: [], activeMemberId: "foe-2", members: [
        { ownerId: null, battler: foe1 }, { ownerId: null, battler: foe2 },
      ] },
    } };
    expect(sharedBattleOwnerSettlement(participation, secondKo, ledger, "host").defeatCredits
      .map((credit) => credit.defeatedBattler.id)).toEqual(["foe-1", "foe-2"]);
    expect(sharedBattleOwnerSettlement(participation, secondKo, ledger, "guest").defeatCredits)
      .toMatchObject([{ defeatedBattler: { id: "foe-2" }, recipientMemberIds: ["reserve"] }]);
  });

  it("upgrades a legacy ledger restored from an earlier protocol-v9 room", () => {
    const state = { turn: 2, status: "active" as const, winner: null,
      teams: { player: { activeIndex: 0, members: [pokemon("first")] },
        opponent: { activeIndex: 0, members: [pokemon("foe")] } }, replacementRequired: [] };
    const restored = restoreSharedBattleLedger({ engagedMemberIds: { player: ["first"], opponent: ["foe"] },
      defeatedMembers: [] }, state);
    expect(restored.engagements.player).toEqual([{ opponentMemberId: "foe", memberIds: ["first"] }]);
    expect(restored.defeatCredits).toEqual([]);
  });
});
