import type { BattleEffects, BattleEvent, BattleSide, BattlerState } from "./types.js";
import { heldItemIsActive } from "./ability-item-control.js";

const ENTRY_WEATHER = {
  DRIZZLE: "rain", DROUGHT: "sun", SANDSTREAM: "sand", SNOWWARNING: "hail",
} as const;

const EXTREME_WEATHER = {
  PRIMORDIALSEA: "heavy-rain", DESOLATELAND: "harsh-sun", DELTASTREAM: "strong-winds",
} as const;

export type BattleWeather = NonNullable<BattleEffects["weather"]>;

export function ordinaryWeather(weather: BattleEffects["weather"]): "sun" | "rain" | "sand" | "hail" | null {
  if (weather === "heavy-rain") return "rain";
  if (weather === "harsh-sun") return "sun";
  return weather === "strong-winds" || weather === undefined ? null : weather;
}

export function hasWeatherSuppressor(battlers: readonly BattlerState[]): boolean {
  return battlers.some((battler) => battler.hp > 0 && (battler.ability === "AIRLOCK" || battler.ability === "CLOUDNINE"));
}

export function effectiveBattleWeather(weather: BattleEffects["weather"], battlers: readonly BattlerState[],
  suppressed = false): BattleEffects["weather"] {
  return suppressed || hasWeatherSuppressor(battlers) ? null : weather;
}

export function reconcileExtremeWeather(effects: BattleEffects | undefined,
  battlers: readonly BattlerState[]): BattleEffects | undefined {
  if (effects?.weather === "heavy-rain" && !battlers.some((battler) => battler.hp > 0 && battler.ability === "PRIMORDIALSEA")
    || effects?.weather === "harsh-sun" && !battlers.some((battler) => battler.hp > 0 && battler.ability === "DESOLATELAND")
    || effects?.weather === "strong-winds" && !battlers.some((battler) => battler.hp > 0 && battler.ability === "DELTASTREAM")) {
    return { ...effects, weather: null, weatherTurns: 0 };
  }
  return effects;
}

function effectsBase(effects: BattleEffects | undefined): BattleEffects {
  return effects ?? { sides: {
    player: { reflectTurns: 0, luckyChantTurns: 0 },
    opponent: { reflectTurns: 0, luckyChantTurns: 0 },
  }, waterSportTurns: 0 };
}

export function applyEntryWeatherAbility(battler: BattlerState, side: BattleSide,
  effects: BattleEffects | undefined): { readonly effects: BattleEffects | undefined; readonly events: readonly BattleEvent[] } {
  const ability = battler.ability as keyof typeof ENTRY_WEATHER;
  const extremeAbility = battler.ability as keyof typeof EXTREME_WEATHER;
  const extremeWeather = EXTREME_WEATHER[extremeAbility];
  if (extremeWeather !== undefined) return { effects: { ...effectsBase(effects), weather: extremeWeather, weatherTurns: -1 }, events: [
    { type: "abilityActivated", side, ability: extremeAbility, effect: "set-weather" },
    { type: "battleEffectChanged", side: null, effect: "weather", turns: -1 },
  ] };
  const weather = ENTRY_WEATHER[ability];
  if (weather === undefined) return { effects, events: [] };
  if (effects?.weather === "heavy-rain" || effects?.weather === "harsh-sun" || effects?.weather === "strong-winds") {
    return { effects, events: [] };
  }
  return { effects: { ...effectsBase(effects), weather, weatherTurns: 5 }, events: [
    { type: "abilityActivated", side, ability, effect: "set-weather" },
    { type: "battleEffectChanged", side: null, effect: "weather", turns: 5 },
  ] };
}

export function weatherSpeedMultiplier(battler: BattlerState, weather: BattleEffects["weather"]): number {
  const current = ordinaryWeather(weather);
  return battler.ability === "CHLOROPHYLL" && current === "sun"
    || battler.ability === "SWIFTSWIM" && current === "rain"
    || battler.ability === "SANDRUSH" && current === "sand"
    || battler.ability === "SLUSHRUSH" && current === "hail"
    || battler.ability === "PODERGELIDO" && current === "hail" ? 2 : 1;
}

export function weatherEvasionMultiplier(battler: BattlerState, weather: BattleEffects["weather"]): number {
  const current = ordinaryWeather(weather);
  return battler.ability === "SANDVEIL" && current === "sand"
    || battler.ability === "SNOWCLOAK" && current === "hail" ? 1.25 : 1;
}

export function resolveWeatherEndOfTurn(battler: BattlerState, side: BattleSide,
  weather: BattleEffects["weather"], magicRoomTurns = 0): { readonly battler: BattlerState; readonly events: readonly BattleEvent[] } {
  if (battler.hp <= 0 || weather === null || weather === undefined) return { battler, events: [] };
  weather = ordinaryWeather(weather);
  if (weather === null) return { battler, events: [] };
  const events: BattleEvent[] = [];
  let next = battler;
  const heal = (ability: "RAINDISH" | "DRYSKIN" | "ICEBODY", divisor: number): void => {
    const amount = Math.min(next.stats.maxHp - next.hp, Math.max(1, Math.floor(next.stats.maxHp / divisor)));
    if (amount <= 0) return;
    next = { ...next, hp: next.hp + amount };
    events.push({ type: "abilityActivated", side, ability, effect: "weather-heal" },
      { type: "hpRestored", side, source: "move", move: ability, amount, hp: next.hp });
  };
  const damage = (ability: "SOLARPOWER" | "DRYSKIN", divisor: number): void => {
    const amount = Math.min(next.hp, Math.max(1, Math.floor(next.stats.maxHp / divisor)));
    next = { ...next, hp: next.hp - amount };
    events.push({ type: "abilityActivated", side, ability, effect: "weather-damage" },
      { type: "abilityDamage", source: side, target: side, ability, amount, hp: next.hp });
  };
  if (weather === "rain" && next.ability === "RAINDISH") heal("RAINDISH", 16);
  else if (weather === "rain" && next.ability === "DRYSKIN") heal("DRYSKIN", 8);
  else if (weather === "hail" && next.ability === "ICEBODY") heal("ICEBODY", 16);
  else if (weather === "sun" && next.ability === "SOLARPOWER") damage("SOLARPOWER", 8);
  else if (weather === "sun" && next.ability === "DRYSKIN") damage("DRYSKIN", 8);
  if (weather === "sand" && next.hp > 0 && !next.types.some((type) => ["GROUND", "ROCK", "STEEL"].includes(type))
    && !["SANDVEIL", "SANDRUSH", "SANDFORCE", "MAGICGUARD", "OVERCOAT"].includes(next.ability ?? "")
    && !(heldItemIsActive(next, magicRoomTurns) && next.heldItem === "SAFETYGOGGLES")) {
    const amount = Math.min(next.hp, Math.max(1, Math.floor(next.stats.maxHp / 16)));
    next = { ...next, hp: next.hp - amount };
    events.push({ type: "weatherDamage", side, weather: "sand", amount, hp: next.hp });
  }
  return { battler: next, events };
}
