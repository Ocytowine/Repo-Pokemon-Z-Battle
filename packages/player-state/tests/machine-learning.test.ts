import { describe, expect, it } from "vitest";
import { createEmptyPlayerParty, createPersistentPokemonMetadata, teachPokemonMachineMove,
  type PersistentPokemon } from "../src/index.js";

const pokemon = (moves: readonly string[]): PersistentPokemon => ({
  id: "learner", species: "CHESPIN", nickname: null, level: 8, experience: 0,
  stats: { maxHp: 30, attack: 20, defense: 20, specialAttack: 20, specialDefense: 20, speed: 20 },
  hp: 30, majorStatus: null, ability: null, heldItem: null,
  moves: moves.map((internalName) => ({ internalName, pp: 5, maxPp: 10 })),
  metadata: createPersistentPokemonMetadata("learner", "CHESPIN", 8),
});
const party = (moves: readonly string[]) => ({ ...createEmptyPlayerParty(), activeIndex: 0, members: [pokemon(moves)] });
const move = { internalName: "HONECLAWS", pp: 15 };

describe("personal machine learning", () => {
  it("learns and consumes a TM atomically when a slot is free", () => {
    const original = party(["TACKLE"]);
    expect(teachPokemonMachineMove({ TM01: 2 }, original, "learner", "TM01", move, true, true))
      .toMatchObject({ ok: true, inventory: { TM01: 1 }, consumed: true,
        pokemon: { moves: [{ internalName: "TACKLE" }, { internalName: "HONECLAWS", pp: 15, maxPp: 15 }] } });
    expect(original.members[0]?.moves).toHaveLength(1);
  });

  it("requires an explicit replacement and preserves an HM", () => {
    const full = party(["A", "B", "C", "D"]);
    expect(teachPokemonMachineMove({ HM01: 1 }, full, "learner", "HM01", move, true, false))
      .toMatchObject({ ok: false, reason: "replacement-required" });
    expect(teachPokemonMachineMove({ HM01: 1 }, full, "learner", "HM01", move, true, false, 2))
      .toMatchObject({ ok: true, inventory: { HM01: 1 }, consumed: false, forgottenMove: "C",
        pokemon: { moves: [{ internalName: "A" }, { internalName: "B" }, { internalName: "HONECLAWS", pp: 5 },
          { internalName: "D" }] } });
  });

  it("rejects incompatibility and a move already known without consuming", () => {
    expect(teachPokemonMachineMove({ TM01: 1 }, party(["TACKLE"]), "learner", "TM01", move, false, true))
      .toMatchObject({ ok: false, inventory: { TM01: 1 }, reason: "incompatible" });
    expect(teachPokemonMachineMove({ TM01: 1 }, party(["HONECLAWS"]), "learner", "TM01", move, true, true))
      .toMatchObject({ ok: false, inventory: { TM01: 1 }, reason: "already-known" });
  });
});
