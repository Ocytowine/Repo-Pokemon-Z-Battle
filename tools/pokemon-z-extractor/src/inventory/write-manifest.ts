import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SourceManifest } from "../domain/manifest.js";

export const MANIFEST_FILE_NAME = "source-manifest.json";

export function serializeManifest(manifest: SourceManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export async function writeManifestAtomically(
  outputDirectory: string,
  manifest: SourceManifest,
): Promise<string> {
  await mkdir(outputDirectory, { recursive: true });
  const destination = path.join(outputDirectory, MANIFEST_FILE_NAME);
  const temporary = path.join(
    outputDirectory,
    `.${MANIFEST_FILE_NAME}.${process.pid}.${randomUUID()}.tmp`,
  );

  try {
    await writeFile(temporary, serializeManifest(manifest), {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }

  return destination;
}
