import { describe, expect, it } from "vitest";
import { calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide,
  type BattlerState, type RandomSource } from "../src/index.js";

const random: RandomSource = { nextInt: (max) => max - 1 };
const physical: BattleMove = { id: 1, internalName: "TESTPHYSICAL", name: "Test physique",
  functionCode: "000", power: 80, type: "NORMAL", category: "Physical", accuracy: 0,
  pp: 20, priority: 0, effectChance: 0 };
const special: BattleMove = { ...physical, id: 2, internalName: "TESTSPECIAL",
  category: "Special" };

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["FIRE"],
    stats: { maxHp: 1000, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 1000, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: physical, pp: 20 }, { move: special, pp: 20 }], ...overrides };
}

const damage = (attacker: BattlerState, defender: BattlerState, move: BattleMove,
  soulDewClause = false) => calculateDamage("player", attacker, defender, move, random, [],
  { soulDewClause });

describe("source species-specific held items", () => {
  it.each([
    ["ADAMANTORB", "DIALGA", "STEEL"],
    ["LUSTROUSORB", "PALKIA", "WATER"],
    ["GRISEOUSORB", "GIRATINA", "GHOST"],
  ] as const)("boosts %s only on %s's matching effective type", (item, species, type) => {
    const move = { ...special, type };
    const user = pokemon("user", "player", { species, heldItem: item });
    const foe = pokemon("foe", "opponent");
    expect(damage(user, foe, move)).toBeGreaterThan(damage({ ...user, heldItem: null }, foe, move));
    expect(damage({ ...user, species: "EEVEE" }, foe, move))
      .toBe(damage({ ...user, heldItem: null, species: "EEVEE" }, foe, move));
    expect(damage(user, foe, { ...move, type: "NORMAL" }))
      .toBe(damage({ ...user, heldItem: null }, foe, { ...move, type: "NORMAL" }));
  });

  it("doubles Clamperl's special attack with Deep Sea Tooth and physical defense with Scale", () => {
    const user = pokemon("user", "player", { species: "CLAMPERL", heldItem: "DEEPSEATOOTH" });
    const foe = pokemon("foe", "opponent");
    expect(damage(user, foe, special)).toBeGreaterThan(damage({ ...user, heldItem: null }, foe, special));
    expect(damage(user, foe, physical)).toBe(damage({ ...user, heldItem: null }, foe, physical));
    const scaled = { ...foe, species: "CLAMPERL", heldItem: "DEEPSEASCALE" };
    expect(damage(user, scaled, physical)).toBeLessThan(damage(user, { ...scaled, heldItem: null }, physical));
    expect(damage(user, scaled, special)).toBe(damage(user, { ...scaled, heldItem: null }, special));
  });

  it("boosts both Latias/Latios special stats with Soul Dew unless its clause is active", () => {
    const user = pokemon("user", "player", { species: "LATIAS", heldItem: "SOULDEW" });
    const foe = pokemon("foe", "opponent", { species: "LATIOS", heldItem: "SOULDEW" });
    expect(damage(user, { ...foe, heldItem: null }, special))
      .toBeGreaterThan(damage({ ...user, heldItem: null }, { ...foe, heldItem: null }, special));
    expect(damage({ ...user, heldItem: null }, foe, special))
      .toBeLessThan(damage({ ...user, heldItem: null }, { ...foe, heldItem: null }, special));
    expect(damage(user, foe, special, true))
      .toBe(damage({ ...user, heldItem: null }, { ...foe, heldItem: null }, special));
    expect(damage(user, foe, physical)).toBe(damage({ ...user, heldItem: null },
      { ...foe, heldItem: null }, physical));
    const normal = createTeamBattleState({ player: [user], opponent: [{ ...foe, heldItem: null }] });
    const withClause = resolveTeamTurn(normal,
      { player: { kind: "move", moveIndex: 1 }, opponent: { kind: "wait" } }, random,
      { context: "battle", revivalAllowed: true },
      { opponentItemTheft: true, soulDewClause: true });
    const without = resolveTeamTurn(normal,
      { player: { kind: "move", moveIndex: 1 }, opponent: { kind: "wait" } }, random);
    expect(withClause.state.teams.opponent.members[0]!.hp)
      .toBeGreaterThan(without.state.teams.opponent.members[0]!.hp);
    expect(withClause.state.effects.soulDewClause).toBe(true);
    const next = resolveTeamTurn(withClause.state,
      { player: { kind: "move", moveIndex: 1 }, opponent: { kind: "wait" } }, random);
    expect(next.state.effects.soulDewClause).toBe(true);
  });

  it("applies Metal Powder only to untransformed Ditto", () => {
    const user = pokemon("user", "player");
    const ditto = pokemon("foe", "opponent", { species: "DITTO", heldItem: "METALPOWDER" });
    expect(damage(user, ditto, physical)).toBeLessThan(damage(user, { ...ditto, heldItem: null }, physical));
    expect(damage(user, ditto, special)).toBeLessThan(damage(user, { ...ditto, heldItem: null }, special));
    const transformed = { ...ditto, transformOriginal: { species: "DITTO", name: "foe",
      types: ditto.types, stats: ditto.stats, stages: ditto.stages, ability: null,
      moves: ditto.moves } };
    expect(damage(user, transformed, physical))
      .toBe(damage(user, { ...transformed, heldItem: null }, physical));
  });

  it("keeps the source's Lagging Tail and Light Ball species multipliers", () => {
    const foe = pokemon("foe", "opponent");
    for (const species of ["CUBONE", "MAROWAK", "MAROLIER"]) {
      const user = pokemon("user", "player", { species, heldItem: "LAGGINGTAIL" });
      expect(damage(user, foe, physical)).toBeGreaterThan(damage({ ...user, heldItem: null }, foe, physical));
      expect(damage(user, foe, special)).toBe(damage({ ...user, heldItem: null }, foe, special));
    }
    for (const species of ["PIKACHU", "RAICHU"]) {
      const user = pokemon("user", "player", { species, heldItem: "LIGHTBALL" });
      expect(damage(user, foe, physical)).toBeGreaterThan(damage({ ...user, heldItem: null }, foe, physical));
      expect(damage(user, foe, special)).toBeGreaterThan(damage({ ...user, heldItem: null }, foe, special));
    }
  });

  it("applies an orb on the correct Duo attacker and target", () => {
    const steel = { ...physical, type: "STEEL" };
    const dialga = pokemon("p1", "player", { species: "DIALGA", heldItem: "ADAMANTORB",
      moves: [{ move: steel, pp: 20 }] });
    const state = createDoubleTeamBattleState({ player: [dialga, pokemon("p2", "player")],
      opponent: [pokemon("o1", "opponent"), pokemon("o2", "opponent")] });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 1 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], random);
    expect(result.state.teams.opponent.members[0]!.hp).toBe(1000);
    expect(result.state.teams.opponent.members[1]!.hp).toBeLessThan(1000);
    expect(result.state.teams.player.members[0]!.heldItem).toBe("ADAMANTORB");
  });
});

describe("the five source type-boosting incenses", () => {
  it.each([
    ["ROCKINCENSE", "ROCK"], ["ROSEINCENSE", "GRASS"],
    ["SEAINCENSE", "WATER"], ["WAVEINCENSE", "WATER"],
    ["ODDINCENSE", "PSYCHIC"],
  ] as const)("boosts only %s's matching type", (item, type) => {
    const user = pokemon("user", "player", { heldItem: item });
    const foe = pokemon("foe", "opponent");
    const matching = { ...special, type };
    expect(damage(user, foe, matching)).toBeGreaterThan(damage({ ...user, heldItem: null }, foe, matching));
    expect(damage(user, foe, physical)).toBe(damage({ ...user, heldItem: null }, foe, physical));
    expect(calculateDamage("player", user, foe, matching, random, [], { magicRoomTurns: 2 }))
      .toBe(damage({ ...user, heldItem: null }, foe, matching));
  });
});
