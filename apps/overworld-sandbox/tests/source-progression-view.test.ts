import { describe, expect, it } from "vitest";
import type { PokemonAssetsManifest } from "@pokemon-z-battle/local-assets";
import { sourceEvolutionBattler } from "../src/source-progression-view.js";
import { sourceTransformationBackdropHtml } from "../src/source-transformation-stage.js";

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

  it("starts the six source lines at evenly staggered phases", () => {
    const html = sourceTransformationBackdropHtml("evolution");
    expect(html.match(/class="source-transformation-line"/g)).toHaveLength(6);
    expect(html).toContain("--transformation-line-delay:0ms");
    expect(html).toContain("--transformation-line-delay:-4000ms");
  });

  it("adds the source light layers only to the evolution scene", () => {
    const evolution = sourceTransformationBackdropHtml("evolution");
    const hatch = sourceTransformationBackdropHtml("hatch");
    expect(evolution).toContain("source-transformation-start-light");
    expect(evolution).toContain("source-transformation-core-light");
    expect(evolution).toContain("source-transformation-end-light");
    expect(evolution.match(/--transformation-ray-angle:/g)).toHaveLength(8);
    expect(evolution.match(/--transformation-particle-x:/g)).toHaveLength(16);
    expect(hatch).not.toContain("source-transformation-effects");
  });
});
