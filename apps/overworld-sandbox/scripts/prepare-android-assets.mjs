import { access, cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, "..");
const workspaceDirectory = path.resolve(appDirectory, "../..");
const localConfigurationPath = path.join(workspaceDirectory, ".pokemon-z", "local-test.json");
const androidAssetsDirectory = path.join(appDirectory, "dist", "__pokemon-z");

const runtimeDataFiles = [
  "abilities.json",
  "alchemy-recipes.json",
  "asset-manifest.json",
  "battle-animations.json",
  "common-events.json",
  "encounter-modifiers.json",
  "encounters.json",
  "items.json",
  "local-data-manifest.json",
  "localization.json",
  "machines.json",
  "map-animations.json",
  "map-battle-metadata.json",
  "map-infos.json",
  "mega-evolutions.json",
  "moves.json",
  "player-avatar-report.json",
  "player-avatars.json",
  "pokemon-assets.json",
  "pokemon.json",
  "region-map.json",
  "tilesets.json",
  "trainer-types.json",
  "trainers.json",
  "types.json",
];

async function requireDirectory(directory, label) {
  try {
    await access(directory);
  } catch {
    throw new Error(`${label} introuvable : ${directory}\nRelancez corepack pnpm prepare:local avec le dossier Pokémon Z local.`);
  }
}

const configuration = JSON.parse(await readFile(localConfigurationPath, "utf8"));
if (configuration?.schemaVersion !== "2.0.0"
  || typeof configuration.sourceDirectory !== "string"
  || typeof configuration.dataDirectory !== "string") {
  throw new Error("Configuration .pokemon-z/local-test.json absente ou incompatible.");
}

await requireDirectory(configuration.sourceDirectory, "Dossier source Pokémon Z");
await requireDirectory(configuration.dataDirectory, "Données Pokémon Z extraites");

await rm(androidAssetsDirectory, { recursive: true, force: true });
const dataTarget = path.join(androidAssetsDirectory, "data");
const sourceTarget = path.join(androidAssetsDirectory, "source");
await mkdir(dataTarget, { recursive: true });
await mkdir(sourceTarget, { recursive: true });

for (const file of runtimeDataFiles) {
  await cp(path.join(configuration.dataDirectory, file), path.join(dataTarget, file));
}
for (const directory of ["maps", "events"]) {
  await cp(path.join(configuration.dataDirectory, directory), path.join(dataTarget, directory), { recursive: true });
}
for (const directory of ["Graphics", "Audio"]) {
  await cp(path.join(configuration.sourceDirectory, directory), path.join(sourceTarget, directory), { recursive: true });
}

process.stdout.write("Données, images et sons locaux préparés dans dist/__pokemon-z.\n");
