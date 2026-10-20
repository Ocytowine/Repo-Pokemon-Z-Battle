import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBattleIntegrationAudit } from "../src/runtime/battle-integration-audit.js";

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
      } }),
    ]);

    const report = await createBattleIntegrationAudit(directory, { mappings: [], animations: [] }) as {
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
  });
});
