import { describe, expect, it } from "vitest";
import { createPersistentPokemonMetadata, type PersistentPokemon } from "@pokemon-z-battle/player-state";
import { sourcePartySpellsUnownEterno, SOURCE_UNOWN_ETERNO_FORMS }
  from "../src/source-unown-puzzle.js";

function unown(index: number, form: number): PersistentPokemon {
  return { id: `unown-${index}`, species: "UNOWN", nickname: null, level: 5, experience: 0,
    stats: { maxHp: 20, attack: 10, defense: 10, specialAttack: 10, specialDefense: 10, speed: 10 }, hp: 20,
    majorStatus: null, ability: null, heldItem: null, moves: [],
    metadata: { ...createPersistentPokemonMetadata(`unown-${index}`, "UNOWN", 5), form } };
}

describe("Pokemon Z ETERNO Unown puzzle", () => {
  it("requires exactly six ordered Unown with the source forms", () => {
    const members = SOURCE_UNOWN_ETERNO_FORMS.map((form, index) => unown(index, form));
    expect(sourcePartySpellsUnownEterno({ schemaVersion: 1, activeIndex: 0, members })).toBe(true);
    expect(sourcePartySpellsUnownEterno({ schemaVersion: 1, activeIndex: 0,
      members: [members[1]!, members[0]!, ...members.slice(2)] })).toBe(false);
    expect(sourcePartySpellsUnownEterno({ schemaVersion: 1, activeIndex: 0, members: members.slice(0, 5) }))
      .toBe(false);
    expect(sourcePartySpellsUnownEterno({ schemaVersion: 1, activeIndex: 0,
      members: [{ ...members[0]!, species: "PIKACHU" }, ...members.slice(1)] })).toBe(false);
  });
});
