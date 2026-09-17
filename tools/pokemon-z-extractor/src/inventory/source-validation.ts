import { access, stat } from "node:fs/promises";
import path from "node:path";

const REQUIRED_FILES = ["Game.ini"] as const;
const REQUIRED_DIRECTORIES = ["Data", "Graphics", "PBS"] as const;

async function assertFile(filePath: string): Promise<void> {
  await access(filePath);
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) {
    throw new Error(`Fichier source attendu introuvable : ${filePath}`);
  }
}

async function assertDirectory(directoryPath: string): Promise<void> {
  await access(directoryPath);
  const directoryStat = await stat(directoryPath);
  if (!directoryStat.isDirectory()) {
    throw new Error(`Dossier source attendu introuvable : ${directoryPath}`);
  }
}

export async function validatePokemonZSource(sourceDirectory: string): Promise<void> {
  await Promise.all([
    ...REQUIRED_FILES.map((name) => assertFile(path.join(sourceDirectory, name))),
    ...REQUIRED_DIRECTORIES.map((name) => assertDirectory(path.join(sourceDirectory, name))),
  ]);
}
