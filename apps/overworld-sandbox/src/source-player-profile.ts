import { AVATAR_FISHING_EQUIPMENT_COLORS, loadRecoloredAvatarCanvas } from "@pokemon-z-battle/local-assets";
import type { PlayerAvatarSelection } from "@pokemon-z-battle/player-state";
import type { Direction } from "@pokemon-z-battle/overworld-engine";

export type SourcePlayerVisualSelection = Pick<PlayerAvatarSelection, "avatarId" | "profile">;

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
  readonly selection: SourcePlayerVisualSelection;
  readonly overworld: HTMLImageElement;
  readonly pickup: HTMLImageElement;
  readonly battleFront: HTMLImageElement;
  readonly battleBack: HTMLImageElement;
  readonly bySourceName: ReadonlyMap<string, HTMLImageElement>;
  readonly runGroundOffsets: readonly (readonly number[])[];
}

const OVERWORLD_CONTEXTS: readonly OverworldContext[] = ["overworld", "bicycle", "surf", "run", "dive", "fish", "fishSurf"];
const SOURCE_DIRECTION_ROW: Readonly<Record<Direction, number>> = { down: 0, left: 1, right: 2, up: 3 };

interface SpritePixels { readonly width: number; readonly height: number; readonly data: Uint8ClampedArray }

function frameBottomPadding(pixels: SpritePixels, row: number, pattern: number): number {
  const frameWidth = pixels.width / 4;
  const frameHeight = pixels.height / 4;
  for (let y = frameHeight - 1; y >= 0; y -= 1) {
    for (let x = 0; x < frameWidth; x += 1) {
      if ((pixels.data[((row * frameHeight + y) * pixels.width + pattern * frameWidth + x) * 4 + 3] ?? 0) > 0) {
        return frameHeight - 1 - y;
      }
    }
  }
  return 0;
}

/** Align each running pose's visible feet with the corresponding walking pose. */
export function sourceRunGroundOffsets(walk: SpritePixels, run: SpritePixels): readonly (readonly number[])[] {
  if (walk.width % 4 !== 0 || walk.height % 4 !== 0 || run.width % 4 !== 0 || run.height % 4 !== 0) {
    return Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  }
  return Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, pattern) =>
    frameBottomPadding(run, row, pattern) - frameBottomPadding(walk, row, pattern)));
}

function spritePixels(image: HTMLImageElement): SpritePixels {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) throw new Error("Canvas de personnage indisponible.");
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

export function sourcePlayerRunGroundOffset(visuals: SourcePlayerVisuals | null,
  direction: Direction, pattern: number): number {
  return visuals?.runGroundOffsets[SOURCE_DIRECTION_ROW[direction]]?.[pattern % 4] ?? 0;
}

function sourceUrl(path: string): string {
  return `/__pokemon-z/source/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function sourceCharacterAssetName(path: string): string {
  return path.replaceAll("\\", "/").split("/").at(-1)?.replace(/\.[^.]+$/u, "") ?? "";
}

async function imageFromCanvas(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  const image = new Image(); image.src = canvas.toDataURL(); await image.decode(); return image;
}

async function recoloredImage(path: string, comparisonPaths: readonly string[], selection: SourcePlayerVisualSelection,
  fishingEquipment = false): Promise<HTMLImageElement> {
  return imageFromCanvas(await loadRecoloredAvatarCanvas(sourceUrl(path), comparisonPaths.map(sourceUrl),
    selection.profile.colors, fishingEquipment ? { protectedColors: AVATAR_FISHING_EQUIPMENT_COLORS } : {}));
}

async function catalog(): Promise<AvatarCatalog> {
  const response = await fetch("/__pokemon-z/data/player-avatars.json");
  if (!response.ok) throw new Error("Catalogue des personnages indisponible.");
  return response.json() as Promise<AvatarCatalog>;
}

export async function loadSourcePlayerVisuals(selection: SourcePlayerVisualSelection): Promise<SourcePlayerVisuals> {
  const avatarCatalog = await catalog();
  const selected = avatarCatalog.records.find((record) => record.id === selection.avatarId);
  if (selected === undefined) throw new Error(`Profil visuel absent : ${selection.avatarId}.`);
  const siblings = avatarCatalog.records.filter((record) => record.presentation === selected.presentation && record.id !== selected.id);
  const bySourceName = new Map<string, HTMLImageElement>();
  const loadedByPath = new Map<string, Promise<HTMLImageElement>>();
  let runImage: HTMLImageElement | null = null;
  const load = (path: string, comparisons: readonly (string | null | undefined)[],
    fishingEquipment = false): Promise<HTMLImageElement> => {
    let pending = loadedByPath.get(path);
    if (pending === undefined) {
      pending = recoloredImage(path, comparisons.filter((candidate): candidate is string => typeof candidate === "string"),
        selection, fishingEquipment);
      loadedByPath.set(path, pending);
    }
    return pending;
  };

  for (const context of OVERWORLD_CONTEXTS) {
    const target = selected.assets[context].path; if (target === null) continue;
    const image = await load(target, siblings.map((record) => record.assets[context].path),
      context === "fish" || context === "fishSurf");
    if (context === "run") runImage = image;
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
  const runGroundOffsets = runImage === null ? Array.from({ length: 4 }, () => [0, 0, 0, 0])
    : sourceRunGroundOffsets(spritePixels(overworld), spritePixels(runImage));
  return { selection, overworld, pickup, battleFront, battleBack, bySourceName, runGroundOffsets };
}

export function sourcePlayerImageFor(visuals: SourcePlayerVisuals | null, sourceName: string): HTMLImageElement | null {
  if (visuals === null) return null;
  return visuals.bySourceName.get(sourceName) ?? (/^trchar\d{3}$/u.test(sourceName) ? visuals.overworld : null);
}

export function sourcePlayerImageForMovement(visuals: SourcePlayerVisuals | null,
  mode: "walk" | "run" | "mount" | "surf" | "dive"): HTMLImageElement | null {
  if (visuals === null) return null;
  const alias = mode === "run" ? "boy_run" : mode === "mount" ? "boy_bike"
    : mode === "surf" ? "boy_surf_offset" : mode === "dive" ? "boy_dive_offset" : "player";
  return visuals.bySourceName.get(alias) ?? visuals.overworld;
}
