import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";
import {
  EXTRACTOR_NAME,
  EXTRACTOR_VERSION,
  MANIFEST_SCHEMA_VERSION,
  type SourceFileEntry,
  type SourceManifest,
} from "../domain/manifest.js";
import { discoverFiles } from "./file-discovery.js";
import { hashFile } from "./hash-file.js";

const DEFAULT_HASH_CONCURRENCY = 8;

function toPortablePath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

async function mapWithConcurrency<TInput, TOutput>(
  values: readonly TInput[],
  concurrency: number,
  mapper: (value: TInput) => Promise<TOutput>,
): Promise<readonly TOutput[]> {
  const results = new Array<TOutput>(values.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      const value = values[index];
      if (value === undefined) continue;
      results[index] = await mapper(value);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, values.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function hashManifestRoot(files: readonly SourceFileEntry[]): string {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file.path);
    hash.update("\0");
    hash.update(String(file.size));
    hash.update("\0");
    hash.update(file.sha256);
    hash.update("\n");
  }
  return hash.digest("hex");
}

export async function buildSourceManifest(
  sourceDirectory: string,
  concurrency = DEFAULT_HASH_CONCURRENCY,
): Promise<SourceManifest> {
  const absoluteFiles = await discoverFiles(sourceDirectory);
  const files = await mapWithConcurrency(absoluteFiles, concurrency, async (absolutePath) => {
    const before = await stat(absolutePath);
    const sha256 = await hashFile(absolutePath);
    const after = await stat(absolutePath);

    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
      throw new Error(`Le fichier source a change pendant l'inventaire : ${absolutePath}`);
    }

    return {
      path: toPortablePath(path.relative(sourceDirectory, absolutePath)),
      size: before.size,
      sha256,
    } satisfies SourceFileEntry;
  });

  const totalBytes = files.reduce((total, file) => total + file.size, 0);

  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    generator: {
      name: EXTRACTOR_NAME,
      version: EXTRACTOR_VERSION,
    },
    source: {
      game: "Pokemon Z",
      version: "2.12 FR",
      rootSha256: hashManifestRoot(files),
    },
    summary: {
      fileCount: files.length,
      totalBytes,
    },
    files,
  };
}
