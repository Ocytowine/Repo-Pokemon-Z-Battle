<<<<<<< HEAD
import { mkdtemp, rm, writeFile } from "node:fs/promises";
=======
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
>>>>>>> 52b0b9123ed2c596c96a1144d039db8d7777731e
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBattleIntegrationAudit } from "../src/runtime/battle-integration-audit.js";
<<<<<<< HEAD

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("battle integration ability audit", () => {
  it("audits random normal abilities and includes hidden abilities only when forced", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "pokemon-z-battle-audit-"));
    directories.push(directory);
    const write = (file: string, value: unknown) => writeFile(path.join(directory, file), JSON.stringify(value), "utf8");
    await Promise.all([
      write("moves.json", { records: [{ id: 1, internalName: "TACKLE", name: "Charge", functionCode: "000" }] }),
      write("pokemon.json", { records: [
        { internalName: "NORMALMON", name: "Normalmon", abilities: ["FIRST", "SECOND"],
          hiddenAbilities: ["HIDDEN_UNUSED"], levelUpMoves: [{ level: 1, move: "TACKLE" }] },
        { internalName: "FORCEDMON", name: "Forcedmon", abilities: ["FIRST"],
          hiddenAbilities: ["HIDDEN_FORCED"], levelUpMoves: [{ level: 1, move: "TACKLE" }] },
      ] }),
      write("trainers.json", { records: [{ internalName: "TEST", trainerType: "TEST", name: "Test", version: 0,
        pokemon: [
          { species: "NORMALMON", level: 5, moves: [null, null, null, null], abilityIndex: null },
          { species: "FORCEDMON", level: 5, moves: [null, null, null, null], abilityIndex: 1 },
        ] }] }),
      write("engine-support-report.json", { categories: {
        moveFunctionCodes: [{ key: "000", engineSupport: "supported" }],
        abilities: ["FIRST", "SECOND", "HIDDEN_UNUSED", "HIDDEN_FORCED"].map((key) =>
          ({ key, engineSupport: "supported" })),
=======
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
>>>>>>> 52b0b9123ed2c596c96a1144d039db8d7777731e
      } }),
    ]);

    const report = await createBattleIntegrationAudit(directory, { mappings: [], animations: [] }) as {
<<<<<<< HEAD
      schemaVersion: string;
      abilityDependencies: readonly { key: string }[];
      scopes: readonly { kind: string; id: string; abilities: readonly string[];
        abilitySelections: readonly { policy: string; abilityIndex: number | null; candidates: readonly string[] }[] }[];
    };

    expect(report.schemaVersion).toBe("1.1.0");
    expect(report.abilityDependencies.map((entry) => entry.key)).toEqual(["FIRST", "HIDDEN_FORCED", "SECOND"]);
    expect(report.scopes.find((scope) => scope.kind === "pokemon" && scope.id === "NORMALMON")).toMatchObject({
      abilities: ["FIRST", "SECOND"],
      abilitySelections: [{ policy: "random-normal", abilityIndex: null, candidates: ["FIRST", "SECOND"] }],
    });
    expect(report.scopes.find((scope) => scope.kind === "trainer")).toMatchObject({
      abilities: ["FIRST", "SECOND", "HIDDEN_FORCED"],
      abilitySelections: [
        { policy: "random-normal", abilityIndex: null, candidates: ["FIRST", "SECOND"] },
        { policy: "forced-index", abilityIndex: 1, candidates: ["HIDDEN_FORCED"] },
      ],
    });
=======
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

  it("creates a map scope from encounters, trainer calls and scripted boss levels", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "pokemon-z-map-audit-"));
    temporaryDirectories.push(directory);
    await mkdir(path.join(directory, "events"));
    await Promise.all([
      writeJson(directory, "moves.json", { records: [
        { id: 1, internalName: "TACKLE", name: "Charge", functionCode: "000" },
        { id: 2, internalName: "NIGHTSHADE", name: "Ombre Nocturne", functionCode: "06D" },
        { id: 3, internalName: "FUTUREMOVE", name: "Future", functionCode: "999" },
      ] }),
      writeJson(directory, "pokemon.json", { records: [
        { internalName: "LILLIPUP", name: "Ponchiot", abilities: ["RUNAWAY"],
          levelUpMoves: [{ level: 1, move: "TACKLE" }, { level: 99, move: "FUTUREMOVE" }] },
        { internalName: "SHUPPET", name: "Polichombr", abilities: ["FRISK"],
          levelUpMoves: [{ level: 1, move: "NIGHTSHADE" }] },
        { internalName: "LICKITUNG", name: "Excelangue", abilities: ["OWNTEMPO"],
          levelUpMoves: [{ level: 1, move: "TACKLE" }, { level: 30, move: "FUTUREMOVE" }] },
      ] }),
      writeJson(directory, "trainers.json", { records: [{ internalName: "trainer", trainerType: "CURANDERA",
        name: "Merce", version: 0, pokemon: [{ species: "SHUPPET", level: 18,
          moves: ["NIGHTSHADE", null, null, null], abilityIndex: null }] }] }),
      writeJson(directory, "mega-evolutions.json", { records: [] }),
      writeJson(directory, "encounters.json", { records: [{ mapId: 56, methods: [{ slots: [
        { species: "LILLIPUP", minimumLevel: 17, maximumLevel: 19 },
      ] }] }] }),
      writeJson(directory, "engine-support-report.json", { categories: {
        moveFunctionCodes: [{ key: "000", engineSupport: "supported" },
          { key: "06D", engineSupport: "not-implemented" }, { key: "999", engineSupport: "not-implemented" }],
        abilities: [{ key: "RUNAWAY", engineSupport: "not-implemented" },
          { key: "FRISK", engineSupport: "not-implemented" }, { key: "OWNTEMPO", engineSupport: "not-implemented" }],
      } }),
      writeJson(path.join(directory, "events"), "Map056.json", { commands: [
        { source: "pbTrainerBattle(PBTrainers::CURANDERA,\"Merce\",_I(\"Fin\"),false,0,false,0)" },
        { source: "pbBossFight([:LICKITUNG][pbGet(183)],22)" },
      ] }),
    ]);

    const report = await createBattleIntegrationAudit(directory, { mappings: [], animations: [] }) as {
      readonly scopes: readonly { readonly kind: string; readonly id: string; readonly moves: readonly string[];
        readonly pokemon?: readonly string[]; readonly trainers?: readonly string[] }[];
      readonly issues: readonly { readonly key: string; readonly usedBy: readonly string[] }[];
    };
    expect(report.scopes).toContainEqual(expect.objectContaining({ kind: "map", id: "56",
      moves: expect.arrayContaining(["TACKLE", "NIGHTSHADE"]),
      pokemon: expect.arrayContaining(["LILLIPUP", "SHUPPET", "LICKITUNG"]),
      trainers: ["CURANDERA:Merce:0"] }));
    expect(report.scopes.find((scope) => scope.kind === "map" && scope.id === "56")?.moves)
      .not.toContain("FUTUREMOVE");
    expect(report.issues).toContainEqual(expect.objectContaining({ key: "NIGHTSHADE",
      usedBy: expect.arrayContaining(["map:56"]) }));
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
>>>>>>> 52b0b9123ed2c596c96a1144d039db8d7777731e
  });
});
