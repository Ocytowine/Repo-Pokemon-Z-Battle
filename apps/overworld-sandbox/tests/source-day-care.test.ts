import { describe, expect, it } from "vitest";
import { createEmptyPlayerParty, createPersistentPokemon, type PlayerCreationCatalog }
  from "@pokemon-z-battle/player-state";
import { advanceSourceDayCare, createEmptySourceDayCare, depositSourceDayCarePokemon,
  collectSourceDayCareEgg, discardSourceDayCareEgg, exchangeSourceDayCarePokemon, generateSourceDayCareEgg, parseSourceDayCare,
  sourceDayCareCompatibility, sourceDayCareWithdrawalFee,
  withdrawSourceDayCarePokemon } from "../src/source-day-care.js";

const catalog: PlayerCreationCatalog = {
  pokemon: [{ id: 1, internalName: "TESTMON", name: "Testmon", types: ["NORMAL"],
    baseStats: { hp: 50, attack: 50, defense: 50, speed: 50, specialAttack: 50, specialDefense: 50 },
    abilities: ["TEST"], levelUpMoves: [{ level: 1, move: "TACKLE" }, { level: 6, move: "GROWL" }],
    growthRate: "Medium", baseExperience: 50, genderRate: "Female50Percent", happiness: 70,
    eggGroups: ["Field"], eggMoves: ["GROWL"], stepsToHatch: 2_805 }],
  moves: [{ id: 1, internalName: "TACKLE", name: "Charge", functionCode: "000", power: 40,
    type: "NORMAL", category: "Physical", accuracy: 100, pp: 35, priority: 0, effectChance: 0 },
  { id: 2, internalName: "GROWL", name: "Rugissement", functionCode: "000", power: 0,
    type: "NORMAL", category: "Status", accuracy: 100, pp: 40, priority: 0, effectChance: 0 }],
};

function pokemon(id: string, level = 5) { return createPersistentPokemon(id, "TESTMON", level, catalog); }

function breedingPokemon(id: string, gender: "male" | "female", trainerId: number, heldItem: string | null = null) {
  const created = pokemon(id);
  return { ...created, heldItem, metadata: { ...created.metadata, gender,
    owner: { trainerId, publicId: trainerId & 0xffff, name: `DO${trainerId}`, pronouns: "neutral" as const } } };
}

describe("source day care", () => {
  it("migrates an absent save to two empty persistent slots", () => {
    expect(parseSourceDayCare(createEmptySourceDayCare()).slots).toEqual([null, null]);
    expect(parseSourceDayCare({ schemaVersion: 1, slots: [null, null], eggCycleSteps: 12, eggReady: false }))
      .toMatchObject({ schemaVersion: 2, eggCycleSteps: 12, eggReady: false, pendingEgg: null });
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

  it("uses the source compatibility score, including trainer identity", () => {
    const sameTrainer = { ...createEmptySourceDayCare(), slots: [
      { pokemon: breedingPokemon("female", "female", 7), depositedLevel: 5 },
      { pokemon: breedingPokemon("male", "male", 7), depositedLevel: 5 },
    ] } as const;
    expect(sourceDayCareCompatibility(sameTrainer, catalog)).toEqual({ score: 2, chancePercent: 50, compatible: true });
    const differentTrainer = { ...sameTrainer, slots: [sameTrainer.slots[0],
      { pokemon: breedingPokemon("male-other", "male", 8), depositedLevel: 5 }] } as const;
    expect(sourceDayCareCompatibility(differentTrainer, catalog)).toEqual({ score: 3, chancePercent: 70, compatible: true });
    expect(sourceDayCareCompatibility(differentTrainer, catalog, true).chancePercent).toBe(88);
  });

  it("freezes a deterministic inherited egg when the 256-step roll succeeds", () => {
    const female = breedingPokemon("female", "female", 7, "EVERSTONE");
    const male = breedingPokemon("male", "male", 8, "DESTINYKNOT");
    const dayCare = { ...createEmptySourceDayCare(), eggCycleSteps: 255, rngState: 1,
      slots: [{ pokemon: { ...female, metadata: { ...female.metadata,
        ivs: { hp: 1, attack: 1, defense: 1, speed: 1, specialAttack: 1, specialDefense: 1 },
        origin: { ...female.metadata.origin, ball: "LUXURYBALL" } },
        moves: [...female.moves, { internalName: "GROWL", pp: 40, maxPp: 40 }] }, depositedLevel: 5 },
      { pokemon: { ...male, metadata: { ...male.metadata,
        ivs: { hp: 2, attack: 2, defense: 2, speed: 2, specialAttack: 2, specialDefense: 2 } } }, depositedLevel: 5 }] } as const;
    const context = { owner: { trainerId: 99, name: "Ari", pronouns: "neutral" as const },
      origin: { method: "egg" as const, mapId: 48, receivedAt: "2026-10-15T08:00:00.000Z", ball: "POKEBALL" } };
    const first = advanceSourceDayCare(dayCare, 1, catalog, { creationContext: context });
    const replay = advanceSourceDayCare(dayCare, 1, catalog, { creationContext: context });
    expect(first).toEqual(replay);
    expect(parseSourceDayCare(JSON.parse(JSON.stringify(first)) as unknown)).toEqual(first);
    expect(first).toMatchObject({ eggCycleSteps: 0, eggReady: true,
      pendingEgg: { species: "TESTMON", level: 1, metadata: { eggSteps: 2_805, nature: female.metadata.nature,
        origin: { method: "egg", ball: "LUXURYBALL" } } } });
    expect(first.pendingEgg?.moves.map((move) => move.internalName)).toContain("GROWL");
    expect(Object.values(first.pendingEgg!.metadata.ivs).filter((value) => value === 1 || value === 2).length).toBeGreaterThanOrEqual(5);
  });

  it("refuses direct egg generation for an incomplete or incompatible couple", () => {
    expect(() => generateSourceDayCareEgg(createEmptySourceDayCare(), catalog)).toThrow("incompatible");
  });

  it("hands off or discards a pending egg atomically", () => {
    const egg = { ...pokemon("egg"), metadata: { ...pokemon("egg").metadata, eggSteps: 100 } };
    const dayCare = { ...createEmptySourceDayCare(), eggReady: true, pendingEgg: egg };
    const party = { ...createEmptyPlayerParty(), activeIndex: 0, members: [pokemon("lead")] };
    expect(collectSourceDayCareEgg(dayCare, party, 3_000)).toMatchObject({ ok: true,
      party: { members: [{ id: "lead" }, { id: "egg" }] },
      dayCare: { eggReady: false, pendingEgg: null, eggCycleSteps: 0 } });
    expect(discardSourceDayCareEgg(dayCare)).toMatchObject({ eggReady: false, pendingEgg: null, eggCycleSteps: 0 });
    expect(discardSourceDayCareEgg(createEmptySourceDayCare())).toBeNull();
  });

  it("keeps the pending egg when the team is full and protects it from Pension changes", () => {
    const egg = { ...pokemon("egg"), metadata: { ...pokemon("egg").metadata, eggSteps: 100 } };
    const stored = breedingPokemon("stored", "female", 1);
    const dayCare = { ...createEmptySourceDayCare(), eggReady: true, pendingEgg: egg,
      slots: [{ pokemon: stored, depositedLevel: 5 }, null] } as const;
    const fullParty = { ...createEmptyPlayerParty(), activeIndex: 0,
      members: Array.from({ length: 6 }, (_, index) => pokemon(`party-${index}`)) };
    expect(collectSourceDayCareEgg(dayCare, fullParty, 3_000)).toEqual({ ok: false, reason: "party-full" });
    expect(withdrawSourceDayCarePokemon(dayCare, fullParty, 0, 3_000)).toEqual({ ok: false, reason: "egg-pending" });
    expect(dayCare.pendingEgg).toBe(egg);
  });
});
