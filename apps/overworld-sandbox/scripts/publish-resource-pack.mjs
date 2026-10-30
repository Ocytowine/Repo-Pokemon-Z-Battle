import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceDirectory = path.resolve(appDirectory, "../..");
const localDirectory = path.join(workspaceDirectory, ".pokemon-z");
const configuration = JSON.parse(await readFile(path.join(localDirectory, "local-test.json"), "utf8"));
const manifestPath = path.join(localDirectory, "packs", "battlebacks-wide.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (configuration?.schemaVersion !== "2.0.0" || typeof configuration.sourceDirectory !== "string"
  || manifest.schemaVersion !== "1.0.0" || manifest.packId !== "battlebacks-wide"
  || !Array.isArray(manifest.files) || manifest.files.length === 0) {
  throw new Error("Configuration ou manifeste local invalide ; relancer prepare:local et resources:manifest.");
}

const objects = new Map();
let total = 0;
for (const file of manifest.files) {
  if (typeof file.path !== "string" || !/^Graphics\/Battlebacks\/battlebg[A-Za-z0-9_-]+Z\.png$/u.test(file.path)
    || typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(file.sha256)
    || !Number.isSafeInteger(file.sizeBytes) || file.sizeBytes < 1
    || file.objectKey !== `resources/sha256/${file.sha256.slice(0, 2)}/${file.sha256}.png`) {
    throw new Error("Entrée du manifeste invalide.");
  }
  const source = path.join(configuration.sourceDirectory, ...file.path.split("/"));
  const bytes = await readFile(source);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== file.sizeBytes || sha256 !== file.sha256) {
    throw new Error(`Ressource modifiée depuis l'inventaire : ${file.path}. Relancer resources:manifest.`);
  }
  total += bytes.length;
  if (!objects.has(file.sha256)) objects.set(file.sha256, { source, key: file.objectKey, bytes: bytes.length });
}
if (total !== manifest.totalBytes) throw new Error("Taille totale du manifeste incohérente.");

const publish = process.argv.includes("--publish");
process.stdout.write(`${objects.size} objets uniques vérifiés (${[...objects.values()].reduce((sum, item) => sum + item.bytes, 0)} octets).\n`);
if (!publish) {
  process.stdout.write("Contrôle local uniquement. Ajouter --publish après validation pour écrire sur R2.\n");
  process.exit(0);
}

const bucket = "r2-prive:pokemon-z-battle-saves-private";
for (const object of objects.values()) {
  const result = spawnSync("rclone", ["copyto", object.source, `${bucket}/${object.key}`,
    "--immutable", "--retries", "3"], { stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error(`Publication interrompue avant le manifeste : ${object.key}`);
}
if (process.argv.includes("--objects-only")) {
  process.stdout.write("Objets publiés ; manifeste volontairement retenu jusqu'au déploiement du Worker.\n");
  process.exit(0);
}
const result = spawnSync("rclone", ["copyto", manifestPath,
  `${bucket}/resources/packs/battlebacks-wide/latest.json`, "--retries", "3"], { stdio: "inherit" });
if (result.error || result.status !== 0) throw new Error("Objets publiés, mais manifeste non publié.");
process.stdout.write(`Pack ${manifest.version} publié après tous ses objets.\n`);
