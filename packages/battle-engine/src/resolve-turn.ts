import { calculateDamage } from "./damage.js";
import { damageAbilityStatReaction, opposingStatDropReaction } from "./ability-stat-reactions.js";
import { cureStatusBlockedByAbility, statDropProtectionAbility, statusProtectionAbility } from "./ability-protection.js";
import { recoilDivisor } from "./move-properties.js";
import { effectiveBattleWeather, ordinaryWeather, resolveWeatherEndOfTurn, weatherEvasionMultiplier,
  weatherSpeedMultiplier } from "./ability-weather.js";
import { isKnownType } from "./type-chart.js";
import { effectiveMoveType, hasMoldBreaker, hasMoveFlag } from "./move-properties.js";
import { transformBattler } from "./battle-transform.js";
import type { BattleEffects, BattleEvent, BattleMove, BattleSide, BattleState, BattleStat, BattleTrace, BattlerState, ImplementedBattleAbility, MajorStatusState, MoveAction, RandomSource, TurnActions, TurnResult } from "./types.js";

const SIDES = ["player", "opponent"] as const;

function opponentOf(side: BattleSide): BattleSide {
  return side === "player" ? "opponent" : "player";
}

function cloneBattler(battler: BattlerState): BattlerState {
  return { ...battler, types: [...battler.types], stats: { ...battler.stats }, stages: { ...battler.stages }, majorStatus: battler.majorStatus === null ? null : { ...battler.majorStatus },
    ...(battler.volatile === undefined ? {} : { volatile: { ...battler.volatile } }),
    moves: battler.moves.map((slot) => ({ ...slot, move: { ...slot.move } })) };
}

type BattleVolatile = Required<NonNullable<BattlerState["volatile"]>>;
type MutableBattleEffects = {
  sides: Record<BattleSide, { reflectTurns: number; lightScreenTurns: number; luckyChantTurns: number;
    spikesLayers: number; toxicSpikesLayers: number; stealthRock: boolean; stickyWeb: boolean;
    mistTurns: number; safeguardTurns: number }>;
  mudSportTurns: number;
  waterSportTurns: number;
  itemTransfers: { item: NonNullable<BattlerState["heldItem"]>; sourceId: string;
    targetId: string; reason: "pickpocket" }[];
  terrain: "electric" | "grassy" | "misty" | "psychic" | null;
  terrainTurns: number;
  weather: NonNullable<BattleEffects["weather"]> | null;
  weatherTurns: number;
  environment: NonNullable<BattleEffects["environment"]>;
};

function volatileOf(battler: BattlerState): BattleVolatile {
  const neutral = { confusionTurns: 0, flinched: false, focusEnergy: 0, identified: false,
    disabledMove: null, disableTurns: 0, encoreMove: null, encoreTurns: 0,
    bindingMove: null, bindingTurns: 0, cursed: false, lastMoveUsed: null,
    activeTurns: 0, protected: false, endured: false, protectRate: 1, tauntTurns: 0, rage: false,
    flashFire: false, entryAbilityResolved: false, traceOriginalAbility: null,
    leechSeededBy: null, leechSeededBySlot: null, chargeTurns: 0, yawnTurns: 0, infatuated: false,
    furyCutterCount: 0, rolloutTurns: 0, uproarTurns: 0, embargoTurns: 0 };
  return { ...neutral, ...(battler.volatile ?? {}) };
}

function effectsOf(effects: BattleEffects | undefined): MutableBattleEffects {
  return effects === undefined ? { sides: {
    player: { reflectTurns: 0, lightScreenTurns: 0, luckyChantTurns: 0, spikesLayers: 0,
      toxicSpikesLayers: 0, stealthRock: false, stickyWeb: false, mistTurns: 0, safeguardTurns: 0 },
    opponent: { reflectTurns: 0, lightScreenTurns: 0, luckyChantTurns: 0, spikesLayers: 0,
      toxicSpikesLayers: 0, stealthRock: false, stickyWeb: false, mistTurns: 0, safeguardTurns: 0 },
  }, mudSportTurns: 0, waterSportTurns: 0, itemTransfers: [], terrain: null, terrainTurns: 0,
  weather: null, weatherTurns: 0, environment: "none" } : { sides: {
    player: { ...effects.sides.player, lightScreenTurns: effects.sides.player.lightScreenTurns ?? 0,
      spikesLayers: effects.sides.player.spikesLayers ?? 0,
      toxicSpikesLayers: effects.sides.player.toxicSpikesLayers ?? 0,
      stealthRock: effects.sides.player.stealthRock ?? false,
      stickyWeb: effects.sides.player.stickyWeb ?? false,
      mistTurns: effects.sides.player.mistTurns ?? 0,
      safeguardTurns: effects.sides.player.safeguardTurns ?? 0 },
    opponent: { ...effects.sides.opponent, lightScreenTurns: effects.sides.opponent.lightScreenTurns ?? 0,
      spikesLayers: effects.sides.opponent.spikesLayers ?? 0,
      toxicSpikesLayers: effects.sides.opponent.toxicSpikesLayers ?? 0,
      stealthRock: effects.sides.opponent.stealthRock ?? false,
      stickyWeb: effects.sides.opponent.stickyWeb ?? false,
      mistTurns: effects.sides.opponent.mistTurns ?? 0,
      safeguardTurns: effects.sides.opponent.safeguardTurns ?? 0 },
  }, mudSportTurns: effects.mudSportTurns ?? 0, waterSportTurns: effects.waterSportTurns,
  itemTransfers: [...(effects.itemTransfers ?? [])],
  terrain: effects.terrain ?? null, terrainTurns: effects.terrainTurns ?? 0,
  weather: effects.weather ?? null, weatherTurns: effects.weatherTurns ?? 0,
  environment: effects.environment ?? "none" };
}

function withVolatile(battler: BattlerState, volatile: BattleVolatile): BattlerState {
  return { ...battler, volatile };
}

function effectiveSpeed(battler: BattlerState): number {
  const stage = battler.stages.speed;
  const staged = stage >= 0
    ? Math.floor((battler.stats.speed * (2 + stage)) / 2)
    : Math.floor((battler.stats.speed * 2) / (2 - stage));
  if (battler.ability === "QUICKFEET" && battler.majorStatus !== null) return Math.max(1, Math.round(staged * 1.5));
  if (battler.ability === "ACOMETIDA" && (battler.volatile?.activeTurns ?? 0) === 0) return Math.max(1, Math.round(staged * 1.5));
  return battler.majorStatus?.kind === "paralysis" ? Math.max(1, Math.round(staged / 4)) : staged;
}

type RngPurpose = Extract<BattleTrace, { readonly type: "rng" }>["purpose"];

function draw(rng: RandomSource, trace: BattleTrace[], purpose: RngPurpose, maxExclusive: number): number {
  const value = rng.nextInt(maxExclusive);
  trace.push({ type: "rng", purpose, maxExclusive, value });
  return value;
}

function accuracyFactor(stage: number): number {
  return stage >= 0 ? (stage + 3) / 3 : 3 / (3 - stage);
}

type SelectedMoveActions = Readonly<Partial<Record<BattleSide, MoveAction>>>;

function statusKind(move: BattleMove): MajorStatusState["kind"] | null {
  if (move.functionCode === "003") return "sleep";
  if (move.functionCode === "005" || move.functionCode === "006" || move.functionCode === "0BE") return "poison";
  if (move.functionCode === "007" || move.functionCode === "008" || move.functionCode === "009") return "paralysis";
  if (move.functionCode === "00A") return "burn";
  if (move.functionCode === "00C") return "frozen";
  if (move.functionCode === "0FD") return "paralysis";
  if (move.functionCode === "0FE") return "burn";
  if (move.functionCode === "159") return "caduco";
  if (move.functionCode === "906") return "hemorrhage";
  return null;
}

interface StatChangeEffect {
  readonly target: "self" | "opponent";
  readonly stat: BattleStat;
  readonly delta: number;
}

function applySelfStatChanges(source: BattleSide, changes: readonly { readonly stat: BattleStat; readonly delta: 1 | 2 }[],
  battlers: Record<BattleSide, BattlerState>, events: BattleEvent[]): void {
  for (const change of changes) applyStatChange(source, opponentOf(source),
    { target: "self", stat: change.stat, delta: change.delta }, battlers, events);
}

function statChangeEffect(move: BattleMove): StatChangeEffect | null {
  switch (move.functionCode) {
    case "01C": return { target: "self", stat: "attack", delta: 1 };
    case "01D": return { target: "self", stat: "defense", delta: 1 };
    case "01E": return { target: "self", stat: "defense", delta: 1 };
    case "01F": return { target: "self", stat: "speed", delta: 1 };
    case "022": return { target: "self", stat: "evasion", delta: 1 };
    case "020": return { target: "self", stat: "specialAttack", delta: 1 };
    case "02F": return { target: "self", stat: "defense", delta: 2 };
    case "030": return { target: "self", stat: "speed", delta: 2 };
    case "033": return { target: "self", stat: "specialDefense", delta: 2 };
    case "034": return { target: "self", stat: "evasion", delta: 2 };
    case "042": return { target: "opponent", stat: "attack", delta: -1 };
    case "043": return { target: "opponent", stat: "defense", delta: -1 };
    case "044": return { target: "opponent", stat: "speed", delta: -1 };
    case "045": return { target: "opponent", stat: "specialAttack", delta: -1 };
    case "046": return { target: "opponent", stat: "specialDefense", delta: -1 };
    case "047": return { target: "opponent", stat: "accuracy", delta: -1 };
    case "048": return { target: "opponent", stat: "evasion", delta: -2 };
    case "04B": return { target: "opponent", stat: "attack", delta: -2 };
    case "04C": return { target: "opponent", stat: "defense", delta: -2 };
    case "04D": return { target: "opponent", stat: "speed", delta: -2 };
    case "04F": return { target: "opponent", stat: "specialDefense", delta: -2 };
    default: return null;
  }
}

function applyStatChange(
  source: BattleSide,
  opponent: BattleSide,
  effect: StatChangeEffect,
  battlers: Record<BattleSide, BattlerState>,
  events: BattleEvent[],
): boolean {
  const target = effect.target === "self" ? source : opponent;
  const battler = battlers[target];
  const preventingAbility = effect.delta < 0 && target !== source
    ? statDropProtectionAbility(battler, effect.stat) : null;
  if (preventingAbility !== null) {
    events.push({ type: "abilityActivated", side: target, ability: preventingAbility, effect: "prevent-stat-drop" });
    return false;
  }
  const current = battler.stages[effect.stat];
  const delta = battler.ability === "SIMPLE" ? effect.delta * 2 : effect.delta;
  const stage = Math.max(-6, Math.min(6, current + delta));
  if (stage === current) {
    events.push({ type: "statStageChangeFailed", source, target, stat: effect.stat, reason: "limit" });
    return false;
  }
  battlers[target] = { ...battler, stages: { ...battler.stages, [effect.stat]: stage } };
  events.push({ type: "statStageChanged", source, target, stat: effect.stat, delta: stage - current, stage });
  if (effect.delta < 0 && target !== source) {
    const reaction = opposingStatDropReaction(battlers[target]);
    if (reaction !== null) {
      const reactionStart = events.length;
      if (applyStatChange(target, source, { target: "self", ...reaction }, battlers, events)) {
        events.splice(reactionStart, 0, { type: "abilityActivated", side: target,
          ability: battlers[target].ability as "COMPETITIVE" | "DEFIANT", effect: "raise-stat" });
      }
    }
  }
  return true;
}

function applyDamageAbilityStatReaction(
  target: BattleSide,
  source: BattleSide,
  move: BattleMove,
  hit: { readonly hpBefore: number; readonly hpAfter: number; readonly critical: boolean },
  battlers: Record<BattleSide, BattlerState>,
  events: BattleEvent[],
): void {
  const reaction = damageAbilityStatReaction(battlers[target], move, hit.hpBefore, hit.hpAfter, hit.critical);
  if (reaction === null) return;
  const reactionStart = events.length;
  let changed = false;
  for (const change of reaction.changes) {
    changed = applyStatChange(target, source, { target: "self", ...change }, battlers, events) || changed;
  }
  if (reaction.maximize !== null) {
    const battler = battlers[target];
    const current = battler.stages[reaction.maximize];
    if (current < 6) {
      battlers[target] = { ...battler, stages: { ...battler.stages, [reaction.maximize]: 6 } };
      events.push({ type: "statStageChanged", source: target, target, stat: reaction.maximize,
        delta: 6 - current, stage: 6 });
      changed = true;
    }
  }
  if (changed) events.splice(reactionStart, 0, { type: "abilityActivated", side: target,
    ability: reaction.ability, effect: "raise-stat" });
}

function applyTypeAbsorption(source: BattleSide, target: BattleSide, move: BattleMove,
  battlers: Record<BattleSide, BattlerState>, events: BattleEvent[]): boolean {
  if (source === target) return false;
  const attacker = battlers[source];
  const defender = battlers[target];
  if (hasMoldBreaker(attacker)) return false;
  const moveType = effectiveMoveType(attacker, move).type;
  const ability = defender.ability;
  const heals = (ability === "DRYSKIN" || ability === "WATERABSORB") && moveType === "WATER"
    || ability === "VOLTABSORB" && moveType === "ELECTRIC";
  const raisedStat = ability === "SAPSIPPER" && moveType === "GRASS" ? "attack"
    : (ability === "STORMDRAIN" && moveType === "WATER")
      || (ability === "LIGHTNINGROD" && moveType === "ELECTRIC") ? "specialAttack"
      : ability === "MOTORDRIVE" && moveType === "ELECTRIC" ? "speed" : null;
  const flashFire = ability === "FLASHFIRE" && moveType === "FIRE";
  const levitate = ability === "LEVITATE" && moveType === "GROUND" && move.category !== "Status";
  if (!heals && raisedStat === null && !flashFire && !levitate) return false;
  events.push({ type: "abilityActivated", side: target, ability: ability as ImplementedBattleAbility,
    effect: "absorb-type" });
  if (heals) {
    const amount = Math.min(defender.stats.maxHp - defender.hp, Math.max(1, Math.floor(defender.stats.maxHp / 4)));
    battlers[target] = { ...defender, hp: defender.hp + amount };
    if (amount > 0) events.push({ type: "hpRestored", side: target, source: "move",
      move: move.internalName, amount, hp: defender.hp + amount });
  } else if (raisedStat !== null) {
    applyStatChange(target, source, { target: "self", stat: raisedStat, delta: 1 }, battlers, events);
  } else if (flashFire) {
    battlers[target] = withVolatile(defender, { ...volatileOf(defender), flashFire: true });
  }
  return true;
}

function applyMoveEffect(
  source: BattleSide,
  target: BattleSide,
  move: BattleMove,
  battlers: Record<BattleSide, BattlerState>,
  rng: RandomSource,
  events: BattleEvent[],
  trace: BattleTrace[],
  effects: MutableBattleEffects,
  weather: BattleEffects["weather"] = effects.weather,
): void {
  if (move.functionCode === "021") {
    const attacker = battlers[source];
    battlers[source] = withVolatile(attacker, { ...volatileOf(attacker), chargeTurns: 2 });
    events.push({ type: "volatileApplied", source, target: source, effect: "charge", turns: 2,
      move: move.internalName });
    applyStatChange(source, target, { target: "self", stat: "specialDefense", delta: 1 }, battlers, events);
    return;
  }
  if (move.functionCode === "02D") {
    applySelfStatChanges(source, ["attack", "defense", "specialAttack", "specialDefense", "speed"]
      .map((stat) => ({ stat: stat as BattleStat, delta: 1 })), battlers, events);
    return;
  }
  if (move.functionCode === "010") {
    const defender = battlers[target];
    if (defender.ability !== "INNERFOCUS") {
      battlers[target] = withVolatile(defender, { ...volatileOf(defender), flinched: true });
      events.push({ type: "volatileApplied", source, target, effect: "flinch", turns: 1,
        move: move.internalName });
    }
    return;
  }
  if (move.functionCode === "064") {
    const defender = battlers[target];
    if (["DISGUISE", "INSOMNIA", "MULTITYPE", "STANCECHANGE", "TRUANT"].includes(defender.ability ?? "")) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    battlers[target] = { ...defender, ability: "INSOMNIA" };
    events.push({ type: "abilityChanged", source, target, ability: "INSOMNIA", move: move.internalName });
    return;
  }
  if (move.functionCode === "069") {
    const transformed = transformBattler(battlers[source], battlers[target]);
    if (transformed === null) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    battlers[source] = transformed;
    return;
  }
  if (move.functionCode === "0F8") {
    const defender = battlers[target];
    const current = volatileOf(defender);
    if (current.embargoTurns > 0) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    battlers[target] = withVolatile(defender, { ...current, embargoTurns: 5 });
    events.push({ type: "volatileApplied", source, target, effect: "embargo", turns: 5, move: move.internalName });
    return;
  }
  if (move.functionCode === "017") {
    const statuses = ["paralysis", "burn", "frozen"] as const;
    const kind = statuses[draw(rng, trace, "additional-effect", statuses.length)]!;
    const synthetic = { ...move, functionCode: kind === "paralysis" ? "007" as const
      : kind === "burn" ? "00A" as const : "00C" as const };
    applyStatusMove(source, target, synthetic, battlers, rng, events, trace, effects, weather);
    return;
  }
  const change = statChangeEffect(move);
  if (change !== null) {
    applyStatChange(source, target, change, battlers, events);
    return;
  }
  if (statusKind(move) !== null) {
    applyStatusMove(source, target, move, battlers, rng, events, trace, effects, weather);
    return;
  }
  if (move.functionCode === "013") {
    const defender = battlers[target];
    const current = volatileOf(defender);
    if (current.confusionTurns > 0) return;
    if (defender.ability === "OWNTEMPO") {
      events.push({ type: "abilityActivated", side: target, ability: "OWNTEMPO", effect: "prevent-confusion" });
      return;
    }
    const turns = 2 + draw(rng, trace, "confusion-duration", 4);
    battlers[target] = withVolatile(defender, { ...current, confusionTurns: turns });
    events.push({ type: "volatileApplied", source, target, effect: "confusion", turns, move: move.internalName });
    return;
  }
  if (move.functionCode === "001" || move.functionCode === "09C") {
    events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
    return;
  }
  if (move.functionCode === "004") {
    const defender = battlers[target];
    const current = volatileOf(defender);
    if (defender.majorStatus !== null || current.yawnTurns > 0) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    battlers[target] = withVolatile(defender, { ...current, yawnTurns: 2 });
    events.push({ type: "volatileApplied", source, target, effect: "yawn", turns: 2, move: move.internalName });
    return;
  }
  if (move.functionCode === "016") {
    const attackerGender = battlers[source].appearance?.gender;
    const defender = battlers[target];
    const defenderGender = defender.appearance?.gender;
    if ((attackerGender !== "male" && attackerGender !== "female")
      || (defenderGender !== "male" && defenderGender !== "female") || attackerGender === defenderGender) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    battlers[target] = withVolatile(defender, { ...volatileOf(defender), infatuated: true });
    events.push({ type: "volatileApplied", source, target, effect: "infatuation", turns: null, move: move.internalName });
    return;
  }
  if (move.functionCode === "00F" || move.functionCode === "012") {
    const defender = battlers[target];
    if (defender.ability === "INNERFOCUS") return;
    battlers[target] = withVolatile(defender, { ...volatileOf(defender), flinched: true });
    events.push({ type: "volatileApplied", source, target, effect: "flinch", turns: 1, move: move.internalName });
    return;
  }
  if (move.functionCode === "023") {
    const attacker = battlers[source];
    const current = volatileOf(attacker);
    battlers[source] = withVolatile(attacker, { ...current, focusEnergy: 2 });
    events.push({ type: "volatileApplied", source, target: source, effect: "focus-energy", turns: null, move: move.internalName });
    return;
  }
  if (move.functionCode === "049") {
    applyStatChange(source, target, { target: "opponent", stat: "evasion", delta: -1 }, battlers, events);
    for (const side of SIDES) {
      if (effects.sides[side].reflectTurns > 0) events.push({ type: "battleEffectChanged", side, effect: "reflect", turns: 0 });
      if (effects.sides[side].lightScreenTurns > 0) events.push({ type: "battleEffectChanged", side, effect: "light-screen", turns: 0 });
      const current = effects.sides[side];
      if (current.spikesLayers > 0) events.push({ type: "battleEffectChanged", side, effect: "spikes", turns: 0 });
      if (current.toxicSpikesLayers > 0) events.push({ type: "battleEffectChanged", side, effect: "toxic-spikes", turns: 0 });
      if (current.stealthRock) events.push({ type: "battleEffectChanged", side, effect: "stealth-rock", turns: 0 });
      if (current.stickyWeb) events.push({ type: "battleEffectChanged", side, effect: "sticky-web", turns: 0 });
      if (current.mistTurns > 0) events.push({ type: "battleEffectChanged", side, effect: "mist", turns: 0 });
      if (current.safeguardTurns > 0) events.push({ type: "battleEffectChanged", side, effect: "safeguard", turns: 0 });
      effects.sides[side] = { ...current, reflectTurns: 0, lightScreenTurns: 0, spikesLayers: 0,
        toxicSpikesLayers: 0, stealthRock: false, stickyWeb: false, mistTurns: 0, safeguardTurns: 0 };
    }
    if (effects.terrain !== null) events.push({ type: "battleEffectChanged", side: null, effect: "terrain", turns: 0 });
    effects.terrain = null;
    effects.terrainTurns = 0;
    return;
  }
  if (move.functionCode === "09E") {
    effects.waterSportTurns = 5;
    events.push({ type: "battleEffectChanged", side: null, effect: "water-sport", turns: 5 });
    return;
  }
  if (move.functionCode === "09D") {
    effects.mudSportTurns = 5;
    events.push({ type: "battleEffectChanged", side: null, effect: "mud-sport", turns: 5 });
    return;
  }
  if (move.functionCode === "0A1" || move.functionCode === "0A2" || move.functionCode === "0A3") {
    const key = move.functionCode === "0A1" ? "luckyChantTurns"
      : move.functionCode === "0A2" ? "reflectTurns" : "lightScreenTurns";
    effects.sides[source] = { ...effects.sides[source], [key]: 5 };
    events.push({ type: "battleEffectChanged", side: source,
      effect: move.functionCode === "0A1" ? "lucky-chant"
        : move.functionCode === "0A2" ? "reflect" : "light-screen", turns: 5 });
    return;
  }
  if (move.functionCode === "0AA" || move.functionCode === "0E8") {
    const attacker = battlers[source];
    const current = volatileOf(attacker);
    const protect = move.functionCode === "0AA";
    const rate = Math.max(1, current.protectRate);
    if (rate > 1 && draw(rng, trace, "protection", 65_536) >= Math.floor(65_536 / rate)) {
      battlers[source] = withVolatile(attacker, { ...current, protected: false, endured: false, protectRate: 1 });
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    battlers[source] = withVolatile(attacker, { ...current, protected: protect, endured: !protect,
      protectRate: Math.min(65_536, rate * 2) });
    events.push({ type: "volatileApplied", source, target: source,
      effect: protect ? "protect" : "endure", turns: 1, move: move.internalName });
    return;
  }
  if (move.functionCode === "0BA") {
    const defender = battlers[target];
    battlers[target] = withVolatile(defender, { ...volatileOf(defender), tauntTurns: 4 });
    events.push({ type: "volatileApplied", source, target, effect: "taunt", turns: 4, move: move.internalName });
    return;
  }
  if (move.functionCode === "0DC") {
    const defender = battlers[target];
    const current = volatileOf(defender);
    if (defender.types.includes("GRASS") || current.leechSeededBy !== null) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    battlers[target] = withVolatile(defender, { ...current, leechSeededBy: source });
    events.push({ type: "volatileApplied", source, target, effect: "leech-seed", turns: null, move: move.internalName });
    return;
  }
  if (move.functionCode === "10E") {
    const defender = battlers[target];
    const lastMove = volatileOf(defender).lastMoveUsed;
    const moveIndex = defender.moves.findIndex((candidate) => candidate.move.internalName === lastMove && candidate.pp > 0);
    if (moveIndex < 0) return;
    const slot = defender.moves[moveIndex]!;
    const amount = Math.min(4, slot.pp);
    battlers[target] = { ...defender, moves: defender.moves.map((candidate, index) => index === moveIndex
      ? { ...candidate, pp: candidate.pp - amount } : candidate) };
    events.push({ type: "ppReduced", source, target, move: slot.move.internalName, amount, pp: slot.pp - amount });
    return;
  }
  if (move.functionCode === "027" || move.functionCode === "028") {
    applySelfStatChanges(source, [{ stat: "attack", delta: 1 }, { stat: "specialAttack", delta: 1 }], battlers, events);
    return;
  }
  if (move.functionCode === "0A7") {
    const defender = battlers[target];
    battlers[target] = withVolatile(defender, { ...volatileOf(defender), identified: true });
    events.push({ type: "volatileApplied", source, target, effect: "identified", turns: null, move: move.internalName });
    return;
  }
  if (move.functionCode === "0B9") {
    const defender = battlers[target];
    const current = volatileOf(defender);
    if (current.disableTurns > 0 || current.lastMoveUsed === null) return;
    battlers[target] = withVolatile(defender, { ...current, disabledMove: current.lastMoveUsed, disableTurns: 5 });
    events.push({ type: "volatileApplied", source, target, effect: "disable", turns: 5, move: current.lastMoveUsed });
    return;
  }
  if (move.functionCode === "0BC") {
    const defender = battlers[target];
    const current = volatileOf(defender);
    if (current.encoreTurns > 0 || current.lastMoveUsed === null) return;
    battlers[target] = withVolatile(defender, { ...current, encoreMove: current.lastMoveUsed, encoreTurns: 4 });
    events.push({ type: "volatileApplied", source, target, effect: "encore", turns: 4, move: current.lastMoveUsed });
    return;
  }
  if (move.functionCode === "10D") {
    const attacker = battlers[source];
    if (attacker.types.includes("GHOST")) {
      const defender = battlers[target];
      const current = volatileOf(defender);
      if (current.cursed) return;
      const amount = Math.min(attacker.hp, Math.max(1, Math.floor(attacker.stats.maxHp / 2)));
      battlers[source] = { ...attacker, hp: attacker.hp - amount };
      battlers[target] = withVolatile(defender, { ...current, cursed: true });
      events.push({ type: "curseDamage", side: source, amount, hp: attacker.hp - amount });
      events.push({ type: "volatileApplied", source, target, effect: "curse", turns: null, move: move.internalName });
    } else {
      applyStatChange(source, target, { target: "self", stat: "speed", delta: -1 }, battlers, events);
      applySelfStatChanges(source, [{ stat: "attack", delta: 1 }, { stat: "defense", delta: 1 }], battlers, events);
    }
    return;
  }
  if (move.functionCode === "0D5" || move.functionCode === "0D8") {
    const battler = battlers[source];
    const amount = Math.min(battler.stats.maxHp - battler.hp, Math.floor(battler.stats.maxHp / 2));
    battlers[source] = { ...battler, hp: battler.hp + amount };
    events.push({ type: "hpRestored", side: source, source: "move", move: move.internalName, amount, hp: battler.hp + amount });
    return;
  }
  throw new Error(`Unsupported move function: ${move.functionCode}.`);
}

function typePreventsStatus(battler: BattlerState, status: MajorStatusState["kind"]): boolean {
  if (status === "poison") return battler.types.includes("POISON") || battler.types.includes("STEEL");
  if (status === "burn") return battler.types.includes("FIRE");
  if (status === "paralysis") return battler.types.includes("ELECTRIC");
  if (status === "frozen") return battler.types.includes("ICE");
  if (status === "caduco" || status === "hemorrhage") return battler.types.includes("FIRE");
  return false;
}

function applyAbilityStatus(source: BattleSide, target: BattleSide, ability: ImplementedBattleAbility,
  status: "poison" | "burn" | "paralysis" | "sleep", battlers: Record<BattleSide, BattlerState>,
  rng: RandomSource, events: BattleEvent[], trace: BattleTrace[]): boolean {
  const battler = battlers[target];
  if (battler.hp <= 0 || battler.majorStatus !== null || typePreventsStatus(battler, status)) return false;
  const protection = statusProtectionAbility(battler, status);
  if (protection !== null) {
    events.push({ type: "abilityActivated", side: target, ability: protection, effect: "prevent-status" });
    return false;
  }
  const majorStatus: MajorStatusState = status === "sleep"
    ? { kind: status, turnsRemaining: 2 + draw(rng, trace, "sleep-duration", 3) }
    : status === "poison" ? { kind: status, toxicCounter: null } : { kind: status };
  battlers[target] = { ...battler, majorStatus };
  events.push({ type: "abilityActivated", side: source, ability,
    effect: ability === "STATIC" ? "inflict-paralysis" : "inflict-status" });
  events.push({ type: "statusApplied", source, target, status });
  return true;
}

function applyStatusMove(
  source: BattleSide,
  target: BattleSide,
  move: BattleMove,
  battlers: Record<BattleSide, BattlerState>,
  rng: RandomSource,
  events: BattleEvent[],
  trace: BattleTrace[],
  effects: MutableBattleEffects,
  weather: BattleEffects["weather"] = effects.weather,
): void {
  const kind = statusKind(move);
  if (kind === null) throw new Error(`Unsupported status move function: ${move.functionCode}.`);
  const defender = battlers[target];
  if (defender.majorStatus !== null) {
    events.push({ type: "statusApplicationFailed", source, target, status: kind, reason: "already-status" });
    return;
  }
  const protection = statusProtectionAbility(defender, kind);
  if (protection !== null) {
    events.push({ type: "abilityActivated", side: target, ability: protection, effect: "prevent-status" },
      { type: "statusApplicationFailed", source, target, status: kind, reason: "ability-immune" });
    return;
  }
  const blockedByType = typePreventsStatus(defender, kind)
    && !(kind === "poison" && battlers[source].ability === "CORROSION");
  if (blockedByType
    || ordinaryWeather(weather) === "sun" && defender.ability === "LEAFGUARD"
    || kind === "sleep" && SIDES.some((side) => volatileOf(battlers[side]).uproarTurns > 0)) {
    events.push({ type: "statusApplicationFailed", source, target, status: kind, reason: "type-immune" });
    return;
  }
  const majorStatus: MajorStatusState = kind === "sleep"
    ? { kind, turnsRemaining: 2 + draw(rng, trace, "sleep-duration", 3) }
    : kind === "poison"
      ? { kind, toxicCounter: move.functionCode === "006" ? 0 : null }
      : { kind };
  battlers[target] = { ...defender, majorStatus };
  events.push({ type: "statusApplied", source, target, status: kind });
  const attacker = battlers[source];
  if (defender.ability === "SYNCHRONIZE" && attacker.majorStatus === null
    && ["poison", "burn", "paralysis", "caduco", "hemorrhage"].includes(kind)
    && !typePreventsStatus(attacker, kind) && statusProtectionAbility(attacker, kind) === null) {
    battlers[source] = { ...attacker, majorStatus: kind === "poison"
      ? { kind: "poison", toxicCounter: null } : { kind } as MajorStatusState };
    events.push({ type: "statusApplied", source: target, target: source, status: kind });
  }
}

function canAct(
  side: BattleSide,
  battlers: Record<BattleSide, BattlerState>,
  rng: RandomSource,
  events: BattleEvent[],
  trace: BattleTrace[],
): boolean {
  const battler = battlers[side];
  const volatile = volatileOf(battler);
  if (volatile.flinched) {
    let next = withVolatile(battler, { ...volatile, flinched: false });
    if (battler.ability === "STEADFAST") {
      battlers[side] = next;
      applyStatChange(side, opponentOf(side), { target: "self", stat: "speed", delta: 1 }, battlers, events);
      next = battlers[side];
    }
    battlers[side] = next;
    events.push({ type: "actionSkipped", side, reason: "flinch" });
    return false;
  }
  if (volatile.infatuated && draw(rng, trace, "infatuation", 2) === 0) {
    events.push({ type: "actionSkipped", side, reason: "infatuation" });
    return false;
  }
  const status = battler.majorStatus;
  if (status?.kind === "sleep") {
    const turnsRemaining = status.turnsRemaining - 1;
    if (turnsRemaining <= 0) {
      battlers[side] = { ...battler, majorStatus: null };
      events.push({ type: "statusCured", side, status: "sleep" });
      return true;
    }
    battlers[side] = { ...battler, majorStatus: { kind: "sleep", turnsRemaining } };
    events.push({ type: "statusContinued", side, status: "sleep" });
    events.push({ type: "actionSkipped", side, reason: "sleep" });
    return false;
  }
  if (status?.kind === "paralysis" && draw(rng, trace, "paralysis", 4) === 0) {
    events.push({ type: "statusContinued", side, status: "paralysis" });
    events.push({ type: "actionSkipped", side, reason: "paralysis" });
    return false;
  }
  if (volatile.confusionTurns > 0) {
    const turns = volatile.confusionTurns - 1;
    battlers[side] = withVolatile(battlers[side], { ...volatileOf(battlers[side]), confusionTurns: turns });
    if (turns === 0) events.push({ type: "volatileEnded", side, effect: "confusion" });
    else if (draw(rng, trace, "confusion-action", 2) === 0) {
      const confused = battlers[side];
      const attack = Math.max(1, Math.floor((confused.stats.attack * (confused.stages.attack >= 0 ? 2 + confused.stages.attack : 2))
        / (confused.stages.attack >= 0 ? 2 : 2 - confused.stages.attack)));
      const defense = Math.max(1, Math.floor((confused.stats.defense * (confused.stages.defense >= 0 ? 2 + confused.stages.defense : 2))
        / (confused.stages.defense >= 0 ? 2 : 2 - confused.stages.defense)));
      const base = Math.floor(Math.floor((Math.floor((2 * confused.level) / 5 + 2) * 40 * attack) / defense) / 50) + 2;
      const amount = Math.min(confused.hp, Math.max(1, Math.floor((base * (85 + draw(rng, trace, "damage-variance", 16))) / 100)));
      battlers[side] = { ...confused, hp: confused.hp - amount };
      events.push({ type: "confusionDamage", side, amount, hp: confused.hp - amount });
      events.push({ type: "actionSkipped", side, reason: "confusion" });
      return false;
    }
  }
  return true;
}

export function resolveBattleVolatileEndOfTurn(battler: BattlerState, side: BattleSide): {
  readonly battler: BattlerState; readonly events: readonly BattleEvent[];
} {
  const events: BattleEvent[] = [];
  let next = battler;
  let volatile = volatileOf(next);
  if (volatile.disableTurns > 0) {
    const disableTurns = volatile.disableTurns - 1;
    volatile = { ...volatile, disableTurns, disabledMove: disableTurns === 0 ? null : volatile.disabledMove };
    if (disableTurns === 0) events.push({ type: "volatileEnded", side, effect: "disable" });
  }
  if (volatile.encoreTurns > 0) {
    const encoreTurns = volatile.encoreTurns - 1;
    volatile = { ...volatile, encoreTurns, encoreMove: encoreTurns === 0 ? null : volatile.encoreMove };
    if (encoreTurns === 0) events.push({ type: "volatileEnded", side, effect: "encore" });
  }
  if (volatile.tauntTurns > 0) {
    const tauntTurns = volatile.tauntTurns - 1;
    volatile = { ...volatile, tauntTurns };
    if (tauntTurns === 0) events.push({ type: "volatileEnded", side, effect: "taunt" });
  }
  if (volatile.yawnTurns > 0) {
    const yawnTurns = volatile.yawnTurns - 1;
    volatile = { ...volatile, yawnTurns };
    if (yawnTurns === 0 && next.majorStatus === null) {
      next = { ...next, majorStatus: { kind: "sleep", turnsRemaining: 2 } };
      events.push({ type: "statusApplied", source: opponentOf(side), target: side, status: "sleep" });
    }
  }
  if (volatile.bindingTurns > 0 && next.hp > 0) {
    if (next.ability !== "MAGICGUARD") {
      const amount = Math.min(next.hp, Math.max(1, Math.floor(next.stats.maxHp / 16)));
      next = { ...next, hp: next.hp - amount };
      events.push({ type: "bindingDamage", side, move: volatile.bindingMove ?? "BINDING", amount, hp: next.hp });
    }
    const bindingTurns = volatile.bindingTurns - 1;
    volatile = { ...volatile, bindingTurns, bindingMove: bindingTurns === 0 ? null : volatile.bindingMove };
    if (bindingTurns === 0) events.push({ type: "volatileEnded", side, effect: "binding" });
  }
  if (volatile.cursed && next.hp > 0 && next.ability !== "MAGICGUARD") {
    const amount = Math.min(next.hp, Math.max(1, Math.floor(next.stats.maxHp / 4)));
    next = { ...next, hp: next.hp - amount };
    events.push({ type: "curseDamage", side, amount, hp: next.hp });
  }
  if (volatile.leechSeededBy !== null && next.hp > 0 && next.ability !== "MAGICGUARD") {
    const amount = Math.min(next.hp, Math.max(1, Math.floor(next.stats.maxHp / 8)));
    next = { ...next, hp: next.hp - amount };
    events.push({ type: "leechSeedDamage", side, amount, hp: next.hp });
  }
  if (volatile.chargeTurns > 0) volatile = { ...volatile, chargeTurns: volatile.chargeTurns - 1 };
  if (volatile.uproarTurns > 0) volatile = { ...volatile, uproarTurns: volatile.uproarTurns - 1 };
  if (volatile.embargoTurns > 0) volatile = { ...volatile, embargoTurns: volatile.embargoTurns - 1 };
  volatile = { ...volatile, flinched: false,
    protectRate: volatile.protected || volatile.endured ? volatile.protectRate : 1,
    protected: false, endured: false,
    activeTurns: Math.min(999, volatile.activeTurns + 1) };
  return { battler: withVolatile(next, volatile), events };
}

function applyResidualVolatile(battlers: Record<BattleSide, BattlerState>, events: BattleEvent[]): BattleSide | null {
  for (const side of SIDES) {
    const seededBy = volatileOf(battlers[side]).leechSeededBy;
    const result = resolveBattleVolatileEndOfTurn(battlers[side], side);
    battlers[side] = result.battler;
    events.push(...result.events);
    const drained = result.events.find((event): event is Extract<BattleEvent, { type: "leechSeedDamage" }> =>
      event.type === "leechSeedDamage");
    if (drained !== undefined && seededBy !== null && battlers[seededBy].hp > 0) {
      const receiver = battlers[seededBy];
      const amount = Math.min(drained.amount, receiver.stats.maxHp - receiver.hp);
      if (amount > 0) {
        battlers[seededBy] = { ...receiver, hp: receiver.hp + amount };
        events.push({ type: "hpRestored", side: seededBy, source: "move", move: "LEECHSEED",
          amount, hp: receiver.hp + amount });
      }
    }
    if (result.battler.hp === 0) {
      const winner = opponentOf(side);
      events.push({ type: "fainted", side }, { type: "battleEnded", winner });
      return winner;
    }
  }
  return null;
}

function applyResidualStatus(
  battlers: Record<BattleSide, BattlerState>,
  events: BattleEvent[],
): BattleSide | null {
  for (const side of SIDES) {
    const battler = battlers[side];
    const status = battler.majorStatus;
    if (battler.hp === 0) continue;
    if (status?.kind !== "poison" && status?.kind !== "burn" && status?.kind !== "frozen") {
      if (status?.kind === "hemorrhage" || (status?.kind === "caduco" && battler.hp <= Math.floor(battler.stats.maxHp / 2))) {
        events.push({ type: "statusContinued", side, status: status.kind });
      }
      continue;
    }
    if (battler.ability === "MAGICGUARD") {
      events.push({ type: "statusContinued", side, status: status.kind });
      continue;
    }
    const nextStatus = status.kind === "poison" && status.toxicCounter !== null
      ? { kind: "poison" as const, toxicCounter: Math.min(15, status.toxicCounter + 1) }
      : status;
    let rawDamage = nextStatus.kind === "burn" || nextStatus.kind === "frozen"
      ? Math.floor(battler.stats.maxHp / 16)
      : nextStatus.toxicCounter === null
        ? Math.floor(battler.stats.maxHp / 12)
        : Math.floor((battler.stats.maxHp * nextStatus.toxicCounter) / 16);
    if (nextStatus.kind === "poison" && battlers[opponentOf(side)].ability === "ALQUIMIAVIL") rawDamage *= 2;
    const amount = Math.min(battler.hp, Math.max(1, rawDamage));
    const hp = battler.hp - amount;
    battlers[side] = { ...battler, hp, majorStatus: nextStatus };
    events.push({ type: "statusDamage", side, status: nextStatus.kind, amount, hp });
    if (hp === 0) {
      const winner = opponentOf(side);
      events.push({ type: "fainted", side });
      events.push({ type: "battleEnded", winner });
      return winner;
    }
  }
  return null;
}

function applyCheekPouch(battler: BattlerState, side: BattleSide, events: BattleEvent[]): BattlerState {
  if (battler.ability !== "CHEEKPOUCH" || battler.hp <= 0 || battler.hp >= battler.stats.maxHp) return battler;
  const amount = Math.min(battler.stats.maxHp - battler.hp, Math.floor(battler.stats.maxHp / 3));
  if (amount <= 0) return battler;
  const next = { ...battler, hp: battler.hp + amount };
  events.push({ type: "abilityActivated", side, ability: "CHEEKPOUCH", effect: "heal-on-berry" },
    { type: "hpRestored", side, source: "move", move: "CHEEKPOUCH", amount, hp: next.hp });
  return next;
}

export function resolveBattlePassiveEndOfTurn(battler: BattlerState, side: BattleSide,
  rng: RandomSource, trace: BattleTrace[]): { readonly battler: BattlerState; readonly events: readonly BattleEvent[] } {
  const events: BattleEvent[] = [];
  let next = battler;
  if (next.hp > 0 && (next.volatile?.embargoTurns ?? 0) === 0) {
    if (next.heldItem === "ORANBERRY" && next.hp <= Math.floor(next.stats.maxHp / 2)) {
      const amount = Math.min(10, next.stats.maxHp - next.hp);
      next = { ...next, hp: next.hp + amount, heldItem: null };
      events.push({ type: "itemActivated", side, item: "ORANBERRY", effect: "heal", amount, hp: next.hp });
      events.push({ type: "heldItemConsumed", side, item: "ORANBERRY", effect: "heal", hp: next.hp });
      next = applyCheekPouch(next, side, events);
    }
    const liechiThreshold = next.ability === "GLUTTONY" ? Math.floor(next.stats.maxHp / 2)
      : Math.floor(next.stats.maxHp / 4);
    if (next.heldItem === "LIECHIBERRY" && next.hp <= liechiThreshold && next.stages.attack < 6) {
      const delta = next.ability === "SIMPLE" ? 2 : 1;
      const stage = Math.min(6, next.stages.attack + delta);
      next = { ...next, heldItem: null, stages: { ...next.stages, attack: stage } };
      events.push({ type: "itemActivated", side, item: "LIECHIBERRY", effect: "boost", amount: 0, hp: next.hp });
      events.push({ type: "heldItemConsumed", side, item: "LIECHIBERRY", effect: "boost", hp: next.hp });
      events.push({ type: "statStageChanged", source: side, target: side, stat: "attack", delta, stage });
      next = applyCheekPouch(next, side, events);
    }
    const heals = next.heldItem === "LEFTOVERS"
      || (next.heldItem === "BLACKSLUDGE" && next.types.includes("POISON"));
    if (heals && next.hp < next.stats.maxHp) {
      const amount = Math.min(next.stats.maxHp - next.hp, Math.max(1, Math.floor(next.stats.maxHp / 16)));
      const hp = next.hp + amount;
      events.push({ type: "itemActivated", side, item: next.heldItem as "LEFTOVERS" | "BLACKSLUDGE", effect: "heal", amount, hp });
      next = { ...next, hp };
    } else if (next.heldItem === "BLACKSLUDGE" && next.ability !== "MAGICGUARD") {
      const amount = Math.min(next.hp, Math.max(1, Math.floor(next.stats.maxHp / 8)));
      const hp = next.hp - amount;
      events.push({ type: "itemActivated", side, item: "BLACKSLUDGE", effect: "damage", amount, hp });
      next = { ...next, hp };
    }
  }
  if (next.hp > 0 && next.majorStatus !== null && next.ability === "SHEDSKIN"
    && draw(rng, trace, "ability", 10) < 3) {
    events.push({ type: "statusCured", side, status: next.majorStatus.kind });
    next = { ...next, majorStatus: null };
  }
  return { battler: next, events };
}

function applyHeldItems(battlers: Record<BattleSide, BattlerState>, events: BattleEvent[],
  rng: RandomSource, trace: BattleTrace[], weather: BattleEffects["weather"]): BattleSide | null {
  for (const side of SIDES) {
    const weatherResult = resolveWeatherEndOfTurn(battlers[side], side, weather);
    battlers[side] = weatherResult.battler;
    events.push(...weatherResult.events);
    if (weatherResult.battler.hp === 0) {
      const winner = opponentOf(side);
      events.push({ type: "fainted", side }, { type: "battleEnded", winner });
      return winner;
    }
    const result = resolveBattlePassiveEndOfTurn(battlers[side], side, rng, trace);
    battlers[side] = result.battler;
    events.push(...result.events);
    if (result.battler.hp === 0) {
      const winner = opponentOf(side);
      events.push({ type: "fainted", side }, { type: "battleEnded", winner });
      return winner;
    }
  }
  return null;
}

function tickBattleEffects(effects: MutableBattleEffects, events: BattleEvent[]): void {
  for (const side of SIDES) {
    const current = effects.sides[side];
    const reflectTurns = Math.max(0, current.reflectTurns - 1);
    const lightScreenTurns = Math.max(0, current.lightScreenTurns - 1);
    const luckyChantTurns = Math.max(0, current.luckyChantTurns - 1);
    const mistTurns = Math.max(0, current.mistTurns - 1);
    const safeguardTurns = Math.max(0, current.safeguardTurns - 1);
    effects.sides[side] = { ...current, reflectTurns, lightScreenTurns, luckyChantTurns, mistTurns, safeguardTurns };
    if (current.reflectTurns > 0 && reflectTurns === 0) events.push({ type: "battleEffectChanged", side, effect: "reflect", turns: 0 });
    if (current.luckyChantTurns > 0 && luckyChantTurns === 0) events.push({ type: "battleEffectChanged", side, effect: "lucky-chant", turns: 0 });
    if (current.lightScreenTurns > 0 && lightScreenTurns === 0) events.push({ type: "battleEffectChanged", side, effect: "light-screen", turns: 0 });
    if (current.mistTurns > 0 && mistTurns === 0) events.push({ type: "battleEffectChanged", side, effect: "mist", turns: 0 });
    if (current.safeguardTurns > 0 && safeguardTurns === 0) events.push({ type: "battleEffectChanged", side, effect: "safeguard", turns: 0 });
  }
  if (effects.mudSportTurns > 0) {
    effects.mudSportTurns -= 1;
    if (effects.mudSportTurns === 0) events.push({ type: "battleEffectChanged", side: null, effect: "mud-sport", turns: 0 });
  }
  if (effects.waterSportTurns > 0) {
    effects.waterSportTurns -= 1;
    if (effects.waterSportTurns === 0) events.push({ type: "battleEffectChanged", side: null, effect: "water-sport", turns: 0 });
  }
  if (effects.terrainTurns > 0) {
    effects.terrainTurns -= 1;
    if (effects.terrainTurns === 0) {
      effects.terrain = null;
      events.push({ type: "battleEffectChanged", side: null, effect: "terrain", turns: 0 });
    }
  }
  if (effects.weatherTurns > 0) {
    effects.weatherTurns -= 1;
    if (effects.weatherTurns === 0) {
      effects.weather = null;
      events.push({ type: "battleEffectChanged", side: null, effect: "weather", turns: 0 });
    }
  }
}

function validateState(state: BattleState, actions: SelectedMoveActions): void {
  if (state.status !== "active") throw new Error("Cannot resolve a finished battle.");
  for (const side of SIDES) {
    const battler = state.battlers[side];
    if (battler.hp <= 0 || battler.hp > battler.stats.maxHp) throw new Error(`Invalid HP for ${side}.`);
    if (battler.level < 1 || battler.level > 100) throw new Error(`Invalid level for ${side}.`);
    if (battler.majorStatus?.kind === "sleep" && (!Number.isInteger(battler.majorStatus.turnsRemaining) || battler.majorStatus.turnsRemaining < 1)) {
      throw new Error(`Invalid sleep duration for ${side}.`);
    }
    if (battler.majorStatus?.kind === "poison" && battler.majorStatus.toxicCounter !== null
      && (!Number.isInteger(battler.majorStatus.toxicCounter) || battler.majorStatus.toxicCounter < 0 || battler.majorStatus.toxicCounter > 15)) {
      throw new Error(`Invalid toxic counter for ${side}.`);
    }
    for (const type of battler.types) if (!isKnownType(type)) throw new Error(`Unknown Pokemon Z type: ${type}`);
    const action = actions[side];
    if (action !== undefined && (!Number.isInteger(action.moveIndex) || action.moveIndex < 0 || action.moveIndex >= battler.moves.length)) {
      throw new RangeError(`Invalid move index for ${side}.`);
    }
  }
}

function orderedSides(state: BattleState, actions: SelectedMoveActions, rng: RandomSource, trace: BattleTrace[],
  weather: BattleEffects["weather"] = state.effects?.weather): BattleSide[] {
  const decorated = SIDES.filter((side) => actions[side] !== undefined).map((side) => {
    const battler = state.battlers[side];
    const action = actions[side];
    if (action === undefined) throw new Error(`Missing selected action for ${side}.`);
    const slot = battler.moves[action.moveIndex];
    if (slot === undefined) throw new RangeError(`Invalid move index for ${side}.`);
    const speed = effectiveSpeed(battler) * weatherSpeedMultiplier(battler, weather);
    const priority = slot.move.priority + (battler.ability === "PRANKSTER" && slot.move.category === "Status" ? 1 : 0);
    trace.push({ type: "order", side, priority, speed });
    return { side, priority, speed };
  });
  if (decorated.length === 0) return [];
  const only = decorated[0];
  if (decorated.length === 1 && only !== undefined) return [only.side];
  const [player, opponent] = decorated;
  if (player === undefined || opponent === undefined) throw new Error("Battle requires two sides.");
  if (player.priority !== opponent.priority) return player.priority > opponent.priority ? [player.side, opponent.side] : [opponent.side, player.side];
  if (player.speed !== opponent.speed) return player.speed > opponent.speed ? [player.side, opponent.side] : [opponent.side, player.side];
  return draw(rng, trace, "speed-tie", 2) === 0 ? [opponent.side, player.side] : [player.side, opponent.side];
}

function accuracyCheck(side: BattleSide, attacker: BattlerState, defender: BattlerState, move: BattleMove,
  rng: RandomSource, trace: BattleTrace[], weather: BattleEffects["weather"]): boolean {
  const accuracy = move.accuracy;
  const drawnIn = defender.ability === "STORMDRAIN" && move.type === "WATER"
    || defender.ability === "LIGHTNINGROD" && move.type === "ELECTRIC";
  if (accuracy === 0 || drawnIn) {
    trace.push({ type: "accuracy", side, base: 0, accuracyStage: attacker.stages.accuracy, evasionStage: defender.stages.evasion, threshold: Number.POSITIVE_INFINITY, hit: true });
    return true;
  }
  if (attacker.ability === "NOGUARD" || defender.ability === "NOGUARD") {
    trace.push({ type: "accuracy", side, base: accuracy, accuracyStage: attacker.stages.accuracy,
      evasionStage: defender.stages.evasion, threshold: Number.POSITIVE_INFINITY, hit: true });
    return true;
  }
  const itemModifier = attacker.heldItem === "WIDELENS" ? 1.1 : 1;
  const abilityModifier = attacker.ability === "COMPOUNDEYES" ? 1.3 : 1;
  const evasionStage = defender.volatile?.identified === true
    || (attacker.ability === "KEENEYE" && defender.stages.evasion > 0) ? 0 : defender.stages.evasion;
  const threshold = accuracy * itemModifier * abilityModifier * accuracyFactor(attacker.stages.accuracy)
    / accuracyFactor(evasionStage) / weatherEvasionMultiplier(defender, weather);
  const roll = draw(rng, trace, "accuracy", 100);
  const hit = roll < threshold;
  trace.push({ type: "accuracy", side, base: accuracy, accuracyStage: attacker.stages.accuracy, evasionStage, threshold, hit });
  return hit;
}

/** Pokemon Z deliberately requires the Shield Dust + Covert Cloak combination. */
function blocksAdditionalEffects(attacker: BattlerState, defender: BattlerState): boolean {
  return !hasMoldBreaker(attacker) && defender.ability === "SHIELDDUST" && defender.heldItem === "COVERTCLOAK";
}

const NATURE_POWER_MOVES: Readonly<Record<NonNullable<BattleEffects["environment"]>,
  Pick<BattleMove, "internalName" | "name" | "functionCode" | "power" | "type" | "category" | "accuracy" | "effectChance" | "flags">>> = {
  none: { internalName: "TRIATTACK", name: "Triattaque", functionCode: "017", power: 80,
    type: "NORMAL", category: "Special", accuracy: 100, effectChance: 20, flags: "be" },
  grass: { internalName: "ENERGYBALL", name: "Éco-Sphère", functionCode: "046", power: 90,
    type: "GRASS", category: "Special", accuracy: 100, effectChance: 10, flags: "ben" },
  "moving-water": { internalName: "HYDROPUMP", name: "Hydrocanon", functionCode: "000", power: 110,
    type: "WATER", category: "Special", accuracy: 80, effectChance: 0, flags: "bef" },
  "still-water": { internalName: "MUDBOMB", name: "Boue-Bombe", functionCode: "047", power: 70,
    type: "GROUND", category: "Special", accuracy: 95, effectChance: 30, flags: "befn" },
  underwater: { internalName: "HYDROPUMP", name: "Hydrocanon", functionCode: "000", power: 110,
    type: "WATER", category: "Special", accuracy: 80, effectChance: 0, flags: "bef" },
  cave: { internalName: "POWERGEM", name: "Rayon Gemme", functionCode: "000", power: 80,
    type: "ROCK", category: "Special", accuracy: 100, effectChance: 0, flags: "bef" },
  rock: { internalName: "EARTHPOWER", name: "Telluriforce", functionCode: "046", power: 90,
    type: "GROUND", category: "Special", accuracy: 100, effectChance: 10, flags: "bef" },
  sand: { internalName: "EARTHPOWER", name: "Telluriforce", functionCode: "046", power: 90,
    type: "GROUND", category: "Special", accuracy: 100, effectChance: 10, flags: "bef" },
  snow: { internalName: "FROSTBREATH", name: "Souffle Glacé", functionCode: "000", power: 60,
    type: "ICE", category: "Special", accuracy: 90, effectChance: 0, flags: "bef" },
  volcano: { internalName: "LAVAPLUME", name: "Ébullilave", functionCode: "00A", power: 80,
    type: "FIRE", category: "Special", accuracy: 100, effectChance: 30, flags: "bef" },
  graveyard: { internalName: "SHADOWBALL", name: "Ball'Ombre", functionCode: "046", power: 80,
    type: "GHOST", category: "Special", accuracy: 100, effectChance: 20, flags: "ben" },
  sky: { internalName: "AIRSLASH", name: "Lame d'Air", functionCode: "000", power: 80,
    type: "FLYING", category: "Special", accuracy: 100, effectChance: 30, flags: "bef" },
  space: { internalName: "DRACOMETEOR", name: "Draco-Météore", functionCode: "000", power: 130,
    type: "DRAGON", category: "Special", accuracy: 90, effectChance: 0, flags: "bef" },
};

function naturePowerMove(source: BattleMove, effects: MutableBattleEffects): BattleMove {
  const terrainName = effects.terrain;
  const called = terrainName === "electric"
    ? { internalName: "THUNDERBOLT", name: "Tonnerre", functionCode: "007" as const, power: 90,
      type: "ELECTRIC", category: "Special" as const, accuracy: 100, effectChance: 10, flags: "be" }
    : terrainName === "grassy" ? NATURE_POWER_MOVES.grass
      : terrainName === "misty"
        ? { internalName: "MOONBLAST", name: "Pouvoir Lunaire", functionCode: "045" as const, power: 95,
          type: "FAIRY", category: "Special" as const, accuracy: 100, effectChance: 30, flags: "bef" }
        : terrainName === "psychic"
          ? { internalName: "PSYCHIC", name: "Psyko", functionCode: "046" as const, power: 90,
            type: "PSYCHIC", category: "Special" as const, accuracy: 100, effectChance: 10, flags: "be" }
          : NATURE_POWER_MOVES[effects.environment];
  return { ...source, ...called };
}

export function resolveSelectedMoves(state: BattleState, actions: SelectedMoveActions, rng: RandomSource,
  options: { readonly endOfTurn?: boolean; readonly damageMultiplier?: number;
    readonly attackerHeldItemAfterDamage?: boolean; readonly switchingTarget?: BattleSide | null;
    readonly targetPlannedAction?: MoveAction; readonly targetAlreadyMoved?: boolean;
    readonly targetTookDamageThisTurn?: boolean; readonly roundMultiplier?: number;
    readonly helpingHandMultiplier?: number; readonly opponentItemTheft?: boolean;
    /** Double battles derive global suppression from all four active slots. */
    readonly weatherSuppressed?: boolean } = {}): TurnResult {
  validateState(state, actions);
  const battlers: Record<BattleSide, BattlerState> = {
    player: cloneBattler(state.battlers.player),
    opponent: cloneBattler(state.battlers.opponent),
  };
  const events: BattleEvent[] = [{ type: "turnStarted", turn: state.turn }];
  const trace: BattleTrace[] = [];
  for (const side of SIDES) {
    const cured = cureStatusBlockedByAbility(battlers[side]);
    if (cured !== null) {
      battlers[side] = cured.battler;
      events.push({ type: "abilityActivated", side, ability: cured.ability, effect: "prevent-status" },
        { type: "statusCured", side, status: cured.status });
    }
    const battler = battlers[side];
    if (battler.ability === "OWNTEMPO" && volatileOf(battler).confusionTurns > 0) {
      battlers[side] = withVolatile(battler, { ...volatileOf(battler), confusionTurns: 0 });
      events.push({ type: "abilityActivated", side, ability: "OWNTEMPO", effect: "prevent-confusion" },
        { type: "volatileEnded", side, effect: "confusion" });
    }
  }
  const effects = effectsOf(state.effects);
  const effectiveWeather = effectiveBattleWeather(effects.weather, Object.values(battlers), options.weatherSuppressed);
  const moved = new Set<BattleSide>();
  const damagedThisTurn = new Set<BattleSide>();
  const selectedActions: Partial<Record<BattleSide, MoveAction>> = { ...actions };
  for (const side of SIDES) {
    const encore = volatileOf(battlers[side]);
    const lockedMove = encore.rolloutTurns > 0 ? battlers[side].moves.find((slot) => slot.move.functionCode === "0D3")?.move.internalName
      : encore.uproarTurns > 0 ? battlers[side].moves.find((slot) => slot.move.functionCode === "0D1")?.move.internalName
        : encore.encoreTurns > 0 ? encore.encoreMove : null;
    if (lockedMove === null || lockedMove === undefined || selectedActions[side] === undefined) continue;
    const moveIndex = battlers[side].moves.findIndex((slot) => slot.move.internalName === lockedMove && slot.pp > 0);
    if (moveIndex >= 0) selectedActions[side] = { kind: "move", moveIndex };
  }
  const order = orderedSides({ ...state, battlers }, selectedActions, rng, trace, effectiveWeather);
  events.push({ type: "actionOrdered", order });
  let winner: BattleSide | null = null;

  for (const side of order) {
    const targetSide = opponentOf(side);
    let attacker = battlers[side];
    if (attacker.hp === 0) {
      events.push({ type: "actionSkipped", side, reason: "fainted" });
      continue;
    }
    if (!canAct(side, battlers, rng, events, trace)) {
      if (battlers[side].hp === 0) {
        winner = targetSide;
        events.push({ type: "fainted", side });
        if (options.endOfTurn !== false) events.push({ type: "battleEnded", winner });
        break;
      }
      continue;
    }
    attacker = battlers[side];
    const action = selectedActions[side];
    if (action === undefined) throw new Error(`Missing selected action for ${side}.`);
    const selectedSlot = attacker.moves[action.moveIndex];
    if (selectedSlot === undefined) throw new RangeError(`Invalid move index for ${side}.`);
    const slot = selectedSlot.move.functionCode === "0B3"
      ? { ...selectedSlot, move: naturePowerMove(selectedSlot.move, effects) } : selectedSlot;
    if (selectedSlot.pp === 0) {
      events.push({ type: "actionSkipped", side, reason: "no-pp" });
      continue;
    }
    const volatile = volatileOf(attacker);
    if (volatile.disableTurns > 0 && volatile.disabledMove === slot.move.internalName) {
      events.push({ type: "actionSkipped", side, reason: "disabled" });
      continue;
    }
    if (attacker.heldItem === "ASSAULTVEST" && slot.move.category === "Status") {
      events.push({ type: "actionSkipped", side, reason: "item-blocked" });
      continue;
    }
    if (volatile.tauntTurns > 0 && slot.move.category === "Status") {
      events.push({ type: "actionSkipped", side, reason: "taunted" });
      continue;
    }
    const nextMoves = attacker.moves.map((candidate, index) => index === action.moveIndex ? { ...candidate, pp: candidate.pp - 1 } : candidate);
    const furyCutterCount = selectedSlot.move.functionCode === "091"
      ? Math.min(4, volatile.lastMoveUsed === selectedSlot.move.internalName ? volatile.furyCutterCount + 1 : 1) : 0;
    const rolloutTurns = selectedSlot.move.functionCode === "0D3"
      ? volatile.rolloutTurns > 0 ? volatile.rolloutTurns - 1 : 4 : 0;
    battlers[side] = withVolatile({ ...attacker, moves: nextMoves }, { ...volatile,
      lastMoveUsed: selectedSlot.move.internalName, furyCutterCount, rolloutTurns });
    events.push({ type: "moveUsed", side, move: selectedSlot.move.internalName });
    if (slot.move.internalName !== selectedSlot.move.internalName) events.push({ type: "moveUsed", side, move: slot.move.internalName });
    events.push({ type: "ppChanged", side, move: selectedSlot.move.internalName, pp: selectedSlot.pp - 1 });
    moved.add(side);
    const moveType = effectiveMoveType(battlers[side], slot.move).type;
    const resolvedMove = moveType === slot.move.type ? slot.move : { ...slot.move, type: moveType };
    if (battlers[side].ability === "PROTEAN"
      && (battlers[side].types.length !== 1 || battlers[side].types[0] !== moveType)) {
      battlers[side] = { ...battlers[side], types: [moveType] };
      events.push({ type: "abilityActivated", side, ability: "PROTEAN", effect: "change-type" });
    }
    if (slot.move.category !== "Status"
      && (effectiveWeather === "heavy-rain" && moveType === "FIRE"
        || effectiveWeather === "harsh-sun" && moveType === "WATER")) {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    const plannedTargetAction = selectedActions[targetSide] ?? options.targetPlannedAction;
    if (slot.move.functionCode === "012" && volatile.activeTurns > 0) {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    if (slot.move.functionCode === "116") {
      const targetMove = plannedTargetAction === undefined ? undefined
        : battlers[targetSide].moves[plannedTargetAction.moveIndex]?.move;
      if (targetMove === undefined || targetMove.category === "Status"
        || moved.has(targetSide) || options.targetAlreadyMoved === true) {
        events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
        continue;
      }
    }
    let actualTargetSide = targetSide;
    const intendedDefender = battlers[targetSide];
    if (moveType === "FLYING" && intendedDefender.ability === "CONTRAGUARDIA"
      && !hasMoldBreaker(battlers[side])) actualTargetSide = side;
    let defender = battlers[actualTargetSide];
    if (hasMoveFlag(slot.move, "l") && (defender.types.includes("GRASS") || defender.heldItem === "SAFETYGOGGLES"
      || defender.ability === "OVERCOAT" && !hasMoldBreaker(battlers[side]))) {
      if (defender.ability === "OVERCOAT" && !defender.types.includes("GRASS") && defender.heldItem !== "SAFETYGOGGLES") {
        events.push({ type: "abilityActivated", side: actualTargetSide, ability: "OVERCOAT", effect: "block-move" });
      }
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    if (moveType === "GRASS" && defender.ability === "SAPSIPPER" && !hasMoldBreaker(battlers[side])) {
      events.push({ type: "abilityActivated", side: actualTargetSide, ability: "SAPSIPPER", effect: "boost-stat" });
      applyStatChange(actualTargetSide, side, { target: "self", stat: "attack", delta: 1 }, battlers, events);
      continue;
    }
    if (defender.ability === "SOUNDPROOF" && hasMoveFlag(slot.move, "k") && !hasMoldBreaker(battlers[side])) {
      events.push({ type: "abilityActivated", side: actualTargetSide, ability: "SOUNDPROOF", effect: "block-move" });
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    const targetVolatile = volatileOf(defender);
    if (targetVolatile.protected && slot.move.functionCode !== "0AD") {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "protected" });
      continue;
    }
    if (slot.move.functionCode === "0AD" && targetVolatile.protected) {
      battlers[actualTargetSide] = withVolatile(defender, { ...targetVolatile, protected: false });
      events.push({ type: "volatileEnded", side: actualTargetSide, effect: "protect" });
      defender = battlers[actualTargetSide];
    }
    if (!accuracyCheck(side, battlers[side], defender, slot.move, rng, trace, effectiveWeather)) {
      if (selectedSlot.move.functionCode === "091" || selectedSlot.move.functionCode === "0D3") {
        const current = battlers[side];
        battlers[side] = withVolatile(current, { ...volatileOf(current), furyCutterCount: 0, rolloutTurns: 0 });
      }
      events.push({ type: "moveMissed", side, move: slot.move.internalName });
      if (slot.move.functionCode === "10B" && battlers[side].ability !== "MAGICGUARD") {
        const attacker = battlers[side];
        const amount = Math.min(attacker.hp, Math.floor(attacker.stats.maxHp / 2));
        battlers[side] = { ...attacker, hp: attacker.hp - amount };
        if (amount > 0) events.push({ type: "recoilDamage", side, move: slot.move.internalName,
          reason: "crash", amount, hp: attacker.hp - amount });
        if (attacker.hp - amount === 0) events.push({ type: "fainted", side });
      }
      continue;
    }
    if (applyTypeAbsorption(side, actualTargetSide, slot.move, battlers, events)) continue;
    if (slot.move.category === "Status") {
      applyMoveEffect(side, actualTargetSide, resolvedMove, battlers, rng, events, trace, effects, effectiveWeather);
      if (battlers[side].hp === 0) {
        winner = targetSide;
        events.push({ type: "fainted", side });
        if (options.endOfTurn !== false) events.push({ type: "battleEnded", winner });
        break;
      }
      continue;
    }
    const traceStart = trace.length;
    const damageContext = { reflect: effects.sides[actualTargetSide].reflectTurns > 0,
      lightScreen: effects.sides[actualTargetSide].lightScreenTurns > 0,
      luckyChant: effects.sides[actualTargetSide].luckyChantTurns > 0,
      mudSport: effects.mudSportTurns > 0,
      waterSport: effects.waterSportTurns > 0, weather: effectiveWeather };
    const assuranceMultiplier = slot.move.functionCode === "082"
      && (options.targetTookDamageThisTurn === true || damagedThisTurn.has(actualTargetSide)) ? 2 : 1;
    const roundMultiplier = slot.move.functionCode === "083" ? options.roundMultiplier ?? 1 : 1;
    const chargeMultiplier = moveType === "ELECTRIC" && volatileOf(battlers[side]).chargeTurns > 0 ? 2 : 1;
    const powerMultiplier = assuranceMultiplier * roundMultiplier * chargeMultiplier;
    let damageMove = powerMultiplier === 1 ? slot.move : { ...slot.move, power: slot.move.power * powerMultiplier };
    if (slot.move.functionCode === "095") {
      const magnitudePowers = [10, 30, 30, 50, 50, 50, 50, 70, 70, 70, 70, 70, 70, 90, 90, 90, 90, 110, 110, 150];
      damageMove = { ...slot.move, power: magnitudePowers[draw(rng, trace, "magnitude", magnitudePowers.length)]! };
    }
    const damageRolls = [calculateDamage(side, battlers[side], defender, damageMove, rng, trace, damageContext)];
    if ((slot.move.functionCode === "0C0" || slot.move.functionCode === "0BD"
      || slot.move.functionCode === "0BE") && damageRolls[0]! > 0) {
      const hitTable = [2, 2, 3, 3, 4, 5] as const;
      const hits = slot.move.functionCode === "0BD" || slot.move.functionCode === "0BE" ? 2
        : battlers[side].ability === "SKILLLINK" ? 5
        : hitTable[draw(rng, trace, "additional-effect", hitTable.length)]!;
      for (let hit = 1; hit < hits; hit += 1) {
        damageRolls.push(calculateDamage(side, battlers[side], defender, damageMove, rng, trace, damageContext));
      }
    }
    const damageTraces = trace.slice(traceStart).filter((entry) => entry.type === "damage");
    const damageTrace = damageTraces[0];
    if (damageTrace === undefined) throw new Error("Damage calculation did not emit its trace.");
    const gem = (battlers[side].heldItem === "FIGHTINGGEM" && moveType === "FIGHTING")
      || (battlers[side].heldItem === "BUGGEM" && moveType === "BUG")
      ? battlers[side].heldItem as "FIGHTINGGEM" | "BUGGEM" : null;
    if (gem !== null) {
      battlers[side] = { ...battlers[side], heldItem: null };
      events.push({ type: "heldItemConsumed", side, item: gem, effect: "boost", hp: battlers[side].hp });
    }
    const payapa = defender.heldItem === "PAYAPABERRY" && moveType === "PSYCHIC"
      && damageTrace.effectiveness > 1;
    let hp = defender.hp;
    let damage = 0;
    const appliedHits: { hpBefore: number; hpAfter: number; critical: boolean }[] = [];
    let landedHits = 0;
    let focusSash = false;
    let sturdy = false;
    for (const [hitIndex, rawDamage] of damageRolls.entries()) {
      if (hp <= 0) break;
      const presentationMultiplier = (options.damageMultiplier ?? 1) * (options.helpingHandMultiplier ?? 1);
      let hitDamage = rawDamage === 0 ? 0 : Math.max(1, Math.floor(rawDamage * presentationMultiplier));
      if (slot.move.functionCode === "088" && options.switchingTarget === targetSide) hitDamage *= 2;
      const sashOnThisHit: boolean = !focusSash && defender.heldItem === "FOCUSSASH"
        && hp === defender.stats.maxHp && hitDamage >= hp;
      const sturdyOnThisHit: boolean = !sturdy && defender.ability === "STURDY"
        && hp === defender.stats.maxHp && hitDamage >= hp;
      if (sashOnThisHit || sturdyOnThisHit || targetVolatile.endured && hitDamage >= hp) hitDamage = Math.max(0, hp - 1);
      focusSash = focusSash || sashOnThisHit;
      sturdy = sturdy || sturdyOnThisHit;
      const applied = Math.min(hitDamage, hp);
      const hpBefore = hp;
      hp -= applied;
      damage += applied;
      if (applied > 0) landedHits += 1;
      const hitTrace = damageTraces[hitIndex] ?? damageTrace;
      if (applied > 0) appliedHits.push({ hpBefore, hpAfter: hp, critical: hitTrace.critical });
      events.push({ type: "damageApplied", source: side, target: actualTargetSide,
        amount: applied, hp, critical: hitTrace.critical, effectiveness: hitTrace.effectiveness });
    }
    battlers[actualTargetSide] = { ...defender, hp, heldItem: focusSash || payapa ? null : defender.heldItem };
    if (damage > 0) damagedThisTurn.add(actualTargetSide);
    if (damage > 0 && slot.move.functionCode === "0D1") {
      const current = battlers[side];
      if (volatileOf(current).uproarTurns === 0) {
        battlers[side] = withVolatile(current, { ...volatileOf(current), uproarTurns: 3 });
        events.push({ type: "volatileApplied", source: side, target: side, effect: "uproar", turns: 3,
          move: slot.move.internalName });
      }
      for (const wakeSide of SIDES) {
        const sleeping = battlers[wakeSide];
        if (sleeping.majorStatus?.kind !== "sleep") continue;
        battlers[wakeSide] = { ...sleeping, majorStatus: null };
        events.push({ type: "statusCured", side: wakeSide, status: "sleep" });
      }
    }
    if (damage > 0 && chargeMultiplier > 1) {
      const charged = battlers[side];
      battlers[side] = withVolatile(charged, { ...volatileOf(charged), chargeTurns: 0 });
    }
    if (focusSash) events.push({ type: "heldItemConsumed", side: actualTargetSide,
      item: "FOCUSSASH", effect: "survive", hp });
    if (sturdy) events.push({ type: "abilityActivated", side: actualTargetSide,
      ability: "STURDY", effect: "survive" });
    if (payapa) events.push({ type: "heldItemConsumed", side: actualTargetSide,
      item: "PAYAPABERRY", effect: "weaken", hp });
    if (payapa) battlers[actualTargetSide] = applyCheekPouch(battlers[actualTargetSide], actualTargetSide, events);
    if (slot.move.functionCode === "0DD" && battlers[side].hp > 0) {
      const current = battlers[side];
      const amount = Math.min(current.stats.maxHp - current.hp, Math.round(Math.min(damage, defender.hp) / 2));
      battlers[side] = { ...current, hp: current.hp + amount };
      events.push({ type: "hpRestored", side, source: "move", move: slot.move.internalName, amount, hp: current.hp + amount });
    }
    if (hp > 0 && damage > 0 && slot.move.functionCode === "0CF") {
      const bound = battlers[actualTargetSide];
      const current = volatileOf(bound);
      if (current.bindingTurns === 0) {
        const turns = 5 + draw(rng, trace, "binding-duration", 2);
        battlers[actualTargetSide] = withVolatile(bound, { ...current, bindingMove: slot.move.internalName, bindingTurns: turns });
        events.push({ type: "volatileApplied", source: side, target: actualTargetSide, effect: "binding", turns, move: slot.move.internalName });
      }
    }
    if (hp > 0 && damage > 0 && slot.move.functionCode === "110") {
      const spinner = battlers[side];
      const current = volatileOf(spinner);
      applySelfStatChanges(side, [{ stat: "speed", delta: 1 }], battlers, events);
      const updated = battlers[side];
      if (current.bindingTurns > 0) events.push({ type: "volatileEnded", side, effect: "binding" });
      if (current.leechSeededBy !== null) events.push({ type: "volatileEnded", side, effect: "leech-seed" });
      battlers[side] = withVolatile(updated, { ...volatileOf(updated), bindingMove: null, bindingTurns: 0,
        leechSeededBy: null, leechSeededBySlot: null });
      const own = effects.sides[side];
      if (own.spikesLayers > 0) events.push({ type: "battleEffectChanged", side, effect: "spikes", turns: 0 });
      if (own.toxicSpikesLayers > 0) events.push({ type: "battleEffectChanged", side, effect: "toxic-spikes", turns: 0 });
      if (own.stealthRock) events.push({ type: "battleEffectChanged", side, effect: "stealth-rock", turns: 0 });
      if (own.stickyWeb) events.push({ type: "battleEffectChanged", side, effect: "sticky-web", turns: 0 });
      effects.sides[side] = { ...own, spikesLayers: 0, toxicSpikesLayers: 0,
        stealthRock: false, stickyWeb: false };
    }
    const effectChance = battlers[side].ability === "SHEERFORCE" ? 0
      : Math.min(100, slot.move.effectChance * (battlers[side].ability === "SERENEGRACE" ? 2 : 1));
    if (hp > 0 && slot.move.functionCode === "0BE" && effectChance > 0) {
      for (let hit = 0; hit < landedHits && battlers[actualTargetSide].majorStatus === null; hit += 1) {
        if (draw(rng, trace, "additional-effect", 100) >= effectChance) continue;
        if (blocksAdditionalEffects(battlers[side], battlers[actualTargetSide])) {
          events.push({ type: "abilityActivated", side: actualTargetSide,
            ability: "SHIELDDUST", effect: "prevent-additional-effect" });
          break;
        }
        applyMoveEffect(side, actualTargetSide, slot.move, battlers, rng, events, trace, effects);
      }
    }
    if (hp > 0 && slot.move.functionCode !== "0BE" && effectChance > 0
      && draw(rng, trace, "additional-effect", 100) < effectChance) {
      if (blocksAdditionalEffects(battlers[side], battlers[actualTargetSide])) {
        events.push({ type: "abilityActivated", side: actualTargetSide, ability: "SHIELDDUST", effect: "prevent-additional-effect" });
      } else applyMoveEffect(side, actualTargetSide, slot.move, battlers, rng, events, trace, effects);
    }
    if (hp > 0 && slot.move.functionCode === "009" && battlers[side].ability !== "SHEERFORCE"
      && !blocksAdditionalEffects(battlers[side], battlers[actualTargetSide])
      && draw(rng, trace, "additional-effect", 10) === 0) {
      const target = battlers[actualTargetSide];
      if (target.ability !== "INNERFOCUS") {
        battlers[actualTargetSide] = withVolatile(target, { ...volatileOf(target), flinched: true });
        events.push({ type: "volatileApplied", source: side, target: actualTargetSide,
          effect: "flinch", turns: 1, move: slot.move.internalName });
      }
    }
    for (const hit of appliedHits) {
      applyDamageAbilityStatReaction(actualTargetSide, side, slot.move, hit, battlers, events);
    }
    if (damage > 0 && battlers[actualTargetSide].volatile?.rage === true && battlers[actualTargetSide].hp > 0) {
      applyStatChange(actualTargetSide, side, { target: "self", stat: "attack", delta: 1 }, battlers, events);
    }
    if (damage > 0 && slot.move.functionCode === "093" && battlers[side].hp > 0) {
      const current = battlers[side];
      battlers[side] = withVolatile(current, { ...volatileOf(current), rage: true });
      events.push({ type: "volatileApplied", source: side, target: side, effect: "rage", turns: null, move: slot.move.internalName });
    }
    if (damage > 0 && slot.move.functionCode === "0F1" && battlers[side].hp > 0
      && battlers[actualTargetSide].hp > 0 && battlers[side].heldItem === null
      && battlers[actualTargetSide].heldItem !== null) {
      if (battlers[actualTargetSide].ability === "STICKYHOLD" && !hasMoldBreaker(battlers[side])) {
        events.push({ type: "abilityActivated", side: actualTargetSide, ability: "STICKYHOLD", effect: "block-move" });
      } else {
        const item = battlers[actualTargetSide].heldItem!;
        battlers[side] = { ...battlers[side], heldItem: item,
          heldItemTransfer: battlers[side].heldItemTransfer ?? { originalItem: null } };
        battlers[actualTargetSide] = { ...battlers[actualTargetSide], heldItem: null,
          heldItemTransfer: battlers[actualTargetSide].heldItemTransfer ?? { originalItem: item } };
        events.push({ type: "heldItemTransferred", source: actualTargetSide, target: side,
          item, move: slot.move.internalName });
      }
    }
    if (damage > 0 && slot.move.functionCode === "0F0" && battlers[actualTargetSide].heldItem !== null
      && battlers[actualTargetSide].hp > 0 && (battlers[actualTargetSide].ability !== "STICKYHOLD"
        || hasMoldBreaker(battlers[side]))) {
      const item = battlers[actualTargetSide].heldItem!;
      battlers[actualTargetSide] = { ...battlers[actualTargetSide], heldItem: null,
        heldItemTransfer: battlers[actualTargetSide].heldItemTransfer ?? { originalItem: item } };
      events.push({ type: "heldItemRemoved", source: side, target: actualTargetSide,
        item, move: slot.move.internalName });
    }
    if (damage > 0 && slot.move.functionCode === "0F4"
      && (battlers[actualTargetSide].heldItem === "ORANBERRY" || battlers[actualTargetSide].heldItem === "PAYAPABERRY"
        || battlers[actualTargetSide].heldItem === "LIECHIBERRY")) {
      if (battlers[actualTargetSide].ability === "STICKYHOLD" && !hasMoldBreaker(battlers[side])) {
        events.push({ type: "abilityActivated", side: actualTargetSide, ability: "STICKYHOLD", effect: "block-move" });
      } else {
        const berry = battlers[actualTargetSide].heldItem as "LIECHIBERRY" | "ORANBERRY" | "PAYAPABERRY";
        battlers[actualTargetSide] = { ...battlers[actualTargetSide], heldItem: null };
        events.push({ type: "heldItemConsumed", side: actualTargetSide, item: berry, effect: "eaten", hp: battlers[actualTargetSide].hp });
        if (berry === "ORANBERRY" && battlers[side].hp > 0) {
          const eater = battlers[side];
          const amount = Math.min(10, eater.stats.maxHp - eater.hp);
          battlers[side] = { ...eater, hp: eater.hp + amount };
          if (amount > 0) events.push({ type: "hpRestored", side, source: "move", move: slot.move.internalName,
            amount, hp: eater.hp + amount });
        }
        if (berry === "LIECHIBERRY" && battlers[side].hp > 0) {
          applyStatChange(side, actualTargetSide, { target: "self", stat: "attack", delta: 1 }, battlers, events);
        }
        battlers[side] = applyCheekPouch(battlers[side], side, events);
      }
    }
    if (damage > 0 && slot.move.functionCode === "0FA" && battlers[side].hp > 0
      && !["ROCKHEAD", "MAGICGUARD", "CABEZAHIELO"].includes(battlers[side].ability ?? "")
      && battlers[side].heldItem !== "CASCOPROTECTOR") {
      const attackerAfterHit = battlers[side];
      const amount = Math.min(attackerAfterHit.hp, Math.max(1, Math.round(damage / 4)));
      battlers[side] = { ...attackerAfterHit, hp: attackerAfterHit.hp - amount };
      events.push({ type: "recoilDamage", side, move: slot.move.internalName,
        amount, hp: attackerAfterHit.hp - amount });
      if (attackerAfterHit.hp - amount === 0) events.push({ type: "fainted", side });
    }
    const pickpocket = battlers[actualTargetSide];
    const stolenItem = battlers[side].heldItem;
    const itemTheftAllowed = actualTargetSide !== "opponent" || options.opponentItemTheft !== false;
    if (damage > 0 && side !== actualTargetSide && slot.move.flags?.includes("a") === true
      && pickpocket.hp > 0 && pickpocket.ability === "PICKPOCKET" && pickpocket.heldItem === null
      && stolenItem !== null && itemTheftAllowed) {
      battlers[side] = { ...battlers[side], heldItem: null };
      battlers[actualTargetSide] = { ...pickpocket, heldItem: stolenItem };
      effects.itemTransfers.push({ item: stolenItem, sourceId: battlers[side].id,
        targetId: battlers[actualTargetSide].id, reason: "pickpocket" });
      events.push({ type: "abilityActivated", side: actualTargetSide, ability: "PICKPOCKET", effect: "steal-item" },
        { type: "heldItemTransferred", source: side, target: actualTargetSide, item: stolenItem, reason: "pickpocket" });
    }
    const contact = damage > 0 && side !== actualTargetSide && slot.move.flags?.includes("a") === true;
    if (contact && defender.ability === "EFFECTSPORE" && draw(rng, trace, "ability", 10) < 3) {
      const attacker = battlers[side];
      const powderImmune = attacker.types.includes("GRASS") || attacker.ability === "OVERCOAT"
        || attacker.heldItem === "SAFETYGOGGLES";
      if (!powderImmune) {
        const status = (["poison", "sleep", "paralysis"] as const)[draw(rng, trace, "ability", 3)]!;
        applyAbilityStatus(actualTargetSide, side, "EFFECTSPORE", status, battlers, rng, events, trace);
      }
    }
    if (contact && defender.ability === "FLAMEBODY" && draw(rng, trace, "ability", 10) < 3) {
      applyAbilityStatus(actualTargetSide, side, "FLAMEBODY", "burn", battlers, rng, events, trace);
    }
    if (contact && defender.ability === "POISONPOINT" && draw(rng, trace, "ability", 10) < 3) {
      applyAbilityStatus(actualTargetSide, side, "POISONPOINT", "poison", battlers, rng, events, trace);
    }
    if (contact && (defender.ability === "ROUGHSKIN" || defender.ability === "IRONBARBS")
      && battlers[side].hp > 0 && battlers[side].ability !== "MAGICGUARD") {
      const attacker = battlers[side];
      const amount = Math.min(attacker.hp, Math.max(1, Math.floor(attacker.stats.maxHp / 8)));
      battlers[side] = { ...attacker, hp: attacker.hp - amount };
      const ability = defender.ability === "ROUGHSKIN" ? "ROUGHSKIN" : "IRONBARBS";
      events.push({ type: "abilityActivated", side: actualTargetSide, ability, effect: "damage-attacker" },
        { type: "abilityDamage", source: actualTargetSide, target: side, ability, amount, hp: attacker.hp - amount });
      if (attacker.hp - amount === 0) events.push({ type: "fainted", side });
    }
    if (contact && defender.ability === "STATIC" && draw(rng, trace, "ability", 10) < 3) {
      applyAbilityStatus(actualTargetSide, side, "STATIC", "paralysis", battlers, rng, events, trace);
    }
    if (contact && defender.ability === "GOOEY" && battlers[side].hp > 0) {
      events.push({ type: "abilityActivated", side: actualTargetSide, ability: "GOOEY", effect: "lower-speed" });
      applyStatChange(actualTargetSide, side, { target: "opponent", stat: "speed", delta: -1 }, battlers, events);
    }
    if (contact && battlers[side].ability === "POISONTOUCH" && battlers[actualTargetSide].hp > 0
      && battlers[actualTargetSide].majorStatus === null
      && !typePreventsStatus(battlers[actualTargetSide], "poison") && draw(rng, trace, "ability", 10) < 3) {
      applyAbilityStatus(side, actualTargetSide, "POISONTOUCH", "poison", battlers, rng, events, trace);
    }
    if (damage > 0 && slot.move.flags?.includes("a") === true && defender.heldItem === "ROCKYHELMET"
      && battlers[side].hp > 0 && battlers[side].ability !== "MAGICGUARD") {
      const current = battlers[side];
      const amount = Math.min(current.hp, Math.max(1, Math.floor(current.stats.maxHp / 6)));
      battlers[side] = { ...current, hp: current.hp - amount };
      events.push({ type: "itemActivated", side, item: "ROCKYHELMET", effect: "damage",
        amount, hp: current.hp - amount });
      if (current.hp - amount === 0) events.push({ type: "fainted", side });
    }
    const divisor = recoilDivisor(slot.move);
    if (damage > 0 && divisor !== null && battlers[side].hp > 0
      && battlers[side].ability !== "ROCKHEAD" && battlers[side].ability !== "MAGICGUARD") {
      const attacker = battlers[side];
      const amount = Math.min(attacker.hp, Math.round(damage / divisor));
      battlers[side] = { ...attacker, hp: attacker.hp - amount };
      if (amount > 0) events.push({ type: "recoilDamage", side, move: slot.move.internalName,
        reason: "recoil", amount, hp: attacker.hp - amount });
      if (attacker.hp - amount === 0) events.push({ type: "fainted", side });
    }
    if (options.attackerHeldItemAfterDamage !== false && damage > 0
      && battlers[side].heldItem === "LIFEORB" && battlers[side].hp > 0
      && battlers[side].ability !== "MAGICGUARD"
      && !(battlers[side].ability === "SHEERFORCE" && slot.move.effectChance > 0)) {
      const current = battlers[side];
      const amount = Math.min(current.hp, Math.max(1, Math.floor(current.stats.maxHp / 10)));
      battlers[side] = { ...current, hp: current.hp - amount };
      events.push({ type: "itemActivated", side, item: "LIFEORB", effect: "damage",
        amount, hp: current.hp - amount });
      if (current.hp - amount === 0) events.push({ type: "fainted", side });
    }
    if (hp === 0) {
      winner = opponentOf(actualTargetSide);
      events.push({ type: "fainted", side: actualTargetSide });
      if (options.endOfTurn !== false) events.push({ type: "battleEnded", winner });
    }
  }

  if (options.endOfTurn !== false && winner === null) {
    const playerFainted = battlers.player.hp === 0;
    const opponentFainted = battlers.opponent.hp === 0;
    if (playerFainted !== opponentFainted) {
      winner = playerFainted ? "opponent" : "player";
      events.push({ type: "battleEnded", winner });
    }
  }
  if (options.endOfTurn === false) winner = null;
  else {
    if (winner === null) winner = applyResidualStatus(battlers, events);
    if (winner === null) winner = applyResidualVolatile(battlers, events);
    if (winner === null) winner = applyHeldItems(battlers, events, rng, trace, effectiveWeather);
    tickBattleEffects(effects, events);
  }

  events.push({ type: "turnEnded", turn: state.turn });
  return {
    state: { turn: state.turn + (options.endOfTurn === false ? 0 : 1),
      status: winner === null ? "active" : "finished", winner, battlers, effects },
    events,
    trace,
  };
}

export function resolveTurn(state: BattleState, actions: TurnActions, rng: RandomSource): TurnResult {
  if (actions.player === undefined || actions.opponent === undefined) {
    throw new Error("Both sides must select a move action.");
  }
  return resolveSelectedMoves(state, actions, rng);
}
