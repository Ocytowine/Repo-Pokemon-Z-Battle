import { describe, expect, it } from "vitest";
import { SeededRandom, createDoubleTeamBattleState } from "@pokemon-z-battle/battle-engine";
import { addPokemonToParty, createEmptyPlayerParty, createPersistentPokemon, type PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import { attemptSourceEncounterEscape, createSourceEncounterBattle, createSourceTrainerBattle,
  resolveAutomaticReplacements, resolveSourceEncounterAction, resolveSourceEncounterTurn,
  scaledWildExperience, settleSourceEncounter, storeSourceEncounterParty } from "../src/source-encounter.js";
import { SOURCE_PLAYER_BALL_PATH, SOURCE_TRAINER_Y_OFFSET, joinedBattlePositions,
  selectSourceBattleAnimation, selectSourceBattleAudio,
  sourcePlayerBallKeyframes, transformBattleAnimationPoint } from "../src/source-battle-visuals.js";
import { sourceBattleScaledVisibleBottom, sourceBattleSpritePlacement, sourceBattleSpriteScale,
  sourceTrainerSpritePlacement } from "../src/source-battle-layout.js";

const tackle = { id: 1, internalName: "TACKLE", name: "Charge", functionCode: "000", power: 40, type: "NORMAL",
  category: "Physical" as const, accuracy: 100, pp: 35, priority: 0, effectChance: 0 };
const catalog: PlayerCreationCatalog = {
  pokemon: [
    { internalName: "CHESPIN", name: "Marisson", types: ["GRASS"],
      baseStats: { hp: 61, attack: 61, defense: 65, speed: 38, specialAttack: 48, specialDefense: 45 },
      abilities: ["OVERGROW"], growthRate: "Parabolic", baseExperience: 64, genderRate: "FemaleOneEighth", happiness: 70,
      levelUpMoves: [{ level: 1, move: "TACKLE" }] },
    { internalName: "BIDOOF", name: "Keunotor", types: ["NORMAL"],
      baseStats: { hp: 59, attack: 45, defense: 40, speed: 31, specialAttack: 35, specialDefense: 40 },
      abilities: ["SIMPLE"], growthRate: "Medium", baseExperience: 50, genderRate: "Female50Percent", happiness: 70,
      levelUpMoves: [{ level: 1, move: "TACKLE" }] },
    { internalName: "BUNNELBY", name: "Sapereau", types: ["NORMAL"],
      baseStats: { hp: 38, attack: 36, defense: 38, speed: 57, specialAttack: 32, specialDefense: 36 },
      abilities: ["CHEEKPOUCH"], growthRate: "Medium", baseExperience: 47, genderRate: "Female50Percent", happiness: 70,
      levelUpMoves: [{ level: 1, move: "TACKLE" }] },
  ],
  moves: [tackle],
};

describe("source encounter bridge", () => {
  it("selects source battle music, victory music and battler cries", () => {
    const asset = (path: string) => ({ path, category: "audio", mediaType: "audio" as const, image: null });
    const cry = (pokemonId: number, path: string) => ({ pokemonId, kind: "cry" as const, form: null, shiny: false,
      female: false, back: false, variant: null, path, width: null, height: null, frameCount: null });
    const assets = { schemaVersion: "1", records: [asset("Audio/BGM/Salvaje.ogg"), asset("Audio/ME/VictoriaSalvaje.ogg"),
      asset("Audio/SE/recall.mp3")] };
    const pokemon = { schemaVersion: "1", records: [
      { id: 650, internalName: "CHESPIN", name: "Marisson", assets: { battler: [], icon: [], footprint: [], overworld: [], cry: [cry(650, "Audio/SE/Cries/650Cry.ogg")] } },
      { id: 399, internalName: "BIDOOF", name: "Keunotor", assets: { battler: [], icon: [], footprint: [], overworld: [], cry: [cry(399, "Audio/SE/Cries/399Cry.ogg")] } },
    ] };
    expect(selectSourceBattleAudio(assets, pokemon, "CHESPIN", "BIDOOF")).toEqual({
      battleMusic: "Audio/BGM/Salvaje.ogg", victoryMusic: "Audio/ME/VictoriaSalvaje.ogg",
      playerCry: "Audio/SE/Cries/650Cry.ogg", opponentCry: "Audio/SE/Cries/399Cry.ogg",
      sendOut: "Audio/SE/recall.mp3",
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

  it("aligns battlers on the exact source-game ground lines", () => {
    expect(sourceBattleSpritePlacement("player", 96, 96, 93)).toEqual({
      left: 80, top: 227, width: 96, height: 96, originX: 48, originY: 93,
    });
    expect(sourceBattleSpritePlacement("opponent", 96, 96, 89)).toEqual({
      left: 336, top: 79, width: 96, height: 96, originX: 48, originY: 89,
    });
    expect(sourceBattleSpritePlacement("player", 96, 96, 93, "double", 0)).toMatchObject({ left: 32, top: 227 });
    expect(sourceBattleSpritePlacement("player", 96, 96, 93, "double", 1)).toMatchObject({ left: 112, top: 243 });
    expect(sourceBattleSpritePlacement("opponent", 96, 96, 89, "double", 0)).toMatchObject({ left: 384, top: 79 });
    expect(sourceBattleSpritePlacement("opponent", 96, 96, 89, "double", 1)).toMatchObject({ left: 304, top: 63 });
    expect(sourceTrainerSpritePlacement("player", 160, 220)).toEqual({ left: 48, top: 164, width: 160, height: 220 });
    expect(sourceTrainerSpritePlacement("opponent", 160, 160)).toEqual({ left: 304, top: 8, width: 160, height: 160 });
  });

  it("applies the source animated-sprite scales before grounding battlers", () => {
    expect(sourceBattleSpriteScale("player")).toBe(3);
    expect(sourceBattleSpriteScale("opponent")).toBe(2);
    expect(sourceBattleScaledVisibleBottom(43, 3)).toBe(131);
    expect(sourceBattleSpritePlacement("player", 138, 138, 131)).toEqual({
      left: 59, top: 189, width: 138, height: 138, originX: 69, originY: 131,
    });
  });

  it("keeps the source player send-out curve separate from the static trainer image", () => {
    expect(SOURCE_PLAYER_BALL_PATH).toHaveLength(20);
    expect(SOURCE_PLAYER_BALL_PATH[0]).toEqual([0, 146]);
    expect(SOURCE_PLAYER_BALL_PATH.at(-1)).toEqual([127, 238]);
    const frames = sourcePlayerBallKeyframes();
    expect(SOURCE_TRAINER_Y_OFFSET).toBe(64);
    expect(frames[0]).toMatchObject({ left: "0%", top: `${(210 / 384) * 100}%`, offset: 0 });
    expect(frames.at(-1)).toMatchObject({ left: `${(127 / 512) * 100}%`, top: `${(302 / 384) * 100}%`, offset: 1 });
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

  it("uses the same turn resolver when the player switches Pokemon in a local battle", () => {
    let party = addPokemonToParty(createEmptyPlayerParty(), createPersistentPokemon("first", "CHESPIN", 5, catalog));
    party = addPokemonToParty(party, createPersistentPokemon("second", "CHESPIN", 5, catalog));
    const battle = createSourceEncounterBattle(party, { species: "BIDOOF", level: 2 }, catalog, "wild");
    const result = resolveSourceEncounterAction(battle, { kind: "switch", teamIndex: 1 }, new SeededRandom(12));
    expect(result.state.teams.player.activeIndex).toBe(1);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "pokemonSwitched", side: "player",
      fromIndex: 0, toIndex: 1, reason: "voluntary" }));
    expect(result.events).toContainEqual(expect.objectContaining({ type: "moveUsed", side: "opponent" }));
  });

  it("detects the newly active battler that must play its send-out after a join", () => {
    const party = addPokemonToParty(createEmptyPlayerParty(), createPersistentPokemon("starter", "CHESPIN", 5, catalog));
    const before = createSourceEncounterBattle(party, { species: "BIDOOF", level: 2 }, catalog, "wild");
    const helper = { ...before.teams.player.members[0]!, id: "helper", name: "Partenaire" };
    const after = createDoubleTeamBattleState({
      player: [before.teams.player.members[0]!, helper], opponent: before.teams.opponent.members,
    }, { player: [0, 1], opponent: [0] });
    expect(joinedBattlePositions(before, after)).toMatchObject([
      { side: "player", slot: 1, battler: { id: "helper" } },
    ]);
  });

  it("preserves automatic replacement events for the visual sequencer", () => {
    let party = addPokemonToParty(createEmptyPlayerParty(), createPersistentPokemon("first", "CHESPIN", 5, catalog));
    party = addPokemonToParty(party, createPersistentPokemon("second", "CHESPIN", 5, catalog));
    const battle = createSourceEncounterBattle(party, { species: "BIDOOF", level: 2 }, catalog, "wild");
    const knockedOut = { ...battle, replacementRequired: ["player" as const], teams: { ...battle.teams,
      player: { ...battle.teams.player, members: battle.teams.player.members.map((member, index) =>
        index === battle.teams.player.activeIndex ? { ...member, hp: 0 } : member) } } };

    const replacement = resolveAutomaticReplacements(knockedOut);

    expect(replacement.state.teams.player.activeIndex).toBe(1);
    expect(replacement.events).toEqual([expect.objectContaining({ type: "pokemonSwitched", side: "player",
      fromIndex: 0, toIndex: 1, reason: "replacement" })]);
  });

  it("builds a trainer team from the extracted trainer definition", () => {
    const party = addPokemonToParty(createEmptyPlayerParty(), createPersistentPokemon("starter", "CHESPIN", 5, catalog));
    const battle = createSourceTrainerBattle(party, { trainerType: "RIVAL", name: "Crisanto", version: 1,
      pokemon: [{ species: "BIDOOF", level: 3, moves: ["TACKLE", null, null, null] }] }, catalog);
    expect(battle.teams.opponent.members[0]).toMatchObject({ species: "BIDOOF", level: 3,
      moves: [{ move: { internalName: "TACKLE" }, pp: 35 }] });
  });

  it("starts a trainer battle while preserving a source ability whose effect is not implemented yet", () => {
    const party = addPokemonToParty(createEmptyPlayerParty(), createPersistentPokemon("starter", "CHESPIN", 8, catalog));
    const battle = createSourceTrainerBattle(party, { trainerType: "CAMPESINO", name: "Jean", version: 0,
      pokemon: [{ species: "BUNNELBY", level: 6, moves: [null, null, null, null] }] }, catalog);
    expect(battle.teams.opponent.members[0]).toMatchObject({ species: "BUNNELBY", ability: "CHEEKPOUCH" });
    expect(() => resolveSourceEncounterTurn(battle, 0, new SeededRandom(12))).not.toThrow();
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
