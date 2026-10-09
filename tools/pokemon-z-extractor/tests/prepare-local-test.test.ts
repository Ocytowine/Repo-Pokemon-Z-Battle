import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { GAME_DATA_SCHEMA_VERSION, LOCAL_DATA_MANIFEST_SCHEMA_VERSION, LOCAL_DATA_REQUIRED_FILES }
  from "@pokemon-z-battle/game-data";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LOCAL_TEST_CONFIG_SCHEMA_VERSION, readExistingLocalTestPaths, writeLocalDataManifest,
  writeLocalTestConfiguration } from "../src/runtime/prepare-local-test.js";

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
  it("still reads the legacy configuration from the default data directory", async () => {
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

  it("gives each workstation an ignored configuration with independent source and data paths", async () => {
    const workspace = await temporaryWorkspace();
    const source = path.join(workspace, "Pokemon Z source");
    const output = path.join(workspace, "extracted elsewhere");

    const configPath = await writeLocalTestConfiguration(workspace,
      { sourceDirectory: source, outputDirectory: output });

    expect(configPath).toBe(path.join(workspace, ".pokemon-z", "local-test.json"));
    expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual({
      schemaVersion: LOCAL_TEST_CONFIG_SCHEMA_VERSION,
      sourceDirectory: source,
      dataDirectory: output,
    });
    await expect(readExistingLocalTestPaths(workspace)).resolves.toEqual({
      sourceDirectory: source,
      outputDirectory: output,
    });
  });

  it("writes the manifest last only when every required runtime file exists", async () => {
    const output = await temporaryWorkspace();
    await Promise.all(LOCAL_DATA_REQUIRED_FILES.map(async (file) => {
      const destination = path.join(output, ...file.split("/"));
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, "{}\n", "utf8");
    }));
    await mkdir(path.join(output, "maps"), { recursive: true });
    await writeFile(path.join(output, "maps", "Map003.json"), "{}\n", "utf8");

    const manifestPath = await writeLocalDataManifest(output, new Date("2026-10-09T10:00:00.000Z"));
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;

    expect(manifest).toMatchObject({ schemaVersion: LOCAL_DATA_MANIFEST_SCHEMA_VERSION,
      gameDataSchemaVersion: GAME_DATA_SCHEMA_VERSION, generatedAt: "2026-10-09T10:00:00.000Z" });
    expect(manifest.files).toContain("machines.json");
    expect(manifest.files).toContain("maps/Map003.json");
  });

  it("refuses to certify an incomplete extraction", async () => {
    const output = await temporaryWorkspace();
    await writeFile(path.join(output, "items.json"), "{}\n", "utf8");
    await expect(writeLocalDataManifest(output)).rejects.toThrow("machines.json");
  });
});
