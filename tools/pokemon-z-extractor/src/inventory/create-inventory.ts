import { assertOutputOutsideSource } from "./path-safety.js";
import { buildSourceManifest } from "./build-manifest.js";
import { validatePokemonZSource } from "./source-validation.js";
import { writeManifestAtomically } from "./write-manifest.js";

export interface CreateInventoryOptions {
  readonly sourceDirectory: string;
  readonly outputDirectory: string;
  readonly concurrency?: number;
}

export async function createInventory(
  options: CreateInventoryOptions,
): Promise<{ readonly manifestPath: string; readonly rootSha256: string }> {
  const paths = await assertOutputOutsideSource(
    options.sourceDirectory,
    options.outputDirectory,
  );
  await validatePokemonZSource(paths.source);

  const manifest = await buildSourceManifest(paths.source, options.concurrency);
  const manifestPath = await writeManifestAtomically(paths.output, manifest);

  return {
    manifestPath,
    rootSha256: manifest.source.rootSha256,
  };
}
