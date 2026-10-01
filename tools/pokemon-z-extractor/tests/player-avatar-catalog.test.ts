import { describe, expect, it } from "vitest";
import { buildPlayerAvatarCatalog } from "../src/assets/player-avatar-catalog.js";

describe("player avatar catalog", () => {
  it("maps legacy metadata and reports a missing action through its overworld fallback", () => {
    const metadata = `[000]\nPlayerA=HERO,trchar000,boy_bike,boy_surf,boy_run,boy_dive,boy_fish,boy_fishsurf\n[001]\n`;
    const paths = ["Graphics/Characters/trchar000.png", "Graphics/Characters/trchar000_2.png",
      "Graphics/Characters/boy_bike.png", "Graphics/Characters/boy_surf.png", "Graphics/Characters/boy_run.png",
      "Graphics/Characters/boy_fish.png", "Graphics/Characters/boy_fishsurf.png",
      "Graphics/Characters/trainer000.png", "Graphics/Characters/trback000.png",
      "Graphics/Pictures/introBoyRaza0.png"];

    const result = buildPlayerAvatarCatalog(metadata, paths);

    expect(result.catalog.records).toHaveLength(1);
    expect(result.catalog.records[0]).toMatchObject({ id: "legacy-0", legacyPlayerId: 0,
      presentation: "masculine", legacyPalette: "classic", trainerType: "HERO" });
    expect(result.catalog.records[0]?.assets.dive).toEqual({ path: "Graphics/Characters/trchar000.png",
      native: false, fallbackContext: "overworld" });
    expect(result.catalog.records[0]?.overworldPoses).toEqual(["Graphics/Characters/trchar000_2.png"]);
    expect(result.report.summary).toMatchObject({ profiles: 1, completeProfiles: 1, fallbackAssets: 1, missingAssets: 0 });
    expect(result.report.profiles[0]?.fallbacks).toEqual(["dive"]);
    expect(result.report.profiles[0]?.missingBattleBackVariants).toEqual([]);
  });

  it("keeps unresolved core assets visible in the audit", () => {
    const result = buildPlayerAvatarCatalog("[000]\nPlayerB=HERO,trchar001,,,,,,,", []);
    expect(result.report.summary.missingAssets).toBe(10);
    expect(result.report.summary.completeProfiles).toBe(0);
  });
});
