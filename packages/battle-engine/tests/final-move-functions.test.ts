import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide,
  type BattlerState, type RandomSource, type TeamBattleState } from "../src/index.js";

const rng: RandomSource = { nextInt: () => 0 };
const move = (functionCode: BattleMove["functionCode"], overrides: Partial<BattleMove> = {}): BattleMove => ({
  ...MINIMAL_MOVE_CATALOG.TACKLE, id: 9000, internalName: functionCode,
  name: functionCode, functionCode, power: 75, accuracy: 0, type: "NORMAL",
  flags: "bef", ...overrides });
function pokemon(id: string, side: BattleSide, selected: BattleMove,
  overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 400, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: side === "player" ? 110 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 400, majorStatus: null,
    ability: null, heldItem: null, moves: [{ move: selected, pp: 10 }], ...overrides };
}
const use = { player: { kind: "move" as const, moveIndex: 0 },
  opponent: { kind: "wait" as const } };
const wait = { player: { kind: "wait" as const }, opponent: { kind: "wait" as const } };
function state(selected: BattleMove, user?: Partial<BattlerState>, foe?: Partial<BattlerState>): TeamBattleState {
  return createTeamBattleState({ player: [pokemon("user", "player", selected, user)],
    opponent: [pokemon("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE, foe)] });
}

describe("remaining source move effects", () => {
  it("Metronome redraws forbidden numeric IDs from the complete catalog and calls a move", () => {
    const metronome = move("0B6", { id: 1, internalName: "METRONOME",
      power: 0, category: "Status", targetCode: "01" });
    const agility = move("030", { id: 2, internalName: "AGILITY",
      power: 0, category: "Status", targetCode: "10" });
    const initial = { ...state(metronome), moveCatalog: [metronome, agility] };
    const rolls = [0, 1];
    const result = resolveTeamTurn(initial, use, { nextInt: () => rolls.shift() ?? 0 });
    expect(result.state.teams.player.members[0]?.stages.speed).toBe(2);
    expect(result.state.teams.player.members[0]?.moves[0]?.pp).toBe(9);
    expect(result.state.moveCatalog).toHaveLength(2);
    expect(result.trace.filter((entry) => entry.type === "rng"
      && entry.purpose === "called-move").map((entry) => entry.value)).toEqual([0, 1]);
    const bubble = move("044", { id: 2, internalName: "BUBBLE", type: "WATER",
      category: "Special", targetCode: "04", power: 40 });
    const double = { ...createDoubleTeamBattleState({
      player: [pokemon("user", "player", metronome),
        pokemon("ally", "player", MINIMAL_MOVE_CATALOG.TACKLE)],
      opponent: [pokemon("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE),
        pokemon("other", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)] }),
    moveCatalog: [metronome, bubble] };
    const doubleRolls = [0, 1];
    const spread = resolveDoubleTeamTurn(double, [{ actor: { side: "player", slot: 0 },
      action: { kind: "move", moveIndex: 0 } },
    { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
    { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
    { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } }],
    { nextInt: () => doubleRolls.shift() ?? 0 });
    expect(spread.state.teams.opponent.members[0]?.hp).toBeLessThan(400);
    expect(spread.state.teams.opponent.members[1]?.hp).toBeLessThan(400);
  });

  it("keeps Metronome's two-turn called move through a restored battle state", () => {
    const metronome = move("0B6", { id: 1, internalName: "METRONOME",
      power: 0, category: "Status", targetCode: "01" });
    const solarBeam = move("0C4", { id: 2, internalName: "SOLARBEAM",
      type: "GRASS", category: "Special", power: 120 });
    const initial = { ...state(metronome), moveCatalog: [metronome, solarBeam] };
    const first = resolveTeamTurn(initial, use, { nextInt: () => 1 });
    expect(first.state.teams.player.members[0]?.volatile?.chargingCalledMove?.internalName)
      .toBe("SOLARBEAM");
    const second = resolveTeamTurn(JSON.parse(JSON.stringify(first.state)) as TeamBattleState,
      use, { nextInt: () => 0 });
    expect(second.state.teams.opponent.members[0]?.hp).toBeLessThan(400);
    expect(second.state.teams.player.members[0]?.moves[0]?.pp).toBe(9);
  });

  it("Substitute costs a quarter of HP, absorbs damage, then survives a snapshot", () => {
    const substitute = move("10C", { internalName: "SUBSTITUTE", power: 0,
      category: "Status", targetCode: "10" });
    const initial = state(substitute);
    const created = resolveTeamTurn(initial, use, rng);
    expect(created.state.teams.player.members[0]?.hp).toBe(300);
    expect(created.state.teams.player.members[0]?.volatile?.substituteHp).toBe(100);
    const restored = JSON.parse(JSON.stringify(created.state)) as TeamBattleState;
    const blocked = resolveTeamTurn(restored, { player: wait.player,
      opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(blocked.state.teams.player.members[0]?.hp).toBe(300);
    expect(blocked.state.teams.player.members[0]?.volatile?.substituteHp).toBeLessThan(100);
    expect(blocked.events.some((event) => event.type === "substituteChanged")).toBe(true);
  });

  it("Burn Up removes its current type, including on a miss, and then fails without it", () => {
    const burn = move("302", { internalName: "BURNUP", type: "FIRE", category: "Special" });
    const first = resolveTeamTurn(state(burn, { types: ["FIRE", "FLYING"] }), use, rng);
    expect(first.state.teams.player.members[0]?.types).toEqual(["FLYING"]);
    const second = resolveTeamTurn(first.state, use, rng);
    expect(second.events).toContainEqual({ type: "moveFailed", side: "player",
      move: "BURNUP", reason: "condition" });
    const miss = resolveTeamTurn(state({ ...burn, accuracy: 1 }, { types: ["FIRE"] }), use,
      { nextInt: () => 99 });
    expect(miss.state.teams.player.members[0]?.types).toEqual(["QMARKS"]);
  });

  it("Wizard's Curse changes the target to Fire but respects Multitype", () => {
    const curse = move("909", { internalName: "CONDENADEMAGO", type: "PSYCHIC",
      category: "Special" });
    const changed = resolveTeamTurn(state(curse), use, rng);
    expect(changed.state.teams.opponent.members[0]?.types).toEqual(["FIRE"]);
    const protectedTarget = resolveTeamTurn(state(curse, undefined,
      { ability: "MULTITYPE" }), use, rng);
    expect(protectedTarget.state.teams.opponent.members[0]?.types).toEqual(["NORMAL"]);
  });

  it("Rock strike multiplies damage by Grass effectiveness", () => {
    const strike = move("1000", { internalName: "PETROMAZAZO", type: "ROCK", power: 100 });
    const plain = resolveTeamTurn(state(strike, undefined, { types: ["NORMAL"] }), use, rng);
    const grassWeak = resolveTeamTurn(state(strike, undefined, { types: ["WATER"] }), use, rng);
    const plainDamage = 400 - plain.state.teams.opponent.members[0]!.hp;
    const weakDamage = 400 - grassWeak.state.teams.opponent.members[0]!.hp;
    expect(weakDamage).toBeGreaterThan(plainDamage);
  });

  it("Eclipse uses the stronger offensive category and swaps the precomputed form stats", () => {
    const eclipse = move("1001", { internalName: "ECLIPSE", type: "ROCK",
      category: "Special", power: 90 });
    const original = { maxHp: 400, attack: 180, defense: 150,
      specialAttack: 90, specialDefense: 100, speed: 80 };
    const alternate = { maxHp: 400, attack: 100, defense: 110,
      specialAttack: 170, specialDefense: 160, speed: 80 };
    const initial = state(eclipse, { species: "CONSTELLAR", stats: original,
      moveFormStats: { 0: original, 1: alternate } });
    const first = resolveTeamTurn(initial, use, rng);
    expect(first.state.teams.player.members[0]?.appearance?.form).toBe(1);
    expect(first.state.teams.player.members[0]?.stats).toEqual(alternate);
    const second = resolveTeamTurn(JSON.parse(JSON.stringify(first.state)) as TeamBattleState, use, rng);
    expect(second.state.teams.player.members[0]?.appearance?.form).toBe(0);
    expect(second.state.teams.player.members[0]?.stats).toEqual(original);
  });

  it("Broken Heart needs low HP and respects the target level in solo and double", () => {
    const heart = move("1002", { internalName: "CORAZONROTO", type: "FAIRY",
      power: 1, accuracy: 100 });
    const healthy = resolveTeamTurn(state(heart), use, rng);
    expect(healthy.state.teams.opponent.members[0]?.hp).toBe(400);
    const low = state(heart, { hp: 100 });
    const struck = resolveTeamTurn(low, use, rng);
    expect(struck.state.teams.opponent.members[0]?.hp).toBe(0);
    const sturdy = resolveTeamTurn(state(heart, { hp: 100 }, { ability: "STURDY" }), use, rng);
    expect(sturdy.state.teams.opponent.members[0]?.hp).toBe(400);
    const bypass = resolveTeamTurn(state(heart, { hp: 100, ability: "MOLDBREAKER" },
      { ability: "STURDY" }), use, rng);
    expect(bypass.state.teams.opponent.members[0]?.hp).toBe(0);
    const double = createDoubleTeamBattleState({
      player: [pokemon("user", "player", heart, { hp: 100 }),
        pokemon("ally", "player", MINIMAL_MOVE_CATALOG.TACKLE)],
      opponent: [pokemon("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE),
        pokemon("other", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const result = resolveDoubleTeamTurn(double, [{ actor: { side: "player", slot: 0 },
      action: { kind: "move", moveIndex: 0, target: { side: "opponent", slot: 0 } } },
    { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
    { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
    { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } }], rng);
    expect(result.state.teams.opponent.members[0]?.hp).toBe(0);
  });
});
