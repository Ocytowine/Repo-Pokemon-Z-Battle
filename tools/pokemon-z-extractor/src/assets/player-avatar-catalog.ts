export const PLAYER_AVATAR_CATALOG_SCHEMA_VERSION = "1.0.0" as const;

export type LegacyPlayerPresentation = "masculine" | "feminine";
export type LegacyPlayerPalette = "classic" | "light" | "dark";
export type PlayerAvatarContext = "overworld" | "bicycle" | "surf" | "run" | "dive" | "fish"
  | "fishSurf" | "battleFront" | "battleBack" | "introPreview";

export interface PlayerAvatarAssetReference {
  readonly path: string | null;
  readonly native: boolean;
  readonly fallbackContext: PlayerAvatarContext | null;
}

export interface PlayerAvatarCatalogRecord {
  readonly id: string;
  readonly legacyPlayerId: number;
  readonly presentation: LegacyPlayerPresentation;
  readonly legacyPalette: LegacyPlayerPalette;
  readonly trainerType: string;
  readonly assets: Readonly<Record<PlayerAvatarContext, PlayerAvatarAssetReference>>;
  readonly overworldPoses: readonly string[];
  readonly battleBackVariants: readonly string[];
}

export interface PlayerAvatarCatalog {
  readonly schemaVersion: typeof PLAYER_AVATAR_CATALOG_SCHEMA_VERSION;
  readonly sourceManifest: "asset-manifest.json";
  readonly records: readonly PlayerAvatarCatalogRecord[];
}

export interface PlayerAvatarAuditReport {
  readonly schemaVersion: typeof PLAYER_AVATAR_CATALOG_SCHEMA_VERSION;
  readonly summary: {
    readonly profiles: number;
    readonly completeProfiles: number;
    readonly nativeAssets: number;
    readonly fallbackAssets: number;
    readonly missingAssets: number;
  };
  readonly profiles: readonly {
    readonly id: string;
    readonly missing: readonly PlayerAvatarContext[];
    readonly fallbacks: readonly PlayerAvatarContext[];
    readonly missingOverworldPoseVariants: readonly number[];
    readonly missingBattleBackVariants: readonly number[];
  }[];
}

const PALETTES: readonly LegacyPlayerPalette[] = ["classic", "light", "dark"];
const CONTEXTS: readonly PlayerAvatarContext[] = ["overworld", "bicycle", "surf", "run", "dive", "fish",
  "fishSurf", "battleFront", "battleBack", "introPreview"];

function normalized(value: string): string {
  return value.normalize("NFC").replaceAll("\\", "/").toLocaleLowerCase("en");
}

function escaped(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function playerLines(metadata: string): readonly { readonly id: number; readonly values: readonly string[] }[] {
  const lines: { id: number; values: string[] }[] = [];
  let globalSection = false;
  for (const rawLine of metadata.split(/\r?\n/gu)) {
    const line = rawLine.trim();
    const section = /^\[(\d+)\]$/u.exec(line);
    if (section !== null) { globalSection = Number(section[1]) === 0; continue; }
    if (!globalSection) continue;
    const match = /^Player([A-H])=(.+)$/u.exec(line);
    if (match === null) continue;
    lines.push({ id: match[1]!.codePointAt(0)! - "A".codePointAt(0)!, values: match[2]!.split(",").map((value) => value.trim()) });
  }
  return lines.sort((left, right) => left.id - right.id);
}

export function buildPlayerAvatarCatalog(metadata: string, assetPaths: readonly string[]): {
  readonly catalog: PlayerAvatarCatalog;
  readonly report: PlayerAvatarAuditReport;
} {
  const byNormalizedPath = new Map(assetPaths.map((assetPath) => [normalized(assetPath), assetPath]));
  const resolve = (...candidates: readonly string[]): string | null => {
    for (const candidate of candidates) {
      const result = byNormalizedPath.get(normalized(candidate));
      if (result !== undefined) return result;
    }
    return null;
  };
  const records = playerLines(metadata).map(({ id, values }): PlayerAvatarCatalogRecord => {
    const [trainerType = "", overworldName = "", bicycleName = "", surfName = "", runName = "", diveName = "",
      fishName = "", fishSurfName = ""] = values;
    const presentation: LegacyPlayerPresentation = id % 2 === 0 ? "masculine" : "feminine";
    const palette = PALETTES[Math.floor(id / 2)] ?? "classic";
    const numbered = String(id).padStart(3, "0");
    const character = (name: string): string | null => name === "" ? null
      : resolve(`Graphics/Characters/${name}.png`);
    const overworld = character(overworldName);
    const contextual = (name: string): PlayerAvatarAssetReference => {
      const nativePath = character(name);
      return nativePath !== null
        ? { path: nativePath, native: true, fallbackContext: null }
        : { path: overworld, native: false, fallbackContext: overworld === null ? null : "overworld" };
    };
    const introStem = presentation === "masculine" ? "introBoyRaza" : "introGirlRaza";
    const assets: Record<PlayerAvatarContext, PlayerAvatarAssetReference> = {
      overworld: { path: overworld, native: overworld !== null, fallbackContext: null },
      bicycle: contextual(bicycleName), surf: contextual(surfName),
      run: contextual(runName), dive: contextual(diveName), fish: contextual(fishName),
      fishSurf: contextual(fishSurfName),
      battleFront: { path: resolve(`Graphics/Characters/trainer${numbered}.png`,
        `Graphics/Characters/trainer${trainerType}.png`), native: false, fallbackContext: null },
      battleBack: { path: resolve(`Graphics/Characters/trback${numbered}.png`,
        `Graphics/Characters/trback${trainerType}.png`), native: false, fallbackContext: null },
      introPreview: { path: resolve(`Graphics/Pictures/${introStem}${Math.floor(id / 2)}.png`),
        native: false, fallbackContext: null },
    };
    for (const context of ["battleFront", "battleBack", "introPreview"] as const) {
      assets[context] = { ...assets[context], native: assets[context].path !== null };
    }
    const posePattern = new RegExp(`^graphics/characters/${escaped(overworldName)}_(\\d+)\\.png$`, "iu");
    const backPattern = new RegExp(`^graphics/characters/trback${numbered}_(\\d+)\\.png$`, "iu");
    const matching = (pattern: RegExp): string[] => assetPaths.filter((assetPath) => pattern.test(normalized(assetPath)))
      .sort((left, right) => left.localeCompare(right, "en"));
    return { id: `legacy-${id}`, legacyPlayerId: id, presentation, legacyPalette: palette, trainerType,
      assets, overworldPoses: matching(posePattern), battleBackVariants: matching(backPattern) };
  });
  const variantNumber = (assetPath: string): number | null => {
    const match = /_(\d+)\.png$/iu.exec(assetPath);
    return match === null ? null : Number(match[1]);
  };
  const expectedOverworldVariants = [...new Set(records.flatMap((record) => record.overworldPoses)
    .map(variantNumber).filter((value): value is number => value !== null))].sort((left, right) => left - right);
  const expectedBattleBackVariants = [...new Set(records.flatMap((record) => record.battleBackVariants)
    .map(variantNumber).filter((value): value is number => value !== null))].sort((left, right) => left - right);
  const profiles = records.map((record) => ({ id: record.id,
    missing: CONTEXTS.filter((context) => record.assets[context].path === null),
    fallbacks: CONTEXTS.filter((context) => record.assets[context].path !== null && !record.assets[context].native),
    missingOverworldPoseVariants: expectedOverworldVariants.filter((variant) => !record.overworldPoses.some((assetPath) =>
      variantNumber(assetPath) === variant)),
    missingBattleBackVariants: expectedBattleBackVariants.filter((variant) => !record.battleBackVariants.some((assetPath) =>
      variantNumber(assetPath) === variant)),
  }));
  const references = records.flatMap((record) => CONTEXTS.map((context) => record.assets[context]));
  return {
    catalog: { schemaVersion: PLAYER_AVATAR_CATALOG_SCHEMA_VERSION, sourceManifest: "asset-manifest.json", records },
    report: { schemaVersion: PLAYER_AVATAR_CATALOG_SCHEMA_VERSION, summary: {
      profiles: records.length, completeProfiles: profiles.filter((profile) => profile.missing.length === 0
        && profile.missingOverworldPoseVariants.length === 0 && profile.missingBattleBackVariants.length === 0).length,
      nativeAssets: references.filter((reference) => reference.native).length,
      fallbackAssets: references.filter((reference) => reference.path !== null && !reference.native).length,
      missingAssets: references.filter((reference) => reference.path === null).length,
    }, profiles },
  };
}
