import { describe, expect, it } from "vitest";
import { createTeamBattleState, MINIMAL_MOVE_CATALOG, type BattlerState,
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

  it("keeps reduced-motion independent messages for residual damage and defeat", () => {
    const state = createTeamBattleState({ player: [battler("Héros", 3)], opponent: [battler("Cible")] });
    const sequence = buildSourceBattlePresentationSequence(state, [
      { type: "statusContinued", side: "player", status: "poison" },
      { type: "statusDamage", side: "player", status: "poison", amount: 3, hp: 0 },
      { type: "fainted", side: "player" },
      { type: "battleEnded", winner: "opponent" },
    ]);
    expect(sequence.map((step) => step.kind)).toEqual(["status", "health", "faint"]);
    expect(sequence[1]).toMatchObject({ to: 0, state: { teams: { player: { members: [{ hp: 0 }] } } } });
  });

  it("presents authoritative PP and temporary stage item effects", () => {
    const state = createTeamBattleState({ player: [battler("Héros")], opponent: [battler("Cible")] });
    const common = { type: "trainerItemUsed" as const, side: "player" as const,
      targetIndex: 0, target: "Héros", hpRestored: 0, statusCured: null, revived: false };
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
});
