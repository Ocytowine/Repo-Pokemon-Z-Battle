import { ordinaryWeather } from "./ability-weather.js";
import type { BattleEffects, BattleEvent, BattleSide, BattlerState } from "./types.js";

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
  if (next.ability === "SPEEDBOOST" && next.volatile?.enteredMidTurn !== true && next.stages.speed < 6) {
    const stage = next.stages.speed + 1;
    next = { ...next, stages: { ...next.stages, speed: stage } };
    events.push({ type: "abilityActivated", side, ability: "SPEEDBOOST", effect: "raise-stat" },
      { type: "statStageChanged", source: side, target: side, stat: "speed", delta: 1, stage });
  }
  const badDreams = opponents.find((opponent) => opponent.hp > 0 && opponent.ability === "BADDREAMS");
  if (next.majorStatus?.kind === "sleep" && next.ability !== "MAGICGUARD" && badDreams !== undefined) {
    const amount = Math.min(next.hp, Math.max(1, Math.floor(next.stats.maxHp / 6)));
    next = { ...next, hp: next.hp - amount };
    const source = side === "player" ? "opponent" : "player";
    events.push({ type: "abilityActivated", side: source, ability: "BADDREAMS", effect: "weather-damage" },
      { type: "abilityDamage", source, target: side, ability: "BADDREAMS", amount, hp: next.hp });
  }
  return { battler: next, events };
}
