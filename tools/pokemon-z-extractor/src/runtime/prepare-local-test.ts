import { GAME_DATA_SCHEMA_VERSION, LOCAL_DATA_MANIFEST_FILE, LOCAL_DATA_MANIFEST_SCHEMA_VERSION,
  LOCAL_DATA_REQUIRED_FILES, type LocalDataManifest } from "@pokemon-z-battle/game-data";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { writeJsonAtomically } from "../io/write-json.js";
import { assertOutputOutsideSource } from "../inventory/path-safety.js";
import { extractAssets } from "../assets/extract-assets.js";
import { extractPbsData } from "../pbs/extract-pbs.js";
import { extractRuntimeData } from "./extract-runtime.js";
import { extractWorldMaps } from "./extract-world-maps.js";
import { extractEvents } from "./extract-events.js";
import { extractScriptHooks } from "./extract-script-hooks.js";

export interface LocalTestPreparationResult {
  readonly outputDirectory: string;
  readonly configPath: string;
  readonly manifestPath: string;
}

export interface LocalTestPaths {
  readonly sourceDirectory: string;
  readonly outputDirectory: string;
}

export const LOCAL_TEST_CONFIG_SCHEMA_VERSION = "2.0.0" as const;
export const LOCAL_TEST_CONFIG_RELATIVE_PATH = ".pokemon-z/local-test.json" as const;

async function listRelativeFiles(directory: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(path.join(directory, prefix), { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    return entry.isDirectory() ? listRelativeFiles(directory, relative) : [relative];
  }));
  return files.flat().filter((file) => file !== LOCAL_DATA_MANIFEST_FILE && !file.endsWith(".tmp")).sort();
}

export async function writeLocalDataManifest(outputDirectory: string, now = new Date()): Promise<string> {
  const files = await listRelativeFiles(outputDirectory);
  const missing = LOCAL_DATA_REQUIRED_FILES.filter((file) => !files.includes(file));
  if (missing.length > 0) {
    throw new Error(`Extraction locale incomplete : ${missing.join(", ")}.`);
  }
  const manifest: LocalDataManifest = {
    schemaVersion: LOCAL_DATA_MANIFEST_SCHEMA_VERSION,
    gameDataSchemaVersion: GAME_DATA_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    files,
  };
  return writeJsonAtomically(outputDirectory, LOCAL_DATA_MANIFEST_FILE, manifest);
}

export async function readExistingLocalTestPaths(invocationDirectory: string): Promise<LocalTestPaths> {
  const defaultOutputDirectory = path.resolve(invocationDirectory, ".pokemon-z", "data");
  const configPaths = [
    path.resolve(invocationDirectory, ...LOCAL_TEST_CONFIG_RELATIVE_PATH.split("/")),
    path.join(defaultOutputDirectory, "local-test.json"),
  ];
  let value: unknown;
  let configPath: string | null = null;
  for (const candidate of configPaths) {
    try {
      value = JSON.parse(await readFile(candidate, "utf8")) as unknown;
      configPath = candidate;
      break;
    } catch {
      value = undefined;
    }
  }
  if (configPath === null) {
    throw new Error(`Configuration locale introuvable : ${configPaths[0]}. Lancez une premiere fois prepare:local avec --source et --output.`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || !("schemaVersion" in value) || !("sourceDirectory" in value) || typeof value.sourceDirectory !== "string") {
    throw new Error(`Configuration locale invalide : ${configPath}. Relancez prepare:local avec --source et --output.`);
  }
  if (value.schemaVersion === LOCAL_TEST_CONFIG_SCHEMA_VERSION
    && "dataDirectory" in value && typeof value.dataDirectory === "string") {
    return { sourceDirectory: path.resolve(value.sourceDirectory), outputDirectory: path.resolve(value.dataDirectory) };
  }
  if (value.schemaVersion !== "1.0.0") {
    throw new Error(`Configuration locale incompatible : ${configPath}. Relancez prepare:local avec --source et --output.`);
  }
  return { sourceDirectory: path.resolve(value.sourceDirectory), outputDirectory: defaultOutputDirectory };
}

export async function writeLocalTestConfiguration(invocationDirectory: string,
  paths: LocalTestPaths): Promise<string> {
  const configPath = path.resolve(invocationDirectory, ...LOCAL_TEST_CONFIG_RELATIVE_PATH.split("/"));
  return writeJsonAtomically(path.dirname(configPath), path.basename(configPath), {
    schemaVersion: LOCAL_TEST_CONFIG_SCHEMA_VERSION,
    sourceDirectory: paths.sourceDirectory,
    dataDirectory: paths.outputDirectory,
  });
}

export async function prepareLocalTest(
  sourceDirectory: string,
  outputDirectory: string,
  invocationDirectory = process.cwd(),
): Promise<LocalTestPreparationResult> {
  const paths = await assertOutputOutsideSource(sourceDirectory, outputDirectory);
  await extractPbsData(paths.source, paths.output);
  await extractRuntimeData(paths.source, paths.output);
  await extractAssets(paths.source, paths.output);
  await extractWorldMaps(paths.source, paths.output);
  await extractEvents(paths.source, paths.output);
  await extractScriptHooks(paths.source, paths.output);
  const manifestPath = await writeLocalDataManifest(paths.output);
  const configPath = await writeLocalTestConfiguration(invocationDirectory,
    { sourceDirectory: paths.source, outputDirectory: paths.output });
  return { outputDirectory: paths.output, configPath, manifestPath };
}
