import { describe, expect, it } from "vitest";
import { handleWebCodeRequest, validWebCodeManifest } from "../src/web-code-distribution.js";
import type { SaveEnv } from "../src/save-store.js";
import worker from "../src/mobile.js";

const hash = "a".repeat(64);
const payload = JSON.stringify({ schemaVersion: "1.0.0", nativeVersionCode: 12,
  entryScript: "assets/index-A.js", entryStyle: "assets/index-B.css",
  files: [{ path: "assets/index-A.js", sizeBytes: 3, sha256: hash },
    { path: "assets/index-B.css", sizeBytes: 3, sha256: hash }] });
const manifest = { version: hash, payload, signature: "b".repeat(100) };
const env = { SAVE_DB: {} as D1Database, SAVE_BUCKET: {
  get: async (key: string) => key === "updates/web/latest.json"
    ? { body: true, json: async () => manifest }
    : key === `updates/web/sha256/aa/${hash}.bin`
      ? { body: new Blob(["abc"]).stream(), size: 3 } : null,
} as unknown as R2Bucket } satisfies SaveEnv;

describe("private web code distribution", () => {
  it("validates a bounded code-only inventory", () => {
    expect(validWebCodeManifest(manifest)).toBe(true);
    expect(validWebCodeManifest({ ...manifest, payload: payload.replace("assets/index-A.js", "../source.js") }))
      .toBe(false);
  });

  it("serves the manifest and immutable objects behind a mobile session", async () => {
    const latest = await handleWebCodeRequest(new Request(
      "https://save.example.test/api/updates/web/latest"), env);
    expect(latest.status).toBe(200);
    expect(await latest.json()).toEqual(manifest);
    const object = await handleWebCodeRequest(new Request(
      `https://save.example.test/api/updates/web/objects/${hash}`), env);
    expect(await object.text()).toBe("abc");
    const unauthenticated = await worker.fetch(new Request(
      "https://save.example.test/api/updates/web/latest"), env);
    expect(unauthenticated.status).toBe(401);
  });
});
