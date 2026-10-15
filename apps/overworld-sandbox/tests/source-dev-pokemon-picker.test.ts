import { describe, expect, it } from "vitest";
import { filterSourceDevPokemonEntries, resolveSourceDevPokemonGender, sourceDevPokemonGenderOptions,
  sourceDevPokemonTypes, type SourceDevPokemonEntry }
  from "../src/source-dev-pokemon-picker.js";

const entries: readonly SourceDevPokemonEntry[] = [
  { species: "BULBASAUR", number: 1, name: "Bulbizarre", types: ["GRASS", "POISON"], genderRate: "FemaleOneEighth", iconUrl: "1.png" },
  { species: "CHARMANDER", number: 4, name: "Salamèche", types: ["FIRE"], genderRate: "FemaleOneEighth", iconUrl: "4.png" },
  { species: "NINCADA", number: 290, name: "Ningale", types: ["BUG", "GROUND"], genderRate: "Female50Percent", iconUrl: "290.png" },
  { species: "FENNEKIN", number: 653, name: "Feunnec", types: ["FIRE"], genderRate: "FemaleOneEighth", iconUrl: "653.png" },
];

describe("source dev Pokemon picker", () => {
  it("searches French names without requiring accents and keeps internal-name fallback", () => {
    expect(filterSourceDevPokemonEntries(entries, { query: "salameche", type: null, sort: "number" })
      .map((entry) => entry.species)).toEqual(["CHARMANDER"]);
    expect(filterSourceDevPokemonEntries(entries, { query: "nincada", type: null, sort: "number" })
      .map((entry) => entry.name)).toEqual(["Ningale"]);
  });

  it("combines type and query filters and supports French alphabetical order", () => {
    expect(filterSourceDevPokemonEntries(entries, { query: "fe", type: "FIRE", sort: "name" })
      .map((entry) => entry.name)).toEqual(["Feunnec"]);
    expect(filterSourceDevPokemonEntries(entries, { query: "", type: "FIRE", sort: "name" })
      .map((entry) => entry.name)).toEqual(["Feunnec", "Salamèche"]);
  });

  it("derives unique available types", () => {
    expect(sourceDevPokemonTypes(entries)).toEqual(["BUG", "FIRE", "GRASS", "GROUND", "POISON"]);
  });

  it("offers only genders compatible with the selected species", () => {
    expect(sourceDevPokemonGenderOptions("Female50Percent").map((option) => option.value))
      .toEqual(["auto", "female", "male"]);
    expect(sourceDevPokemonGenderOptions("AlwaysFemale")).toEqual([{ value: "female", label: "Femelle ♀" }]);
    expect(sourceDevPokemonGenderOptions("Genderless")).toEqual([{ value: "genderless", label: "Sans genre" }]);
  });

  it("keeps a generated gender in automatic mode and rejects incompatible overrides", () => {
    expect(resolveSourceDevPokemonGender("Female50Percent", "auto", "male")).toBe("male");
    expect(resolveSourceDevPokemonGender("Female50Percent", "female", "male")).toBe("female");
    expect(resolveSourceDevPokemonGender("AlwaysMale", "female", "female")).toBe("male");
  });
});
