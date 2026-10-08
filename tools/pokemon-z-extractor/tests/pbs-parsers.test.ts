import { describe, expect, it } from "vitest";
import { parseAbilities } from "../src/pbs/parse-abilities.js";
import { analyzeDataset } from "../src/pbs/diagnostics.js";
import { parseCsvDocument } from "../src/pbs/csv.js";
import { parseItems } from "../src/pbs/parse-items.js";
import { parseMachines } from "../src/pbs/parse-machines.js";
import { parseMoves } from "../src/pbs/parse-moves.js";
import { parsePokemon } from "../src/pbs/parse-pokemon.js";
import { parseSectionDocument } from "../src/pbs/sections.js";
import { parseTypes } from "../src/pbs/parse-types.js";

const context = { file: "PBS/fixture.txt", sha256: "a".repeat(64) } as const;

describe("normalized PBS parsers", () => {
  it("parses multiline machine compatibility sections without duplicate species", () => {
    const dataset = parseMachines("# TMs\n[TESTMOVE]\nTESTMON,OTHERMON,\nTESTMON\n[NEXTMOVE]\nOTHERMON\n", context);
    expect(dataset.records).toMatchObject([
      { id: 1, move: "TESTMOVE", species: ["TESTMON", "OTHERMON"] },
      { id: 2, move: "NEXTMOVE", species: ["OTHERMON"] },
    ]);
  });

  it("parses a type section", () => {
    const dataset = parseTypes(
      parseSectionDocument(
        "[0]\nName=Normal\nInternalName=NORMAL\nWeaknesses=FIGHTING\nImmunities=GHOST\n",
        context.file,
      ),
      context,
    );

    expect(dataset.records[0]).toMatchObject({
      id: 0,
      internalName: "NORMAL",
      weaknesses: ["FIGHTING"],
      resistances: [],
      immunities: ["GHOST"],
    });
  });

  it("parses legacy Pokemon stat order and preserves raw properties", () => {
    const text = `[25]
Name=Pikachu
InternalName=PIKACHU
Type1=ELECTRIC
BaseStats=35,55,40,90,50,50
GenderRate=Female50Percent
GrowthRate=Medium
BaseEXP=112
EffortPoints=0,0,0,2,0,0
Rareness=190
Happiness=70
Abilities=STATIC
HiddenAbility=LIGHTNINGROD
Moves=1,THUNDERSHOCK,5,GROWL
EggMoves=WISH
Compatibility=Field,Fairy
StepsToHatch=2560
Height=0.4
Weight=6.0
Color=Yellow
Kind=Mouse
Pokedex=Test entry
BattlerPlayerY=0
BattlerEnemyY=20
BattlerAltitude=0
Evolutions=RAICHU,Item,THUNDERSTONE
CustomField=kept
`;
    const dataset = parsePokemon(parseSectionDocument(text, context.file), context);
    const pikachu = dataset.records[0];

    expect(pikachu?.baseStats).toEqual({
      hp: 35,
      attack: 55,
      defense: 40,
      speed: 90,
      specialAttack: 50,
      specialDefense: 50,
    });
    expect(pikachu?.effortPoints.speed).toBe(2);
    expect(pikachu?.evolutions).toEqual([
      { species: "RAICHU", method: "Item", parameter: "THUNDERSTONE" },
    ]);
    expect(pikachu?.raw.CustomField).toBe("kept");
  });

  it("parses the 14-column move grammar", () => {
    const dataset = parseMoves(
      parseCsvDocument(
        '1,THUNDERBOLT,Tonnerre,007,90,ELECTRIC,Special,100,15,10,00,0,bef,"Text, test"',
        context.file,
      ),
      context,
    );

    expect(dataset.records[0]).toMatchObject({
      functionCode: "007",
      category: "Special",
      targetCode: "00",
      description: "Text, test",
    });
  });

  it("parses the ability grammar", () => {
    const dataset = parseAbilities(
      parseCsvDocument('1,STATIC,Statik,"Description, test"', context.file),
      context,
    );

    expect(dataset.records[0]).toMatchObject({
      id: 1,
      internalName: "STATIC",
      description: "Description, test",
    });
  });

  it("parses the 11-column item grammar and an empty machine move", () => {
    const dataset = parseItems(
      parseCsvDocument(
        '1,POTION,Potion,Potions,2,300,"Restores HP.",1,0,0,',
        context.file,
      ),
      context,
    );

    expect(dataset.records[0]).toMatchObject({
      id: 1,
      pocket: 2,
      price: 300,
      itemType: 0,
      machineMove: null,
    });
  });

  it("accepts an omitted optional machine-move column", () => {
    const dataset = parseItems(
      parseCsvDocument(
        '703,SURFMOUNT,Surf Mount,Surf Mounts,8,0,"Travel on water.",0,0,6',
        context.file,
      ),
      context,
    );

    expect(dataset.records[0]).toMatchObject({ itemType: 6, machineMove: null });
  });
});

describe("dataset diagnostics", () => {
  it("reports gaps and duplicates without dropping records", () => {
    const records = [
      { id: 1, internalName: "ONE", _source: { line: 1 } },
      { id: 3, internalName: "THREE", _source: { line: 2 } },
      { id: 3, internalName: "THREE", _source: { line: 3 } },
    ];

    const analysis = analyzeDataset("items", records);

    expect(analysis.summary).toEqual({
      records: 3,
      uniqueIds: 2,
      minId: 1,
      maxId: 3,
      missingIds: [2],
      duplicateIds: [3],
    });
    expect(analysis.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "MISSING_ID",
      "DUPLICATE_ID",
      "DUPLICATE_INTERNAL_NAME",
    ]);
  });
});
