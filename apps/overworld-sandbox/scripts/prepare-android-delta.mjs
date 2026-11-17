import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApkDelta } from "./apk-delta.mjs";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const release = path.join(app, "android", "app", "build", "outputs", "apk", "release");
const [base, fromCodeRaw] = process.argv.slice(2);
const fromCode = Number(fromCodeRaw);
if (!base || !Number.isSafeInteger(fromCode) || fromCode <= 0 || !existsSync(base)) {
  throw new Error("Usage : pnpm android:delta <APK publiée précédente> <versionCode précédent>.");
}
const manifestPath = path.join(release, "latest.json");
if (!existsSync(manifestPath)) throw new Error("Lancez android:manifest avant android:delta.");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (fromCode >= manifest.versionCode) throw new Error("La version de base doit être antérieure.");
const windows = process.platform === "win32";
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT
  ?? path.join(os.homedir(), "AppData", "Local", "Android", "Sdk");
const buildTools = path.join(sdk, "build-tools");
const versions = readdirSync(buildTools).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
const tool = (name) => versions.map((version) => path.join(buildTools, version, name)).find(existsSync);
const aapt = tool(windows ? "aapt.exe" : "aapt");
const signer = tool(path.join("lib", "apksigner.jar"));
const javaHome = [process.env.JAVA_HOME,
  windows ? "F:\\Android Studio\\jbr" : undefined,
  windows ? "C:\\Program Files\\Android\\Android Studio\\jbr" : undefined]
  .find((candidate) => candidate && existsSync(path.join(candidate, "bin", windows ? "java.exe" : "java")));
if (!aapt || !signer || !javaHome) throw new Error("Outils Android de vérification introuvables.");
const info = spawnSync(aapt, ["dump", "badging", base], { encoding: "utf8" });
const packageInfo = /package: name='([^']+)' versionCode='([^']+)'/.exec(info.stdout);
if (info.status !== 0 || packageInfo?.[1] !== "fr.ocytowine.pokemonzbattle"
  || Number(packageInfo[2]) !== fromCode) throw new Error("L'APK de base a un autre paquet ou versionCode.");
const signature = spawnSync(path.join(javaHome, "bin", windows ? "java.exe" : "java"),
  ["-jar", signer, "verify", "--print-certs", base], { encoding: "utf8" });
const fingerprint = /Signer #1 certificate SHA-256 digest:\s*([a-f0-9]{64})/i.exec(signature.stdout)?.[1];
const expectedFingerprint = JSON.parse(readFileSync(path.join(app, "android-version.json"), "utf8"))
  .signingCertificateSha256;
if (signature.status !== 0 || fingerprint?.toLowerCase() !== expectedFingerprint) {
  throw new Error("Le certificat de l'APK de base est incorrect.");
}
const target = path.join(release, "app-release.apk");
const output = path.join(release, `pokemon-z-battle-${fromCode}-to-${manifest.versionCode}.pzb.gz`);
const delta = await createApkDelta(base, target, output);
if (delta.targetSha256 !== manifest.sha256 || delta.targetSizeBytes !== manifest.sizeBytes) {
  throw new Error("L'APK cible ne correspond pas au manifeste signé.");
}
if (delta.sizeBytes >= manifest.sizeBytes * 0.9) {
  throw new Error("Patch insuffisamment petit : conserver la mise à jour APK complète.");
}
const offer = { fromVersionCode: fromCode, fromSha256: delta.baseSha256,
  fromSizeBytes: delta.baseSizeBytes, sizeBytes: delta.sizeBytes, sha256: delta.sha256 };
const deltas = (manifest.deltas ?? []).filter((item) => item.fromVersionCode !== fromCode);
writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, deltas: [...deltas, offer] }, null, 2)}\n`);
process.stdout.write(`Patch : ${output}\nRéutilisé : ${delta.reusedBytes} octets ; téléchargement : ${delta.sizeBytes} octets (${Math.round(delta.sizeBytes / manifest.sizeBytes * 100)} % de l'APK).\nPublier l'APK, puis le patch, vérifier les deux objets, et seulement ensuite latest.json.\n`);
