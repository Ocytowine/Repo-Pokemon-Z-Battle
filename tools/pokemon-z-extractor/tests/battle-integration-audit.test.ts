import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBattleIntegrationAudit } from "../src/runtime/battle-integration-audit.js";
import { createMegaIntegrationAudit } from "../src/runtime/mega-integration-audit.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function writeJson(directory: string, file: string, value: unknown): Promise<void> {
  await writeFile(path.join(directory, file), `${JSON.stringify(value)}\n`, "utf8");
}

describe("battle integration audit", () => {
  it("creates a targetable dependency scope for every Mega form", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "pokemon-z-mega-audit-"));
    temporaryDirectories.push(directory);
    await Promise.all([
      writeJson(directory, "moves.json", { records: [{ id: 1, internalName: "TACKLE", name: "Charge",
        functionCode: "000" }] }),
      writeJson(directory, "pokemon.json", { records: [{ internalName: "CHARIZARD", name: "Dracaufeu",
        abilities: ["BLAZE"], levelUpMoves: [{ level: 1, move: "TACKLE" }] }] }),
      writeJson(directory, "trainers.json", { records: [] }),
      writeJson(directory, "mega-evolutions.json", { records: [
        { species: "CHARIZARD", form: 1, heldItem: "CHARIZARDITEX", ability: "TOUGHCLAWS" },
        { species: "CHARIZARD", form: 2, heldItem: "CHARIZARDITEY", ability: "DROUGHT" },
      ] }),
      writeJson(directory, "engine-support-report.json", { categories: {
        moveFunctionCodes: [{ key: "000", engineSupport: "supported" }],
        abilities: [{ key: "BLAZE", engineSupport: "supported" },
          { key: "TOUGHCLAWS", engineSupport: "supported" },
          { key: "DROUGHT", engineSupport: "not-implemented" }],
      } }),
    ]);

    const report = await createBattleIntegrationAudit(directory, { mappings: [], animations: [] }) as {
      readonly summary: { readonly megaEvolutions: number };
      readonly scopes: readonly { readonly kind: string; readonly id: string }[];
      readonly issues: readonly { readonly key: string; readonly usedBy: readonly string[] }[];
    };
    expect(report.summary.megaEvolutions).toBe(2);
    expect(report.scopes).toContainEqual(expect.objectContaining({ kind: "mega", id: "CHARIZARD:1" }));
    expect(report.scopes).toContainEqual(expect.objectContaining({ kind: "mega", id: "CHARIZARD:2" }));
    expect(report.issues).toContainEqual(expect.objectContaining({ key: "DROUGHT",
      usedBy: ["mega:CHARIZARD:2"] }));
  });
});

describe("Mega integration audit", () => {
  it("reports missing item definitions and stones absent from source events", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "pokemon-z-mega-items-"));
    temporaryDirectories.push(directory);
    await mkdir(path.join(directory, "events"));
    await Promise.all([
      writeJson(directory, "mega-evolutions.json", { activationItems: ["MEGARING"], records: [
        { species: "CHARIZARD", form: 1, heldItem: "CHARIZARDITEX" },
        { species: "GROUDON", form: 1, heldItem: "GROUDONITE" },
      ] }),
      writeJson(directory, "items.json", { records: [{ internalName: "MEGARING" },
        { internalName: "CHARIZARDITEX" }] }),
      writeJson(directory, "common-events.json", { commands: [{ source: "pbReceiveItem(:MEGARING)" }] }),
      writeJson(path.join(directory, "events"), "Map001.json", {
        commands: [{ source: "pbPokemonMart([:CHARIZARDITEX])" }],
      }),
    ]);

    const report = await createMegaIntegrationAudit(directory);
    expect(report.summary).toMatchObject({ forms: 2, distinctHeldItems: 2,
      missingCatalogItems: 1, itemsWithoutEventReference: 1 });
    expect(report.activationItems[0]).toMatchObject({ item: "MEGARING",
      eventReferences: ["common-events.json"] });
    expect(report.heldItems).toContainEqual(expect.objectContaining({ item: "GROUDONITE",
      catalogDefined: false, eventReferences: [] }));
  });
});
