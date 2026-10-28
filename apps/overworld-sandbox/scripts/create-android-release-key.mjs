import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const directory = path.join(os.homedir(), ".pokemon-z-battle", "android-signing");
const keyStore = path.join(directory, "release.p12");
const credentials = path.join(directory, "release-credentials.json");
if (existsSync(keyStore) || existsSync(credentials)) {
  throw new Error(`Une clé de diffusion existe déjà dans ${directory}. Aucune clé n'a été remplacée.`);
}
const javaHome = [process.env.JAVA_HOME,
  process.platform === "win32" ? "C:\\Program Files\\Android\\Android Studio\\jbr" : undefined]
  .find((candidate) => candidate && existsSync(path.join(candidate, "bin",
    process.platform === "win32" ? "keytool.exe" : "keytool")));
if (!javaHome) throw new Error("JDK Android introuvable. Lancez Android Studio ou définissez JAVA_HOME.");

mkdirSync(directory, { recursive: true, mode: 0o700 });
const password = randomBytes(36).toString("base64url");
const alias = "pokemon-z-battle";
const keytool = path.join(javaHome, "bin", process.platform === "win32" ? "keytool.exe" : "keytool");
const result = spawnSync(keytool, ["-genkeypair", "-keystore", keyStore, "-storetype", "PKCS12",
  "-alias", alias, "-keyalg", "RSA", "-keysize", "4096", "-sigalg", "SHA256withRSA",
  "-validity", "10950", "-dname", "CN=Pokemon Z Battle, O=Private Distribution, C=FR",
  "-storepass:env", "PZB_KEY_SETUP_PASSWORD", "-keypass:env", "PZB_KEY_SETUP_PASSWORD"],
{ env: { ...process.env, PZB_KEY_SETUP_PASSWORD: password }, stdio: "inherit" });
if (result.error || result.status !== 0) {
  rmSync(keyStore, { force: true });
  throw result.error ?? new Error(`Création de clé impossible (code ${result.status}).`);
}
writeFileSync(credentials, JSON.stringify({ alias, password }, null, 2),
  { flag: "wx", mode: 0o600 });
process.stdout.write(`Clé de diffusion créée dans ${directory}. Sauvegardez release.p12 et release-credentials.json hors de ce PC avant toute publication.\n`);
