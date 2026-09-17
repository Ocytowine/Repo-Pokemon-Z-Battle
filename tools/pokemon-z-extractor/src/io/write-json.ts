import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function writeJsonAtomically(
  outputDirectory: string,
  fileName: string,
  value: unknown,
): Promise<string> {
  await mkdir(outputDirectory, { recursive: true });
  const destination = path.join(outputDirectory, fileName);
  const temporary = path.join(
    outputDirectory,
    `.${fileName}.${process.pid}.${randomUUID()}.tmp`,
  );

  try {
    await writeFile(temporary, serializeJson(value), { encoding: "utf8", flag: "wx" });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }

  return destination;
}
