import { describe, expect, it } from "vitest";
import { calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide,
  type BattlerState, type RandomSource } from "../src/index.js";
import { ALL_HELD_GEMS, matchingHeldGem } from "../src/held-gems.js";

const random: RandomSource = { nextInt: () => 0 };
const move: BattleMove = { id: 1, internalName: "TESTMOVE", name: "Attaque test",
  functionCode: "000", power: 80, type: "NORMAL", category: "Physical", accuracy: 0,
  pp: 20, priority: 0, effectChance: 0 };

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: [side === "player" ? "NORMAL" : "WATER"],
    stats: { maxHp: 300, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 300, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move, pp: move.pp }], ...overrides };
}

describe("the eighteen source Gems", () => {
  it("boosts and consumes every Gem for its effective move type", () => {
    expect(ALL_HELD_GEMS).toHaveLength(18);
    for (const item of ALL_HELD_GEMS) {
      const type = item.slice(0, -3);
      const attack = { ...move, type };
      const user = pokemon("user", "player", { types: [type], heldItem: item,
        moves: [{ move: attack, pp: 20 }] });
      const target = pokemon("foe", "opponent");
      const base = calculateDamage("player", { ...user, heldItem: null }, target,
        attack, random, []);
      const boosted = calculateDamage("player", user, target, attack, random, []);
      expect(boosted, item).toBeGreaterThan(base);
      const result = resolveTeamTurn(createTeamBattleState({ player: [user], opponent: [target] }),
        { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, random);
      expect(result.state.teams.player.members[0]!.heldItem, item).toBeNull();
      expect(result.events, item).toContainEqual(expect.objectContaining({
        type: "heldItemConsumed", side: "player", item, effect: "boost" }));
    }
  });

  it("ignores a mismatched Gem and suppresses a matching one under item blockers", () => {
    const user = pokemon("user", "player", { heldItem: "FIREGEM" });
    expect(matchingHeldGem(user, "WATER", "000")).toBeNull();
    expect(matchingHeldGem(user, "FIRE", "000")).toBe("FIREGEM");
    expect(matchingHeldGem(user, "FIRE", "000", 2)).toBeNull();
    expect(matchingHeldGem({ ...user, ability: "KLUTZ" }, "FIRE", "000")).toBeNull();
    expect(matchingHeldGem({ ...user, volatile: { embargoTurns: 2 } }, "FIRE", "000"))
      .toBeNull();
    for (const pledge of ["106", "107", "108"]) {
      expect(matchingHeldGem(user, "FIRE", pledge)).toBeNull();
    }
  });

  it("consumes only the attacking Gem in Duo", () => {
    const fire = { ...move, type: "FIRE" };
    const attacker = pokemon("p1", "player", { heldItem: "FIREGEM",
      moves: [{ move: fire, pp: 20 }] });
    const ally = pokemon("p2", "player", { heldItem: "WATERGEM" });
    const state = createDoubleTeamBattleState({ player: [attacker, ally],
      opponent: [pokemon("o1", "opponent"), pokemon("o2", "opponent")] });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 1 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], random);
    expect(result.state.teams.player.members[0]!.heldItem).toBeNull();
    expect(result.state.teams.player.members[1]!.heldItem).toBe("WATERGEM");
    expect(result.state.teams.opponent.members[0]!.hp).toBe(300);
    expect(result.state.teams.opponent.members[1]!.hp).toBeLessThan(300);
  });
});
