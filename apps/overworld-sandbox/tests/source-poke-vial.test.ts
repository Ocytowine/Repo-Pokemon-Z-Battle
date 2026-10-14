import { createPersistentPokemonMetadata } from "@pokemon-z-battle/player-state";
import { describe, expect, it } from "vitest";
import { createSourceEventState, parseSourceEventState } from "../src/source-event-state.js";
import { portSourcePokeVialCommand, refillSourcePokeVial, sourcePokeVialStatus,
  sourceStoryVariables, useSourcePokeVial } from "../src/source-poke-vial.js";

function damagedState() {
  return { ...createSourceEventState(), inventory: { POKEVIAL: 1 }, variables: { 238: 2, 239: 3 },
    pokeVial: { current: 2, maximum: 3 }, party: { schemaVersion: 1 as const, activeIndex: 0, members: [{
      id: "starter", species: "PIKACHU", nickname: null, level: 8, experience: 400,
      stats: { maxHp: 28, attack: 15, defense: 12, specialAttack: 14, specialDefense: 14, speed: 20 },
      hp: 3, majorStatus: { kind: "burn" as const }, ability: null, heldItem: null,
      moves: [{ internalName: "TACKLE", pp: 1, maxPp: 35 }],
      metadata: createPersistentPokemonMetadata("starter", "PIKACHU", 8),
    }] } };
}

describe("source Pokevial", () => {
  it("heals the whole personal party and consumes exactly one charge", () => {
    const initial = damagedState();
    const result = useSourcePokeVial(initial);
    expect(result).toMatchObject({ ok: true, reason: null, state: { pokeVial: { current: 1, maximum: 3 },
      variables: { 238: 1, 239: 3 }, party: { members: [{ hp: 28, majorStatus: null,
        moves: [{ pp: 35 }] }] } } });
    expect(initial).toMatchObject({ pokeVial: { current: 2 }, party: { members: [{ hp: 3 }] } });
  });

  it("refuses an empty vial and refills it at a personal Pokemon Center", () => {
    const empty = { ...damagedState(), variables: { 238: 0, 239: 3 }, pokeVial: { current: 0, maximum: 3 } };
    expect(useSourcePokeVial(empty)).toMatchObject({ ok: false, reason: "empty", state: empty });
    expect(refillSourcePokeVial(empty)).toMatchObject({ pokeVial: { current: 3, maximum: 3 },
      variables: { 238: 3, 239: 3 } });
  });

  it("migrates an old save that owns the item but has no counters", () => {
    const restored = parseSourceEventState({ switches: {}, variables: {}, selfSwitches: {},
      inventory: { POKEVIAL: 1 } });
    expect(sourcePokeVialStatus(restored)).toMatchObject({ owned: true, canUse: true, current: 1, maximum: 1 });
    expect(restored.variables).toMatchObject({ 238: 1, 239: 1 });
  });

  it("ports only Z's exact Center recharge and keeps its counters out of shared story", () => {
    const recharge = portSourcePokeVialCommand({ kind: "change-variables", text: null, indent: 1,
      data: { firstId: 238, lastId: 238, operation: "set",
        operand: { kind: "variable", values: [239] } } });
    expect(recharge).toMatchObject({ kind: "refill-poke-vial", indent: 1, data: { policy: "PERSONAL" } });
    expect(portSourcePokeVialCommand({ kind: "change-variables", text: null, indent: 0,
      data: { firstId: 238, lastId: 238, operation: "add",
        operand: { kind: "constant", values: [1] } } })).toBeNull();
    expect(sourceStoryVariables({ 7: 9, 238: 2, 239: 3 })).toEqual({ 7: 9 });
  });
});
