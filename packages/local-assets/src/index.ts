export interface LocalDirectoryHandle {
  readonly name: string;
  getDirectoryHandle(name: string): Promise<LocalDirectoryHandle>;
  getFileHandle(name: string): Promise<{ getFile(): Promise<File> }>;
}

export interface PokemonAssetReference {
  readonly pokemonId: number;
  readonly kind: "battler" | "icon" | "footprint" | "cry" | "overworld";
  readonly form: number | null;
  readonly shiny: boolean;
  readonly female: boolean;
  readonly back: boolean;
  readonly variant: string | null;
  readonly path: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly frameCount: number | null;
}

export interface PokemonAssetRecord {
  readonly id: number;
  readonly internalName: string;
  readonly name: string;
  readonly assets: Readonly<Record<PokemonAssetReference["kind"], readonly PokemonAssetReference[]>>;
}

export interface PokemonAssetsManifest {
  readonly schemaVersion: string;
  readonly records: readonly PokemonAssetRecord[];
}

export interface AssetManifestEntry {
  readonly path: string;
  readonly category: string;
  readonly mediaType: "image" | "audio" | "other";
  readonly image: {
    readonly width: number;
    readonly height: number;
    readonly animation: { readonly frameWidth: number; readonly frameHeight: number; readonly frameCount: number } | null;
  } | null;
}

export interface AssetManifest {
  readonly schemaVersion: string;
  readonly records: readonly AssetManifestEntry[];
}

export interface LocalManifests {
  readonly assets: AssetManifest;
  readonly pokemon: PokemonAssetsManifest;
  readonly animations?: BattleAnimationsManifest;
}

export interface BattleAnimationCel {
  readonly slot: number; readonly x: number; readonly y: number;
  readonly zoomX: number; readonly zoomY: number; readonly angle: number;
  readonly mirror: boolean; readonly blendType: number; readonly visible: boolean;
  readonly pattern: number; readonly opacity: number; readonly priority: number; readonly focus: number;
}

export interface BattleAnimationRecord {
  readonly index: number; readonly name: string; readonly graphicPath: string;
  readonly hue: number; readonly position: number;
  readonly frames: readonly (readonly BattleAnimationCel[])[];
  readonly timings: readonly { readonly frame: number; readonly type: number; readonly name: string; readonly volume: number; readonly pitch: number }[];
}

export interface BattleAnimationsManifest {
  readonly schemaVersion: string;
  readonly coordinateSystem: { readonly width: 512; readonly height: 384; readonly cellSize: 192; readonly sheetColumns: 5; readonly framesPerSecond: 20 };
  readonly mappings: readonly { readonly moveId: number; readonly internalName: string; readonly player: number | null; readonly opponent: number | null }[];
  readonly animations: readonly BattleAnimationRecord[];
}

export interface BattleScene {
  readonly id: string;
  readonly name: string;
  readonly background: AssetManifestEntry | null;
  readonly playerBase: AssetManifestEntry | null;
  readonly enemyBase: AssetManifestEntry | null;
  readonly complete: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAssetManifest(value: unknown): value is AssetManifest {
  if (!isRecord(value) || !Array.isArray(value.records)) return false;
  const first = value.records[0] as unknown;
  return isRecord(first) && typeof first.path === "string" && typeof first.category === "string";
}

function isPokemonManifest(value: unknown): value is PokemonAssetsManifest {
  if (!isRecord(value) || !Array.isArray(value.records)) return false;
  const first = value.records[0] as unknown;
  return isRecord(first) && typeof first.id === "number" && isRecord(first.assets);
}

function isAnimationManifest(value: unknown): value is BattleAnimationsManifest {
  return isRecord(value) && isRecord(value.coordinateSystem)
    && value.coordinateSystem.width === 512 && value.coordinateSystem.height === 384
    && Array.isArray(value.mappings) && Array.isArray(value.animations);
}

export async function loadLocalManifests(files: Iterable<File>): Promise<LocalManifests> {
  let assets: AssetManifest | undefined;
  let pokemon: PokemonAssetsManifest | undefined;
  let animations: BattleAnimationsManifest | undefined;
  for (const file of files) {
    let value: unknown;
    try {
      value = JSON.parse(await file.text()) as unknown;
    } catch {
      throw new Error(`${file.name} n'est pas un fichier JSON valide.`);
    }
    if (isAssetManifest(value)) assets = value;
    else if (isPokemonManifest(value)) pokemon = value;
    else if (isAnimationManifest(value)) animations = value;
  }
  if (assets === undefined || pokemon === undefined) {
    throw new Error("Sélectionnez asset-manifest.json et pokemon-assets.json ensemble.");
  }
  return animations === undefined ? { assets, pokemon } : { assets, pokemon, animations };
}

export async function loadLocalManifestsFromUrls(urls: readonly string[]): Promise<LocalManifests> {
  const files = await Promise.all(urls.map(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Manifeste local indisponible : ${url}`);
    const name = url.split("/").at(-1) ?? "manifest.json";
    return new File([await response.blob()], name, { type: "application/json" });
  }));
  return loadLocalManifests(files);
}

export function createHttpDirectoryHandle(baseUrl: string, name = "Pokemon Z automatique"): LocalDirectoryHandle {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const createHandle = (parts: readonly string[]): LocalDirectoryHandle => ({
    name: parts.at(-1) ?? name,
    getDirectoryHandle(directoryName: string): Promise<LocalDirectoryHandle> {
      if (directoryName.length === 0 || directoryName === "." || directoryName === "..") {
        return Promise.reject(new Error(`Dossier local invalide : ${directoryName}`));
      }
      return Promise.resolve(createHandle([...parts, directoryName]));
    },
    async getFileHandle(fileName: string): Promise<{ getFile(): Promise<File> }> {
      if (fileName.length === 0 || fileName === "." || fileName === "..") {
        throw new Error(`Fichier local invalide : ${fileName}`);
      }
      const url = `${normalizedBase}${[...parts, fileName].map(encodeURIComponent).join("/")}`;
      return {
        async getFile(): Promise<File> {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Asset local indisponible : ${url}`);
          const blob = await response.blob();
          return new File([blob], fileName, { type: blob.type });
        },
      };
    },
  });
  return createHandle([]);
}

export async function fileFromLocalPath(root: LocalDirectoryHandle, relativePath: string): Promise<File> {
  const parts = relativePath.replaceAll("\\", "/").split("/").filter((part) => part.length > 0);
  const fileName = parts.pop();
  if (fileName === undefined || parts.some((part) => part === "." || part === "..")) {
    throw new Error(`Chemin d'asset invalide : ${relativePath}`);
  }
  let directory = root;
  for (const part of parts) directory = await directory.getDirectoryHandle(part);
  return (await directory.getFileHandle(fileName)).getFile();
}

export class ObjectUrlStore {
  readonly #urls = new Set<string>();

  async create(root: LocalDirectoryHandle, path: string): Promise<string> {
    const url = URL.createObjectURL(await fileFromLocalPath(root, path));
    this.#urls.add(url);
    return url;
  }

  revoke(url: string): void {
    if (!this.#urls.delete(url)) return;
    URL.revokeObjectURL(url);
  }

  clear(): void {
    for (const url of this.#urls) URL.revokeObjectURL(url);
    this.#urls.clear();
  }
}

type ScenePart = "background" | "playerBase" | "enemyBase";

function sceneIdentity(entry: AssetManifestEntry): { readonly part: ScenePart; readonly key: string } | null {
  if (entry.category.toLowerCase() !== "graphics/battlebacks" || entry.mediaType !== "image") return null;
  const filename = entry.path.replaceAll("\\", "/").split("/").at(-1)?.replace(/\.[^.]+$/u, "") ?? "";
  const match = /^(battlebg|playerbase|enemybase)[\s_-]*(.*)$/iu.exec(filename);
  if (match === null) return null;
  const role = match[1]?.toLowerCase();
  const suffix = (match[2] ?? "").trim();
  const part: ScenePart = role === "battlebg" ? "background" : role === "playerbase" ? "playerBase" : "enemyBase";
  return { part, key: suffix.length === 0 ? "default" : suffix.toLocaleLowerCase("fr") };
}

function displayName(key: string): string {
  if (key === "default") return "Défaut";
  return key.replace(/[_-]+/gu, " ").replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("fr"));
}

export function buildBattleScenes(manifest: AssetManifest): readonly BattleScene[] {
  const groups = new Map<string, { background?: AssetManifestEntry; playerBase?: AssetManifestEntry; enemyBase?: AssetManifestEntry }>();
  for (const entry of manifest.records) {
    const identity = sceneIdentity(entry);
    if (identity === null) continue;
    const group = groups.get(identity.key) ?? {};
    group[identity.part] ??= entry;
    groups.set(identity.key, group);
  }
  return [...groups.entries()].map(([id, group]) => ({
    id,
    name: displayName(id),
    background: group.background ?? null,
    playerBase: group.playerBase ?? null,
    enemyBase: group.enemyBase ?? null,
    complete: group.background !== undefined && group.playerBase !== undefined && group.enemyBase !== undefined,
  })).sort((left, right) => Number(right.complete) - Number(left.complete) || left.name.localeCompare(right.name, "fr"));
}

export function findPokemonRecord(manifest: PokemonAssetsManifest, id: number): PokemonAssetRecord | undefined {
  return manifest.records.find((record) => record.id === id);
}

export function selectBattler(record: PokemonAssetRecord, back: boolean): PokemonAssetReference | null {
  const candidates = record.assets.battler.filter((asset) => asset.back === back && asset.variant === null);
  return candidates.find((asset) => asset.form === null && !asset.shiny && !asset.female)
    ?? candidates.find((asset) => asset.form === null && !asset.shiny)
    ?? candidates[0]
    ?? null;
}

export function selectCry(record: PokemonAssetRecord): PokemonAssetReference | null {
  return record.assets.cry.find((asset) => asset.form === null) ?? record.assets.cry[0] ?? null;
}
