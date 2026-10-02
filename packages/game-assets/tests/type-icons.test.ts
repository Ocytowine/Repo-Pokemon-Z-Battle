import { describe, expect, it } from "vitest";
import { pokemonTypeIconUrl } from "../src/index.js";

describe("shared Pokemon type icons", () => {
  it("maps every standard type and falls back for unknown source values", () => {
    const types = ["BUG", "DARK", "DRAGON", "ELECTRIC", "FAIRY", "FIGHTING", "FIRE", "FLYING", "GHOST",
      "GRASS", "GROUND", "ICE", "NORMAL", "POISON", "PSYCHIC", "ROCK", "STEEL", "WATER"];
    expect(new Set(types.map(pokemonTypeIconUrl)).size).toBe(18);
    expect(pokemonTypeIconUrl("fire")).toMatch(/fire\.png$/u);
    expect(pokemonTypeIconUrl("SHADOW")).toMatch(/unknown\.png$/u);
  });
});
