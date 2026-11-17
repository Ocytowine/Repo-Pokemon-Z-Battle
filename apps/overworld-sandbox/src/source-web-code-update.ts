import { Capacitor, CapacitorHttp, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { MOBILE_ORIGIN, mobileAuthorization, mobileToken } from "./source-mobile-account.js";

const LATEST = `${MOBILE_ORIGIN}/api/updates/web/latest`;
const hash = /^[a-f0-9]{64}$/;

export interface WebCodeUpdate {
  readonly version: string;
  readonly payload: string;
  readonly signature: string;
}

interface WebCodePackPlugin {
  status(): Promise<{ readonly version: string }>;
  install(options: { readonly manifest: string; readonly token: string }): Promise<void>;
  healthy(options: { readonly version: string }): Promise<void>;
  rollback(): Promise<void>;
  addListener(eventName: "progress", listener: (value: { readonly done: number;
    readonly total: number }) => void): Promise<PluginListenerHandle>;
}

const native = registerPlugin<WebCodePackPlugin>("WebCodePack");

export function parseWebCodeUpdate(value: unknown): WebCodeUpdate | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.version !== "string" || !hash.test(raw.version)
    || typeof raw.payload !== "string" || raw.payload.length > 64 * 1024
    || typeof raw.signature !== "string" || raw.signature.length < 60 || raw.signature.length > 256) return null;
  try {
    const payload: unknown = JSON.parse(raw.payload);
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)
      || (payload as Record<string, unknown>).schemaVersion !== "1.0.0") return null;
  } catch { return null; }
  return value as WebCodeUpdate;
}

export type WebCodeCheckResult =
  | { readonly state: "available"; readonly update: WebCodeUpdate }
  | { readonly state: "current" | "not-published" | "login-required" | "unavailable" | "non-android" };

export async function installedWebCodeVersion(): Promise<string | null> {
  if (Capacitor.getPlatform() !== "android") return null;
  const version = (await native.status()).version;
  return hash.test(version) ? version : null;
}

export async function checkWebCodeUpdate(): Promise<WebCodeCheckResult> {
  if (Capacitor.getPlatform() !== "android") return { state: "non-android" };
  try {
    const authorization = await mobileAuthorization();
    if (authorization === null) return { state: "login-required" };
    const response = await CapacitorHttp.get({ url: LATEST,
      headers: { Authorization: authorization, "Cache-Control": "no-cache" },
      connectTimeout: 8_000, readTimeout: 8_000 });
    if (response.status === 204) return { state: "not-published" };
    if (response.status === 401 || response.status === 403 || response.status === 302) {
      return { state: "login-required" };
    }
    const update = response.status === 200 ? parseWebCodeUpdate(response.data) : null;
    if (!update) return { state: "unavailable" };
    return (await native.status()).version === update.version ? { state: "current" }
      : { state: "available", update };
  } catch { return { state: "unavailable" }; }
}

export async function installWebCodeUpdate(update: WebCodeUpdate,
  progress?: (done: number, total: number) => void): Promise<"installed" | "login-required"> {
  if (Capacitor.getPlatform() !== "android" || !parseWebCodeUpdate(update)) {
    throw new Error("Mise à jour du code invalide.");
  }
  const token = await mobileToken();
  if (token === null) return "login-required";
  const listener = await native.addListener("progress", ({ done, total }) => progress?.(done, total));
  try { await native.install({ manifest: JSON.stringify(update), token }); }
  finally { await listener.remove(); }
  return "installed";
}

export async function markWebCodeHealthy(): Promise<void> {
  if (Capacitor.getPlatform() !== "android") return;
  const version = (window as Window & { __pzWebCodeVersion?: string }).__pzWebCodeVersion;
  if (version && hash.test(version)) await native.healthy({ version });
}

export async function revertWebCodeUpdate(): Promise<void> {
  if (Capacitor.getPlatform() !== "android") return;
  await native.rollback();
  location.reload();
}
