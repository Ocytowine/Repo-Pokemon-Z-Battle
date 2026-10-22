import { ordinaryWeather } from "./ability-weather.js";
import { resolveStatStageChange } from "./ability-stat-reactions.js";
import type { BattleEffects, BattleEvent, BattleSide, BattlerState } from "./types.js";

export function markEnteredMidTurn(battler: BattlerState): BattlerState {
  return { ...battler, volatile: {
    confusionTurns: 0, flinched: false, focusEnergy: 0, identified: false,
    disabledMove: null, disableTurns: 0, encoreMove: null, encoreTurns: 0,
    bindingMove: null, bindingTurns: 0, cursed: false, lastMoveUsed: null,
    ...(battler.volatile ?? {}), enteredMidTurn: true,
  } };
}

export function sleepDurationForAbility(battler: BattlerState, duration: number): number {
  return battler.ability === "EARLYBIRD" ? Math.max(1, Math.floor(duration / 2)) : duration;
}

export function resolveHydration(battler: BattlerState, side: BattleSide,
  weather: BattleEffects["weather"]): { readonly battler: BattlerState; readonly events: readonly BattleEvent[] } {
  if (battler.hp <= 0 || battler.majorStatus === null || battler.ability !== "HYDRATION"
    || ordinaryWeather(weather) !== "rain") return { battler, events: [] };
  return { battler: { ...battler, majorStatus: null }, events: [
    { type: "abilityActivated", side, ability: "HYDRATION", effect: "cure-status" },
    { type: "statusCured", side, status: battler.majorStatus.kind },
  ] };
}

export function resolvePoisonHeal(battler: BattlerState, side: BattleSide): {
  readonly battler: BattlerState; readonly events: readonly BattleEvent[];
} | null {
  if (battler.hp <= 0 || battler.ability !== "POISONHEAL" || battler.majorStatus?.kind !== "poison") return null;
  const status = battler.majorStatus.toxicCounter === null ? battler.majorStatus
    : { kind: "poison" as const, toxicCounter: Math.min(15, battler.majorStatus.toxicCounter + 1) };
  const amount = Math.min(battler.stats.maxHp - battler.hp, Math.max(1, Math.floor(battler.stats.maxHp / 8)));
  const next = { ...battler, hp: battler.hp + amount, majorStatus: status };
  if (amount === 0) return { battler: next, events: [] };
  return { battler: next, events: [
    { type: "abilityActivated", side, ability: "POISONHEAL", effect: "status-heal" },
    { type: "hpRestored", side, source: "move", move: "POISONHEAL", amount, hp: next.hp },
  ] };
}

export function resolveLateEndOfTurnAbilities(battler: BattlerState, side: BattleSide,
  opponents: readonly BattlerState[]): { readonly battler: BattlerState; readonly events: readonly BattleEvent[] } {
  if (battler.hp <= 0) return { battler, events: [] };
  const events: BattleEvent[] = [];
  let next = battler;
  if (next.ability === "SPEEDBOOST" && next.volatile?.enteredMidTurn !== true) {
    const resolved = resolveStatStageChange(next, "speed", 1);
    if (resolved !== null) {
      next = resolved.battler;
    events.push({ type: "abilityActivated", side, ability: "SPEEDBOOST", effect: "raise-stat" },
        { type: "statStageChanged", source: side, target: side, stat: "speed",
          delta: resolved.delta, stage: resolved.stage });
    }
  }
  const badDreams = opponents.find((opponent) => opponent.hp > 0 && opponent.ability === "BADDREAMS");
  if (next.majorStatus?.kind === "sleep" && next.ability !== "MAGICGUARD" && badDreams !== undefined) {
    const amount = Math.min(next.hp, Math.max(1, Math.floor(next.stats.maxHp / 6)));
    next = { ...next, hp: next.hp - amount };
    const source = side === "player" ? "opponent" : "player";
    events.push({ type: "abilityActivated", side: source, ability: "BADDREAMS", effect: "status-damage" },
      { type: "abilityDamage", source, target: side, ability: "BADDREAMS", amount, hp: next.hp });
  }
  if (next.volatile?.enteredMidTurn === true) {
    next = { ...next, volatile: { ...next.volatile, enteredMidTurn: false } };
  }
  return { battler: next, events };
}
