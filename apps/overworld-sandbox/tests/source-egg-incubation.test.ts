import { describe, expect, it } from "vitest";
import { createEmptyPlayerParty, createEmptyPlayerPokemonStorage, createPersistentPokemon,
  type PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import { advanceSourceEggIncubation, completeSourceEggHatch } from "../src/source-egg-incubation.js";
import { createEmptySourceIncubator } from "../src/source-incubator.js";

const catalog: PlayerCreationCatalog = {
  pokemon: [{ id: 1, internalName: "TESTMON", name: "Testmon", types: ["NORMAL"],
    baseStats: { hp: 50, attack: 50, defense: 50, speed: 50, specialAttack: 50, specialDefense: 50 },
    abilities: ["TEST"], levelUpMoves: [{ level: 1, move: "TACKLE" }], growthRate: "Medium",
    baseExperience: 50, genderRate: "Female50Percent", happiness: 70, eggGroups: ["Field"],
    eggMoves: [], stepsToHatch: 2_805 }],
  moves: [{ id: 1, internalName: "TACKLE", name: "Charge", functionCode: "000", power: 40,
    type: "NORMAL", category: "Physical", accuracy: 100, pp: 35, priority: 0, effectChance: 0 }],
};

function pokemon(id: string, eggSteps: number, ability: string | null = null) {
  const created = createPersistentPokemon(id, "TESTMON", 1, catalog);
  return { ...created, ability, metadata: { ...created.metadata, eggSteps } };
}

describe("source egg incubation", () => {
  it("advances party and incubator eggs but never reveals them before the queued scene", () => {
    const party = { ...createEmptyPlayerParty(), activeIndex: 0,
      members: [pokemon("lead", 0), pokemon("party-egg", 1)] };
    const incubator = { ...createEmptySourceIncubator(),
      slots: [pokemon("incubator-egg", 2), null, null, null, null, null] as const };
    const result = advanceSourceEggIncubation(party, incubator, []);
    expect(result.party.members[1]?.metadata.eggSteps).toBe(1);
    expect(result.incubator.slots[0]?.metadata.eggSteps).toBe(1);
    expect(result.pendingHatches).toEqual(["party-egg"]);
    const next = advanceSourceEggIncubation(result.party, result.incubator, result.pendingHatches);
    expect(next.pendingHatches).toEqual(["party-egg", "incubator-egg"]);
  });

  it("applies the single source Flame Body/Magma Armor bonus to every personal egg", () => {
    const party = { ...createEmptyPlayerParty(), activeIndex: 0,
      members: [pokemon("lead", 0, "FLAMEBODY"), pokemon("egg", 5)] };
    expect(advanceSourceEggIncubation(party, createEmptySourceIncubator(), []).party.members[1]
      ?.metadata.eggSteps).toBe(3);
  });

  it("finalizes metadata and moves an incubator hatch atomically", () => {
    const egg = pokemon("egg", 1);
    const incubator = { ...createEmptySourceIncubator(), slots: [egg, null, null, null, null, null] as const };
    const result = completeSourceEggHatch(createEmptyPlayerParty(), createEmptyPlayerPokemonStorage(),
      incubator, ["egg"], "egg", "party", 56, "2026-10-15T10:00:00.000Z", "Nova");
    expect(result).toMatchObject({ ok: true, pendingHatches: [], incubator: { slots: [null, null, null, null, null, null] },
      party: { members: [{ id: "egg", nickname: "Nova", metadata: { eggSteps: 0, happiness: 120,
        origin: { hatchedMapId: 56, hatchedAt: "2026-10-15T10:00:00.000Z" } } }] } });
  });
});
