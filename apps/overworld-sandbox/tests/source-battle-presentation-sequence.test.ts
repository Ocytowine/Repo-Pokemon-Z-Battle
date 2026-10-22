import { describe, expect, it } from "vitest";
import { createDoubleTeamBattleState, createTeamBattleState, MINIMAL_MOVE_CATALOG, type BattlerState,
  type TeamBattleEvent } from "@pokemon-z-battle/battle-engine";
import { buildSourceBattlePresentationSequence } from "../src/source-battle-presentation-sequence.js";

function battler(id: string, hp = 20): BattlerState {
  return { id, species: id, name: id, level: 5, types: ["NORMAL"], hp,
    stats: { maxHp: 20, attack: 10, defense: 10, specialAttack: 10, specialDefense: 10, speed: 10 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 10 }] };
}

describe("source battle presentation sequence", () => {
  it("projects shared HP and changed types for remote participants", () => {
    const state = createTeamBattleState({ player: [battler("Héros", 8)],
      opponent: [battler("Cible", 16)] });
    const sequence = buildSourceBattlePresentationSequence(state, [
      { type: "hpShared", side: "player", move: "PAINSPLIT", hp: 12 },
      { type: "hpShared", side: "opponent", move: "PAINSPLIT", hp: 12 },
      { type: "typesChanged", source: "player", target: "opponent", types: ["WATER"], move: "SOAK" },
    ]);
    expect(sequence.map((step) => step.kind)).toEqual(["health", "health", "status"]);
    expect(sequence.at(-1)?.state.teams.opponent.members[0]).toMatchObject({ hp: 12, types: ["WATER"] });
  });

  it("presents swapped and suppressed abilities to participants", () => {
    const state = createTeamBattleState({ player: [battler("Héros")],
      opponent: [battler("Cible")] });
    const sequence = buildSourceBattlePresentationSequence(state, [
      { type: "abilitiesSwapped", source: "player", target: "opponent",
        sourceAbility: "PRESSURE", targetAbility: "SIMPLE", move: "SKILLSWAP" },
      { type: "abilitySuppressed", source: "opponent", target: "player", move: "GASTROACID" },
    ]);
    expect(sequence.map((step) => step.message)).toEqual([
      "Héros et Cible échangent leurs talents.",
      "Le talent de Héros est supprimé.",
    ]);
  });
  it("presents and projects a Pickpocket item transfer", () => {
    const state = createTeamBattleState({
      player: [{ ...battler("Héros"), heldItem: "ORANBERRY" }],
      opponent: [{ ...battler("Voleur"), ability: "PICKPOCKET" }],
    });
    const sequence = buildSourceBattlePresentationSequence(state, [
      { type: "abilityActivated", side: "opponent", ability: "PICKPOCKET", effect: "steal-item" },
      { type: "heldItemTransferred", source: "player", target: "opponent", item: "ORANBERRY", reason: "pickpocket" },
    ], { abilityName: () => "Pickpocket", itemName: () => "Baie Oran" });

    expect(sequence.map((step) => step.message)).toEqual([
      "Le talent Pickpocket de Voleur s'active !",
      "Voleur vole Baie Oran à Héros !",
    ]);
    expect(sequence.at(-1)?.state.teams.player.members[0]?.heldItem).toBeNull();
    expect(sequence.at(-1)?.state.teams.opponent.members[0]?.heldItem).toBe("ORANBERRY");
  });

  it("presents ability recoil damage and its intermediate HP", () => {
    const state = createTeamBattleState({ player: [battler("Attaquant")], opponent: [battler("Défenseur")] });
    const sequence = buildSourceBattlePresentationSequence(state, [
      { type: "abilityActivated", side: "opponent", ability: "ROUGHSKIN", effect: "damage-attacker" },
      { type: "abilityDamage", source: "opponent", target: "player", ability: "ROUGHSKIN", amount: 2, hp: 18 },
    ], { abilityName: () => "Peau Dure" });
    expect(sequence.map((step) => step.kind)).toEqual(["status", "health"]);
    expect(sequence[1]).toMatchObject({ from: 20, to: 18,
      message: "Attaquant perd 2 PV à cause de Peau Dure." });
  });

  it("presents move recoil and crash damage through authoritative HP", () => {
    const state = createTeamBattleState({ player: [battler("Attaquant")], opponent: [battler("Cible")] });
    const sequence = buildSourceBattlePresentationSequence(state, [
      { type: "recoilDamage", side: "player", move: "DOUBLEEDGE", reason: "recoil", amount: 4, hp: 16 },
      { type: "recoilDamage", side: "player", move: "HIJUMPKICK", reason: "crash", amount: 10, hp: 6 },
    ]);
    expect(sequence.map((step) => step.kind)).toEqual(["health", "health"]);
    expect(sequence[0]).toMatchObject({ from: 20, to: 16 });
    expect(sequence[1]).toMatchObject({ from: 16, to: 6 });
  });

  it("shows impact and zero HP before effectiveness and fainting", () => {
    const state = createTeamBattleState({ player: [battler("Héros")], opponent: [battler("Cible", 4)] });
    const events: TeamBattleEvent[] = [
      { type: "moveUsed", side: "player", move: "TACKLE" },
      { type: "damageApplied", source: "player", target: "opponent", amount: 4, hp: 0,
        critical: true, effectiveness: 2 },
      { type: "fainted", side: "opponent" },
      { type: "battleEnded", winner: "player" },
    ];

    const sequence = buildSourceBattlePresentationSequence(state, events);

    expect(sequence.map((step) => step.kind)).toEqual([
      "action", "impact", "health", "message", "message", "faint",
    ]);
    expect(sequence[2]).toMatchObject({ kind: "health", from: 4, to: 0,
      state: { teams: { opponent: { members: [{ hp: 0 }] } } } });
    expect(sequence[3]).toMatchObject({ message: "Coup critique !" });
    expect(sequence[4]).toMatchObject({ message: "C'est super efficace !" });
  });

  it("keeps every multi-hit impact and intermediate HP value", () => {
    const state = createTeamBattleState({ player: [battler("Héros")], opponent: [battler("Cible")] });
    const sequence = buildSourceBattlePresentationSequence(state, [
      { type: "damageApplied", source: "player", target: "opponent", amount: 4, hp: 16,
        critical: false, effectiveness: 1 },
      { type: "damageApplied", source: "player", target: "opponent", amount: 5, hp: 11,
        critical: false, effectiveness: 1 },
    ]);
    expect(sequence.map((step) => step.kind)).toEqual(["impact", "health", "impact", "health"]);
    expect(sequence[1]).toMatchObject({ from: 20, to: 16 });
    expect(sequence[3]).toMatchObject({ from: 16, to: 11 });
  });

  it.each([
    [0, "Cela n'affecte pas la cible…"],
    [0.5, "Ce n'est pas très efficace…"],
    [2, "C'est super efficace !"],
  ])("announces effectiveness %s", (effectiveness, expected) => {
    const state = createTeamBattleState({ player: [battler("Héros")], opponent: [battler("Cible")] });
    const sequence = buildSourceBattlePresentationSequence(state, [
      { type: "damageApplied", source: "player", target: "opponent", amount: effectiveness === 0 ? 0 : 3,
        hp: effectiveness === 0 ? 20 : 17, critical: false, effectiveness },
    ]);
    expect(sequence.at(-1)).toMatchObject({ kind: "message", message: expected });
  });

  it("presents misses, statuses, healing and replacement in event order", () => {
    const state = createTeamBattleState({
      player: [battler("Actif", 10), battler("Réserve")], opponent: [battler("Cible")],
    });
    const sequence = buildSourceBattlePresentationSequence(state, [
      { type: "moveMissed", side: "opponent", move: "TACKLE" },
      { type: "statusApplicationFailed", source: "opponent", target: "player", status: "poison", reason: "type-immune" },
      { type: "hpRestored", side: "player", source: "move", move: "TACKLE", amount: 5, hp: 15 },
      { type: "pokemonSwitched", side: "player", fromIndex: 0, toIndex: 1,
        from: "Actif", to: "Réserve", reason: "voluntary" },
    ]);
    expect(sequence.map((step) => step.kind)).toEqual(["message", "status", "health", "replacement"]);
    expect(sequence[1]).toMatchObject({ message: "Actif est immunisé contre le poison." });
    expect(sequence[2]).toMatchObject({ from: 10, to: 15 });
    expect(sequence[3]).toMatchObject({ state: { teams: { player: { activeIndex: 1 } } } });
  });

  it("waits for zero HP and fainting before sending a conscious reserve", () => {
    const state = createTeamBattleState({
      player: [battler("Actif", 3), battler("Réserve")], opponent: [battler("Cible")],
    });
    const sequence = buildSourceBattlePresentationSequence(state, [
      { type: "damageApplied", source: "opponent", target: "player", amount: 3, hp: 0,
        critical: false, effectiveness: 1 },
      { type: "fainted", side: "player" },
      { type: "replacementRequired", side: "player" },
      { type: "pokemonSwitched", side: "player", fromIndex: 0, toIndex: 1,
        from: "Actif", to: "Réserve", reason: "replacement" },
    ]);
    expect(sequence.map((step) => step.kind)).toEqual(["impact", "health", "faint", "replacement"]);
    expect(sequence.at(-1)).toMatchObject({ message: "Réserve, en avant !",
      state: { teams: { player: { activeIndex: 1 } } } });
  });

  it("keeps damage from earlier double slots while presenting the next action", () => {
    const state = createDoubleTeamBattleState({
      player: [battler("Allié 1"), battler("Allié 2")],
      opponent: [battler("Adverse 1"), battler("Adverse 2")],
    });
    const sequence = buildSourceBattlePresentationSequence(state, [
      { type: "positionedActionResolved", actor: { side: "player", slot: 0 },
        targets: [{ side: "opponent", slot: 0 }], events: [
          { type: "damageApplied", source: "player", target: "opponent", amount: 10, hp: 10,
            critical: false, effectiveness: 1 },
        ] },
      { type: "positionedActionResolved", actor: { side: "player", slot: 1 },
        targets: [{ side: "opponent", slot: 1 }], events: [
          { type: "damageApplied", source: "player", target: "opponent", amount: 15, hp: 5,
            critical: false, effectiveness: 1 },
          { type: "fainted", side: "opponent" },
        ] },
    ]);
    const last = sequence.at(-1);
    expect(last).toMatchObject({ kind: "faint", state: { teams: { opponent: {
      activeIndex: 1, members: [{ hp: 10 }, { hp: 0 }],
    } } } });
  });

  it("updates the replaced slot instead of collapsing a double team onto slot one", () => {
    const state = createDoubleTeamBattleState({
      player: [battler("Actif 1"), battler("Actif 2", 0), battler("Réserve")],
      opponent: [battler("Adverse 1"), battler("Adverse 2")],
    });
    const sequence = buildSourceBattlePresentationSequence({ ...state, teams: { ...state.teams,
      player: { ...state.teams.player, activeIndex: 0, activeIndices: [0, 1] } },
      slotReplacements: [{ side: "player", slot: 1 }] }, [
      { type: "pokemonSwitched", side: "player", fromIndex: 1, toIndex: 2,
        from: "Actif 2", to: "Réserve", reason: "replacement" },
    ]);
    expect(sequence[0]).toMatchObject({ kind: "replacement", state: { teams: { player: {
      activeIndex: 2, activeIndices: [0, 2],
    } }, slotReplacements: [] } });
  });

  it("keeps reduced-motion independent messages for residual damage and defeat", () => {
    const state = createTeamBattleState({ player: [battler("Héros", 3)], opponent: [battler("Cible")] });
    const sequence = buildSourceBattlePresentationSequence(state, [
      { type: "statusContinued", side: "player", status: "poison" },
      { type: "statusDamage", side: "player", status: "poison", amount: 3, hp: 0 },
      { type: "fainted", side: "player" },
      { type: "battleEnded", winner: "opponent" },
    ]);
    expect(sequence.map((step) => step.kind)).toEqual(["status", "health", "faint"]);
    expect(sequence[0]).toMatchObject({ kind: "status", side: "player", visual: "poison" });
    expect(sequence[1]).toMatchObject({ to: 0, state: { teams: { player: { members: [{ hp: 0 }] } } } });
  });

  it("carries status and volatile visual cues without recalculating gameplay", () => {
    const state = createTeamBattleState({ player: [battler("Héros")], opponent: [battler("Cible")] });
    const sequence = buildSourceBattlePresentationSequence(state, [
      { type: "statusApplied", source: "player", target: "opponent", status: "paralysis" },
      { type: "volatileApplied", source: "opponent", target: "player", effect: "confusion", turns: 3 },
      { type: "statStageChanged", source: "player", target: "player", stat: "attack", delta: 1, stage: 1 },
    ]);
    expect(sequence).toEqual([
      expect.objectContaining({ kind: "status", side: "opponent", visual: "paralysis" }),
      expect.objectContaining({ kind: "status", side: "player", visual: "confusion" }),
      expect.objectContaining({ kind: "status", side: "player", visual: "stat-up" }),
    ]);
  });

  it("presents authoritative PP and temporary stage item effects", () => {
    const state = createTeamBattleState({ player: [battler("Héros")], opponent: [battler("Cible")] });
    const common = { type: "trainerItemUsed" as const, side: "player" as const,
      targetIndex: 0, target: "Héros", hpRestored: 0, statusCured: null, revived: false,
      happinessChanged: 0 };
    const sequence = buildSourceBattlePresentationSequence(state, [
      { ...common, itemId: "ETHER", ppRestored: 5, movePp: [15], targetMoveIndex: 0,
        statRaised: null, stagesRaised: 0 },
      { ...common, itemId: "XATTACK", ppRestored: 0, movePp: null, targetMoveIndex: null,
        statRaised: "attack", stagesRaised: 1 },
    ]);
    expect(sequence[0]).toMatchObject({ message: "Héros reçoit ETHER et récupère 5 PP.",
      state: { teams: { player: { members: [{ moves: [{ pp: 15 }] }] } } } });
    expect(sequence[1]).toMatchObject({ message: "Héros reçoit XATTACK : Attaque augmente.",
      state: { teams: { player: { members: [{ stages: { attack: 1 } }] } } } });
  });

  it("uses Z's localized effect message instead of a generic ability identifier", () => {
    const passerouge = { ...battler("Passerouge"), ability: "BIGPECKS" as const };
    const state = createTeamBattleState({ player: [battler("Héros")], opponent: [passerouge] });
    const sequence = buildSourceBattlePresentationSequence(state, [
      { type: "abilityActivated", side: "opponent", ability: "BIGPECKS", effect: "prevent-stat-drop" },
    ], { abilityName: (internalName) => internalName === "BIGPECKS" ? "Cœur de Coq" : internalName });

    expect(sequence).toEqual([expect.objectContaining({ kind: "status",
      message: "Cœur de Coq de Passerouge l'empêche de perdre de la Défense !" })]);
  });

  it("keeps both visual states around the authoritative Mega Evolution", () => {
    const hero = { ...battler("Dracaufeu", 15), appearance: { form: 0, shiny: false, gender: "male" as const },
      megaEvolution: { heldItem: "CHARIZARDITEX", form: 1, activationAvailable: true,
        types: ["FIRE", "DRAGON"], ability: "TOUGHCLAWS",
        stats: { maxHp: 30, attack: 25, defense: 20, specialAttack: 24, specialDefense: 18, speed: 22 } } };
    const state = createTeamBattleState({ player: [hero], opponent: [battler("Cible")] });
    const sequence = buildSourceBattlePresentationSequence(state, [
      { type: "megaEvolved", side: "player", teamIndex: 0, pokemonId: hero.id,
        fromForm: 0, toForm: 1, heldItem: "CHARIZARDITEX" },
    ]);
    expect(sequence).toHaveLength(1);
    expect(sequence[0]).toMatchObject({ kind: "mega-evolution", side: "player", teamIndex: 0,
      activationMessage: "Le lien avec son Dresseur déclenche la Méga-Évolution de Dracaufeu !",
      message: "Dracaufeu a Méga-Évolué !",
      beforeState: { teams: { player: { members: [{ appearance: { form: 0 } }] } } } });
    expect(sequence[0]?.state.teams.player.members[0]).toMatchObject({ hp: 25, ability: "TOUGHCLAWS",
      types: ["FIRE", "DRAGON"], appearance: { form: 1 } });
  });
});
