import { describe, expect, it } from "vitest";
import { parseCsvDocument, parseCsvLine } from "../src/pbs/csv.js";
import { PbsParseError } from "../src/pbs/errors.js";
import { parseSectionDocument } from "../src/pbs/sections.js";

describe("PBS CSV reader", () => {
  it("handles a BOM, comments, quoted commas, escaped quotes and trailing fields", () => {
    const rows = parseCsvDocument(
      '\uFEFF# comment\r\n1,TEST,Name,"Text, with ""quotes""",\r\n',
      "PBS/test.txt",
    );

    expect(rows).toEqual([
      {
        line: 2,
        values: ["1", "TEST", "Name", 'Text, with "quotes"', ""],
      },
    ]);
  });

  it("rejects an unterminated quoted field with its source location", () => {
    expect(() => parseCsvLine('1,"broken', "PBS/test.txt", 7)).toThrowError(
      new PbsParseError("Champ CSV cite non termine.", "PBS/test.txt", 7),
    );
  });
});

describe("PBS section reader", () => {
  it("preserves empty and unknown properties", () => {
    const sections = parseSectionDocument(
      "\uFEFF# heading\n[1]\nName=Bulbasaur\nEvolutions=\nCustomField=value\n",
      "PBS/pokemon.txt",
    );

    expect(sections).toEqual([
      {
        id: 1,
        line: 2,
        properties: {
          Name: "Bulbasaur",
          Evolutions: "",
          CustomField: "value",
        },
      },
    ]);
  });

  it("rejects duplicate properties instead of overwriting them", () => {
    expect(() =>
      parseSectionDocument("[1]\nName=One\nName=Two\n", "PBS/test.txt"),
    ).toThrow("Propriete dupliquee");
  });
});
