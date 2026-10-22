import { isKnownType } from "./type-chart.js";
import type { BattleStat, BattlerState, ImplementedBattleAbility } from "./types.js";

export function colorChangeType(battler: BattlerState, moveType: string): string | null {
  if (battler.hp <= 0 || battler.ability !== "COLORCHANGE" || !isKnownType(moveType) || moveType === "QMARKS"
    || battler.types.includes(moveType)) return null;
  return moveType;
}

export function knockoutAbilityStatReaction(battler: BattlerState): {
  readonly ability: ImplementedBattleAbility;
  readonly stat: BattleStat;
  readonly delta: 1;
} | null {
  if (battler.hp <= 0) return null;
  if (battler.ability === "MOXIE") return { ability: "MOXIE", stat: "attack", delta: 1 };
  if (battler.ability === "GRIMNEIGH") return { ability: "GRIMNEIGH", stat: "specialAttack", delta: 1 };
  return null;
}
