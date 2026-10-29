import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, "..");
const androidDirectory = path.join(appDirectory, "android");
const windows = process.platform === "win32";
const javaExecutable = windows ? "java.exe" : "java";
const javaCandidates = [
  process.env.JAVA_HOME,
  windows ? "C:\\Program Files\\Android\\Android Studio\\jbr" : undefined,
  process.platform === "darwin" ? "/Applications/Android Studio.app/Contents/jbr/Contents/Home" : undefined,
].filter((candidate) => typeof candidate === "string");
const javaHome = javaCandidates.find((candidate) => existsSync(path.join(candidate, "bin", javaExecutable)));

if (javaHome === undefined) {
  throw new Error("JDK Android introuvable. Lancez Android Studio ou définissez JAVA_HOME avant de construire l’APK.");
}

const wrapper = path.join(androidDirectory, "gradle", "wrapper", "gradle-wrapper.jar");
if (!existsSync(wrapper)) throw new Error("Gradle Wrapper introuvable.");
const java = path.join(javaHome, "bin", javaExecutable);
const result = spawnSync(java, ["-cp", wrapper, "org.gradle.wrapper.GradleWrapperMain", "assembleDebug"], {
  cwd: androidDirectory,
  env: { ...process.env, JAVA_HOME: javaHome },
  stdio: "inherit",
});

if (result.error !== undefined) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

process.stdout.write(`APK debug prêt : ${path.join(androidDirectory, "app", "build", "outputs", "apk", "debug", "app-debug.apk")}\n`);
