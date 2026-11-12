import { Capacitor, CapacitorHttp, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import installedVersion from "../android-version.json" with { type: "json" };
import { MOBILE_ORIGIN, mobileAuthorization, mobileToken } from "./source-mobile-account.js";

const UPDATE_ORIGIN = MOBILE_ORIGIN;
const UPDATE_URL = `${UPDATE_ORIGIN}/api/updates/latest`;
type InstallResult = "installer-opened" | "permission-required" | "login-required";
interface PrivateApkUpdatePlugin {
  downloadAndInstall(options: { readonly url: string; readonly versionCode: number;
    readonly sizeBytes: number; readonly sha256: string; readonly token: string }): Promise<{ readonly state: InstallResult }>;
  addListener(eventName: "progress", listener: (progress: { readonly done: number;
    readonly total: number }) => void): Promise<PluginListenerHandle>;
}
const privateApkUpdate = registerPlugin<PrivateApkUpdatePlugin>("PrivateApkUpdate");

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
    const authorization = await mobileAuthorization();
    if (authorization === null) return { state: "login-required" };
    const response = await CapacitorHttp.get({ url: UPDATE_URL, connectTimeout: 8_000,
      readTimeout: 8_000, headers: { Authorization: authorization, "Cache-Control": "no-cache" } });
    if (response.status === 204) return { state: "not-published" };
    if (response.status === 401 || response.status === 403 || response.status === 302
      || typeof response.data === "string") return { state: "login-required" };
    if (response.status !== 200) return { state: "unavailable" };
    return resolveSourceAndroidUpdate(response.data, installedVersion.versionCode);
  } catch { return { state: "unavailable" }; }
}

export async function openSourceAndroidUpdate(update: SourceAndroidUpdate,
  report?: (done: number, total: number) => void): Promise<InstallResult> {
  if (parseSourceAndroidUpdate(update) === null) throw new Error("Lien de mise à jour invalide.");
  if (Capacitor.getPlatform() !== "android") throw new Error("Installation disponible dans l'APK Android.");
  const token = await mobileToken();
  if (token === null) return "login-required";
  const listener = await privateApkUpdate.addListener("progress", ({ done, total }) => report?.(done, total));
  try {
    const result = await privateApkUpdate.downloadAndInstall({ url: update.downloadUrl,
      versionCode: update.versionCode, sizeBytes: update.sizeBytes, sha256: update.sha256, token });
    return result.state;
  } finally { await listener.remove(); }
}
