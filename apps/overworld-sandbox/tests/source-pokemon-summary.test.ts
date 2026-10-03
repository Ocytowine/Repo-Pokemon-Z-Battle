import { describe, expect, it } from "vitest";
import { createPersistentPokemon, type PlayerDetailsCatalog, type PokemonTrainingValues, type PublicPokemonIdentity }
  from "@pokemon-z-battle/player-state";
import type { PokemonAssetsManifest, PokemonSummaryAssets } from "@pokemon-z-battle/local-assets";
import { createSourcePokemonCollection } from "../src/source-pokemon-collection.js";
import { createPublicSourcePokemonSummary, createSourcePokemonSummary, sourceHiddenPowerType, sourcePokemonCharacteristic }
  from "../src/source-pokemon-summary.js";

const values = (value: number): PokemonTrainingValues => ({ hp: value, attack: value, defense: value,
  speed: value, specialAttack: value, specialDefense: value });

const catalog = { pokemon: [{ id: 650, internalName: "CHESPIN", name: "Marisson", kind: "Pokémon Bogue",
  pokedexEntry: "English source text", types: ["GRASS"],
  baseStats: { hp: 56, attack: 61, defense: 65, speed: 38, specialAttack: 48, specialDefense: 45 },
  effortPoints: values(0), genderRate: "FemaleOneEighth", growthRate: "Parabolic", baseExperience: 63,
  happiness: 70, abilities: ["OVERGROW"], hiddenAbilities: ["BULLETPROOF"],
  levelUpMoves: [{ level: 1, move: "TACKLE" }], formNames: [], stepsToHatch: 5120, height: 0.4, weight: 9 }],
  moves: [{ id: 303, internalName: "TACKLE", name: "Charge", functionCode: "000", power: 40,
    type: "NORMAL", category: "Physical", accuracy: 100, pp: 35, priority: 0, effectChance: 0,
    targetCode: "SingleNonUser", description: "Charge l'ennemi avec tout son corps." }],
  abilities: [{ id: 65, internalName: "OVERGROW", name: "Engrais",
    description: "Renforce les capacités Plante en cas de besoin." }] } as PlayerDetailsCatalog;

describe("Pokemon Z summary read model", () => {
  it("reproduces the source characteristic tie-break and Hidden Power type order", () => {
    expect(sourcePokemonCharacteristic(4, values(0))).toBe("Très curieux.");
    expect(sourceHiddenPowerType(values(0))).toBe("FIGHTING");
    expect(sourceHiddenPowerType(values(31))).toBe("FAIRY");
  });

  it("builds a deliberately minimal public projection", () => {
    const identity: PublicPokemonIdentity = { species: "CHESPIN", nickname: "Picotin", level: 5,
      gender: "female", shiny: true, form: 1,
      originalTrainer: { publicId: 1234, name: "Ariane", pronouns: "feminine" } };
    const result = createPublicSourcePokemonSummary(identity, catalog);
    expect(result).toMatchObject({ visibility: "public", displayName: "Picotin", number: 650,
      restrictedPages: ["history", "stats", "moves", "ribbons"] });
    expect(JSON.stringify(result)).not.toMatch(/"(?:personalId|trainerId|ivs|evs|happiness|origin|heldItem)"/u);
  });

  it("exposes move details and horizontal battler animation frames", () => {
    const pokemon = createPersistentPokemon("starter", "CHESPIN", 5, catalog);
    const assets: PokemonAssetsManifest = { schemaVersion: "1", records: [{ id: 650,
      internalName: "CHESPIN", name: "Marisson", assets: {
        battler: [{ pokemonId: 650, kind: "battler", form: null, shiny: false, female: false,
          back: false, variant: null, path: "Graphics/Battlers/650.png", width: 2600, height: 50,
          frameCount: 52 }], icon: [], footprint: [], cry: [], overworld: [] } }] };
    const summaryAssets: PokemonSummaryAssets = { category: null, ribbons: null, shiny: null,
      statuses: null, pokerus: null, balls: new Map() };
    const entry = createSourcePokemonCollection({ schemaVersion: 1, activeIndex: 0, members: [pokemon] },
      { schemaVersion: 1, members: [] }, catalog, assets)[0]!;
    const result = createSourcePokemonSummary(entry, catalog, assets, summaryAssets, new Map());
    expect(result.spriteAnimation).toEqual({ frameWidth: 50, frameHeight: 50, frameCount: 52 });
    expect(result.moves[0]?.definition).toMatchObject({ name: "Charge", category: "Physical",
      power: 40, accuracy: 100, description: "Charge l'ennemi avec tout son corps." });
  });
});
