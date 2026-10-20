import { describe, expect, it } from "vitest";
import { createDoubleTeamBattleState, createTeamBattleState, MINIMAL_MOVE_CATALOG,
  type BattlerState } from "@pokemon-z-battle/battle-engine";
import { sourceBattleGenderSymbol, sourceBattleTeamBallPath, sourceCaptureBallIndex, sourceExperienceHudSlot,
  selectSourceCommonBattleAnimation, sourceHealthAnimationDuration,
  sourceBattleAnimationPlaneState, sourceWildPokemonCaught } from "../src/source-battle-visuals.js";
import type { BattleAnimationsManifest } from "@pokemon-z-battle/local-assets";

function battler(id: string): BattlerState {
  return { id, species: id, name: id, level: 5, types: ["NORMAL"], hp: 20,
    stats: { maxHp: 20, attack: 10, defense: 10, specialAttack: 10, specialDefense: 10, speed: 10 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 10 }] };
}

describe("source battle health animation", () => {
  it("keeps a readable minimum and caps a full health drain", () => {
    expect(sourceHealthAnimationDuration(100, 95, 100)).toBe(420);
    expect(sourceHealthAnimationDuration(100, 50, 100)).toBe(525);
    expect(sourceHealthAnimationDuration(100, 0, 100)).toBe(900);
  });
});

describe("source common battle animations", () => {
  it("selects a source status animation by its canonical Common name", () => {
    const sleep = { index: 4, name: "Common:Sleep", graphicPath: "Graphics/Animations/status.png",
      hue: 0, position: 4, frames: [], timings: [] };
    const manifest = { schemaVersion: "1.0.0",
      coordinateSystem: { width: 512, height: 384, cellSize: 192, sheetColumns: 5, framesPerSecond: 20 },
      mappings: [], animations: [sleep] } satisfies BattleAnimationsManifest;
    expect(selectSourceCommonBattleAnimation(manifest, "Common:Sleep")).toBe(sleep);
    expect(selectSourceCommonBattleAnimation(manifest, "Common:Unknown")).toBeNull();
  });

  it("interpolates source background and foreground plane timings", () => {
    const animation = { index: 12, name: "Common:MegaEvolution",
      graphicPath: "Graphics/Animations/mega.png", hue: 0, position: 4, frames: [], timings: [
        { frame: 0, type: 1, name: "ebMegaBg.png", volume: 80, pitch: 100,
          x: 0, y: 0, opacity: 0, duration: 5 },
        { frame: 0, type: 2, name: "", volume: 80, pitch: 100,
          x: null, y: null, opacity: 255, duration: 10 },
        { frame: 0, type: 2, name: "", volume: 80, pitch: 100,
          x: 500, y: null, opacity: null, duration: 10 },
        { frame: 37, type: 3, name: "flash.png", volume: 80, pitch: 100,
          x: 0, y: 0, opacity: 0, duration: 5 },
        { frame: 37, type: 4, name: "", volume: 80, pitch: 100,
          x: null, y: null, opacity: 255, duration: 2 },
      ] } satisfies BattleAnimationsManifest["animations"][number];
    expect(sourceBattleAnimationPlaneState(animation, 5, "background"))
      .toMatchObject({ path: "Graphics/Animations/ebMegaBg.png", x: 250, opacity: 127.5 });
    expect(sourceBattleAnimationPlaneState(animation, 38, "foreground"))
      .toMatchObject({ path: "Graphics/Animations/flash.png", opacity: 127.5 });
  });
});

describe("source capture ball", () => {
  it("uses the ball graphics indices from the source script", () => {
    expect(sourceCaptureBallIndex("POKEBALL")).toBe(0);
    expect(sourceCaptureBallIndex("QUICKBALL")).toBe(14);
    expect(sourceCaptureBallIndex("ULTRABALLCASERA")).toBe(27);
    expect(sourceCaptureBallIndex("UNKNOWN")).toBe(0);
  });

  it("uses the source HUD ball states and displays the Pokemon gender", () => {
    expect(sourceBattleTeamBallPath(battler("ready"))).toBe("Graphics/Pictures/ballnormal.png");
    expect(sourceBattleTeamBallPath({ ...battler("status"), majorStatus: { kind: "poison", counter: 0 } }))
      .toBe("Graphics/Pictures/ballstatus.PNG");
    expect(sourceBattleTeamBallPath({ ...battler("fainted"), hp: 0 })).toBe("Graphics/Pictures/ballfainted.png");
    expect(sourceBattleGenderSymbol("male")).toBe("♂");
    expect(sourceBattleGenderSymbol("female")).toBe("♀");
    expect(sourceBattleGenderSymbol("genderless")).toBe("");
  });

  it("derives the wild caught marker only from the viewer's personal Pokedex", () => {
    expect(sourceWildPokemonCaught("FENNEKIN", ["FENNEKIN", "SCATTERBUG"])).toBe(true);
    expect(sourceWildPokemonCaught("BUNNELBY", ["FENNEKIN", "SCATTERBUG"])).toBe(false);
  });
});

describe("source battle experience HUD", () => {
  it("animates only the HUD slot occupied by the actual experience recipient", () => {
    const single = createTeamBattleState({ player: [battler("active"), battler("replaced")],
      opponent: [battler("target")] });
    expect(sourceExperienceHudSlot(single, "active")).toBe(0);
    expect(sourceExperienceHudSlot(single, "replaced")).toBeNull();
    const double = createDoubleTeamBattleState({ player: [battler("first"), battler("second")],
      opponent: [battler("target-1"), battler("target-2")] });
    expect(sourceExperienceHudSlot(double, "second")).toBe(1);
  });
});
