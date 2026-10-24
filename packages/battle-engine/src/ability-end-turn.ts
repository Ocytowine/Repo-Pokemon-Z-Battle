import { ordinaryWeather } from "./ability-weather.js";
import { resolveStatStageChange } from "./ability-stat-reactions.js";
import type { BattleEffects, BattleEvent, BattleSide, BattleTrace, BattlerState, RandomSource } from "./types.js";

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
  const amount = (battler.volatile?.healBlockTurns ?? 0) > 0 ? 0
    : Math.min(battler.stats.maxHp - battler.hp, Math.max(1, Math.floor(battler.stats.maxHp / 8)));
  const next = { ...battler, hp: battler.hp + amount, majorStatus: status };
  if (amount === 0) return { battler: next, events: [] };
  return { battler: next, events: [
    { type: "abilityActivated", side, ability: "POISONHEAL", effect: "status-heal" },
    { type: "hpRestored", side, source: "move", move: "POISONHEAL", amount, hp: next.hp },
  ] };
}

/** End-of-turn partner cure. The source consumes its roll even when no partner can be cured. */
export function resolveHealer(healer: BattlerState, partner: BattlerState | undefined, side: BattleSide,
  rng: RandomSource, trace: BattleTrace[]): {
    readonly partner: BattlerState | undefined; readonly events: readonly BattleEvent[];
  } {
  if (healer.hp <= 0 || healer.ability !== "HEALER") return { partner, events: [] };
  const value = rng.nextInt(10);
  trace.push({ type: "rng", purpose: "ability", maxExclusive: 10, value });
  if (value >= 3 || partner === undefined || partner.majorStatus === null) return { partner, events: [] };
  const status = partner.majorStatus.kind;
  return { partner: { ...partner, majorStatus: null }, events: [
    { type: "abilityActivated", side, ability: "HEALER", effect: "cure-status" },
    { type: "statusCured", side, status },
  ] };
}

export function resolveLateEndOfTurnAbilities(battler: BattlerState, side: BattleSide,
  opponents: readonly BattlerState[], rng: RandomSource = { nextInt: () => 0 }, trace: BattleTrace[] = []): {
    readonly battler: BattlerState; readonly events: readonly BattleEvent[] } {
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
  if (next.ability === "MOODY" && next.volatile?.enteredMidTurn !== true) {
    const stats = ["attack", "defense", "speed", "specialAttack", "specialDefense", "accuracy", "evasion"] as const;
    const raisable = stats.filter((stat) => next.stages[stat] < 6);
    let raised: typeof stats[number] | null = null;
    if (raisable.length > 0) {
      const value = rng.nextInt(raisable.length);
      trace.push({ type: "rng", purpose: "ability", maxExclusive: raisable.length, value });
      raised = raisable[value]!;
      const resolved = resolveStatStageChange(next, raised, 2);
      if (resolved !== null) {
        next = resolved.battler;
        events.push({ type: "statStageChanged", source: side, target: side, stat: raised,
          delta: resolved.delta, stage: resolved.stage });
      }
    }
    const lowerable = stats.filter((stat) => stat !== raised && next.stages[stat] > -6);
    if (lowerable.length > 0) {
      const value = rng.nextInt(lowerable.length);
      trace.push({ type: "rng", purpose: "ability", maxExclusive: lowerable.length, value });
      const lowered = lowerable[value]!;
      const resolved = resolveStatStageChange(next, lowered, -1);
      if (resolved !== null) {
        next = resolved.battler;
        events.push({ type: "statStageChanged", source: side, target: side, stat: lowered,
          delta: resolved.delta, stage: resolved.stage });
      }
    }
    if (events.some((event) => event.type === "statStageChanged")) {
      events.unshift({ type: "abilityActivated", side, ability: "MOODY", effect: "randomize-stats" });
    }
  }
  if (next.majorStatus?.kind === "sleep" && next.ability !== "MAGICGUARD") {
    const source = side === "player" ? "opponent" : "player";
    const nightmares = [
      { ability: "BADDREAMS" as const, divisor: 6 },
      { ability: "GRANPESADILLA" as const, divisor: 4 },
    ];
    for (const nightmare of nightmares) {
      if (next.hp <= 0 || !opponents.some((opponent) => opponent.hp > 0
        && opponent.ability === nightmare.ability)) continue;
      const amount = Math.min(next.hp, Math.max(1, Math.floor(next.stats.maxHp / nightmare.divisor)));
      next = { ...next, hp: next.hp - amount };
      events.push({ type: "abilityActivated", side: source, ability: nightmare.ability, effect: "status-damage" },
        { type: "abilityDamage", source, target: side, ability: nightmare.ability, amount, hp: next.hp });
    }
  }
  if (next.volatile?.enteredMidTurn === true) {
    next = { ...next, volatile: { ...next.volatile, enteredMidTurn: false } };
  }
  return { battler: next, events };
}
