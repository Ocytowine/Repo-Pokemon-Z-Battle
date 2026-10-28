import { describe, expect, it } from "vitest";
import { handleAndroidUpdateRequest, parseAndroidUpdateManifest } from "../src/update-distribution.js";
import type { SaveEnv } from "../src/save-store.js";
import worker from "../src/index.js";

const manifest = { versionCode: 2, versionName: "0.2.0", notes: "Première version de diffusion.",
  sizeBytes: 8, sha256: "a".repeat(64) };
const bytes = new TextEncoder().encode("12345678");

function environment(): SaveEnv {
  const bucket = {
    get: async (key: string, options?: { range?: Headers }) => {
      if (key === "updates/android/latest.json") return { json: async () => manifest, body: true };
      if (key !== "updates/android/pokemon-z-battle-2.apk") return null;
      const range = options?.range?.get("range");
      const offset = range === "bytes=2-4" ? 2 : 0;
      const length = range === "bytes=2-4" ? 3 : 8;
      return { size: 8, httpEtag: '"sample"', range: range ? { offset, length } : undefined,
        body: new Blob([bytes.slice(offset, offset + length)]).stream() };
    },
    head: async (key: string) => key === "updates/android/pokemon-z-battle-2.apk"
      ? { size: 8 } : null,
  };
  return { SAVE_DB: {} as D1Database, SAVE_BUCKET: bucket as unknown as R2Bucket };
}

describe("private Android updates", () => {
  it("keeps update routes behind the verified Access identity", async () => {
    const response = await worker.fetch(new Request("https://save.example.test/api/updates/latest"),
      environment(), { access: null } as unknown as ExecutionContext);
    expect(response.status).toBe(401);
    const download = await worker.fetch(new Request("https://save.example.test/api/updates/download/latest"),
      environment(), { access: null } as unknown as ExecutionContext);
    expect(download.status).toBe(401);
  });

  it("does not announce a release before its manifest is published", async () => {
    const env = { SAVE_DB: {} as D1Database, SAVE_BUCKET: {
      get: async () => null,
    } as unknown as R2Bucket };
    const response = await handleAndroidUpdateRequest(
      new Request("https://save.example.test/api/updates/latest"), env);
    expect(response.status).toBe(204);
  });

  it("rejects malformed manifests before advertising a download", () => {
    expect(parseAndroidUpdateManifest({ ...manifest, sha256: "invalid" })).toBeNull();
    expect(parseAndroidUpdateManifest(manifest)).toEqual(manifest);
  });

  it("advertises only a published APK whose size matches the manifest", async () => {
    const response = await handleAndroidUpdateRequest(
      new Request("https://save.example.test/api/updates/latest"), environment());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ versionCode: 2,
      downloadUrl: "https://save.example.test/api/updates/download/2" });
  });

  it("streams the current APK and supports resumed downloads", async () => {
    const env = environment();
    const old = await handleAndroidUpdateRequest(
      new Request("https://save.example.test/api/updates/download/1"), env);
    expect(old.status).toBe(404);
    const response = await handleAndroidUpdateRequest(new Request(
      "https://save.example.test/api/updates/download/2", { headers: { Range: "bytes=2-4" } }), env);
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 2-4/8");
    expect(await response.text()).toBe("345");
  });

  it("serves the current APK from a permanent installation link", async () => {
    const response = await handleAndroidUpdateRequest(new Request(
      "https://save.example.test/api/updates/download/latest"), environment());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition"))
      .toBe('attachment; filename="pokemon-z-battle-2.apk"');
    expect(await response.text()).toBe("12345678");
  });
});
