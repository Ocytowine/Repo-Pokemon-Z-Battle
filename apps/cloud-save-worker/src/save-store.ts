export interface SaveEnv {
  readonly SAVE_DB: D1Database;
  readonly SAVE_BUCKET?: R2Bucket;
}

interface RevisionRow {
  readonly id: string;
  readonly owner_email: string;
  readonly slot_id: number;
  readonly kind: string;
  readonly parent_id: string | null;
  readonly saved_at: number;
  readonly received_at: number;
  readonly byte_size: number;
  readonly payload_json: string | null;
  readonly object_key: string | null;
}

interface HeadRow {
  readonly slot_id: number;
  readonly kind: string;
  readonly revision_id: string;
  readonly saved_at: number;
  readonly received_at: number;
  readonly byte_size: number;
}

export type SaveKind = "manual" | "auto";
export type SaveSlot = 1 | 2;
export const MAX_SAVE_BYTES = 1_500_000;
export const MAX_AUTO_REVISIONS = 30;
// D1 accepts at most 100 bound parameters per query; deletion needs four more.
const AUTO_PRUNE_BATCH_SIZE = 90;

interface PrunableRevision { readonly id: string; readonly object_key: string | null }

/** Keep the current head plus 29 older automatic snapshots; manual history is untouched. */
async function pruneOldAutomaticRevisions(env: SaveEnv, email: string, slot: SaveSlot,
  currentHeadId: string): Promise<void> {
  const old = await env.SAVE_DB.prepare(`SELECT id, object_key FROM save_revisions
    WHERE owner_email = ? AND slot_id = ? AND kind = 'auto' AND id != ?
    ORDER BY received_at DESC, rowid DESC LIMIT ? OFFSET ?`)
    .bind(email, slot, currentHeadId, AUTO_PRUNE_BATCH_SIZE, MAX_AUTO_REVISIONS - 1)
    .all<PrunableRevision>();
  if (old.results.length === 0) return;
  const keys = old.results.flatMap((row) => row.object_key === null ? [] : [row.object_key]);
  if (keys.length > 0) await env.SAVE_BUCKET?.delete(keys);
  const placeholders = old.results.map(() => "?").join(",");
  await env.SAVE_DB.prepare(`DELETE FROM save_revisions
    WHERE owner_email = ? AND slot_id = ? AND kind = 'auto'
      AND id IN (${placeholders})
      AND id NOT IN (SELECT revision_id FROM save_heads
        WHERE owner_email = ? AND slot_id = ? AND kind = 'auto')`)
    .bind(email, slot, ...old.results.map((row) => row.id), email, slot).run();
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
      "x-content-type-options": "nosniff" } });
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validSnapshot(value: unknown): boolean {
  return object(value) && value.schemaVersion === 1 && Number.isSafeInteger(value.savedAt)
    && (value.savedAt as number) > 0 && object(value.eventState)
    && (value.worldSave === null || object(value.worldSave))
    && (value.player === null || object(value.player))
    && (value.newGame === null || object(value.newGame))
    && (value.fieldShortcuts === null || typeof value.fieldShortcuts === "string");
}

export function parseSavePath(pathname: string): { slot: SaveSlot; kind: SaveKind } | null {
  const match = /^\/api\/saves\/([12])\/(manual|auto)$/.exec(pathname);
  return match ? { slot: Number(match[1]) as SaveSlot, kind: match[2] as SaveKind } : null;
}

export function revisionMatches(expected: string | null, current: string | null): boolean {
  return expected === current;
}

async function limitedBody(request: Request): Promise<string | null> {
  const length = Number(request.headers.get("content-length"));
  if (length > MAX_SAVE_BYTES || request.body === null) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > MAX_SAVE_BYTES) { await reader.cancel(); return null; }
      chunks.push(result.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

function publicHead(row: HeadRow) {
  return { slotId: row.slot_id, kind: row.kind, revisionId: row.revision_id,
    savedAt: row.saved_at, receivedAt: row.received_at, byteSize: row.byte_size };
}

async function readHead(env: SaveEnv, email: string, slot: SaveSlot, kind: SaveKind): Promise<HeadRow | null> {
  return env.SAVE_DB.prepare(`SELECT h.slot_id, h.kind, h.revision_id, r.saved_at, r.received_at, r.byte_size
    FROM save_heads h JOIN save_revisions r ON r.id = h.revision_id
    WHERE h.owner_email = ? AND h.slot_id = ? AND h.kind = ?`)
    .bind(email, slot, kind).first<HeadRow>();
}

async function readSnapshot(env: SaveEnv, row: RevisionRow): Promise<unknown> {
  const raw = row.payload_json ?? await env.SAVE_BUCKET?.get(row.object_key!)?.then((value) => value?.text());
  if (!raw) throw new Error("save_payload_missing");
  return JSON.parse(raw) as unknown;
}

export async function handleSaveRequest(request: Request, env: SaveEnv, email: string): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/saves") {
    const rows = await env.SAVE_DB.prepare(`SELECT h.slot_id, h.kind, h.revision_id, r.saved_at,
      r.received_at, r.byte_size FROM save_heads h JOIN save_revisions r ON r.id = h.revision_id
      WHERE h.owner_email = ? ORDER BY h.slot_id, h.kind`).bind(email).all<HeadRow>();
    return json({ heads: rows.results.map(publicHead) });
  }
  const path = parseSavePath(url.pathname);
  if (path === null) return json({ error: "not_found" }, 404);
  const { slot, kind } = path;
  if (request.method === "GET") {
    const head = await readHead(env, email, slot, kind);
    if (head === null) return json({ error: "save_not_found" }, 404);
    const row = await env.SAVE_DB.prepare(`SELECT * FROM save_revisions
      WHERE id = ? AND owner_email = ? AND slot_id = ? AND kind = ?`)
      .bind(head.revision_id, email, slot, kind).first<RevisionRow>();
    if (row === null) return json({ error: "save_unavailable" }, 503);
    return json({ head: publicHead(head), snapshot: await readSnapshot(env, row) });
  }
  if (request.method !== "PUT") return json({ error: "method_not_allowed" }, 405);
  const body = await limitedBody(request);
  if (body === null) return json({ error: "save_too_large" }, 413);
  let input: unknown;
  try { input = JSON.parse(body) as unknown; } catch { return json({ error: "invalid_json" }, 400); }
  if (!object(input) || !validSnapshot(input.snapshot)
    || input.expectedRevisionId !== null && (typeof input.expectedRevisionId !== "string"
      || !/^[a-f0-9-]{36}$/.test(input.expectedRevisionId))) {
    return json({ error: "invalid_save" }, 400);
  }
  const expected = input.expectedRevisionId as string | null;
  const current = await readHead(env, email, slot, kind);
  if (!revisionMatches(expected, current?.revision_id ?? null)) {
    return json({ error: "conflict", head: current && publicHead(current) }, 409);
  }
  const snapshotJson = JSON.stringify(input.snapshot);
  const byteSize = new TextEncoder().encode(snapshotJson).byteLength;
  if (byteSize > MAX_SAVE_BYTES) return json({ error: "save_too_large" }, 413);
  const id = crypto.randomUUID();
  const now = Date.now();
  const objectKey = env.SAVE_BUCKET ? `revisions/${id}.json` : null;
  if (objectKey !== null) await env.SAVE_BUCKET!.put(objectKey, snapshotJson,
    { httpMetadata: { contentType: "application/json" } });
  try {
    await env.SAVE_DB.prepare(`INSERT INTO save_revisions
      (id, owner_email, slot_id, kind, parent_id, saved_at, received_at, byte_size, payload_json, object_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, email, slot, kind, expected, (input.snapshot as { savedAt: number }).savedAt,
        now, byteSize, objectKey === null ? snapshotJson : null, objectKey).run();
    const result = expected === null
      ? await env.SAVE_DB.prepare(`INSERT OR IGNORE INTO save_heads
        (owner_email, slot_id, kind, revision_id, updated_at) VALUES (?, ?, ?, ?, ?)`)
        .bind(email, slot, kind, id, now).run()
      : await env.SAVE_DB.prepare(`UPDATE save_heads SET revision_id = ?, updated_at = ?
        WHERE owner_email = ? AND slot_id = ? AND kind = ? AND revision_id = ?`)
        .bind(id, now, email, slot, kind, expected).run();
    if (result.meta.changes === 1) {
      if (kind === "auto") {
        try { await pruneOldAutomaticRevisions(env, email, slot, id); }
        catch (error) { console.error("Automatic save pruning failed; current head retained", error); }
      }
      return json({ head: { slotId: slot, kind, revisionId: id,
        savedAt: (input.snapshot as { savedAt: number }).savedAt, receivedAt: now, byteSize } }, 201);
    }
    await env.SAVE_DB.prepare("DELETE FROM save_revisions WHERE id = ?").bind(id).run();
    if (objectKey !== null) await env.SAVE_BUCKET!.delete(objectKey);
    const winner = await readHead(env, email, slot, kind);
    return json({ error: "conflict", head: winner && publicHead(winner) }, 409);
  } catch (error) {
    await env.SAVE_DB.prepare("DELETE FROM save_revisions WHERE id = ?").bind(id).run().catch(() => undefined);
    if (objectKey !== null) await env.SAVE_BUCKET!.delete(objectKey).catch(() => undefined);
    throw error;
  }
}
