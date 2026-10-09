import { GAME_DATA_SCHEMA_VERSION, LOCAL_DATA_MANIFEST_SCHEMA_VERSION, LOCAL_DATA_REQUIRED_FILES,
  type LocalDataManifest } from "@pokemon-z-battle/game-data";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSourceLocalDataFiles, clearSourceLocalDataCache, parseSourceLocalDataManifest,
  sourceLocalDataDiagnostic, validateSourceLocalData }
  from "../src/source-local-data.js";

function manifest(files: readonly string[] = LOCAL_DATA_REQUIRED_FILES): LocalDataManifest {
  return {
    schemaVersion: LOCAL_DATA_MANIFEST_SCHEMA_VERSION,
    gameDataSchemaVersion: GAME_DATA_SCHEMA_VERSION,
    generatedAt: "2026-10-09T10:00:00.000Z",
    files,
  };
}

describe("source local data preflight", () => {
  afterEach(() => {
    clearSourceLocalDataCache();
    vi.unstubAllGlobals();
  });

  it("accepts a compatible complete extraction and requested map files", () => {
    const value = manifest([...LOCAL_DATA_REQUIRED_FILES, "maps/Map002.json", "events/Map002.json"]);
    expect(parseSourceLocalDataManifest(value)).toEqual(value);
    expect(() => assertSourceLocalDataFiles(value, ["maps/Map002.json", "events/Map002.json"])).not.toThrow();
  });

  it("reports a missing catalog before the world starts", () => {
    const value = manifest(LOCAL_DATA_REQUIRED_FILES.filter((file) => file !== "machines.json"));
    expect(() => assertSourceLocalDataFiles(value)).toThrow("machines.json");
  });

  it("rejects a manifest from another extraction contract", () => {
    expect(() => parseSourceLocalDataManifest({ ...manifest(), schemaVersion: "0.9.0" }))
      .toThrow("ne correspond pas");
  });

  it("turns a late 404 into an actionable diagnostic", () => {
    expect(sourceLocalDataDiagnostic(new Error("/__pokemon-z/data/machines.json : HTTP 404"))).toEqual({
      title: "Données locales incomplètes",
      detail: "Fichier manquant : machines.json.",
      command: "corepack pnpm prepare:local",
    });
  });

  it("explains the per-workstation setup when no local configuration exists", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: "LOCAL_CONFIGURATION_MISSING" }), { status: 503 })));

    await expect(validateSourceLocalData()).rejects.toMatchObject({
      diagnostic: {
        title: "Configuration locale absente",
        command: expect.stringContaining("--source"),
      },
    });
  });
});
