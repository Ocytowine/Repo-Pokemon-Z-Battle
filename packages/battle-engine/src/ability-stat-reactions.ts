import type { BattleMove, BattleStat, BattlerState, ImplementedBattleAbility } from "./types.js";

export interface AbilityStatChange {
  readonly stat: BattleStat;
  readonly delta: number;
}

export interface DamageAbilityStatReaction {
  readonly ability: ImplementedBattleAbility;
  readonly changes: readonly AbilityStatChange[];
  readonly maximize: BattleStat | null;
}

export function opposingStatDropReaction(battler: BattlerState): AbilityStatChange | null {
  if (battler.ability === "DEFIANT") return { stat: "attack", delta: 2 };
  if (battler.ability === "COMPETITIVE") return { stat: "specialAttack", delta: 2 };
  return null;
}

export function applyOpposingStatDropReaction(battler: BattlerState): {
  readonly battler: BattlerState;
  readonly ability: "COMPETITIVE" | "DEFIANT";
  readonly change: AbilityStatChange & { readonly stage: number };
} | null {
  const reaction = opposingStatDropReaction(battler);
  if (reaction === null) return null;
  const current = battler.stages[reaction.stat];
  const stage = Math.min(6, current + reaction.delta);
  if (stage === current) return null;
  return { battler: { ...battler, stages: { ...battler.stages, [reaction.stat]: stage } },
    ability: battler.ability as "COMPETITIVE" | "DEFIANT",
    change: { ...reaction, delta: stage - current, stage } };
}

export function damageAbilityStatReaction(
  battler: BattlerState,
  move: BattleMove,
  hpBefore: number,
  hpAfter: number,
  critical: boolean,
): DamageAbilityStatReaction | null {
  if (hpAfter >= hpBefore || hpAfter <= 0) return null;
  switch (battler.ability) {
    case "STAMINA":
      return { ability: "STAMINA", changes: [{ stat: "defense", delta: 1 }], maximize: null };
    case "WATERCOMPACTION":
      return move.type === "WATER"
        ? { ability: "WATERCOMPACTION", changes: [{ stat: "defense", delta: 2 }], maximize: null } : null;
    case "BERSERK": {
      const half = Math.floor(battler.stats.maxHp / 2);
      return hpBefore > half && hpAfter < half
        ? { ability: "BERSERK", changes: [{ stat: "specialAttack", delta: 1 }], maximize: null } : null;
    }
    case "RATTLED":
      return move.type === "BUG" || move.type === "DARK" || move.type === "GHOST"
        ? { ability: "RATTLED", changes: [{ stat: "speed", delta: 1 }], maximize: null } : null;
    case "WEAKARMOR":
      return move.category === "Physical" ? { ability: "WEAKARMOR", changes: [
        { stat: "defense", delta: -1 }, { stat: "speed", delta: 1 },
      ], maximize: null } : null;
    case "STEAMENGINE":
      return move.type === "WATER" || move.type === "FIRE"
        ? { ability: "STEAMENGINE", changes: [{ stat: "speed", delta: 6 }], maximize: null } : null;
    case "ANGERPOINT":
      return critical ? { ability: "ANGERPOINT", changes: [], maximize: "attack" } : null;
    default:
      return null;
  }
}
