import { readFile } from "node:fs/promises";
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
}

export interface LocalTestPaths {
  readonly sourceDirectory: string;
  readonly outputDirectory: string;
}

export async function readExistingLocalTestPaths(invocationDirectory: string): Promise<LocalTestPaths> {
  const outputDirectory = path.resolve(invocationDirectory, ".pokemon-z", "data");
  const configPath = path.join(outputDirectory, "local-test.json");
  let value: unknown;
  try {
    value = JSON.parse(await readFile(configPath, "utf8")) as unknown;
  } catch {
    throw new Error(`Configuration locale introuvable ou invalide : ${configPath}. Lancez une premiere fois prepare:local avec --source et --output.`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || !("schemaVersion" in value) || value.schemaVersion !== "1.0.0"
    || !("sourceDirectory" in value) || typeof value.sourceDirectory !== "string") {
    throw new Error(`Configuration locale invalide : ${configPath}. Relancez prepare:local avec --source et --output.`);
  }
  return { sourceDirectory: path.resolve(value.sourceDirectory), outputDirectory };
}

export async function prepareLocalTest(
  sourceDirectory: string,
  outputDirectory: string,
): Promise<LocalTestPreparationResult> {
  const paths = await assertOutputOutsideSource(sourceDirectory, outputDirectory);
  await extractPbsData(paths.source, paths.output);
  await extractRuntimeData(paths.source, paths.output);
  await extractAssets(paths.source, paths.output);
  await extractWorldMaps(paths.source, paths.output);
  await extractEvents(paths.source, paths.output);
  await extractScriptHooks(paths.source, paths.output);
  const configPath = await writeJsonAtomically(paths.output, "local-test.json", {
    schemaVersion: "1.0.0",
    sourceDirectory: paths.source,
  });
  return { outputDirectory: paths.output, configPath };
}
