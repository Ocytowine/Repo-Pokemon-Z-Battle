export const SOURCE_CHARACTER_GUIDE_VARIABLE_ID = 240;

export interface SourceCharacterGuideEntry {
  readonly id: string;
  readonly name: string;
  readonly image: string;
  readonly fallbackAssets?: readonly string[];
  readonly unlockLevel: number;
}

/**
 * Exact catalogue declared by `guia-personajes.rb` in Pokemon Z 2.12.
 *
 * The source currently only defines two stages: Olivier at 0, then every other
 * illustration at 1. Keeping the threshold on each entry lets a corrected
 * source catalogue become progressive without changing the UI.
 */
export const SOURCE_CHARACTER_GUIDE: readonly SourceCharacterGuideEntry[] = Object.freeze([
  { id: "olivier", name: "Olivier", image: "infog_olivier.png",
    fallbackAssets: ["Pictures/olivierPres.png", "Pictures/introOlivier0.png"], unlockLevel: 0 },
  { id: "crisanto", name: "Crisanto", image: "infog_crisanto.png",
    fallbackAssets: ["Pictures/presCrisantoTS1.png"], unlockLevel: 1 },
  { id: "melia", name: "Melia", image: "infog_melia.png",
    fallbackAssets: ["Pictures/meliaPres.png"], unlockLevel: 1 },
  { id: "merlot", name: "Merlot", image: "infog_merlot.png",
    fallbackAssets: ["Characters/merlotow.png"], unlockLevel: 1 },
  { id: "canola", name: "Canola", image: "infog_canola.png",
    fallbackAssets: ["Pictures/rot1Canola.png", "Characters/canolaowPose.png"], unlockLevel: 1 },
  { id: "mirra", name: "Mirra", image: "infog_mirra.png",
    fallbackAssets: ["Pictures/mirraPres1.png"], unlockLevel: 1 },
  { id: "nubila", name: "Núbila", image: "infog_nubila.png",
    fallbackAssets: ["Characters/nubilaow2.png"], unlockLevel: 1 },
  { id: "hisopo", name: "Hisopo", image: "infog_hisopo.png",
    fallbackAssets: ["Pictures/rot2Hisopo.png", "Characters/hisopowPose.png"], unlockLevel: 1 },
  { id: "lanto", name: "Lanto", image: "infog_lanto.png",
    fallbackAssets: ["Pictures/lantoPres1.png"], unlockLevel: 1 },
  { id: "alca", name: "Alca", image: "infog_alca.png",
    fallbackAssets: ["Pictures/alcaPres.png"], unlockLevel: 1 },
  { id: "wolfram", name: "Wolfram", image: "infog_wolfram.png",
    fallbackAssets: ["Characters/wolframow.png"], unlockLevel: 1 },
  { id: "f3", name: "F3", image: "infog_f3.png",
    fallbackAssets: ["Pictures/f3Pres.png", "Characters/f3Pose.png"], unlockLevel: 1 },
  { id: "zafra", name: "Zafra", image: "infog_zafra.png",
    fallbackAssets: ["Characters/zafraPose.png"], unlockLevel: 1 },
  { id: "az", name: "Áster Zéphir (AZ)", image: "infog_az.png",
    fallbackAssets: ["Characters/azRosaleda.png"], unlockLevel: 1 },
  { id: "loto", name: "Loto", image: "infog_loto.png",
    fallbackAssets: ["Characters/lotoPose.png"], unlockLevel: 1 },
  { id: "genos", name: "Genos", image: "infog_genos.png",
    fallbackAssets: ["Characters/genosow.png"], unlockLevel: 1 },
  { id: "belladona", name: "Belladona", image: "infog_belladona.png",
    fallbackAssets: ["Pictures/belladonaPres.png"], unlockLevel: 1 },
  { id: "malvo", name: "Malvo", image: "infog_malvo.png",
    fallbackAssets: ["Characters/malvoPose.png", "Pictures/malvoFase2.png"], unlockLevel: 1 },
  { id: "aure", name: "Aure", image: "infog_aure.png",
    fallbackAssets: ["Pictures/presAure.png"], unlockLevel: 1 },
  { id: "rosaleda", name: "Rosaleda", image: "infog_rosaleda.png",
    fallbackAssets: ["Characters/rosaledaow.png"], unlockLevel: 1 },
  { id: "ferrofaz", name: "Ferrofaz", image: "infog_ferrofaz.png",
    fallbackAssets: ["Pictures/ferrofazPres.png"], unlockLevel: 1 },
  { id: "pinot", name: "Pinot", image: "infog_pinot.png",
    fallbackAssets: ["Characters/pinotow.png"], unlockLevel: 1 },
  { id: "hombre-del-saco", name: "Homme au sac", image: "infog_hombredelsaco.png",
    fallbackAssets: ["Characters/hombreSaco.png"], unlockLevel: 1 },
  { id: "hibis", name: "Hibis", image: "infog_hibis.png",
    fallbackAssets: ["Pictures/hibisVision.png", "Characters/hibisPoses.png"], unlockLevel: 1 },
  { id: "anturia", name: "Anturia", image: "infog_anturia.png",
    fallbackAssets: ["Characters/anturia.png"], unlockLevel: 1 },
  { id: "crisanto-adulte", name: "Crisanto adulte", image: "infog_crisanto2.png",
    fallbackAssets: ["Pictures/presCrisantoTS4.png", "Characters/crisantoFinal.png"], unlockLevel: 1 },
  { id: "cendera", name: "Cendera", image: "infog_cendera.png",
    fallbackAssets: ["Pictures/cenderaPres.png"], unlockLevel: 1 },
  { id: "melia-adulte", name: "Melia adulte", image: "infog_melia2.png",
    fallbackAssets: ["Pictures/meliaPres2.png", "Characters/meliaFinal.png"], unlockLevel: 1 },
  { id: "az-mendiant", name: "AZ mendiant", image: "infog_az2.png",
    fallbackAssets: ["Characters/azRosaledaTS.png"], unlockLevel: 1 },
  { id: "alca-mendiante", name: "Alca mendiante", image: "infog_alca2.png",
    fallbackAssets: ["Characters/alcaCaduca.png"], unlockLevel: 1 },
]);

export function sourceCharacterGuideLevel(variables: Readonly<Record<string, number>>): number {
  const value = variables[String(SOURCE_CHARACTER_GUIDE_VARIABLE_ID)] ?? 0;
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function unlockedSourceCharacterGuideEntries(variables: Readonly<Record<string, number>>):
readonly SourceCharacterGuideEntry[] {
  const level = sourceCharacterGuideLevel(variables);
  return SOURCE_CHARACTER_GUIDE.filter((entry) => entry.unlockLevel <= level);
}

export function sourceCharacterGuideImageUrl(entry: SourceCharacterGuideEntry): string {
  return `/__pokemon-z/source/Graphics/Pictures/${encodeURIComponent(entry.image)}`;
}

function sourceCharacterGuideAssetUrl(asset: string): string {
  return `/__pokemon-z/source/Graphics/${asset.split("/").map(encodeURIComponent).join("/")}`;
}

/** Source infography first, then only existing artwork from the same game installation. */
export function sourceCharacterGuideImageUrls(entry: SourceCharacterGuideEntry): readonly string[] {
  return [sourceCharacterGuideImageUrl(entry),
    ...(entry.fallbackAssets ?? []).map(sourceCharacterGuideAssetUrl)];
}
