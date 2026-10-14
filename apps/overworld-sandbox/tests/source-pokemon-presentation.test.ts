import { describe, expect, it } from "vitest";
import type { PersistentPokemon, PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import { createEmptyPlayerParty, createEmptyPlayerPokemonStorage, createPersistentPokemonMetadata } from "@pokemon-z-battle/player-state";
import { sourcePokemonActions, sourcePokemonActionWheelHtml } from "../src/source-pokemon-actions.js";
import { sourcePokemonCardHtml } from "../src/source-pokemon-card-view.js";
import { createSourcePokemonCollection } from "../src/source-pokemon-collection.js";
import { canManageSourceHeldItem, sourceHeldItemEntries, sourceHeldItemManagerHtml }
  from "../src/source-held-item-view.js";
import { sourceRanchPageCount, sourceRanchPageSize } from "../src/source-ranch-view.js";

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
  it("uses a 3x3 Ranch page with the Team open and 4x4 when it is folded", () => {
    expect(sourceRanchPageSize(true)).toBe(9);
    expect(sourceRanchPageSize(false)).toBe(16);
    expect(sourceRanchPageCount(25, sourceRanchPageSize(true))).toBe(3);
    expect(sourceRanchPageCount(25, sourceRanchPageSize(false))).toBe(2);
  });

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

  it("shows the localized held-item name on shared Team and Ranch cards", () => {
    const held = { ...entry(), pokemon: { ...pokemon, heldItem: "LEFTOVERS" } };
    const html = sourcePokemonCardHtml(held, { heldItemName: "Restes" });
    expect(html).toContain("source-pokemon-held-item");
    expect(html).toContain("Objet tenu : Restes");
    expect(html).toContain("<b>Restes</b>");
    expect(html).not.toContain("<b>LEFTOVERS</b>");
    expect(sourcePokemonCardHtml(entry())).not.toContain("source-pokemon-held-item");
  });

  it("marks Ranch cards as compact without changing the shared Pokemon data", () => {
    const html = sourcePokemonCardHtml(entry("ranch"), { compact: true });
    expect(html).toContain("source-pokemon-card compact");
    expect(html).toContain("Marisson");
    expect(html).not.toContain("source-pokemon-vitals");
    expect(html).not.toContain("18/21 PV");
    expect(html).toContain("Plante");
    expect(html).toContain("Charge");
    expect(html).toContain("Fouet Lianes");
    expect(html.match(/source-pokemon-move/g)).toHaveLength(5);
    expect(html).not.toContain("#650");
    expect(html).not.toContain("RANCH");
  });

  it("keeps HP on compact Team cards", () => {
    const html = sourcePokemonCardHtml(entry("team"), { compact: true });
    expect(html).toContain("source-pokemon-vitals");
    expect(html).toContain("18/21 PV");
  });

  it("shows a localized major status on compact collection cards", () => {
    const burned = { ...entry("ranch"), pokemon: { ...pokemon, majorStatus: { kind: "burn" as const } } };
    expect(sourcePokemonCardHtml(burned, { compact: true })).toContain("Brûlure");
    const knockedOut = { ...entry("ranch"), pokemon: { ...pokemon, hp: 0 } };
    expect(sourcePokemonCardHtml(knockedOut, { compact: true })).toContain("K.O.");
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

  it("offers ordinary source items to hold and keeps removal available", () => {
    const items = new Map([
      ["LEFTOVERS", { id: 93, internalName: "LEFTOVERS", name: "Restes", description: "Restaure des PV.", pocket: 1, price: 200 }],
      ["POTION", { id: 1, internalName: "POTION", name: "Potion", description: "Restaure des PV.", pocket: 2, price: 300 }],
    ]);
    expect(sourceHeldItemEntries({ LEFTOVERS: 2, POTION: 4 }, items))
      .toEqual([{ item: items.get("POTION"), quantity: 4 }, { item: items.get("LEFTOVERS"), quantity: 2 }]);
    expect(canManageSourceHeldItem({}, "LEGACYITEM", items)).toBe(true);
    const wheel = sourceHeldItemManagerHtml("Marisson", "LEFTOVERS", { LEFTOVERS: 2, POTION: 4 }, items);
    expect(wheel).toContain("Donner un objet");
    expect(wheel.match(/data-source-wheel-action="held-pocket:/g)).toHaveLength(8);
    expect(wheel).toContain("bagPocket1.png");
    const objects = sourceHeldItemManagerHtml("Marisson", "LEFTOVERS", { LEFTOVERS: 2, POTION: 4 }, items,
      { pocket: 1, familyId: null, page: 0 });
    expect(objects).toContain('data-held-item-equip="LEFTOVERS"');
    expect(objects).not.toContain('data-held-item-equip="POTION"');
    expect(objects).toContain("data-held-item-remove");
  });

  it("reuses automatic Bag folders and pagination in the held-item browser", () => {
    const equipment = Array.from({ length: 9 }, (_, index) => ({ id: 66 + index,
      internalName: `GEAR${index}`, name: `Objet ${index}`, description: "Objet tenu.", pocket: 1, price: 100 }));
    const items = new Map(equipment.map((item) => [item.internalName, item]));
    const inventory = Object.fromEntries(equipment.map((item) => [item.internalName, 1]));
    const root = sourceHeldItemManagerHtml("Marisson", null, inventory, items,
      { pocket: 1, familyId: null, page: 0 });
    expect(root).toContain('data-held-item-family="held-battle"');
    const folder = sourceHeldItemManagerHtml("Marisson", null, inventory, items,
      { pocket: 1, familyId: "held-battle", page: 0 });
    expect(folder.match(/data-held-item-equip=/g)).toHaveLength(6);
    expect(folder).toContain("Page <b>1</b> / 2");
    expect(folder).toContain('data-source-inventory-page="1"');
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
    expect(sourcePokemonActions("ranch", entry("ranch"),
      { partySize: 6, partyFull: true, activePokemonId: null }).find((action) => action.id === "release"))
      .toMatchObject({ enabled: true, hint: "Demander confirmation" });
  });
});
