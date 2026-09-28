import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readExistingLocalTestPaths } from "../src/runtime/prepare-local-test.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryWorkspace(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "pokemon-z-local-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

describe("local test configuration", () => {
  it("reuses the source recorded by the first preparation", async () => {
    const workspace = await temporaryWorkspace();
    const output = path.join(workspace, ".pokemon-z", "data");
    const source = path.join(workspace, "Pokemon Z source");
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, "local-test.json"), `${JSON.stringify({ schemaVersion: "1.0.0", sourceDirectory: source })}\n`, "utf8");

    await expect(readExistingLocalTestPaths(workspace)).resolves.toEqual({ sourceDirectory: source, outputDirectory: output });
  });

  it("explains how to configure a missing local source", async () => {
    const workspace = await temporaryWorkspace();
    await expect(readExistingLocalTestPaths(workspace)).rejects.toThrow("--source et --output");
  });
});
