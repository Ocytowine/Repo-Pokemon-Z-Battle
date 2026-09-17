import { opendir } from "node:fs/promises";
import path from "node:path";

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export async function discoverFiles(sourceDirectory: string): Promise<readonly string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    const handle = await opendir(directory);
    const entries = [];

    for await (const entry of handle) {
      entries.push(entry);
    }

    entries.sort((left, right) => compareText(left.name, right.name));

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Lien symbolique refuse dans la source : ${absolutePath}`);
      }
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        files.push(absolutePath);
      } else {
        throw new Error(`Type de fichier non pris en charge : ${absolutePath}`);
      }
    }
  }

  await visit(sourceDirectory);
  return files;
}
