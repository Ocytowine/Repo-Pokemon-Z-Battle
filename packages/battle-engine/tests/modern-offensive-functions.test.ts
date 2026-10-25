import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide,
  type BattlerState, type RandomSource, type TeamBattleState } from "../src/index.js";

const low: RandomSource = { nextInt: () => 0 };
const high: RandomSource = { nextInt: (maximum) => maximum - 1 };
const move = (code: BattleMove["functionCode"], overrides: Partial<BattleMove> = {}): BattleMove => ({
  ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: code, functionCode: code,
  power: 70, accuracy: 0, effectChance: 0, type: "NORMAL", flags: "bef", ...overrides });
function battler(id: string, side: BattleSide, selected: BattleMove,
  overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 500, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: side === "player" ? 100 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 500, majorStatus: null,
    ability: null, heldItem: null, moves: [{ move: selected, pp: 10 }], ...overrides };
}
const field = (terrain: "electric" | "grassy" | "misty" | "psychic") => ({
  sides: { player: { reflectTurns: 0, luckyChantTurns: 0 },
    opponent: { reflectTurns: 0, luckyChantTurns: 0 } },
  waterSportTurns: 0, terrain, terrainTurns: 3,
});
const action = { player: { kind: "move" as const, moveIndex: 0 },
  opponent: { kind: "wait" as const } };
function state(selected: BattleMove, foe?: Partial<BattlerState>): TeamBattleState {
  return createTeamBattleState({ player: [battler("user", "player", selected)],
    opponent: [battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE, foe)] });
}

describe("modern offensive move functions", () => {
  it("Poltergeist requires an active target item", () => {
    const poltergeist = move("204", { type: "GHOST" });
    const noItem = resolveTeamTurn(state(poltergeist, { types: ["PSYCHIC"] }), action, high);
    const item = resolveTeamTurn(state(poltergeist, { types: ["PSYCHIC"], heldItem: "LEFTOVERS" }), action, high);
    const klutz = resolveTeamTurn(state(poltergeist, { types: ["PSYCHIC"], heldItem: "LEFTOVERS", ability: "KLUTZ" }), action, high);
    const embargo = resolveTeamTurn(state(poltergeist, { types: ["PSYCHIC"], heldItem: "LEFTOVERS",
      volatile: { embargoTurns: 2 } }), action, high);
    const blockedByRoom = resolveTeamTurn({ ...state(poltergeist,
      { types: ["PSYCHIC"], heldItem: "LEFTOVERS" }),
    effects: { ...field("electric"), magicRoomTurns: 2 } }, action, high);
    expect(noItem.state.teams.opponent.members[0]!.hp).toBe(500);
    expect(item.state.teams.opponent.members[0]!.hp).toBeLessThan(500);
    expect(klutz.state.teams.opponent.members[0]!.hp).toBe(500);
    expect(embargo.state.teams.opponent.members[0]!.hp).toBe(500);
    expect(blockedByRoom.state.teams.opponent.members[0]!.hp).toBe(500);
  });

  it("Bruma Explosiva has +1 priority only under Misty Terrain", () => {
    const mist = move("208", { type: "FAIRY", category: "Special" });
    const foe = battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE, {
      stats: { ...battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE).stats, speed: 150 } });
    const base = state(mist, foe);
    const both = { player: action.player, opponent: { kind: "move" as const, moveIndex: 0 } };
    const grassy = resolveTeamTurn({ ...base, effects: field("grassy") }, both, high);
    const misty = resolveTeamTurn({ ...base, effects: field("misty") }, both, high);
    expect(grassy.events.find((event) => event.type === "teamActionOrdered"))
      .toMatchObject({ order: [{ side: "opponent" }, { side: "player" }] });
    expect(misty.events.find((event) => event.type === "teamActionOrdered"))
      .toMatchObject({ order: [{ side: "player" }, { side: "opponent" }] });
  });

  it("Pirueta Helada removes terrain only after a damaging hit", () => {
    const spin = move("240", { type: "ICE" });
    const base = { ...state(spin), effects: field("electric") };
    const hit = resolveTeamTurn(base, action, high);
    const miss = resolveTeamTurn({ ...base, teams: { ...base.teams,
      player: { ...base.teams.player, members: [battler("user", "player",
        { ...spin, accuracy: 1 })] } } }, action, high);
    expect(hit.state.effects?.terrain).toBeNull();
    expect(miss.state.effects?.terrain).toBe("electric");
  });

  it("Sable Ardiente is stronger against burn or paralysis", () => {
    const sand = move("307", { type: "FIRE", power: 90 });
    const normal = resolveTeamTurn(state(sand), action, high);
    const burned = resolveTeamTurn(state(sand, { majorStatus: { kind: "burn" } }), action, high);
    const paralyzed = resolveTeamTurn(state(sand, { majorStatus: { kind: "paralysis" } }), action, high);
    expect(burned.state.teams.opponent.members[0]!.hp).toBeLessThan(normal.state.teams.opponent.members[0]!.hp);
    expect(paralyzed.state.teams.opponent.members[0]!.hp).toBeLessThan(normal.state.teams.opponent.members[0]!.hp);
  });

  it("Stone Axe establishes one opposing Stealth Rock layer in double", () => {
    const axe = move("900", { type: "ROCK" });
    const initial = createDoubleTeamBattleState({ player: [battler("user", "player", axe),
      battler("ally", "player", MINIMAL_MOVE_CATALOG.TACKLE)], opponent: [
      battler("foe1", "opponent", MINIMAL_MOVE_CATALOG.TACKLE),
      battler("foe2", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const result = resolveDoubleTeamTurn(initial, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], high);
    expect(result.state.effects?.sides.opponent.stealthRock).toBe(true);
    expect(result.state.effects?.sides.player.stealthRock).toBe(false);
  });

  it("Infernal Parade and Barb Barrage double against their status and can inflict it", () => {
    for (const [code, type, status] of [["914", "GHOST", "burn"],
      ["915", "POISON", "poison"]] as const) {
      const selected = move(code, { type, category: code === "914" ? "Special" : "Physical",
        effectChance: 100 });
      const targetTypes = code === "914" ? ["PSYCHIC"] : ["NORMAL"];
      const plain = resolveTeamTurn(state(selected, { types: targetTypes }), action, low);
      const affected = resolveTeamTurn(state(selected, { types: targetTypes, majorStatus: status === "burn"
        ? { kind: "burn" } : { kind: "poison", toxicCounter: null } }), action, low);
      expect(plain.state.teams.opponent.members[0]!.majorStatus?.kind).toBe(status);
      expect(affected.state.teams.opponent.members[0]!.hp)
        .toBeLessThan(plain.state.teams.opponent.members[0]!.hp);
    }
  });

  it("Triple Arrows rolls Defense drop and flinch independently", () => {
    const arrows = move("918", { type: "FIGHTING", effectChance: 100, flags: "befh" });
    const both = resolveTeamTurn(state(arrows), action, low);
    const neither = resolveTeamTurn(state(arrows), action, high);
    expect(both.state.teams.opponent.members[0]!.stages.defense).toBe(-1);
    expect(both.events).toContainEqual({ type: "volatileApplied", source: "player",
      target: "opponent", effect: "flinch", turns: 1, move: "918" });
    expect(neither.state.teams.opponent.members[0]!.stages.defense).toBe(0);
  });

  it("Jaw Lock traps both survivors but not Ghost targets", () => {
    const jaw = move("922", { type: "DARK" });
    const trapped = resolveTeamTurn(state(jaw), action, high);
    expect(trapped.state.teams.player.members[0]!.volatile?.meanLookBy).toBe("foe");
    expect(trapped.state.teams.opponent.members[0]!.volatile?.meanLookBy).toBe("user");
    const withReserves = { ...trapped.state, teams: {
      player: { ...trapped.state.teams.player, members: [
        ...trapped.state.teams.player.members, battler("user-reserve", "player", MINIMAL_MOVE_CATALOG.TACKLE)] },
      opponent: { ...trapped.state.teams.opponent, members: [
        ...trapped.state.teams.opponent.members, battler("foe-reserve", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)] },
    } };
    expect(() => resolveTeamTurn(withReserves, { player: { kind: "switch", teamIndex: 1 },
      opponent: { kind: "wait" } }, high)).toThrow();
    expect(() => resolveTeamTurn(withReserves, { player: { kind: "wait" },
      opponent: { kind: "switch", teamIndex: 1 } }, high)).toThrow();
    const ghost = resolveTeamTurn(state(jaw, { types: ["GHOST"] }), action, high);
    expect(ghost.state.teams.player.members[0]!.volatile?.meanLookBy).toBeNull();
  });

  it("Fickle Beam doubles only on the source one-in-three power roll", () => {
    const beam = move("938", { type: "DRAGON", category: "Special" });
    const boosted = resolveTeamTurn(state(beam), action, low);
    const normal = resolveTeamTurn(state(beam), action, high);
    expect(boosted.state.teams.opponent.members[0]!.hp)
      .toBeLessThan(normal.state.teams.opponent.members[0]!.hp);
  });
});
