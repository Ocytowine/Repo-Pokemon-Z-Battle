import { heldItemIsActive } from "./ability-item-control.js";
import type { BattleEvent, BattleSide, BattlerState } from "./types.js";

/** Resolve the Leech Seed recipient after the seeded battler has lost HP. */
export function resolveLeechSeedTransfer(receiver: BattlerState, receiverSide: BattleSide,
  seeded: BattlerState, seededSide: BattleSide, drained: number, magicRoomTurns = 0): {
  readonly battler: BattlerState; readonly events: readonly BattleEvent[];
} {
  if (receiver.hp <= 0 || drained <= 0) return { battler: receiver, events: [] };
  if (seeded.ability === "LIQUIDOOZE") {
    const amount = Math.min(receiver.hp, drained);
    const hp = receiver.hp - amount;
    return { battler: { ...receiver, hp }, events: [
      { type: "abilityActivated", side: seededSide, ability: "LIQUIDOOZE", effect: "damage-attacker" },
      { type: "abilityDamage", source: seededSide, target: receiverSide,
        ability: "LIQUIDOOZE", amount, hp },
      ...(hp === 0 ? [{ type: "fainted", side: receiverSide } as const] : []),
    ] };
  }
  if ((receiver.volatile?.healBlockTurns ?? 0) > 0) return { battler: receiver, events: [] };
  const raw = receiver.heldItem === "BIGROOT" && heldItemIsActive(receiver, magicRoomTurns)
    ? Math.floor(drained * 1.3) : drained;
  const amount = Math.min(raw, receiver.stats.maxHp - receiver.hp);
  if (amount <= 0) return { battler: receiver, events: [] };
  const hp = receiver.hp + amount;
  return { battler: { ...receiver, hp }, events: [
    { type: "hpRestored", side: receiverSide, source: "move", move: "LEECHSEED", amount, hp },
  ] };
}
