import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattlerState,
  type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: () => 0 };
const move = (code: BattleMove["functionCode"], changes: Partial<BattleMove> = {}): BattleMove => ({
  ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: code, functionCode: code,
  power: 70, accuracy: 0, effectChance: 0, flags: "bef", ...changes });
const status = (code: BattleMove["functionCode"], priority = 0): BattleMove =>
  move(code, { category: "Status", power: 0, priority, targetCode: "10" });
function mon(id: string, selected: BattleMove, speed = 100, changes: Partial<BattlerState> = {}): BattlerState {
  return { id, name: id, species: "EEVEE", level: 50, types: ["NORMAL"],
    hp: 400, stats: { maxHp: 400, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed }, stages: { attack: 0, defense: 0,
      specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: selected, pp: 10 }], ...changes };
}
const action = (side: "player" | "opponent", slot: number, target?: { side: "player" | "opponent"; slot: number }) =>
  ({ actor: { side, slot }, action: { kind: "move" as const, moveIndex: 0,
    ...(target === undefined ? {} : { target }) } });

describe("action, target and charge functions", () => {
  it.each([["190", "specialAttack"], ["908", "attack"], ["937", "specialAttack"]] as const)(
    "%s charges and raises its stat once, then attacks without another PP cost", (code, stat) => {
      const charged = move(code, { type: code === "190" ? "ROCK" : "ELECTRIC",
        category: code === "908" ? "Physical" : "Special", power: 100 });
      const initial = createTeamBattleState({ player: [mon("user", charged)],
        opponent: [mon("foe", MINIMAL_MOVE_CATALOG.TACKLE)] });
      const actions = { player: { kind: "move" as const, moveIndex: 0 },
        opponent: { kind: "wait" as const } };
      const first = resolveTeamTurn(initial, actions, rng);
      expect(first.state.teams.player.members[0]?.stages[stat]).toBe(1);
      expect(first.state.teams.opponent.members[0]?.hp).toBe(400);
      expect(first.state.teams.player.members[0]?.volatile?.chargingMove).toBe(code);
      const second = resolveTeamTurn(first.state, actions, rng);
      expect(second.state.teams.opponent.members[0]?.hp).toBeLessThan(400);
      expect(second.state.teams.player.members[0]?.stages[stat]).toBe(1);
      expect(second.state.teams.player.members[0]?.moves[0]?.pp).toBe(9);
    });

  it("Power Herb and rain resolve the charge on the first turn", () => {
    const beam = move("190", { type: "ROCK", category: "Special", power: 100 });
    const herb = createTeamBattleState({ player: [mon("user", beam, 100, { heldItem: "POWERHERB" })],
      opponent: [mon("foe", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const actions = { player: { kind: "move" as const, moveIndex: 0 },
      opponent: { kind: "wait" as const } };
    const used = resolveTeamTurn(herb, actions, rng);
    expect(used.state.teams.player.members[0]?.heldItem).toBeNull();
    expect(used.state.teams.opponent.members[0]?.hp).toBeLessThan(400);
    const shot = createTeamBattleState({ player: [mon("user", move("937", {
      type: "ELECTRIC", category: "Special", power: 100 }))],
    opponent: [mon("foe", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const initialized = resolveTeamTurn(shot, { player: { kind: "wait" },
      opponent: { kind: "wait" } }, rng).state;
    const rainy = resolveTeamTurn({ ...initialized,
      effects: { ...initialized.effects!, weather: "rain" } }, actions, rng);
    expect(rainy.state.teams.opponent.members[0]?.hp).toBeLessThan(400);
    expect(rainy.state.teams.player.members[0]?.stages.specialAttack).toBe(1);
  });

  it("Focus Punch fails after taking damage and Baneful Bunker poisons contact", () => {
    const punch = move("115", { type: "FIGHTING", priority: -3, flags: "abj", power: 150 });
    const duel = createTeamBattleState({ player: [mon("user", punch)],
      opponent: [mon("foe", MINIMAL_MOVE_CATALOG.TACKLE, 120)] });
    const fought = resolveTeamTurn(duel, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(fought.events).toContainEqual({ type: "moveFailed", side: "player",
      move: "115", reason: "condition" });
    const bunker = createTeamBattleState({ player: [mon("user", status("903", 4))],
      opponent: [mon("foe", move("000", { flags: "abef" }))] });
    const guarded = resolveTeamTurn(bunker, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(guarded.state.teams.player.members[0]?.hp).toBe(400);
    expect(guarded.state.teams.opponent.members[0]?.majorStatus?.kind).toBe("poison");
  });

  it("Dragon Darts hits twice in single and divides its hits in double", () => {
    const darts = move("212", { type: "DRAGON", power: 50 });
    const single = createTeamBattleState({ player: [mon("user", darts)],
      opponent: [mon("foe", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const one = resolveTeamTurn(single, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, rng);
    expect(one.events.filter((event) => event.type === "damageApplied")).toHaveLength(2);
    const doubles = createDoubleTeamBattleState({ player: [mon("user", darts),
      mon("ally", MINIMAL_MOVE_CATALOG.TACKLE)], opponent: [mon("foe0", MINIMAL_MOVE_CATALOG.TACKLE),
      mon("foe1", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const two = resolveDoubleTeamTurn(doubles, [action("player", 0),
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } }], rng);
    expect(two.state.teams.opponent.members[0]?.hp).toBeLessThan(400);
    expect(two.state.teams.opponent.members[1]?.hp).toBeLessThan(400);
  });

  it("Follow Me redirects a targeted attack and Ally Switch exchanges active slots", () => {
    const doubles = createDoubleTeamBattleState({ player: [mon("lead", status("117", 3), 100),
      mon("ally", MINIMAL_MOVE_CATALOG.TACKLE)],
    opponent: [mon("foe0", MINIMAL_MOVE_CATALOG.TACKLE, 80),
      mon("foe1", MINIMAL_MOVE_CATALOG.TACKLE, 70)] });
    const followed = resolveDoubleTeamTurn(doubles, [action("player", 0),
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      action("opponent", 0, { side: "player", slot: 1 }),
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } }], rng);
    expect(followed.state.teams.player.members[0]?.hp).toBeLessThan(400);
    expect(followed.state.teams.player.members[1]?.hp).toBe(400);
    const switched = createDoubleTeamBattleState({ player: [mon("lead", status("120", 1)),
      mon("ally", MINIMAL_MOVE_CATALOG.TACKLE)], opponent: [mon("foe0", MINIMAL_MOVE_CATALOG.TACKLE),
      mon("foe1", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const result = resolveDoubleTeamTurn(switched, [action("player", 0),
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } }], rng);
    expect(result.state.teams.player.activeIndices).toEqual([1, 0]);
  });

  it("After You advances its target and Quash delays it in a double round", () => {
    const tackle = move("000", { power: 70 });
    const setup = (ordering: BattleMove) => createDoubleTeamBattleState({
      player: [mon("caller", ordering, 130), mon("ally", tackle, 50)],
      opponent: [mon("foe0", tackle, 110), mon("foe1", tackle, 90)],
    });
    const turns = (ordering: BattleMove, target: { side: "player" | "opponent"; slot: number }) =>
      resolveDoubleTeamTurn(setup(ordering), [action("player", 0, target),
        action("player", 1, { side: "opponent", slot: 0 }),
        action("opponent", 0, { side: "player", slot: 1 }),
        action("opponent", 1, { side: "player", slot: 1 })], rng);
    const after = turns({ ...status("11D"), targetCode: "00" }, { side: "player", slot: 1 });
    const afterOrder = after.events.filter((event) => event.type === "positionedActionResolved")
      .map((event) => `${event.actor.side}:${event.actor.slot}`);
    expect(afterOrder.slice(0, 2)).toEqual(["player:0", "player:1"]);
    const quash = turns({ ...status("11E"), targetCode: "00" }, { side: "opponent", slot: 0 });
    const quashOrder = quash.events.filter((event) => event.type === "positionedActionResolved")
      .map((event) => `${event.actor.side}:${event.actor.slot}`);
    expect(quashOrder.at(-1)).toBe("opponent:0");
  });

  it("Ally Switch keeps the partner's pending action with its Pokemon", () => {
    const doubles = createDoubleTeamBattleState({ player: [mon("switcher", status("120", 1)),
      mon("attacker", move("000", { power: 70 }), 90)],
    opponent: [mon("foe0", MINIMAL_MOVE_CATALOG.TACKLE, 70),
      mon("foe1", MINIMAL_MOVE_CATALOG.TACKLE, 60)] });
    const result = resolveDoubleTeamTurn(doubles, [action("player", 0),
      action("player", 1, { side: "opponent", slot: 0 }),
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } }], rng);
    expect(result.state.teams.player.members[1]?.moves[0]?.pp).toBe(9);
    expect(result.state.teams.opponent.members[0]?.hp).toBeLessThan(400);
  });

  it("Rage Powder leaves Grass, Overcoat and Safety Goggles attackers on their chosen target", () => {
    for (const protection of ["GRASS", "OVERCOAT", "SAFETYGOGGLES"] as const) {
      const powder = { ...status("117", 3), internalName: "RAGEPOWDER" };
      const attacker = mon("foe", move("000", { power: 70 }), 80,
        protection === "GRASS" ? { types: ["GRASS"] }
          : protection === "OVERCOAT" ? { ability: "OVERCOAT" }
            : { heldItem: "SAFETYGOGGLES" });
      const doubles = createDoubleTeamBattleState({
        player: [mon("powder", powder), mon("ally", MINIMAL_MOVE_CATALOG.TACKLE)],
        opponent: [attacker, mon("idle", MINIMAL_MOVE_CATALOG.TACKLE)],
      });
      const result = resolveDoubleTeamTurn(doubles, [action("player", 0),
        { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
        action("opponent", 0, { side: "player", slot: 1 }),
        { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } }], rng);
      expect(result.state.teams.player.members[0]?.hp).toBe(400);
      expect(result.state.teams.player.members[1]?.hp).toBeLessThan(400);
    }
  });
});
