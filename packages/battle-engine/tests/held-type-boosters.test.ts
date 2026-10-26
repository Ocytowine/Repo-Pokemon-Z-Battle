import { describe, expect, it } from "vitest";
import { calculateDamage, MINIMAL_MOVE_CATALOG, type BattleMove, type BattleTrace,
  type BattlerState } from "../src/index.js";

function battler(item: string | null, ability: BattlerState["ability"] = null): BattlerState {
  return {
    id: "attacker", species: "EEVEE", name: "Attacker", level: 50, types: ["NORMAL"],
    stats: { maxHp: 200, attack: 120, defense: 100, specialAttack: 120, specialDefense: 100, speed: 100 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    hp: 200, majorStatus: null, ability, heldItem: item, moves: [],
  };
}

function modifier(item: string | null, type: string, options: { ability?: BattlerState["ability"];
  magicRoomTurns?: number; embargoTurns?: number } = {}): number {
  const trace: BattleTrace[] = [];
  const move: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, type, power: 80 };
  const base = battler(item, options.ability);
  const attacker: BattlerState = options.embargoTurns === undefined ? base : { ...base,
    volatile: { confusionTurns: 0, flinched: false, focusEnergy: 0, identified: false,
      disabledMove: null, disableTurns: 0, encoreMove: null, encoreTurns: 0,
      bindingMove: null, bindingTurns: 0, cursed: false, lastMoveUsed: null,
      embargoTurns: options.embargoTurns } };
  const defender = { ...battler(null), id: "defender", species: "MEOWTH", name: "Defender" };
  calculateDamage("player", attacker, defender, move, { nextInt: (maximum) => maximum - 1 }, trace,
    { reflect: false, lightScreen: false, luckyChant: false, mudSport: false, waterSport: false,
      ...(options.magicRoomTurns === undefined ? {} : { magicRoomTurns: options.magicRoomTurns }) });
  return (trace.find((entry) => entry.type === "damage") as Extract<BattleTrace, { type: "damage" }>).statusModifier;
}

describe("source held type boosters", () => {
  it("boosts only the effective move type, including Pokemon Z's Tela", () => {
    expect(modifier("CHARCOAL", "FIRE")).toBe(1.2);
    expect(modifier("CHARCOAL", "WATER")).toBe(1);
    expect(modifier("Tela", "FAIRY")).toBe(1.2);
    expect(modifier("BLACKGLASSES", "DARK")).toBe(1.2);
  });

  it("respects shared held-item suppression and keeps the item equipped", () => {
    expect(modifier("CHARCOAL", "FIRE", { ability: "KLUTZ" })).toBe(1);
    expect(modifier("CHARCOAL", "FIRE", { magicRoomTurns: 2 })).toBe(1);
    expect(modifier("CHARCOAL", "FIRE", { embargoTurns: 2 })).toBe(1);
    expect(battler("CHARCOAL").heldItem).toBe("CHARCOAL");
  });
});
