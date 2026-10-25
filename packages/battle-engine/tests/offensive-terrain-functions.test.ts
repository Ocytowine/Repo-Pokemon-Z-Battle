import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide,
  type BattlerState, type RandomSource, type TeamBattleState } from "../src/index.js";

const rng: RandomSource = { nextInt: (maximum) => Math.min(1, maximum - 1) };
const move = (code: BattleMove["functionCode"], type = "NORMAL", power = 80): BattleMove => ({
  ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: code, functionCode: code, type,
  power, category: "Physical", accuracy: 100, effectChance: 0, targetCode: "00" });
function battler(id: string, side: BattleSide, selected: BattleMove): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 500, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: side === "player" ? 100 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 500, majorStatus: null,
    ability: null, heldItem: null, moves: [{ move: selected, pp: 10 }] };
}
const act = { player: { kind: "move" as const, moveIndex: 0 }, opponent: { kind: "wait" as const } };
const field = { sides: { player: { reflectTurns: 0, luckyChantTurns: 0 },
  opponent: { reflectTurns: 0, luckyChantTurns: 0 } }, waterSportTurns: 0 };
function single(selected: BattleMove, terrain?: "electric" | "psychic" | "grassy",
  opponent?: BattlerState): TeamBattleState {
  const state = createTeamBattleState({ player: [battler("user", "player", selected)],
    opponent: [opponent ?? battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)] });
  return terrain === undefined ? state : { ...state, effects: { ...field, ...state.effects,
    terrain, terrainTurns: 3 } };
}

describe("offensive function batch", () => {
  it("Body Press uses the user's Defense and its stage", () => {
    const press = move("175", "FIGHTING");
    const damage = (defense: number, attack: number) => {
      const state = single(press);
      const user = state.teams.player.members[0]!;
      const updated = { ...user, stats: { ...user.stats, defense, attack } };
      const result = resolveTeamTurn({ ...state, teams: { ...state.teams,
        player: { ...state.teams.player, members: [updated] } } }, act, rng);
      return 500 - result.state.teams.opponent.members[0]!.hp;
    };
    expect(damage(200, 50)).toBeGreaterThan(damage(50, 200));
  });

  it("Toxic Thread lowers Speed even when poison is blocked", () => {
    const thread = { ...move("1B9", "POISON", 0), category: "Status" as const };
    const foe = { ...battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE), types: ["STEEL"] };
    const result = resolveTeamTurn(single(thread, undefined, foe), act, rng);
    expect(result.state.teams.opponent.members[0]!.stages.speed).toBe(-2);
    expect(result.state.teams.opponent.members[0]!.majorStatus).toBeNull();
  });

  it.each([["201", "ELECTRIC", "electric"], ["207", "PSYCHIC", "psychic"]] as const)(
    "%s gains power in its terrain", (code, type, terrain) => {
      const selected = { ...move(code, type), category: "Special" as const };
      const normal = resolveTeamTurn(single(selected), act, rng);
      const boosted = resolveTeamTurn(single(selected, terrain), act, rng);
      expect(boosted.state.teams.opponent.members[0]!.hp)
        .toBeLessThan(normal.state.teams.opponent.members[0]!.hp);
    });

  it("Expanding Force targets both foes in Psychic Terrain", () => {
    const force = { ...move("207", "PSYCHIC"), category: "Special" as const };
    const state = createDoubleTeamBattleState({ player: [battler("user", "player", force),
      battler("ally", "player", MINIMAL_MOVE_CATALOG.TACKLE)],
    opponent: [battler("foe1", "opponent", MINIMAL_MOVE_CATALOG.TACKLE),
      battler("foe2", "opponent", MINIMAL_MOVE_CATALOG.TACKLE)] });
    const result = resolveDoubleTeamTurn({ ...state, effects: { ...field, ...state.effects,
      terrain: "psychic", terrainTurns: 3 } }, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.opponent.members.every((member) => member.hp < 500)).toBe(true);
  });

  it("Grassy Glide gains priority only on Grassy Terrain", () => {
    const glide = move("211", "GRASS");
    const foe = { ...battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE),
      stats: { ...battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE).stats, speed: 150 } };
    const both = { player: act.player, opponent: { kind: "move" as const, moveIndex: 0 } };
    const plain = resolveTeamTurn(single(glide, undefined, foe), both, rng);
    const grassy = resolveTeamTurn(single(glide, "grassy", foe), both, rng);
    expect(plain.events.find((event) => event.type === "teamActionOrdered"))
      .toMatchObject({ order: [{ side: "opponent" }, { side: "player" }] });
    expect(grassy.events.find((event) => event.type === "teamActionOrdered"))
      .toMatchObject({ order: [{ side: "player" }, { side: "opponent" }] });
  });

  it("Bolt Beak doubles only against an opponent that has not acted", () => {
    const beak = move("303", "ELECTRIC");
    const foe = { ...battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE),
      stats: { ...battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE).stats, speed: 150 } };
    const actions = { player: act.player, opponent: { kind: "move" as const, moveIndex: 0 } };
    const slow = resolveTeamTurn(single(beak, undefined, foe), actions, rng);
    const fast = resolveTeamTurn(single(beak, undefined, { ...foe,
      stats: { ...foe.stats, speed: 50 } }), actions, rng);
    expect(fast.state.teams.opponent.members[0]!.hp)
      .toBeLessThan(slow.state.teams.opponent.members[0]!.hp);
  });

  it("Steel Beam costs half maximum HP, except with Magic Guard", () => {
    const beam = { ...move("304", "STEEL", 140), category: "Special" as const };
    const base = single(beam);
    const normal = resolveTeamTurn(base, act, rng);
    const guarded = resolveTeamTurn({ ...base, teams: { ...base.teams,
      player: { ...base.teams.player, members: [{ ...base.teams.player.members[0]!,
        ability: "MAGICGUARD" }] } } }, act, rng);
    expect(normal.state.teams.player.members[0]!.hp).toBe(250);
    expect(guarded.state.teams.player.members[0]!.hp).toBe(500);
  });

  it("Dire Claw selects a status after its additional-effect roll", () => {
    const claw = { ...move("911", "POISON"), effectChance: 100 };
    const result = resolveTeamTurn(single(claw), act, rng);
    expect(result.state.teams.opponent.members[0]!.majorStatus?.kind).toBe("sleep");
  });

  it("Pay Day and Make It Rain retain owner-scoped coins in the battle snapshot", () => {
    const rain = { ...move("931", "STEEL", 120), category: "Special" as const };
    const result = resolveTeamTurn(single(rain), act, rng);
    expect(result.state.effects?.scatteredCoins?.user).toBe(250);
    expect(result.state.teams.player.members[0]!.stages.specialAttack).toBe(-1);
    const payDay = resolveTeamTurn(single(move("109")), act, rng);
    expect(payDay.state.effects?.scatteredCoins?.user).toBe(250);
  });

  it("Surging Strikes hits three times critically through Protect", () => {
    const strikes = move("942", "WATER", 25);
    const foe = { ...battler("foe", "opponent", MINIMAL_MOVE_CATALOG.TACKLE),
      volatile: { protected: true } };
    const result = resolveTeamTurn(single(strikes, undefined, foe), act, rng);
    const hits = result.events.filter((event) => event.type === "damageApplied");
    expect(hits).toHaveLength(3);
    expect(hits.every((event) => event.type === "damageApplied" && event.critical)).toBe(true);
    expect(result.state.teams.opponent.members[0]?.volatile?.protected).toBe(false);
  });
});
