import type { SaveEnv } from "./save-store.js";

export interface AndroidUpdateManifest {
  readonly versionCode: number;
  readonly versionName: string;
  readonly notes: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

const MANIFEST_KEY = "updates/android/latest.json";
const apkKey = (code: number): string => `updates/android/pokemon-z-battle-${code}.apk`;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAndroidUpdateManifest(value: unknown): AndroidUpdateManifest | null {
  if (!record(value) || !Number.isSafeInteger(value.versionCode) || Number(value.versionCode) <= 0
    || typeof value.versionName !== "string" || value.versionName.length > 40
    || !/^[0-9]+(?:\.[0-9]+){0,3}(?:[-.][a-zA-Z0-9]+)?$/.test(value.versionName)
    || typeof value.notes !== "string" || value.notes.length > 2_000
    || !Number.isSafeInteger(value.sizeBytes) || Number(value.sizeBytes) <= 0
    || typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256)) return null;
  return value as unknown as AndroidUpdateManifest;
}

function responseHeaders(): Headers {
  return new Headers({ "cache-control": "private, no-store", "x-content-type-options": "nosniff" });
}

async function latestManifest(env: SaveEnv): Promise<AndroidUpdateManifest | null> {
  const raw = await env.SAVE_BUCKET?.get(MANIFEST_KEY);
  if (!raw) return null;
  if (!("body" in raw)) return null;
  try { return parseAndroidUpdateManifest(await raw.json()); }
  catch { return null; }
}

/** Routes are already guarded by Cloudflare Access in the main Worker. */
export async function handleAndroidUpdateRequest(request: Request, env: SaveEnv): Promise<Response> {
  const path = new URL(request.url).pathname;
  const headers = responseHeaders();
  if (request.method !== "GET") return new Response(null, { status: 405, headers });
  const manifest = await latestManifest(env);
  if (manifest === null) return new Response(null, { status: 204, headers });
  if (path === "/api/updates/latest") {
    const object = await env.SAVE_BUCKET?.head(apkKey(manifest.versionCode));
    if (object?.size !== manifest.sizeBytes) return new Response(null, { status: 204, headers });
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(JSON.stringify({ ...manifest,
      downloadUrl: new URL(`/api/updates/download/${manifest.versionCode}`, request.url).href }),
      { status: 200, headers });
  }
  const match = /^\/api\/updates\/download\/(latest|[1-9][0-9]*)$/.exec(path);
  if (!match || match[1] !== "latest" && Number(match[1]) !== manifest.versionCode) {
    return new Response(null, { status: 404, headers });
  }
  const rangeRequested = request.headers.has("range");
  const object = await env.SAVE_BUCKET?.get(apkKey(manifest.versionCode),
    rangeRequested ? { range: request.headers } : undefined);
  if (!object || !("body" in object) || object.size !== manifest.sizeBytes) {
    return new Response(null, { status: 404, headers });
  }
  headers.set("content-type", "application/vnd.android.package-archive");
  headers.set("content-disposition", `attachment; filename="pokemon-z-battle-${manifest.versionCode}.apk"`);
  headers.set("accept-ranges", "bytes");
  headers.set("etag", object.httpEtag);
  if (rangeRequested && object.range) {
    const offset = "suffix" in object.range ? object.size - object.range.suffix
      : object.range.offset ?? 0;
    const length = "suffix" in object.range ? object.range.suffix
      : object.range.length ?? object.size - offset;
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set("content-length", String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("content-length", String(object.size));
  return new Response(object.body, { status: 200, headers });
}
