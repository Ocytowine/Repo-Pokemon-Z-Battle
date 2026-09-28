import { describe, expect, it } from "vitest";
import { SeededRandom } from "@pokemon-z-battle/battle-engine";
import { addPokemonToParty, createEmptyPlayerParty, createPersistentPokemon, type PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import { attemptSourceEncounterEscape, createSourceEncounterBattle, resolveSourceEncounterTurn, scaledWildExperience, settleSourceEncounter, storeSourceEncounterParty } from "../src/source-encounter.js";
import { selectSourceBattleAnimation, selectSourceBattleAudio, transformBattleAnimationPoint } from "../src/source-battle-visuals.js";

const tackle = { id: 1, internalName: "TACKLE", name: "Charge", functionCode: "000", power: 40, type: "NORMAL",
  category: "Physical" as const, accuracy: 100, pp: 35, priority: 0, effectChance: 0 };
const catalog: PlayerCreationCatalog = {
  pokemon: [
    { internalName: "CHESPIN", name: "Marisson", types: ["GRASS"],
      baseStats: { hp: 61, attack: 61, defense: 65, speed: 38, specialAttack: 48, specialDefense: 45 },
      abilities: ["OVERGROW"], growthRate: "Parabolic", baseExperience: 64, levelUpMoves: [{ level: 1, move: "TACKLE" }] },
    { internalName: "BIDOOF", name: "Keunotor", types: ["NORMAL"],
      baseStats: { hp: 59, attack: 45, defense: 40, speed: 31, specialAttack: 35, specialDefense: 40 },
      abilities: ["SIMPLE"], growthRate: "Medium", baseExperience: 50, levelUpMoves: [{ level: 1, move: "TACKLE" }] },
  ],
  moves: [tackle],
};

describe("source encounter bridge", () => {
  it("selects source battle music, victory music and battler cries", () => {
    const asset = (path: string) => ({ path, category: "audio", mediaType: "audio" as const, image: null });
    const cry = (pokemonId: number, path: string) => ({ pokemonId, kind: "cry" as const, form: null, shiny: false,
      female: false, back: false, variant: null, path, width: null, height: null, frameCount: null });
    const assets = { schemaVersion: "1", records: [asset("Audio/BGM/Salvaje.ogg"), asset("Audio/ME/VictoriaSalvaje.ogg")] };
    const pokemon = { schemaVersion: "1", records: [
      { id: 650, internalName: "CHESPIN", name: "Marisson", assets: { battler: [], icon: [], footprint: [], overworld: [], cry: [cry(650, "Audio/SE/Cries/650Cry.ogg")] } },
      { id: 399, internalName: "BIDOOF", name: "Keunotor", assets: { battler: [], icon: [], footprint: [], overworld: [], cry: [cry(399, "Audio/SE/Cries/399Cry.ogg")] } },
    ] };
    expect(selectSourceBattleAudio(assets, pokemon, "CHESPIN", "BIDOOF")).toEqual({
      battleMusic: "Audio/BGM/Salvaje.ogg", victoryMusic: "Audio/ME/VictoriaSalvaje.ogg",
      playerCry: "Audio/SE/Cries/650Cry.ogg", opponentCry: "Audio/SE/Cries/399Cry.ogg",
    });
  });

  it("selects explicit opponent animations and mirrors player-only animations", () => {
    const animation = (index: number) => ({ index, name: `A${index}`, graphicPath: "Graphics/Animations/test.png", hue: 0,
      position: 1, frames: [], timings: [] });
    const manifest = { schemaVersion: "1", coordinateSystem: { width: 512 as const, height: 384 as const,
      cellSize: 192 as const, sheetColumns: 5 as const, framesPerSecond: 20 as const }, mappings: [
        { moveId: 1, internalName: "TACKLE", player: 10, opponent: null },
        { moveId: 2, internalName: "GROWL", player: 20, opponent: 21 },
      ], animations: [animation(10), animation(20), animation(21)] };
    expect(selectSourceBattleAnimation(manifest, "opponent", "TACKLE")).toMatchObject({ animation: { index: 10 }, reverse: true });
    expect(selectSourceBattleAnimation(manifest, "opponent", "GROWL")).toMatchObject({ animation: { index: 21 }, reverse: false });
    expect(transformBattleAnimationPoint(128, 224, true)).toEqual({ x: 384, y: 96 });
  });

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

  it("uses the source speed formula for escape and gives the opponent its turn after a failure", () => {
    const party = addPokemonToParty(createEmptyPlayerParty(), createPersistentPokemon("starter", "CHESPIN", 5, catalog));
    const battle = createSourceEncounterBattle(party, { species: "BIDOOF", level: 2 }, catalog, "wild");
    expect(attemptSourceEncounterEscape(battle, 0, new SeededRandom(1)).escaped).toBe(true);
    const slowPlayer = { ...battle, teams: { ...battle.teams, player: { ...battle.teams.player,
      members: battle.teams.player.members.map((member) => ({ ...member, stats: { ...member.stats, speed: 1 } })) } } };
    const failed = attemptSourceEncounterEscape(slowPlayer, 0, { nextInt: (maximum) => maximum - 1 });
    expect(failed.escaped).toBe(false);
    if (!failed.escaped) expect(failed.turn.events).toContainEqual(expect.objectContaining({ type: "damageApplied", target: "player" }));
  });

  it("clears a victory but heals a defeated party before a retry", () => {
    const party = addPokemonToParty(createEmptyPlayerParty(), createPersistentPokemon("starter", "CHESPIN", 5, catalog));
    const battle = createSourceEncounterBattle(party, { species: "BIDOOF", level: 2 }, catalog, "wild");
    const defeatedMembers = battle.teams.player.members.map((member) => ({ ...member, hp: 0 }));
    const defeat = settleSourceEncounter(party, { ...battle, status: "finished", winner: "opponent",
      teams: { ...battle.teams, player: { ...battle.teams.player, members: defeatedMembers } } });
    expect(defeat).toMatchObject({ completed: false, experience: null, party: { members: [{ hp: 22 }] } });
    const victory = settleSourceEncounter(party, { ...battle, status: "finished", winner: "player" }, catalog);
    expect(scaledWildExperience(2, 50, 5)).toBe(13);
    expect(victory).toMatchObject({ completed: true, experience: { amount: 13, levelsGained: 0 },
      party: { members: [{ experience: 148 }] } });
  });
});
