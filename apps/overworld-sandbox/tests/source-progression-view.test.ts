import { describe, expect, it } from "vitest";
import type { PokemonAssetsManifest } from "@pokemon-z-battle/local-assets";
import type { PlayerDetailsCatalog } from "@pokemon-z-battle/player-state";
import { sourceEvolutionBattler, sourceProgressionMoveDetailsHtml, sourceProgressionMovePromptHtml }
  from "../src/source-progression-view.js";
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
  it("shows the new and known move facts with safe descriptions", () => {
    const move = { internalName: "TWINEEDLE", name: "Double Dard", type: "BUG",
      category: "Physical", power: 25, accuracy: 100, pp: 20,
      description: "Frappe deux fois & peut empoisonner." } as PlayerDetailsCatalog["moves"][number];
    const offered = sourceProgressionMoveDetailsHtml(move, "TWINEEDLE");
    expect(offered).toContain("Double Dard");
    expect(offered).toContain("Physique");
    expect(offered).toContain("Puissance</dt><dd>25");
    expect(offered).toContain("Précision</dt><dd>100");
    expect(offered).toContain("PP</dt><dd>20");
    expect(offered).toContain("Frappe deux fois &amp; peut empoisonner.");
    expect(sourceProgressionMoveDetailsHtml(move, "TWINEEDLE", 7, 20))
      .toContain("PP</dt><dd>7/20");
    const catalog = { moves: [move, { ...move, internalName: "HARDEN", name: "Armure",
      power: 0, description: "Monte la Défense." }] } as PlayerDetailsCatalog;
    const slot = (internalName: string) => ({ internalName, pp: 7, maxPp: 20 });
    const free = sourceProgressionMovePromptHtml("Coconfort", [slot("HARDEN")],
      "TWINEEDLE", catalog, false);
    expect(free).toContain("data-progression-learn");
    expect(free).toContain("Voulez-vous apprendre cette capacité ?");
    const full = sourceProgressionMovePromptHtml("Coconfort", Array(4).fill(slot("HARDEN")),
      "TWINEEDLE", catalog, true);
    expect(full.match(/data-progression-replace=/g)).toHaveLength(4);
    expect(full).toContain("Monte la Défense.");
    expect(full).toContain("Frappe deux fois &amp; peut empoisonner.");
    expect(full).toContain("PP</dt><dd>7/20");
  });

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
