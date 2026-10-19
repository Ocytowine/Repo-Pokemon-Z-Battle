import { describe, expect, it } from "vitest";
import { createPersistentPokemon, type PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import { applySourceEncounterInitialEffects, parseSourceEncounterModifierCatalog,
  resolveSourceEncounterInitialEffects, resolveSourceEncounterLevel } from "../src/source-encounter-modifiers.js";

const catalog = parseSourceEncounterModifierCatalog({ schemaVersion: "1.0.0", records: [
  { mapIds: [138, 139, 140], species: [], requiredSwitches: [], effects: { majorStatus: "caduco" },
    source: { file: "scripts/modifiers.rb", line: 20 } },
  { mapIds: [], species: ["FURFROU"], requiredSwitches: [482], effects: { majorStatus: "caduco" },
    source: { file: "scripts/modifiers.rb", line: 95 } },
] });

describe("source encounter modifiers", () => {
  it("applies a map-wide initial status", () => {
    expect(resolveSourceEncounterInitialEffects(catalog,
      { mapId: 139, species: "PIKACHU", switches: {} }).majorStatus).toEqual({ kind: "caduco" });
  });

  it("applies a narrative species modifier only while its switch is active", () => {
    expect(resolveSourceEncounterInitialEffects(catalog,
      { mapId: 24, species: "FURFROU", switches: { 482: true } }).majorStatus).toEqual({ kind: "caduco" });
    expect(resolveSourceEncounterInitialEffects(catalog,
      { mapId: 24, species: "FURFROU", switches: {} }).majorStatus).toBeNull();
    expect(resolveSourceEncounterInitialEffects(catalog,
      { mapId: 24, species: "BUNNELBY", switches: { 482: true } }).majorStatus).toBeNull();
  });

  it("applies form, moves, training values, item and public identity before battle projection", () => {
    const tackle = { id: 1, internalName: "TACKLE", name: "Charge", functionCode: "000", power: 40,
      type: "NORMAL", category: "Physical" as const, accuracy: 100, pp: 35, priority: 0, effectChance: 0 };
    const bite = { ...tackle, id: 2, internalName: "BITE", name: "Morsure", pp: 25 };
    const creationCatalog: PlayerCreationCatalog = { pokemon: [{ internalName: "FURFROU", name: "Couafarel",
      types: ["NORMAL"], baseStats: { hp: 75, attack: 80, defense: 60, speed: 102, specialAttack: 65,
        specialDefense: 90 }, abilities: ["FURCOAT"], growthRate: "Medium", baseExperience: 165,
      genderRate: "Female50Percent", happiness: 70, levelUpMoves: [{ level: 1, move: "TACKLE" }] }],
      moves: [tackle, bite] };
    const pokemon = createPersistentPokemon("wild", "FURFROU", 11, creationCatalog);
    const modified = applySourceEncounterInitialEffects(pokemon, {
      majorStatus: { kind: "caduco" }, form: 1, learnedMoves: ["BITE"],
      ivs: { hp: 31 }, evs: { hp: 100 }, heldItem: "ANTICRITICO", shiny: true, nickname: "Gardien",
    }, creationCatalog);
    expect(modified).toMatchObject({ nickname: "Gardien", heldItem: "ANTICRITICO",
      majorStatus: { kind: "caduco" }, metadata: { form: 1, shiny: true, ivs: { hp: 31 }, evs: { hp: 100 } } });
    expect(modified.moves.at(-1)?.internalName).toBe("BITE");
    expect(modified.hp).toBe(modified.stats.maxHp);
    expect(modified.stats.maxHp).toBeGreaterThan(pokemon.stats.maxHp);
  });

  it("ports pbBalancedLevel and consumes the Map999 variation only in that map", () => {
    const dynamic = parseSourceEncounterModifierCatalog({ schemaVersion: "1.0.0", records: [{
      mapIds: [999], species: [], requiredSwitches: [], effects: { levelPolicy: "balanced-minus-four-to-zero" },
      source: { file: "scripts/dynamic.rb", line: 6 },
    }] });
    expect(resolveSourceEncounterLevel(dynamic, { mapId: 999, species: "FURFROU", switches: {} },
      [10, 20], 3, () => 4)).toBe(19);
    let called = false;
    expect(resolveSourceEncounterLevel(dynamic, { mapId: 24, species: "FURFROU", switches: {} },
      [10, 20], 3, () => { called = true; return 4; })).toBe(3);
    expect(called).toBe(false);
  });
});
