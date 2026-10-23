import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  replaceFaintedPokemon, resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide, type BattlerState,
  type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: (max) => max - 1 };
function pokemon(id: string, side: BattleSide, moveCode = "000", overrides: Partial<BattlerState> = {}): BattlerState {
  const move: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: moveCode,
    functionCode: moveCode as BattleMove["functionCode"], accuracy: 0,
    category: ["0D6", "0D7", "0D9", "0DA", "0DB", "0DF", "0E2", "0E3", "0E4", "0E5", "0E6", "0E7", "0EA", "0EB", "0ED", "0EF"].includes(moveCode)
      ? "Status" : "Physical", power: moveCode === "0E1" ? 1 : 40 };
  return { id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 100 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 100, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move, pp: 10 }], ...overrides };
}
const action = { player: { kind: "move" as const, moveIndex: 0 },
  opponent: { kind: "wait" as const } };

describe("sacrifice, survival and replacement moves", () => {
  it("deals current HP with Final Gambit and sacrifices its user", () => {
    const state = createTeamBattleState({ player: [pokemon("user", "player", "0E1", { hp: 37 }),
      pokemon("reserve", "player")], opponent: [pokemon("target", "opponent")] });
    const result = resolveTeamTurn(state, action, rng);
    expect(result.state.teams.player.members[0]?.hp).toBe(0);
    expect(result.state.teams.opponent.members[0]?.hp).toBe(63);
    expect(result.state.replacementRequired).toContain("player");
  });

  it("fails Final Gambit against a Ghost without sacrificing its user", () => {
    const state = createTeamBattleState({ player: [pokemon("user", "player", "0E1")],
      opponent: [pokemon("ghost", "opponent", "000", { types: ["GHOST"] })] });
    const result = resolveTeamTurn(state, action, rng);
    expect(result.state.teams.player.members[0]?.hp).toBe(100);
    expect(result.state.teams.opponent.members[0]?.hp).toBe(100);
  });

  it("never knocks out with False Swipe", () => {
    const state = createTeamBattleState({ player: [pokemon("user", "player", "0E9")],
      opponent: [pokemon("target", "opponent", "000", { hp: 1 })] });
    expect(resolveTeamTurn(state, action, rng).state.teams.opponent.members[0]?.hp).toBe(1);
  });

  it("heals the incoming battler and restores PP with Lunar Dance", () => {
    const injured = pokemon("reserve", "player", "000", { hp: 11,
      majorStatus: { kind: "burn" }, moves: [{ move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 1 }] });
    const state = createTeamBattleState({ player: [pokemon("user", "player", "0E4"), injured],
      opponent: [pokemon("target", "opponent")] });
    const turn = resolveTeamTurn(state, action, rng);
    expect(turn.state.replacementRequired).toContain("player");
    const replaced = replaceFaintedPokemon(turn.state, { player: 1 }, rng);
    expect(replaced.state.teams.player.members[1]).toMatchObject({ hp: 100, majorStatus: null,
      moves: [{ pp: MINIMAL_MOVE_CATALOG.TACKLE.pp }] });
  });

  it("requires a reserve for Healing Wish", () => {
    const state = createTeamBattleState({ player: [pokemon("user", "player", "0E3")],
      opponent: [pokemon("target", "opponent")] });
    const turn = resolveTeamTurn(state, action, rng);
    expect(turn.state.teams.player.members[0]?.hp).toBe(100);
    expect(turn.events).toContainEqual({ type: "moveFailed", side: "player", move: "0E3", reason: "condition" });
  });

  it("requests a pivot after a successful U-turn hit", () => {
    const state = createTeamBattleState({ player: [pokemon("user", "player", "0EE"),
      pokemon("reserve", "player")], opponent: [pokemon("target", "opponent")] });
    const turn = resolveTeamTurn(state, action, rng);
    expect(turn.state.pivotRequired).toContain("player");
  });

  it("passes stat stages through Baton Pass", () => {
    const user = pokemon("user", "player", "0ED", {
      stages: { ...pokemon("base", "player").stages, attack: 2 } });
    const turn = resolveTeamTurn(createTeamBattleState({ player: [user, pokemon("reserve", "player")],
      opponent: [pokemon("target", "opponent")] }), action, rng);
    expect(turn.state.pivotRequired).toContain("player");
    const replaced = replaceFaintedPokemon(turn.state, { player: 1 }, rng);
    expect(replaced.state.teams.player.members[1]?.stages.attack).toBe(2);
  });

  it("blocks a trapped target's voluntary switch until the source leaves", () => {
    const first = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("user", "player", "0EF"), pokemon("other", "player")],
      opponent: [pokemon("target", "opponent"), pokemon("backup", "opponent")],
    }), action, rng);
    expect(first.state.teams.opponent.members[0]?.volatile?.meanLookBy).toBe("user");
    expect(() => resolveTeamTurn(first.state, { player: { kind: "wait" },
      opponent: { kind: "switch", teamIndex: 1 } }, rng)).toThrow(/Mean Look/);
    const released = resolveTeamTurn(first.state, { player: { kind: "switch", teamIndex: 1 },
      opponent: { kind: "wait" } }, rng);
    expect(released.state.teams.opponent.members[0]?.volatile?.meanLookBy).toBeNull();
  });

  it("sets and decrements Perish Song on both active battlers", () => {
    const turn = resolveTeamTurn(createTeamBattleState({ player: [pokemon("user", "player", "0E5")],
      opponent: [pokemon("target", "opponent")] }), action, rng);
    expect(turn.state.teams.player.members[0]?.volatile?.perishTurns).toBe(3);
    expect(turn.state.teams.opponent.members[0]?.volatile?.perishTurns).toBe(3);
  });

  it("drops both stats with Memento and sacrifices its user", () => {
    const turn = resolveTeamTurn(createTeamBattleState({ player: [pokemon("user", "player", "0E2"),
      pokemon("reserve", "player")], opponent: [pokemon("target", "opponent")] }), action, rng);
    expect(turn.state.teams.player.members[0]?.hp).toBe(0);
    expect(turn.state.teams.opponent.members[0]?.stages).toMatchObject({ attack: -2, specialAttack: -2 });
  });

  it("empties the knockout move's PP with Grudge", () => {
    const source = pokemon("source", "player", "0E6", { hp: 1 });
    const foe = pokemon("foe", "opponent", "000");
    const turn = resolveTeamTurn(createTeamBattleState({ player: [source], opponent: [foe] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(turn.state.teams.opponent.members[0]?.moves[0]?.pp).toBe(0);
  });

  it("knocks out the attacker with Destiny Bond", () => {
    const source = pokemon("source", "player", "0E7", { hp: 1 });
    const foe = pokemon("foe", "opponent", "000");
    const turn = resolveTeamTurn(createTeamBattleState({ player: [source], opponent: [foe] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(turn.state.teams.player.members[0]?.hp).toBe(0);
    expect(turn.state.teams.opponent.members[0]?.hp).toBe(0);
  });

  it("counts Perish Song on all four active double-battle positions", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("singer", "player", "0E5"), pokemon("ally", "player")],
      opponent: [pokemon("first", "opponent"), pokemon("second", "opponent")],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    for (const side of ["player", "opponent"] as const) for (const index of [0, 1]) {
      expect(result.state.teams[side].members[index]?.volatile?.perishTurns).toBe(3);
    }
  });

  it("escapes a wild battle with Teleport but fails against a trainer", () => {
    const state = createTeamBattleState({ player: [pokemon("user", "player", "0EA")],
      opponent: [pokemon("wild", "opponent")] });
    const wild = resolveTeamTurn(state, action, rng, undefined, { opponentItemTheft: false,
      wildBattle: true, escapable: true });
    expect(wild.state.status).toBe("finished");
    expect(wild.events).toContainEqual({ type: "battleEscaped", side: "player", move: "0EA" });
    const trainer = resolveTeamTurn(state, action, rng);
    expect(trainer.state.status).toBe("active");
    expect(trainer.events).toContainEqual({ type: "moveFailed", side: "player",
      move: "0EA", reason: "condition" });
  });

  it("makes a wild target leave with Roar, but requests a replacement against a trainer", () => {
    const wild = createTeamBattleState({ player: [pokemon("user", "player", "0EB")],
      opponent: [pokemon("wild", "opponent")] });
    const escaped = resolveTeamTurn(wild, action, rng, undefined, { opponentItemTheft: false,
      wildBattle: true });
    expect(escaped.events).toContainEqual({ type: "battleEscaped", side: "opponent", move: "0EB" });
    const trainer = createTeamBattleState({ player: [pokemon("user", "player", "0EB")],
      opponent: [pokemon("target", "opponent"), pokemon("reserve", "opponent")] });
    const forced = resolveTeamTurn(trainer, action, rng);
    expect(forced.state.pivotRequired).toContain("opponent");
  });

  it("makes a wild target leave after a surviving Dragon Tail hit", () => {
    const state = createTeamBattleState({ player: [pokemon("user", "player", "0EC")],
      opponent: [pokemon("wild", "opponent")] });
    const escaped = resolveTeamTurn(state, action, rng, undefined, { opponentItemTheft: false,
      wildBattle: true });
    expect(escaped.events).toContainEqual({ type: "battleEscaped", side: "opponent", move: "0EC" });
  });
});

describe("shared healing and binding move functions", () => {
  it("heals and restores Flying typing at turn end with Roost", () => {
    const state = createTeamBattleState({ player: [pokemon("bird", "player", "0D6",
      { hp: 20, types: ["FLYING", "NORMAL"] })], opponent: [pokemon("target", "opponent")] });
    const turn = resolveTeamTurn(state, action, rng);
    expect(turn.state.teams.player.members[0]).toMatchObject({ hp: 70,
      types: ["FLYING", "NORMAL"] });
    expect(turn.events).toContainEqual({ type: "hpRestored", side: "player", source: "move",
      move: "0D6", amount: 50, hp: 70 });
  });

  it("keeps Wish on the battle position after switching", () => {
    const state = createTeamBattleState({ player: [pokemon("wisher", "player", "0D7"),
      pokemon("receiver", "player", "000", { hp: 20 })],
      opponent: [pokemon("target", "opponent")] });
    const first = resolveTeamTurn(state, action, rng);
    expect(first.state.teams.player.members[0]?.volatile?.wishTurns).toBe(1);
    const second = resolveTeamTurn(first.state, { player: { kind: "switch", teamIndex: 1 },
      opponent: { kind: "wait" } }, rng);
    expect(second.state.teams.player.members[1]?.hp).toBe(70);
  });

  it("heals completely and sleeps with Rest", () => {
    const state = createTeamBattleState({ player: [pokemon("user", "player", "0D9",
      { hp: 20, majorStatus: { kind: "burn" } })], opponent: [pokemon("target", "opponent")] });
    const turn = resolveTeamTurn(state, action, rng);
    expect(turn.state.teams.player.members[0]).toMatchObject({ hp: 100,
      majorStatus: { kind: "sleep" } });
  });

  it("restores HP with Aqua Ring and Ingrain, and Ingrain blocks a switch", () => {
    for (const code of ["0DA", "0DB"] as const) {
      const state = createTeamBattleState({ player: [pokemon("user", "player", code, { hp: 50 }),
        pokemon("reserve", "player")], opponent: [pokemon("target", "opponent")] });
      const turn = resolveTeamTurn(state, action, rng);
      expect(turn.state.teams.player.members[0]?.hp).toBe(56);
      if (code === "0DB") expect(() => resolveTeamTurn(turn.state,
        { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" } }, rng)).toThrow(/Ingrain/);
    }
  });

  it("requires a sleeping target for Dream Eater and drains its damage", () => {
    const state = createTeamBattleState({ player: [pokemon("user", "player", "0DE", { hp: 20 })],
      opponent: [pokemon("target", "opponent")] });
    expect(resolveTeamTurn(state, action, rng).state.teams.opponent.members[0]?.hp).toBe(100);
    const asleep = { ...state, teams: { ...state.teams,
      opponent: { ...state.teams.opponent, members: [
        { ...state.teams.opponent.members[0]!, majorStatus: { kind: "sleep" as const, turnsRemaining: 3 } }] } } };
    const turn = resolveTeamTurn(asleep, action, rng);
    expect(turn.state.teams.opponent.members[0]?.hp).toBeLessThan(100);
    expect(turn.state.teams.player.members[0]?.hp).toBeGreaterThan(20);
  });

  it("heals its target with Heal Pulse", () => {
    const state = createTeamBattleState({ player: [pokemon("user", "player", "0DF")],
      opponent: [pokemon("target", "opponent", "000", { hp: 20 })] });
    expect(resolveTeamTurn(state, action, rng).state.teams.opponent.members[0]?.hp).toBe(70);
  });

  it("binds a surviving target with Whirlpool", () => {
    const state = createTeamBattleState({ player: [pokemon("user", "player", "0D0")],
      opponent: [pokemon("target", "opponent", "000", { hp: 100 }),
        pokemon("reserve", "opponent")] });
    const turn = resolveTeamTurn(state, action, rng);
    expect(turn.state.teams.opponent.members[0]?.volatile?.bindingTurns).toBeGreaterThan(0);
    expect(() => resolveTeamTurn(turn.state, { player: { kind: "wait" },
      opponent: { kind: "switch", teamIndex: 1 } }, rng)).toThrow(/bound/);
  });

  it("locks Outrage for its remaining attacks, then confuses the user", () => {
    const outrage = pokemon("user", "player", "0D2");
    const tackle = MINIMAL_MOVE_CATALOG.TACKLE;
    const user = { ...outrage, moves: [{ ...outrage.moves[0]!, pp: 1 },
      { move: tackle, pp: tackle.pp }] };
    const target = pokemon("target", "opponent", "000", { hp: 500,
      stats: { ...pokemon("target", "opponent").stats, maxHp: 500 } });
    let state = createTeamBattleState({ player: [user], opponent: [target] });
    for (let turn = 0; turn < 3; turn += 1) {
      const result = resolveTeamTurn(state, { player: { kind: "move", moveIndex: turn === 0 ? 0 : 1 },
        opponent: { kind: "wait" } }, rng);
      expect(result.events).toContainEqual({ type: "moveUsed", side: "player", move: "0D2" });
      state = result.state;
    }
    expect(state.teams.player.members[0]?.volatile?.outrageTurns).toBe(0);
    expect(state.teams.player.members[0]?.volatile?.confusionTurns).toBeGreaterThan(0);
  });

  it("stores two turns of incoming damage and releases double damage with Bide", () => {
    const baseUser = pokemon("user", "player", "0D4", { hp: 300,
      stats: { ...pokemon("user", "player").stats, maxHp: 300 } });
    const user = { ...baseUser, moves: [{ ...baseUser.moves[0]!, pp: 1 }] };
    const target = pokemon("target", "opponent", "000", { hp: 500,
      stats: { ...pokemon("target", "opponent").stats, maxHp: 500 } });
    let state = createTeamBattleState({ player: [user], opponent: [target] });
    let stored = 0;
    for (let turn = 0; turn < 2; turn += 1) {
      state = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
        opponent: { kind: "move", moveIndex: 0 } }, rng).state;
      stored = state.teams.player.members[0]?.volatile?.bideDamage ?? 0;
    }
    expect(stored).toBeGreaterThan(0);
    const released = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, rng);
    expect(released.state.teams.opponent.members[0]?.hp).toBe(500 - stored * 2);
    expect(released.state.teams.player.members[0]?.moves[0]?.pp).toBe(0);
  });
});
