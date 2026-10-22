import { resolveStatStageChange } from "./ability-stat-reactions.js";
import type { BattleEvent, BattleSide, BattlerState } from "./types.js";

type WindAbility = "WINDRIDER" | "WINDPOWER";

function raiseAttack(battler: BattlerState, source: BattleSide, events: BattleEvent[]): BattlerState {
  const resolved = resolveStatStageChange(battler, "attack", 1);
  if (resolved === null) {
    events.push({ type: "statStageChangeFailed", source, target: source, stat: "attack", reason: "limit" });
    return battler;
  }
  events.push({ type: "statStageChanged", source, target: source, stat: "attack",
    delta: resolved.delta, stage: resolved.stage });
  return resolved.battler;
}

function charge(battler: BattlerState): BattlerState {
  const volatile = battler.volatile ?? {
    confusionTurns: 0, flinched: false, focusEnergy: 0, identified: false,
    disabledMove: null, disableTurns: 0, encoreMove: null, encoreTurns: 0,
    bindingMove: null, bindingTurns: 0, cursed: false, lastMoveUsed: null,
  };
  return { ...battler, volatile: { ...volatile, chargeTurns: 2 } };
}

/**
 * Shared source-faithful reaction used both by a wind move target and by the
 * active allies swept by Tailwind. Wind Rider blocks only the targeted move;
 * the caller controls that distinction through the returned `blocked` flag.
 */
export function activateWindAbility(battler: BattlerState, side: BattleSide, blocksMove = false): {
  readonly battler: BattlerState;
  readonly ability: WindAbility | null;
  readonly blocked: boolean;
  readonly events: readonly BattleEvent[];
} {
  if (battler.ability === "WINDRIDER") {
    const events: BattleEvent[] = [
      { type: "abilityActivated", side, ability: "WINDRIDER", effect: blocksMove ? "block-move" : "boost-stat" },
    ];
    return { battler: raiseAttack(battler, side, events), ability: "WINDRIDER", blocked: blocksMove, events };
  }
  if (battler.ability === "WINDPOWER" && (battler.volatile?.chargeTurns ?? 0) === 0) {
    return { battler: charge(battler), ability: "WINDPOWER", blocked: false, events: [
      { type: "abilityActivated", side, ability: "WINDPOWER", effect: "charge" },
      { type: "volatileApplied", source: side, target: side, effect: "charge", turns: 2, move: null },
    ] };
  }
  return { battler, ability: null, blocked: false, events: [] };
}
