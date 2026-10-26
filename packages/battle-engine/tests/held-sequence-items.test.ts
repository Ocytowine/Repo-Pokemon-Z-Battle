import { describe, expect, it } from "vitest";
import { calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide,
  type BattlerState, type RandomSource } from "../src/index.js";

const random: RandomSource = { nextInt: () => 0 };
const base: BattleMove = { id: 1, internalName: "TESTMOVE", name: "Test",
  functionCode: "000", power: 30, type: "NORMAL", category: "Physical", accuracy: 0,
  pp: 20, priority: 0, effectChance: 0 };

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 1000, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 1000, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: base, pp: base.pp }], ...overrides };
}

const use = { player: { kind: "move" as const, moveIndex: 0 },
  opponent: { kind: "wait" as const } };

describe("source items affecting a move sequence", () => {
  it.each(["0A2", "0A3", "927"] as const)("matches Light Clay's screen duration for %s", (code) => {
    const screen = { ...base, functionCode: code, power: 0, category: "Status" as const };
    const attacker = pokemon("user", "player", { heldItem: "LIGHTCLAY",
      moves: [{ move: screen, pp: 20 }] });
    const initial = createTeamBattleState({ player: [attacker],
      opponent: [pokemon("foe", "opponent")] });
    const result = resolveTeamTurn(code === "927" ? { ...initial,
      effects: { sides: { player: { reflectTurns: 0, luckyChantTurns: 0 },
        opponent: { reflectTurns: 0, luckyChantTurns: 0 } }, waterSportTurns: 0,
      weather: "hail", weatherTurns: 8 } } : initial, use, random);
    if (code !== "0A3") expect(result.events).toContainEqual(expect.objectContaining({
      type: "battleEffectChanged", side: "player", effect: "reflect",
      turns: code === "927" ? 5 : 8 }));
    if (code !== "0A2") expect(result.events).toContainEqual(expect.objectContaining({
      type: "battleEffectChanged", side: "player", effect: "light-screen",
      turns: code === "927" ? 5 : 8 }));
    expect(result.state.effects.sides.player.reflectTurns, code)
      .toBe(code === "0A3" ? 0 : code === "927" ? 4 : 7);
    expect(result.state.effects.sides.player.lightScreenTurns ?? 0, code)
      .toBe(code === "0A2" ? 0 : code === "927" ? 4 : 7);
  });

  it("sets Grip Claw binding to eight turns and preserves the source", () => {
    const bind = { ...base, functionCode: "0CF" as const, power: 20 };
    const attacker = pokemon("user", "player", { heldItem: "GRIPCLAW",
      moves: [{ move: bind, pp: 20 }] });
    const result = resolveTeamTurn(createTeamBattleState({ player: [attacker],
      opponent: [pokemon("foe", "opponent")] }), use, random);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "volatileApplied",
      source: "player", target: "opponent", effect: "binding", turns: 8 }));
    expect(result.state.teams.opponent.members[0]!.volatile).toMatchObject({
      bindingTurns: 7, bindingSourceId: "user" });
  });

  it("makes Loaded Dice's 2-to-5-hit function land five times", () => {
    const multi = { ...base, functionCode: "0C0" as const, power: 10 };
    const attacker = pokemon("user", "player", { heldItem: "LOADEDDICE",
      moves: [{ move: multi, pp: 20 }] });
    const result = resolveTeamTurn(createTeamBattleState({ player: [attacker],
      opponent: [pokemon("foe", "opponent")] }), use, random);
    expect(result.events.filter((event) => event.type === "damageApplied"
      && event.source === "player")).toHaveLength(5);
    const suppressed = resolveTeamTurn({ ...createTeamBattleState({ player: [attacker],
      opponent: [pokemon("foe", "opponent")] }),
      effects: { sides: { player: { reflectTurns: 0, luckyChantTurns: 0 },
        opponent: { reflectTurns: 0, luckyChantTurns: 0 } }, waterSportTurns: 0,
      magicRoomTurns: 2 } }, use, random);
    expect(suppressed.events.filter((event) => event.type === "damageApplied"
      && event.source === "player")).toHaveLength(2);
  });

  it("skips Triple Kick's repeat accuracy checks only with Skill Link and active Loaded Dice", () => {
    const kick = { ...base, functionCode: "0BF" as const, power: 10, accuracy: 50 };
    const attacker = pokemon("user", "player", { ability: "SKILLLINK",
      heldItem: "LOADEDDICE", moves: [{ move: kick, pp: 20 }] });
    const target = pokemon("foe", "opponent");
    const missRepeat = (): RandomSource => {
      let accuracyRolls = 0;
      return { nextInt: (max) => max === 100 && accuracyRolls++ > 0 ? 99 : 0 };
    };
    const complete = resolveTeamTurn(createTeamBattleState({ player: [attacker],
      opponent: [target] }), use, missRepeat());
    expect(complete.events.filter((event) => event.type === "damageApplied"
      && event.source === "player")).toHaveLength(3);
    const noDice = resolveTeamTurn(createTeamBattleState({ player: [
      { ...attacker, heldItem: null }], opponent: [target] }), use, missRepeat());
    expect(noDice.events.filter((event) => event.type === "damageApplied"
      && event.source === "player")).toHaveLength(1);
  });

  it("charges Metronome on consecutive uses, caps it at five and resets on another move", () => {
    const other = { ...base, id: 2, internalName: "OTHER", power: 20 };
    const attacker = pokemon("user", "player", { heldItem: "METRONOME",
      moves: [{ move: base, pp: 20 }, { move: other, pp: 20 }] });
    let state = createTeamBattleState({ player: [attacker], opponent: [pokemon("foe", "opponent",
      { hp: 1000, stats: { ...pokemon("foe", "opponent").stats, maxHp: 2000 } })] });
    const amounts: number[] = [];
    for (let turn = 0; turn < 7; turn += 1) {
      const result = resolveTeamTurn(state, use, random);
      amounts.push(result.events.filter((event) => event.type === "damageApplied"
        && event.source === "player").reduce((sum, event) => sum + event.amount, 0));
      state = result.state;
    }
    expect(amounts[1]).toBeGreaterThan(amounts[0]!);
    expect(amounts[5]).toBeGreaterThan(amounts[4]!);
    expect(amounts[6]).toBe(amounts[5]);
    expect(state.teams.player.members[0]!.volatile?.metronomeCount).toBe(5);
    const reset = resolveTeamTurn(state, { ...use, player: { kind: "move", moveIndex: 1 } }, random);
    expect(reset.state.teams.player.members[0]!.volatile?.metronomeCount).toBe(0);
    const active = calculateDamage("player", pokemon("user", "player", { heldItem: "METRONOME",
      volatile: { ...attacker.volatile!, metronomeCount: 5 } }), pokemon("foe", "opponent"),
    base, random, []);
    const blocked = calculateDamage("player", pokemon("user", "player", { heldItem: "METRONOME",
      volatile: { ...attacker.volatile!, metronomeCount: 5 } }), pokemon("foe", "opponent"),
    base, random, [], { magicRoomTurns: 2 });
    expect(active).toBeGreaterThan(blocked);
  });

  it("applies Light Clay to the right side in Duo", () => {
    const screen = { ...base, functionCode: "0A2" as const, power: 0,
      category: "Status" as const };
    const attacker = pokemon("p1", "player", { heldItem: "LIGHTCLAY",
      moves: [{ move: screen, pp: 20 }] });
    const state = createDoubleTeamBattleState({ player: [attacker, pokemon("p2", "player")],
      opponent: [pokemon("o1", "opponent"), pokemon("o2", "opponent")] });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], random);
    expect(result.state.effects.sides.player.reflectTurns).toBe(7);
    expect(result.state.effects.sides.opponent.reflectTurns).toBe(0);
  });
});
