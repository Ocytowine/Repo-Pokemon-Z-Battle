import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";

export const MOBILE_ORIGIN = "https://pokemon-z-battle-mobile.mimidu33-eb.workers.dev";
const ACCESS_ORIGIN = "https://pokemon-z-battle-cloud-save.mimidu33-eb.workers.dev";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

interface MobileAccountPlugin {
  token(): Promise<{ readonly token: string | null; readonly signedOut: boolean }>;
  store(options: { readonly token: string }): Promise<void>;
  clear(): Promise<void>;
}
const nativeAccount = registerPlugin<MobileAccountPlugin>("MobileAccount");
let bootstrapPromise: Promise<string | null> | null = null;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function bootstrap(): Promise<string | null> {
  const issued = await CapacitorHttp.post({ url: `${ACCESS_ORIGIN}/api/mobile/issue`,
    headers: { "Content-Type": "application/json" }, data: {},
    connectTimeout: 10_000, readTimeout: 10_000 });
  if (issued.status !== 200 || !record(issued.data) || typeof issued.data.code !== "string"
    || !TOKEN_PATTERN.test(issued.data.code)) return null;
  const activated = await CapacitorHttp.post({ url: `${MOBILE_ORIGIN}/api/mobile/activate`,
    headers: { "Content-Type": "application/json" }, data: { code: issued.data.code },
    connectTimeout: 10_000, readTimeout: 10_000 });
  if (activated.status !== 200 || !record(activated.data) || typeof activated.data.token !== "string"
    || !TOKEN_PATTERN.test(activated.data.token)) return null;
  const token = activated.data.token;
  try { await nativeAccount.store({ token }); }
  catch (error) {
    await CapacitorHttp.post({ url: `${MOBILE_ORIGIN}/api/mobile/logout`,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data: {} }).catch(() => undefined);
    throw error;
  }
  return token;
}

async function issueMobileToken(): Promise<string | null> {
  if (bootstrapPromise !== null) return bootstrapPromise;
  bootstrapPromise = bootstrap().finally(() => { bootstrapPromise = null; });
  return bootstrapPromise;
}

/** Auto-migrates an existing Access login once; a manual logout blocks this path. */
export async function mobileToken(): Promise<string | null> {
  if (Capacitor.getPlatform() !== "android") return null;
  const stored = await nativeAccount.token();
  if (typeof stored.token === "string" && TOKEN_PATTERN.test(stored.token)) return stored.token;
  if (stored.signedOut) return null;
  return issueMobileToken();
}

/** Called after the user explicitly opens Cloudflare Access in the app. */
export async function connectMobileAccount(): Promise<string | null> {
  if (Capacitor.getPlatform() !== "android") return null;
  const stored = await nativeAccount.token();
  if (typeof stored.token === "string" && TOKEN_PATTERN.test(stored.token)) {
    const response = await CapacitorHttp.get({ url: `${MOBILE_ORIGIN}/api/mobile/session`,
      headers: { Authorization: `Bearer ${stored.token}` }, connectTimeout: 10_000, readTimeout: 10_000 });
    if (response.status === 200) return stored.token;
    if (response.status !== 401 && response.status !== 403) throw new Error("Session cloud inaccessible.");
    await nativeAccount.clear();
  }
  return issueMobileToken();
}

export async function mobileAuthorization(): Promise<string | null> {
  const token = await mobileToken();
  return token === null ? null : `Bearer ${token}`;
}

export async function mobileIdentity(): Promise<string | null> {
  const authorization = await mobileAuthorization();
  if (authorization === null) return null;
  const response = await CapacitorHttp.get({ url: `${MOBILE_ORIGIN}/api/mobile/session`,
    headers: { Authorization: authorization }, connectTimeout: 10_000, readTimeout: 10_000 });
  if (response.status === 401 || response.status === 403) {
    await nativeAccount.clear();
    return null;
  }
  if (response.status !== 200 || !record(response.data) || response.data.authenticated !== true
    || typeof response.data.email !== "string") throw new Error("Session cloud momentanément indisponible.");
  return response.data.email.trim().toLowerCase();
}

export async function disconnectMobileAccount(): Promise<void> {
  if (Capacitor.getPlatform() !== "android") return;
  const stored = await nativeAccount.token();
  if (typeof stored.token === "string" && TOKEN_PATTERN.test(stored.token)) {
    const response = await CapacitorHttp.post({ url: `${MOBILE_ORIGIN}/api/mobile/logout`,
      headers: { Authorization: `Bearer ${stored.token}`, "Content-Type": "application/json" }, data: {},
      connectTimeout: 10_000, readTimeout: 10_000 });
    if (response.status !== 200 && response.status !== 401) {
      throw new Error("Déconnexion impossible sans réseau. Réessaie plus tard.");
    }
  }
  await nativeAccount.clear();
}
