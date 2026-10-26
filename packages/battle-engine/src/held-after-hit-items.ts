import { heldItemIsActive } from "./ability-item-control.js";
import type { BattleEvent, BattleMove, BattleSide, BattlerState } from "./types.js";

/** Source pbEffectsAfterHit: total damage for the whole move, then Shell Bell before Life Orb. */
export function resolveAfterHitHeldItems(attacker: BattlerState, side: BattleSide,
  move: BattleMove, totalDamage: number, magicRoomTurns = 0): {
  readonly battler: BattlerState; readonly events: readonly BattleEvent[];
} {
  if (totalDamage <= 0 || attacker.hp <= 0
    || attacker.ability === "SHEERFORCE" && move.effectChance > 0
      && !["150", "912"].includes(move.functionCode)) return { battler: attacker, events: [] };
  let battler = attacker;
  const events: BattleEvent[] = [];
  if (battler.heldItem === "SHELLBELL" && heldItemIsActive(battler, magicRoomTurns)
    && (battler.volatile?.healBlockTurns ?? 0) === 0) {
    const amount = Math.min(battler.stats.maxHp - battler.hp, Math.floor(totalDamage / 5));
    if (amount > 0) {
      battler = { ...battler, hp: battler.hp + amount };
      events.push({ type: "itemActivated", side, item: "SHELLBELL", effect: "heal",
        amount, hp: battler.hp });
    }
  }
  if (battler.heldItem === "LIFEORB" && heldItemIsActive(battler, magicRoomTurns)
    && battler.ability !== "MAGICGUARD") {
    const amount = Math.min(battler.hp, Math.max(1, Math.floor(battler.stats.maxHp / 10)));
    battler = { ...battler, hp: battler.hp - amount };
    events.push({ type: "itemActivated", side, item: "LIFEORB", effect: "damage",
      amount, hp: battler.hp });
    if (battler.hp === 0) events.push({ type: "fainted", side });
  }
  return { battler, events };
}
