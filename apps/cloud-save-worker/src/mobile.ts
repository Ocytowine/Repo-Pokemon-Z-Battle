/** Public mobile gateway: every data route requires a revocable per-device token. */
import { handleSaveRequest, type SaveEnv } from "./save-store.js";
import { handleAndroidUpdateRequest } from "./update-distribution.js";
import { handleWebCodeRequest } from "./web-code-distribution.js";
import { handleResourceRequest } from "./resource-distribution.js";
import { activateMobileSession, authenticatedMobileSession, mobileSessionError,
  mobileSessionJson, revokeMobileSession } from "./mobile-sessions.js";

export default {
  async fetch(request: Request, env: SaveEnv): Promise<Response> {
    const path = new URL(request.url).pathname;
    try {
      if (path === "/api/mobile/activate") return await activateMobileSession(request, env);
      const session = await authenticatedMobileSession(request, env);
      if (!session) return mobileSessionError();
      if (path === "/api/mobile/session") {
        return request.method === "GET" ? mobileSessionJson({ authenticated: true, email: session.email })
          : mobileSessionJson({ error: "method_not_allowed" }, 405);
      }
      if (path === "/api/mobile/logout") {
        return request.method === "POST" ? revokeMobileSession(env, session.tokenHash)
          : mobileSessionJson({ error: "method_not_allowed" }, 405);
      }
      if (path.startsWith("/api/updates/web/")) return await handleWebCodeRequest(request, env);
      if (path.startsWith("/api/updates/")) return await handleAndroidUpdateRequest(request, env);
      if (path.startsWith("/api/resources/")) return await handleResourceRequest(request, env);
      if (path.startsWith("/api/saves")) return await handleSaveRequest(request, env, session.email);
      return mobileSessionJson({ error: "not_found" }, 404);
    } catch (error) {
      console.error("Mobile gateway request failed", error);
      return mobileSessionJson({ error: "storage_unavailable" }, 503);
    }
  },
} satisfies ExportedHandler<SaveEnv>;
