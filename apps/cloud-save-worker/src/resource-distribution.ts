import type { SaveEnv } from "./save-store.js";

const PACK_KEY = "resources/packs/battlebacks-wide/latest.json";
const BGM_PACK_KEY = "resources/packs/bgm/latest.json";
const objectKey = (sha256: string): string => `resources/sha256/${sha256.slice(0, 2)}/${sha256}.png`;
const audioObjectKey = (sha256: string): string => `resources/audio/sha256/${sha256.slice(0, 2)}/${sha256}.bin`;
const hashPattern = /^[a-f0-9]{64}$/;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validWideBattlebackPack(value: unknown): boolean {
  if (!record(value) || value.schemaVersion !== "1.0.0" || value.packId !== "battlebacks-wide"
    || typeof value.version !== "string" || !hashPattern.test(value.version)
    || !Number.isSafeInteger(value.totalBytes) || !Array.isArray(value.files)
    || value.files.length < 1 || value.files.length > 200) return false;
  let total = 0;
  const paths = new Set<string>();
  for (const raw of value.files) {
    if (!record(raw) || typeof raw.path !== "string"
      || !/^Graphics\/Battlebacks\/battlebg[A-Za-z0-9_-]+Z\.png$/.test(raw.path)
      || paths.has(raw.path) || typeof raw.sha256 !== "string" || !hashPattern.test(raw.sha256)
      || !Number.isSafeInteger(raw.sizeBytes) || Number(raw.sizeBytes) < 1 || Number(raw.sizeBytes) > 8_388_608
      || raw.objectKey !== objectKey(raw.sha256)) return false;
    paths.add(raw.path);
    total += Number(raw.sizeBytes);
  }
  return total === value.totalBytes;
}

export function validBgmPack(value: unknown): boolean {
  if (!record(value) || value.schemaVersion !== "1.0.0" || value.packId !== "bgm"
    || typeof value.version !== "string" || !hashPattern.test(value.version)
    || !Number.isSafeInteger(value.totalBytes) || !Array.isArray(value.files)
    || value.files.length < 1 || value.files.length > 500) return false;
  let total = 0;
  const paths = new Set<string>();
  for (const raw of value.files) {
    if (!record(raw) || typeof raw.path !== "string"
      || !/^Audio\/BGM\/[A-Za-z0-9_ -]+\.(ogg|mp3)$/.test(raw.path)
      || paths.has(raw.path) || typeof raw.sha256 !== "string" || !hashPattern.test(raw.sha256)
      || !Number.isSafeInteger(raw.sizeBytes) || Number(raw.sizeBytes) < 1 || Number(raw.sizeBytes) > 16_777_216
      || raw.objectKey !== audioObjectKey(raw.sha256)) return false;
    paths.add(raw.path);
    total += Number(raw.sizeBytes);
  }
  return total === value.totalBytes;
}

/** The main Worker checks Cloudflare Access before entering this route. */
export async function handleResourceRequest(request: Request, env: SaveEnv): Promise<Response> {
  const headers = new Headers({ "cache-control": "private, no-store", "x-content-type-options": "nosniff" });
  if (request.method !== "GET") return new Response(null, { status: 405, headers });
  const path = new URL(request.url).pathname;
  if (path === "/api/resources/packs/battlebacks-wide/latest") {
    const object = await env.SAVE_BUCKET?.get(PACK_KEY);
    if (!object) return new Response(null, { status: 204, headers });
    let manifest: unknown;
    try { manifest = await object.json(); } catch { return new Response(null, { status: 503, headers }); }
    if (!validWideBattlebackPack(manifest)) return new Response(null, { status: 503, headers });
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(manifest), { status: 200, headers });
  }
  if (path === "/api/resources/packs/bgm/latest") {
    const object = await env.SAVE_BUCKET?.get(BGM_PACK_KEY);
    if (!object) return new Response(null, { status: 204, headers });
    let manifest: unknown;
    try { manifest = await object.json(); } catch { return new Response(null, { status: 503, headers }); }
    if (!validBgmPack(manifest)) return new Response(null, { status: 503, headers });
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(manifest), { status: 200, headers });
  }
  const audioMatch = /^\/api\/resources\/audio\/([a-f0-9]{64})$/.exec(path);
  if (audioMatch) {
    const key = audioObjectKey(audioMatch[1]);
    const object = await env.SAVE_BUCKET?.head(key);
    if (!object || object.size < 1 || object.size > 16_777_216) return new Response(null, { status: 404, headers });
    const rangeHeader = request.headers.get("range");
    const range = /^bytes=(\d+)-(\d+)$/.exec(rangeHeader ?? "");
    if (rangeHeader !== null && range === null) return new Response(null, { status: 416, headers });
    const start = range ? Number(range[1]) : 0;
    const end = range ? Number(range[2]) : object.size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end
      || end >= object.size || end - start + 1 > 4 * 1024 * 1024) return new Response(null, { status: 416, headers });
    const part = await env.SAVE_BUCKET?.get(key, { range: { offset: start, length: end - start + 1 } });
    if (!part || !("body" in part)) return new Response(null, { status: 404, headers });
    headers.set("content-type", "application/octet-stream");
    headers.set("accept-ranges", "bytes");
    headers.set("content-length", String(end - start + 1));
    if (range) headers.set("content-range", `bytes ${start}-${end}/${object.size}`);
    return new Response(part.body, { status: range ? 206 : 200, headers });
  }
  const match = /^\/api\/resources\/objects\/([a-f0-9]{64})$/.exec(path);
  if (!match) return new Response(null, { status: 404, headers });
  const object = await env.SAVE_BUCKET?.get(objectKey(match[1]));
  if (!object || !("body" in object)) return new Response(null, { status: 404, headers });
  headers.set("content-type", "image/png");
  headers.set("content-length", String(object.size));
  return new Response(object.body, { status: 200, headers });
}
