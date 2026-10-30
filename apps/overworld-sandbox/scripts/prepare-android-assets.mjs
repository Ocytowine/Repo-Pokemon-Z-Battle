import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, "..");
const workspaceDirectory = path.resolve(appDirectory, "../..");
const localConfigurationPath = path.join(workspaceDirectory, ".pokemon-z", "local-test.json");
const androidAssetsDirectory = path.join(appDirectory, "dist", "__pokemon-z");
const slimBattlebacks = process.argv.includes("--slim-battlebacks");
if (process.argv.slice(2).some((argument) => argument !== "--slim-battlebacks")) {
  throw new Error("Option de préparation Android inconnue.");
}

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

const omittedBattlebacks = new Set();
const bundledWideBattlebacks = [];
let wideBattlebacksPackVersion = null;
if (slimBattlebacks) {
  const manifestPath = path.join(workspaceDirectory, ".pokemon-z", "packs", "battlebacks-wide.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest?.schemaVersion !== "1.0.0" || manifest.packId !== "battlebacks-wide"
    || typeof manifest.version !== "string" || !/^[a-f0-9]{64}$/.test(manifest.version)
    || !Array.isArray(manifest.files) || manifest.files.length !== 51) {
    throw new Error("Manifeste du pack de fonds invalide ; relancer resources:manifest.");
  }
  for (const file of manifest.files) {
    if (typeof file.path !== "string"
      || !/^Graphics\/Battlebacks\/battlebg[A-Za-z0-9_-]+Z\.png$/.test(file.path)
      || typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(file.sha256)
      || !Number.isSafeInteger(file.sizeBytes) || omittedBattlebacks.has(file.path)) {
      throw new Error("Entrée de fond large invalide.");
    }
    const source = path.join(configuration.sourceDirectory, ...file.path.split("/"));
    const bytes = await readFile(source);
    if (bytes.length !== file.sizeBytes
      || createHash("sha256").update(bytes).digest("hex") !== file.sha256) {
      throw new Error(`Fond large modifié depuis le manifeste : ${file.path}.`);
    }
    const legacyName = path.basename(file.path).replace(/Z\.png$/, ".png");
    const legacy = path.join(configuration.sourceDirectory, "Graphics", "Battlebacks", "OLD", legacyName);
    try { await access(legacy); omittedBattlebacks.add(file.path); }
    catch { bundledWideBattlebacks.push(file.path); }
  }
  wideBattlebacksPackVersion = manifest.version;
}

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
  const source = path.join(configuration.sourceDirectory, directory);
  await cp(source, path.join(sourceTarget, directory), { recursive: true,
    filter: (candidate) => !omittedBattlebacks.has(path.relative(configuration.sourceDirectory, candidate).replaceAll("\\", "/")) });
}

await writeFile(path.join(dataTarget, "android-resource-layout.json"),
  JSON.stringify({ schemaVersion: "1.0.0", wideBattlebacksBundled: !slimBattlebacks,
    wideBattlebacksPackVersion, bundledWideBattlebacks }));

process.stdout.write(`Données, images et sons locaux préparés dans dist/__pokemon-z ; ${omittedBattlebacks.size} fonds larges livrés par pack.\n`);
