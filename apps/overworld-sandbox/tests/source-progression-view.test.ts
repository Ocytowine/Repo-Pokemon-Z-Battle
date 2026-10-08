import { describe, expect, it } from "vitest";
import type { PokemonAssetsManifest } from "@pokemon-z-battle/local-assets";
import { sourceEvolutionBattler } from "../src/source-progression-view.js";

const assets: PokemonAssetsManifest = {
  schemaVersion: "test",
  records: [{
    id: 37,
    internalName: "VULPIX",
    name: "Goupix",
    assets: {
      battler: [{ pokemonId: 37, kind: "battler", form: null, shiny: false, female: false, back: false,
        variant: null, path: "Graphics/Battlers/037.png", width: 4189, height: 59, frameCount: 71 }],
    },
  }],
};

describe("source evolution presentation", () => {
  it("crops an animated battler sheet into individual frames", () => {
    expect(sourceEvolutionBattler("VULPIX", assets)).toEqual({
      url: "/__pokemon-z/source/Graphics/Battlers/037.png",
      frameCount: 71,
      frameWidth: 59,
      frameHeight: 59,
    });
  });

  it("does not invent a sprite for an unknown species", () => {
    expect(sourceEvolutionBattler("MISSINGNO", assets)).toBeNull();
  });
});
