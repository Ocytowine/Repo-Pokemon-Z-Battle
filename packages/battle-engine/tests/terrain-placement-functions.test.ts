import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide,
  type BattlerState, type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: () => 0 };
const move = (code: BattleMove["functionCode"], targetCode = "20"): BattleMove => ({
  ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: code, functionCode: code,
  category: "Status", power: 0, accuracy: 0, targetCode,
});
const hit = (code: BattleMove["functionCode"], type = "NORMAL"): BattleMove => ({
  ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: code, functionCode: code,
  type, category: "Physical", power: 60, accuracy: 100,
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

describe("terrain and placement function codes", () => {
  it.each([["154", "electric"], ["155", "grassy"], ["156", "misty"],
    ["905", "psychic"]] as const)("%s creates five rounds of %s terrain and rejects a repeat", (code, terrain) => {
    const initial = createTeamBattleState({ player: [battler("user", "player", move(code, "01"))],
      opponent: [battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const result = resolveTeamTurn(initial, action("player"), rng);
    expect(result.state.effects?.terrain).toBe(terrain);
    expect(result.state.effects?.terrainTurns).toBe(4);
    expect(resolveTeamTurn(result.state, action("player"), rng).events).toContainEqual({
      type: "moveFailed", side: "player", move: code, reason: "condition" });
  });

  it("switches one terrain for another and heals grounded battlers on Grassy Terrain", () => {
    const grassy = move("155", "01");
    const user = { ...battler("user", "player", grassy), hp: 120 };
    const first = resolveTeamTurn(createTeamBattleState({ player: [user],
      opponent: [battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)] }),
    action("player"), rng);
    expect(first.state.teams.player.members[0]?.hp).toBe(135);
    const electric = { ...first.state.teams.player.members[0]!,
      moves: [{ move: move("154", "01"), pp: 10 }] };
    const second = resolveTeamTurn({ ...first.state, teams: { ...first.state.teams,
      player: { ...first.state.teams.player, members: [electric] } } }, action("player"), rng);
    expect(second.state.effects?.terrain).toBe("electric");
  });

  it("Sticky Web lowers grounded entrants and is ignored by airborne entrants", () => {
    const web = { ...move("153", "80"), flags: "c" };
    const initial = createTeamBattleState({ player: [battler("setter", "player", web)],
      opponent: [battler("lead", "opponent", MINIMAL_MOVE_CATALOG.TACKLE),
        battler("reserve", "opponent", MINIMAL_MOVE_CATALOG.TACKLE),
        { ...battler("flying", "opponent", MINIMAL_MOVE_CATALOG.TACKLE), types: ["FLYING"] }] });
    const set = resolveTeamTurn(initial, action("player"), rng);
    expect(set.state.effects?.sides.opponent.stickyWeb).toBe(true);
    const entered = resolveTeamTurn(set.state, { player: { kind: "wait" },
      opponent: { kind: "switch", teamIndex: 1 } }, rng);
    expect(entered.state.teams.opponent.members[1]?.stages.speed).toBe(-1);
    const flying = resolveTeamTurn(entered.state, { player: { kind: "wait" },
      opponent: { kind: "switch", teamIndex: 2 } }, rng);
    expect(flying.state.teams.opponent.members[2]?.stages.speed).toBe(0);
  });

  it("Wonder Room swaps the defensive base stats and toggles off", () => {
    const room = move("124");
    const user = battler("user", "player", room);
    const first = resolveTeamTurn(createTeamBattleState({ player: [user],
      opponent: [battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)] }), action("player"), rng);
    expect(first.state.effects?.wonderRoomTurns).toBe(4);
    const second = resolveTeamTurn(first.state, action("player"), rng);
    expect(second.state.effects?.wonderRoomTurns).toBe(0);
    const attacker = battler("attacker", "player", MINIMAL_MOVE_CATALOG.TACKLE);
    const target = { ...battler("target", "opponent", MINIMAL_MOVE_CATALOG.TACKLE),
      stats: { ...battler("target", "opponent", MINIMAL_MOVE_CATALOG.TACKLE).stats,
        defense: 200, specialDefense: 50 } };
    const context = { reflect: false, lightScreen: false, luckyChant: false,
      mudSport: false, waterSport: false };
    const normal = calculateDamage("player", attacker, target, MINIMAL_MOVE_CATALOG.TACKLE,
      rng, [], context);
    const swapped = calculateDamage("player", attacker, target, MINIMAL_MOVE_CATALOG.TACKLE,
      rng, [], { ...context, wonderRoomTurns: 4 });
    expect(swapped).toBeGreaterThan(normal);
  });

  it("Psychic Terrain blocks a priority hit on a grounded opponent", () => {
    const quick = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "QUICK", priority: 1 };
    const initial = createTeamBattleState({ player: [battler("user", "player", quick)],
      opponent: [battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const terrain = { ...initial, effects: { sides: {
      player: { reflectTurns: 0, luckyChantTurns: 0 },
      opponent: { reflectTurns: 0, luckyChantTurns: 0 },
    }, waterSportTurns: 0, terrain: "psychic" as const, terrainTurns: 4 } };
    const result = resolveTeamTurn(terrain, action("player"), rng);
    expect(result.state.teams.opponent.members[0]?.hp).toBe(240);
  });

  it("Misty Terrain prevents status only for grounded targets", () => {
    const poison = move("005", "00");
    const initial = createTeamBattleState({ player: [battler("user", "player", poison)],
      opponent: [battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const field = { sides: { player: { reflectTurns: 0, luckyChantTurns: 0 },
      opponent: { reflectTurns: 0, luckyChantTurns: 0 } }, waterSportTurns: 0,
    terrain: "misty" as const, terrainTurns: 4 };
    const grounded = resolveTeamTurn({ ...initial, effects: field }, action("player"), rng);
    expect(grounded.state.teams.opponent.members[0]?.majorStatus).toBeNull();
    const flying = resolveTeamTurn({ ...initial, effects: field, teams: { ...initial.teams,
      opponent: { ...initial.teams.opponent, members: [{ ...initial.teams.opponent.members[0]!,
        types: ["FLYING"] }] } } }, action("player"), rng);
    expect(flying.state.teams.opponent.members[0]?.majorStatus?.kind).toBe("poison");
  });

  it("Telekinesis raises the target for three rounds and Gravity ends it", () => {
    const lift = move("11A", "00");
    const initial = createTeamBattleState({ player: [battler("user", "player", lift)],
      opponent: [battler("foe", "opponent", move("118"))] });
    const lifted = resolveTeamTurn(initial, action("player"), rng);
    expect(lifted.state.teams.opponent.members[0]?.volatile?.telekinesisTurns).toBe(2);
    const gravity = resolveTeamTurn(lifted.state, action("opponent"), rng);
    expect(gravity.state.teams.opponent.members[0]?.volatile?.telekinesisTurns).toBe(0);
  });

  it("Smack Down grounds Flying targets and permits later Ground damage", () => {
    const smack = hit("11C", "ROCK");
    const ground = { ...MINIMAL_MOVE_CATALOG.TACKLE, type: "GROUND" };
    const user = { ...battler("user", "player", smack), moves: [
      { move: smack, pp: 10 }, { move: ground, pp: 10 }] };
    const foe = { ...battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE), types: ["FLYING"] };
    const first = resolveTeamTurn(createTeamBattleState({ player: [user], opponent: [foe] }),
      action("player"), rng);
    expect(first.state.teams.opponent.members[0]?.volatile?.smackDown).toBe(true);
    const second = resolveTeamTurn(first.state, { player: { kind: "move", moveIndex: 1 },
      opponent: { kind: "wait" } }, rng);
    expect(second.state.teams.opponent.members[0]?.hp).toBeLessThan(first.state.teams.opponent.members[0]!.hp);
  });

  it("Thousand Arrows hits a Flying type before grounding it", () => {
    const arrows = hit("11C", "GROUND");
    const first = resolveTeamTurn(createTeamBattleState({
      player: [battler("user", "player", arrows)],
      opponent: [{ ...battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE),
        types: ["FLYING"] }],
    }), action("player"), rng);
    expect(first.state.teams.opponent.members[0]?.hp).toBeLessThan(240);
    expect(first.state.teams.opponent.members[0]?.volatile?.smackDown).toBe(true);
  });

  it("Sky Uppercut can hit a Fly charging target", () => {
    const uppercut = hit("11B", "FIGHTING");
    const fly = { ...hit("0C9", "FLYING"), internalName: "FLY" };
    const foe = { ...battler("foe", "opponent", fly), volatile: { chargingMove: "FLY" } };
    const result = resolveTeamTurn(createTeamBattleState({ player: [battler("user", "player", uppercut)],
      opponent: [foe] }), action("player"), rng);
    expect(result.state.teams.opponent.members[0]?.hp).toBeLessThan(240);
  });

  it("Aurora Veil fails without hail and sets both screens under hail", () => {
    const veil = move("927");
    const initial = createTeamBattleState({ player: [battler("user", "player", veil)],
      opponent: [battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)] });
    expect(resolveTeamTurn(initial, action("player"), rng).events).toContainEqual({
      type: "moveFailed", side: "player", move: "927", reason: "condition" });
    const hailed = resolveTeamTurn({ ...initial, effects: { sides: {
      player: { reflectTurns: 0, luckyChantTurns: 0 },
      opponent: { reflectTurns: 0, luckyChantTurns: 0 },
    }, waterSportTurns: 0, weather: "hail", weatherTurns: 4 } }, action("player"), rng);
    expect(hailed.state.effects?.sides.player.reflectTurns).toBe(4);
    expect(hailed.state.effects?.sides.player.lightScreenTurns).toBe(4);
  });

  it("shares a terrain, Wonder Room and Sticky Web across a double turn", () => {
    const initial = createDoubleTeamBattleState({ player: [
      battler("terrain", "player", move("154", "01")),
      battler("room", "player", move("124")),
      battler("web", "player", { ...move("153", "80"), flags: "c" })],
    opponent: [battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const result = resolveDoubleTeamTurn(initial, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.effects?.terrain).toBe("electric");
    expect(result.state.effects?.wonderRoomTurns).toBe(4);
  });
});
