import { describe, expect, it } from "vitest";
import { calculateDamage, type BattleMove, type BattlerState, type RandomSource } from "../src/index.js";
import { PLATE_TYPES } from "../src/held-item-types.js";

const rng: RandomSource = { nextInt: (max) => max - 1 };
const move: BattleMove = { id: 1, internalName: "PLATETEST", name: "Test Plaque",
  functionCode: "000", power: 300, type: "NORMAL", category: "Special",
  accuracy: 100, pp: 20, priority: 0, effectChance: 0 };

function battler(id: string, types: readonly string[], heldItem: BattlerState["heldItem"] = null): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types,
    stats: { maxHp: 1000, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: 100 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 1000, majorStatus: null, ability: null, heldItem,
    moves: [{ move, pp: 20 }] };
}

describe("source Plate damage hooks", () => {
  it("applies the source's 25% boost for every matching Plate, including neutral Plate", () => {
    expect(Object.keys(PLATE_TYPES)).toHaveLength(18);
    const defender = battler("foe", ["WATER"]);
    for (const [item, type] of Object.entries(PLATE_TYPES)) {
      const attack = { ...move, type };
      const user = battler("user", ["NORMAL"], item as BattlerState["heldItem"]);
      const base = calculateDamage("player", { ...user, heldItem: null }, defender, attack, rng, []);
      const boosted = calculateDamage("player", user, defender, attack, rng, []);
      expect(boosted / base, item).toBeGreaterThan(1.23);
      expect(boosted / base, item).toBeLessThan(1.27);
      const otherType = type === "FIRE" ? "WATER" : "FIRE";
      expect(calculateDamage("player", user, defender, { ...move, type: otherType }, rng, []), item)
        .toBe(calculateDamage("player", { ...user, heldItem: null }, defender,
          { ...move, type: otherType }, rng, []));
    }
  });

  it("suspends Plate damage during item suppression", () => {
    const user = battler("user", ["NORMAL"], "FLAMEPLATE");
    const defender = battler("foe", ["WATER"]);
    const fire = { ...move, type: "FIRE" };
    const base = calculateDamage("player", { ...user, heldItem: null }, defender, fire, rng, []);
    expect(calculateDamage("player", { ...user, ability: "KLUTZ" }, defender, fire, rng, [])).toBe(base);
    expect(calculateDamage("player", { ...user, volatile: { embargoTurns: 2 } }, defender, fire, rng, [])).toBe(base);
    expect(calculateDamage("player", user, defender, fire, rng, [], { magicRoomTurns: 2 })).toBe(base);
  });
});
