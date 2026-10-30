import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceDirectory = path.resolve(appDirectory, "../..");
const localDirectory = path.join(workspaceDirectory, ".pokemon-z");
const configuration = JSON.parse(await readFile(path.join(localDirectory, "local-test.json"), "utf8"));
if (configuration?.schemaVersion !== "2.0.0" || typeof configuration.sourceDirectory !== "string") {
  throw new Error("Configuration locale absente : relancer corepack pnpm prepare:local.");
}

const directory = path.join(configuration.sourceDirectory, "Audio", "BGM");
const names = (await readdir(directory)).filter((name) => /\.(ogg|mp3)$/iu.test(name)).sort();
if (names.length === 0) throw new Error("Aucune musique de fond trouvée.");
const files = [];
for (const name of names) {
  if (!/^[A-Za-z0-9_ -]+\.(ogg|mp3)$/u.test(name)) throw new Error(`Nom BGM à examiner : ${name}`);
  const bytes = await readFile(path.join(directory, name));
  if (bytes.length < 1 || bytes.length > 16 * 1024 * 1024) throw new Error(`Taille BGM invalide : ${name}`);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  files.push({ path: `Audio/BGM/${name}`, sizeBytes: bytes.length, sha256,
    objectKey: `resources/audio/sha256/${sha256.slice(0, 2)}/${sha256}.bin` });
}
const version = createHash("sha256").update(files.map((file) =>
  `${file.path}\t${file.sizeBytes}\t${file.sha256}\n`).join("")).digest("hex");
const manifest = { schemaVersion: "1.0.0", packId: "bgm", version,
  totalBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0), files };
const outputDirectory = path.join(localDirectory, "packs");
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, "bgm.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${files.length} BGM, ${manifest.totalBytes} octets, version ${version}\n`);
