import { describe, expect, it } from "vitest";
import { parseWideBattlebackPack } from "../src/source-resource-packs.js";

const sha256 = "a".repeat(64);
const manifest = { schemaVersion: "1.0.0", packId: "battlebacks-wide", version: "b".repeat(64),
  totalBytes: 4, files: [{ path: "Graphics/Battlebacks/battlebgBosqueZ.png", sizeBytes: 4, sha256,
    objectKey: `resources/sha256/aa/${sha256}.png` }] };

describe("wide battleback pack manifest", () => {
  it("accepts a content-addressed image and rejects wrong sizes or paths", () => {
    expect(parseWideBattlebackPack(manifest)).toEqual(manifest);
    expect(parseWideBattlebackPack({ ...manifest, totalBytes: 5 })).toBeNull();
    expect(parseWideBattlebackPack({ ...manifest, files: [{ ...manifest.files[0], path: "../save.json" }] })).toBeNull();
  });
});
