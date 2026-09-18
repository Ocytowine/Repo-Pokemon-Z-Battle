#!/usr/bin/env node
import path from "node:path";
import { createInventory } from "./inventory/create-inventory.js";
import { extractPbsData } from "./pbs/extract-pbs.js";
import { extractRuntimeData } from "./runtime/extract-runtime.js";
import { extractAssets } from "./assets/extract-assets.js";

interface PathArguments {
  readonly sourceDirectory: string;
  readonly outputDirectory: string;
}

const HELP = `Pokemon Z extractor

Usage:
  pokemon-z-extractor inventory --source <game-directory> --output <output-directory>
  pokemon-z-extractor extract-pbs --source <game-directory> --output <output-directory>
  pokemon-z-extractor extract-runtime --source <game-directory> --output <output-directory>
  pokemon-z-extractor extract-assets --source <game-directory> --output <output-directory>

Both commands are read-only for the source game. The output directory must be
outside the source game.
`;

function readOption(args: readonly string[], option: string): string | undefined {
  const index = args.indexOf(option);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Valeur manquante pour ${option}.`);
  }
  return value;
}

function parsePathArguments(args: readonly string[]): PathArguments {
  const sourceDirectory = readOption(args, "--source");
  const outputDirectory = readOption(args, "--output");

  if (sourceDirectory === undefined || outputDirectory === undefined) {
    throw new Error("Les options --source et --output sont obligatoires.");
  }

  const accepted = new Set(["--source", sourceDirectory, "--output", outputDirectory]);
  const unknown = args.filter((argument) => !accepted.has(argument));
  if (unknown.length > 0) {
    throw new Error(`Argument inconnu : ${unknown[0]}`);
  }

  const invocationDirectory = process.env.INIT_CWD ?? process.cwd();
  return {
    sourceDirectory: path.resolve(invocationDirectory, sourceDirectory),
    outputDirectory: path.resolve(invocationDirectory, outputDirectory),
  };
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  if (command === undefined || command === "--help" || command === "-h") {
    process.stdout.write(HELP);
    return;
  }

  if (command !== "inventory" && command !== "extract-pbs" && command !== "extract-runtime"
    && command !== "extract-assets") {
    throw new Error(`Commande inconnue : ${command}`);
  }

  const options = parsePathArguments(args);
  if (command === "inventory") {
    const result = await createInventory(options);
    process.stdout.write(`Manifest written: ${result.manifestPath}\n`);
    process.stdout.write(`Source fingerprint: ${result.rootSha256}\n`);
    return;
  }

  if (command === "extract-runtime") {
    const result = await extractRuntimeData(options.sourceDirectory, options.outputDirectory);
    process.stdout.write(`Runtime data written to: ${result.outputDirectory}\n`);
    process.stdout.write(`Scripts: ${result.scriptCount}\n`);
    process.stdout.write(`Maps: ${result.mapCount}\n`);
    process.stdout.write(`Localized texts: ${result.localizedTextCount}\n`);
    process.stdout.write(`Battle animations normalized: ${result.battleAnimationCount}\n`);
    return;
  }
  if (command === "extract-assets") {
    const result = await extractAssets(options.sourceDirectory, options.outputDirectory);
    process.stdout.write(`Asset data written to: ${result.outputDirectory}\n`);
    process.stdout.write(`Assets: ${result.assetCount}\n`);
    process.stdout.write(`Pokemon indexed: ${result.pokemonCount}\n`);
    return;
  }

  const result = await extractPbsData(options.sourceDirectory, options.outputDirectory);
  process.stdout.write(`PBS data written to: ${result.outputDirectory}\n`);
  for (const [kind, summary] of Object.entries(result.report.datasets)) {
    process.stdout.write(
      `${kind}: ${summary.records} records, ${summary.uniqueIds} unique IDs\n`,
    );
  }
  process.stdout.write(`Diagnostics: ${result.report.diagnostics.length}\n`);
  process.stdout.write(
    `Reference validation: ${result.validationReport.summary.errors} errors, ${result.validationReport.summary.warnings} warnings\n`,
  );
  process.stdout.write(
    `Engine support: ${result.engineSupportReport.summary.supportedMechanics}/${result.engineSupportReport.summary.extractedMechanics} mechanics\n`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
