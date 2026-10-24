import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide,
  type BattlerState, type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: () => 0 };
const status = (code: BattleMove["functionCode"], type = "NORMAL"): BattleMove => ({
  ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: code, functionCode: code,
  type, category: "Status", power: 0, accuracy: 100, targetCode: "00" });
const hit = (code: BattleMove["functionCode"], type: string): BattleMove => ({
  ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: code, functionCode: code,
  type, category: "Physical", power: 80, accuracy: 100, targetCode: "00" });
function battler(id: string, side: BattleSide, move: BattleMove): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 240, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: side === "player" ? 100 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 240, majorStatus: null,
    ability: null, heldItem: null, moves: [{ move, pp: 10 }] };
}
const turn = (side: BattleSide) => ({ player: side === "player"
  ? { kind: "move" as const, moveIndex: 0 } : { kind: "wait" as const },
opponent: side === "opponent"
  ? { kind: "move" as const, moveIndex: 0 } : { kind: "wait" as const } });

describe("stat, type and damage function codes", () => {
  it("Foul Play uses the defender's Attack and its stat stage", () => {
    const foul = hit("121", "DARK");
    const user = battler("user", "player", foul);
    const foe = battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE);
    const attack = (value: number, stage = 0) => resolveTeamTurn(createTeamBattleState({
      player: [user], opponent: [{ ...foe, stats: { ...foe.stats, attack: value },
        stages: { ...foe.stages, attack: stage } }],
    }), turn("player"), rng).state.teams.opponent.members[0]!.hp;
    expect(attack(160)).toBeLessThan(attack(60));
    expect(attack(100, 2)).toBeLessThan(attack(100, -2));
  });

  it("Synchronoise only strikes opponents sharing an effective type", () => {
    const sound = { ...hit("123", "PSYCHIC"), category: "Special" as const,
      targetCode: "08" };
    const user = battler("user", "player", sound);
    const foe = battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE);
    const failed = resolveTeamTurn(createTeamBattleState({ player: [user],
      opponent: [{ ...foe, types: ["FIRE"] }] }), turn("player"), rng);
    expect(failed.state.teams.opponent.members[0]?.hp).toBe(240);
    const landed = resolveTeamTurn(createTeamBattleState({ player: [user],
      opponent: [{ ...foe, types: ["NORMAL", "FIRE"] }] }), turn("player"), rng);
    expect(landed.state.teams.opponent.members[0]?.hp).toBeLessThan(240);
  });

  it("Synchronoise filters each positioned target independently in double", () => {
    const sound = { ...hit("123", "PSYCHIC"), category: "Special" as const,
      targetCode: "08" };
    const initial = createDoubleTeamBattleState({ player: [
      battler("user", "player", sound),
      { ...battler("ally", "player", MINIMAL_MOVE_CATALOG.TACKLE), types: ["FIRE"] }],
    opponent: [battler("shared", "opponent", MINIMAL_MOVE_CATALOG.TACKLE),
      { ...battler("other", "opponent", MINIMAL_MOVE_CATALOG.TACKLE), types: ["WATER"] }] });
    const result = resolveDoubleTeamTurn(initial, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.opponent.members[0]?.hp).toBeLessThan(240);
    expect(result.state.teams.opponent.members[1]?.hp).toBe(240);
    expect(result.state.teams.player.members[1]?.hp).toBe(240);
  });

  it("Freeze-Dry is super-effective on Water and can freeze", () => {
    const freeze = { ...hit("135", "ICE"), category: "Special" as const,
      effectChance: 100 };
    const foe = battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE);
    const damage = (types: string[]) => resolveTeamTurn(createTeamBattleState({
      player: [battler("user", "player", freeze)], opponent: [{ ...foe, types }],
    }), turn("player"), rng);
    const water = damage(["WATER"]);
    const neutral = damage(["NORMAL"]);
    expect(water.state.teams.opponent.members[0]?.hp).toBeLessThan(neutral.state.teams.opponent.members[0]!.hp);
    expect(water.state.teams.opponent.members[0]?.majorStatus?.kind).toBe("frozen");
  });

  it.each([["13A", -1, -1], ["13C", 0, -1], ["13D", 0, -2]] as const)(
    "%s changes Attack and Special Attack by %i/%i", (code, attack, specialAttack) => {
      const move = status(code, code === "13D" ? "ELECTRIC" : "NORMAL");
      const result = resolveTeamTurn(createTeamBattleState({
        player: [battler("user", "player", move)],
        opponent: [battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)],
      }), turn("player"), rng);
      expect(result.state.teams.opponent.members[0]?.stages.attack).toBe(attack);
      expect(result.state.teams.opponent.members[0]?.stages.specialAttack).toBe(specialAttack);
    });

  it("Eerie Impulse is absorbed by Lightning Rod", () => {
    const result = resolveTeamTurn(createTeamBattleState({
      player: [battler("user", "player", status("13D", "ELECTRIC"))],
      opponent: [{ ...battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE),
        ability: "LIGHTNINGROD" }],
    }), turn("player"), rng);
    expect(result.state.teams.opponent.members[0]?.stages.specialAttack).toBe(1);
  });

  it("Clear Amulet blocks Noble Roar's stat reductions", () => {
    const result = resolveTeamTurn(createTeamBattleState({
      player: [battler("user", "player", status("13A"))],
      opponent: [{ ...battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE),
        heldItem: "CLEARAMULET" }],
    }), turn("player"), rng);
    expect(result.state.teams.opponent.members[0]?.stages.attack).toBe(0);
    expect(result.state.teams.opponent.members[0]?.stages.specialAttack).toBe(0);
  });

  it("Trick-or-Treat and Forest's Curse replace only the temporary third type", () => {
    const ghost = status("142", "GHOST");
    const grass = status("143", "GRASS");
    const user = { ...battler("user", "player", ghost), moves: [
      { move: ghost, pp: 10 }, { move: grass, pp: 10 }] };
    const initial = createTeamBattleState({ player: [user],
      opponent: [battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const first = resolveTeamTurn(initial, turn("player"), rng);
    expect(first.state.teams.opponent.members[0]?.types).toEqual(["NORMAL", "GHOST"]);
    const second = resolveTeamTurn(first.state, { player: { kind: "move", moveIndex: 1 },
      opponent: { kind: "wait" } }, rng);
    expect(second.state.teams.opponent.members[0]?.types).toEqual(["NORMAL", "GRASS"]);
  });

  it("Magic Powder sets Psychic only and fails against an already Psychic target", () => {
    const powder = status("904", "PSYCHIC");
    const initial = createTeamBattleState({ player: [battler("user", "player", powder)],
      opponent: [battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const first = resolveTeamTurn(initial, turn("player"), rng);
    expect(first.state.teams.opponent.members[0]?.types).toEqual(["PSYCHIC"]);
    expect(resolveTeamTurn(first.state, turn("player"), rng).events).toContainEqual({
      type: "moveFailed", side: "player", move: "904", reason: "condition" });
  });

  it("restores a temporary type on withdrawal and keeps the new type during battle", () => {
    const powder = status("904", "PSYCHIC");
    const initial = createTeamBattleState({ player: [battler("user", "player", powder)],
      opponent: [battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE),
        battler("reserve", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const changed = resolveTeamTurn(initial, turn("player"), rng);
    expect(changed.state.teams.opponent.members[0]?.types).toEqual(["PSYCHIC"]);
    const switched = resolveTeamTurn(changed.state, { player: { kind: "wait" },
      opponent: { kind: "switch", teamIndex: 1 } }, rng);
    expect(switched.state.teams.opponent.members[0]?.types).toEqual(["NORMAL"]);
  });

  it("Strength Sap heals from pre-drop Attack and is reversed by Liquid Ooze", () => {
    const sap = status("902", "GRASS");
    const user = { ...battler("user", "player", sap), hp: 100 };
    const foe = battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE);
    const first = resolveTeamTurn(createTeamBattleState({ player: [user],
      opponent: [foe] }), turn("player"), rng);
    expect(first.state.teams.player.members[0]?.hp).toBe(200);
    expect(first.state.teams.opponent.members[0]?.stages.attack).toBe(-1);
    const ooze = resolveTeamTurn(createTeamBattleState({ player: [user],
      opponent: [{ ...foe, ability: "LIQUIDOOZE" }] }), turn("player"), rng);
    expect(ooze.state.teams.player.members[0]?.hp).toBe(0);
  });

  it("applies a type change to a selected double opponent", () => {
    const initial = createDoubleTeamBattleState({ player: [
      battler("user", "player", status("904", "PSYCHIC")),
      battler("partner", "player", MINIMAL_MOVE_CATALOG.TACKLE)],
    opponent: [battler("one", "opponent", MINIMAL_MOVE_CATALOG.TACKLE),
      battler("two", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const result = resolveDoubleTeamTurn(initial, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 1 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.opponent.members[1]?.types).toEqual(["PSYCHIC"]);
    expect(result.state.teams.opponent.members[0]?.types).toEqual(["NORMAL"]);
  });
});
