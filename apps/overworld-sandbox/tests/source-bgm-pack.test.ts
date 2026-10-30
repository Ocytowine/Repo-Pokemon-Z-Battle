import { describe, expect, it } from "vitest";
import { parseBgmPack } from "../src/source-bgm-pack.js";

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
