import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";

const ORIGIN = "https://pokemon-z-battle-cloud-save.mimidu33-eb.workers.dev";
const LATEST = `${ORIGIN}/api/resources/packs/battlebacks-wide/latest`;

interface WideBattlebackFile {
  readonly path: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly objectKey: string;
}

export interface WideBattlebackPack {
  readonly schemaVersion: "1.0.0";
  readonly packId: "battlebacks-wide";
  readonly version: string;
  readonly totalBytes: number;
  readonly files: readonly WideBattlebackFile[];
}

interface NativeResourcePack {
  status(): Promise<{ version: string }>;
  missingObjects(options: { manifest: string }): Promise<{ missing: string[] }>;
  installObject(options: { sha256: string; sizeBytes: number; base64: string }): Promise<void>;
  activate(options: { manifest: string }): Promise<{ count: number }>;
}

const nativePack = registerPlugin<NativeResourcePack>("ResourcePack");
const hashPattern = /^[a-f0-9]{64}$/;
interface AndroidResourceLayout {
  readonly bundled: boolean;
  readonly version: string | null;
  readonly retained: readonly string[];
}
let resourceLayout: Promise<AndroidResourceLayout> | null = null;

async function androidResourceLayout(): Promise<AndroidResourceLayout> {
  resourceLayout ??= fetch("/__pokemon-z/data/android-resource-layout.json")
    .then(async (response) => {
      if (!response.ok) throw new Error("Disposition des ressources Android absente.");
      const value: unknown = await response.json();
      if (!record(value) || value.schemaVersion !== "1.0.0"
        || typeof value.wideBattlebacksBundled !== "boolean") throw new Error("Disposition des ressources Android invalide.");
      return { bundled: value.wideBattlebacksBundled,
        version: typeof value.wideBattlebacksPackVersion === "string" && hashPattern.test(value.wideBattlebacksPackVersion)
          ? value.wideBattlebacksPackVersion : null,
        retained: Array.isArray(value.bundledWideBattlebacks)
          ? value.bundledWideBattlebacks.filter((path): path is string =>
            typeof path === "string" && /^Graphics\/Battlebacks\/battlebg[A-Za-z0-9_-]+Z\.png$/.test(path)) : [] };
    }).catch(() => ({ bundled: false, version: null, retained: [] }));
  return resourceLayout;
}

/** On a slim APK, use only bundled backgrounds until the exact pack is active. */
export async function wideBattlebackAvailability(): Promise<(path: string) => boolean> {
  if (Capacitor.getPlatform() !== "android") return () => true;
  const layout = await androidResourceLayout();
  if (layout.bundled) return () => true;
  if (layout.version !== null) {
    try { if ((await nativePack.status()).version === layout.version) return () => true; }
    catch { /* Use only the retained startup backgrounds. */ }
  }
  const retained = new Set(layout.retained);
  return (path) => retained.has(path);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseWideBattlebackPack(value: unknown): WideBattlebackPack | null {
  if (!record(value) || value.schemaVersion !== "1.0.0" || value.packId !== "battlebacks-wide"
    || typeof value.version !== "string" || !hashPattern.test(value.version)
    || !Number.isSafeInteger(value.totalBytes) || !Array.isArray(value.files)
    || value.files.length < 1 || value.files.length > 200) return null;
  let total = 0;
  const paths = new Set<string>();
  for (const raw of value.files) {
    if (!record(raw) || typeof raw.path !== "string"
      || !/^Graphics\/Battlebacks\/battlebg[A-Za-z0-9_-]+Z\.png$/.test(raw.path)
      || paths.has(raw.path) || typeof raw.sha256 !== "string" || !hashPattern.test(raw.sha256)
      || !Number.isSafeInteger(raw.sizeBytes) || Number(raw.sizeBytes) < 1 || Number(raw.sizeBytes) > 8_388_608
      || raw.objectKey !== `resources/sha256/${raw.sha256.slice(0, 2)}/${raw.sha256}.png`) return null;
    paths.add(raw.path);
    total += Number(raw.sizeBytes);
  }
  return total === value.totalBytes ? value as unknown as WideBattlebackPack : null;
}

export type WideBattlebackInstallResult = "installed" | "current" | "not-published" | "login-required" | "non-android";

export async function installedWideBattlebackPackVersion(): Promise<string | null> {
  if (Capacitor.getPlatform() !== "android") return null;
  const version = (await nativePack.status()).version;
  return hashPattern.test(version) ? version : null;
}

/** Downloads only absent immutable objects, then atomically activates the verified pack. */
export async function installWideBattlebackPack(onProgress: (done: number, total: number) => void): Promise<WideBattlebackInstallResult> {
  if (Capacitor.getPlatform() !== "android") return "non-android";
  const response = await CapacitorHttp.get({ url: LATEST, connectTimeout: 10_000, readTimeout: 20_000 });
  if (response.status === 204) return "not-published";
  if (response.status === 401 || response.status === 403 || response.status === 302) return "login-required";
  const pack = response.status === 200 ? parseWideBattlebackPack(response.data) : null;
  if (pack === null) throw new Error("Manifeste des fonds indisponible ou invalide.");
  const manifest = JSON.stringify(pack);
  const missing = (await nativePack.missingObjects({ manifest })).missing;
  if (!Array.isArray(missing) || missing.some((hash) => typeof hash !== "string" || !hashPattern.test(hash))) {
    throw new Error("Inventaire local des fonds invalide.");
  }
  if (missing.length === 0 && (await nativePack.status()).version === pack.version) return "current";
  const byHash = new Map(pack.files.map((file) => [file.sha256, file]));
  onProgress(0, missing.length);
  for (let index = 0; index < missing.length; index++) {
    const hash = missing[index]!;
    const file = byHash.get(hash);
    if (file === undefined) throw new Error("Objet absent du manifeste.");
    const object = await CapacitorHttp.get({ url: `${ORIGIN}/api/resources/objects/${hash}`,
      responseType: "blob", connectTimeout: 15_000, readTimeout: 45_000 });
    if (object.status === 401 || object.status === 403 || object.status === 302) return "login-required";
    if (object.status !== 200 || typeof object.data !== "string") throw new Error(`Fond indisponible : ${file.path}.`);
    await nativePack.installObject({ sha256: hash, sizeBytes: file.sizeBytes, base64: object.data });
    onProgress(index + 1, missing.length);
  }
  await nativePack.activate({ manifest });
  return "installed";
}
