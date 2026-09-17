import { mkdtemp, mkdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertOutputOutsideSource } from "../src/inventory/path-safety.js";

const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "pokemon-z-path-safety-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("assertOutputOutsideSource", () => {
  it("rejects the source itself and its descendants", async () => {
    const root = await makeTemporaryDirectory();
    const source = path.join(root, "source");
    await mkdir(source);

    await expect(assertOutputOutsideSource(source, source)).rejects.toThrow(
      "situe en dehors",
    );
    await expect(
      assertOutputOutsideSource(source, path.join(source, "generated")),
    ).rejects.toThrow("situe en dehors");
  });

  it("accepts a sibling output directory", async () => {
    const root = await makeTemporaryDirectory();
    const source = path.join(root, "source");
    await mkdir(source);

    const paths = await assertOutputOutsideSource(source, path.join(root, "output"));

    const canonicalRoot = await realpath(root);
    expect(paths.source).toBe(path.join(canonicalRoot, "source"));
    expect(paths.output).toBe(path.join(canonicalRoot, "output"));
  });
});
