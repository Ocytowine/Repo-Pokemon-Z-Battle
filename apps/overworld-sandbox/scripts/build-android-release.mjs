import { existsSync, readFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import androidVersion from "../android-version.json" with { type: "json" };

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidDirectory = path.join(appDirectory, "android");
const credentialsPath = path.join(os.homedir(), ".pokemon-z-battle", "android-signing",
  "release-credentials.json");
if (!existsSync(credentialsPath)) {
  throw new Error("Clé de diffusion absente. Lancez d'abord android:key:create sur le PC propriétaire.");
}
const credentials = JSON.parse(readFileSync(credentialsPath, "utf8"));
const keyStore = path.join(path.dirname(credentialsPath), "release.p12");
if (!existsSync(keyStore) || typeof credentials.alias !== "string"
  || typeof credentials.password !== "string") {
  throw new Error("Clé de diffusion ou fichier d'accès invalide.");
}
const windows = process.platform === "win32";
const javaBinary = windows ? "java.exe" : "java";
const javaHome = [process.env.JAVA_HOME,
  windows ? "C:\\Program Files\\Android\\Android Studio\\jbr" : undefined]
  .find((candidate) => candidate && existsSync(path.join(candidate, "bin", javaBinary)));
if (!javaHome) throw new Error("JDK Android introuvable.");

const env = { ...process.env, JAVA_HOME: javaHome,
  PZB_RELEASE_STORE_PATH: keyStore,
  PZB_RELEASE_STORE_PASSWORD: credentials.password,
  PZB_RELEASE_KEY_ALIAS: credentials.alias,
  PZB_RELEASE_KEY_PASSWORD: credentials.password };
const java = path.join(javaHome, "bin", javaBinary);
const wrapper = path.join(androidDirectory, "gradle", "wrapper", "gradle-wrapper.jar");
if (!existsSync(wrapper)) throw new Error("Gradle Wrapper introuvable.");
const built = spawnSync(java, ["-cp", wrapper, "org.gradle.wrapper.GradleWrapperMain", "assembleRelease"],
  { cwd: androidDirectory, env, stdio: "inherit" });
if (built.error) throw built.error;
if (built.status !== 0) process.exit(built.status ?? 1);

const apk = path.join(androidDirectory, "app", "build", "outputs", "apk", "release", "app-release.apk");
if (!existsSync(apk)) throw new Error("L'APK de diffusion signée est introuvable.");
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT
  ?? path.join(os.homedir(), "AppData", "Local", "Android", "Sdk");
const toolsDirectory = path.join(sdk, "build-tools");
const versions = readdirSync(toolsDirectory).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
const apksigner = versions.map((version) => path.join(toolsDirectory, version,
  "lib", "apksigner.jar")).find(existsSync);
if (!apksigner) throw new Error("apksigner introuvable : signature non vérifiée.");
const checked = spawnSync(java, ["-jar", apksigner, "verify", "--print-certs", apk],
  { cwd: androidDirectory, env, encoding: "utf8" });
if (checked.error || checked.status !== 0) {
  throw checked.error ?? new Error("La signature de l'APK est invalide.");
}
const fingerprint = /Signer #1 certificate SHA-256 digest:\s*([a-f0-9]{64})/i.exec(checked.stdout)?.[1];
if (fingerprint?.toLowerCase() !== androidVersion.signingCertificateSha256) {
  throw new Error("Le certificat de l'APK ne correspond pas à la clé de diffusion enregistrée.");
}
process.stdout.write(`Certificat vérifié : SHA-256 ${fingerprint.toLowerCase()}\n`);
process.stdout.write(`APK de diffusion signée prêt : ${apk}\n`);
