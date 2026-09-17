import { describe, expect, it } from "vitest";
import { parseCsvDocument } from "../src/pbs/csv.js";
import { parseEncounters } from "../src/pbs/parse-encounters.js";
import { parseTrainerTypes } from "../src/pbs/parse-trainer-types.js";
import { parseTrainers } from "../src/pbs/parse-trainers.js";

const context = { file: "PBS/fixture.txt", sha256: "abc" } as const;

describe("trainer PBS parsers", () => {
  it("keeps trainer items and historical Pokemon options", () => {
    const dataset = parseTrainers(
      "#---\nACE\nAda,2\n1,FULLRESTORE\nTESTMON,50,LEFTOVERS,TACKLE,,,,1,F,3,true,ADAMANT,31,255,Sparky\n",
      context,
    );
    expect(dataset.records[0]).toMatchObject({
      internalName: '["ACE","Ada",2]',
      items: ["FULLRESTORE"],
      pokemon: [{
        species: "TESTMON",
        gender: "Female",
        form: 3,
        shiny: true,
        nature: "ADAMANT",
        iv: 31,
        happiness: 255,
        nickname: "Sparky",
      }],
    });
  });

  it("parses the ten trainer type fields", () => {
    const rows = parseCsvDocument("7,ACE,Ace Trainer,80,battle.ogg,,,Female,100,expert\n", context.file);
    expect(parseTrainerTypes(rows, context).records[0]).toMatchObject({
      id: 7,
      internalName: "ACE",
      baseMoney: 80,
      gender: "Female",
      skillLevel: 100,
      skillCodes: "expert",
    });
  });
});

describe("encounter PBS parser", () => {
  it("preserves slot order and makes known implicit weights explicit", () => {
    const land = Array.from({ length: 12 }, (_, index) => `MON${index},2,4`).join("\n");
    const dataset = parseEncounters(
      `7 # Route Test\n12,2,2\nLand\n${land}\nOldRod\nFISH1,3,5\nFISH2,3,5\n`,
      context,
    );
    expect(dataset.records[0]?.methods[0]?.slots.map((slot) => slot.weight)).toEqual(
      [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1],
    );
    expect(dataset.records[0]?.methods[1]?.slots.map((slot) => slot.weight)).toEqual([70, 30]);
  });

  it("preserves extension methods whose weights are not known", () => {
    const dataset = parseEncounters("1\n1,1,1\nCustomMethod\nTESTMON,1,2\n", context);
    expect(dataset.records[0]?.methods[0]).toMatchObject({
      method: "CustomMethod",
      slots: [{ weight: null }],
    });
  });
});
