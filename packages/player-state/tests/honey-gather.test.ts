import { describe, expect, it } from "vitest";
import { applyHoneyGather, applyHoneyGatherResult, type PlayerPartyState } from "../src/index.js";

function party(level = 21): PlayerPartyState {
  return { schemaVersion: 2, activeIndex: 0, members: [{
    id: "honey-owner", species: "COMBEE", nickname: null, level, experience: 0,
    stats: { maxHp: 50, attack: 20, defense: 20, specialAttack: 20, specialDefense: 20, speed: 20 },
    hp: 0, majorStatus: null, ability: "HONEYGATHER", heldItem: null, moves: [],
    metadata: { schemaVersion: 1, personalId: 1,
      ivs: { hp: 0, attack: 0, defense: 0, speed: 0, specialAttack: 0, specialDefense: 0 },
      evs: { hp: 0, attack: 0, defense: 0, speed: 0, specialAttack: 0, specialDefense: 0 },
      nature: "HARDY", gender: "female", happiness: 70, shiny: false, form: 0,
      owner: { trainerId: 1, publicId: 1, name: "Dresseur", pronouns: null },
      origin: { method: "met", mapId: 1, level, receivedAt: null, hatchedMapId: null,
        hatchedAt: null, ball: "POKEBALL" }, markings: 0, ribbons: [], pokerus: null, eggSteps: 0 },
  }] };
}

describe("Honey Gather personal settlement", () => {
  it("uses the source level chance after victory, including for a fainted party member", () => {
    expect(applyHoneyGather(party(), { nextInt: () => 14 }).party.members[0]!.heldItem).toBe("HONEY");
    expect(applyHoneyGather(party(), { nextInt: () => 15 }).party.members[0]!.heldItem).toBeNull();
  });

  it("replays an authoritative owner result without rerolling and rejects invalid ownership state", () => {
    expect(applyHoneyGatherResult(party(), ["honey-owner"]).members[0]!.heldItem).toBe("HONEY");
    expect(() => applyHoneyGatherResult(party(), ["missing"])).toThrow(/absent/u);
    expect(() => applyHoneyGatherResult({ ...party(), members: [{ ...party().members[0]!, heldItem: "HONEY" }] },
      ["honey-owner"])).toThrow(/invalide/u);
  });
});

