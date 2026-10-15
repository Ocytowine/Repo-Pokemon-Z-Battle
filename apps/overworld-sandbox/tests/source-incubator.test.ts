import { describe, expect, it } from "vitest";
import { createEmptyPlayerParty, createEmptyPlayerPokemonStorage, createPersistentPokemon,
  type PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import { collectDayCareEggInIncubator, createEmptySourceIncubator, depositPartyEggInIncubator,
  parseSourceIncubator, sourceEggHatchMessage, withdrawIncubatorEgg } from "../src/source-incubator.js";
import { createEmptySourceDayCare } from "../src/source-day-care.js";

const catalog: PlayerCreationCatalog = {
  pokemon: [{ id: 1, internalName: "TESTMON", name: "Testmon", types: ["NORMAL"],
    baseStats: { hp: 50, attack: 50, defense: 50, speed: 50, specialAttack: 50, specialDefense: 50 },
    abilities: ["TEST"], levelUpMoves: [{ level: 1, move: "TACKLE" }], growthRate: "Medium",
    baseExperience: 50, genderRate: "Female50Percent", happiness: 70, eggGroups: ["Field"],
    eggMoves: [], stepsToHatch: 2_805 }],
  moves: [{ id: 1, internalName: "TACKLE", name: "Charge", functionCode: "000", power: 40,
    type: "NORMAL", category: "Physical", accuracy: 100, pp: 35, priority: 0, effectChance: 0 }],
};

function pokemon(id: string, eggSteps = 0) {
  const pokemon = createPersistentPokemon(id, "TESTMON", 1, catalog);
  return { ...pokemon, metadata: { ...pokemon.metadata, eggSteps } };
}

describe("source incubator", () => {
  it("parses exactly six unique eggs and migrates an absent state through the event state", () => {
    expect(parseSourceIncubator(createEmptySourceIncubator())).toEqual(createEmptySourceIncubator());
    expect(() => parseSourceIncubator({ schemaVersion: 1, slots: [null] })).toThrow("invalide");
    expect(() => parseSourceIncubator({ schemaVersion: 1,
      slots: [pokemon("same", 5), pokemon("same", 5), null, null, null, null] })).toThrow("dupliqué");
  });

  it("moves only eggs between the party, incubator and Ranch without duplication", () => {
    const party = { ...createEmptyPlayerParty(), activeIndex: 0,
      members: [pokemon("lead"), pokemon("egg", 2_000)] };
    const ranch = createEmptyPlayerPokemonStorage();
    const deposited = depositPartyEggInIncubator(createEmptySourceIncubator(), party, ranch, "egg", 3);
    expect(deposited).toMatchObject({ ok: true, party: { members: [{ id: "lead" }] },
      incubator: { slots: [null, null, null, { id: "egg" }, null, null] } });
    if (!deposited.ok) throw new Error("deposit failed");
    const withdrawn = withdrawIncubatorEgg(deposited.incubator, deposited.party, deposited.ranch, 3, "ranch");
    expect(withdrawn).toMatchObject({ ok: true, incubator: { slots: [null, null, null, null, null, null] },
      ranch: { members: [{ id: "egg" }] } });
    expect(depositPartyEggInIncubator(createEmptySourceIncubator(), party, ranch, "lead", 0))
      .toEqual({ ok: false, reason: "not-an-egg" });
  });

  it("transfers the frozen Pension egg to the first free slot atomically", () => {
    const egg = pokemon("day-care-egg", 2_805);
    const dayCare = { ...createEmptySourceDayCare(), eggReady: true, pendingEgg: egg };
    const result = collectDayCareEggInIncubator(dayCare, createEmptySourceIncubator());
    expect(result).toMatchObject({ ok: true, dayCare: { eggReady: false, pendingEgg: null, eggCycleSteps: 0 },
      incubator: { slots: [{ id: "day-care-egg" }, null, null, null, null, null] } });
  });

  it("uses the four exact source hatch proximity thresholds", () => {
    expect(sourceEggHatchMessage(10_200)).toContain("temps");
    expect(sourceEggHatchMessage(10_199)).toContain("temps en temps");
    expect(sourceEggHatchMessage(2_549)).toContain("plus en plus");
    expect(sourceEggHatchMessage(1_274)).toContain("éclore");
  });
});
