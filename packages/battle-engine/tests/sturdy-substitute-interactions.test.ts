import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createTeamBattleState, replaceFaintedPokemon, resolveTeamTurn,
  type BattleMove, type BattlerState, type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: () => 0 };
const move = (code: BattleMove["functionCode"], changes: Partial<BattleMove> = {}): BattleMove => ({
  ...MINIMAL_MOVE_CATALOG.TACKLE, id: 9001, internalName: code, name: code,
  functionCode: code, power: 0, accuracy: 0, category: "Status", type: "NORMAL",
  flags: "be", ...changes });
function pokemon(id: string, selected: BattleMove, changes: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 200, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: id === "user" ? 110 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 200, majorStatus: null,
    ability: null, heldItem: null, moves: [{ move: selected, pp: 10 }], ...changes };
}
const use = { player: { kind: "move" as const, moveIndex: 0 },
  opponent: { kind: "wait" as const } };
const enemyUses = { player: { kind: "wait" as const },
  opponent: { kind: "move" as const, moveIndex: 0 } };

describe("Sturdy and Substitute source interactions", () => {
  it("Sturdy wins over Focus Sash at full HP and loses to Mold Breaker or Neutralizing Gas", () => {
    const lethal = move("000", { power: 500, category: "Physical" });
    const battle = (attacker: Partial<BattlerState> = {}) => createTeamBattleState({
      player: [pokemon("user", lethal, attacker)],
      opponent: [pokemon("foe", MINIMAL_MOVE_CATALOG.TACKLE,
        { ability: "STURDY", heldItem: "FOCUSSASH" })] });
    const sturdy = resolveTeamTurn(battle(), use, rng);
    const target = sturdy.state.teams.opponent.members[0]!;
    expect(target.hp).toBe(1);
    expect(target.heldItem).toBe("FOCUSSASH");
    expect(sturdy.events).toContainEqual(expect.objectContaining({ type: "abilityActivated",
      ability: "STURDY", effect: "survive" }));
    expect(sturdy.events.some((event) => event.type === "heldItemConsumed"
      && event.item === "FOCUSSASH")).toBe(false);
    const breaker = resolveTeamTurn(battle({ ability: "MOLDBREAKER" }), use, rng);
    expect(breaker.state.teams.opponent.members[0]?.hp).toBe(1);
    expect(breaker.state.teams.opponent.members[0]?.heldItem).toBeNull();
    const gas = resolveTeamTurn(battle({ ability: "NEUTRALIZINGGAS" }), use, rng);
    expect(gas.state.teams.opponent.members[0]?.heldItem).toBeNull();
    expect(gas.events.some((event) => event.type === "abilityActivated"
      && event.ability === "STURDY")).toBe(false);
  });

  it("OHKO immunity works below full HP, but Mold Breaker bypasses it", () => {
    const ohko = move("070", { category: "Physical", power: 1, accuracy: 100 });
    const battle = (ability: BattlerState["ability"]) => createTeamBattleState({
      player: [pokemon("user", ohko, { ability })],
      opponent: [pokemon("foe", MINIMAL_MOVE_CATALOG.TACKLE,
        { ability: "STURDY", hp: 75 })] });
    const blocked = resolveTeamTurn(battle(null), use, rng);
    expect(blocked.state.teams.opponent.members[0]?.hp).toBe(75);
    expect(blocked.events).toContainEqual(expect.objectContaining({ type: "abilityActivated",
      ability: "STURDY", effect: "block-move" }));
    const bypassed = resolveTeamTurn(battle("MOLDBREAKER"), use, rng);
    expect(bypassed.state.teams.opponent.members[0]?.hp).toBe(0);
  });

  it("a two-hit attack breaks Substitute before striking HP", () => {
    const doubleHit = move("0BD", { category: "Physical", power: 100 });
    const battle = createTeamBattleState({ player: [pokemon("user", doubleHit)],
      opponent: [pokemon("foe", MINIMAL_MOVE_CATALOG.TACKLE, { volatile: {
        confusionTurns: 0, flinched: false, focusEnergy: 0, identified: false,
        disabledMove: null, disableTurns: 0, encoreMove: null, encoreTurns: 0,
        bindingMove: null, bindingTurns: 0, cursed: false, lastMoveUsed: null,
        substituteHp: 1 } })] });
    const result = resolveTeamTurn(battle, use, rng);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "substituteChanged",
      side: "opponent", hp: 0 }));
    expect(result.state.teams.opponent.members[0]?.hp).toBeLessThan(200);
  });

  it("blocks direct status while allowing sound and Infiltrator through Substitute", () => {
    const sleep = move("003", { internalName: "HYPNOSIS", type: "PSYCHIC" });
    const sound = move("013", { internalName: "SUPERSONIC", flags: "bcek" });
    const defender = pokemon("foe", MINIMAL_MOVE_CATALOG.TACKLE, { volatile: {
      confusionTurns: 0, flinched: false, focusEnergy: 0, identified: false,
      disabledMove: null, disableTurns: 0, encoreMove: null, encoreTurns: 0,
      bindingMove: null, bindingTurns: 0, cursed: false, lastMoveUsed: null,
      substituteHp: 40 } });
    const battle = (selected: BattleMove, ability: BattlerState["ability"] = null) =>
      createTeamBattleState({ player: [pokemon("user", selected, { ability })], opponent: [defender] });
    const blocked = resolveTeamTurn(battle(sleep), use, rng);
    expect(blocked.state.teams.opponent.members[0]?.majorStatus).toBeNull();
    expect(blocked.state.teams.opponent.members[0]?.volatile?.substituteHp).toBe(40);
    const bypassed = resolveTeamTurn(battle(sleep, "INFILTRATOR"), use, rng);
    expect(bypassed.state.teams.opponent.members[0]?.majorStatus?.kind).toBe("sleep");
    const sounded = resolveTeamTurn(battle(sound), use, rng);
    expect(sounded.state.teams.opponent.members[0]?.volatile?.confusionTurns).toBeGreaterThan(0);
  });

  it("Baton Pass carries the shield to a reserve after a snapshot restore", () => {
    const baton = move("0ED", { internalName: "BATONPASS", targetCode: "10" });
    const base = createTeamBattleState({ player: [pokemon("user", baton, { volatile: {
      confusionTurns: 0, flinched: false, focusEnergy: 0, identified: false,
      disabledMove: null, disableTurns: 0, encoreMove: null, encoreTurns: 0,
      bindingMove: null, bindingTurns: 0, cursed: false, lastMoveUsed: null,
      substituteHp: 30 } }), pokemon("reserve", MINIMAL_MOVE_CATALOG.TACKLE)],
    opponent: [pokemon("foe", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const pivot = resolveTeamTurn(base, use, rng);
    expect(pivot.state.pivotRequired).toContain("player");
    const snapshot = JSON.parse(JSON.stringify(pivot.state)) as typeof pivot.state;
    const switched = replaceFaintedPokemon(snapshot, { player: 1 }, rng);
    expect(switched.state.teams.player.members[1]?.volatile?.substituteHp).toBe(30);
  });
});
