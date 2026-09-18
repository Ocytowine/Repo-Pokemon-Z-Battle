import { readFile } from "node:fs/promises";
import path from "node:path";
import { writeJsonAtomically } from "../io/write-json.js";
import { hashFile } from "../inventory/hash-file.js";
import { assertOutputOutsideSource } from "../inventory/path-safety.js";
import { validatePokemonZSource } from "../inventory/source-validation.js";
import { readRubyMarshal } from "../ruby-marshal/reader.js";
import { decodeRpgTable } from "../ruby-marshal/table.js";
import { extractLocalization } from "./extract-localization.js";
import { extractMapInfos } from "./extract-map-infos.js";
import { extractScripts } from "./extract-scripts.js";
import { extractBattleAnimations } from "./extract-battle-animations.js";

interface EncounterJson {
  readonly records: readonly {
    readonly mapId: number;
    readonly mapName: string | null;
    readonly _source: { readonly line: number };
  }[];
}

export interface RuntimeExtractionResult {
  readonly outputDirectory: string;
  readonly scriptCount: number;
  readonly mapCount: number;
  readonly localizedTextCount: number;
  readonly battleAnimationCount: number;
  readonly files: readonly string[];
}

async function readEncounterJson(outputDirectory: string): Promise<EncounterJson> {
  try {
    return JSON.parse(await readFile(path.join(outputDirectory, "encounters.json"), "utf8")) as EncounterJson;
  } catch (error) {
    throw new Error("Impossible de lire encounters.json. Lancez extract-pbs avant extract-runtime.", {
      cause: error,
    });
  }
}

async function probeMapTable(sourceDirectory: string): Promise<{
  readonly file: string;
  readonly dimensions: number;
  readonly xSize: number;
  readonly ySize: number;
  readonly zSize: number;
  readonly values: number;
}> {
  const file = "Data/Map001.rxdata";
  const value = readRubyMarshal(await readFile(path.join(sourceDirectory, "Data", "Map001.rxdata")));
  if (typeof value !== "object" || value === null || Array.isArray(value) || value.kind !== "object") {
    throw new TypeError(`${file} ne contient pas un objet Ruby.`);
  }
  const table = value.ivars["@data"];
  if (typeof table !== "object" || table === null || Array.isArray(table)
    || table.kind !== "user-defined" || table.className !== "Table") {
    throw new TypeError(`${file} ne contient pas de charge Table dans @data.`);
  }
  const decoded = decodeRpgTable(table);
  return {
    file,
    dimensions: decoded.dimensions,
    xSize: decoded.xSize,
    ySize: decoded.ySize,
    zSize: decoded.zSize,
    values: decoded.values.length,
  };
}

export async function extractRuntimeData(
  sourceDirectory: string,
  outputDirectory: string,
): Promise<RuntimeExtractionResult> {
  const paths = await assertOutputOutsideSource(sourceDirectory, outputDirectory);
  await validatePokemonZSource(paths.source);
  const [localization, maps, scripts, encounters, tableProbe, battleAnimations] = await Promise.all([
    extractLocalization(paths.source, paths.output),
    extractMapInfos(paths.source),
    extractScripts(paths.source, paths.output),
    readEncounterJson(paths.output),
    probeMapTable(paths.source),
    extractBattleAnimations(paths.source, paths.output),
  ]);
  const mapIds = new Set(maps.map((entry) => entry.id));
  const missingEncounterMaps = encounters.records
    .filter((entry) => !mapIds.has(entry.mapId))
    .map((entry) => ({ mapId: entry.mapId, line: entry._source.line }));
  const mapNames = new Map(maps.map((entry) => [entry.id, entry.name]));
  const encounterMapNameDifferences = encounters.records
    .filter((entry) => entry.mapName !== null && mapNames.get(entry.mapId) !== entry.mapName)
    .map((entry) => ({
      mapId: entry.mapId,
      encounterName: entry.mapName,
      mapInfoName: mapNames.get(entry.mapId) ?? null,
      line: entry._source.line,
    }));
  const sourceFiles = await Promise.all(
    ["Data/messages.dat", "Data/french.dat", "Data/Scripts.rxdata", "Data/MapInfos.rxdata", ...battleAnimations.sourceFiles]
      .map(async (file) => ({ file, sha256: await hashFile(path.join(paths.source, ...file.split("/"))) })),
  );
  const scriptsManifest = {
    schemaVersion: "1.0.0",
    source: sourceFiles.find((entry) => entry.file === "Data/Scripts.rxdata"),
    count: scripts.length,
    executionPolicy: "reference-only",
    scripts,
  };
  const mapInfos = {
    schemaVersion: "1.0.0",
    source: sourceFiles.find((entry) => entry.file === "Data/MapInfos.rxdata"),
    count: maps.length,
    records: maps,
  };
  const runtimeReport = {
    schemaVersion: "1.0.0",
    rubyMarshalVersion: "4.8",
    sourceFiles,
    summary: {
      scripts: scripts.length,
      maps: maps.length,
      localizedTexts: localization.report.summary.entries,
      localizationConflicts: localization.report.conflicts.length,
      missingEncounterMaps: missingEncounterMaps.length,
      encounterMapNameDifferences: encounterMapNameDifferences.length,
      normalizedBattleAnimations: battleAnimations.catalog.animations.length,
    },
    tableProbe,
    missingEncounterMaps,
    encounterMapNameDifferences,
  };
  const files = await Promise.all([
    writeJsonAtomically(paths.output, "localization.json", localization.catalog),
    writeJsonAtomically(paths.output, "localization-report.json", localization.report),
    writeJsonAtomically(paths.output, "map-infos.json", mapInfos),
    writeJsonAtomically(paths.output, "scripts-manifest.json", scriptsManifest),
    writeJsonAtomically(paths.output, "runtime-report.json", runtimeReport),
    writeJsonAtomically(paths.output, "battle-animations.json", {
      schemaVersion: "1.0.0",
      coordinateSystem: { width: 512, height: 384, cellSize: 192, sheetColumns: 5, framesPerSecond: 20 },
      mappings: battleAnimations.catalog.mappings,
      animations: battleAnimations.catalog.animations,
    }),
  ]);
  return {
    outputDirectory: paths.output,
    scriptCount: scripts.length,
    mapCount: maps.length,
    localizedTextCount: localization.report.summary.entries,
    battleAnimationCount: battleAnimations.catalog.animations.length,
    files,
  };
}
