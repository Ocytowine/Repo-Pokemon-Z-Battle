import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { writeTextAtomically } from "../io/write-text.js";
import { readRubyMarshal } from "../ruby-marshal/reader.js";
import { isRubyString } from "../ruby-marshal/values.js";

const UTF8 = new TextDecoder("utf-8", { fatal: false });
const WINDOWS_1252 = new TextDecoder("windows-1252", { fatal: false });

export interface ScriptManifestEntry {
  readonly index: number;
  readonly id: number;
  readonly name: string;
  readonly file: string;
  readonly compressedSha256: string;
  readonly sourceSha256: string;
  readonly sourceBytes: number;
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeName(value: string): string {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
  const safe = normalized.replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  return safe.slice(0, 60) || "unnamed";
}

function decodeSource(bytes: Uint8Array): string {
  const utf8 = UTF8.decode(bytes);
  return utf8.includes("\uFFFD") ? WINDOWS_1252.decode(bytes) : utf8;
}

export async function extractScripts(
  sourceDirectory: string,
  outputDirectory: string,
): Promise<readonly ScriptManifestEntry[]> {
  const relativeSource = "Data/Scripts.rxdata";
  const value = readRubyMarshal(await readFile(path.join(sourceDirectory, "Data", "Scripts.rxdata")));
  if (!Array.isArray(value)) throw new TypeError(`${relativeSource} ne contient pas un tableau.`);
  const scriptsDirectory = path.join(outputDirectory, "scripts");
  const entries: ScriptManifestEntry[] = [];
  for (const [index, row] of value.entries()) {
    if (!Array.isArray(row) || row.length !== 3) {
      throw new TypeError(`${relativeSource}: entree ${index} invalide.`);
    }
    const [rawId, rawName, rawCompressed] = row;
    if (typeof rawId !== "number" || !isRubyString(rawName)
      || !isRubyString(rawCompressed)) {
      throw new TypeError(`${relativeSource}: entree ${index} invalide.`);
    }
    const id = rawId;
    const name = rawName.text;
    const compressed = rawCompressed.bytes;
    const source = inflateSync(compressed);
    const file = `${String(index).padStart(3, "0")}-${id}-${safeName(name)}.rb`;
    await writeTextAtomically(scriptsDirectory, file, decodeSource(source));
    entries.push({
      index,
      id,
      name,
      file: `scripts/${file}`,
      compressedSha256: sha256(compressed),
      sourceSha256: sha256(source),
      sourceBytes: source.length,
    });
  }
  return entries;
}
