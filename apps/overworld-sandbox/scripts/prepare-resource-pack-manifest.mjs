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

const battlebacksDirectory = path.join(configuration.sourceDirectory, "Graphics", "Battlebacks");
const names = (await readdir(battlebacksDirectory)).filter((name) => /^battlebg.+Z\.png$/iu.test(name)).sort();
if (names.length === 0) throw new Error("Aucun fond de combat large trouvé.");

const files = [];
for (const name of names) {
  const bytes = await readFile(path.join(battlebacksDirectory, name));
  if (bytes.toString("hex", 0, 8) !== "89504e470d0a1a0a") throw new Error(`PNG invalide : ${name}`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== 2400 || height !== 1080) throw new Error(`Dimensions inattendues pour ${name} : ${width} × ${height}`);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  files.push({ path: `Graphics/Battlebacks/${name}`, sizeBytes: bytes.length, sha256,
    objectKey: `resources/sha256/${sha256.slice(0, 2)}/${sha256}.png` });
}

const version = createHash("sha256").update(files.map((file) =>
  `${file.path}\t${file.sizeBytes}\t${file.sha256}\n`).join("")).digest("hex");
const manifest = { schemaVersion: "1.0.0", packId: "battlebacks-wide", version,
  totalBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0), files };
const outputDirectory = path.join(localDirectory, "packs");
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, "battlebacks-wide.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${files.length} fonds, ${manifest.totalBytes} octets, version ${version}\n`);
