import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  replaceFaintedDoublePokemon, replaceFaintedPokemon, resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide,
  type BattlerState, type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: () => 0 };
const move = (code: BattleMove["functionCode"], targetCode = "20"): BattleMove => ({
  ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: code, functionCode: code,
  category: "Status", power: 0, accuracy: 0, targetCode,
});
function battler(id: string, side: BattleSide, selected: BattleMove): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 240, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: side === "player" ? 100 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 240, majorStatus: null,
    ability: null, heldItem: null, moves: [{ move: selected, pp: 10 }] };
}
const action = (side: BattleSide) => ({ player: side === "player"
  ? { kind: "move" as const, moveIndex: 0 } : { kind: "wait" as const },
opponent: side === "opponent"
  ? { kind: "move" as const, moveIndex: 0 } : { kind: "wait" as const } });

describe("weather and shared field moves", () => {
  it.each([["0FF", "sun", "HEATROCK"], ["100", "rain", "DAMPROCK"],
    ["101", "sand", "SMOOTHROCK"], ["102", "hail", "ICYROCK"]] as const)(
    "%s creates %s for five turns, or eight with %s", (code, weather, item) => {
      const user = battler("user", "player", move(code));
      const initial = createTeamBattleState({ player: [user],
        opponent: [battler("foe", "opponent", move("000"))] });
      const ordinary = resolveTeamTurn(initial, action("player"), rng);
      expect(ordinary.state.effects?.weather).toBe(weather);
      expect(ordinary.state.effects?.weatherTurns).toBe(4);
      const extended = resolveTeamTurn(createTeamBattleState({
        player: [{ ...user, heldItem: item }],
        opponent: [battler("foe", "opponent", move("000"))],
      }), action("player"), rng);
      expect(extended.state.effects?.weatherTurns).toBe(7);
      const repeated = resolveTeamTurn(ordinary.state, action("player"), rng);
      expect(repeated.events).toContainEqual({ type: "moveFailed", side: "player", move: code,
        reason: "condition" });
    });

  it("cannot overwrite extreme weather", () => {
    const initial = createTeamBattleState({ player: [battler("user", "player", move("100"))],
      opponent: [{ ...battler("foe", "opponent", move("000")), ability: "DESOLATELAND" }] });
    const blocked = resolveTeamTurn({ ...initial, effects: { sides: {
      player: { reflectTurns: 0, luckyChantTurns: 0 },
      opponent: { reflectTurns: 0, luckyChantTurns: 0 },
    }, waterSportTurns: 0, weather: "harsh-sun", weatherTurns: -1 } }, action("player"), rng);
    expect(blocked.events).toContainEqual({ type: "moveFailed", side: "player",
      move: "100", reason: "condition" });
    expect(blocked.state.effects?.weather).toBe("harsh-sun");
  });

  it("Spikes stack to three, damage a grounded entrant, and fail at the cap", () => {
    const spikes = move("103", "80");
    let state = createTeamBattleState({
      player: [battler("setter", "player", spikes)],
      opponent: [battler("lead", "opponent", move("000")),
        battler("reserve", "opponent", move("000"))],
    });
    for (let layer = 1; layer <= 3; layer += 1) {
      state = resolveTeamTurn(state, action("player"), rng).state;
      expect(state.effects?.sides.opponent.spikesLayers).toBe(layer);
    }
    expect(resolveTeamTurn(state, action("player"), rng).events).toContainEqual({
      type: "moveFailed", side: "player", move: "103", reason: "condition",
    });
    const switched = resolveTeamTurn(state, { player: { kind: "wait" },
      opponent: { kind: "switch", teamIndex: 1 } }, rng);
    expect(switched.state.teams.opponent.members[1]?.hp).toBe(180);
    expect(switched.events.some((event) => event.type === "entryHazardDamage"
      && event.hazard === "spikes" && event.amount === 60)).toBe(true);
  });

  it("Toxic Spikes badly poison on two layers and are removed by a grounded Poison entrant", () => {
    const toxic = move("104", "80");
    let state = createTeamBattleState({
      player: [battler("setter", "player", toxic)],
      opponent: [battler("lead", "opponent", move("000")),
        battler("reserve", "opponent", move("000")),
        { ...battler("absorber", "opponent", move("000")), types: ["POISON"] }],
    });
    state = resolveTeamTurn(state, action("player"), rng).state;
    state = resolveTeamTurn(state, action("player"), rng).state;
    const poisoned = resolveTeamTurn(state, { player: { kind: "wait" },
      opponent: { kind: "switch", teamIndex: 1 } }, rng);
    expect(poisoned.state.teams.opponent.members[1]?.majorStatus).toEqual({ kind: "poison", toxicCounter: 1 });
    const absorbed = resolveTeamTurn(poisoned.state, { player: { kind: "wait" },
      opponent: { kind: "switch", teamIndex: 2 } }, rng);
    expect(absorbed.state.effects?.sides.opponent.toxicSpikesLayers).toBe(0);
  });

  it("Stealth Rock scales with Rock effectiveness and also hurts Flying entrants", () => {
    const initial = createTeamBattleState({
      player: [battler("setter", "player", move("105", "80"))],
      opponent: [battler("lead", "opponent", move("000")),
        { ...battler("flying", "opponent", move("000")), types: ["FLYING"] }],
    });
    const set = resolveTeamTurn(initial, action("player"), rng);
    const switched = resolveTeamTurn(set.state, { player: { kind: "wait" },
      opponent: { kind: "switch", teamIndex: 1 } }, rng);
    expect(switched.state.teams.opponent.members[1]?.hp).toBe(180);
  });

  it("requests another replacement when entry hazards knock out an incoming battler", () => {
    const initial = createTeamBattleState({
      player: [battler("lead", "player", MINIMAL_MOVE_CATALOG.TACKLE),
        { ...battler("fragile", "player", MINIMAL_MOVE_CATALOG.TACKLE), hp: 1 }],
      opponent: [battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)],
    });
    const result = resolveTeamTurn({ ...initial, effects: { sides: {
      player: { reflectTurns: 0, luckyChantTurns: 0, spikesLayers: 1 },
      opponent: { reflectTurns: 0, luckyChantTurns: 0 },
    }, waterSportTurns: 0 } }, { player: { kind: "switch", teamIndex: 1 },
      opponent: { kind: "wait" } }, rng);
    expect(result.state.teams.player.members[1]?.hp).toBe(0);
    expect(result.state.replacementRequired).toContain("player");
  });

  it("keeps a single replacement pending if its entrant faints on Spikes", () => {
    const initial = createTeamBattleState({
      player: [battler("lead", "player", MINIMAL_MOVE_CATALOG.TACKLE),
        { ...battler("fragile", "player", MINIMAL_MOVE_CATALOG.TACKLE), hp: 1 },
        battler("backup", "player", MINIMAL_MOVE_CATALOG.TACKLE)],
      opponent: [battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)],
    });
    const state = { ...initial, teams: { ...initial.teams, player: { ...initial.teams.player,
      members: initial.teams.player.members.map((member, index) => index === 0 ? { ...member, hp: 0 } : member) } },
      replacementRequired: ["player" as const], effects: { sides: {
        player: { reflectTurns: 0, luckyChantTurns: 0, spikesLayers: 1 },
        opponent: { reflectTurns: 0, luckyChantTurns: 0 },
      }, waterSportTurns: 0 } };
    const replaced = replaceFaintedPokemon(state, { player: 1 }, rng);
    expect(replaced.state.teams.player.members[1]?.hp).toBe(0);
    expect(replaced.state.replacementRequired).toContain("player");
    expect(replaced.events).toContainEqual({ type: "replacementRequired", side: "player" });
    const backup = replaceFaintedPokemon(replaced.state, { player: 2 }, rng);
    expect(backup.state.replacementRequired).toEqual([]);
  });

  it("Trick Room reverses equal-priority order and toggles off when used again", () => {
    const trick = move("11F");
    const slow = { ...battler("slow", "player", trick), stats: {
      ...battler("slow", "player", trick).stats, speed: 50 },
      moves: [{ move: trick, pp: 10 }, { move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 10 }] };
    const fast = battler("fast", "opponent", MINIMAL_MOVE_CATALOG.TACKLE);
    const first = resolveTeamTurn(createTeamBattleState({ player: [slow], opponent: [fast] }),
      action("player"), rng);
    expect(first.state.effects?.trickRoomTurns).toBe(4);
    const reversed = resolveTeamTurn(first.state, { player: { kind: "move", moveIndex: 1 },
      opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(reversed.trace.find((entry) => entry.type === "order")?.side).toBe("player");
    const second = resolveTeamTurn(reversed.state, action("player"), rng);
    expect(second.state.effects?.trickRoomTurns).toBe(0);
  });

  it("Magnet Rise blocks Ground until Gravity grounds its user", () => {
    const rise = move("119", "10");
    const ground = { ...MINIMAL_MOVE_CATALOG.TACKLE, type: "GROUND", power: 60 };
    const first = resolveTeamTurn(createTeamBattleState({
      player: [battler("user", "player", rise)],
      opponent: [{ ...battler("foe", "opponent", move("118")),
        moves: [{ move: move("118"), pp: 10 }, { move: ground, pp: 10 }] }],
    }), action("player"), rng);
    expect(first.state.teams.player.members[0]?.volatile?.magnetRiseTurns).toBe(4);
    const blocked = resolveTeamTurn(first.state, { player: { kind: "wait" },
      opponent: { kind: "move", moveIndex: 1 } }, rng);
    expect(blocked.state.teams.player.members[0]?.hp).toBe(240);
    const gravity = resolveTeamTurn(blocked.state, action("opponent"), rng);
    expect(gravity.state.effects?.gravityTurns).toBe(4);
    expect(gravity.state.teams.player.members[0]?.volatile?.magnetRiseTurns).toBe(0);
    const grounded = resolveTeamTurn(gravity.state, { player: { kind: "wait" },
      opponent: { kind: "move", moveIndex: 1 } }, rng);
    expect(grounded.state.teams.player.members[0]?.hp).toBeLessThan(240);
  });

  it("shares hazards and Gravity between both positioned opponents in double", () => {
    const initial = createDoubleTeamBattleState({
      player: [battler("setter", "player", move("103", "80")),
        battler("partner", "player", move("118"))],
      opponent: [battler("lead", "opponent", move("000")),
        battler("other", "opponent", move("000")),
        battler("reserve", "opponent", move("000"))],
    });
    const set = resolveDoubleTeamTurn(initial, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(set.state.effects?.sides.opponent.spikesLayers).toBe(1);
    expect(set.state.effects?.gravityTurns).toBe(4);
    const entered = resolveDoubleTeamTurn(set.state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "switch", teamIndex: 2 } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(entered.state.teams.opponent.members[2]?.hp).toBe(210);
  });

  it("keeps a double slot pending when its replacement faints to entry hazards", () => {
    const initial = createDoubleTeamBattleState({
      player: [battler("lead", "player", MINIMAL_MOVE_CATALOG.TACKLE),
        battler("ally", "player", MINIMAL_MOVE_CATALOG.TACKLE),
        { ...battler("fragile", "player", MINIMAL_MOVE_CATALOG.TACKLE), hp: 1 },
        battler("backup", "player", MINIMAL_MOVE_CATALOG.TACKLE)],
      opponent: [battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)],
    });
    const state = { ...initial, effects: { sides: {
      player: { reflectTurns: 0, luckyChantTurns: 0, spikesLayers: 1 },
      opponent: { reflectTurns: 0, luckyChantTurns: 0 },
    }, waterSportTurns: 0 } };
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "switch", teamIndex: 2 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.player.members[2]?.hp).toBe(0);
    expect(result.state.slotReplacements).toContainEqual({ side: "player", slot: 0 });
  });

  it("retains the pending slot after a hazard KO during a requested double replacement", () => {
    const initial = createDoubleTeamBattleState({
      player: [battler("lead", "player", MINIMAL_MOVE_CATALOG.TACKLE),
        battler("ally", "player", MINIMAL_MOVE_CATALOG.TACKLE),
        { ...battler("fragile", "player", MINIMAL_MOVE_CATALOG.TACKLE), hp: 1 },
        battler("backup", "player", MINIMAL_MOVE_CATALOG.TACKLE)],
      opponent: [battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)],
    });
    const state = { ...initial, teams: { ...initial.teams, player: { ...initial.teams.player,
      members: initial.teams.player.members.map((member, index) => index === 0 ? { ...member, hp: 0 } : member) } },
    slotReplacements: [{ side: "player" as const, slot: 0 }],
    effects: { sides: { player: { reflectTurns: 0, luckyChantTurns: 0, spikesLayers: 1 },
      opponent: { reflectTurns: 0, luckyChantTurns: 0 } }, waterSportTurns: 0 } };
    const replaced = replaceFaintedDoublePokemon(state, { side: "player", slot: 0 }, 2, rng);
    expect(replaced.teams.player.members[2]?.hp).toBe(0);
    expect(replaced.slotReplacements).toContainEqual({ side: "player", slot: 0 });
  });

  it("reflects a side-targeted hazard from a double partner with Magic Bounce", () => {
    const initial = createDoubleTeamBattleState({
      player: [battler("setter", "player", { ...move("103", "80"), flags: "c" })],
      opponent: [battler("lead", "opponent", MINIMAL_MOVE_CATALOG.TACKLE),
        { ...battler("mirror", "opponent", MINIMAL_MOVE_CATALOG.TACKLE), ability: "MAGICBOUNCE" }],
    });
    const result = resolveDoubleTeamTurn(initial, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.effects?.sides.player.spikesLayers).toBe(1);
    expect(result.state.effects?.sides.opponent.spikesLayers).toBe(0);
  });
});
