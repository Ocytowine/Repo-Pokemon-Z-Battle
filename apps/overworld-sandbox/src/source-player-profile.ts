import { loadRecoloredAvatarCanvas } from "@pokemon-z-battle/local-assets";
import type { PlayerAvatarSelection } from "@pokemon-z-battle/player-state";

type OverworldContext = "overworld" | "bicycle" | "surf" | "run" | "dive" | "fish" | "fishSurf";
interface AssetReference { readonly path: string | null }
interface AvatarRecord {
  readonly id: string;
  readonly presentation: "masculine" | "feminine";
  readonly assets: Readonly<Record<OverworldContext | "battleFront" | "battleBack", AssetReference>>;
  readonly overworldPoses: readonly string[];
}
interface AvatarCatalog { readonly records: readonly AvatarRecord[] }

export interface SourcePlayerVisuals {
  readonly selection: PlayerAvatarSelection;
  readonly overworld: HTMLImageElement;
  readonly pickup: HTMLImageElement;
  readonly battleFront: HTMLImageElement;
  readonly battleBack: HTMLImageElement;
  readonly bySourceName: ReadonlyMap<string, HTMLImageElement>;
}

const OVERWORLD_CONTEXTS: readonly OverworldContext[] = ["overworld", "bicycle", "surf", "run", "dive", "fish", "fishSurf"];

function sourceUrl(path: string): string {
  return `/__pokemon-z/source/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function sourceCharacterAssetName(path: string): string {
  return path.replaceAll("\\", "/").split("/").at(-1)?.replace(/\.[^.]+$/u, "") ?? "";
}

async function imageFromCanvas(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  const image = new Image(); image.src = canvas.toDataURL(); await image.decode(); return image;
}

async function recoloredImage(path: string, comparisonPaths: readonly string[], selection: PlayerAvatarSelection): Promise<HTMLImageElement> {
  return imageFromCanvas(await loadRecoloredAvatarCanvas(sourceUrl(path), comparisonPaths.map(sourceUrl), selection.profile.colors));
}

async function catalog(): Promise<AvatarCatalog> {
  const response = await fetch("/__pokemon-z/data/player-avatars.json");
  if (!response.ok) throw new Error("Catalogue des personnages indisponible.");
  return response.json() as Promise<AvatarCatalog>;
}

export async function loadSourcePlayerVisuals(selection: PlayerAvatarSelection): Promise<SourcePlayerVisuals> {
  const avatarCatalog = await catalog();
  const selected = avatarCatalog.records.find((record) => record.id === selection.avatarId);
  if (selected === undefined) throw new Error(`Profil visuel absent : ${selection.avatarId}.`);
  const siblings = avatarCatalog.records.filter((record) => record.presentation === selected.presentation && record.id !== selected.id);
  const bySourceName = new Map<string, HTMLImageElement>();
  const loadedByPath = new Map<string, Promise<HTMLImageElement>>();
  const load = (path: string, comparisons: readonly (string | null | undefined)[]): Promise<HTMLImageElement> => {
    let pending = loadedByPath.get(path);
    if (pending === undefined) {
      pending = recoloredImage(path, comparisons.filter((candidate): candidate is string => typeof candidate === "string"), selection);
      loadedByPath.set(path, pending);
    }
    return pending;
  };

  for (const context of OVERWORLD_CONTEXTS) {
    const target = selected.assets[context].path; if (target === null) continue;
    const image = await load(target, siblings.map((record) => record.assets[context].path));
    for (const record of avatarCatalog.records) {
      const alias = record.assets[context].path; if (alias !== null) bySourceName.set(sourceCharacterAssetName(alias), image);
    }
  }
  for (let index = 0; index < selected.overworldPoses.length; index += 1) {
    const target = selected.overworldPoses[index]; if (target === undefined) continue;
    const image = await load(target, siblings.map((record) => record.overworldPoses[index]));
    for (const record of avatarCatalog.records) {
      const alias = record.overworldPoses[index]; if (alias !== undefined) bySourceName.set(sourceCharacterAssetName(alias), image);
    }
  }
  const battleFrontPath = selected.assets.battleFront.path; const battleBackPath = selected.assets.battleBack.path;
  if (battleFrontPath === null || battleBackPath === null || selected.assets.overworld.path === null) {
    throw new Error(`Profil visuel incomplet : ${selection.avatarId}.`);
  }
  const [overworld, battleFront, battleBack] = await Promise.all([
    load(selected.assets.overworld.path, siblings.map((record) => record.assets.overworld.path)),
    load(battleFrontPath, siblings.map((record) => record.assets.battleFront.path)),
    load(battleBackPath, siblings.map((record) => record.assets.battleBack.path)),
  ]);
  bySourceName.set("player", overworld);
  const firstPose = selected.overworldPoses[0];
  const pickup = bySourceName.get("trchar000_2") ?? (firstPose === undefined ? overworld
    : await load(firstPose, siblings.map((record) => record.overworldPoses[0])));
  return { selection, overworld, pickup, battleFront, battleBack, bySourceName };
}

export function sourcePlayerImageFor(visuals: SourcePlayerVisuals | null, sourceName: string): HTMLImageElement | null {
  if (visuals === null) return null;
  return visuals.bySourceName.get(sourceName) ?? (/^trchar\d{3}$/u.test(sourceName) ? visuals.overworld : null);
}

export function sourcePlayerImageForMovement(visuals: SourcePlayerVisuals | null,
  mode: "walk" | "run" | "mount" | "surf" | "dive"): HTMLImageElement | null {
  if (visuals === null) return null;
  const alias = mode === "run" ? "boy_run" : mode === "mount" ? "boy_bike"
    : mode === "surf" ? "boy_surf_offset" : mode === "dive" ? "trchar000" : "player";
  return visuals.bySourceName.get(alias) ?? visuals.overworld;
}
