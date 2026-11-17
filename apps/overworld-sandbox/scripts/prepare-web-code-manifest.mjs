import { createHash, createPrivateKey, sign } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = path.resolve(app, "../..");
const dist = path.join(app, "dist");
const keyFile = path.join(os.homedir(), ".pokemon-z-battle", "web-code-signing", "private.pem");
const manifestFile = path.join(workspace, ".pokemon-z", "updates", "web-code-latest.json");
const staged = path.join(workspace, ".pokemon-z", "updates", "web-code-objects");
if (!existsSync(keyFile)) throw new Error("Clé de code web absente ; exécuter webcode:key:create.");
const html = readFileSync(path.join(dist, "index.html"), "utf8");
const script = /<script\s+type="module"[^>]*src="\/(assets\/[^\"]+\.js)"[^>]*><\/script>/.exec(html)?.[1];
const style = /<link\s+rel="stylesheet"[^>]*href="\/(assets\/[^\"]+\.css)"[^>]*>/.exec(html)?.[1];
if (!script || !style) throw new Error("Entrées JavaScript et CSS Vite introuvables.");
const files = [];
for (const name of readdirSync(path.join(dist, "assets")).sort()) {
  const file = path.join(dist, "assets", name);
  if (!statSync(file).isFile() || !/^[A-Za-z0-9_.-]+\.(?:js|css|png|webp|svg|woff2?)$/.test(name)) {
    throw new Error(`Fichier de code web inattendu : ${name}`);
  }
  const bytes = readFileSync(file);
  if (bytes.length === 0 || bytes.length > 8 * 1024 * 1024) throw new Error(`Taille invalide : ${name}`);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const object = path.join(staged, "sha256", sha256.slice(0, 2), `${sha256}.bin`);
  mkdirSync(path.dirname(object), { recursive: true });
  if (existsSync(object)) {
    if (statSync(object).size !== bytes.length
      || createHash("sha256").update(readFileSync(object)).digest("hex") !== sha256) {
      throw new Error(`Objet de code local corrompu : ${sha256}`);
    }
  } else copyFileSync(file, object);
  files.push({ path: `assets/${name}`, sizeBytes: bytes.length, sha256 });
}
if (!files.some((file) => file.path === script) || !files.some((file) => file.path === style)) {
  throw new Error("Les entrées ne figurent pas dans le bundle.");
}
const hashAsset = (relative) => createHash("sha256")
  .update(readFileSync(path.join(dist, "__pokemon-z", "data", relative))).digest("hex");
const nativeVersionCode = JSON.parse(readFileSync(path.join(app, "android-version.json"), "utf8")).versionCode;
const payload = JSON.stringify({ schemaVersion: "1.0.0", nativeVersionCode,
  dataSha256: hashAsset("local-data-manifest.json"),
  assetSha256: hashAsset("asset-manifest.json"),
  layoutSha256: hashAsset("android-resource-layout.json"), entryScript: script, entryStyle: style, files });
const version = createHash("sha256").update(payload).digest("hex");
const signature = sign("sha256", Buffer.from(payload), createPrivateKey(readFileSync(keyFile))).toString("base64");
mkdirSync(path.dirname(manifestFile), { recursive: true });
writeFileSync(manifestFile, `${JSON.stringify({ version, payload, signature }, null, 2)}\n`);
process.stdout.write(`Code web préparé : ${files.length} fichiers, ${files.reduce((n, f) => n + f.sizeBytes, 0)} octets, version ${version}.\nManifeste : ${manifestFile}\nAucun fichier du jeu source inclus.\n`);
