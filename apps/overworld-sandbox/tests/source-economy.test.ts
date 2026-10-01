import { describe, expect, it } from "vitest";
import { addPokemonToParty, createPersistentPokemon, type PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import { addSourceMoney, purchaseSourceItem, sourceDefeatLoss, sourceTrainerReward } from "../src/source-economy.js";
import { createSourceEventState } from "../src/source-event-state.js";

const tackle = { id: 1, internalName: "TACKLE", name: "Charge", functionCode: "000", power: 40, type: "NORMAL",
  category: "Physical" as const, accuracy: 100, pp: 35, priority: 0, effectChance: 0 };
const catalog: PlayerCreationCatalog = { pokemon: [{ internalName: "CHESPIN", name: "Marisson", types: ["GRASS"],
  baseStats: { hp: 56, attack: 61, defense: 65, speed: 38, specialAttack: 48, specialDefense: 45 }, abilities: ["OVERGROW"],
  growthRate: "Parabolic", baseExperience: 64, levelUpMoves: [{ level: 1, move: "TACKLE" }] }], moves: [tackle] };
const potion = { id: 217, internalName: "POTION", name: "Potion", description: "Restaure des PV.", pocket: 2, price: 300 };

describe("source economy", () => {
  it("buys an item atomically", () => {
    const result = purchaseSourceItem(createSourceEventState(), potion, 3);
    expect(result).toMatchObject({ ok: true, cost: 900, state: { money: 2100, inventory: { POTION: 3 } } });
  });

  it("does not alter state when funds or bag space are insufficient", () => {
    const poor = { ...createSourceEventState(), money: 299 };
    expect(purchaseSourceItem(poor, potion, 1)).toEqual({ ok: false, state: poor, reason: "insufficient-funds" });
    const full = { ...createSourceEventState(), inventory: { POTION: 999 } };
    expect(purchaseSourceItem(full, potion, 1)).toEqual({ ok: false, state: full, reason: "bag-full" });
  });

  it("uses the source trainer reward and defeat formulas", () => {
    expect(sourceTrainerReward([3, 7, 5], 60)).toBe(420);
    let state = createSourceEventState();
    state = { ...state, party: addPokemonToParty(state.party, createPersistentPokemon("starter", "CHESPIN", 7, catalog)) };
    expect(sourceDefeatLoss(state)).toBe(56);
    expect(sourceDefeatLoss({ ...state, switches: { 88: true } })).toBe(112);
    expect(sourceDefeatLoss({ ...state, switches: { 33: true } })).toBe(0);
    expect(addSourceMoney({ ...state, money: 999_900 }, 500).money).toBe(999_999);
  });
});
