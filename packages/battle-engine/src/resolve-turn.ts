import { calculateDamage, effectiveTypeMultiplier } from "./damage.js";
import { colorChangeType, knockoutAbilityStatReaction } from "./ability-after-hit.js";
import { activateWindAbility } from "./ability-wind.js";
import { resolveEntryAbility } from "./ability-entry.js";
import { damageAbilityStatReaction, opposingStatDropReaction,
  resolveStatStageChange, clearStatStages } from "./ability-stat-reactions.js";
import { cureStatusBlockedByAbility, statDropProtectionAbility, statusProtectionAbility } from "./ability-protection.js";
import { hasHighCriticalRate, isBombMove, isSoundMove, isWindMove, moveTargetsUser,
  recoilDivisor } from "./move-properties.js";
import { effectiveBattleWeather, ordinaryWeather, resolveWeatherEndOfTurn, weatherEvasionMultiplier,
  weatherSpeedMultiplier } from "./ability-weather.js";
import { isKnownType, REAL_BATTLE_TYPES, typeEffectiveness } from "./type-chart.js";
import { effectiveMovePriority, effectiveMoveType, hasMoldBreaker, hasMoveFlag } from "./move-properties.js";
import { transformBattler } from "./battle-transform.js";
import { resolveHealer, resolveHydration, resolveLateEndOfTurnAbilities, resolvePoisonHeal,
  sleepDurationForAbility } from "./ability-end-turn.js";
import { berriesBlockedBy, consumeHeldItem, heldItemIsActive, heldItemIsUnlosable, isSupportedBerry, moveCanTriggerPressure,
  removeHeldItem } from "./ability-item-control.js";
import { isGrounded } from "./ability-field-entry.js";
import { applyStanceChange } from "./ability-form.js";
import type { BattleEffects, BattleEvent, BattleMove, BattleSide, BattleState, BattleStat, BattleTrace, BattlerState, ImplementedBattleAbility, MajorStatusState, MoveAction, RandomSource, TurnActions, TurnResult } from "./types.js";

const SIDES = ["player", "opponent"] as const;

function opponentOf(side: BattleSide): BattleSide {
  return side === "player" ? "opponent" : "player";
}

function cloneBattler(battler: BattlerState): BattlerState {
  return { ...battler, types: [...battler.types], stats: { ...battler.stats }, stages: { ...battler.stages }, majorStatus: battler.majorStatus === null ? null : { ...battler.majorStatus },
    ...(battler.sketchedMoveSlots === undefined ? {} : { sketchedMoveSlots: battler.sketchedMoveSlots.map((entry) => ({
      index: entry.index, move: { ...entry.move },
    })) }),
    ...(battler.volatile === undefined ? {} : { volatile: { ...battler.volatile } }),
    moves: battler.moves.map((slot) => ({ ...slot, move: { ...slot.move } })) };
}

type BattleVolatile = Required<NonNullable<BattlerState["volatile"]>>;
type MutableBattleEffects = {
  sides: Record<BattleSide, { reflectTurns: number; lightScreenTurns: number; luckyChantTurns: number;
    spikesLayers: number; toxicSpikesLayers: number; stealthRock: boolean; stickyWeb: boolean;
    mistTurns: number; safeguardTurns: number; tailwindTurns: number }>;
  mudSportTurns: number;
  waterSportTurns: number;
  itemTransfers: { item: NonNullable<BattlerState["heldItem"]>; sourceId: string;
    targetId: string; reason: "pickpocket" }[];
  nextPickupUse: number;
  terrain: "electric" | "grassy" | "misty" | "psychic" | null;
  terrainTurns: number;
  trickRoomTurns: number;
  weather: NonNullable<BattleEffects["weather"]> | null;
  weatherTurns: number;
  fusionBoltTurn: number | null;
  fusionFlareTurn: number | null;
  environment: NonNullable<BattleEffects["environment"]>;
};

function volatileOf(battler: BattlerState): BattleVolatile {
  const neutral = { confusionTurns: 0, flinched: false, focusEnergy: 0, identified: false,
    disabledMove: null, disableTurns: 0, encoreMove: null, encoreTurns: 0,
    bindingMove: null, bindingTurns: 0, cursed: false, lastMoveUsed: null,
    lastUsedMove: null, lastMoveUsedType: null, lastSketchableMove: null, retaliation: null,
    mimicOriginalSlots: [],
    activeTurns: 0, enteredMidTurn: false, protected: false, endured: false, protectRate: 1, tauntTurns: 0, rage: false,
    flashFire: false, entryAbilityResolved: false, traceOriginalAbility: null, originalAbility: null,
    abilityReplacementActive: false,
    originalTypes: null,
    leechSeededBy: null, leechSeededBySlot: null, chargeTurns: 0, yawnTurns: 0,
    yawnBypassesAbility: false, infatuated: false,
    furyCutterCount: 0, rolloutTurns: 0, uproarTurns: 0, embargoTurns: 0,
    unburdened: false, pickupItem: null, pickupUse: 0, truantLoafing: false,
    choiceLockedMove: null, originalForm: null, originalStats: null, originalMoveStats: null,
    powerTrick: false, gastroAcid: false, weightChange: 0 };
  return { ...neutral, ...(battler.volatile ?? {}) };
}

function effectsOf(effects: BattleEffects | undefined): MutableBattleEffects {
  return effects === undefined ? { sides: {
    player: { reflectTurns: 0, lightScreenTurns: 0, luckyChantTurns: 0, spikesLayers: 0,
      toxicSpikesLayers: 0, stealthRock: false, stickyWeb: false, mistTurns: 0, safeguardTurns: 0, tailwindTurns: 0 },
    opponent: { reflectTurns: 0, lightScreenTurns: 0, luckyChantTurns: 0, spikesLayers: 0,
      toxicSpikesLayers: 0, stealthRock: false, stickyWeb: false, mistTurns: 0, safeguardTurns: 0, tailwindTurns: 0 },
  }, mudSportTurns: 0, waterSportTurns: 0, itemTransfers: [], terrain: null, terrainTurns: 0, trickRoomTurns: 0,
  nextPickupUse: 0, weather: null, weatherTurns: 0, fusionBoltTurn: null,
  fusionFlareTurn: null, environment: "none" } : { sides: {
    player: { ...effects.sides.player, lightScreenTurns: effects.sides.player.lightScreenTurns ?? 0,
      spikesLayers: effects.sides.player.spikesLayers ?? 0,
      toxicSpikesLayers: effects.sides.player.toxicSpikesLayers ?? 0,
      stealthRock: effects.sides.player.stealthRock ?? false,
      stickyWeb: effects.sides.player.stickyWeb ?? false,
      mistTurns: effects.sides.player.mistTurns ?? 0,
      safeguardTurns: effects.sides.player.safeguardTurns ?? 0,
      tailwindTurns: effects.sides.player.tailwindTurns ?? 0 },
    opponent: { ...effects.sides.opponent, lightScreenTurns: effects.sides.opponent.lightScreenTurns ?? 0,
      spikesLayers: effects.sides.opponent.spikesLayers ?? 0,
      toxicSpikesLayers: effects.sides.opponent.toxicSpikesLayers ?? 0,
      stealthRock: effects.sides.opponent.stealthRock ?? false,
      stickyWeb: effects.sides.opponent.stickyWeb ?? false,
      mistTurns: effects.sides.opponent.mistTurns ?? 0,
      safeguardTurns: effects.sides.opponent.safeguardTurns ?? 0,
      tailwindTurns: effects.sides.opponent.tailwindTurns ?? 0 },
  }, mudSportTurns: effects.mudSportTurns ?? 0, waterSportTurns: effects.waterSportTurns,
  itemTransfers: [...(effects.itemTransfers ?? [])],
  nextPickupUse: effects.nextPickupUse ?? 0,
  terrain: effects.terrain ?? null, terrainTurns: effects.terrainTurns ?? 0,
  trickRoomTurns: effects.trickRoomTurns ?? 0,
  weather: effects.weather ?? null, weatherTurns: effects.weatherTurns ?? 0,
  fusionBoltTurn: effects.fusionBoltTurn ?? null, fusionFlareTurn: effects.fusionFlareTurn ?? null,
  environment: effects.environment ?? "none" };
}

function withVolatile(battler: BattlerState, volatile: BattleVolatile): BattlerState {
  return { ...battler, volatile };
}

function withTemporaryAbility(battler: BattlerState, ability: BattlerState["ability"]): BattlerState {
  const current = volatileOf(battler);
  return withVolatile({ ...battler, ability }, { ...current,
    originalAbility: current.abilityReplacementActive
      ? current.originalAbility : current.traceOriginalAbility ?? battler.ability,
    abilityReplacementActive: true });
}

function withTemporaryTypes(battler: BattlerState, types: readonly string[]): BattlerState {
  const current = volatileOf(battler);
  return withVolatile({ ...battler, types: [...types] }, { ...current,
    originalTypes: current.originalTypes ?? [...battler.types] });
}

function applyTemporaryAbility(source: BattleSide, target: BattleSide,
  ability: NonNullable<BattlerState["ability"]>, move: BattleMove,
  battlers: Record<BattleSide, BattlerState>, events: BattleEvent[]): void {
  const previous = battlers[target];
  const changed = withTemporaryAbility(previous, ability);
  if (previous.ability === "ILLUSION" && previous.illusion !== undefined) {
    const { illusion: _illusion, ...revealed } = changed;
    battlers[target] = revealed;
    events.push({ type: "abilityActivated", side: target, ability: "ILLUSION", effect: "announce" });
  } else battlers[target] = changed;
  events.push({ type: "abilityChanged", source, target, ability, move: move.internalName });
}

function consumeTrackedItem(battler: BattlerState, item: NonNullable<BattlerState["heldItem"]>,
  effects: MutableBattleEffects, options: { readonly recyclable?: boolean; readonly pickup?: boolean } = {}): BattlerState {
  effects.nextPickupUse += 1;
  return consumeHeldItem(battler, item, effects.nextPickupUse, options);
}

function effectiveSpeed(battler: BattlerState, tailwind = false, terrain?: BattleEffects["terrain"]): number {
  const stage = battler.stages.speed;
  const staged = stage >= 0
    ? Math.floor((battler.stats.speed * (2 + stage)) / 2)
    : Math.floor((battler.stats.speed * 2) / (2 - stage));
  let speed = battler.ability === "QUICKFEET" && battler.majorStatus !== null ? Math.max(1, Math.round(staged * 1.5))
    : battler.ability === "ACOMETIDA" && (battler.volatile?.activeTurns ?? 0) === 0 ? Math.max(1, Math.round(staged * 1.5))
      : battler.ability === "UNBURDEN" && battler.heldItem === null && battler.volatile?.unburdened === true ? staged * 2
        : battler.majorStatus?.kind === "paralysis" ? Math.max(1, Math.round(staged / 4)) : staged;
  if (tailwind) speed *= 2;
  if (battler.ability === "SURGESURFER" && terrain === "electric") speed *= 2;
  if (battler.ability === "SILVANO" && terrain === "grassy") speed = Math.max(1, Math.round(speed * 1.3));
  if (battler.ability === "SLOWSTART" && (battler.volatile?.activeTurns ?? 0) <= 5) {
    speed = Math.max(1, Math.round(speed * 0.5));
  }
  return speed;
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

function applySelfStatChanges(source: BattleSide, changes: readonly { readonly stat: BattleStat; readonly delta: number }[],
  battlers: Record<BattleSide, BattlerState>, events: BattleEvent[]): boolean {
  let changed = false;
  for (const change of changes) changed = applyStatChange(source, opponentOf(source),
    { target: "self", stat: change.stat, delta: change.delta }, battlers, events) || changed;
  return changed;
}

function clearBattlerStages(source: BattleSide, target: BattleSide,
  battlers: Record<BattleSide, BattlerState>, events: BattleEvent[]): void {
  const reset = clearStatStages(battlers[target]);
  battlers[target] = reset.battler;
  for (const change of reset.changes) events.push({ type: "statStageChanged", source, target,
    stat: change.stat, delta: change.delta, stage: 0 });
}

const COMBINED_SELF_BOOSTS: Readonly<Partial<Record<BattleMove["functionCode"], readonly {
  readonly stat: BattleStat; readonly delta: number
}[]>>> = {
  "024": [{ stat: "attack", delta: 1 }, { stat: "defense", delta: 1 }],
  "025": [{ stat: "attack", delta: 1 }, { stat: "defense", delta: 1 }, { stat: "accuracy", delta: 1 }],
  "026": [{ stat: "attack", delta: 1 }, { stat: "speed", delta: 1 }],
  "029": [{ stat: "attack", delta: 1 }, { stat: "accuracy", delta: 1 }],
  "02A": [{ stat: "defense", delta: 1 }, { stat: "specialDefense", delta: 1 }],
  "02B": [{ stat: "specialAttack", delta: 1 }, { stat: "specialDefense", delta: 1 }, { stat: "speed", delta: 1 }],
  "02C": [{ stat: "specialAttack", delta: 1 }, { stat: "specialDefense", delta: 1 }],
  "036": [{ stat: "speed", delta: 2 }, { stat: "attack", delta: 1 }],
  "038": [{ stat: "defense", delta: 3 }],
  "039": [{ stat: "specialAttack", delta: 3 }],
};

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
  effects?: MutableBattleEffects,
): boolean {
  const target = effect.target === "self" ? source : opponent;
  const battler = battlers[target];
  const opposingMoldBreaker = target !== source && hasMoldBreaker(battlers[source]);
  if (effect.delta < 0 && target !== source && battler.ability === "MIRRORARMOR" && !opposingMoldBreaker) {
    events.push({ type: "abilityActivated", side: target, ability: "MIRRORARMOR", effect: "reflect-stat-drop" });
    const reflected = battlers[source];
    const resolvedReflection = resolveStatStageChange(reflected, effect.stat, effect.delta);
    const reflectedDelta = resolvedReflection?.delta
      ?? (reflected.ability === "CONTRARY" ? -effect.delta : effect.delta);
    if (reflectedDelta < 0 && (effects?.sides[source].mistTurns ?? 0) > 0
      && battler.ability !== "INFILTRATOR") {
      events.push({ type: "statStageChangeFailed", source: target, target: source,
        stat: effect.stat, reason: "mist" });
      return false;
    }
    const protection = reflectedDelta < 0 ? statDropProtectionAbility(reflected, effect.stat) : null;
    if (protection !== null) {
      events.push({ type: "abilityActivated", side: source, ability: protection, effect: "prevent-stat-drop" });
      return false;
    }
    if (resolvedReflection === null) {
      events.push({ type: "statStageChangeFailed", source: target, target: source,
        stat: effect.stat, reason: "limit" });
      return false;
    }
    battlers[source] = resolvedReflection.battler;
    events.push({ type: "statStageChanged", source: target, target: source, stat: effect.stat,
      delta: resolvedReflection.delta, stage: resolvedReflection.stage });
    const reaction = resolvedReflection.delta < 0 ? opposingStatDropReaction(battlers[source]) : null;
    if (reaction !== null) {
      const reactionStart = events.length;
      if (applyStatChange(source, target, { target: "self", ...reaction }, battlers, events, effects)) {
        events.splice(reactionStart, 0, { type: "abilityActivated", side: source,
          ability: battlers[source].ability as "COMPETITIVE" | "DEFIANT", effect: "raise-stat" });
      }
    }
    return true;
  }
  const resolved = resolveStatStageChange(battler, effect.stat, effect.delta, opposingMoldBreaker);
  const effectiveDelta = resolved?.delta ?? (battler.ability === "CONTRARY" && !opposingMoldBreaker
    ? -effect.delta : effect.delta);
  if (effectiveDelta < 0 && target !== source && (effects?.sides[target].mistTurns ?? 0) > 0
    && battlers[source].ability !== "INFILTRATOR") {
    events.push({ type: "statStageChangeFailed", source, target, stat: effect.stat, reason: "mist" });
    return false;
  }
  const preventingAbility = effectiveDelta < 0 && target !== source && !opposingMoldBreaker
    ? statDropProtectionAbility(battler, effect.stat) : null;
  if (preventingAbility !== null) {
    events.push({ type: "abilityActivated", side: target, ability: preventingAbility, effect: "prevent-stat-drop" });
    return false;
  }
  if (resolved === null) {
    events.push({ type: "statStageChangeFailed", source, target, stat: effect.stat, reason: "limit" });
    return false;
  }
  battlers[target] = resolved.battler;
  events.push({ type: "statStageChanged", source, target, stat: effect.stat,
    delta: resolved.delta, stage: resolved.stage });
  if (resolved.delta < 0 && target !== source) {
    const reaction = opposingStatDropReaction(battlers[target]);
    if (reaction !== null) {
      const reactionStart = events.length;
      if (applyStatChange(target, source, { target: "self", ...reaction }, battlers, events, effects)) {
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
    const maximum = battler.ability === "CONTRARY" ? -6 : 6;
    if (current !== maximum) {
      battlers[target] = { ...battler, stages: { ...battler.stages, [reaction.maximize]: maximum } };
      events.push({ type: "statStageChanged", source: target, target, stat: reaction.maximize,
        delta: maximum - current, stage: maximum });
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
  const heals = ((ability === "DRYSKIN" || ability === "WATERABSORB") && moveType === "WATER")
    || ability === "VOLTABSORB" && moveType === "ELECTRIC"
    || ability === "EARTHEATER" && moveType === "GROUND";
  const raisedStat = ability === "SAPSIPPER" && moveType === "GRASS" ? { stat: "attack" as const, delta: 1 }
    : (ability === "STORMDRAIN" && moveType === "WATER")
      || (ability === "LIGHTNINGROD" && moveType === "ELECTRIC")
      || (ability === "DESPIERTALLAMA" && moveType === "FIRE")
      ? { stat: "specialAttack" as const, delta: 1 }
      : ability === "MOTORDRIVE" && moveType === "ELECTRIC" ? { stat: "speed" as const, delta: 1 }
        : ability === "CUERPOHORNEADO" && moveType === "FIRE" ? { stat: "defense" as const, delta: 2 }
          : null;
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
    applyStatChange(target, source, { target: "self", ...raisedStat }, battlers, events);
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
  hazeSelfOnly = false,
): void {
  if (move.functionCode === "05C" || move.functionCode === "05D") {
    const user = battlers[source];
    const copied = move.functionCode === "05C"
      ? battlers[target].volatile?.lastUsedMove : battlers[target].volatile?.lastSketchableMove;
    const blacklist = move.functionCode === "05C"
      ? ["002", "014", "05C", "05D", "0B6"] : ["002", "014", "05D"];
    const index = user.moves.findIndex((slot) => slot.move.id === move.id);
    if (user.transformOriginal !== undefined || copied == null || copied.type === "SHADOW"
      || blacklist.includes(copied.functionCode) || user.moves.some((slot) => slot.move.id === copied.id)
      || index < 0) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    const replacement = { move: { ...copied }, pp: copied.pp };
    const moves = user.moves.map((slot, slotIndex) => slotIndex === index ? replacement : slot);
    if (move.functionCode === "05C") {
      const current = volatileOf(user);
      battlers[source] = withVolatile({ ...user, moves }, { ...current,
        mimicOriginalSlots: [...current.mimicOriginalSlots,
          { index, slot: { ...user.moves[index]!, move: { ...user.moves[index]!.move } } }] });
    } else {
      battlers[source] = { ...user, moves, sketchedMoveSlots: [
        ...(user.sketchedMoveSlots ?? []).filter((entry) => entry.index !== index),
        { index, move: { ...copied } },
      ] };
    }
    events.push({ type: "moveCopied", side: source, move: move.internalName,
      copiedMove: copied.internalName, permanent: move.functionCode === "05D" });
    return;
  }
  if (move.functionCode === "05E" || move.functionCode === "05F") {
    const user = battlers[source];
    if (user.ability === "MULTITYPE") {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    let choices: string[] = [];
    if (move.functionCode === "05E") {
      const candidate = user.moves.find((slot) => slot.move.id !== move.id
        && isKnownType(slot.move.type) && slot.move.type !== "QMARKS"
        && !user.types.includes(slot.move.type));
      if (candidate !== undefined) choices = [candidate.move.type];
    } else {
      const lastType = battlers[target].volatile?.lastMoveUsedType;
      if (battlers[target].volatile?.lastUsedMove != null && lastType != null
        && isKnownType(lastType) && lastType !== "QMARKS") {
        choices = REAL_BATTLE_TYPES.filter((type) => !user.types.includes(type)
          && typeEffectiveness(lastType, [type]) < 1);
      }
    }
    if (choices.length === 0) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    const selected = choices[draw(rng, trace, move.functionCode === "05E" ? "conversion" : "conversion2",
      choices.length)]!;
    battlers[source] = withTemporaryTypes(user, [selected]);
    events.push({ type: "typesChanged", source, target: source,
      types: [selected], move: move.internalName });
    return;
  }
  if (move.functionCode === "067") {
    const user = battlers[source];
    const defender = battlers[target];
    const excluded = ["ILLUSION", "MULTITYPE", "DISGUISE", "STANCECHANGE", "WONDERGUARD"];
    if (user.ability === null && defender.ability === null
      || excluded.includes(user.ability ?? "") || excluded.includes(defender.ability ?? "")) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    battlers[source] = withTemporaryAbility(user, defender.ability);
    battlers[target] = withTemporaryAbility(defender, user.ability);
    events.push({ type: "abilitiesSwapped", source, target,
      sourceAbility: defender.ability, targetAbility: user.ability, move: move.internalName });
    for (const side of [source, target]) {
      const current = battlers[side];
      const other = side === source ? target : source;
      const reset = withVolatile(current, { ...volatileOf(current), entryAbilityResolved: false });
      const entry = resolveEntryAbility(side, reset, [{ side: other, battler: battlers[other] }],
        rng, trace, side === "player", false, effects);
      battlers[side] = entry.battler;
      battlers[other] = entry.opponents[0]?.battler ?? battlers[other];
      events.push(...entry.events);
    }
    return;
  }
  if (move.functionCode === "068") {
    const defender = battlers[target];
    if (["MULTITYPE", "DISGUISE", "STANCECHANGE"].includes(defender.ability ?? "")) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    const suppressed = withTemporaryAbility(defender, null);
    const volatile = { ...volatileOf(suppressed), gastroAcid: true, truantLoafing: false };
    if (defender.ability === "ILLUSION" && defender.illusion !== undefined) {
      const { illusion: _illusion, ...revealed } = suppressed;
      battlers[target] = withVolatile(revealed, volatile);
      events.push({ type: "abilityActivated", side: target, ability: "ILLUSION", effect: "announce" });
    } else battlers[target] = withVolatile(suppressed, volatile);
    events.push({ type: "abilitySuppressed", source, target, move: move.internalName });
    return;
  }
  if (move.functionCode === "05A") {
    const average = Math.floor((battlers[source].hp + battlers[target].hp) / 2);
    for (const side of [source, target]) {
      const current = battlers[side];
      const hp = Math.min(average, current.stats.maxHp);
      battlers[side] = { ...current, hp };
      events.push({ type: "hpShared", side, move: move.internalName, hp });
    }
    return;
  }
  if (["060", "061", "062"].includes(move.functionCode)) {
    const user = battlers[source];
    const defender = battlers[target];
    let changedSide: BattleSide = source;
    let types: readonly string[];
    if (move.functionCode === "060") {
      const environmentTypes: Record<NonNullable<BattleEffects["environment"]>, string> = {
        none: "NORMAL", grass: "GRASS", "tall-grass": "GRASS", forest: "BUG",
        "moving-water": "WATER", "still-water": "WATER", underwater: "WATER",
        cave: "ROCK", rock: "GROUND", sand: "GROUND", snow: "ICE",
        volcano: "FIRE", graveyard: "GHOST", sky: "FLYING", space: "DRAGON",
      };
      const terrainTypes = { electric: "ELECTRIC", grassy: "GRASS", misty: "FAIRY",
        psychic: "PSYCHIC" } as const;
      const type = effects.terrain === null ? environmentTypes[effects.environment]
        : terrainTypes[effects.terrain];
      types = [type];
      if (user.ability === "MULTITYPE" || user.types.includes(type)) {
        events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
        return;
      }
    } else if (move.functionCode === "061") {
      changedSide = target;
      types = ["WATER"];
      if (defender.ability === "MULTITYPE" || defender.types.length === 1 && defender.types[0] === "WATER") {
        events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
        return;
      }
    } else {
      types = [...defender.types];
      if (user.ability === "MULTITYPE" || user.types.length === types.length
        && user.types.every((type) => types.includes(type))) {
        events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
        return;
      }
    }
    battlers[changedSide] = withTemporaryTypes(battlers[changedSide], types);
    events.push({ type: "typesChanged", source, target: changedSide, types,
      move: move.internalName });
    return;
  }
  if (["063", "065", "066"].includes(move.functionCode)) {
    const user = battlers[source];
    const defender = battlers[target];
    let changedSide: BattleSide = target;
    let ability: BattlerState["ability"] = "SIMPLE";
    let blocked = false;
    if (move.functionCode === "063") {
      blocked = ["MULTITYPE", "SIMPLE", "DISGUISE", "STANCECHANGE", "TRUANT"]
        .includes(defender.ability ?? "");
    } else if (move.functionCode === "065") {
      changedSide = source;
      ability = defender.ability;
      blocked = ability === null || user.ability === ability
        || ["MULTITYPE", "STANCECHANGE"].includes(user.ability ?? "")
        || ["FLOWERGIFT", "FORECAST", "ILLUSION", "IMPOSTER", "MULTITYPE", "DISGUISE",
          "STANCECHANGE", "TRACE", "WONDERGUARD", "ZENMODE"].includes(ability ?? "");
    } else {
      ability = user.ability;
      blocked = ability === null || ability === defender.ability
        || ["FLOWERGIFT", "IMPOSTER", "MULTITYPE", "STANCECHANGE", "TRACE", "TRUANT",
          "ZENMODE", "DISGUISE"].includes(defender.ability ?? "")
        || ["FLOWERGIFT", "DISGUISE", "FORECAST", "ILLUSION", "IMPOSTER", "MULTITYPE",
          "STANCECHANGE", "TRACE", "ZENMODE"].includes(ability ?? "");
    }
    if (blocked || ability === null) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    applyTemporaryAbility(source, changedSide, ability, move, battlers, events);
    return;
  }
  const stageStats: readonly BattleStat[] = ["attack", "defense", "speed", "specialAttack",
    "specialDefense", "accuracy", "evasion"];
  if (["052", "053", "054", "055"].includes(move.functionCode)) {
    const stats = move.functionCode === "052" ? ["attack", "specialAttack"] as const
      : move.functionCode === "053" ? ["defense", "specialDefense"] as const : stageStats;
    const user = battlers[source];
    const defender = battlers[target];
    const userStages = { ...user.stages };
    const targetStages = { ...defender.stages };
    for (const stat of stats) {
      userStages[stat] = defender.stages[stat];
      if (move.functionCode !== "055") targetStages[stat] = user.stages[stat];
    }
    battlers[source] = { ...user, stages: userStages };
    if (move.functionCode !== "055") battlers[target] = { ...defender, stages: targetStages };
    for (const stat of stats) {
      const ownDelta = userStages[stat] - user.stages[stat];
      if (ownDelta !== 0) events.push({ type: "statStageChanged", source, target: source,
        stat, delta: ownDelta, stage: userStages[stat] });
      const targetDelta = targetStages[stat] - defender.stages[stat];
      if (move.functionCode !== "055" && targetDelta !== 0) events.push({
        type: "statStageChanged", source, target, stat, delta: targetDelta, stage: targetStages[stat],
      });
    }
    return;
  }
  if (["057", "058", "059"].includes(move.functionCode)) {
    const stats = move.functionCode === "059" ? ["defense", "specialDefense"] as const
      : move.functionCode === "057" ? ["attack", "defense"] as const
        : ["attack", "specialAttack"] as const;
    const user = battlers[source];
    const defender = battlers[target];
    const ownStats = { ...user.stats };
    const targetStats = { ...defender.stats };
    if (move.functionCode === "057") {
      ownStats.attack = user.stats.defense;
      ownStats.defense = user.stats.attack;
    } else {
      for (const stat of stats) {
        const average = Math.floor((user.stats[stat] + defender.stats[stat]) / 2);
        ownStats[stat] = average;
        targetStats[stat] = average;
      }
    }
    battlers[source] = withVolatile({ ...user, stats: ownStats }, {
      ...volatileOf(user), originalMoveStats: user.volatile?.originalMoveStats ?? user.stats,
      powerTrick: move.functionCode === "057" ? !user.volatile?.powerTrick : user.volatile?.powerTrick ?? false,
    });
    events.push({ type: "battleStatsChanged", source, target: source,
      move: move.internalName, stats });
    if (move.functionCode !== "057") {
      battlers[target] = withVolatile({ ...defender, stats: targetStats }, {
        ...volatileOf(defender), originalMoveStats: defender.volatile?.originalMoveStats ?? defender.stats,
      });
      events.push({ type: "battleStatsChanged", source, target, move: move.internalName, stats });
    }
    return;
  }
  if (move.functionCode === "037") {
    const stats: readonly BattleStat[] = ["attack", "defense", "speed", "specialAttack",
      "specialDefense", "accuracy", "evasion"];
    const eligible = stats.filter((stat) => resolveStatStageChange(battlers[target], stat, 2) !== null);
    if (eligible.length === 0) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    const stat = eligible[draw(rng, trace, "acupressure", eligible.length)]!;
    const raised = resolveStatStageChange(battlers[target], stat, 2)!;
    battlers[target] = raised.battler;
    events.push({ type: "statStageChanged", source, target, stat, delta: raised.delta, stage: raised.stage });
    return;
  }
  if (move.functionCode === "03A") {
    const user = battlers[source];
    const cost = Math.floor(user.stats.maxHp / 2);
    const desired = user.ability === "CONTRARY" ? -6 : 6;
    if (user.hp <= cost || user.stages.attack === desired) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    battlers[source] = { ...user, hp: user.hp - cost,
      stages: { ...user.stages, attack: desired } };
    events.push({ type: "recoilDamage", side: source, move: move.internalName,
      reason: "belly-drum", amount: cost, hp: user.hp - cost });
    events.push({ type: "statStageChanged", source, target: source, stat: "attack",
      delta: desired - user.stages.attack, stage: desired });
    return;
  }
  if (move.functionCode === "051") {
    clearBattlerStages(source, source, battlers, events);
    if (!hazeSelfOnly && target !== source) clearBattlerStages(source, target, battlers, events);
    return;
  }
  if (move.functionCode === "056") {
    const current = effects.sides[source];
    if (current.mistTurns > 0) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    effects.sides[source] = { ...current, mistTurns: 5 };
    events.push({ type: "battleEffectChanged", side: source, effect: "mist", turns: 5 });
    return;
  }
  if (move.functionCode === "040" || move.functionCode === "041") {
    const stat: BattleStat = move.functionCode === "040" ? "specialAttack" : "attack";
    const raised = applyStatChange(source, target, { target: "opponent", stat,
      delta: move.functionCode === "040" ? 1 : 2 }, battlers, events, effects);
    const defender = battlers[target];
    const protectedBySafeguard = source !== target && effects.sides[target].safeguardTurns > 0
      && battlers[source].ability !== "INFILTRATOR";
    const protectedByOwnTempo = defender.ability === "OWNTEMPO" && !hasMoldBreaker(battlers[source]);
    let confused = false;
    if (protectedByOwnTempo) events.push({ type: "abilityActivated", side: target,
      ability: "OWNTEMPO", effect: "prevent-confusion" });
    if (defender.hp > 0 && volatileOf(defender).confusionTurns === 0
      && !protectedBySafeguard && !protectedByOwnTempo) {
      const turns = 2 + draw(rng, trace, "confusion-duration", 4);
      battlers[target] = withVolatile(defender, { ...volatileOf(defender), confusionTurns: turns });
      events.push({ type: "volatileApplied", source, target, effect: "confusion", turns,
        move: move.internalName });
      confused = true;
    }
    if (!raised && !confused) events.push({ type: "moveFailed", side: source,
      move: move.internalName, reason: "condition" });
    return;
  }
  if (move.functionCode === "021") {
    const attacker = battlers[source];
    battlers[source] = withVolatile(attacker, { ...volatileOf(attacker), chargeTurns: 2 });
    events.push({ type: "volatileApplied", source, target: source, effect: "charge", turns: 2,
      move: move.internalName });
    applyStatChange(source, target, { target: "self", stat: "specialDefense", delta: 1 }, battlers, events);
    return;
  }
  if (move.functionCode === "031") {
    if (!applyStatChange(source, target, { target: "self", stat: "speed", delta: 2 }, battlers, events)) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    const current = battlers[source];
    battlers[source] = withVolatile(current, { ...volatileOf(current),
      weightChange: (current.volatile?.weightChange ?? 0) - 1_000 });
    return;
  }
  if (move.functionCode === "035") {
    const raises = ["attack", "specialAttack", "speed"] as const;
    if (!raises.some((stat) => resolveStatStageChange(battlers[source], stat, 2) !== null)) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    applySelfStatChanges(source, [
      { stat: "defense", delta: -1 }, { stat: "specialDefense", delta: -1 },
      { stat: "attack", delta: 2 }, { stat: "specialAttack", delta: 2 }, { stat: "speed", delta: 2 },
    ], battlers, events);
    return;
  }
  if (move.functionCode === "02D") {
    applySelfStatChanges(source, ["attack", "defense", "specialAttack", "specialDefense", "speed"]
      .map((stat) => ({ stat: stat as BattleStat, delta: 1 })), battlers, events);
    return;
  }
  const boosts = COMBINED_SELF_BOOSTS[move.functionCode];
  if (boosts !== undefined) {
    if (!applySelfStatChanges(source, boosts, battlers, events) && move.category === "Status") {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
    }
    return;
  }
  if (move.functionCode === "04A" || move.functionCode === "04E") {
    const defender = battlers[target];
    const sourceGender = battlers[source].appearance?.gender;
    const targetGender = defender.appearance?.gender;
    const wrongGender = move.functionCode === "04E"
      && (sourceGender !== "male" && sourceGender !== "female"
        || targetGender !== "male" && targetGender !== "female"
        || sourceGender === targetGender);
    if (wrongGender || move.functionCode === "04A" && source !== target && effects.sides[target].mistTurns > 0
      || move.functionCode === "04E" && defender.ability === "OBLIVIOUS" && !hasMoldBreaker(battlers[source])) {
      if (move.functionCode === "04E" && defender.ability === "OBLIVIOUS" && !hasMoldBreaker(battlers[source])
        && !wrongGender) events.push({ type: "abilityActivated", side: target, ability: "OBLIVIOUS",
        effect: "prevent-infatuation" });
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    const drops: readonly { readonly stat: BattleStat; readonly delta: number }[] = move.functionCode === "04A"
      ? [{ stat: "attack", delta: -1 }, { stat: "defense", delta: -1 }]
      : [{ stat: "specialAttack", delta: -2 }];
    let changed = false;
    for (const drop of drops) changed = applyStatChange(source, target,
      { target: "opponent", ...drop }, battlers, events, effects) || changed;
    if (!changed && move.category === "Status") events.push({
      type: "moveFailed", side: source, move: move.internalName, reason: "condition",
    });
    return;
  }
  if (move.functionCode === "02E" || move.functionCode === "032") {
    const stat: BattleStat = move.functionCode === "02E" ? "attack" : "specialAttack";
    if (!applyStatChange(source, target, { target: "self", stat, delta: 2 }, battlers, events)
      && move.category === "Status") {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
    }
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
    applyTemporaryAbility(source, target, "INSOMNIA", move, battlers, events);
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
    applyStatChange(source, target, change, battlers, events, effects);
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
    battlers[target] = withVolatile(defender, { ...current, yawnTurns: 2,
      yawnBypassesAbility: source !== target && hasMoldBreaker(battlers[source]) });
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
    if (defender.ability === "OBLIVIOUS" && !hasMoldBreaker(battlers[source])) {
      events.push({ type: "abilityActivated", side: target, ability: "OBLIVIOUS", effect: "prevent-infatuation" },
        { type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
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
    applyStatChange(source, target, { target: "opponent", stat: "evasion", delta: -1 }, battlers, events, effects);
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
  if (move.functionCode === "05B") {
    effects.sides[source] = { ...effects.sides[source], tailwindTurns: 4 };
    events.push({ type: "battleEffectChanged", side: source, effect: "tailwind", turns: 4 });
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
    if (defender.ability === "OBLIVIOUS" && !hasMoldBreaker(battlers[source])) {
      events.push({ type: "abilityActivated", side: target, ability: "OBLIVIOUS", effect: "prevent-taunt" },
        { type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
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
  status: "poison" | "burn" | "paralysis" | "sleep" | "hemorrhage", battlers: Record<BattleSide, BattlerState>,
  rng: RandomSource, events: BattleEvent[], trace: BattleTrace[]): boolean {
  const battler = battlers[target];
  if (battler.hp <= 0 || battler.majorStatus !== null || typePreventsStatus(battler, status)) return false;
  const protection = source !== target && hasMoldBreaker(battlers[source])
    ? null : statusProtectionAbility(battler, status);
  if (protection !== null) {
    events.push({ type: "abilityActivated", side: target, ability: protection, effect: "prevent-status" });
    return false;
  }
  const majorStatus: MajorStatusState = status === "sleep"
    ? { kind: status, turnsRemaining: sleepDurationForAbility(battler, 2 + draw(rng, trace, "sleep-duration", 3)) }
    : status === "poison" ? { kind: status, toxicCounter: null } : { kind: status };
  battlers[target] = { ...battler, majorStatus };
  events.push({ type: "abilityActivated", side: source, ability,
    effect: ability === "STATIC" ? "inflict-paralysis" : "inflict-status" });
  events.push({ type: "statusApplied", source, target, status });
  return true;
}

function applyPoisonPuppeteer(source: BattleSide, target: BattleSide, move: BattleMove,
  battlers: Record<BattleSide, BattlerState>, rng: RandomSource, events: BattleEvent[], trace: BattleTrace[]): void {
  const attacker = battlers[source];
  const defender = battlers[target];
  if (source === target || attacker.ability !== "POISONPUPPETEER" || defender.hp <= 0
    || volatileOf(defender).confusionTurns > 0 || defender.ability === "OWNTEMPO") return;
  const turns = 2 + draw(rng, trace, "confusion-duration", 4);
  battlers[target] = withVolatile(defender, { ...volatileOf(defender), confusionTurns: turns });
  events.push({ type: "abilityActivated", side: source, ability: "POISONPUPPETEER", effect: "inflict-status" },
    { type: "volatileApplied", source, target, effect: "confusion", turns, move: move.internalName });
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
  if (source !== target && effects.sides[target].safeguardTurns > 0
    && battlers[source].ability !== "INFILTRATOR") {
    events.push({ type: "statusApplicationFailed", source, target, status: kind, reason: "safeguard" });
    return;
  }
  const protection = source !== target && hasMoldBreaker(battlers[source])
    ? null : statusProtectionAbility(defender, kind);
  if (protection !== null) {
    events.push({ type: "abilityActivated", side: target, ability: protection, effect: "prevent-status" },
      { type: "statusApplicationFailed", source, target, status: kind, reason: "ability-immune" });
    return;
  }
  const blockedByType = typePreventsStatus(defender, kind)
    && !(kind === "poison" && battlers[source].ability === "CORROSION");
  if (blockedByType
    || ordinaryWeather(weather) === "sun" && defender.ability === "LEAFGUARD"
    || kind === "sleep" && (SIDES.some((side) => volatileOf(battlers[side]).uproarTurns > 0)
      || effects.terrain === "electric" && isGrounded(defender))) {
    events.push({ type: "statusApplicationFailed", source, target, status: kind, reason: "type-immune" });
    return;
  }
  const majorStatus: MajorStatusState = kind === "sleep"
    ? { kind, turnsRemaining: sleepDurationForAbility(defender, 2 + draw(rng, trace, "sleep-duration", 3)) }
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
  if (kind === "poison") applyPoisonPuppeteer(source, target, move, battlers, rng, events, trace);
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
  if (battler.ability === "TRUANT" && volatile.truantLoafing) {
    events.push({ type: "abilityActivated", side, ability: "TRUANT", effect: "skip-turn" },
      { type: "actionSkipped", side, reason: "truant" });
    return false;
  }
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
      battlers[side] = withVolatile({ ...battler, majorStatus: null },
        { ...volatileOf(battler), truantLoafing: false });
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

export function resolveBattleVolatileEndOfTurn(battler: BattlerState, side: BattleSide,
  terrain: BattleEffects["terrain"] = null): {
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
    const yawnBypassesAbility = volatile.yawnBypassesAbility;
    volatile = { ...volatile, yawnTurns, yawnBypassesAbility: yawnTurns === 0 ? false : yawnBypassesAbility };
    if (yawnTurns === 0 && next.majorStatus === null && !(terrain === "electric" && isGrounded(next))) {
      const protection = yawnBypassesAbility ? null : statusProtectionAbility(next, "sleep");
      if (protection !== null) {
        events.push({ type: "abilityActivated", side, ability: protection, effect: "prevent-status" },
          { type: "statusApplicationFailed", source: opponentOf(side), target: side,
            status: "sleep", reason: "ability-immune" });
      } else {
        next = { ...next, majorStatus: { kind: "sleep", turnsRemaining: sleepDurationForAbility(next, 2) } };
        events.push({ type: "statusApplied", source: opponentOf(side), target: side, status: "sleep" });
      }
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
  if (next.ability === "TRUANT" && !volatile.enteredMidTurn) {
    volatile = { ...volatile, truantLoafing: !volatile.truantLoafing };
  }
  volatile = { ...volatile, flinched: false,
    protectRate: volatile.protected || volatile.endured ? volatile.protectRate : 1,
    protected: false, endured: false,
    activeTurns: Math.min(999, volatile.activeTurns + 1) };
  return { battler: withVolatile(next, volatile), events };
}

function applyResidualVolatile(battlers: Record<BattleSide, BattlerState>, events: BattleEvent[],
  terrain: BattleEffects["terrain"]): BattleSide | null {
  for (const side of SIDES) {
    const seededBy = volatileOf(battlers[side]).leechSeededBy;
    const result = resolveBattleVolatileEndOfTurn(battlers[side], side, terrain);
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
    const poisonHeal = resolvePoisonHeal(battler, side);
    if (poisonHeal !== null) {
      battlers[side] = poisonHeal.battler;
      events.push(...poisonHeal.events);
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

function applyHydrationAbilities(battlers: Record<BattleSide, BattlerState>, events: BattleEvent[],
  weather: BattleEffects["weather"]): void {
  for (const side of SIDES) {
    const result = resolveHydration(battlers[side], side, weather);
    battlers[side] = result.battler;
    events.push(...result.events);
  }
}

function applyLateAbilities(battlers: Record<BattleSide, BattlerState>, events: BattleEvent[],
  rng: RandomSource, trace: BattleTrace[]): BattleSide | null {
  for (const side of SIDES) {
    const result = resolveLateEndOfTurnAbilities(battlers[side], side, [battlers[opponentOf(side)]], rng, trace);
    battlers[side] = result.battler;
    events.push(...result.events);
    const healer = resolveHealer(battlers[side], undefined, side, rng, trace);
    events.push(...healer.events);
    if (result.battler.hp === 0) {
      const winner = opponentOf(side);
      events.push({ type: "fainted", side }, { type: "battleEnded", winner });
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
  rng: RandomSource, trace: BattleTrace[], berriesBlocked = false, nextPickupUse = 0): {
    readonly battler: BattlerState; readonly events: readonly BattleEvent[]; readonly nextPickupUse: number;
  } {
  const events: BattleEvent[] = [];
  let next = battler;
  if (next.hp > 0 && heldItemIsActive(next)) {
    if (!berriesBlocked && next.heldItem === "ORANBERRY" && next.hp <= Math.floor(next.stats.maxHp / 2)) {
      const amount = Math.min(10, next.stats.maxHp - next.hp);
      nextPickupUse += 1;
      next = consumeHeldItem({ ...next, hp: next.hp + amount }, "ORANBERRY", nextPickupUse);
      events.push({ type: "itemActivated", side, item: "ORANBERRY", effect: "heal", amount, hp: next.hp });
      events.push({ type: "heldItemConsumed", side, item: "ORANBERRY", effect: "heal", hp: next.hp });
      next = applyCheekPouch(next, side, events);
    }
    const liechiThreshold = next.ability === "GLUTTONY" ? Math.floor(next.stats.maxHp / 2)
      : Math.floor(next.stats.maxHp / 4);
    if (!berriesBlocked && next.heldItem === "LIECHIBERRY" && next.hp <= liechiThreshold) {
      const resolved = resolveStatStageChange(next, "attack", 1);
      if (resolved === null) return { battler: next, events, nextPickupUse };
      nextPickupUse += 1;
      next = consumeHeldItem(resolved.battler, "LIECHIBERRY", nextPickupUse);
      events.push({ type: "itemActivated", side, item: "LIECHIBERRY", effect: "boost", amount: 0, hp: next.hp });
      events.push({ type: "heldItemConsumed", side, item: "LIECHIBERRY", effect: "boost", hp: next.hp });
      events.push({ type: "statStageChanged", source: side, target: side, stat: "attack",
        delta: resolved.delta, stage: resolved.stage });
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
  return { battler: next, events, nextPickupUse };
}

function applyHeldItems(battlers: Record<BattleSide, BattlerState>, events: BattleEvent[],
  rng: RandomSource, trace: BattleTrace[], weather: BattleEffects["weather"], effects: MutableBattleEffects): BattleSide | null {
  for (const side of SIDES) {
    const weatherResult = resolveWeatherEndOfTurn(battlers[side], side, weather);
    battlers[side] = weatherResult.battler;
    events.push(...weatherResult.events);
    if (weatherResult.battler.hp === 0) {
      const winner = opponentOf(side);
      events.push({ type: "fainted", side }, { type: "battleEnded", winner });
      return winner;
    }
    const result = resolveBattlePassiveEndOfTurn(battlers[side], side, rng, trace,
      berriesBlockedBy([battlers[opponentOf(side)]]), effects.nextPickupUse);
    battlers[side] = result.battler;
    effects.nextPickupUse = result.nextPickupUse;
    events.push(...result.events);
    if (result.battler.hp === 0) {
      const winner = opponentOf(side);
      events.push({ type: "fainted", side }, { type: "battleEnded", winner });
      return winner;
    }
  }
  return null;
}

function applyItemRecoveryAbilities(battlers: Record<BattleSide, BattlerState>, events: BattleEvent[],
  rng: RandomSource, trace: BattleTrace[], weather: BattleEffects["weather"], effects: MutableBattleEffects): void {
  for (const side of SIDES) {
    let battler = battlers[side];
    if (battler.hp <= 0 || battler.heldItem !== null) continue;
    if (battler.ability === "PICKUP") {
      const sourceSide = opponentOf(side);
      const source = battlers[sourceSide];
      const item = source.volatile?.pickupItem ?? null;
      if (item !== null && (source.volatile?.pickupUse ?? 0) > 0) {
        battler = { ...battler, heldItem: item };
        battlers[sourceSide] = { ...source,
          ...(source.recyclableItem === item ? { recyclableItem: null } : {}),
          volatile: { ...source.volatile!, pickupItem: null, pickupUse: 0 } };
        events.push({ type: "abilityActivated", side, ability: "PICKUP", effect: "recover-item" },
          { type: "heldItemRecovered", side, item, ability: "PICKUP" });
      }
    } else if (battler.ability === "HARVEST" && isSupportedBerry(battler.recyclableItem ?? null)
      && (weather === "sun" || weather === "harsh-sun" || draw(rng, trace, "ability", 10) < 5)) {
      const item = battler.recyclableItem!;
      battler = { ...battler, heldItem: item, recyclableItem: null };
      events.push({ type: "abilityActivated", side, ability: "HARVEST", effect: "recover-item" },
        { type: "heldItemRecovered", side, item, ability: "HARVEST" });
    }
    battlers[side] = battler;
    if (isSupportedBerry(battler.heldItem)) {
      const activated = resolveBattlePassiveEndOfTurn(battler, side, rng, trace,
        berriesBlockedBy([battlers[opponentOf(side)]]), effects.nextPickupUse);
      battlers[side] = activated.battler;
      effects.nextPickupUse = activated.nextPickupUse;
      events.push(...activated.events);
    }
  }
}

function tickBattleEffects(effects: MutableBattleEffects, events: BattleEvent[]): void {
  effects.fusionBoltTurn = null;
  effects.fusionFlareTurn = null;
  for (const side of SIDES) {
    const current = effects.sides[side];
    const reflectTurns = Math.max(0, current.reflectTurns - 1);
    const lightScreenTurns = Math.max(0, current.lightScreenTurns - 1);
    const luckyChantTurns = Math.max(0, current.luckyChantTurns - 1);
    const mistTurns = Math.max(0, current.mistTurns - 1);
    const safeguardTurns = Math.max(0, current.safeguardTurns - 1);
    const tailwindTurns = Math.max(0, current.tailwindTurns - 1);
    effects.sides[side] = { ...current, reflectTurns, lightScreenTurns, luckyChantTurns, mistTurns, safeguardTurns, tailwindTurns };
    if (current.reflectTurns > 0 && reflectTurns === 0) events.push({ type: "battleEffectChanged", side, effect: "reflect", turns: 0 });
    if (current.luckyChantTurns > 0 && luckyChantTurns === 0) events.push({ type: "battleEffectChanged", side, effect: "lucky-chant", turns: 0 });
    if (current.lightScreenTurns > 0 && lightScreenTurns === 0) events.push({ type: "battleEffectChanged", side, effect: "light-screen", turns: 0 });
    if (current.mistTurns > 0 && mistTurns === 0) events.push({ type: "battleEffectChanged", side, effect: "mist", turns: 0 });
    if (current.safeguardTurns > 0 && safeguardTurns === 0) events.push({ type: "battleEffectChanged", side, effect: "safeguard", turns: 0 });
    if (current.tailwindTurns > 0 && tailwindTurns === 0) events.push({ type: "battleEffectChanged", side, effect: "tailwind", turns: 0 });
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
  if (effects.trickRoomTurns > 0) {
    effects.trickRoomTurns -= 1;
    if (effects.trickRoomTurns === 0) {
      events.push({ type: "battleEffectChanged", side: null, effect: "trick-room", turns: 0 });
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
    const speed = effectiveSpeed(battler, (state.effects?.sides[side].tailwindTurns ?? 0) > 0, state.effects?.terrain)
      * weatherSpeedMultiplier(battler, weather);
    const priority = effectiveMovePriority(battler, slot.move);
    trace.push({ type: "order", side, priority, speed });
    return { side, priority, speed, lagging: battler.ability === "STALL" };
  });
  if (decorated.length === 0) return [];
  const only = decorated[0];
  if (decorated.length === 1 && only !== undefined) return [only.side];
  const [player, opponent] = decorated;
  if (player === undefined || opponent === undefined) throw new Error("Battle requires two sides.");
  if (player.priority !== opponent.priority) return player.priority > opponent.priority ? [player.side, opponent.side] : [opponent.side, player.side];
  if (player.lagging !== opponent.lagging) return player.lagging
    ? [opponent.side, player.side] : [player.side, opponent.side];
  if (player.speed !== opponent.speed) {
    const fasterFirst = player.lagging && opponent.lagging
      ? false : (state.effects?.trickRoomTurns ?? 0) <= 0;
    return (player.speed > opponent.speed) === fasterFirst
      ? [player.side, opponent.side] : [opponent.side, player.side];
  }
  return draw(rng, trace, "speed-tie", 2) === 0 ? [opponent.side, player.side] : [player.side, opponent.side];
}

function accuracyCheck(side: BattleSide, attacker: BattlerState, defender: BattlerState, move: BattleMove,
  rng: RandomSource, trace: BattleTrace[], weather: BattleEffects["weather"],
  context: { readonly attackerPartnerAbility?: BattlerState["ability"]; readonly hostile?: boolean } = {}): boolean {
  if (move.functionCode === "070") {
    const threshold = defender.level > attacker.level ? 0 : move.accuracy + attacker.level - defender.level;
    const hit = threshold > 0 && draw(rng, trace, "accuracy", 100) < threshold;
    trace.push({ type: "accuracy", side, base: move.accuracy, accuracyStage: 0,
      evasionStage: 0, threshold, hit });
    return hit;
  }
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
  const itemModifier = heldItemIsActive(attacker) && attacker.heldItem === "WIDELENS" ? 1.1 : 1;
  const abilityModifier = (attacker.ability === "COMPOUNDEYES" ? 1.3 : 1)
    * (attacker.ability === "HUSTLE" && move.category === "Physical" ? 0.8 : 1)
    * (attacker.ability === "VICTORYSTAR" ? 1.1 : 1)
    * (context.attackerPartnerAbility === "VICTORYSTAR" ? 1.1 : 1);
  const evasionStage = defender.volatile?.identified === true
    || (attacker.ability === "KEENEYE" && defender.stages.evasion > 0) ? 0 : defender.stages.evasion;
  const tangledFeetModifier = !hasMoldBreaker(attacker) && defender.ability === "TANGLEDFEET"
    && (defender.volatile?.confusionTurns ?? 0) > 0 ? 1.2 : 1;
  const illusoryFormModifier = !hasMoldBreaker(attacker) && defender.ability === "FORMAILUSORIA"
    && defender.hp > defender.stats.maxHp / 1.3333333 ? 1.7 : 1;
  const rawAccuracyModifier = itemModifier * abilityModifier * accuracyFactor(attacker.stages.accuracy);
  const accuracyModifier = !hasMoldBreaker(attacker) && defender.ability === "WONDERSKIN"
    && move.category === "Status" && context.hostile === true
    ? Math.min(0.5, rawAccuracyModifier) : rawAccuracyModifier;
  const threshold = accuracy * accuracyModifier
    / accuracyFactor(evasionStage) / weatherEvasionMultiplier(defender, weather)
    / tangledFeetModifier / illusoryFormModifier;
  const roll = draw(rng, trace, "accuracy", 100);
  const hit = roll < threshold;
  trace.push({ type: "accuracy", side, base: accuracy, accuracyStage: attacker.stages.accuracy, evasionStage,
    threshold, hit, ...(tangledFeetModifier === 1 ? {} : {
      abilityModifier: { ability: "TANGLEDFEET" as const, multiplier: tangledFeetModifier },
    }) });
  return hit;
}

/** Pokemon Z deliberately requires the Shield Dust + Covert Cloak combination. */
function blocksAdditionalEffects(attacker: BattlerState, defender: BattlerState): boolean {
  return !hasMoldBreaker(attacker) && defender.ability === "SHIELDDUST"
    && heldItemIsActive(defender) && defender.heldItem === "COVERTCLOAK";
}

const NATURE_POWER_MOVES: Readonly<Record<NonNullable<BattleEffects["environment"]>,
  Pick<BattleMove, "internalName" | "name" | "functionCode" | "power" | "type" | "category" | "accuracy" | "effectChance" | "flags">>> = {
  none: { internalName: "TRIATTACK", name: "Triattaque", functionCode: "017", power: 80,
    type: "NORMAL", category: "Special", accuracy: 100, effectChance: 20, flags: "be" },
  grass: { internalName: "ENERGYBALL", name: "Éco-Sphère", functionCode: "046", power: 90,
    type: "GRASS", category: "Special", accuracy: 100, effectChance: 10, flags: "ben" },
  "tall-grass": { internalName: "ENERGYBALL", name: "Éco-Sphère", functionCode: "046", power: 90,
    type: "GRASS", category: "Special", accuracy: 100, effectChance: 10, flags: "ben" },
  forest: { internalName: "ENERGYBALL", name: "Éco-Sphère", functionCode: "046", power: 90,
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
    readonly weatherSuppressed?: boolean;
    /** Double battles derive berry suppression from every active opposing slot. */
    readonly defenderBerriesBlocked?: boolean;
    /** Active partner context supplied by the positioned double-battle adapter. */
    readonly attackerPartnerAbility?: BattlerState["ability"];
    readonly defenderPartnerAbility?: BattlerState["ability"];
    /** All active, conscious abilities supplied by the team/double adapter for global effects. */
    readonly activeAbilities?: readonly NonNullable<BattlerState["ability"]>[];
    readonly targetIsAlly?: boolean;
    readonly targetPresentationSide?: BattleSide;
    /** Authoritative total cost for double-battle multi-target Pressure. */
    readonly ppCost?: number;
    /** Double battles derive global Damp from all four active slots. */
    readonly dampSide?: BattleSide | null;
    /** Double battles activate Tailwind abilities for every ally before resolving its mini duel. */
    readonly windSideAbilitiesHandled?: boolean;
    readonly attackerCanSwitch?: Readonly<Partial<Record<BattleSide, boolean>>> } = {}): TurnResult {
  validateState(state, actions);
  const battlers: Record<BattleSide, BattlerState> = {
    player: cloneBattler(state.battlers.player),
    opponent: cloneBattler(state.battlers.opponent),
  };
  const suppliedGasCount = options.activeAbilities?.filter((ability) => ability === "NEUTRALIZINGGAS").length ?? 0;
  const localGasCount = SIDES.filter((side) => battlers[side].hp > 0
    && battlers[side].ability === "NEUTRALIZINGGAS").length;
  const externalGasCount = Math.max(0, suppliedGasCount - localGasCount);
  let neutralizingGas = externalGasCount > 0
    || SIDES.some((side) => battlers[side].hp > 0 && battlers[side].ability === "NEUTRALIZINGGAS");
  const suppressedAbilities: Partial<Record<BattleSide, BattlerState["ability"]>> = {};
  if (neutralizingGas) for (const side of SIDES) {
    if (battlers[side].ability === null || battlers[side].ability === "NEUTRALIZINGGAS") continue;
    suppressedAbilities[side] = battlers[side].ability;
    battlers[side] = { ...battlers[side], ability: null };
  }
  const refreshNeutralizingGas = (): void => {
    if (!neutralizingGas || externalGasCount > 0
      || SIDES.some((side) => battlers[side].hp > 0 && battlers[side].ability === "NEUTRALIZINGGAS")) return;
    neutralizingGas = false;
    for (const side of SIDES) {
      const ability = suppressedAbilities[side];
      if (ability !== undefined && battlers[side].ability === null
        && battlers[side].volatile?.gastroAcid !== true) battlers[side] = { ...battlers[side], ability };
    }
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
    const oblivious = battlers[side];
    if (oblivious.ability === "OBLIVIOUS") {
      const current = volatileOf(oblivious);
      if (current.infatuated || current.tauntTurns > 0) {
        battlers[side] = withVolatile(oblivious, { ...current, infatuated: false, tauntTurns: 0 });
        if (current.infatuated) events.push(
          { type: "abilityActivated", side, ability: "OBLIVIOUS", effect: "prevent-infatuation" },
          { type: "volatileEnded", side, effect: "infatuation" });
        if (current.tauntTurns > 0) events.push(
          { type: "abilityActivated", side, ability: "OBLIVIOUS", effect: "prevent-taunt" },
          { type: "volatileEnded", side, effect: "taunt" });
      }
    }
  }
  const effects = effectsOf(state.effects);
  let effectiveWeather = effectiveBattleWeather(effects.weather, Object.values(battlers), options.weatherSuppressed);
  const moved = new Set<BattleSide>();
  const damagedThisTurn = new Set<BattleSide>();
  const selectedActions: Partial<Record<BattleSide, MoveAction>> = { ...actions };
  for (const side of SIDES) {
    const encore = volatileOf(battlers[side]);
    const lockedMove = battlers[side].ability === "PODERSABIO" && encore.choiceLockedMove !== null
      ? encore.choiceLockedMove
      : encore.rolloutTurns > 0 ? battlers[side].moves.find((slot) => slot.move.functionCode === "0D3")?.move.internalName
      : encore.uproarTurns > 0 ? battlers[side].moves.find((slot) => slot.move.functionCode === "0D1")?.move.internalName
        : encore.encoreTurns > 0 ? encore.encoreMove : null;
    if (lockedMove === null || lockedMove === undefined || selectedActions[side] === undefined) continue;
    const moveIndex = battlers[side].moves.findIndex((slot) => slot.move.internalName === lockedMove && slot.pp > 0);
    if (moveIndex >= 0) selectedActions[side] = { kind: "move", moveIndex };
  }
  const order = orderedSides({ ...state, battlers }, selectedActions, rng, trace, effectiveWeather);
  events.push({ type: "actionOrdered", order });
  let winner: BattleSide | null = null;
  let battleDraw = false;

  for (const side of order) {
    refreshNeutralizingGas();
    effectiveWeather = effectiveBattleWeather(effects.weather, Object.values(battlers), options.weatherSuppressed);
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
    const stance = applyStanceChange(attacker, side, slot.move);
    if (stance.battler !== attacker) {
      battlers[side] = stance.battler;
      attacker = stance.battler;
      events.push(...stance.events);
    }
    if (selectedSlot.pp === 0) {
      events.push({ type: "actionSkipped", side, reason: "no-pp" });
      continue;
    }
    const volatile = volatileOf(attacker);
    if (volatile.disableTurns > 0 && volatile.disabledMove === slot.move.internalName) {
      events.push({ type: "actionSkipped", side, reason: "disabled" });
      continue;
    }
    if (heldItemIsActive(attacker) && attacker.heldItem === "ASSAULTVEST" && slot.move.category === "Status") {
      events.push({ type: "actionSkipped", side, reason: "item-blocked" });
      continue;
    }
    if (volatile.tauntTurns > 0 && slot.move.category === "Status") {
      events.push({ type: "actionSkipped", side, reason: "taunted" });
      continue;
    }
    const ppCost = options.ppCost ?? (moveCanTriggerPressure(selectedSlot.move)
      && battlers[targetSide].ability === "PRESSURE" ? 2 : 1);
    const nextPp = Math.max(0, selectedSlot.pp - ppCost);
    const nextMoves = attacker.moves.map((candidate, index) => index === action.moveIndex ? { ...candidate, pp: nextPp } : candidate);
    const furyCutterCount = selectedSlot.move.functionCode === "091"
      ? Math.min(4, volatile.lastMoveUsed === selectedSlot.move.internalName ? volatile.furyCutterCount + 1 : 1) : 0;
    const rolloutTurns = selectedSlot.move.functionCode === "0D3"
      ? volatile.rolloutTurns > 0 ? volatile.rolloutTurns - 1 : 4 : 0;
    battlers[side] = withVolatile({ ...attacker, moves: nextMoves }, { ...volatile,
      lastMoveUsed: selectedSlot.move.internalName, furyCutterCount, rolloutTurns,
      choiceLockedMove: attacker.ability === "PODERSABIO"
        ? volatile.choiceLockedMove ?? selectedSlot.move.internalName : volatile.choiceLockedMove });
    events.push({ type: "moveUsed", side, move: selectedSlot.move.internalName });
    if (slot.move.internalName !== selectedSlot.move.internalName) events.push({ type: "moveUsed", side, move: slot.move.internalName });
    events.push({ type: "ppChanged", side, move: selectedSlot.move.internalName, pp: nextPp });
    moved.add(side);
    if (slot.move.functionCode === "05B" && options.windSideAbilitiesHandled !== true) {
      const wind = activateWindAbility(battlers[side], side);
      battlers[side] = wind.battler;
      events.push(...wind.events);
    }
    const dampSide = options.dampSide === undefined
      ? SIDES.find((candidate) => battlers[candidate].hp > 0 && battlers[candidate].ability === "DAMP") ?? null
      : options.dampSide;
    if (slot.move.functionCode === "0E0" && dampSide !== null && !hasMoldBreaker(battlers[side])) {
      events.push({ type: "abilityActivated", side: dampSide, ability: "DAMP", effect: "block-move" },
        { type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    const moveType = effectiveMoveType(battlers[side], slot.move).type;
    const resolvedMove = moveType === slot.move.type ? slot.move : { ...slot.move, type: moveType };
    battlers[side] = withVolatile(battlers[side], { ...volatileOf(battlers[side]),
      lastUsedMove: { ...slot.move }, lastMoveUsedType: moveType,
      lastSketchableMove: { ...slot.move } });
    if (battlers[side].ability === "PROTEAN"
      && (battlers[side].types.length !== 1 || battlers[side].types[0] !== moveType)) {
      const current = battlers[side];
      const currentVolatile = volatileOf(current);
      battlers[side] = withVolatile({ ...current, types: [moveType] }, { ...currentVolatile,
        originalTypes: currentVolatile.originalTypes ?? [...current.types] });
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
    if (slot.move.functionCode === "037" && options.targetIsAlly !== true) actualTargetSide = side;
    const intendedDefender = battlers[targetSide];
    if (moveType === "FLYING" && intendedDefender.ability === "CONTRAGUARDIA"
      && !hasMoldBreaker(battlers[side])) actualTargetSide = side;
    let defender = battlers[actualTargetSide];
    if (options.targetIsAlly === true && slot.move.category !== "Status"
      && defender.ability === "TELEPATHY" && !hasMoldBreaker(battlers[side])) {
      events.push({ type: "abilityActivated", side: options.targetPresentationSide ?? actualTargetSide,
        ability: "TELEPATHY", effect: "block-move" });
      continue;
    }
    const statusTargetSide = moveTargetsUser(slot.move) ? side : actualTargetSide;
    const statusTarget = battlers[statusTargetSide];
    if (slot.move.category === "Status" && statusTarget.ability === "GOODASGOLD"
      && !hasMoldBreaker(battlers[side])) {
      events.push({ type: "abilityActivated", side: statusTargetSide === actualTargetSide
        ? options.targetPresentationSide ?? actualTargetSide : statusTargetSide,
        ability: "GOODASGOLD", effect: "block-move" },
      { type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    const hostileTarget = options.targetIsAlly !== true && actualTargetSide !== side;
    if (hostileTarget && defender.ability === "QUEENLYMAJESTY"
      && effectiveMovePriority(battlers[side], slot.move) > 0 && !hasMoldBreaker(battlers[side])) {
      events.push({ type: "abilityActivated", side: options.targetPresentationSide ?? actualTargetSide,
        ability: "QUEENLYMAJESTY", effect: "block-move" },
      { type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    if (slot.move.functionCode !== "05B" && isWindMove(slot.move)) {
      const wind = activateWindAbility(defender, actualTargetSide, true);
      battlers[actualTargetSide] = wind.battler;
      defender = wind.battler;
      events.push(...wind.events);
      if (wind.blocked) continue;
    }
    if (hasMoveFlag(slot.move, "l") && (defender.types.includes("GRASS")
      || heldItemIsActive(defender) && defender.heldItem === "SAFETYGOGGLES"
      || defender.ability === "OVERCOAT" && !hasMoldBreaker(battlers[side]))) {
      if (defender.ability === "OVERCOAT" && !defender.types.includes("GRASS")
        && !(heldItemIsActive(defender) && defender.heldItem === "SAFETYGOGGLES")) {
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
    if (defender.ability === "BULLETPROOF" && isBombMove(slot.move) && !hasMoldBreaker(battlers[side])) {
      events.push({ type: "abilityActivated", side: actualTargetSide, ability: "BULLETPROOF", effect: "block-move" },
        { type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    if (slot.move.category === "Status" && hasMoveFlag(slot.move, "c")
      && defender.ability === "MAGICBOUNCE" && !hasMoldBreaker(battlers[side]) && actualTargetSide !== side) {
      events.push({ type: "abilityActivated", side: actualTargetSide, ability: "MAGICBOUNCE", effect: "reflect-move" });
      if (!accuracyCheck(actualTargetSide, defender, battlers[side], slot.move, rng, trace, effectiveWeather,
        { ...(neutralizingGas || options.defenderPartnerAbility === undefined ? {} : {
          attackerPartnerAbility: options.defenderPartnerAbility }), hostile: options.targetIsAlly !== true })) {
        events.push({ type: "moveMissed", side: actualTargetSide, move: slot.move.internalName });
      } else {
        applyMoveEffect(actualTargetSide, side, resolvedMove, battlers, rng, events, trace, effects, effectiveWeather);
      }
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
    if (slot.move.functionCode === "070" && defender.ability === "STURDY"
      && !hasMoldBreaker(battlers[side])) {
      events.push({ type: "abilityActivated", side: options.targetPresentationSide ?? actualTargetSide,
        ability: "STURDY", effect: "block-move" },
      { type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    if (!accuracyCheck(side, battlers[side], defender, slot.move, rng, trace, effectiveWeather,
      { ...(neutralizingGas || options.attackerPartnerAbility === undefined ? {} : {
        attackerPartnerAbility: options.attackerPartnerAbility }), hostile: hostileTarget })) {
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
    if (slot.move.category !== "Status" && defender.ability === "WONDERGUARD"
      && !hasMoldBreaker(battlers[side])
      && effectiveTypeMultiplier(battlers[side], defender, resolvedMove, effectiveWeather) <= 1) {
      events.push({ type: "abilityActivated", side: options.targetPresentationSide ?? actualTargetSide,
        ability: "WONDERGUARD", effect: "block-move" },
      { type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    const targetCode = (slot.move.targetCode ?? "00").toUpperCase().replace(/^0X/u, "");
    const fixedDamageMove = ["06A", "06B", "06C", "06D", "06E", "06F", "070", "071", "072", "073"]
      .includes(slot.move.functionCode);
    const parentalEligible = battlers[side].ability === "PARENTALBOND" && slot.move.category !== "Status"
      && !["04", "08"].includes(targetCode)
      && !fixedDamageMove
      && !["0C0", "0BD", "0BE", "0E0", "0E1", "0F7"].includes(slot.move.functionCode);
    if (slot.move.category !== "Status" && defender.ability === "DISGUISE"
      && defender.species === "MIMIKYU" && (defender.appearance?.form ?? 0) === 0
      && !hasMoldBreaker(battlers[side])) {
      const amount = Math.min(defender.hp, Math.max(1, Math.floor(defender.stats.maxHp / 8)));
      battlers[actualTargetSide] = withVolatile({ ...defender, hp: defender.hp - amount,
        appearance: { form: 1, shiny: defender.appearance?.shiny ?? false,
          gender: defender.appearance?.gender ?? null } },
      { ...volatileOf(defender), originalForm: defender.volatile?.originalForm ?? 0 });
      const presentationSide = options.targetPresentationSide ?? actualTargetSide;
      events.push({ type: "abilityActivated", side: presentationSide,
        ability: "DISGUISE", effect: "break-disguise" },
      { type: "formChanged", side: presentationSide, species: defender.species,
        fromForm: 0, toForm: 1, reason: "ability" },
      { type: "abilityDamage", source: presentationSide, target: presentationSide,
        ability: "DISGUISE", amount, hp: defender.hp - amount });
      if (defender.hp - amount === 0) events.push({ type: "fainted", side: presentationSide });
      continue;
    }
    if (slot.move.category === "Status") {
      applyMoveEffect(side, actualTargetSide, resolvedMove, battlers, rng, events, trace, effects, effectiveWeather,
        slot.move.functionCode === "051" && options.targetPresentationSide === side);
      if (slot.move.functionCode === "068" && suppressedAbilities[actualTargetSide] !== undefined
        && battlers[actualTargetSide].volatile?.gastroAcid === true) {
        const affected = battlers[actualTargetSide];
        battlers[actualTargetSide] = { ...affected, volatile: { ...affected.volatile!,
          originalAbility: affected.volatile?.originalAbility ?? suppressedAbilities[actualTargetSide] ?? null } };
      }
      refreshNeutralizingGas();
      effectiveWeather = effectiveBattleWeather(effects.weather, Object.values(battlers), options.weatherSuppressed);
      if (battlers[side].hp === 0) {
        winner = targetSide;
        events.push({ type: "fainted", side });
        if (options.endOfTurn !== false) events.push({ type: "battleEnded", winner });
        break;
      }
      continue;
    }
    if (slot.move.functionCode === "06E" && battlers[side].hp >= defender.hp) {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    const retaliation = battlers[side].volatile?.retaliation;
    const retaliationHit = retaliation?.turn !== state.turn ? undefined
      : slot.move.functionCode === "071" ? retaliation.physical
        : slot.move.functionCode === "072" ? retaliation.special : retaliation.last;
    if (["071", "072", "073"].includes(slot.move.functionCode)
      && (retaliationHit === undefined || retaliationHit.amount <= 0)) {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    const traceStart = trace.length;
    const infiltrates = battlers[side].ability === "INFILTRATOR";
    const damageContext = { reflect: !infiltrates && effects.sides[actualTargetSide].reflectTurns > 0,
      lightScreen: !infiltrates && effects.sides[actualTargetSide].lightScreenTurns > 0,
      luckyChant: effects.sides[actualTargetSide].luckyChantTurns > 0,
      mudSport: effects.mudSportTurns > 0,
      waterSport: effects.waterSportTurns > 0, weather: effectiveWeather, terrain: effects.terrain,
      defenderBerriesBlocked: options.defenderBerriesBlocked ?? berriesBlockedBy([battlers[side]]),
      attackerPartnerAbility: neutralizingGas ? null : options.attackerPartnerAbility ?? null,
      defenderPartnerAbility: neutralizingGas ? null : options.defenderPartnerAbility ?? null,
      activeAbilities: neutralizingGas ? ["NEUTRALIZINGGAS"]
        : options.activeAbilities?.filter((ability) => ability !== "NEUTRALIZINGGAS")
          ?? SIDES.map((candidate) => battlers[candidate])
          .filter((candidate) => candidate.hp > 0 && candidate.ability !== null)
          .map((candidate) => candidate.ability as NonNullable<BattlerState["ability"]>),
      defenderAlreadyMoved: moved.has(actualTargetSide) || options.targetAlreadyMoved === true
        || selectedActions[actualTargetSide] === undefined && options.targetPlannedAction === undefined,
      ...(retaliationHit === undefined ? {} : { retaliationDamage: retaliationHit.amount }) };
    const assuranceMultiplier = slot.move.functionCode === "082"
      && (options.targetTookDamageThisTurn === true || damagedThisTurn.has(actualTargetSide)) ? 2 : 1;
    const roundMultiplier = slot.move.functionCode === "083" ? options.roundMultiplier ?? 1 : 1;
    const chargeMultiplier = moveType === "ELECTRIC" && volatileOf(battlers[side]).chargeTurns > 0 ? 2 : 1;
    const fusionBoost = slot.move.functionCode === "079" && effects.fusionBoltTurn === state.turn
      || slot.move.functionCode === "07A" && effects.fusionFlareTurn === state.turn;
    if (fusionBoost) {
      if (slot.move.functionCode === "079") effects.fusionBoltTurn = null;
      else effects.fusionFlareTurn = null;
    }
    const powerMultiplier = assuranceMultiplier * roundMultiplier * chargeMultiplier;
    let damageMove = powerMultiplier === 1 ? slot.move : { ...slot.move, power: slot.move.power * powerMultiplier };
    if (slot.move.functionCode === "095") {
      const magnitudePowers = [10, 30, 30, 50, 50, 50, 50, 70, 70, 70, 70, 70, 70, 90, 90, 90, 90, 110, 110, 150];
      damageMove = { ...slot.move, power: magnitudePowers[draw(rng, trace, "magnitude", magnitudePowers.length)]! };
    }
    const firstDamage = calculateDamage(side, battlers[side], defender, damageMove, rng, trace, damageContext);
    const damageRolls = [firstDamage];
    const parentalBond = parentalEligible && damageRolls[0]! > 0;
    if (parentalBond) {
      events.push({ type: "abilityActivated", side, ability: "PARENTALBOND", effect: "extra-hit" });
    }
    if (parentalBond) {
      const projected = { ...defender, hp: Math.max(0, defender.hp - damageRolls[0]!) };
      damageRolls.push(calculateDamage(side, battlers[side], projected, damageMove, rng, trace, damageContext));
    }
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
    const gem = heldItemIsActive(battlers[side]) && ((battlers[side].heldItem === "FIGHTINGGEM" && moveType === "FIGHTING")
      || (battlers[side].heldItem === "BUGGEM" && moveType === "BUG")
      ) ? battlers[side].heldItem as "FIGHTINGGEM" | "BUGGEM" : null;
    if (gem !== null) {
      battlers[side] = consumeTrackedItem(battlers[side], gem, effects);
      events.push({ type: "heldItemConsumed", side, item: gem, effect: "boost", hp: battlers[side].hp });
    }
    if (slot.move.functionCode === "0E0" && battlers[side].hp > 0) {
      const current = battlers[side];
      battlers[side] = { ...current, hp: 0 };
      events.push({ type: "recoilDamage", side, move: slot.move.internalName,
        reason: "self-destruct", amount: current.hp, hp: 0 }, { type: "fainted", side });
    }
    const payapa = !(options.defenderBerriesBlocked ?? berriesBlockedBy([battlers[side]])) && heldItemIsActive(defender)
      && defender.heldItem === "PAYAPABERRY" && moveType === "PSYCHIC"
      && damageTrace.effectiveness > 1;
    let hp = defender.hp;
    let damage = 0;
    const appliedHits: { hpBefore: number; hpAfter: number; critical: boolean }[] = [];
    let landedHits = 0;
    let focusSash = false;
    let sturdy = false;
    for (const [hitIndex, rawDamage] of damageRolls.entries()) {
      if (hp <= 0) break;
      const presentationMultiplier = fixedDamageMove ? 1
        : (options.damageMultiplier ?? 1) * (options.helpingHandMultiplier ?? 1)
          * (fusionBoost ? 2 : 1);
      let hitDamage = rawDamage === 0 ? 0 : Math.max(1, Math.floor(rawDamage * presentationMultiplier
        * (parentalBond && hitIndex === 1 ? 0.5 : 1)));
      if (slot.move.functionCode === "088" && options.switchingTarget === targetSide) hitDamage *= 2;
      const sashOnThisHit: boolean = !focusSash && heldItemIsActive(defender) && defender.heldItem === "FOCUSSASH"
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
      if (applied > 0) {
        const current = battlers[actualTargetSide];
        const previous = current.volatile?.retaliation;
        const record = previous?.turn === state.turn ? previous : { turn: state.turn };
        const hit = { amount: applied, attackerId: battlers[side].id };
        battlers[actualTargetSide] = withVolatile(current, { ...volatileOf(current), retaliation: {
          ...record, last: hit,
          ...(slot.move.category === "Physical" ? { physical: hit }
            : slot.move.category === "Special" ? { special: hit } : {}),
        } });
      }
      events.push({ type: "damageApplied", source: side, target: actualTargetSide,
        amount: applied, hp, critical: hitTrace.critical, effectiveness: hitTrace.effectiveness });
    }
    battlers[actualTargetSide] = { ...battlers[actualTargetSide], hp };
    refreshNeutralizingGas();
    effectiveWeather = effectiveBattleWeather(effects.weather, Object.values(battlers), options.weatherSuppressed);
    if (damage > 0) {
      if (slot.move.functionCode === "050") clearBattlerStages(side, actualTargetSide, battlers, events);
      const selfDrops = slot.move.functionCode === "03B"
        ? [{ stat: "attack" as const, delta: -1 }, { stat: "defense" as const, delta: -1 }]
        : slot.move.functionCode === "03C"
        ? [{ stat: "defense" as const, delta: -1 }, { stat: "specialDefense" as const, delta: -1 }]
        : slot.move.functionCode === "03D"
          ? [{ stat: "speed" as const, delta: -1 }, { stat: "defense" as const, delta: -1 },
            { stat: "specialDefense" as const, delta: -1 }]
        : slot.move.functionCode === "03E" ? [{ stat: "speed" as const, delta: -1 }]
          : slot.move.functionCode === "03F" ? [{ stat: "specialAttack" as const, delta: -2 }] : [];
      if (selfDrops.length > 0) applySelfStatChanges(side, selfDrops, battlers, events);
    }
    if (damage > 0 && defender.ability === "ILLUSION" && defender.illusion !== undefined) {
      const revealed = battlers[actualTargetSide];
      const { illusion: _illusion, ...withoutIllusion } = revealed;
      battlers[actualTargetSide] = withoutIllusion;
      events.push({ type: "abilityActivated", side: options.targetPresentationSide ?? actualTargetSide,
        ability: "ILLUSION", effect: "announce" });
    }
    if (focusSash) battlers[actualTargetSide] = consumeTrackedItem(battlers[actualTargetSide], "FOCUSSASH", effects);
    else if (payapa) battlers[actualTargetSide] = consumeTrackedItem(battlers[actualTargetSide], "PAYAPABERRY", effects);
    if (damage > 0) damagedThisTurn.add(actualTargetSide);
    if (damage > 0 && slot.move.functionCode === "079") effects.fusionFlareTurn = state.turn;
    if (damage > 0 && slot.move.functionCode === "07A") effects.fusionBoltTurn = state.turn;
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
    if (damage > 0 && battlers[side].hp > 0 && battlers[side].ability === "EMERGENCYEXIT"
      && moveType === "BUG" && options.attackerCanSwitch?.[side] === true
      && !events.some((event) => event.type === "forcedSwitchRequested" && event.side === side)) {
      events.push({ type: "abilityActivated", side, ability: "EMERGENCYEXIT", effect: "request-switch" },
        { type: "forcedSwitchRequested", side, ability: "EMERGENCYEXIT" });
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
      const drain = Math.round(Math.min(damage, defender.hp) / 2);
      if (defender.ability === "LIQUIDOOZE") {
        const amount = Math.min(current.hp, drain);
        battlers[side] = { ...current, hp: current.hp - amount };
        events.push({ type: "abilityActivated", side: actualTargetSide,
          ability: "LIQUIDOOZE", effect: "damage-attacker" },
        { type: "abilityDamage", source: actualTargetSide, target: side,
          ability: "LIQUIDOOZE", amount, hp: current.hp - amount });
        if (current.hp - amount === 0) events.push({ type: "fainted", side });
      } else {
        const amount = Math.min(current.stats.maxHp - current.hp, drain);
        battlers[side] = { ...current, hp: current.hp + amount };
        events.push({ type: "hpRestored", side, source: "move", move: slot.move.internalName,
          amount, hp: current.hp + amount });
      }
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
    if (damage > 0 && side !== actualTargetSide && battlers[actualTargetSide].ability === "CURSEDBODY"
      && battlers[side].hp > 0 && volatileOf(battlers[side]).disableTurns === 0
      && draw(rng, trace, "ability", 10) < 3) {
      const current = battlers[side];
      battlers[side] = withVolatile(current, { ...volatileOf(current),
        disabledMove: selectedSlot.move.internalName, disableTurns: 3 });
      events.push({ type: "abilityActivated", side: actualTargetSide, ability: "CURSEDBODY", effect: "disable-move" },
        { type: "volatileApplied", source: actualTargetSide, target: side, effect: "disable", turns: 3,
          move: selectedSlot.move.internalName });
    }
    const effectChance = battlers[side].ability === "SHEERFORCE" ? 0
      : Math.min(100, slot.move.effectChance * (battlers[side].ability === "SERENEGRACE" ? 2 : 1));
    if (hp > 0 && (slot.move.functionCode === "0BE" || parentalBond) && effectChance > 0) {
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
    if (hp > 0 && slot.move.functionCode !== "0BE" && !parentalBond && effectChance > 0
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
    const stenchExcluded = ["009", "00B", "00E", "00F", "010", "011", "012", "078", "0C7"]
      .includes(slot.move.functionCode);
    if (hp > 0 && damage > 0 && side !== actualTargetSide && battlers[side].ability === "STENCH"
      && !stenchExcluded && !blocksAdditionalEffects(battlers[side], battlers[actualTargetSide])
      && draw(rng, trace, "ability", 100) <= 10) {
      const target = battlers[actualTargetSide];
      if (target.ability !== "INNERFOCUS") {
        battlers[actualTargetSide] = withVolatile(target, { ...volatileOf(target), flinched: true });
        events.push({ type: "abilityActivated", side, ability: "STENCH", effect: "inflict-flinch" },
          { type: "volatileApplied", source: side, target: actualTargetSide,
            effect: "flinch", turns: 1, move: slot.move.internalName });
      }
    }
    const abilityFlinch = battlers[side].ability === "PENETRANTE" && hasHighCriticalRate(slot.move)
      ? "PENETRANTE" as const
      : battlers[side].ability === "VOZVALQUIRIA" && isSoundMove(slot.move)
        ? "VOZVALQUIRIA" as const : null;
    if (hp > 0 && damage > 0 && side !== actualTargetSide && battlers[side].hp > 0
      && abilityFlinch !== null && !blocksAdditionalEffects(battlers[side], battlers[actualTargetSide])
      && draw(rng, trace, "ability", 100) <= 30) {
      const target = battlers[actualTargetSide];
      if (target.ability !== "INNERFOCUS") {
        battlers[actualTargetSide] = withVolatile(target, { ...volatileOf(target), flinched: true });
        events.push({ type: "abilityActivated", side, ability: abilityFlinch, effect: "inflict-flinch" },
          { type: "volatileApplied", source: side, target: actualTargetSide,
            effect: "flinch", turns: 1, move: slot.move.internalName });
      }
    }
    for (const hit of appliedHits) {
      applyDamageAbilityStatReaction(actualTargetSide, side, resolvedMove, hit, battlers, events);
    }
    if (landedHits > 0 && defender.ability === "CAPATOXICA") {
      for (let hit = 0; hit < landedHits && effects.sides[side].toxicSpikesLayers < 2; hit += 1) {
        const layers = effects.sides[side].toxicSpikesLayers + 1;
        effects.sides[side] = { ...effects.sides[side], toxicSpikesLayers: layers };
        events.push({ type: "abilityActivated", side: actualTargetSide,
          ability: "CAPATOXICA", effect: "set-hazard" },
        { type: "battleEffectChanged", side, effect: "toxic-spikes", turns: layers });
      }
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
      if (heldItemIsUnlosable(battlers[actualTargetSide])
        || battlers[actualTargetSide].ability === "STICKYHOLD" && !hasMoldBreaker(battlers[side])) {
        events.push({ type: "abilityActivated", side: actualTargetSide, ability: "STICKYHOLD", effect: "block-move" });
      } else {
        const item = battlers[actualTargetSide].heldItem!;
        battlers[side] = { ...battlers[side], heldItem: item,
          heldItemTransfer: battlers[side].heldItemTransfer ?? { originalItem: null } };
        battlers[actualTargetSide] = { ...removeHeldItem(battlers[actualTargetSide]),
          heldItemTransfer: battlers[actualTargetSide].heldItemTransfer ?? { originalItem: item } };
        events.push({ type: "heldItemTransferred", source: actualTargetSide, target: side,
          item, move: slot.move.internalName });
      }
    }
    if (damage > 0 && slot.move.functionCode === "0F0" && battlers[actualTargetSide].heldItem !== null
      && battlers[actualTargetSide].hp > 0 && !heldItemIsUnlosable(battlers[actualTargetSide])
      && (battlers[actualTargetSide].ability !== "STICKYHOLD" || hasMoldBreaker(battlers[side]))) {
      const item = battlers[actualTargetSide].heldItem!;
      battlers[actualTargetSide] = { ...removeHeldItem(battlers[actualTargetSide]),
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
        battlers[actualTargetSide] = removeHeldItem(battlers[actualTargetSide]);
        events.push({ type: "heldItemConsumed", side: actualTargetSide, item: berry, effect: "eaten", hp: battlers[actualTargetSide].hp });
        const berryWorks = heldItemIsActive({ ...battlers[side], heldItem: berry });
        if (berryWorks && berry === "ORANBERRY" && battlers[side].hp > 0) {
          const eater = battlers[side];
          const amount = Math.min(10, eater.stats.maxHp - eater.hp);
          battlers[side] = { ...eater, hp: eater.hp + amount };
          if (amount > 0) events.push({ type: "hpRestored", side, source: "move", move: slot.move.internalName,
            amount, hp: eater.hp + amount });
        }
        if (berryWorks && berry === "LIECHIBERRY" && battlers[side].hp > 0) {
          applyStatChange(side, actualTargetSide, { target: "self", stat: "attack", delta: 1 }, battlers, events);
        }
        if (berryWorks) battlers[side] = applyCheekPouch(battlers[side], side, events);
      }
    }
    if (damage > 0 && slot.move.functionCode === "0FA" && battlers[side].hp > 0
      && !["ROCKHEAD", "MAGICGUARD", "CABEZAHIELO"].includes(battlers[side].ability ?? "")
      && !(heldItemIsActive(battlers[side]) && battlers[side].heldItem === "CASCOPROTECTOR")) {
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
      && stolenItem !== null && !heldItemIsUnlosable(battlers[side]) && itemTheftAllowed) {
      battlers[side] = removeHeldItem(battlers[side]);
      battlers[actualTargetSide] = { ...pickpocket, heldItem: stolenItem };
      effects.itemTransfers.push({ item: stolenItem, sourceId: battlers[side].id,
        targetId: battlers[actualTargetSide].id, reason: "pickpocket" });
      events.push({ type: "abilityActivated", side: actualTargetSide, ability: "PICKPOCKET", effect: "steal-item" },
        { type: "heldItemTransferred", source: side, target: actualTargetSide, item: stolenItem, reason: "pickpocket" });
    }
    const contact = damage > 0 && side !== actualTargetSide && slot.move.flags?.includes("a") === true;
    if (contact && defender.ability === "AFTERMATH" && hp === 0 && battlers[side].hp > 0
      && battlers[side].ability !== "MAGICGUARD" && !hasMoldBreaker(battlers[side]) && dampSide === null) {
      const attacker = battlers[side];
      const amount = Math.min(attacker.hp, Math.floor(attacker.stats.maxHp / 4));
      battlers[side] = { ...attacker, hp: attacker.hp - amount };
      events.push({ type: "abilityActivated", side: actualTargetSide,
        ability: "AFTERMATH", effect: "damage-attacker" },
      { type: "abilityDamage", source: actualTargetSide, target: side,
        ability: "AFTERMATH", amount, hp: attacker.hp - amount });
      if (attacker.hp - amount === 0) events.push({ type: "fainted", side });
    }
    if (contact && defender.ability === "MUMMY" && battlers[side].hp > 0
      && !["MULTITYPE", "DISGUISE", "STANCECHANGE", "MUMMY"].includes(battlers[side].ability ?? "")) {
      battlers[side] = withTemporaryAbility(battlers[side], "MUMMY");
      events.push({ type: "abilityActivated", side: actualTargetSide, ability: "MUMMY", effect: "change-ability" },
        { type: "abilityChanged", source: actualTargetSide, target: side, ability: "MUMMY",
          move: slot.move.internalName });
    }
    if (contact && defender.ability === "CUTECHARM" && draw(rng, trace, "ability", 10) < 3) {
      const charmed = battlers[side];
      const charmer = battlers[actualTargetSide];
      const charmedGender = charmed.appearance?.gender;
      const charmerGender = charmer.appearance?.gender;
      if (charmed.hp > 0 && charmer.hp > 0 && volatileOf(charmed).infatuated !== true
        && charmed.ability !== "OBLIVIOUS"
        && (charmedGender === "male" || charmedGender === "female")
        && (charmerGender === "male" || charmerGender === "female") && charmedGender !== charmerGender) {
        battlers[side] = withVolatile(charmed, { ...volatileOf(charmed), infatuated: true });
        events.push({ type: "abilityActivated", side: actualTargetSide,
          ability: "CUTECHARM", effect: "inflict-status" },
        { type: "volatileApplied", source: actualTargetSide, target: side,
          effect: "infatuation", turns: null, move: slot.move.internalName });
      }
    }
    if (contact && defender.ability === "EFFECTSPORE" && draw(rng, trace, "ability", 10) < 3) {
      const attacker = battlers[side];
      const powderImmune = attacker.types.includes("GRASS") || attacker.ability === "OVERCOAT"
        || heldItemIsActive(attacker) && attacker.heldItem === "SAFETYGOGGLES";
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
    if (contact && defender.ability === "DINAMO" && battlers[actualTargetSide].hp > 0
      && (battlers[actualTargetSide].volatile?.chargeTurns ?? 0) <= 0) {
      const charged = battlers[actualTargetSide];
      battlers[actualTargetSide] = withVolatile(charged, { ...volatileOf(charged), chargeTurns: 2 });
      events.push({ type: "abilityActivated", side: actualTargetSide, ability: "DINAMO", effect: "charge" },
        { type: "volatileApplied", source: actualTargetSide, target: actualTargetSide,
          effect: "charge", turns: 2, move: null });
      applyStatChange(actualTargetSide, side,
        { target: "self", stat: "specialDefense", delta: 1 }, battlers, events);
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
      applyStatChange(actualTargetSide, side, { target: "opponent", stat: "speed", delta: -1 }, battlers, events, effects);
    }
    if (contact && defender.ability === "OLORPORCINO" && battlers[side].hp > 0) {
      for (let hit = 0; hit < landedHits; hit += 1) {
        const start = events.length;
        if (applyStatChange(actualTargetSide, side,
          { target: "opponent", stat: "evasion", delta: -2 }, battlers, events, effects)) {
          events.splice(start, 0, { type: "abilityActivated", side: actualTargetSide,
            ability: "OLORPORCINO", effect: "lower-evasion" });
        }
      }
    }
    if (contact && battlers[side].ability === "POISONTOUCH" && battlers[actualTargetSide].hp > 0
      && battlers[actualTargetSide].majorStatus === null
      && !typePreventsStatus(battlers[actualTargetSide], "poison") && draw(rng, trace, "ability", 10) < 3) {
      applyAbilityStatus(side, actualTargetSide, "POISONTOUCH", "poison", battlers, rng, events, trace);
    }
    if (contact && battlers[side].ability === "BRUTALIDAD" && battlers[actualTargetSide].hp > 0
      && battlers[actualTargetSide].majorStatus === null
      && !typePreventsStatus(battlers[actualTargetSide], "hemorrhage") && draw(rng, trace, "ability", 10) < 5) {
      applyAbilityStatus(side, actualTargetSide, "BRUTALIDAD", "hemorrhage", battlers, rng, events, trace);
    }
    if (contact && battlers[side].ability === "RELAMPAGUEO" && battlers[actualTargetSide].hp > 0
      && battlers[actualTargetSide].majorStatus === null
      && !typePreventsStatus(battlers[actualTargetSide], "paralysis")
      && draw(rng, trace, "ability", 10) < 3) {
      applyAbilityStatus(side, actualTargetSide, "RELAMPAGUEO", "paralysis", battlers, rng, events, trace);
    }
    if (contact && battlers[side].ability === "TOQUEMAGICO" && battlers[actualTargetSide].hp > 0
      && (battlers[actualTargetSide].volatile?.confusionTurns ?? 0) <= 0
      && battlers[actualTargetSide].ability !== "OWNTEMPO" && draw(rng, trace, "ability", 10) < 2) {
      const confused = battlers[actualTargetSide];
      const turns = 2 + draw(rng, trace, "confusion-duration", 4);
      battlers[actualTargetSide] = withVolatile(confused, { ...volatileOf(confused), confusionTurns: turns });
      events.push({ type: "abilityActivated", side, ability: "TOQUEMAGICO", effect: "inflict-status" },
        { type: "volatileApplied", source: side, target: actualTargetSide,
          effect: "confusion", turns, move: slot.move.internalName });
    }
    if (hp === 0 && defender.ability === "INNARDSOUT") {
      const current = battlers[side];
      const amount = Math.min(current.hp, damage);
      battlers[side] = { ...current, hp: current.hp - amount };
      events.push({ type: "abilityActivated", side: actualTargetSide,
        ability: "INNARDSOUT", effect: "damage-attacker" },
      { type: "abilityDamage", source: actualTargetSide, target: side,
        ability: "INNARDSOUT", amount, hp: current.hp - amount });
      if (current.hp - amount === 0) events.push({ type: "fainted", side });
    }
    if (damage > 0 && slot.move.flags?.includes("a") === true && heldItemIsActive(defender)
      && defender.heldItem === "ROCKYHELMET"
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
      && battlers[side].ability !== "ROCKHEAD" && battlers[side].ability !== "MAGICGUARD"
      && battlers[side].ability !== "CABEZAHIELO") {
      const attacker = battlers[side];
      const amount = Math.min(attacker.hp, Math.round(damage / divisor));
      battlers[side] = { ...attacker, hp: attacker.hp - amount };
      if (amount > 0) events.push({ type: "recoilDamage", side, move: slot.move.internalName,
        reason: "recoil", amount, hp: attacker.hp - amount });
      if (attacker.hp - amount === 0) events.push({ type: "fainted", side });
    }
    if (options.attackerHeldItemAfterDamage !== false && damage > 0
      && heldItemIsActive(battlers[side]) && battlers[side].heldItem === "LIFEORB" && battlers[side].hp > 0
      && battlers[side].ability !== "MAGICGUARD"
      && !(battlers[side].ability === "SHEERFORCE" && slot.move.effectChance > 0)) {
      const current = battlers[side];
      const amount = Math.min(current.hp, Math.max(1, Math.floor(current.stats.maxHp / 10)));
      battlers[side] = { ...current, hp: current.hp - amount };
      events.push({ type: "itemActivated", side, item: "LIFEORB", effect: "damage",
        amount, hp: current.hp - amount });
      if (current.hp - amount === 0) events.push({ type: "fainted", side });
    }
    if (damage > 0 && !(battlers[side].ability === "SHEERFORCE" && slot.move.effectChance > 0)) {
      const changedType = colorChangeType(battlers[actualTargetSide], moveType);
      if (changedType !== null) {
        const current = battlers[actualTargetSide];
        const currentVolatile = volatileOf(current);
        battlers[actualTargetSide] = withVolatile({ ...current, types: [changedType] }, { ...currentVolatile,
          originalTypes: currentVolatile.originalTypes ?? [...current.types] });
        events.push({ type: "abilityActivated", side: actualTargetSide,
          ability: "COLORCHANGE", effect: "change-type" });
      }
    }
    if (hp === 0) {
      const knockoutReaction = knockoutAbilityStatReaction(battlers[side]);
      if (knockoutReaction !== null) {
        const reactionStart = events.length;
        if (applyStatChange(side, actualTargetSide, { target: "self", stat: knockoutReaction.stat,
          delta: knockoutReaction.delta }, battlers, events)) {
          events.splice(reactionStart, 0, { type: "abilityActivated", side,
            ability: knockoutReaction.ability, effect: "raise-stat" });
        }
      }
    }
    if (hp === 0) {
      if (battlers[side].hp === 0) battleDraw = true;
      else winner = opponentOf(actualTargetSide);
      events.push({ type: "fainted", side: actualTargetSide });
      if (options.endOfTurn !== false) events.push({ type: "battleEnded", winner: battleDraw ? null : winner });
    }
  }

  if (options.endOfTurn !== false && winner === null && !battleDraw) {
    const playerFainted = battlers.player.hp === 0;
    const opponentFainted = battlers.opponent.hp === 0;
    if (playerFainted && opponentFainted) {
      battleDraw = true;
      events.push({ type: "battleEnded", winner: null });
    } else if (playerFainted !== opponentFainted) {
      winner = playerFainted ? "opponent" : "player";
      events.push({ type: "battleEnded", winner });
    }
  }
  if (options.endOfTurn === false) winner = null;
  else {
    if (winner === null && !battleDraw) applyHydrationAbilities(battlers, events, effectiveWeather);
    if (winner === null && !battleDraw) winner = applyResidualStatus(battlers, events);
    if (winner === null && !battleDraw) winner = applyResidualVolatile(battlers, events, effects.terrain);
    if (winner === null && !battleDraw) winner = applyHeldItems(battlers, events, rng, trace, effectiveWeather, effects);
    if (winner === null && !battleDraw) applyItemRecoveryAbilities(battlers, events, rng, trace, effectiveWeather, effects);
    if (winner === null && !battleDraw) winner = applyLateAbilities(battlers, events, rng, trace);
    tickBattleEffects(effects, events);
  }

  events.push({ type: "turnEnded", turn: state.turn });
  for (const side of SIDES) {
    const ability = suppressedAbilities[side];
    if (ability !== undefined && battlers[side].ability === null
      && battlers[side].volatile?.gastroAcid !== true) battlers[side] = { ...battlers[side], ability };
  }
  return {
    state: { turn: state.turn + (options.endOfTurn === false ? 0 : 1),
      status: winner === null && !battleDraw ? "active" : "finished", winner, battlers, effects },
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
