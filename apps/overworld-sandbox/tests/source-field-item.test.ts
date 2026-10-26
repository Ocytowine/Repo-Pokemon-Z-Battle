import { describe, expect, it } from "vitest";
import { addPokemonToParty, createPersistentPokemon, type PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import { createSourceEventState, parseSourceEventState } from "../src/source-event-state.js";
import { advanceSourceRepel, finishSourceWildBattleFieldEffects, reconcileSourceEscapePointAfterTransfer,
  sourceCaveEscapePoint,
  sourceRepelBlocksEncounter,
  useSourceFieldItem } from "../src/source-field-item.js";

const catalog: PlayerCreationCatalog = { pokemon: [{ internalName: "CHESPIN", name: "Marisson",
  types: ["GRASS"], baseStats: { hp: 56, attack: 61, defense: 65, speed: 38,
    specialAttack: 48, specialDefense: 45 }, abilities: ["OVERGROW"], growthRate: "Parabolic",
  baseExperience: 64, genderRate: "FemaleOneEighth", happiness: 70,
  levelUpMoves: [{ level: 1, move: "TACKLE" }] }], moves: [{ id: 1, internalName: "TACKLE",
  name: "Charge", functionCode: "000", power: 40, type: "NORMAL", category: "Physical", accuracy: 100,
  pp: 35, priority: 0, effectChance: 0 }] };
const at = { mapId: 7, x: 4, y: 5 };

describe("Pokemon Z location-sensitive field items", () => {
  it("activates Malvo's Talisman only at the exact source location without consuming it", () => {
    const state = { ...createSourceEventState(), inventory: { TALISMANMALVO: 1 } };
    expect(useSourceFieldItem(state, "TALISMANMALVO", "Talisman de Malvo",
      { mapId: 190, x: 74, y: 24 })).toMatchObject({ ok: true, state, sharedWorldChanged: false });
    const opened = useSourceFieldItem(state, "TALISMANMALVO", "Talisman de Malvo",
      { mapId: 190, x: 74, y: 25 });
    expect(opened).toMatchObject({ ok: true, sharedWorldChanged: true,
      state: { inventory: { TALISMANMALVO: 1 }, switches: { "412": true } } });
  });
});

describe("personal field tools", () => {
  it("consumes the three Repousse sizes, blocks low-level encounters and skips ice steps", () => {
    for (const [item, steps] of [["REPEL", 100], ["SUPERREPEL", 200], ["MAXREPEL", 400]] as const) {
      const initial = createSourceEventState();
      const party = addPokemonToParty(initial.party, createPersistentPokemon("lead", "CHESPIN", 8, catalog));
      const state = { ...initial, party, inventory: { [item]: 2 } };
      const used = useSourceFieldItem(state, item, item, at);
      expect(used).toMatchObject({ ok: true, state: { inventory: { [item]: 1 },
        fieldItemEffects: { repelSteps: steps } } });
      expect(sourceRepelBlocksEncounter(used.state, 8)).toBe(true);
      expect(sourceRepelBlocksEncounter(used.state, 9)).toBe(false);
      expect(advanceSourceRepel(used.state, 12).state).toBe(used.state);
      expect(advanceSourceRepel(used.state, 2).state.fieldItemEffects.repelSteps).toBe(steps - 1);
      expect(useSourceFieldItem(used.state, item, item, at)).toMatchObject({ ok: false, state: used.state });
      expect(parseSourceEventState(JSON.parse(JSON.stringify(used.state))).fieldItemEffects.repelSteps).toBe(steps);
    }
  });

  it("keeps encounter flutes and consumes Honey and Potion Brillante at the right time", () => {
    const state = { ...createSourceEventState(), inventory: { BLACKFLUTE: 1, WHITEFLUTE: 1,
      HONEY: 1, SHINYZADOR: 2 } };
    const black = useSourceFieldItem(state, "BLACKFLUTE", "Flûte Noire", at);
    expect(black.state).toMatchObject({ inventory: { BLACKFLUTE: 1 }, fieldItemEffects: { flute: "high" } });
    const white = useSourceFieldItem(black.state, "WHITEFLUTE", "Flûte Blanche", at);
    expect(white.state).toMatchObject({ inventory: { WHITEFLUTE: 1 }, fieldItemEffects: { flute: "low" } });
    const honey = useSourceFieldItem(white.state, "HONEY", "Miel", at);
    expect(honey).toMatchObject({ ok: true, encounterRequested: true });
    expect(honey.state.inventory.HONEY).toBeUndefined();
    const weatherHoney = useSourceFieldItem({ ...state, inventory: { HONEY: 1 } }, "HONEY", "Miel",
      { ...at, weatherActive: true });
    expect(weatherHoney).toMatchObject({ ok: true, state: { inventory: {} } });
    expect(weatherHoney.encounterRequested).toBeUndefined();
    const shiny = useSourceFieldItem(honey.state, "SHINYZADOR", "Potion Brillante", at);
    expect(shiny.state).toMatchObject({ inventory: { SHINYZADOR: 1 },
      fieldItemEffects: { shinyNextWildEncounter: true } });
    expect(useSourceFieldItem(shiny.state, "SHINYZADOR", "Potion Brillante", at)).toMatchObject({ ok: false });
    expect(finishSourceWildBattleFieldEffects(shiny.state).fieldItemEffects.shinyNextWildEncounter).toBe(false);
    expect(parseSourceEventState(JSON.parse(JSON.stringify(shiny.state))).fieldItemEffects)
      .toMatchObject({ flute: "low", shinyNextWildEncounter: true });
  });

  it("uses Corde Sortie only when a personal entrance is saved", () => {
    const state = { ...createSourceEventState(), inventory: { ESCAPEROPE: 1 } };
    expect(useSourceFieldItem(state, "ESCAPEROPE", "Corde Sortie", at)).toMatchObject({ ok: false });
    const entrance = { mapId: 5, x: 2, y: 3, direction: "up" as const };
    const inCave = { ...state, fieldItemEffects: { ...state.fieldItemEffects, escapePoint: entrance } };
    const used = useSourceFieldItem(inCave, "ESCAPEROPE", "Corde Sortie", at);
    expect(used).toMatchObject({ ok: true, transfer: entrance,
      state: { inventory: {}, fieldItemEffects: { escapePoint: null } } });
    expect(parseSourceEventState(JSON.parse(JSON.stringify(inCave))).fieldItemEffects.escapePoint)
      .toEqual(entrance);
    expect(sourceCaveEscapePoint(5, 2, 4, "up")).toEqual({ mapId: 5, x: 2, y: 5,
      direction: "down" });
    const registered = reconcileSourceEscapePointAfterTransfer(state,
      { mapId: 5, x: 2, y: 4, direction: "up", outdoor: true },
      { outdoor: false, caveEncounters: true });
    expect(registered.fieldItemEffects.escapePoint).toEqual({ mapId: 5, x: 2, y: 5,
      direction: "down" });
    expect(reconcileSourceEscapePointAfterTransfer(registered, null,
      { outdoor: true, caveEncounters: false }).fieldItemEffects.escapePoint).toBeNull();
  });
});
