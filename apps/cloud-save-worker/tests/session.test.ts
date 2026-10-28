import { describe, expect, it } from "vitest";
import { cloudSaveSession } from "../src/index.js";

const request = (path: string, method = "GET") => new Request(`https://save.example.test${path}`, { method });

describe("cloud save Access session", () => {
  it("refuses unauthenticated requests even if the Worker is deployed before its Access policy", async () => {
    const response = cloudSaveSession(request("/api/session"), null);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "access_required" });
  });

  it("reports only the Access authenticated identity", async () => {
    const response = cloudSaveSession(request("/api/session"), { email: "  Player@Example.com " });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ authenticated: true, email: "player@example.com" });
  });

  it("shows a simple return-to-game page after Android sign-in", async () => {
    const response = cloudSaveSession(request("/api/login"), { email: "player@example.com" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("retourner au jeu");
  });

  it("does not expose save routes through the public session handler", async () => {
    const response = cloudSaveSession(request("/api/saves", "POST"), { email: "player@example.com" });
    expect(response.status).toBe(404);
  });
});
