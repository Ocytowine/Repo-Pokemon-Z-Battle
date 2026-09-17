import { access, realpath } from "node:fs/promises";
import path from "node:path";

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function canonicalizeExistingOrFuturePath(candidate: string): Promise<string> {
  let cursor = path.resolve(candidate);
  const missingSegments: string[] = [];

  while (!(await pathExists(cursor))) {
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      throw new Error(`Impossible de resoudre le chemin : ${candidate}`);
    }
    missingSegments.push(path.basename(cursor));
    cursor = parent;
  }

  const canonicalParent = await realpath(cursor);
  return path.resolve(canonicalParent, ...missingSegments.reverse());
}

function isSameOrInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

export async function assertOutputOutsideSource(
  sourceDirectory: string,
  outputDirectory: string,
): Promise<{ readonly source: string; readonly output: string }> {
  const source = await realpath(path.resolve(sourceDirectory));
  const output = await canonicalizeExistingOrFuturePath(outputDirectory);

  if (isSameOrInside(source, output)) {
    throw new Error(
      "Le dossier de sortie doit etre distinct du jeu source et situe en dehors de celui-ci.",
    );
  }

  return { source, output };
}
