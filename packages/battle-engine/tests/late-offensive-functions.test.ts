import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide,
  type BattlerState, type RandomSource, type TeamBattleState } from "../src/index.js";

const rng: RandomSource = { nextInt: (maximum) => maximum - 1 };
const move = (code: BattleMove["functionCode"], overrides: Partial<BattleMove> = {}): BattleMove => ({
  ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: code, functionCode: code,
  power: 70, accuracy: 0, effectChance: 0, type: "NORMAL", flags: "bef", ...overrides });
function pokemon(id: string, side: BattleSide, selected: BattleMove,
  overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 400, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: side === "player" ? 100 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 400, majorStatus: null,
    ability: null, heldItem: null, moves: [{ move: selected, pp: 10 }], ...overrides };
}
const use = { player: { kind: "move" as const, moveIndex: 0 },
  opponent: { kind: "wait" as const } };
const wait = { player: { kind: "wait" as const }, opponent: { kind: "wait" as const } };
function state(selected: BattleMove, foe?: Partial<BattlerState>, reserve = false): TeamBattleState {
  return createTeamBattleState({ player: [pokemon("user", "player", selected),
    ...(reserve ? [pokemon("reserve", "player", MINIMAL_MOVE_CATALOG.TACKLE)] : [])],
  opponent: [pokemon("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE, foe)] });
}

describe("late offensive move functions", () => {
  it("Nightmare damages a sleeping target, survives a snapshot, and ends on waking", () => {
    const nightmare = move("10F", { type: "GHOST", power: 0, category: "Status" });
    const base = state(nightmare, { majorStatus: { kind: "sleep", turnsRemaining: 2 } });
    const first = resolveTeamTurn(base, use, rng);
    expect(first.state.teams.opponent.members[0]?.volatile?.nightmare).toBe(true);
    expect(first.events).toContainEqual({ type: "nightmareDamage", side: "opponent", amount: 100, hp: 300 });
    const restored = JSON.parse(JSON.stringify(first.state)) as TeamBattleState;
    const attempt = { player: wait.player, opponent: { kind: "move" as const, moveIndex: 0 } };
    const second = resolveTeamTurn(restored, attempt, rng);
    expect(second.state.teams.opponent.members[0]?.hp).toBe(200);
    const third = resolveTeamTurn(second.state, attempt, rng);
    expect(third.state.teams.opponent.members[0]?.volatile?.nightmare).toBe(false);
    expect(third.state.teams.opponent.members[0]?.hp).toBe(200);
  });

  it("Fell Stinger grants +2 Attack only on a damaging knockout", () => {
    const sting = move("150", { type: "BUG", power: 50, effectChance: 100 });
    const fainted = resolveTeamTurn(state(sting, { hp: 1 }), use, rng);
    const survived = resolveTeamTurn(state(sting), use, rng);
    expect(fainted.state.teams.player.members[0]?.stages.attack).toBe(2);
    expect(survived.state.teams.player.members[0]?.stages.attack).toBe(0);
  });

  it("Parting Shot lowers both offensive stages and requests its owner's replacement", () => {
    const shot = move("151", { type: "DARK", power: 0, category: "Status", flags: "bcefk" });
    const result = resolveTeamTurn(state(shot, undefined, true), use, rng);
    expect(result.state.teams.opponent.members[0]?.stages).toMatchObject({ attack: -1, specialAttack: -1 });
    expect(result.state.pivotRequired).toContain("player");
    const soundproof = resolveTeamTurn(state(shot, { ability: "SOUNDPROOF" }, true), use, rng);
    expect(soundproof.state.teams.opponent.members[0]?.stages.attack).toBe(0);
    expect(soundproof.state.pivotRequired).toContain("player");
  });

  it("First Impression works only on the user's first active turn", () => {
    const firstImpression = move("15A", { type: "BUG", priority: 2, power: 90 });
    const initial = state(firstImpression);
    const first = resolveTeamTurn(initial, use, rng);
    const second = resolveTeamTurn(first.state, use, rng);
    expect(first.state.teams.opponent.members[0]!.hp).toBeLessThan(400);
    expect(second.events).toContainEqual({ type: "moveFailed", side: "player",
      move: "15A", reason: "condition" });
    expect(second.state.teams.opponent.members[0]!.hp).toBe(first.state.teams.opponent.members[0]!.hp);
    const switchedIn = createTeamBattleState({ player: [
      pokemon("starter", "player", MINIMAL_MOVE_CATALOG.TACKLE),
      pokemon("newcomer", "player", firstImpression)],
    opponent: [pokemon("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const entered = resolveTeamTurn(switchedIn, { player: { kind: "switch", teamIndex: 1 },
      opponent: wait.opponent }, rng);
    const onFirstAction = resolveTeamTurn(entered.state, use, rng);
    expect(onFirstAction.state.teams.opponent.members[0]!.hp).toBeLessThan(400);
  });

  it("CargaGresion shares Charge's next-turn power and Special Defense boost", () => {
    const charge = move("262", { type: "ELECTRIC", category: "Special", power: 60, effectChance: 100 });
    const first = resolveTeamTurn(state(charge), use, rng);
    expect(first.state.teams.player.members[0]?.stages.specialDefense).toBe(1);
    expect(first.state.teams.player.members[0]?.volatile?.chargeTurns).toBe(1);
    const second = resolveTeamTurn(first.state, use, rng);
    expect(second.state.teams.opponent.members[0]!.hp)
      .toBeLessThan(first.state.teams.opponent.members[0]!.hp);
  });

  it.each([["300", "GRASS"], ["305", "GRASS"]] as const)(
    "%s uses the ordinary damaging move path", (code, type) => {
      const result = resolveTeamTurn(state(move(code, { type, power: 80 })), use, rng);
      expect(result.state.teams.opponent.members[0]?.hp).toBeLessThan(400);
    });

  it("Ceaseless Edge adds Spikes layers, capped at three", () => {
    const edge = move("907", { type: "DARK", power: 65 });
    let current = state(edge);
    for (let layer = 1; layer <= 4; layer += 1) {
      const result = resolveTeamTurn(current, use, rng);
      expect(result.state.effects?.sides.opponent.spikesLayers).toBe(Math.min(3, layer));
      current = result.state;
    }
  });

  it("Mortal Spin poisons each double target and clears only its user's hazards", () => {
    const spin = move("912", { type: "POISON", power: 30, effectChance: 100, targetCode: "04" });
    const initial = createDoubleTeamBattleState({ player: [pokemon("user", "player", spin),
      pokemon("ally", "player", MINIMAL_MOVE_CATALOG.TACKLE)], opponent: [
      pokemon("foe1", "opponent", MINIMAL_MOVE_CATALOG.TACKLE),
      pokemon("foe2", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const effects = { sides: { player: { reflectTurns: 0, luckyChantTurns: 0,
      spikesLayers: 2, toxicSpikesLayers: 1, stealthRock: true, stickyWeb: true },
    opponent: { reflectTurns: 0, luckyChantTurns: 0, spikesLayers: 1 } }, waterSportTurns: 0 };
    const result = resolveDoubleTeamTurn({ ...initial, effects }, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.opponent.members.map((member) => member.majorStatus?.kind))
      .toEqual(["poison", "poison"]);
    expect(result.state.effects?.sides.player).toMatchObject({ spikesLayers: 0,
      toxicSpikesLayers: 0, stealthRock: false, stickyWeb: false });
    expect(result.state.effects?.sides.opponent.spikesLayers).toBe(1);
    const lastHit = resolveTeamTurn({ ...state(spin, { hp: 1 }), effects }, use, rng);
    expect(lastHit.state.teams.opponent.members[0]?.hp).toBe(0);
    expect(lastHit.state.effects?.sides.player.spikesLayers).toBe(0);
  });

  it("Tearful Look never misses and lowers Attack and Special Attack", () => {
    const tearful = move("CF14", { power: 0, category: "Status", accuracy: 0 });
    const result = resolveTeamTurn(state(tearful), use, rng);
    expect(result.state.teams.opponent.members[0]?.stages).toMatchObject({ attack: -1,
      specialAttack: -1 });
  });
});
