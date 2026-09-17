import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildSourceManifest } from "../src/inventory/build-manifest.js";
import { createInventory } from "../src/inventory/create-inventory.js";

const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "pokemon-z-extractor-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function makePokemonZFixture(root: string): Promise<string> {
  const source = path.join(root, "source");
  await Promise.all([
    mkdir(path.join(source, "Data"), { recursive: true }),
    mkdir(path.join(source, "Graphics"), { recursive: true }),
    mkdir(path.join(source, "PBS"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(source, "Game.ini"), "[Game]\nTitle=Fixture\n", "utf8"),
    writeFile(path.join(source, "Data", "z.bin"), Buffer.from([0, 1, 2, 3])),
    writeFile(path.join(source, "PBS", "a.txt"), "Bulbasaur\n", "utf8"),
  ]);
  return source;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("buildSourceManifest", () => {
  it("sorts paths and produces stable hashes without exposing the absolute path", async () => {
    const root = await makeTemporaryDirectory();
    const source = await makePokemonZFixture(root);

    const first = await buildSourceManifest(source, 2);
    const second = await buildSourceManifest(source, 1);

    expect(first).toEqual(second);
    expect(first.files.map((file) => file.path)).toEqual([
      "Data/z.bin",
      "Game.ini",
      "PBS/a.txt",
    ]);
    expect(first.summary).toEqual({ fileCount: 3, totalBytes: 35 });
    expect(JSON.stringify(first)).not.toContain(source);
    expect(first.files[0]?.sha256).toBe(
      createHash("sha256").update(Buffer.from([0, 1, 2, 3])).digest("hex"),
    );
  });
});

describe("createInventory", () => {
  it("writes a deterministic manifest outside the source", async () => {
    const root = await makeTemporaryDirectory();
    const source = await makePokemonZFixture(root);
    const output = path.join(root, "output");

    const first = await createInventory({ sourceDirectory: source, outputDirectory: output });
    const firstContents = await readFile(first.manifestPath, "utf8");
    const second = await createInventory({ sourceDirectory: source, outputDirectory: output });
    const secondContents = await readFile(second.manifestPath, "utf8");

    expect(first.rootSha256).toBe(second.rootSha256);
    expect(firstContents).toBe(secondContents);
    expect(firstContents.endsWith("\n")).toBe(true);
  });
});
