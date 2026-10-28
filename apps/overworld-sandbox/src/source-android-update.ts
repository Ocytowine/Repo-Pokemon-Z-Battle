import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { InAppBrowser } from "@capacitor/inappbrowser";
import installedVersion from "../android-version.json" with { type: "json" };

const UPDATE_ORIGIN = "https://pokemon-z-battle-cloud-save.mimidu33-eb.workers.dev";
const UPDATE_URL = `${UPDATE_ORIGIN}/api/updates/latest`;

export interface SourceAndroidUpdate {
  readonly versionCode: number;
  readonly versionName: string;
  readonly notes: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly downloadUrl: string;
}

export type SourceAndroidUpdateResult =
  | { readonly state: "available"; readonly update: SourceAndroidUpdate }
  | { readonly state: "current" | "not-published" | "login-required" | "unavailable" | "non-android" };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSourceAndroidUpdate(value: unknown): SourceAndroidUpdate | null {
  if (!record(value) || !Number.isSafeInteger(value.versionCode) || Number(value.versionCode) <= 0
    || typeof value.versionName !== "string" || value.versionName.length > 40
    || typeof value.notes !== "string" || value.notes.length > 2_000
    || !Number.isSafeInteger(value.sizeBytes) || Number(value.sizeBytes) <= 0
    || typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256)
    || typeof value.downloadUrl !== "string") return null;
  try {
    const url = new URL(value.downloadUrl);
    if (url.origin !== UPDATE_ORIGIN || url.pathname !== `/api/updates/download/${value.versionCode}`
      || url.search || url.hash) return null;
  } catch { return null; }
  return value as unknown as SourceAndroidUpdate;
}

export function resolveSourceAndroidUpdate(value: unknown, currentCode: number): SourceAndroidUpdateResult {
  const update = parseSourceAndroidUpdate(value);
  if (update === null) return { state: "unavailable" };
  return update.versionCode > currentCode ? { state: "available", update } : { state: "current" };
}

export function installedSourceAndroidVersion(): string {
  return `${installedVersion.versionName} (${installedVersion.versionCode})`;
}

export async function checkSourceAndroidUpdate(): Promise<SourceAndroidUpdateResult> {
  if (Capacitor.getPlatform() !== "android") return { state: "non-android" };
  try {
    const response = await CapacitorHttp.get({ url: UPDATE_URL, connectTimeout: 8_000,
      readTimeout: 8_000, headers: { "Cache-Control": "no-cache" } });
    if (response.status === 204) return { state: "not-published" };
    if (response.status === 401 || response.status === 403 || response.status === 302
      || typeof response.data === "string") return { state: "login-required" };
    if (response.status !== 200) return { state: "unavailable" };
    return resolveSourceAndroidUpdate(response.data, installedVersion.versionCode);
  } catch { return { state: "unavailable" }; }
}

export async function openSourceAndroidUpdate(update: SourceAndroidUpdate): Promise<void> {
  if (parseSourceAndroidUpdate(update) === null) throw new Error("Lien de mise à jour invalide.");
  await InAppBrowser.openInExternalBrowser({ url: update.downloadUrl });
}
