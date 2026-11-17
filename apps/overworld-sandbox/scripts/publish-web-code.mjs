import { createHash, createPublicKey, verify } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = path.resolve(app, "../..");
const base = path.join(workspace, ".pokemon-z", "updates");
const manifestPath = path.join(base, "web-code-latest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const payload = JSON.parse(manifest.payload);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const publicKey = createPublicKey({ key: readFileSync(path.join(app, "android", "app", "src",
  "main", "assets", "web-code-public.der")), format: "der", type: "spki" });
if (sha(Buffer.from(manifest.payload)) !== manifest.version
  || !verify("sha256", Buffer.from(manifest.payload), publicKey,
    Buffer.from(manifest.signature, "base64"))
  || payload.schemaVersion !== "1.0.0" || !Array.isArray(payload.files)
  || payload.files.length < 2 || payload.files.length > 200) {
  throw new Error("Manifeste du code web invalide ou non signé par cette APK.");
}
const objects = new Map();
for (const file of payload.files) {
  if (typeof file.path !== "string" || !/^assets\/[A-Za-z0-9_.-]+\.(js|css|png|webp|svg|woff2?)$/.test(file.path)
    || typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(file.sha256)
    || !Number.isSafeInteger(file.sizeBytes) || file.sizeBytes < 1 || file.sizeBytes > 8 * 1024 * 1024) {
    throw new Error("Inventaire du code web invalide.");
  }
  const source = path.join(base, "web-code-objects", "sha256", file.sha256.slice(0, 2),
    `${file.sha256}.bin`);
  if (statSync(source).size !== file.sizeBytes || sha(readFileSync(source)) !== file.sha256) {
    throw new Error(`Objet de code absent ou modifié : ${file.path}`);
  }
  objects.set(file.sha256, { source, key: `updates/web/sha256/${file.sha256.slice(0, 2)}/${file.sha256}.bin`,
    size: file.sizeBytes });
}
const bucket = "r2-prive:pokemon-z-battle-saves-private";
const publish = process.argv.includes("--publish");
process.stdout.write(`${objects.size} objets de code vérifiés, ${[...objects.values()]
  .reduce((sum, value) => sum + value.size, 0)} octets ; version ${manifest.version}.\n`);
if (!publish) {
  process.stdout.write("Contrôle local uniquement. Ajouter --publish pour envoyer sur R2.\n");
  process.exit(0);
}
for (const object of objects.values()) {
  const result = spawnSync("rclone", ["copyto", object.source, `${bucket}/${object.key}`,
    "--immutable", "--retries", "3"], { stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error(`Envoi interrompu : ${object.key}`);
}
const remote = spawnSync("rclone", ["lsf", `${bucket}/updates/web/sha256`, "--recursive",
  "--files-only", "--format", "sp"], { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
if (remote.error || remote.status !== 0) throw new Error("Vérification distante des objets impossible.");
const sizes = new Map(remote.stdout.trim().split(/\r?\n/).map((line) => {
  const separator = line.indexOf(";");
  return [line.slice(separator + 1), Number(line.slice(0, separator))];
}));
for (const object of objects.values()) {
  const relative = object.key.slice("updates/web/sha256/".length);
  if (sizes.get(relative) !== object.size) throw new Error(`Objet distant incomplet : ${relative}`);
}
if (process.argv.includes("--objects-only")) {
  process.stdout.write("Objets envoyés ; manifeste retenu.\n");
  process.exit(0);
}
const latest = spawnSync("rclone", ["copyto", manifestPath, `${bucket}/updates/web/latest.json`,
  "--retries", "3"], { stdio: "inherit" });
if (latest.error || latest.status !== 0) throw new Error("Objets envoyés, manifeste non publié.");
process.stdout.write("Correctif de code publié après vérification des objets.\n");
