import { describe, expect, it } from "vitest";
import { createPersistentPokemon, type PlayerCreationCatalog, type PlayerPartyState } from "@pokemon-z-battle/player-state";
import { prepareSourceBattleJoinTeam, prepareSourcePlayerBattleTeam }
  from "../src/source-battle-team-preparation.js";
import type { SourceMegaEvolutionCatalog } from "../src/source-mega-evolution.js";

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

const megaCatalog: SourceMegaEvolutionCatalog = {
  activationItems: ["BRAZALESPIRITUAL"],
  disableSwitchId: 34,
  definitions: [{ species: "READY", heldItem: "READYITE", form: 1,
    baseStats: { hp: 60, attack: 80, defense: 70, speed: 90, specialAttack: 100, specialDefense: 75 },
    types: ["NORMAL"], ability: "HUGEPOWER" }],
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

  it("neutralizes an unsupported held item without mutating the personal party", () => {
    const ready = party(["READY"]);
    const withItem = { ...ready, members: ready.members.map((member) => ({ ...member,
      heldItem: "AMULETCOIN" })) };
    const result = prepareSourcePlayerBattleTeam(withItem, catalog);
    expect(result.team?.members[0]?.heldItem).toBeNull();
    expect(result.notice).toContain("objet tenu a été neutralisé");
    expect(withItem.members[0]?.heldItem).toBe("AMULETCOIN");
  });

  it("projects a compatible Mega Stone without consuming or neutralizing it", () => {
    const ready = party(["READY"]);
    const withStone = { ...ready, members: ready.members.map((member) => ({ ...member,
      heldItem: "READYITE" })) };
    const result = prepareSourcePlayerBattleTeam(withStone, catalog, megaCatalog, true);
    expect(result.team?.members[0]).toMatchObject({ heldItem: null,
      megaEvolution: { heldItem: "READYITE", form: 1, types: ["NORMAL"], ability: "HUGEPOWER",
        activationAvailable: true } });
    expect(result.notice).toBeNull();
    expect(withStone.members[0]?.heldItem).toBe("READYITE");
  });

  it("keeps a fainted reserve while projecting a team through the compatibility fallback", () => {
    const ready = party(["READY", "READY"]);
    const projected = { ...ready, members: ready.members.map((member, index) => ({ ...member,
      hp: index === 1 ? 0 : member.hp, heldItem: index === 0 ? "READYITE" : null })) };
    const result = prepareSourcePlayerBattleTeam(projected, catalog, megaCatalog);
    expect(result.team?.members).toHaveLength(2);
    expect(result.team?.members[1]?.hp).toBe(0);
    expect(result.team?.activeIndex).toBe(0);
  });

  it("reserves the healing advice for a genuinely fainted party", () => {
    const ready = party(["READY"]);
    const result = prepareSourceBattleJoinTeam({ ...ready,
      members: ready.members.map((member) => ({ ...member, hp: 0 })) }, catalog);
    expect(result.team).toBeNull();
    expect(result.requiresHealing).toBe(true);
  });
});
