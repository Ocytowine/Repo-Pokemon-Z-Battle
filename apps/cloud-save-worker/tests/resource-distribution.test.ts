import { describe, expect, it } from "vitest";
import worker from "../src/index.js";
import { handleResourceRequest, validBgmPack, validWideBattlebackPack } from "../src/resource-distribution.js";
import type { SaveEnv } from "../src/save-store.js";

const sha256 = "a".repeat(64);
const manifest = { schemaVersion: "1.0.0", packId: "battlebacks-wide", version: "b".repeat(64),
  totalBytes: 4, files: [{ path: "Graphics/Battlebacks/battlebgBosqueZ.png", sizeBytes: 4, sha256,
    objectKey: `resources/sha256/aa/${sha256}.png` }] };
const audioManifest = { schemaVersion: "1.0.0", packId: "bgm", version: "c".repeat(64),
  totalBytes: 4, files: [{ path: "Audio/BGM/Chateau Lanto.ogg", sizeBytes: 4, sha256,
    objectKey: `resources/audio/sha256/aa/${sha256}.bin` }] };

const env = { SAVE_DB: {} as D1Database, SAVE_BUCKET: {
  get: async (key: string) => key === "resources/packs/battlebacks-wide/latest.json"
    ? { json: async () => manifest }
    : key === `resources/sha256/aa/${sha256}.png`
      ? { size: 4, body: new Blob(["data"]).stream() } : null,
} as unknown as R2Bucket } satisfies SaveEnv;

describe("private resource distribution", () => {
  it("requires Access identity for manifests and objects", async () => {
    for (const path of ["packs/battlebacks-wide/latest", `objects/${sha256}`]) {
      const response = await worker.fetch(new Request(`https://save.example.test/api/resources/${path}`), env,
        { access: null } as unknown as ExecutionContext);
      expect(response.status).toBe(401);
    }
  });

  it("rejects paths and object keys outside the manifest contract", () => {
    expect(validWideBattlebackPack(manifest)).toBe(true);
    expect(validWideBattlebackPack({ ...manifest, files: [{ ...manifest.files[0], path: "../save.json" }] })).toBe(false);
    expect(validWideBattlebackPack({ ...manifest, files: [{ ...manifest.files[0], objectKey: "saves/private" }] })).toBe(false);
  });

  it("serves only published private files", async () => {
    const listed = await handleResourceRequest(new Request(
      "https://save.example.test/api/resources/packs/battlebacks-wide/latest"), env);
    expect(listed.status).toBe(200);
    const file = await handleResourceRequest(new Request(
      `https://save.example.test/api/resources/objects/${sha256}`), env);
    expect(file.status).toBe(200);
    expect(await file.text()).toBe("data");
    const missing = await handleResourceRequest(new Request(
      `https://save.example.test/api/resources/objects/${"c".repeat(64)}`), env);
    expect(missing.status).toBe(404);
  });

  it("validates BGM paths and serves bounded byte ranges", async () => {
    expect(validBgmPack(audioManifest)).toBe(true);
    expect(validBgmPack({ ...audioManifest, files: [{ ...audioManifest.files[0], path: "../save.ogg" }] })).toBe(false);
    const bgmEnv = { SAVE_DB: {} as D1Database, SAVE_BUCKET: {
      head: async () => ({ size: 4 }),
      get: async (key: string, options?: { range?: { offset: number; length: number } }) =>
        key === "resources/packs/bgm/latest.json" ? { json: async () => audioManifest }
          : key === `resources/audio/sha256/aa/${sha256}.bin` ? { body: new Blob(["data".slice(
            options?.range?.offset ?? 0, (options?.range?.offset ?? 0) + (options?.range?.length ?? 4))]).stream() }
            : null,
    } as unknown as R2Bucket } satisfies SaveEnv;
    const listed = await handleResourceRequest(new Request(
      "https://save.example.test/api/resources/packs/bgm/latest"), bgmEnv);
    expect(listed.status).toBe(200);
    const part = await handleResourceRequest(new Request(
      `https://save.example.test/api/resources/audio/${sha256}`, { headers: { range: "bytes=1-2" } }), bgmEnv);
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 1-2/4");
    expect(await part.text()).toBe("at");
    expect((await handleResourceRequest(new Request(
      `https://save.example.test/api/resources/audio/${sha256}`, { headers: { range: "bytes=3-5" } }),
    bgmEnv)).status).toBe(416);
  });
});
