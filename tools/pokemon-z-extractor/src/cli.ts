#!/usr/bin/env node
import path from "node:path";
import { createInventory } from "./inventory/create-inventory.js";

interface InventoryArguments {
  readonly sourceDirectory: string;
  readonly outputDirectory: string;
}

const HELP = `Pokemon Z extractor

Usage:
  pokemon-z-extractor inventory --source <game-directory> --output <output-directory>

The inventory command reads the source directory and writes source-manifest.json
outside it. It never writes to the source game.
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

function parseInventoryArguments(args: readonly string[]): InventoryArguments {
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

  if (command !== "inventory") {
    throw new Error(`Commande inconnue : ${command}`);
  }

  const options = parseInventoryArguments(args);
  const result = await createInventory(options);
  process.stdout.write(`Manifest written: ${result.manifestPath}\n`);
  process.stdout.write(`Source fingerprint: ${result.rootSha256}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
