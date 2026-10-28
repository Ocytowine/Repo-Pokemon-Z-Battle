import { createReadStream, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import androidVersion from "../android-version.json" with { type: "json" };

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(appDirectory, "android", "app", "build", "outputs", "apk", "release");
const apk = path.join(outputDirectory, "app-release.apk");
if (!existsSync(apk)) throw new Error("APK signée absente. Lancez android:release avant android:manifest.");
const windows = process.platform === "win32";
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT
  ?? path.join(os.homedir(), "AppData", "Local", "Android", "Sdk");
const buildTools = path.join(sdk, "build-tools");
const tools = (name) => readdirSync(buildTools).sort((a, b) => b.localeCompare(a, undefined,
  { numeric: true })).map((version) => path.join(buildTools, version, name)).find(existsSync);
const aapt = tools(windows ? "aapt.exe" : "aapt");
const apksigner = readdirSync(buildTools).sort((a, b) => b.localeCompare(a, undefined,
  { numeric: true })).map((version) => path.join(buildTools, version, "lib", "apksigner.jar")).find(existsSync);
if (!aapt || !apksigner) throw new Error("Outils Android de validation introuvables.");
const javaHome = [process.env.JAVA_HOME,
  windows ? "C:\\Program Files\\Android\\Android Studio\\jbr" : undefined]
  .find((candidate) => candidate && existsSync(path.join(candidate, "bin", windows ? "java.exe" : "java")));
if (!javaHome) throw new Error("JDK Android introuvable.");
const packageInfo = spawnSync(aapt, ["dump", "badging", apk], { encoding: "utf8" });
const expectedPackage = /package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/.exec(
  packageInfo.stdout);
if (packageInfo.status !== 0 || expectedPackage?.[1] !== "fr.ocytowine.pokemonzbattle"
  || Number(expectedPackage[2]) !== androidVersion.versionCode
  || expectedPackage[3] !== androidVersion.versionName) {
  throw new Error("Le nom de paquet ou la version de l'APK ne correspond pas au manifeste demandé.");
}
const signature = spawnSync(path.join(javaHome, "bin", windows ? "java.exe" : "java"),
  ["-jar", apksigner, "verify", "--print-certs", apk],
  { encoding: "utf8", env: { ...process.env, JAVA_HOME: javaHome } });
const fingerprint = /Signer #1 certificate SHA-256 digest:\s*([a-f0-9]{64})/i.exec(signature.stdout)?.[1];
if (signature.status !== 0 || fingerprint?.toLowerCase() !== androidVersion.signingCertificateSha256) {
  throw new Error("Le certificat de diffusion de l'APK ne correspond pas à celui du projet.");
}
const notes = readFileSync(path.join(appDirectory, "android-release-notes.md"), "utf8").trim();
if (!notes || notes.length > 2_000) throw new Error("Notes de version absentes ou trop longues.");
const hash = createHash("sha256");
for await (const chunk of createReadStream(apk)) hash.update(chunk);
const manifest = { versionCode: androidVersion.versionCode, versionName: androidVersion.versionName,
  notes, sizeBytes: statSync(apk).size, sha256: hash.digest("hex") };
const file = path.join(outputDirectory, "latest.json");
writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`Manifeste prêt : ${file}\nAPK privée : updates/android/pokemon-z-battle-${manifest.versionCode}.apk\n`);
