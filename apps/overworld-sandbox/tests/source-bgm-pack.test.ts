import { describe, expect, it } from "vitest";
import { isBgmLoginResponse, parseBgmPack, parseBgmPackRequirement } from "../src/source-bgm-pack.js";

const hash = "a".repeat(64);
const manifest = { schemaVersion: "1.0.0", packId: "bgm", version: "b".repeat(64), totalBytes: 12_706_027,
  files: [{ path: "Audio/BGM/Chateau Lanto.ogg", sizeBytes: 12_706_027, sha256: hash,
    objectKey: `resources/audio/sha256/aa/${hash}.bin` }] };

describe("BGM pack manifest", () => {
  it("accepts a large named track and rejects path escape or inconsistent size", () => {
    expect(parseBgmPack(manifest)).toEqual(manifest);
    expect(parseBgmPack({ ...manifest, totalBytes: 12_706_028 })).toBeNull();
    expect(parseBgmPack({ ...manifest, files: [{ ...manifest.files[0], path: "../save.ogg" }] })).toBeNull();
  });
});

describe("Android BGM layout", () => {
  it("requires the pack only for a slim APK and preserves older full APKs", () => {
    expect(parseBgmPackRequirement({ schemaVersion: "1.0.0", bgmBundled: false })).toBe(true);
    expect(parseBgmPackRequirement({ schemaVersion: "1.0.0", bgmBundled: true })).toBe(false);
    expect(parseBgmPackRequirement({ schemaVersion: "1.0.0" })).toBe(false);
    expect(() => parseBgmPackRequirement({ schemaVersion: "1.0.0", bgmBundled: "false" })).toThrow();
  });
});

describe("private BGM manifest access", () => {
  it("recognizes the HTML login page after Android follows a Cloudflare redirect", () => {
    expect(isBgmLoginResponse(302, {}, "")).toBe(true);
    expect(isBgmLoginResponse(200, { "content-type": "text/html; charset=UTF-8" }, "<html>"))
      .toBe(true);
    expect(isBgmLoginResponse(200, {}, "<!doctype html><html>Cloudflare Access</html>"))
      .toBe(true);
    expect(isBgmLoginResponse(200, { "content-type": "application/json" }, manifest))
      .toBe(false);
  });
});
