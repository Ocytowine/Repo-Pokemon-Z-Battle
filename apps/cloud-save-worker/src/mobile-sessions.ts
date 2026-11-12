import type { SaveEnv } from "./save-store.js";

const CODE_LIFETIME_MS = 2 * 60_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
    "x-content-type-options": "nosniff" } });
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Access-protected bootstrap: the email comes only from Cloudflare's verified identity. */
export async function issueMobileLoginCode(env: SaveEnv, email: string): Promise<Response> {
  const code = randomToken();
  const now = Date.now();
  await env.SAVE_DB.prepare("DELETE FROM mobile_login_codes WHERE expires_at < ?")
    .bind(now).run();
  await env.SAVE_DB.prepare("INSERT INTO mobile_login_codes (code_hash, owner_email, expires_at) VALUES (?, ?, ?)")
    .bind(await tokenHash(code), email, now + CODE_LIFETIME_MS).run();
  return json({ code });
}

/** Public endpoint: a high-entropy code is consumed exactly once. */
export async function activateMobileSession(request: Request, env: SaveEnv): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_code" }, 400); }
  const code = typeof body === "object" && body !== null && "code" in body ? body.code : null;
  if (typeof code !== "string" || !TOKEN_PATTERN.test(code)) return json({ error: "invalid_code" }, 400);
  const result = await env.SAVE_DB.prepare(`DELETE FROM mobile_login_codes
    WHERE code_hash = ? AND expires_at > ? RETURNING owner_email`)
    .bind(await tokenHash(code), Date.now()).first<{ owner_email: string }>();
  if (!result) return json({ error: "invalid_code" }, 401);
  const token = randomToken();
  const now = Date.now();
  await env.SAVE_DB.prepare(`INSERT INTO mobile_sessions
    (token_hash, owner_email, created_at, last_seen_at, revoked_at) VALUES (?, ?, ?, ?, NULL)`)
    .bind(await tokenHash(token), result.owner_email, now, now).run();
  return json({ token, email: result.owner_email });
}

export async function authenticatedMobileSession(request: Request, env: SaveEnv): Promise<{
  readonly email: string; readonly tokenHash: string } | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);
  if (!TOKEN_PATTERN.test(token)) return null;
  const hash = await tokenHash(token);
  const row = await env.SAVE_DB.prepare(`SELECT owner_email, last_seen_at FROM mobile_sessions
    WHERE token_hash = ? AND revoked_at IS NULL`).bind(hash)
    .first<{ owner_email: string; last_seen_at: number }>();
  if (!row) return null;
  const now = Date.now();
  if (now - row.last_seen_at > 60 * 60_000) {
    await env.SAVE_DB.prepare("UPDATE mobile_sessions SET last_seen_at = ? WHERE token_hash = ?")
      .bind(now, hash).run();
  }
  return { email: row.owner_email, tokenHash: hash };
}

export async function revokeMobileSession(env: SaveEnv, hash: string): Promise<Response> {
  await env.SAVE_DB.prepare("UPDATE mobile_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL")
    .bind(Date.now(), hash).run();
  return json({ disconnected: true });
}

export const mobileSessionError = (): Response => json({ error: "mobile_session_required" }, 401);
export const mobileSessionJson = json;
