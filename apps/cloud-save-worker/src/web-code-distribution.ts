import type { SaveEnv } from "./save-store.js";

const MANIFEST = "updates/web/latest.json";
const key = (hash: string): string => `updates/web/sha256/${hash.slice(0, 2)}/${hash}.bin`;
const hashPattern = /^[a-f0-9]{64}$/;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validWebCodeManifest(value: unknown): boolean {
  if (!record(value) || typeof value.version !== "string" || !hashPattern.test(value.version)
    || typeof value.signature !== "string" || value.signature.length < 60 || value.signature.length > 256
    || typeof value.payload !== "string" || value.payload.length > 64 * 1024) return false;
  let payload: unknown;
  try { payload = JSON.parse(value.payload); } catch { return false; }
  if (!record(payload) || payload.schemaVersion !== "1.0.0"
    || !Number.isSafeInteger(payload.nativeVersionCode) || Number(payload.nativeVersionCode) < 1
    || typeof payload.entryScript !== "string" || typeof payload.entryStyle !== "string"
    || !Array.isArray(payload.files) || payload.files.length < 2 || payload.files.length > 200) return false;
  const paths = new Set<string>();
  let total = 0;
  for (const file of payload.files) {
    if (!record(file) || typeof file.path !== "string"
      || !/^assets\/[A-Za-z0-9_.-]+\.(js|css|png|webp|svg|woff|woff2)$/.test(file.path)
      || paths.has(file.path) || typeof file.sha256 !== "string" || !hashPattern.test(file.sha256)
      || !Number.isSafeInteger(file.sizeBytes) || Number(file.sizeBytes) < 1
      || Number(file.sizeBytes) > 8 * 1024 * 1024) return false;
    paths.add(file.path);
    total += Number(file.sizeBytes);
  }
  return total <= 32 * 1024 * 1024 && paths.has(String(payload.entryScript))
    && paths.has(String(payload.entryStyle));
}

/** Routes are called only after Access or the mobile session has authenticated the request. */
export async function handleWebCodeRequest(request: Request, env: SaveEnv): Promise<Response> {
  const headers = new Headers({ "cache-control": "private, no-store", "x-content-type-options": "nosniff" });
  if (request.method !== "GET") return new Response(null, { status: 405, headers });
  const path = new URL(request.url).pathname;
  if (path === "/api/updates/web/latest") {
    const object = await env.SAVE_BUCKET?.get(MANIFEST);
    if (!object) return new Response(null, { status: 204, headers });
    let manifest: unknown;
    try { manifest = await object.json(); } catch { return new Response(null, { status: 503, headers }); }
    if (!validWebCodeManifest(manifest)) return new Response(null, { status: 503, headers });
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(manifest), { status: 200, headers });
  }
  const match = /^\/api\/updates\/web\/objects\/([a-f0-9]{64})$/.exec(path);
  if (!match) return new Response(null, { status: 404, headers });
  const object = await env.SAVE_BUCKET?.get(key(match[1]));
  if (!object || !("body" in object) || object.size < 1 || object.size > 8 * 1024 * 1024) {
    return new Response(null, { status: 404, headers });
  }
  headers.set("content-type", "application/octet-stream");
  headers.set("content-length", String(object.size));
  return new Response(object.body, { status: 200, headers });
}
