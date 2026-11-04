import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";

const ORIGIN = "https://pokemon-z-battle-cloud-save.mimidu33-eb.workers.dev";
const LATEST = `${ORIGIN}/api/resources/packs/bgm/latest`;
const CHUNK_BYTES = 4 * 1024 * 1024;
const hashPattern = /^[a-f0-9]{64}$/;

interface BgmFile {
  readonly path: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly objectKey: string;
}
export interface BgmPack {
  readonly schemaVersion: "1.0.0";
  readonly packId: "bgm";
  readonly version: string;
  readonly totalBytes: number;
  readonly files: readonly BgmFile[];
}
interface NativeBgmPack {
  status(): Promise<{ version: string; ready: boolean; online: boolean }>;
  missingObjects(options: { manifest: string }): Promise<{ missing: string[] }>;
  installChunk(options: { sha256: string; sizeBytes: number; offset: number; base64: string }): Promise<void>;
  activate(options: { manifest: string }): Promise<{ count: number }>;
}
const nativePack = registerPlugin<NativeBgmPack>("BgmPack");

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseBgmPack(value: unknown): BgmPack | null {
  if (!record(value) || value.schemaVersion !== "1.0.0" || value.packId !== "bgm"
    || typeof value.version !== "string" || !hashPattern.test(value.version)
    || !Number.isSafeInteger(value.totalBytes) || !Array.isArray(value.files)
    || value.files.length < 1 || value.files.length > 500) return null;
  let total = 0;
  const paths = new Set<string>();
  for (const raw of value.files) {
    if (!record(raw) || typeof raw.path !== "string"
      || !/^Audio\/BGM\/[A-Za-z0-9_ -]+\.(ogg|mp3)$/.test(raw.path)
      || paths.has(raw.path) || typeof raw.sha256 !== "string" || !hashPattern.test(raw.sha256)
      || !Number.isSafeInteger(raw.sizeBytes) || Number(raw.sizeBytes) < 1 || Number(raw.sizeBytes) > 16_777_216
      || raw.objectKey !== `resources/audio/sha256/${raw.sha256.slice(0, 2)}/${raw.sha256}.bin`) return null;
    paths.add(raw.path);
    total += Number(raw.sizeBytes);
  }
  return total === value.totalBytes ? value as unknown as BgmPack : null;
}

export type BgmInstallResult = "installed" | "current" | "not-published" | "login-required" | "non-android";

export function isBgmLoginResponse(status: number, headers: Record<string, string>, data: unknown): boolean {
  if ([401, 403, 302].includes(status)) return true;
  const contentType = Object.entries(headers).find(([name]) => name.toLowerCase() === "content-type")?.[1];
  return status === 200 && (contentType?.toLowerCase().includes("text/html") === true
    || typeof data === "string" && /^\s*<(?:!doctype|html)\b/iu.test(data));
}

export async function installedBgmPackVersion(): Promise<string | null> {
  if (Capacitor.getPlatform() !== "android") return null;
  try {
    const status = await nativePack.status();
    return status.ready && hashPattern.test(status.version) ? status.version : null;
  } catch { return null; }
}

export async function androidBgmPackAvailability(): Promise<{ ready: boolean; online: boolean }> {
  if (Capacitor.getPlatform() !== "android") return { ready: true, online: navigator.onLine };
  const required = await bgmPackRequiredForAndroid();
  if (!required) return { ready: true, online: navigator.onLine };
  const status = await nativePack.status();
  return { ready: status.ready && hashPattern.test(status.version), online: status.online };
}

let layoutPromise: Promise<boolean> | null = null;
export function parseBgmPackRequirement(value: unknown): boolean {
  if (!record(value) || value.schemaVersion !== "1.0.0") throw new Error("Disposition des musiques invalide.");
  if (value.bgmBundled === undefined) return false;
  if (typeof value.bgmBundled !== "boolean") throw new Error("Disposition des musiques invalide.");
  return !value.bgmBundled;
}
/** Older full APKs have no bgmBundled flag; only the slim profile requires the pack. */
export function bgmPackRequiredForAndroid(): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android") return Promise.resolve(false);
  layoutPromise ??= fetch("/__pokemon-z/data/android-resource-layout.json")
    .then(async (response) => {
      if (!response.ok) throw new Error("Disposition des musiques indisponible.");
      return parseBgmPackRequirement(await response.json());
    }).catch((error: unknown) => { layoutPromise = null; throw error; });
  return layoutPromise;
}

/** A failed object remains absent; already verified files are reused on retry. */
export async function installBgmPack(onProgress: (done: number, total: number) => void): Promise<BgmInstallResult> {
  if (Capacitor.getPlatform() !== "android") return "non-android";
  const response = await CapacitorHttp.get({ url: LATEST, connectTimeout: 10_000, readTimeout: 20_000 });
  if (response.status === 204) return "not-published";
  if (isBgmLoginResponse(response.status, response.headers ?? {}, response.data)) return "login-required";
  const pack = response.status === 200 ? parseBgmPack(response.data) : null;
  if (pack === null) throw new Error("Manifeste des musiques indisponible ou invalide.");
  const manifest = JSON.stringify(pack);
  const missing = (await nativePack.missingObjects({ manifest })).missing;
  if (!Array.isArray(missing) || missing.some((hash) => typeof hash !== "string" || !hashPattern.test(hash))) {
    throw new Error("Inventaire local des musiques invalide.");
  }
  if (missing.length === 0 && (await installedBgmPackVersion()) === pack.version) return "current";
  const byHash = new Map(pack.files.map((file) => [file.sha256, file]));
  onProgress(0, missing.length);
  for (let index = 0; index < missing.length; index++) {
    const hash = missing[index]!;
    const file = byHash.get(hash);
    if (file === undefined) throw new Error("Musique absente du manifeste.");
    for (let offset = 0; offset < file.sizeBytes; offset += CHUNK_BYTES) {
      const end = Math.min(file.sizeBytes, offset + CHUNK_BYTES) - 1;
      const object = await CapacitorHttp.get({ url: `${ORIGIN}/api/resources/audio/${hash}`,
        headers: { Range: `bytes=${offset}-${end}` }, responseType: "blob",
        connectTimeout: 15_000, readTimeout: 45_000 });
      if ([401, 403, 302].includes(object.status)) return "login-required";
      if (object.status !== 206 || typeof object.data !== "string") {
        throw new Error(`Musique indisponible : ${file.path}.`);
      }
      await nativePack.installChunk({ sha256: hash, sizeBytes: file.sizeBytes, offset, base64: object.data });
    }
    onProgress(index + 1, missing.length);
  }
  await nativePack.activate({ manifest });
  return "installed";
}
