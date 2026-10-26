import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove,
  type BattleSide, type BattlerState, type RandomSource } from "../src/index.js";
import { effectiveTypeMultiplier } from "../src/damage.js";

const rng: RandomSource = { nextInt: () => 0 };

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 200, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 200, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 20 }], ...overrides };
}

describe("Pokemon Z Ring Target", () => {
  const attack = (type: string): BattleMove => ({ ...MINIMAL_MOVE_CATALOG.TACKLE,
    type, accuracy: 0 });

  it.each([
    ["NORMAL", ["GHOST"], null, 1],
    ["ELECTRIC", ["GROUND"], null, 1],
    ["GROUND", ["FLYING"], null, 1],
    ["GROUND", ["NORMAL"], "LEVITATE", 1],
  ] as const)("neutralizes %s immunity against %s with %s ability", (type, types, ability, expected) => {
    const attacker = pokemon("user", "player");
    const defender = pokemon("foe", "opponent", { types: [...types], ability,
      heldItem: "RINGTARGET" });
    expect(effectiveTypeMultiplier(attacker, defender, attack(type))).toBe(expected);
    expect(effectiveTypeMultiplier(attacker, { ...defender, heldItem: null }, attack(type))).toBe(0);
    expect(effectiveTypeMultiplier(attacker, defender, attack(type), null, 2)).toBe(0);
  });

  it("preserves the non-immune type's multiplier and leaves terrain grounding untouched", () => {
    const attacker = pokemon("user", "player");
    const defender = pokemon("foe", "opponent", { types: ["GHOST", "ROCK"], heldItem: "RINGTARGET" });
    expect(effectiveTypeMultiplier(attacker, defender, attack("NORMAL"))).toBe(0.5);
    const balloon = pokemon("foe", "opponent", { heldItem: "AIRBALLOON" });
    expect(effectiveTypeMultiplier(attacker, balloon, attack("GROUND"))).toBe(0);
  });

  it.each([
    ["006", "poison", ["STEEL"]],
    ["00A", "burn", ["FIRE"]],
    ["007", "paralysis", ["ELECTRIC"]],
    ["00C", "frozen", ["ICE"]],
    ["159", "caduco", ["FIRE"]],
    ["906", "hemorrhage", ["FIRE"]],
  ] as const)("allows %s through a matching type immunity", (code, status, types) => {
    const move: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, functionCode: code,
      internalName: `STATUS${code}`, type: "NORMAL", category: "Status", power: 0, accuracy: 0 };
    const attacker = pokemon("user", "player", { moves: [{ move, pp: 10 }] });
    const target = pokemon("foe", "opponent", { types: [...types], heldItem: "RINGTARGET" });
    const play = (defender: BattlerState) => resolveTeamTurn(createTeamBattleState({
      player: [attacker], opponent: [defender],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(play(target).state.teams.opponent.members[0]!.majorStatus?.kind).toBe(status);
    expect(play({ ...target, heldItem: null }).state.teams.opponent.members[0]!.majorStatus).toBeNull();
  });

  it("restores status immunity when Ring Target is suppressed", () => {
    const move: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, functionCode: "006",
      internalName: "TOXIC", category: "Status", power: 0, accuracy: 0 };
    const attacker = pokemon("user", "player", { moves: [{ move, pp: 10 }] });
    const defender = pokemon("foe", "opponent", { types: ["STEEL"], heldItem: "RINGTARGET" });
    const initial = createTeamBattleState({ player: [attacker], opponent: [defender] });
    const actions = { player: { kind: "move" as const, moveIndex: 0 }, opponent: { kind: "wait" as const } };
    expect(resolveTeamTurn({ ...initial, effects: { sides: {
      player: { reflectTurns: 0, luckyChantTurns: 0 },
      opponent: { reflectTurns: 0, luckyChantTurns: 0 },
    }, waterSportTurns: 0, magicRoomTurns: 2 } }, actions, rng)
      .state.teams.opponent.members[0]!.majorStatus).toBeNull();
    const embargoed = pokemon("foe", "opponent", { ...defender,
      volatile: { embargoTurns: 2 } as BattlerState["volatile"] });
    expect(resolveTeamTurn(createTeamBattleState({ player: [attacker], opponent: [embargoed] }), actions, rng)
      .state.teams.opponent.members[0]!.majorStatus).toBeNull();
  });

  it("lets Synchronize reflect a burn onto a Fire-type Ring Target holder", () => {
    const burn: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, functionCode: "00A",
      internalName: "WILLOWISP", category: "Status", power: 0, accuracy: 0 };
    const attacker = pokemon("user", "player", { types: ["FIRE"], heldItem: "RINGTARGET",
      moves: [{ move: burn, pp: 10 }] });
    const defender = pokemon("foe", "opponent", { ability: "SYNCHRONIZE" });
    const play = (user: BattlerState) => resolveTeamTurn(createTeamBattleState({
      player: [user], opponent: [defender] }),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(play(attacker).state.teams.player.members[0]!.majorStatus?.kind).toBe("burn");
    expect(play({ ...attacker, heldItem: null }).state.teams.player.members[0]!.majorStatus).toBeNull();
  });

  it("lets Static paralyze an Electric-type Ring Target holder on contact", () => {
    const contactMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, flags: "a" };
    const attacker = pokemon("user", "player", { types: ["ELECTRIC"], heldItem: "RINGTARGET",
      moves: [{ move: contactMove, pp: 20 }] });
    const defender = pokemon("foe", "opponent", { ability: "STATIC" });
    const play = (user: BattlerState) => resolveTeamTurn(createTeamBattleState({
      player: [user], opponent: [defender] }),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(play(attacker).state.teams.player.members[0]!.majorStatus?.kind).toBe("paralysis");
    expect(play({ ...attacker, heldItem: null }).state.teams.player.members[0]!.majorStatus).toBeNull();
  });

  it("applies Ring Target only to the struck slot in Duo", () => {
    const move = attack("NORMAL");
    const state = createDoubleTeamBattleState({
      player: [pokemon("p1", "player", { moves: [{ move, pp: 10 }] }), pokemon("p2", "player")],
      opponent: [pokemon("o1", "opponent", { types: ["GHOST"] }),
        pokemon("o2", "opponent", { types: ["GHOST"], heldItem: "RINGTARGET" })],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 1 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.opponent.members[0]!.hp).toBe(200);
    expect(result.state.teams.opponent.members[1]!.hp).toBeLessThan(200);
  });
});
