import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(os.homedir(), ".pokemon-z-battle", "web-code-signing");
const privatePath = path.join(directory, "private.pem");
const publicPath = path.join(app, "android", "app", "src", "main", "assets", "web-code-public.der");
if (existsSync(privatePath) || existsSync(publicPath)) {
  throw new Error("Une clé de code web existe déjà ; ne pas la remplacer.");
}
mkdirSync(directory, { recursive: true });
mkdirSync(path.dirname(publicPath), { recursive: true });
const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
writeFileSync(privatePath, pair.privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
writeFileSync(publicPath, pair.publicKey.export({ type: "spki", format: "der" }));
process.stdout.write("Clé privée créée hors dépôt et clé publique Android créée. Sauvegarder la clé privée avant diffusion.\n");
