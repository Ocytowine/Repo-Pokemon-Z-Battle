import { describe, expect, it } from "vitest";
import { SeededRandom } from "@pokemon-z-battle/battle-engine";
import { addPokemonToParty, createEmptyPlayerParty, createPersistentPokemon, type PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import { createSourceEncounterBattle, resolveSourceEncounterTurn, settleSourceEncounter, storeSourceEncounterParty } from "../src/source-encounter.js";

const tackle = { id: 1, internalName: "TACKLE", name: "Charge", functionCode: "000", power: 40, type: "NORMAL",
  category: "Physical" as const, accuracy: 100, pp: 35, priority: 0, effectChance: 0 };
const catalog: PlayerCreationCatalog = {
  pokemon: [
    { internalName: "CHESPIN", name: "Marisson", types: ["GRASS"],
      baseStats: { hp: 61, attack: 61, defense: 65, speed: 38, specialAttack: 48, specialDefense: 45 },
      abilities: ["OVERGROW"], levelUpMoves: [{ level: 1, move: "TACKLE" }] },
    { internalName: "BIDOOF", name: "Keunotor", types: ["NORMAL"],
      baseStats: { hp: 59, attack: 45, defense: 40, speed: 31, specialAttack: 35, specialDefense: 40 },
      abilities: ["SIMPLE"], levelUpMoves: [{ level: 1, move: "TACKLE" }] },
  ],
  moves: [tackle],
};

describe("source encounter bridge", () => {
  it("builds the scripted wild battle and writes its resources back to the persistent party", () => {
    const party = addPokemonToParty(createEmptyPlayerParty(), createPersistentPokemon("starter", "CHESPIN", 5, catalog));
    let battle = createSourceEncounterBattle(party, { species: "BIDOOF", level: 2 }, catalog, "wild");
    expect(battle.teams.player.members[0]).toMatchObject({ name: "Marisson", ability: "OVERGROW" });
    expect(battle.teams.opponent.members[0]).toMatchObject({ name: "Keunotor", level: 2, ability: "SIMPLE" });
    const result = resolveSourceEncounterTurn(battle, 0, new SeededRandom(12));
    battle = result.state;
    const stored = storeSourceEncounterParty(party, battle);
    expect(stored.members[0]?.moves[0]?.pp).toBe(34);
    expect(stored.members[0]?.hp).toBe(battle.teams.player.members[0]?.hp);
  });

  it("rejects an exhausted player move before consuming a turn", () => {
    const base = addPokemonToParty(createEmptyPlayerParty(), createPersistentPokemon("starter", "CHESPIN", 5, catalog));
    const party = { ...base, members: [{ ...base.members[0]!, moves: [{ ...base.members[0]!.moves[0]!, pp: 0 }] }] };
    const battle = createSourceEncounterBattle(party, { species: "BIDOOF", level: 2 }, catalog, "wild");
    expect(() => resolveSourceEncounterTurn(battle, 0, new SeededRandom(12))).toThrow("pas disponible");
  });

  it("clears a victory but heals a defeated party before a retry", () => {
    const party = addPokemonToParty(createEmptyPlayerParty(), createPersistentPokemon("starter", "CHESPIN", 5, catalog));
    const battle = createSourceEncounterBattle(party, { species: "BIDOOF", level: 2 }, catalog, "wild");
    const defeatedMembers = battle.teams.player.members.map((member) => ({ ...member, hp: 0 }));
    const defeat = settleSourceEncounter(party, { ...battle, status: "finished", winner: "opponent",
      teams: { ...battle.teams, player: { ...battle.teams.player, members: defeatedMembers } } });
    expect(defeat).toMatchObject({ completed: false, party: { members: [{ hp: 22 }] } });
    const victory = settleSourceEncounter(party, { ...battle, status: "finished", winner: "player" });
    expect(victory.completed).toBe(true);
  });
});
