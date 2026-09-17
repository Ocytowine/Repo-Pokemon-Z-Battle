import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { writeJsonAtomically } from "../io/write-json.js";
import { discoverFiles } from "../inventory/file-discovery.js";
import { hashFile } from "../inventory/hash-file.js";
import { assertOutputOutsideSource } from "../inventory/path-safety.js";
import { validatePokemonZSource } from "../inventory/source-validation.js";
import {
  assetCategory,
  classifyPokemonAsset,
  normalizedWebPath,
  type PokemonAssetIdentity,
  type PokemonAssetKind,
} from "./classify-assets.js";
import { readImageMetadata, type ImageDimensions } from "./image-metadata.js";

const HASH_CONCURRENCY = 8;
const WEBGL_CHUNK_HEIGHT = 4096;

export interface AssetManifestEntry {
  readonly path: string;
  readonly webPath: string;
  readonly category: string;
  readonly mediaType: "image" | "audio" | "other";
  readonly format: string;
  readonly detectedFormat: string | null;
  readonly bytes: number;
  readonly sha256: string;
  readonly duplicateOf: string | null;
  readonly image: (ImageDimensions & {
    readonly animation: {
      readonly direction: "horizontal";
      readonly frameWidth: number;
      readonly frameHeight: number;
      readonly frameCount: number;
    } | null;
  }) | null;
  readonly pokemon: PokemonAssetIdentity | null;
}

interface PokemonJson {
  readonly records: readonly { readonly id: number; readonly internalName: string; readonly name: string }[];
}

interface PokemonAssetReference extends PokemonAssetIdentity {
  readonly path: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly frameCount: number | null;
}

async function mapConcurrent<TInput, TOutput>(
  values: readonly TInput[],
  mapper: (value: TInput) => Promise<TOutput>,
): Promise<readonly TOutput[]> {
  const results = new Array<TOutput>(values.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < values.length) {
      const index = cursor++;
      const value = values[index];
      if (value !== undefined) results[index] = await mapper(value);
    }
  }
  await Promise.all(Array.from({ length: Math.min(HASH_CONCURRENCY, values.length) }, worker));
  return results;
}

function portablePath(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

function mediaType(extension: string): "image" | "audio" | "other" {
  if (["png", "jpg", "jpeg", "gif", "bmp"].includes(extension)) return "image";
  if (["ogg", "wav", "mp3"].includes(extension)) return "audio";
  return "other";
}

function animationFor(
  dimensions: ImageDimensions | null,
  pokemon: PokemonAssetIdentity | null,
): AssetManifestEntry["image"] {
  if (dimensions === null) return null;
  const animated = pokemon?.kind === "battler" && dimensions.width > dimensions.height
    && dimensions.width % dimensions.height === 0;
  return {
    ...dimensions,
    animation: animated ? {
      direction: "horizontal",
      frameWidth: dimensions.height,
      frameHeight: dimensions.height,
      frameCount: dimensions.width / dimensions.height,
    } : null,
  };
}

function rootHash(entries: readonly AssetManifestEntry[]): string {
  const hash = createHash("sha256");
  for (const entry of entries) {
    hash.update(`${entry.path}\0${entry.bytes}\0${entry.sha256}\n`);
  }
  return hash.digest("hex");
}

function tilesetChunks(entry: AssetManifestEntry): readonly {
  readonly index: number; readonly x: 0; readonly y: number;
  readonly width: number; readonly height: number;
}[] {
  if (entry.image === null) return [];
  const chunks = [];
  for (let y = 0, index = 0; y < entry.image.height; y += WEBGL_CHUNK_HEIGHT, index += 1) {
    chunks.push({
      index,
      x: 0 as const,
      y,
      width: entry.image.width,
      height: Math.min(WEBGL_CHUNK_HEIGHT, entry.image.height - y),
    });
  }
  return chunks;
}

export async function extractAssets(
  sourceDirectory: string,
  outputDirectory: string,
): Promise<{
  readonly outputDirectory: string;
  readonly assetCount: number;
  readonly pokemonCount: number;
  readonly files: readonly string[];
}> {
  const paths = await assertOutputOutsideSource(sourceDirectory, outputDirectory);
  await validatePokemonZSource(paths.source);
  const pokemonData = JSON.parse(
    await readFile(path.join(paths.output, "pokemon.json"), "utf8"),
  ) as PokemonJson;
  const roots = [path.join(paths.source, "Graphics"), path.join(paths.source, "Audio")];
  const absoluteFiles = (await Promise.all(roots.map(discoverFiles))).flat();
  absoluteFiles.sort((left, right) => {
    const leftPath = portablePath(paths.source, left);
    const rightPath = portablePath(paths.source, right);
    return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0;
  });

  const rawEntries = await mapConcurrent(absoluteFiles, async (absolutePath) => {
    const relative = portablePath(paths.source, absolutePath);
    const extension = path.extname(relative).slice(1).toLowerCase();
    const [fileStat, sha256, imageMetadata] = await Promise.all([
      stat(absolutePath),
      hashFile(absolutePath),
      readImageMetadata(absolutePath),
    ]);
    const pokemon = classifyPokemonAsset(relative);
    return {
      path: relative,
      webPath: normalizedWebPath(relative),
      category: assetCategory(relative),
      mediaType: mediaType(extension),
      format: extension,
      detectedFormat: imageMetadata?.format ?? null,
      bytes: fileStat.size,
      sha256,
      image: animationFor(imageMetadata, pokemon),
      pokemon,
    };
  });

  const canonicalByHash = new Map<string, string>();
  const entries: AssetManifestEntry[] = rawEntries.map((entry) => {
    const canonical = canonicalByHash.get(entry.sha256) ?? null;
    if (canonical === null) canonicalByHash.set(entry.sha256, entry.path);
    return { ...entry, duplicateOf: canonical };
  });
  const manifest = {
    schemaVersion: "1.0.0",
    source: { game: "Pokemon Z", version: "2.12 FR", rootSha256: rootHash(entries) },
    pathPolicy: "NFC, forward slashes, lowercase webPath; source path casing preserved in path",
    summary: {
      assets: entries.length,
      bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
      images: entries.filter((entry) => entry.mediaType === "image").length,
      audio: entries.filter((entry) => entry.mediaType === "audio").length,
      other: entries.filter((entry) => entry.mediaType === "other").length,
      uniqueContents: canonicalByHash.size,
      duplicateFiles: entries.filter((entry) => entry.duplicateOf !== null).length,
    },
    records: entries,
  };

  const referencesById = new Map<number, PokemonAssetReference[]>();
  const unassignedPokemonAssets: string[] = [];
  const placeholderAssets: string[] = [];
  const pokemonIds = new Set(pokemonData.records.map((record) => record.id));
  for (const entry of entries) {
    if (entry.pokemon === null) continue;
    if (!pokemonIds.has(entry.pokemon.pokemonId)) {
      if (entry.pokemon.pokemonId === 0) placeholderAssets.push(entry.path);
      else unassignedPokemonAssets.push(entry.path);
      continue;
    }
    const references = referencesById.get(entry.pokemon.pokemonId) ?? [];
    references.push({
      ...entry.pokemon,
      path: entry.path,
      width: entry.image?.width ?? null,
      height: entry.image?.height ?? null,
      frameCount: entry.image?.animation?.frameCount ?? null,
    });
    referencesById.set(entry.pokemon.pokemonId, references);
  }
  const pokemonRecords = pokemonData.records.map((pokemon) => {
    const assets = referencesById.get(pokemon.id) ?? [];
    const byKind = Object.fromEntries(
      (["battler", "icon", "footprint", "cry", "overworld"] as PokemonAssetKind[])
        .map((kind) => [kind, assets.filter((asset) => asset.kind === kind)]),
    );
    return { id: pokemon.id, internalName: pokemon.internalName, name: pokemon.name, assets: byKind };
  });
  const pokemonAssets = {
    schemaVersion: "1.0.0",
    sourceManifest: "asset-manifest.json",
    count: pokemonRecords.length,
    records: pokemonRecords,
  };

  const duplicateGroups = [...new Set(entries.filter((entry) => entry.duplicateOf !== null)
    .map((entry) => entry.duplicateOf as string))].map((canonical) => ({
      canonical,
      duplicates: entries.filter((entry) => entry.duplicateOf === canonical).map((entry) => entry.path),
    }));
  const byWebPath = new Map<string, string[]>();
  for (const entry of entries) {
    const matches = byWebPath.get(entry.webPath) ?? [];
    matches.push(entry.path);
    byWebPath.set(entry.webPath, matches);
  }
  const webPathCollisions = [...byWebPath.entries()]
    .filter(([, matches]) => matches.length > 1)
    .map(([webPath, sourcePaths]) => ({ webPath, sourcePaths }));
  const tilesets = entries.filter((entry) => entry.category === "graphics/tilesets" && entry.image !== null)
    .map((entry) => ({
      path: entry.path,
      width: entry.image?.width ?? 0,
      height: entry.image?.height ?? 0,
      requiresChunking: (entry.image?.height ?? 0) > WEBGL_CHUNK_HEIGHT,
      chunks: tilesetChunks(entry),
    }));
  const countsByCategory = Object.fromEntries([...new Set(entries.map((entry) => entry.category))]
    .sort().map((category) => [category, entries.filter((entry) => entry.category === category).length]));
  const countsByFormat = Object.fromEntries([...new Set(entries.map((entry) => entry.format))]
    .sort().map((format) => [format, entries.filter((entry) => entry.format === format).length]));
  const coverageByKind = Object.fromEntries(
    (["battler", "icon", "footprint", "cry", "overworld"] as PokemonAssetKind[]).map((kind) => [
      kind,
      pokemonRecords.filter((record) => (record.assets[kind]?.length ?? 0) > 0).length,
    ]),
  );
  const unclassifiedConventionCandidates = entries.filter((entry) => {
    if (entry.pokemon !== null) return false;
    const name = path.posix.basename(entry.path);
    return (entry.category === "graphics/battlers" && /^\d/iu.test(name))
      || (entry.category === "graphics/icons" && /^icon\d/iu.test(name))
      || (entry.category === "graphics/icons" && entry.path.includes("/Footprints/") && /^footprint\d/iu.test(name))
      || (entry.category === "audio/se" && entry.path.includes("/Cries/") && /^\d/iu.test(name));
  }).map((entry) => entry.path);
  const report = {
    schemaVersion: "1.0.0",
    summary: {
      ...manifest.summary,
      pokemon: pokemonRecords.length,
      assignedPokemonAssets: [...referencesById.values()].reduce((sum, value) => sum + value.length, 0),
      unassignedPokemonAssets: unassignedPokemonAssets.length,
      placeholderAssets: placeholderAssets.length,
      animatedBattlers: entries.filter((entry) => entry.pokemon?.kind === "battler"
        && entry.image?.animation !== null).length,
      oversizedTilesets: tilesets.filter((entry) => entry.requiresChunking).length,
      webPathCollisions: webPathCollisions.length,
    },
    countsByCategory,
    countsByFormat,
    formatMismatches: entries.filter((entry) => entry.detectedFormat !== null
      && entry.detectedFormat !== entry.format
      && !(entry.detectedFormat === "jpg" && entry.format === "jpeg"))
      .map((entry) => ({ path: entry.path, extension: entry.format, detectedFormat: entry.detectedFormat })),
    coverageByKind,
    duplicateGroups,
    webPathCollisions,
    unassignedPokemonAssets,
    placeholderAssets,
    unclassifiedConventionCandidates,
    tilesetPolicy: {
      maximumChunkHeight: WEBGL_CHUNK_HEIGHT,
      tileAlignment: 32,
      mode: "source-rectangle-plan-no-copy",
    },
    tilesets,
  };
  const files = await Promise.all([
    writeJsonAtomically(paths.output, "asset-manifest.json", manifest),
    writeJsonAtomically(paths.output, "pokemon-assets.json", pokemonAssets),
    writeJsonAtomically(paths.output, "asset-report.json", report),
  ]);
  return { outputDirectory: paths.output, assetCount: entries.length, pokemonCount: pokemonRecords.length, files };
}
