import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { createApkDelta } from "../scripts/apk-delta.mjs";

function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [filename, value] of files) {
    const name = Buffer.from(filename);
    const data = Buffer.from(value);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

describe("signed APK byte delta", () => {
  it("copies unchanged resources while reconstructing the target byte for byte", async () => {
    const folder = mkdtempSync(path.join(tmpdir(), "pz-delta-test-"));
    try {
      const base = path.join(folder, "base.apk");
      const target = path.join(folder, "target.apk");
      const patch = path.join(folder, "patch.pzb.gz");
      const image = Buffer.alloc(256 * 1024);
      for (let i = 0; i < image.length; i++) image[i] = (i * 37 + i / 97) & 255;
      const previous = zip([["assets/index.js", "old code"], ["assets/Graphics/map.png", image]]);
      const next = zip([["assets/index.js", "updated code with different length"],
        ["assets/Graphics/map.png", image]]);
      writeFileSync(base, previous);
      writeFileSync(target, next);
      const result = await createApkDelta(base, target, patch);
      expect(result.reusedBytes).toBe(image.length);
      expect(result.sizeBytes).toBeLessThan(next.length / 10);
      const bytes = gunzipSync(readFileSync(patch));
      expect(bytes.subarray(0, 5).toString()).toBe("PZBD1");
      expect(bytes.subarray(5, 37).toString("hex"))
        .toBe(createHash("sha256").update(previous).digest("hex"));
      let cursor = 89;
      const parts = [];
      for (let index = 0; index < bytes.readUInt32BE(85); index++) {
        const type = bytes[cursor++];
        if (type === 0) {
          const offset = Number(bytes.readBigUInt64BE(cursor)); cursor += 8;
          const length = bytes.readUInt32BE(cursor); cursor += 4;
          parts.push(previous.subarray(offset, offset + length));
        } else {
          expect(type).toBe(1);
          const length = bytes.readUInt32BE(cursor); cursor += 4;
          parts.push(bytes.subarray(cursor, cursor + length)); cursor += length;
        }
      }
      expect(cursor).toBe(bytes.length);
      expect(Buffer.concat(parts)).toEqual(next);
    } finally {
      if (!path.resolve(folder).startsWith(`${path.resolve(tmpdir())}${path.sep}`)) {
        throw new Error("Dossier temporaire inattendu.");
      }
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
