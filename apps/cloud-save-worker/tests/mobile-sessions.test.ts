import { describe, expect, it } from "vitest";
import { activateMobileSession, authenticatedMobileSession, issueMobileLoginCode,
  revokeMobileSession } from "../src/mobile-sessions.js";
import mobileWorker from "../src/mobile.js";
import type { SaveEnv } from "../src/save-store.js";

function fakeEnv(): SaveEnv {
  const codes = new Map<string, { email: string; expiry: number }>();
  const sessions = new Map<string, { email: string; lastSeen: number; revoked: boolean }>();
  const prepare = (sql: string) => ({
    bind: (...values: unknown[]) => ({
      async run() {
        if (sql.startsWith("DELETE FROM mobile_login_codes WHERE expires_at")) {
          for (const [hash, row] of codes) if (row.expiry < Number(values[0])) codes.delete(hash);
        } else if (sql.startsWith("INSERT INTO mobile_login_codes")) {
          codes.set(String(values[0]), { email: String(values[1]), expiry: Number(values[2]) });
        } else if (sql.startsWith("INSERT INTO mobile_sessions")) {
          sessions.set(String(values[0]), { email: String(values[1]), lastSeen: Number(values[3]), revoked: false });
        } else if (sql.startsWith("UPDATE mobile_sessions SET revoked_at")) {
          const row = sessions.get(String(values[1]));
          if (row) row.revoked = true;
        } else if (sql.startsWith("UPDATE mobile_sessions SET last_seen_at")) {
          const row = sessions.get(String(values[1]));
          if (row) row.lastSeen = Number(values[0]);
        } else throw new Error(`Unexpected SQL: ${sql}`);
      },
      async first() {
        if (sql.startsWith("DELETE FROM mobile_login_codes") && sql.includes("RETURNING")) {
          const hash = String(values[0]);
          const row = codes.get(hash);
          if (!row || row.expiry <= Number(values[1])) return null;
          codes.delete(hash);
          return { owner_email: row.email };
        }
        if (sql.startsWith("SELECT owner_email, last_seen_at FROM mobile_sessions")) {
          const row = sessions.get(String(values[0]));
          return !row || row.revoked ? null : { owner_email: row.email, last_seen_at: row.lastSeen };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    }),
  });
  return { SAVE_DB: { prepare } as unknown as D1Database };
}

describe("revocable mobile account sessions", () => {
  it("consumes an Access-issued code once and revokes the resulting device token", async () => {
    const env = fakeEnv();
    const issued = await issueMobileLoginCode(env, "player@example.invalid");
    const { code } = await issued.json() as { code: string };
    const activate = () => activateMobileSession(new Request("https://mobile.invalid/api/mobile/activate",
      { method: "POST", body: JSON.stringify({ code }) }), env);
    const first = await activate();
    expect(first.status).toBe(200);
    const { token } = await first.json() as { token: string };
    expect((await activate()).status).toBe(401);
    const request = new Request("https://mobile.invalid/api/mobile/session",
      { headers: { Authorization: `Bearer ${token}` } });
    const session = await authenticatedMobileSession(request, env);
    expect(session?.email).toBe("player@example.invalid");
    await revokeMobileSession(env, session!.tokenHash);
    expect(await authenticatedMobileSession(request, env)).toBeNull();
  });

  it("denies anonymous access to saves, packs and APKs", async () => {
    const env = fakeEnv();
    for (const path of ["/api/saves", "/api/resources/packs/bgm/latest", "/api/updates/latest",
      "/api/updates/download/12"]) {
      const response = await mobileWorker.fetch(new Request(`https://mobile.invalid${path}`), env);
      expect(response.status).toBe(401);
    }
  });
});
