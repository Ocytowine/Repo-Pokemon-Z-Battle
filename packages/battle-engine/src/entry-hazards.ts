import { heldItemIsActive } from "./ability-item-control.js";
import { isGrounded } from "./ability-field-entry.js";
import { statDropProtectionAbility, statusProtectionAbility } from "./ability-protection.js";
import { applyOpposingStatDropReaction, resolveStatStageChange } from "./ability-stat-reactions.js";
import { typeEffectiveness } from "./type-chart.js";
import type { BattleEffects, BattleEvent, BattleSide, BattlerState } from "./types.js";

const otherSide = (side: BattleSide): BattleSide => side === "player" ? "opponent" : "player";

/** Authoritative entry effects shared by single, double, host and guest snapshots. */
export function applyEntryHazards(battler: BattlerState, side: BattleSide,
  effects: BattleEffects | undefined): { battler: BattlerState; effects: BattleEffects | undefined;
    events: readonly BattleEvent[] } {
  if (effects === undefined || battler.hp <= 0
    || heldItemIsActive(battler, effects.magicRoomTurns) && battler.heldItem === "HEAVYDUTYBOOTS") {
    return { battler, effects, events: [] };
  }
  const hazards = effects.sides[side];
  const events: BattleEvent[] = [];
  let next = battler;
  const grounded = isGrounded(next, effects);
  const hurt = (hazard: "spikes" | "stealth-rock", raw: number): void => {
    if (next.ability === "MAGICGUARD" || next.hp <= 0) return;
    const amount = Math.min(next.hp, Math.max(1, Math.floor(raw)));
    next = { ...next, hp: next.hp - amount };
    events.push({ type: "entryHazardDamage", side, hazard, amount, hp: next.hp });
    if (next.hp === 0) events.push({ type: "fainted", side });
  };
  if (grounded && (hazards.spikesLayers ?? 0) > 0) {
    const divisor = hazards.spikesLayers === 1 ? 8 : hazards.spikesLayers === 2 ? 6 : 4;
    hurt("spikes", next.stats.maxHp / divisor);
  }
  if (hazards.stealthRock && next.hp > 0) {
    hurt("stealth-rock", next.stats.maxHp * typeEffectiveness("ROCK", next.types) / 8);
  }
  if (grounded && next.hp > 0 && hazards.stickyWeb) {
    const protection = next.ability === "CONTRARY" ? null : statDropProtectionAbility(next, "speed");
    if (protection !== null) events.push({ type: "abilityActivated", side,
      ability: protection, effect: "prevent-stat-drop" });
    else {
      const change = resolveStatStageChange(next, "speed", -1);
      if (change !== null) {
        next = change.battler;
        events.push({ type: "statStageChanged", source: otherSide(side), target: side,
          stat: "speed", delta: change.delta, stage: change.stage });
        if (change.delta < 0) {
          const reaction = applyOpposingStatDropReaction(next);
          if (reaction !== null) {
            next = reaction.battler;
            events.push({ type: "abilityActivated", side, ability: reaction.ability, effect: "raise-stat" },
              { type: "statStageChanged", source: side, target: side,
                stat: reaction.change.stat, delta: reaction.change.delta, stage: reaction.change.stage });
          }
        }
      }
    }
  }
  if (!grounded || next.hp <= 0 || (hazards.toxicSpikesLayers ?? 0) === 0) {
    return { battler: next, effects, events };
  }
  if (next.types.includes("POISON")) {
    const updated = { ...effects, sides: { ...effects.sides,
      [side]: { ...hazards, toxicSpikesLayers: 0 } } };
    events.push({ type: "battleEffectChanged", side, effect: "toxic-spikes", turns: 0 });
    return { battler: next, effects: updated, events };
  }
  if (next.majorStatus !== null || next.types.includes("STEEL")
    || (effects.terrain === "misty")
    || (hazards.safeguardTurns ?? 0) > 0
    || statusProtectionAbility(next, "poison") !== null) return { battler: next, effects, events };
  next = { ...next, majorStatus: { kind: "poison",
    toxicCounter: hazards.toxicSpikesLayers === 2 ? 0 : null } };
  events.push({ type: "statusApplied", source: otherSide(side), target: side, status: "poison" });
  return { battler: next, effects, events };
}
