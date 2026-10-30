import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceDirectory = path.resolve(appDirectory, "../..");
const localDirectory = path.join(workspaceDirectory, ".pokemon-z");
const configuration = JSON.parse(await readFile(path.join(localDirectory, "local-test.json"), "utf8"));
const manifestPath = path.join(localDirectory, "packs", "bgm.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (configuration?.schemaVersion !== "2.0.0" || typeof configuration.sourceDirectory !== "string"
  || manifest?.schemaVersion !== "1.0.0" || manifest.packId !== "bgm"
  || !Array.isArray(manifest.files) || manifest.files.length === 0 || manifest.files.length > 500) {
  throw new Error("Configuration ou manifeste BGM invalide.");
}
const objects = new Map();
let total = 0;
for (const file of manifest.files) {
  if (typeof file.path !== "string" || !/^Audio\/BGM\/[A-Za-z0-9_ -]+\.(ogg|mp3)$/u.test(file.path)
    || typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(file.sha256)
    || !Number.isSafeInteger(file.sizeBytes) || file.sizeBytes < 1 || file.sizeBytes > 16 * 1024 * 1024
    || file.objectKey !== `resources/audio/sha256/${file.sha256.slice(0, 2)}/${file.sha256}.bin`) {
    throw new Error("Entrée BGM invalide.");
  }
  const source = path.join(configuration.sourceDirectory, ...file.path.split("/"));
  const bytes = await readFile(source);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== file.sizeBytes || sha256 !== file.sha256) {
    throw new Error(`BGM modifié depuis l'inventaire : ${file.path}. Relancer bgm:manifest.`);
  }
  total += bytes.length;
  if (!objects.has(file.sha256)) objects.set(file.sha256, { source, key: file.objectKey, bytes: bytes.length });
}
if (total !== manifest.totalBytes) throw new Error("Taille totale BGM incohérente.");
const publish = process.argv.includes("--publish");
process.stdout.write(`${objects.size} objets BGM uniques vérifiés (${[...objects.values()].reduce((sum, item) => sum + item.bytes, 0)} octets).\n`);
if (!publish) {
  process.stdout.write("Contrôle local uniquement. Ajouter --publish pour écrire sur R2.\n");
  process.exit(0);
}
const bucket = "r2-prive:pokemon-z-battle-saves-private";
for (const object of objects.values()) {
  const result = spawnSync("rclone", ["copyto", object.source, `${bucket}/${object.key}`,
    "--immutable", "--retries", "3"], { stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error(`Publication BGM interrompue : ${object.key}`);
}
const listing = spawnSync("rclone", ["lsf", `${bucket}/resources/audio/sha256`,
  "--recursive", "--files-only", "--format", "sp"], { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
if (listing.error || listing.status !== 0) throw new Error("Lecture des tailles BGM distantes impossible.");
const remoteSizes = new Map(listing.stdout.trim().split(/\r?\n/u).map((line) => {
  const separator = line.indexOf(";");
  return [line.slice(separator + 1), Number(line.slice(0, separator))];
}));
for (const object of objects.values()) {
  const relative = object.key.slice("resources/audio/sha256/".length);
  if (remoteSizes.get(relative) !== object.bytes) {
    throw new Error(`Taille distante du BGM invalide : ${relative}`);
  }
}
process.stdout.write(`${objects.size} objets BGM contrôlés sur R2 par leur taille.\n`);
if (process.argv.includes("--objects-only")) {
  process.stdout.write("Objets BGM publiés ; manifeste retenu jusqu'au déploiement du Worker.\n");
  process.exit(0);
}
const result = spawnSync("rclone", ["copyto", manifestPath,
  `${bucket}/resources/packs/bgm/latest.json`, "--retries", "3"], { stdio: "inherit" });
if (result.error || result.status !== 0) throw new Error("Objets BGM publiés, manifeste absent.");
process.stdout.write(`Pack BGM ${manifest.version} publié après tous ses objets.\n`);
