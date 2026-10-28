/** Access guards every route; storage endpoints are scoped to its verified email. */
import { handleSaveRequest, type SaveEnv } from "./save-store.js";
import { handleAndroidUpdateRequest } from "./update-distribution.js";

export interface AccessIdentity {
  readonly email?: string;
}

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), { status,
    headers: { "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

export function cloudSaveSession(request: Request, identity: AccessIdentity | null): Response {
  const path = new URL(request.url).pathname;
  if (request.method !== "GET" || path !== "/api/session" && path !== "/api/login") {
    return json({ error: "not_found" }, 404);
  }
  const email = identity?.email?.trim().toLowerCase();
  if (!email) return json({ error: "access_required" }, 401);
  if (path === "/api/login") {
    return new Response("<!doctype html><html lang=fr><meta name=viewport content='width=device-width,initial-scale=1'><title>Connexion réussie</title><body><h1>Connexion réussie</h1><p>Vous pouvez fermer cette fenêtre et retourner au jeu.</p></body></html>",
      { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store",
        "content-security-policy": "default-src 'none'; style-src 'none'", "x-content-type-options": "nosniff" } });
  }
  return json({ authenticated: true, email }, 200);
}

export default {
  async fetch(request: Request, env: SaveEnv, ctx: ExecutionContext): Promise<Response> {
    const identity = ctx.access ? await ctx.access.getIdentity() ?? null : null;
    const path = new URL(request.url).pathname;
    if (path === "/api/session" || path === "/api/login") return cloudSaveSession(request, identity);
    const email = identity?.email?.trim().toLowerCase();
    if (!email) return json({ error: "access_required" }, 401);
    try {
      if (path.startsWith("/api/updates/")) return await handleAndroidUpdateRequest(request, env);
      return await handleSaveRequest(request, env, email);
    }
    catch (error) {
      console.error("Cloud save request failed", error);
      return json({ error: "storage_unavailable" }, 503);
    }
  },
} satisfies ExportedHandler<SaveEnv>;
