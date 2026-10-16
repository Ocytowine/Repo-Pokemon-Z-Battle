import { describe, expect, it } from "vitest";
import { bindMegaEvolutionOwners, createTeamBattleState, megaEvolutionEligibility,
  resolveMegaEvolutionIntents, type BattlerState, type MegaEvolutionEligibilityInput } from "../src/index.js";

const definitions = [
  { species: "CHARIZARD", heldItem: "CHARIZARDITEX", form: 1 },
  { species: "CHARIZARD", heldItem: "CHARIZARDITEY", form: 2 },
];

const ready: MegaEvolutionEligibilityInput = {
  species: "CHARIZARD", heldItem: "CHARIZARDITEX", currentForm: 0, hp: 120,
  disabled: false, ownerKind: "player", activationItemAvailable: true,
  ownerState: "available", skyDropped: false,
};

describe("mega evolution eligibility", () => {
  it("selects the form from the exact species and held stone", () => {
    expect(megaEvolutionEligibility(definitions, ready)).toEqual({ eligible: true,
      definition: definitions[0] });
    expect(megaEvolutionEligibility(definitions, { ...ready, heldItem: "CHARIZARDITEY" }))
      .toEqual({ eligible: true, definition: definitions[1] });
  });

  it("enforces Pokemon Z's player activation item and once-per-owner rule", () => {
    expect(megaEvolutionEligibility(definitions, { ...ready, activationItemAvailable: false }))
      .toEqual({ eligible: false, reason: "missing-activation-item" });
    expect(megaEvolutionEligibility(definitions, { ...ready, ownerState: "used" }))
      .toEqual({ eligible: false, reason: "already-used" });
    expect(megaEvolutionEligibility(definitions, { ...ready, ownerKind: "opponent",
      activationItemAvailable: false })).toMatchObject({ eligible: true });
  });

  it("rejects incompatible stones, disabled battles and immobilized battlers", () => {
    expect(megaEvolutionEligibility(definitions, { ...ready, heldItem: "VENUSAURITE" }))
      .toEqual({ eligible: false, reason: "no-compatible-form" });
    expect(megaEvolutionEligibility(definitions, { ...ready, disabled: true }))
      .toEqual({ eligible: false, reason: "disabled" });
    expect(megaEvolutionEligibility(definitions, { ...ready, skyDropped: true }))
      .toEqual({ eligible: false, reason: "sky-drop" });
  });

  it("applies the source form while preserving damage and consumes one use per owner", () => {
    const battler = (id: string): BattlerState => ({ id, species: "CHARIZARD", name: id, level: 50,
      types: ["FIRE", "FLYING"], stats: { maxHp: 150, attack: 100, defense: 90,
        specialAttack: 110, specialDefense: 95, speed: 100 }, hp: 120,
      stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
        speed: 0, accuracy: 0, evasion: 0 }, majorStatus: null, ability: "BLAZE", heldItem: null,
      moves: [], appearance: { form: 0, shiny: false, gender: "male" }, megaEvolution: {
        heldItem: "CHARIZARDITEX", form: 1, activationAvailable: true,
        types: ["FIRE", "DRAGON"], ability: "TOUGHCLAWS",
        stats: { maxHp: 180, attack: 160, defense: 120, specialAttack: 150, specialDefense: 100, speed: 120 },
      } });
    let state = createTeamBattleState({ player: [battler("first"), battler("second")],
      opponent: [{ ...battler("foe"), megaEvolution: undefined }] });
    state = bindMegaEvolutionOwners(state, { first: "trainer-a", second: "trainer-a" });
    const first = resolveMegaEvolutionIntents(state, [{ side: "player", teamIndex: 0 }]);
    expect(first.state.teams.player.members[0]).toMatchObject({ hp: 150, ability: "TOUGHCLAWS",
      types: ["FIRE", "DRAGON"], appearance: { form: 1 }, stats: { maxHp: 180, attack: 160 } });
    expect(first.state.megaEvolution?.usedOwnerIds).toEqual(["trainer-a"]);
    expect(first.events).toContainEqual(expect.objectContaining({ type: "megaEvolved", pokemonId: "first" }));

    const second = resolveMegaEvolutionIntents(first.state, [{ side: "player", teamIndex: 1 }]);
    expect(second.state.teams.player.members[1]?.appearance?.form).toBe(0);
    expect(second.events).toEqual([]);
  });

  it("keeps independent Mega Evolution uses for two Coop owners in one camp", () => {
    const base = (id: string): BattlerState => ({ id, species: "EEVEE", name: id, level: 5,
      types: ["NORMAL"], stats: { maxHp: 20, attack: 10, defense: 10, specialAttack: 10,
        specialDefense: 10, speed: 10 }, hp: 20, stages: { attack: 0, defense: 0,
        specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 }, majorStatus: null,
      ability: "RUNAWAY", heldItem: null, moves: [], appearance: { form: 0, shiny: false, gender: null },
      megaEvolution: { heldItem: "EEVEEITE", form: 1, activationAvailable: true, types: ["NORMAL"],
        ability: "ADAPTABILITY", stats: { maxHp: 25, attack: 20, defense: 20,
          specialAttack: 20, specialDefense: 20, speed: 20 } } });
    let state = createTeamBattleState({ player: [base("host"), base("guest")],
      opponent: [{ ...base("foe"), megaEvolution: undefined }] });
    state = bindMegaEvolutionOwners(state, { host: "host-id", guest: "guest-id" });
    const result = resolveMegaEvolutionIntents(state, [
      { side: "player", teamIndex: 0 }, { side: "player", teamIndex: 1 },
    ]);
    expect(result.events).toHaveLength(2);
    expect(result.state.megaEvolution?.usedOwnerIds).toEqual(["host-id", "guest-id"]);
  });
});
