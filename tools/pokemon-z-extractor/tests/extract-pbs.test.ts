import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { extractPbsData } from "../src/pbs/extract-pbs.js";

const temporaryDirectories: string[] = [];

async function makeSourceFixture(): Promise<{ readonly root: string; readonly source: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "pokemon-z-pbs-extraction-"));
  temporaryDirectories.push(root);
  const source = path.join(root, "source");
  const pbs = path.join(source, "PBS");
  const compiledMoveData = Buffer.alloc(28);
  compiledMoveData.writeUInt16LE(0, 14);
  compiledMoveData.writeUInt8(10, 16);
  compiledMoveData.writeUInt8(0, 17);
  compiledMoveData.writeUInt8(0, 18);
  compiledMoveData.writeUInt8(100, 19);
  compiledMoveData.writeUInt8(10, 20);
  compiledMoveData.writeUInt8(0, 21);
  compiledMoveData.writeUInt16LE(0, 22);
  compiledMoveData.writeInt8(0, 24);
  compiledMoveData.writeUInt16LE(3, 25);
  await Promise.all([
    mkdir(path.join(source, "Data"), { recursive: true }),
    mkdir(path.join(source, "Graphics"), { recursive: true }),
    mkdir(pbs, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(source, "Game.ini"), "[Game]\n", "utf8"),
    writeFile(path.join(source, "Data", "moves.dat"), compiledMoveData),
    writeFile(path.join(source, "Data", "dexdata.dat"), Buffer.alloc(76)),
    writeFile(path.join(source, "Data", "Map001.rxdata"), Buffer.alloc(0)),
    writeFile(
      path.join(pbs, "types.txt"),
      "\uFEFF[0]\nName=Normal\nInternalName=NORMAL\n",
      "utf8",
    ),
    writeFile(
      path.join(pbs, "pokemon.txt"),
      `\uFEFF[1]
Name=Testmon
InternalName=TESTMON
Type1=NORMAL
BaseStats=1,2,3,4,5,6
GenderRate=Genderless
GrowthRate=Medium
BaseEXP=1
EffortPoints=0,0,0,0,0,0
Rareness=255
Happiness=70
Abilities=TESTABILITY
Moves=1,TESTMOVE
Compatibility=Undiscovered
StepsToHatch=1
Height=1.0
Weight=1.0
Color=White
Kind=Test
Pokedex=Fixture
BattlerPlayerY=0
BattlerEnemyY=0
BattlerAltitude=0
Evolutions=
`,
      "utf8",
    ),
    writeFile(
      path.join(pbs, "moves.txt"),
      '\uFEFF1,TESTMOVE,Test Move,000,10,NORMAL,Physical,100,10,0,00,0,ab,"Fixture"\n',
      "utf8",
    ),
    writeFile(
      path.join(pbs, "abilities.txt"),
      '\uFEFF1,TESTABILITY,Test Ability,"Fixture"\n',
      "utf8",
    ),
    writeFile(
      path.join(pbs, "items.txt"),
      '\uFEFF1,TESTITEM,Test Item,Test Items,1,1,"Fixture",0,0,0\n',
      "utf8",
    ),
    writeFile(path.join(pbs, "tm.txt"), "\uFEFF[TESTMOVE]\nTESTMON\n", "utf8"),
    writeFile(
      path.join(pbs, "trainertypes.txt"),
      "\uFEFF0,TESTTRAINER,Test Trainer,30,,,,Male,50,\n",
      "utf8",
    ),
    writeFile(
      path.join(pbs, "trainers.txt"),
      "\uFEFF#---\nTESTTRAINER\nAda,1\n1,TESTITEM\nTESTMON,5,TESTITEM,TESTMOVE\n",
      "utf8",
    ),
    writeFile(
      path.join(pbs, "encounters.txt"),
      "\uFEFF001 # Test Map\n12,2,2\nOldRod\nTESTMON,2,4\nTESTMON,2,4\n",
      "utf8",
    ),
  ]);
  return { root, source };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("extractPbsData", () => {
  it("writes all normalized datasets and a deterministic report", async () => {
    const fixture = await makeSourceFixture();
    const output = path.join(fixture.root, "output");

    const first = await extractPbsData(fixture.source, output);
    const firstPokemon = await readFile(path.join(output, "pokemon.json"), "utf8");
    const second = await extractPbsData(fixture.source, output);
    const secondPokemon = await readFile(path.join(output, "pokemon.json"), "utf8");

    expect(first.files).toHaveLength(12);
    expect(first.report.datasets.pokemon.records).toBe(1);
    expect(first.report.diagnostics).toEqual([]);
    expect(first.validationReport.summary.errors).toBe(0);
    expect(first.engineSupportReport.engineState).toBe("in-development");
    expect(first.engineSupportReport.summary.supportedMechanics).toBeGreaterThan(0);
    expect(first.report.datasets.trainers.records).toBe(1);
    expect(first.report.datasets.encounters.records).toBe(1);
    expect(first.report.datasets.machines.records).toBe(1);
    expect(JSON.parse(await readFile(path.join(output, "machines.json"), "utf8"))).toMatchObject({
      kind: "machines", records: [{ move: "TESTMOVE", species: ["TESTMON"] }],
    });
    expect(second.report).toEqual(first.report);
    expect(secondPokemon).toBe(firstPokemon);
    expect(firstPokemon).not.toContain(fixture.source);
  });

  it("reports unresolved references without dropping the extracted record", async () => {
    const fixture = await makeSourceFixture();
    const pokemonFile = path.join(fixture.source, "PBS", "pokemon.txt");
    const pokemonText = await readFile(pokemonFile, "utf8");
    await writeFile(
      pokemonFile,
      pokemonText.replace("Abilities=TESTABILITY", "Abilities=MISSINGABILITY"),
      "utf8",
    );

    const result = await extractPbsData(fixture.source, path.join(fixture.root, "output"));

    expect(result.validationReport.issues).toContainEqual(
      expect.objectContaining({
        code: "UNKNOWN_ABILITY",
        reference: "MISSINGABILITY",
      }),
    );
    expect(result.validationReport.summary.errors).toBe(1);
    expect(result.report.datasets.pokemon.records).toBe(1);
  });

  it("validates references introduced by trainers and encounters", async () => {
    const fixture = await makeSourceFixture();
    const trainerFile = path.join(fixture.source, "PBS", "trainers.txt");
    const trainerText = await readFile(trainerFile, "utf8");
    await writeFile(
      trainerFile,
      trainerText.replace("TESTMON,5,TESTITEM", "TESTMON,5,MISSINGITEM"),
      "utf8",
    );

    const result = await extractPbsData(fixture.source, path.join(fixture.root, "output"));

    expect(result.validationReport.issues).toContainEqual(
      expect.objectContaining({
        dataset: "trainers",
        code: "UNKNOWN_ITEM",
        reference: "MISSINGITEM",
      }),
    );
    expect(result.report.datasets.trainers.records).toBe(1);
    expect(result.report.datasets.encounters.records).toBe(1);
  });
});
