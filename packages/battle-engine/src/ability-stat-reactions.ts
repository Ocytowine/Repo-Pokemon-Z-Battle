import type { BattleMove, BattleStat, BattlerState, ImplementedBattleAbility } from "./types.js";

export interface AbilityStatChange {
  readonly stat: BattleStat;
  readonly delta: number;
}

export interface ResolvedStatStageChange {
  readonly battler: BattlerState;
  readonly delta: number;
  readonly stage: number;
}

/**
 * Applies the source game's shared Contrary/Simple ordering before clamping.
 * `ignoreAbility` is reserved for a change imposed by an opposing Mold Breaker;
 * self changes must always keep the target's ability active.
 */
export function resolveStatStageChange(battler: BattlerState, stat: BattleStat, requestedDelta: number,
  ignoreAbility = false): ResolvedStatStageChange | null {
  const contrary = !ignoreAbility && battler.ability === "CONTRARY";
  const simple = !ignoreAbility && battler.ability === "SIMPLE";
  const effectiveDelta = requestedDelta * (contrary ? -1 : 1) * (simple ? 2 : 1);
  const current = battler.stages[stat];
  const stage = Math.max(-6, Math.min(6, current + effectiveDelta));
  if (stage === current) return null;
  return { battler: { ...battler, stages: { ...battler.stages, [stat]: stage } },
    delta: stage - current, stage };
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
  const resolved = resolveStatStageChange(battler, reaction.stat, reaction.delta);
  if (resolved === null) return null;
  return { battler: resolved.battler,
    ability: battler.ability as "COMPETITIVE" | "DEFIANT",
    change: { ...reaction, delta: resolved.delta, stage: resolved.stage } };
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
    case "CORAZAIRA": {
      const half = Math.floor(battler.stats.maxHp / 2);
      return hpBefore > half && hpAfter < half
        ? { ability: "CORAZAIRA", changes: [
          { stat: "specialAttack", delta: 1 }, { stat: "attack", delta: 1 },
        ], maximize: null } : null;
    }
    case "RATTLED":
      return move.type === "BUG" || move.type === "DARK" || move.type === "GHOST"
        ? { ability: "RATTLED", changes: [{ stat: "speed", delta: 1 }], maximize: null } : null;
    case "JUSTIFIED":
      return move.type === "DARK"
        ? { ability: "JUSTIFIED", changes: [{ stat: "attack", delta: 1 }], maximize: null } : null;
    case "TERMOCONVERSION":
      return move.type === "FIRE"
        ? { ability: "TERMOCONVERSION", changes: [{ stat: "attack", delta: 1 }], maximize: null } : null;
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
