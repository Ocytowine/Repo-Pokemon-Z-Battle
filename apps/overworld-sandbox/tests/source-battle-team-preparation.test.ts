import { describe, expect, it } from "vitest";
import { createPersistentPokemon, type PlayerCreationCatalog, type PlayerPartyState } from "@pokemon-z-battle/player-state";
import { prepareSourceBattleJoinTeam } from "../src/source-battle-team-preparation.js";

const catalog: PlayerCreationCatalog = {
  pokemon: [
    { internalName: "READY", name: "Valide", types: ["NORMAL"],
      baseStats: { hp: 50, attack: 50, defense: 50, speed: 50, specialAttack: 50, specialDefense: 50 },
      abilities: ["RUNAWAY"], growthRate: "Medium", baseExperience: 50, genderRate: "Female50Percent",
      happiness: 70, levelUpMoves: [{ level: 1, move: "TACKLE" }] },
    { internalName: "FUTURE", name: "À porter", types: ["NORMAL"],
      baseStats: { hp: 50, attack: 50, defense: 50, speed: 50, specialAttack: 50, specialDefense: 50 },
      abilities: ["RUNAWAY"], growthRate: "Medium", baseExperience: 50, genderRate: "Female50Percent",
      happiness: 70, levelUpMoves: [{ level: 1, move: "FUTUREMOVE" }] },
  ],
  moves: [
    { id: 1, internalName: "TACKLE", name: "Charge", functionCode: "000", power: 40, type: "NORMAL",
      category: "Physical", accuracy: 100, pp: 35, priority: 0, effectChance: 0 },
    { id: 2, internalName: "FUTUREMOVE", name: "Capacité future", functionCode: "FFF", power: 40,
      type: "NORMAL", category: "Physical", accuracy: 100, pp: 10, priority: 0, effectChance: 0 },
  ],
};

function party(species: readonly string[]): PlayerPartyState {
  return { schemaVersion: 1, activeIndex: species.length === 0 ? null : 0,
    members: species.map((name, index) => createPersistentPokemon(`member-${index}`, name, 5, catalog)) };
}

describe("Coop battle team preparation", () => {
  it("keeps conscious compatible members when one reserve uses an unsupported mechanic", () => {
    const result = prepareSourceBattleJoinTeam(party(["READY", "FUTURE"]), catalog);
    expect(result.team?.members.map((member) => member.species)).toEqual(["READY"]);
    expect(result.requiresHealing).toBe(false);
    expect(result.notice).toContain("1 Pokémon a été écarté");
  });

  it("does not misreport an incompatible healthy team as fainted", () => {
    const result = prepareSourceBattleJoinTeam(party(["FUTURE"]), catalog);
    expect(result.team).toBeNull();
    expect(result.requiresHealing).toBe(false);
    expect(result.unavailableReason).toContain("L'équipe est en forme");
  });

  it("keeps a healthy Pokemon when at least one of its moves is supported", () => {
    const ready = party(["READY"]);
    const mixed = { ...ready, members: ready.members.map((member) => ({ ...member,
      moves: [...member.moves, { internalName: "FUTUREMOVE", pp: 10, maxPp: 10 }] })) };
    const result = prepareSourceBattleJoinTeam(mixed, catalog);
    expect(result.team?.members[0]?.moves.map((slot) => slot.move.internalName)).toEqual(["TACKLE"]);
    expect(result.requiresHealing).toBe(false);
    expect(result.notice).toContain("1 capacité non prise en charge a été retirée");
  });

  it("reserves the healing advice for a genuinely fainted party", () => {
    const ready = party(["READY"]);
    const result = prepareSourceBattleJoinTeam({ ...ready,
      members: ready.members.map((member) => ({ ...member, hp: 0 })) }, catalog);
    expect(result.team).toBeNull();
    expect(result.requiresHealing).toBe(true);
  });
});
