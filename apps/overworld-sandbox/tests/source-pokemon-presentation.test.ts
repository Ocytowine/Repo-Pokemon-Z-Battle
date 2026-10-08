import { describe, expect, it } from "vitest";
import type { PersistentPokemon, PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import { createEmptyPlayerParty, createEmptyPlayerPokemonStorage, createPersistentPokemonMetadata } from "@pokemon-z-battle/player-state";
import { sourcePokemonActions, sourcePokemonActionWheelHtml } from "../src/source-pokemon-actions.js";
import { sourcePokemonCardHtml } from "../src/source-pokemon-card-view.js";
import { createSourcePokemonCollection } from "../src/source-pokemon-collection.js";
import { canManageSourceHeldItem, sourceHeldItemEntries, sourceHeldItemManagerHtml }
  from "../src/source-held-item-view.js";

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
      { partySize: 2, partyFull: false, activePokemonId: "another", heldItemManagementAvailable: true });
    expect(actions.map((action) => [action.id, action.enabled])).toEqual([
      ["details", true], ["make-lead", true], ["give-item", true],
    ]);
    expect(sourcePokemonActionWheelHtml(selected, actions)).toContain('data-source-wheel-action="make-lead"');
  });

  it("keeps progression decisions out of ordinary team actions", () => {
    const selected = { ...entry(), pokemon: { ...pokemon, pendingMoves: ["GROWL"] } };
    expect(sourcePokemonActions("team", selected,
      { partySize: 1, partyFull: false, activePokemonId: "starter" })
      .some((action) => action.id === "learn-move")).toBe(false);
    expect(sourcePokemonActions("ranch", selected,
      { partySize: 1, partyFull: false, activePokemonId: "starter" })
      .some((action) => action.id === "learn-move")).toBe(false);
  });

  it("does not turn a pending evolution into a deferred team menu action", () => {
    const selected = { ...entry(), pokemon: { ...pokemon,
      pendingEvolution: { species: "QUILLADIN", method: "Level", parameter: "16" } } };
    const actions = sourcePokemonActions("team", selected,
      { partySize: 1, partyFull: false, activePokemonId: "starter" });
    expect(actions.some((action) => action.id === "evolve")).toBe(false);
  });

  it("keeps held-item management accessible outside battle when the compatible pocket is empty", () => {
    const selected = entry();
    expect(sourcePokemonActions("team", selected,
      { partySize: 1, partyFull: false, activePokemonId: "starter", heldItemManagementAvailable: false })
      .find((action) => action.id === "give-item")).toMatchObject({ enabled: true });
    expect(sourcePokemonActions("ranch", selected,
      { partySize: 1, partyFull: false, activePokemonId: "starter", heldItemManagementAvailable: false })
      .find((action) => action.id === "give-item")).toMatchObject({ enabled: true });
    expect(sourcePokemonActions("battle", selected,
      { partySize: 1, partyFull: false, activePokemonId: "starter", heldItemManagementAvailable: true })
      .find((action) => action.id === "give-item")).toMatchObject({ enabled: false,
        hint: "Indisponible pendant le combat" });
  });

  it("offers only implemented held items and keeps removal available", () => {
    const items = new Map([
      ["LEFTOVERS", { id: 93, internalName: "LEFTOVERS", name: "Restes", description: "Restaure des PV.", pocket: 1, price: 200 }],
      ["POTION", { id: 1, internalName: "POTION", name: "Potion", description: "Restaure des PV.", pocket: 2, price: 300 }],
    ]);
    expect(sourceHeldItemEntries({ LEFTOVERS: 2, POTION: 4 }, items))
      .toEqual([{ item: items.get("LEFTOVERS"), quantity: 2 }]);
    expect(canManageSourceHeldItem({}, "LEGACYITEM")).toBe(true);
    const html = sourceHeldItemManagerHtml("Marisson", "LEFTOVERS", { LEFTOVERS: 2, POTION: 4 }, items);
    expect(html).toContain('data-held-item-equip="LEFTOVERS"');
    expect(html).toContain("data-held-item-remove");
    expect(html).not.toContain('data-held-item-equip="POTION"');
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
