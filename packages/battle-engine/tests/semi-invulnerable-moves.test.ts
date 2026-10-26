import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide,
  type BattlerState, type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: (max) => max - 1 };
function pokemon(id: string, side: BattleSide, code: BattleMove["functionCode"] = "000",
  overrides: Partial<BattlerState> = {}): BattlerState {
  const move: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: code,
    functionCode: code, power: 60, accuracy: 0, effectChance: 0 };
  return { id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 400, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 100 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 400, majorStatus: null, ability: null, heldItem: null, baseAttack: 80,
    capture: { rate: 45, baseSpeed: 80, weight: 1000 },
    moves: [{ move, pp: 10 }], ...overrides };
}
const action = { player: { kind: "move" as const, moveIndex: 0 },
  opponent: { kind: "move" as const, moveIndex: 0 } };

describe("semi-invulnerable two-turn moves", () => {
  it.each(["0C9", "0CA", "0CB", "0CC", "0CD", "14D"] as const)(
    "%s charges, avoids ordinary attacks, then strikes for one PP", (code) => {
      const first = resolveTeamTurn(createTeamBattleState({ player: [pokemon("user", "player", code)],
        opponent: [pokemon("target", "opponent")] }), action, rng);
      expect(first.state.teams.player.members[0]?.hp).toBe(400);
      expect(first.state.teams.player.members[0]?.volatile?.chargingMove).toBe(code);
      expect(first.events).toContainEqual(expect.objectContaining({ type: "moveMissed", side: "opponent" }));
      const restored = JSON.parse(JSON.stringify(first.state)) as typeof first.state;
      const second = resolveTeamTurn(restored, { player: action.player,
        opponent: { kind: "wait" } }, rng);
      expect(second.state.teams.opponent.members[0]?.hp).toBeLessThan(400);
      expect(second.state.teams.player.members[0]?.moves[0]?.pp).toBe(9);
      expect(second.state.teams.player.members[0]?.volatile?.chargingMove).toBeNull();
    });

  it("Surf and Whirlpool can hit a diving target; Whirlpool doubles its power", () => {
    const dive = pokemon("diver", "player", "0CB");
    const ordinary = pokemon("ordinary", "opponent", "0D0");
    const diving = resolveTeamTurn(createTeamBattleState({ player: [dive], opponent: [ordinary] }),
      action, rng);
    expect(diving.state.teams.player.members[0]?.hp).toBeLessThan(400);
    const direct = resolveTeamTurn(createTeamBattleState({ player: [pokemon("plain", "player")],
      opponent: [ordinary] }), { player: { kind: "wait" }, opponent: action.opponent }, rng);
    expect(400 - diving.state.teams.player.members[0]!.hp)
      .toBeGreaterThan(400 - direct.state.teams.player.members[0]!.hp);
  });

  it("Gust reaches a flying target and gains double power", () => {
    const gust = pokemon("gust", "opponent", "077");
    const flying = resolveTeamTurn(createTeamBattleState({ player: [pokemon("flyer", "player", "0C9")],
      opponent: [gust] }), action, rng);
    expect(flying.state.teams.player.members[0]?.hp).toBeLessThan(400);
    const grounded = resolveTeamTurn(createTeamBattleState({ player: [pokemon("plain", "player")],
      opponent: [gust] }), { player: { kind: "wait" }, opponent: action.opponent }, rng);
    expect(400 - flying.state.teams.player.members[0]!.hp)
      .toBeGreaterThan(400 - grounded.state.teams.player.members[0]!.hp);
  });

  it.each(["0CD", "14D"] as const)("%s bypasses an active Protect barrier", (code) => {
    const protectedTarget = pokemon("target", "opponent", "000", {
      volatile: { confusionTurns: 0, flinched: false, focusEnergy: 0, identified: false,
        disabledMove: null, disableTurns: 0, encoreMove: null, encoreTurns: 0,
        bindingMove: null, bindingTurns: 0, cursed: false, lastMoveUsed: null, protected: true } });
    const state = createTeamBattleState({ player: [pokemon("user", "player", code)],
      opponent: [protectedTarget] });
    const charging = resolveTeamTurn(state, { player: action.player, opponent: { kind: "wait" } }, rng);
    const second = { ...charging.state, teams: { ...charging.state.teams,
      opponent: { ...charging.state.teams.opponent,
        members: [{ ...charging.state.teams.opponent.members[0]!,
          volatile: { ...charging.state.teams.opponent.members[0]!.volatile!, protected: true } }] } } };
    const landed = resolveTeamTurn(second, { player: action.player,
      opponent: { kind: "wait" } }, rng);
    expect(landed.state.teams.opponent.members[0]?.hp).toBeLessThan(400);
    expect(landed.state.teams.opponent.members[0]?.volatile?.protected).toBe(false);
  });

  it("Phantom Force doubles damage and has perfect accuracy against Minimize", () => {
    const ghost = pokemon("user", "player", "14D", { heldItem: "POWERHERB",
      moves: [{ move: { ...pokemon("user", "player", "14D").moves[0]!.move,
        accuracy: 1 }, pp: 10 }] });
    const target = pokemon("target", "opponent");
    const run = (minimized: boolean) => resolveTeamTurn(createTeamBattleState({
      player: [ghost], opponent: [{ ...target, volatile: {
        ...target.volatile!, minimized } }] }),
    { player: action.player, opponent: { kind: "wait" } }, rng);
    const regular = run(false);
    const small = run(true);
    expect(regular.state.teams.opponent.members[0]!.hp).toBe(400);
    expect(small.state.teams.opponent.members[0]!.hp).toBeLessThan(400);
    expect(small.state.teams.player.members[0]!.heldItem).toBeNull();
  });

  it("Gravity prevents airborne charges and cancels an existing Sky Drop", () => {
    const base = createTeamBattleState({ player: [pokemon("flyer", "player", "0C9")],
      opponent: [pokemon("target", "opponent")] });
    const gravity = { sides: { player: { reflectTurns: 0, luckyChantTurns: 0 },
      opponent: { reflectTurns: 0, luckyChantTurns: 0 } }, waterSportTurns: 0,
    gravityTurns: 2 };
    const failed = resolveTeamTurn({ ...base, effects: gravity },
      { player: action.player, opponent: { kind: "wait" } }, rng);
    expect(failed.state.teams.player.members[0]?.moves[0]?.pp).toBe(10);
    expect(failed.state.teams.player.members[0]?.volatile?.chargingMove).toBeNull();
    const lifted = resolveTeamTurn(createTeamBattleState({ player: [pokemon("carrier", "player", "0CE")],
      opponent: [pokemon("target", "opponent")] }),
    { player: action.player, opponent: { kind: "wait" } }, rng);
    const cancelled = resolveTeamTurn({ ...lifted.state, effects: gravity },
      { player: action.player, opponent: { kind: "wait" } }, rng);
    expect(cancelled.state.teams.opponent.members[0]?.volatile?.skyDropCarrierId).toBeNull();
    expect(cancelled.state.teams.player.members[0]?.volatile?.chargingMove).toBeNull();
  });

  it("Sky Drop carries and immobilizes its target, then frees it after landing", () => {
    const first = resolveTeamTurn(createTeamBattleState({ player: [pokemon("carrier", "player", "0CE")],
      opponent: [pokemon("target", "opponent")] }), action, rng);
    expect(first.state.teams.player.members[0]?.volatile?.chargingTargetId).toBe("target");
    expect(first.state.teams.opponent.members[0]?.volatile?.skyDropCarrierId).toBe("carrier");
    expect(first.state.teams.opponent.members[0]?.hp).toBe(400);
    const second = resolveTeamTurn(JSON.parse(JSON.stringify(first.state)) as typeof first.state,
      action, rng);
    expect(second.state.teams.opponent.members[0]?.hp).toBeLessThan(400);
    expect(second.state.teams.opponent.members[0]?.volatile?.skyDropCarrierId).toBeNull();
    expect(second.state.teams.player.members[0]?.moves[0]?.pp).toBe(9);
    expect(second.events).toContainEqual({ type: "actionSkipped", side: "opponent", reason: "sky-drop" });
  });

  it("Sky Drop rejects heavy targets and releases Flying targets without damage", () => {
    const heavy = pokemon("heavy", "opponent", "000", { capture: {
      rate: 45, baseSpeed: 80, weight: 2000 } });
    const failed = resolveTeamTurn(createTeamBattleState({ player: [pokemon("carrier", "player", "0CE")],
      opponent: [heavy] }), { player: action.player, opponent: { kind: "wait" } }, rng);
    expect(failed.state.teams.player.members[0]?.volatile?.chargingMove).toBeNull();
    const flying = pokemon("bird", "opponent", "000", { types: ["FLYING"] });
    const first = resolveTeamTurn(createTeamBattleState({ player: [pokemon("carrier", "player", "0CE")],
      opponent: [flying] }), { player: action.player, opponent: { kind: "wait" } }, rng);
    const second = resolveTeamTurn(first.state, { player: action.player,
      opponent: { kind: "wait" } }, rng);
    expect(second.state.teams.opponent.members[0]?.hp).toBe(400);
    expect(second.state.teams.opponent.members[0]?.volatile?.skyDropCarrierId).toBeNull();
  });

  it("keeps Sky Drop's target identity across double-battle restoration", () => {
    const state = createDoubleTeamBattleState({ player: [pokemon("carrier", "player", "0CE"),
      pokemon("ally", "player")], opponent: [pokemon("first", "opponent"),
      pokemon("second", "opponent")] });
    const actions = [
      { actor: { side: "player" as const, slot: 0 }, action: { kind: "move" as const,
        moveIndex: 0, target: { side: "opponent" as const, slot: 1 } } },
      { actor: { side: "player" as const, slot: 1 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 0 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 1 }, action: { kind: "move" as const, moveIndex: 0 } },
    ];
    const first = resolveDoubleTeamTurn(state, actions, rng);
    expect(first.state.teams.opponent.members[1]?.volatile?.skyDropCarrierId).toBe("carrier");
    const restored = JSON.parse(JSON.stringify(first.state)) as typeof first.state;
    const second = resolveDoubleTeamTurn(restored, actions, rng);
    expect(second.state.teams.opponent.members[1]?.hp).toBeLessThan(400);
    expect(second.state.teams.opponent.members[0]?.hp).toBe(400);
    expect(second.state.teams.opponent.members[1]?.volatile?.skyDropCarrierId).toBeNull();
  });
});
