import { describe, expect, it } from "vitest";
import type { PersistentPokemon, PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import { createEmptyPlayerParty, createEmptyPlayerPokemonStorage, createPersistentPokemonMetadata } from "@pokemon-z-battle/player-state";
import { sourcePokemonActions, sourcePokemonActionWheelHtml } from "../src/source-pokemon-actions.js";
import { sourcePokemonCardHtml } from "../src/source-pokemon-card-view.js";
import { createSourcePokemonCollection } from "../src/source-pokemon-collection.js";

const pokemon: PersistentPokemon = {
  id: "starter", species: "CHESPIN", nickname: "Marisson", level: 5, experience: 0,
  stats: { maxHp: 21, attack: 12, defense: 13, specialAttack: 11, specialDefense: 11, speed: 10 },
  hp: 18, majorStatus: null, ability: "OVERGROW", heldItem: null,
  moves: [{ internalName: "TACKLE", pp: 30, maxPp: 35 }, { internalName: "VINEWHIP", pp: 25, maxPp: 25 }],
  metadata: createPersistentPokemonMetadata("starter", "CHESPIN", 5),
};
const catalog = { pokemon: [{ id: 650, internalName: "CHESPIN", name: "Marisson", types: ["GRASS"],
  baseStats: { hp: 56, attack: 61, defense: 65, specialAttack: 48, specialDefense: 45, speed: 38 },
  genderRate: "FemaleOneEighth", happiness: 70 }],
moves: [
  { id: 1, internalName: "TACKLE", name: "Charge", type: "NORMAL" },
  { id: 2, internalName: "VINEWHIP", name: "Fouet Lianes", type: "GRASS" },
] } as PlayerCreationCatalog;

function entry(location: "team" | "ranch" = "team") {
  const party = location === "team" ? { ...createEmptyPlayerParty(), activeIndex: 0, members: [pokemon] }
    : createEmptyPlayerParty();
  const ranch = location === "ranch" ? { ...createEmptyPlayerPokemonStorage(), members: [pokemon] }
    : createEmptyPlayerPokemonStorage();
  return createSourcePokemonCollection(party, ranch, catalog)[0]!;
}

describe("shared Pokemon card and contextual actions", () => {
  it("shows four typed move slots without exposing power scores on the card", () => {
    const html = sourcePokemonCardHtml(entry());
    expect(html).toContain("Charge");
    expect(html).toContain("Fouet Lianes");
    expect(html).toContain("normal.png");
    expect(html).toContain("grass.png");
    expect(html.match(/source-pokemon-move/g)).toHaveLength(5);
    expect(html).toContain("source-pokemon-icon animated");
    expect(html).toContain("--pokemon-icon-cycle:250ms");
    expect(html).not.toContain("source-pokemon-power");
    expect(html).not.toContain("POTENTIEL");
  });

  it("slows the two-frame source icon with low HP and freezes it when knocked out", () => {
    const healthy = entry();
    expect(sourcePokemonCardHtml({ ...healthy, pokemon: { ...healthy.pokemon, hp: 5 } }))
      .toContain("--pokemon-icon-cycle:1000ms");
    const knockedOut = sourcePokemonCardHtml({ ...healthy, pokemon: { ...healthy.pokemon, hp: 0 } });
    expect(knockedOut).toContain('class="source-pokemon-icon"');
    expect(knockedOut).not.toContain("--pokemon-icon-cycle");
  });

  it("offers team actions according to the selected Pokemon state", () => {
    const selected = entry();
    const actions = sourcePokemonActions("team", selected,
      { partySize: 2, partyFull: false, activePokemonId: "another" });
    expect(actions.map((action) => [action.id, action.enabled])).toEqual([
      ["details", true], ["make-lead", true], ["give-item", false],
    ]);
    expect(sourcePokemonActionWheelHtml(selected, actions)).toContain('data-pokemon-action="make-lead"');
  });

  it("uses distinct Ranch actions for team and stored Pokemon", () => {
    const teamActions = sourcePokemonActions("ranch", entry("team"),
      { partySize: 1, partyFull: false, activePokemonId: "starter" });
    expect(teamActions.some((action) => action.id === "make-lead")).toBe(false);
    expect(teamActions.find((action) => action.id === "deposit"))
      .toMatchObject({ enabled: false, hint: "Dernier Pokémon" });
    expect(sourcePokemonActions("ranch", entry("ranch"),
      { partySize: 6, partyFull: true, activePokemonId: null }).find((action) => action.id === "withdraw"))
      .toMatchObject({ enabled: false, hint: "Équipe complète" });
  });
});
