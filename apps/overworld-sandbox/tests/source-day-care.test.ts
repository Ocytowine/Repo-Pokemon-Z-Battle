import { describe, expect, it } from "vitest";
import { createEmptyPlayerParty, createPersistentPokemon, type PlayerCreationCatalog }
  from "@pokemon-z-battle/player-state";
import { advanceSourceDayCare, createEmptySourceDayCare, depositSourceDayCarePokemon,
  exchangeSourceDayCarePokemon, parseSourceDayCare, sourceDayCareWithdrawalFee,
  withdrawSourceDayCarePokemon } from "../src/source-day-care.js";

const catalog: PlayerCreationCatalog = {
  pokemon: [{ id: 1, internalName: "TESTMON", name: "Testmon", types: ["NORMAL"],
    baseStats: { hp: 50, attack: 50, defense: 50, speed: 50, specialAttack: 50, specialDefense: 50 },
    abilities: ["TEST"], levelUpMoves: [{ level: 1, move: "TACKLE" }, { level: 6, move: "GROWL" }],
    growthRate: "Medium", baseExperience: 50, genderRate: "Female50Percent", happiness: 70,
    eggGroups: ["Field"] }],
  moves: [{ id: 1, internalName: "TACKLE", name: "Charge", functionCode: "000", power: 40,
    type: "NORMAL", category: "Physical", accuracy: 100, pp: 35, priority: 0, effectChance: 0 },
  { id: 2, internalName: "GROWL", name: "Rugissement", functionCode: "000", power: 0,
    type: "NORMAL", category: "Status", accuracy: 100, pp: 40, priority: 0, effectChance: 0 }],
};

function pokemon(id: string, level = 5) { return createPersistentPokemon(id, "TESTMON", level, catalog); }

describe("source day care", () => {
  it("migrates an absent save to two empty persistent slots", () => {
    expect(parseSourceDayCare(createEmptySourceDayCare()).slots).toEqual([null, null]);
  });

  it("deposits only while one able party member remains and heals the occupant", () => {
    const first = { ...pokemon("first"), hp: 1 };
    const party = { ...createEmptyPlayerParty(), activeIndex: 0, members: [first, pokemon("second")] };
    const result = depositSourceDayCarePokemon(createEmptySourceDayCare(), party, "first", 0, 3_000);
    expect(result).toMatchObject({ ok: true, party: { members: [{ id: "second" }] },
      dayCare: { slots: [{ pokemon: { id: "first", hp: first.stats.maxHp }, depositedLevel: 5 }, null] } });
    expect(depositSourceDayCarePokemon(createEmptySourceDayCare(),
      { ...createEmptyPlayerParty(), activeIndex: 0, members: [pokemon("alone")] }, "alone", 0, 3_000))
      .toEqual({ ok: false, reason: "last-able-pokemon" });
  });

  it("gains one experience point per step and charges the source withdrawal formula", () => {
    const party = { ...createEmptyPlayerParty(), activeIndex: 0, members: [pokemon("stored"), pokemon("kept")] };
    const deposit = depositSourceDayCarePokemon(createEmptySourceDayCare(), party, "stored", 0, 3_000);
    if (!deposit.ok) throw new Error("deposit failed");
    const advanced = advanceSourceDayCare(deposit.dayCare, 91, catalog);
    expect(advanced.slots[0]?.pokemon).toMatchObject({ level: 6, experience: 216 });
    expect(advanced.slots[0] && sourceDayCareWithdrawalFee(advanced.slots[0])).toBe(200);
    const withdrawn = withdrawSourceDayCarePokemon(advanced, deposit.party, 0, 3_000);
    expect(withdrawn).toMatchObject({ ok: true, money: 2_800,
      party: { members: [{ id: "kept" }, { id: "stored", level: 6 }] } });
  });

  it("exchanges atomically and leaves the selected team position stable", () => {
    const party = { ...createEmptyPlayerParty(), activeIndex: 1, members: [pokemon("stored"), pokemon("swap")] };
    const deposit = depositSourceDayCarePokemon(createEmptySourceDayCare(), party, "stored", 0, 3_000);
    if (!deposit.ok) throw new Error("deposit failed");
    const result = exchangeSourceDayCarePokemon(deposit.dayCare, deposit.party, 0, "swap", 3_000);
    expect(result).toMatchObject({ ok: true, money: 2_900, party: { members: [{ id: "stored" }] },
      dayCare: { slots: [{ pokemon: { id: "swap" } }, null] } });
  });
});
