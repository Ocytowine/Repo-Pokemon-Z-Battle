import { describe, expect, it } from "vitest";
import { createDoubleTeamBattleState, createTeamBattleState, MINIMAL_MOVE_CATALOG,
  type BattlerState } from "@pokemon-z-battle/battle-engine";
import { sourceBattleAnimationGraphicPath, sourceBattleBattlerCels, sourceBattleChargeHidesSprite, sourceBattleChargingSpriteHidden, sourceBattleGenderSymbol, sourceBattleTeamBallPath, sourceCaptureBallIndex, sourceExperienceHudSlot,
  selectSourceBattleAnimation, selectSourceChargingBattleAnimation, selectSourceCommonBattleAnimation, sourceHealthAnimationDuration, sourceBattleMessageDuration,
  sourceBattleAnimationPlaneBounds, sourceBattleAnimationPlaneState, sourceWildPokemonCaught } from "../src/source-battle-visuals.js";
import type { AssetManifest, BattleAnimationsManifest } from "@pokemon-z-battle/local-assets";

describe("source battle message pacing", () => {
  it("leaves longer text on screen while bounding automatic waits", () => {
    expect(sourceBattleMessageDuration("Coup critique !")).toBeGreaterThan(1_100);
    expect(sourceBattleMessageDuration("Le Pokémon adverse rate son attaque.")).toBeGreaterThan(1_600);
    expect(sourceBattleMessageDuration("A".repeat(200))).toBe(2_300);
    expect(sourceBattleMessageDuration("Bref", 2_500)).toBe(2_500);
  });
});

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
  it("uses the adjacent source charging animation, including those outside Common", () => {
    const digImpact = { index: 541, name: "Move:DIG",
      graphicPath: "Graphics/Animations/PRAS- Dig.png", hue: 0, position: 4,
      frames: [], timings: [] };
    const dig = { ...digImpact, index: 542, name: "Common:Dig charging" };
    const flyImpact = { ...digImpact, index: 292, name: "Move:FLY" };
    const fly = { ...digImpact, index: 293, name: "Fly charging" };
    const manifest = { schemaVersion: "1.0.0",
      coordinateSystem: { width: 512, height: 384, cellSize: 192, sheetColumns: 5, framesPerSecond: 20 },
      mappings: [{ internalName: "DIG", player: 541, opponent: null },
        { internalName: "FLY", player: 292, opponent: null }],
      animations: [digImpact, dig, flyImpact, fly] } satisfies BattleAnimationsManifest;
    expect(selectSourceChargingBattleAnimation(manifest, "player", "DIG")?.animation).toBe(dig);
    expect(selectSourceChargingBattleAnimation(manifest, "opponent", "DIG"))
      .toMatchObject({ animation: dig, reverse: true });
    expect(selectSourceChargingBattleAnimation(manifest, "player", "FLY")?.animation).toBe(fly);
  });

  it("uses the original type fallback for a move without a direct animation", () => {
    const bug = { index: 193, name: "Move:TWINEEDLE",
      graphicPath: "Graphics/Animations/PRAS- Megahorn.png", hue: 0, position: 4,
      frames: [], timings: [] };
    const manifest = { schemaVersion: "1.0.0",
      coordinateSystem: { width: 512, height: 384, cellSize: 192, sheetColumns: 5, framesPerSecond: 20 },
      mappings: [{ internalName: "ESPADASEDOSA", player: null, opponent: null },
        { internalName: "TWINEEDLE", player: 193, opponent: null }],
      animations: [bug] } satisfies BattleAnimationsManifest;
    expect(selectSourceBattleAnimation(manifest, "player", "ESPADASEDOSA", "BUG")?.animation).toBe(bug);
  });

  it("recovers a uniquely matching source graphic without inventing a move animation", () => {
    const graphic = (path: string): AssetManifest["records"][number] => ({ path,
      category: "graphics/animations", mediaType: "image", image: null });
    const assets: AssetManifest = { schemaVersion: "1.0.0", records: [
      graphic("Graphics/Animations/PRAS- Psychic BG.png"), graphic("Graphics/Animations/!.png") ] };
    expect(sourceBattleAnimationGraphicPath("Graphics/Animations/PRAS- PsychicBG.png", assets))
      .toBe("Graphics/Animations/PRAS- Psychic BG.png");
    expect(sourceBattleAnimationGraphicPath("Graphics/Animations/Absent.png", assets))
      .toBe("Graphics/Animations/Absent.png");
    expect(sourceBattleAnimationGraphicPath("Graphics/Animations/!", assets))
      .toBe("Graphics/Animations/!.png");
    const ambiguous: AssetManifest = { ...assets, records: [...assets.records,
      graphic("Graphics/Animations/PRAS Psychic BG.png")] };
    expect(sourceBattleAnimationGraphicPath("Graphics/Animations/PRAS- PsychicBG.png", ambiguous))
      .toBe("Graphics/Animations/PRAS- PsychicBG.png");
  });

  it("hides only a semi-invulnerable charging battler, including a restored state", () => {
    expect(sourceBattleChargeHidesSprite({ functionCode: "0CA" })).toBe(true);
    expect(sourceBattleChargeHidesSprite({ functionCode: "0C9" })).toBe(true);
    expect(sourceBattleChargeHidesSprite({ functionCode: "0C4" })).toBe(false);
    const tunnel = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "DIG", functionCode: "0CA" as const };
    const user = { ...battler("user"), moves: [{ move: tunnel, pp: 9 }],
      volatile: { chargingMove: "DIG" } };
    expect(sourceBattleChargingSpriteHidden(user)).toBe(true);
    expect(sourceBattleChargingSpriteHidden(JSON.parse(JSON.stringify(user)) as BattlerState)).toBe(true);
    expect(sourceBattleChargingSpriteHidden({ ...user, volatile: { chargingMove: null } })).toBe(false);
    expect(sourceBattleChargingSpriteHidden({ ...user, moves: [{ move: {
      ...tunnel, functionCode: "0C4" }, pp: 9 }] })).toBe(false);
  });

  it("extends only animation background planes to the wide battle viewport", () => {
    const stage = { left: 160, top: 0, width: 480, height: 360 };
    const viewport = { left: 0, top: 0, width: 800, height: 360 };
    expect(sourceBattleAnimationPlaneBounds(stage, viewport, true))
      .toEqual({ left: -160, top: 0, width: 800, height: 360 });
    expect(sourceBattleAnimationPlaneBounds(stage, viewport, false))
      .toEqual({ left: 0, top: 0, width: 480, height: 360 });
  });

  it("uses only the user anchor when a self-targeted animation contains both battler cels", () => {
    const frame = [{ pattern: -1, x: 128, y: 224 }, { pattern: -2, x: 128, y: 224 }];
    expect(sourceBattleBattlerCels(frame, true)).toEqual([frame[0]]);
    expect(sourceBattleBattlerCels(frame, false)).toEqual(frame);
    expect(sourceBattleBattlerCels([frame[1]!], true)).toEqual([frame[1]]);
  });

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
