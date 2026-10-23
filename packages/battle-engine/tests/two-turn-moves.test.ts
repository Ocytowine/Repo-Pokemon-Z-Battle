import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove,
  type BattleSide, type BattlerState, type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: (max) => max - 1 };
const move = (code: BattleMove["functionCode"], power = 40): BattleMove => ({
  ...MINIMAL_MOVE_CATALOG.TACKLE, functionCode: code, internalName: code, power,
  category: "Physical", accuracy: 0, effectChance: 30,
});
function pokemon(id: string, side: BattleSide, code: BattleMove["functionCode"] = "000",
  overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 300, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 100 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 300, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: move(code), pp: 10 }], ...overrides };
}
const playerMove = { player: { kind: "move" as const, moveIndex: 0 },
  opponent: { kind: "wait" as const } };

describe("two-turn charge and recharge moves", () => {
  it.each(["0C3", "0C4", "0C5", "0C6", "0C7", "0C8"] as const)(
    "%s charges first, locks its second turn, and pays PP once", (code) => {
      const base = pokemon("user", "player", code);
      const attacker = { ...base, moves: [{ ...base.moves[0]!, pp: 1 },
        { move: move("000"), pp: 10 }] };
      const state = createTeamBattleState({ player: [attacker],
        opponent: [pokemon("target", "opponent")] });
      const first = resolveTeamTurn(state, playerMove, rng);
      expect(first.state.teams.opponent.members[0]?.hp).toBe(300);
      expect(first.state.teams.player.members[0]?.volatile?.chargingMove).toBe(code);
      expect(first.state.teams.player.members[0]?.moves[0]?.pp).toBe(0);
      const second = resolveTeamTurn(first.state, { ...playerMove,
        player: { kind: "move", moveIndex: 1 } }, rng);
      expect(second.events).toContainEqual({ type: "moveUsed", side: "player", move: code });
      expect(second.state.teams.opponent.members[0]?.hp).toBeLessThan(300);
      expect(second.state.teams.player.members[0]?.volatile?.chargingMove).toBeNull();
      expect(second.state.teams.player.members[0]?.moves[0]?.pp).toBe(0);
      expect(second.state.teams.player.members[0]?.moves[1]?.pp).toBe(10);
      if (code === "0C8") expect(second.state.teams.player.members[0]?.stages.defense).toBe(1);
    });

  it("Power Herb consumes once and makes a charge move immediate", () => {
    const state = createTeamBattleState({ player: [pokemon("user", "player", "0C3", { heldItem: "POWERHERB" })],
      opponent: [pokemon("target", "opponent")] });
    const turn = resolveTeamTurn(state, playerMove, rng);
    expect(turn.state.teams.opponent.members[0]?.hp).toBeLessThan(300);
    expect(turn.state.teams.player.members[0]?.heldItem).toBeNull();
    expect(turn.state.teams.player.members[0]?.volatile?.chargingMove).toBeNull();
  });

  it("Solar Beam attacks immediately in sun without consuming Power Herb", () => {
    const base = createTeamBattleState({ player: [pokemon("user", "player", "0C4",
      { heldItem: "POWERHERB" })], opponent: [pokemon("target", "opponent")] });
    const state = { ...base, effects: { sides: {
      player: { reflectTurns: 0, luckyChantTurns: 0 },
      opponent: { reflectTurns: 0, luckyChantTurns: 0 } },
    waterSportTurns: 0, weather: "sun" as const } };
    const turn = resolveTeamTurn(state, playerMove, rng);
    expect(turn.state.teams.opponent.members[0]?.hp).toBeLessThan(300);
    expect(turn.state.teams.player.members[0]?.heldItem).toBe("POWERHERB");
  });

  it("Hyper Beam imposes one recharge turn only after damage", () => {
    const state = createTeamBattleState({ player: [pokemon("user", "player", "0C2")],
      opponent: [pokemon("target", "opponent")] });
    const first = resolveTeamTurn(state, playerMove, rng);
    expect(first.state.teams.player.members[0]?.volatile?.rechargeTurns).toBe(1);
    const second = resolveTeamTurn(first.state, playerMove, rng);
    expect(second.events).toContainEqual({ type: "actionSkipped", side: "player", reason: "recharge" });
    expect(second.state.teams.player.members[0]?.moves[0]?.pp).toBe(9);
    expect(second.state.teams.player.members[0]?.volatile?.rechargeTurns).toBe(0);
  });

  it("does not impose recharge when Hyper Beam has no effect", () => {
    const state = createTeamBattleState({ player: [pokemon("user", "player", "0C2")],
      opponent: [pokemon("ghost", "opponent", "000", { types: ["GHOST"] })] });
    const turn = resolveTeamTurn(state, playerMove, rng);
    expect(turn.state.teams.opponent.members[0]?.hp).toBe(300);
    expect(turn.state.teams.player.members[0]?.volatile?.rechargeTurns).toBe(0);
  });

  it("does not permit a switch to bypass a charge or recharge turn", () => {
    for (const code of ["0C2", "0C3"] as const) {
      const base = createTeamBattleState({ player: [pokemon("user", "player", code),
        pokemon("reserve", "player")], opponent: [pokemon("target", "opponent")] });
      const first = resolveTeamTurn(base, playerMove, rng);
      const second = resolveTeamTurn(first.state, { player: { kind: "switch", teamIndex: 1 },
        opponent: { kind: "wait" } }, rng);
      expect(second.state.teams.player.activeIndex).toBe(0);
      expect(second.state.teams.player.members[0]?.volatile?.chargingMove).toBeNull();
      expect(second.state.teams.player.members[0]?.volatile?.rechargeTurns).toBe(0);
    }
  });

  it("persists a charge through a Coop double-battle snapshot and attacks the same target", () => {
    const user = pokemon("user", "player", "0C3");
    const state = createDoubleTeamBattleState({ player: [{ ...user,
      moves: [{ ...user.moves[0]!, pp: 1 }] },
      pokemon("ally", "player")], opponent: [pokemon("first", "opponent"),
      pokemon("second", "opponent")] });
    const actions = [
      { actor: { side: "player" as const, slot: 0 }, action: { kind: "move" as const, moveIndex: 0,
        target: { side: "opponent" as const, slot: 1 } } },
      { actor: { side: "player" as const, slot: 1 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 0 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 1 }, action: { kind: "wait" as const } },
    ];
    const first = resolveDoubleTeamTurn(state, actions, rng);
    expect(first.state.teams.player.members[0]?.volatile?.chargingMove).toBe("0C3");
    expect(first.state.teams.opponent.members[1]?.hp).toBe(300);
    const restored = JSON.parse(JSON.stringify(first.state)) as typeof first.state;
    const second = resolveDoubleTeamTurn(restored, actions, rng);
    expect(second.state.teams.opponent.members[1]?.hp).toBeLessThan(300);
    expect(second.state.teams.player.members[0]?.volatile?.chargingMove).toBeNull();
    expect(second.state.teams.player.members[0]?.moves[0]?.pp).toBe(0);
  });
});
