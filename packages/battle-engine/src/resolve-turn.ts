import { calculateDamage, effectiveTypeMultiplier, effectiveWeight } from "./damage.js";
import { assistMoveFrom, sleepTalkMoveFrom } from "./called-move-selection.js";
import { colorChangeType, knockoutAbilityStatReaction } from "./ability-after-hit.js";
import { activateWindAbility } from "./ability-wind.js";
import { resolveEntryAbility } from "./ability-entry.js";
import { damageAbilityStatReaction, opposingStatDropReaction,
  resolveStatStageChange, clearStatStages } from "./ability-stat-reactions.js";
import { cureStatusBlockedByAbility, statDropProtectionAbility, statusProtectionAbility } from "./ability-protection.js";
import { copycatMoveFrom, hasHighCriticalRate, isBombMove, isSoundMove, isWindMove, meFirstMoveFrom,
  mirrorMoveFrom, moveTargetsUser,
  recoilDivisor } from "./move-properties.js";
import { effectiveBattleWeather, ordinaryWeather, resolveWeatherEndOfTurn, weatherEvasionMultiplier,
  weatherSpeedMultiplier } from "./ability-weather.js";
import { isKnownType, REAL_BATTLE_TYPES, typeEffectiveness } from "./type-chart.js";
import { effectiveMoveCategory, effectiveMovePriority, effectiveMoveType, hasMoldBreaker, hasMoveFlag } from "./move-properties.js";
import { transformBattler } from "./battle-transform.js";
import { resolveHealer, resolveHydration, resolveLateEndOfTurnAbilities, resolvePoisonHeal,
  sleepDurationForAbility } from "./ability-end-turn.js";
import { berriesBlockedBy, consumeHeldItem, heldItemIsActive, heldItemIsUnlosable, isSupportedBerry, moveCanTriggerPressure,
  removeHeldItem } from "./ability-item-control.js";
import { isGrounded, resolveGrassyTerrainHealing } from "./ability-field-entry.js";
import { naturalGiftProfile } from "./natural-gift.js";
import { flingPower } from "./battle-fling.js";
import { custapBerryReady, resistBerryApplies } from "./battle-berries.js";
import { applyStanceChange } from "./ability-form.js";
import { switchTrapAbility } from "./ability-switch-trap.js";
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
  lastMoveUsed: BattleMove | null;
  sides: Record<BattleSide, { reflectTurns: number; lightScreenTurns: number; luckyChantTurns: number;
    spikesLayers: number; toxicSpikesLayers: number; stealthRock: boolean; stickyWeb: boolean;
    mistTurns: number; safeguardTurns: number; tailwindTurns: number; quickGuard: boolean; wideGuard: boolean;
    lastFaintedTurn?: number | null;
    echoedVoiceCount?: number; echoedVoiceLastTurn?: number | null }>;
  mudSportTurns: number;
  waterSportTurns: number;
  itemTransfers: { item: NonNullable<BattlerState["heldItem"]>; sourceId: string;
    targetId: string; reason: "pickpocket" }[];
  scatteredCoins: Record<string, number>;
  nextPickupUse: number;
  terrain: "electric" | "grassy" | "misty" | "psychic" | null;
  terrainTurns: number;
  trickRoomTurns: number;
  magicRoomTurns: number;
  gravityTurns: number;
  wonderRoomTurns: number;
  weather: NonNullable<BattleEffects["weather"]> | null;
  weatherTurns: number;
  fusionBoltTurn: number | null;
  fusionFlareTurn: number | null;
  environment: NonNullable<BattleEffects["environment"]>;
};

export function volatileOf(battler: BattlerState): BattleVolatile {
  const neutral = { confusionTurns: 0, flinched: false, focusEnergy: 0, micleBerry: false, identified: false,
    miracleEye: false, lockOnBy: null, lockOnTurns: 0,
    disabledMove: null, disableTurns: 0, encoreMove: null, encoreTurns: 0,
    bindingMove: null, bindingTurns: 0, cursed: false, lastMoveUsed: null, usedMoveNames: [],
    lastUsedMove: null, lastMoveUsedType: null, lastSketchableMove: null, retaliation: null,
    mimicOriginalSlots: [],
    activeTurns: 0, enteredMidTurn: false, protected: false, endured: false, guarded: false,
    protectRate: 1, tauntTurns: 0, tormented: false, imprisoning: false, magicCoat: false, snatching: false,
    healBlockTurns: 0, stockpileCount: 0, stockpileDefense: 0, stockpileSpecialDefense: 0, minimized: false,
    rage: false,
    flashFire: false, entryAbilityResolved: false, traceOriginalAbility: null, originalAbility: null,
    abilityReplacementActive: false,
    originalTypes: null, addedType: null,
    leechSeededBy: null, leechSeededBySlot: null, chargeTurns: 0, yawnTurns: 0,
    yawnBypassesAbility: false, infatuated: false,
    furyCutterCount: 0, rolloutTurns: 0, uproarTurns: 0, embargoTurns: 0,
    unburdened: false, pickupItem: null, pickupUse: 0, truantLoafing: false,
    choiceLockedMove: null, originalForm: null, originalStats: null, originalMoveStats: null,
    powerTrick: false, gastroAcid: false, weightChange: 0,
    perishTurns: 0, perishSource: null, grudge: false, destinyBond: false,
    healingWish: false, lunarDance: false, batonPass: false, meanLookBy: null, ingrain: false,
    magnetRiseTurns: 0, telekinesisTurns: 0, smackDown: false,
    aquaRing: false, wishTurns: 0, wishAmount: 0, wishMaker: null, roostOriginalTypes: null,
    outrageTurns: 0, bideTurns: 0, bideDamage: 0, bideTargetId: null,
    chargingMove: null, chargingCalledMove: null, chargingTargetId: null, skyDropCarrierId: null,
    skyDropLockedTurn: null, rechargeTurns: 0 };
  return { ...neutral, ...(battler.volatile ?? {}) };
}

export function applyPerishSongToBattler(battler: BattlerState, source: BattleSide,
  bypassSoundproof = false): BattlerState {
  if (battler.hp <= 0 || volatileOf(battler).perishTurns > 0
    || battler.ability === "SOUNDPROOF" && !bypassSoundproof) return battler;
  return withVolatile(battler, { ...volatileOf(battler), perishTurns: 4, perishSource: source });
}

function effectsOf(effects: BattleEffects | undefined): MutableBattleEffects {
  return effects === undefined ? { sides: {
    player: { reflectTurns: 0, lightScreenTurns: 0, luckyChantTurns: 0, spikesLayers: 0,
      toxicSpikesLayers: 0, stealthRock: false, stickyWeb: false, mistTurns: 0, safeguardTurns: 0, tailwindTurns: 0,
      quickGuard: false, wideGuard: false },
    opponent: { reflectTurns: 0, lightScreenTurns: 0, luckyChantTurns: 0, spikesLayers: 0,
      toxicSpikesLayers: 0, stealthRock: false, stickyWeb: false, mistTurns: 0, safeguardTurns: 0, tailwindTurns: 0,
      quickGuard: false, wideGuard: false },
  }, lastMoveUsed: null, mudSportTurns: 0, waterSportTurns: 0, itemTransfers: [], scatteredCoins: {}, terrain: null, terrainTurns: 0, trickRoomTurns: 0,
  magicRoomTurns: 0, gravityTurns: 0, wonderRoomTurns: 0,
  nextPickupUse: 0, weather: null, weatherTurns: 0, fusionBoltTurn: null,
  fusionFlareTurn: null, environment: "none" } : { sides: {
    player: { ...effects.sides.player, lightScreenTurns: effects.sides.player.lightScreenTurns ?? 0,
      spikesLayers: effects.sides.player.spikesLayers ?? 0,
      toxicSpikesLayers: effects.sides.player.toxicSpikesLayers ?? 0,
      stealthRock: effects.sides.player.stealthRock ?? false,
      stickyWeb: effects.sides.player.stickyWeb ?? false,
      mistTurns: effects.sides.player.mistTurns ?? 0,
      safeguardTurns: effects.sides.player.safeguardTurns ?? 0,
      tailwindTurns: effects.sides.player.tailwindTurns ?? 0,
      quickGuard: effects.sides.player.quickGuard ?? false, wideGuard: effects.sides.player.wideGuard ?? false },
    opponent: { ...effects.sides.opponent, lightScreenTurns: effects.sides.opponent.lightScreenTurns ?? 0,
      spikesLayers: effects.sides.opponent.spikesLayers ?? 0,
      toxicSpikesLayers: effects.sides.opponent.toxicSpikesLayers ?? 0,
      stealthRock: effects.sides.opponent.stealthRock ?? false,
      stickyWeb: effects.sides.opponent.stickyWeb ?? false,
      mistTurns: effects.sides.opponent.mistTurns ?? 0,
      safeguardTurns: effects.sides.opponent.safeguardTurns ?? 0,
      tailwindTurns: effects.sides.opponent.tailwindTurns ?? 0,
      quickGuard: effects.sides.opponent.quickGuard ?? false, wideGuard: effects.sides.opponent.wideGuard ?? false },
  }, lastMoveUsed: effects.lastMoveUsed ?? null, mudSportTurns: effects.mudSportTurns ?? 0, waterSportTurns: effects.waterSportTurns,
  itemTransfers: [...(effects.itemTransfers ?? [])],
  scatteredCoins: { ...(effects.scatteredCoins ?? {}) },
  nextPickupUse: effects.nextPickupUse ?? 0,
  terrain: effects.terrain ?? null, terrainTurns: effects.terrainTurns ?? 0,
  trickRoomTurns: effects.trickRoomTurns ?? 0,
  magicRoomTurns: effects.magicRoomTurns ?? 0, gravityTurns: effects.gravityTurns ?? 0,
  wonderRoomTurns: effects.wonderRoomTurns ?? 0,
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
    addedType: null, originalTypes: current.originalTypes ?? [...battler.types] });
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

function presentPower(roll: number): number {
  return roll < 4 ? 90 : roll < 7 ? 140 : 200;
}

function accuracyFactor(stage: number): number {
  return stage >= 0 ? (stage + 3) / 3 : 3 / (3 - stage);
}

type SelectedMoveActions = Readonly<Partial<Record<BattleSide, MoveAction>>>;

const HEALING_FUNCTION_CODES = new Set<string>([
  "0D5", "0D6", "0D7", "0D8", "0D9", "0DA", "0DB", "0DD", "0DE", "0DF", "0E3", "0E4", "114", "14F", "902",
]);

function isHealingMove(move: BattleMove): boolean {
  return HEALING_FUNCTION_CODES.has(move.functionCode);
}

function statusKind(move: BattleMove): MajorStatusState["kind"] | null {
  if (move.functionCode === "003") return "sleep";
  if (move.functionCode === "005" || move.functionCode === "006" || move.functionCode === "0BE") return "poison";
  if (move.functionCode === "007" || move.functionCode === "008" || move.functionCode === "009"
    || move.functionCode === "0C5" || move.functionCode === "0CC") return "paralysis";
  if (move.functionCode === "00A" || move.functionCode === "00B" || move.functionCode === "0C6") return "burn";
  if (move.functionCode === "00C" || move.functionCode === "00D" || move.functionCode === "00E"
    || move.functionCode === "135") return "frozen";
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
  if (effectiveDelta < 0 && target !== source && !opposingMoldBreaker
    && battler.heldItem === "CLEARAMULET"
    && heldItemIsActive(battler, effects?.magicRoomTurns ?? 0)) {
    events.push({ type: "statStageChangeFailed", source, target, stat: effect.stat, reason: "item" });
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
  weather: BattleEffects["weather"],
  battlers: Record<BattleSide, BattlerState>, events: BattleEvent[]): boolean {
  if (source === target) return false;
  const attacker = battlers[source];
  const defender = battlers[target];
  if (hasMoldBreaker(attacker)) return false;
  const moveType = effectiveMoveType(attacker, move, weather).type;
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

function releaseStockpile(side: BattleSide, battlers: Record<BattleSide, BattlerState>,
  events: BattleEvent[], effects: MutableBattleEffects): void {
  const stored = volatileOf(battlers[side]);
  if (stored.stockpileDefense > 0) applyStatChange(side, side,
    { target: "self", stat: "defense", delta: -stored.stockpileDefense }, battlers, events, effects);
  if (stored.stockpileSpecialDefense > 0) applyStatChange(side, side,
    { target: "self", stat: "specialDefense", delta: -stored.stockpileSpecialDefense }, battlers, events, effects);
  battlers[side] = withVolatile(battlers[side], { ...volatileOf(battlers[side]),
    stockpileCount: 0, stockpileDefense: 0, stockpileSpecialDefense: 0 });
  events.push({ type: "volatileEnded", side, effect: "stockpile" });
}

/** Gravity grounds all active battlers, including partners handled by the double adapter. */
export function clearAirborneEffects(battler: BattlerState, side: BattleSide):
  { battler: BattlerState; events: readonly BattleEvent[] } {
  const current = volatileOf(battler);
  const chargeCode = current.chargingCalledMove?.functionCode
    ?? battler.moves.find((slot) => slot.move.internalName === current.chargingMove)?.move.functionCode;
  const charging = ["0C9", "0CC", "0CE"].includes(chargeCode ?? "");
  const hadMagnetRise = current.magnetRiseTurns > 0;
  const hadTelekinesis = current.telekinesisTurns > 0;
  const carried = current.skyDropCarrierId !== null;
  if (!charging && !hadMagnetRise && !hadTelekinesis && !carried) return { battler, events: [] };
  return { battler: withVolatile(battler, { ...current,
    ...(charging ? { chargingMove: null, chargingCalledMove: null, chargingTargetId: null } : {}),
    ...(carried ? { skyDropCarrierId: null } : {}), magnetRiseTurns: 0, telekinesisTurns: 0 }),
  events: [
    ...(hadMagnetRise ? [{ type: "volatileEnded" as const, side, effect: "magnet-rise" as const }] : []),
    ...(hadTelekinesis ? [{ type: "volatileEnded" as const, side, effect: "telekinesis" as const }] : []),
    ...(carried ? [{ type: "volatileEnded" as const, side, effect: "sky-drop" as const }] : []),
  ] };
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
  wildBattle = false,
): void {
  if (move.functionCode === "1B9") {
    applyStatChange(source, target, { target: "opponent", stat: "speed", delta: -2 },
      battlers, events, effects);
    applyStatusMove(source, target, { ...move, functionCode: "005" }, battlers,
      rng, events, trace, effects, weather);
    return;
  }
  if (move.functionCode === "911") {
    const code = (["005", "003", "007"] as const)[draw(rng, trace, "additional-effect", 3)]!;
    applyStatusMove(source, target, { ...move, functionCode: code }, battlers,
      rng, events, trace, effects, weather);
    return;
  }
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
  if (move.functionCode === "0E2") {
    const start = events.length;
    applyStatChange(source, target, { target: "opponent", stat: "attack", delta: -2 }, battlers, events, effects);
    applyStatChange(source, target, { target: "opponent", stat: "specialAttack", delta: -2 }, battlers, events, effects);
    const user = battlers[source];
    battlers[source] = { ...user, hp: 0 };
    events.push({ type: "recoilDamage", side: source, move: move.internalName,
      reason: "self-destruct", amount: user.hp, hp: 0 }, { type: "fainted", side: source });
    if (!events.slice(start).some((event) => event.type === "statStageChanged")) events.push({
      type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
    return;
  }
  if (move.functionCode === "0E3" || move.functionCode === "0E4") {
    const user = battlers[source];
    const lunarDance = move.functionCode === "0E4";
    battlers[source] = withVolatile({ ...user, hp: 0 }, { ...volatileOf(user),
      healingWish: !lunarDance, lunarDance });
    events.push({ type: "volatileApplied", source, target: source,
      effect: lunarDance ? "lunar-dance" : "healing-wish", turns: null, move: move.internalName },
    { type: "recoilDamage", side: source, move: move.internalName,
      reason: "self-destruct", amount: user.hp, hp: 0 }, { type: "fainted", side: source });
    return;
  }
  if (move.functionCode === "0E5") {
    let applied = false;
    for (const candidate of SIDES) {
      const current = battlers[candidate];
      const affected = applyPerishSongToBattler(current, source, hasMoldBreaker(battlers[source]));
      if (affected === current) continue;
      battlers[candidate] = affected;
      events.push({ type: "volatileApplied", source, target: candidate,
        effect: "perish-song", turns: 4, move: move.internalName });
      applied = true;
    }
    if (!applied) events.push({ type: "moveFailed", side: source,
      move: move.internalName, reason: "condition" });
    return;
  }
  if (move.functionCode === "0E6" || move.functionCode === "0E7" || move.functionCode === "0ED") {
    const user = battlers[source];
    const effect = move.functionCode === "0E6" ? "grudge" as const
      : move.functionCode === "0E7" ? "destiny-bond" as const : "baton-pass" as const;
    battlers[source] = withVolatile(user, { ...volatileOf(user),
      [move.functionCode === "0E6" ? "grudge"
        : move.functionCode === "0E7" ? "destinyBond" : "batonPass"]: true });
    events.push({ type: "volatileApplied", source, target: source,
      effect, turns: null, move: move.internalName });
    if (move.functionCode === "0ED") events.push({ type: "forcedSwitchRequested", side: source,
      move: move.internalName });
    return;
  }
  if (move.functionCode === "0EA") {
    events.push({ type: "battleEscaped", side: source, move: move.internalName });
    return;
  }
  if (move.functionCode === "0EB") {
    const defender = battlers[target];
    if (defender.ability === "SUCTIONCUPS" && !hasMoldBreaker(battlers[source])) {
      events.push({ type: "abilityActivated", side: target, ability: "SUCTIONCUPS", effect: "block-move" },
        { type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    if (defender.volatile?.ingrain === true) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    if (wildBattle) {
      if (defender.level > battlers[source].level) events.push({ type: "moveFailed", side: source,
        move: move.internalName, reason: "condition" });
      else events.push({ type: "battleEscaped", side: target, move: move.internalName });
      return;
    }
    events.push({ type: "forcedSwitchRequested", side: target, move: move.internalName });
    return;
  }
  if (move.functionCode === "0EF") {
    const defender = battlers[target];
    if (defender.types.includes("GHOST") || defender.volatile?.meanLookBy != null) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    battlers[target] = withVolatile(defender, { ...volatileOf(defender),
      meanLookBy: battlers[source].id });
    events.push({ type: "volatileApplied", source, target, effect: "mean-look",
      turns: null, move: move.internalName });
    return;
  }
  if (move.functionCode === "0F2" || move.functionCode === "0F3") {
    const user = battlers[source];
    const defender = battlers[target];
    const userItem = user.heldItem;
    const targetItem = defender.heldItem;
    const blocked = source === target || (move.functionCode === "0F2"
      ? userItem === null && targetItem === null
      : userItem === null || targetItem !== null)
      || userItem !== null && (heldItemIsUnlosable(user)
        || heldItemIsUnlosable({ ...defender, heldItem: userItem }))
      || targetItem !== null && (heldItemIsUnlosable(defender)
        || heldItemIsUnlosable({ ...user, heldItem: targetItem }))
      || defender.ability === "STICKYHOLD" && !hasMoldBreaker(user);
    if (blocked) {
      if (defender.ability === "STICKYHOLD" && !hasMoldBreaker(user)) events.push({
        type: "abilityActivated", side: target, ability: "STICKYHOLD", effect: "block-move",
      });
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    const received = move.functionCode === "0F2" ? targetItem : null;
    battlers[source] = { ...user, heldItem: received,
      heldItemTransfer: user.heldItemTransfer ?? { originalItem: userItem },
      volatile: { ...volatileOf(user), choiceLockedMove: null,
        unburdened: move.functionCode === "0F3" && userItem !== null
          ? true : volatileOf(user).unburdened } };
    battlers[target] = { ...defender, heldItem: userItem,
      heldItemTransfer: defender.heldItemTransfer ?? { originalItem: targetItem },
      volatile: { ...volatileOf(defender),
        choiceLockedMove: move.functionCode === "0F2" ? null : volatileOf(defender).choiceLockedMove } };
    if (userItem !== null) events.push({ type: "heldItemTransferred", source, target,
      item: userItem, move: move.internalName });
    if (targetItem !== null) events.push({ type: "heldItemTransferred", source: target, target: source,
      item: targetItem, move: move.internalName });
    return;
  }
  if (move.functionCode === "0F6") {
    const user = battlers[source];
    if (user.recyclableItem === null || user.recyclableItem === undefined) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    const item = user.recyclableItem;
    battlers[source] = { ...user, heldItem: item, recyclableItem: null,
      volatile: { ...volatileOf(user), pickupItem: null, pickupUse: 0 } };
    events.push({ type: "heldItemRecovered", side: source, item, ability: "RECYCLE" });
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
  if (["13A", "13C", "13D"].includes(move.functionCode)) {
    const stats = move.functionCode === "13A" ? ["attack", "specialAttack"] as const
      : ["specialAttack"] as const;
    let changed = false;
    for (const stat of stats) {
      changed = applyStatChange(source, target, { target: "opponent", stat,
        delta: move.functionCode === "13D" ? -2 : -1 }, battlers, events, effects) || changed;
    }
    if (!changed && move.category === "Status") events.push({ type: "moveFailed", side: source,
      move: move.internalName, reason: "condition" });
    return;
  }
  if (move.functionCode === "142" || move.functionCode === "143" || move.functionCode === "904") {
    const victim = battlers[target];
    const added = move.functionCode === "142" ? "GHOST" : "GRASS";
    const invalid = victim.ability === "MULTITYPE"
      || (move.functionCode === "904"
        ? victim.types.every((type) => type === "PSYCHIC")
        : victim.types.includes(added) || move.functionCode === "143"
          && victim.volatile?.leechSeededBy != null);
    if (invalid) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    if (move.functionCode === "904") {
      battlers[target] = withTemporaryTypes(victim, ["PSYCHIC"]);
    } else {
      const current = volatileOf(victim);
      const baseTypes = current.addedType === null
        ? victim.types : victim.types.filter((type) => type !== current.addedType);
      const changed = withTemporaryTypes(victim, [...baseTypes, added]);
      battlers[target] = withVolatile(changed, { ...volatileOf(changed), addedType: added });
    }
    events.push({ type: "typesChanged", source, target, types: battlers[target].types,
      move: move.internalName });
    return;
  }
  if (move.functionCode === "902") {
    const user = battlers[source];
    const victim = battlers[target];
    if (victim.hp <= 0) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    const stage = victim.stages.attack;
    const attack = Math.floor(victim.stats.attack * (stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage)));
    applyStatChange(target, target, { target: "opponent", stat: "attack", delta: -1 },
      battlers, events, effects);
    if (victim.ability === "LIQUIDOOZE") {
      const amount = Math.min(user.hp, attack);
      battlers[source] = { ...user, hp: user.hp - amount };
      events.push({ type: "abilityActivated", side: target, ability: "LIQUIDOOZE",
        effect: "damage-attacker" }, { type: "abilityDamage", source: target, target: source,
        ability: "LIQUIDOOZE", amount, hp: user.hp - amount });
      if (user.hp - amount === 0) events.push({ type: "fainted", side: source });
    } else if ((user.volatile?.healBlockTurns ?? 0) === 0) {
      const raw = heldItemIsActive(user, effects.magicRoomTurns) && user.heldItem === "BIGROOT"
        ? Math.floor(attack * 1.3) : attack;
      const amount = Math.min(user.stats.maxHp - user.hp, raw);
      if (amount > 0) {
        battlers[source] = { ...user, hp: user.hp + amount };
        events.push({ type: "hpRestored", side: source, source: "move", move: move.internalName,
          amount, hp: user.hp + amount });
      }
    }
    return;
  }
  const change = statChangeEffect(move);
  if (change !== null) {
    if (move.functionCode === "034") battlers[source] = withVolatile(battlers[source], {
      ...volatileOf(battlers[source]), minimized: true });
    applyStatChange(source, target, change, battlers, events, effects);
    return;
  }
  if (statusKind(move) !== null) {
    applyStatusMove(source, target, move, battlers, rng, events, trace, effects, weather);
    return;
  }
  if (move.functionCode === "013" || move.functionCode === "014" || move.functionCode === "015") {
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
  if (move.functionCode === "011") {
    const defender = battlers[target];
    if (defender.ability !== "INNERFOCUS") {
      battlers[target] = withVolatile(defender, { ...volatileOf(defender), flinched: true });
      events.push({ type: "volatileApplied", source, target, effect: "flinch", turns: 1, move: move.internalName });
    }
    return;
  }
  if (move.functionCode === "001" || move.functionCode === "09C") {
    events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
    return;
  }
  if (move.functionCode === "0A4") {
    const environment = effects.environment;
    const terrain = effects.terrain;
    if (terrain === "electric" || terrain === "grassy") {
      applyStatusMove(source, target, { ...move, functionCode: terrain === "electric" ? "007" : "003" },
        battlers, rng, events, trace, effects, weather);
      if (battlers[target].majorStatus !== null) return;
    }
    if (terrain === "misty" && applyStatChange(source, target,
      { target: "opponent", stat: "specialAttack", delta: -1 }, battlers, events, effects)) return;
    const statusCode = ["grass", "tall-grass", "forest"].includes(environment) ? "003"
      : environment === "snow" ? "00C" : environment === "volcano" ? "00A"
        : !["moving-water", "underwater", "still-water", "sky", "sand", "rock", "cave", "graveyard", "space"].includes(environment)
          ? "007" : null;
    if (statusCode !== null) {
      applyStatusMove(source, target, { ...move, functionCode: statusCode }, battlers,
        rng, events, trace, effects, weather);
      return;
    }
    const stat = ["moving-water", "underwater"].includes(environment) ? "attack"
        : ["still-water", "sky"].includes(environment) ? "speed"
          : ["sand", "rock"].includes(environment) ? "accuracy" : null;
    if (stat !== null) {
      applyStatChange(source, target, { target: "opponent", stat, delta: -1 }, battlers, events, effects);
      return;
    }
    if (["cave", "graveyard", "space"].includes(environment)) {
      const defender = battlers[target];
      if (defender.ability !== "INNERFOCUS") {
        battlers[target] = withVolatile(defender, { ...volatileOf(defender), flinched: true });
        events.push({ type: "volatileApplied", source, target, effect: "flinch", turns: 1, move: move.internalName });
      }
    }
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
  if (move.functionCode === "0F9") {
    effects.magicRoomTurns = effects.magicRoomTurns > 0 ? 0 : 5;
    events.push({ type: "battleEffectChanged", side: null, effect: "magic-room",
      turns: effects.magicRoomTurns });
    return;
  }
  if (move.functionCode === "124") {
    effects.wonderRoomTurns = effects.wonderRoomTurns > 0 ? 0 : 5;
    events.push({ type: "battleEffectChanged", side: null, effect: "wonder-room",
      turns: effects.wonderRoomTurns });
    return;
  }
  if (["154", "155", "156", "905"].includes(move.functionCode)) {
    const terrain = move.functionCode === "154" ? "electric" : move.functionCode === "155"
      ? "grassy" : move.functionCode === "156" ? "misty" : "psychic";
    if (effects.terrain === terrain && effects.terrainTurns > 0) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    effects.terrain = terrain;
    effects.terrainTurns = 5;
    events.push({ type: "battleEffectChanged", side: null, effect: "terrain", turns: 5 });
    return;
  }
  if (move.functionCode === "927") {
    if (weather !== "hail") {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    const own = effects.sides[source];
    effects.sides[source] = { ...own,
      reflectTurns: own.reflectTurns > 0 ? own.reflectTurns : 5,
      lightScreenTurns: own.lightScreenTurns > 0 ? own.lightScreenTurns : 5 };
    events.push({ type: "battleEffectChanged", side: source, effect: "reflect",
      turns: effects.sides[source].reflectTurns },
    { type: "battleEffectChanged", side: source, effect: "light-screen",
      turns: effects.sides[source].lightScreenTurns });
    return;
  }
  if (move.functionCode === "153") {
    const side = opponentOf(source);
    if (effects.sides[side].stickyWeb) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    effects.sides[side] = { ...effects.sides[side], stickyWeb: true };
    events.push({ type: "battleEffectChanged", side, effect: "sticky-web", turns: 1 });
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
  if (move.functionCode === "0AB" || move.functionCode === "0AC") {
    const key = move.functionCode === "0AB" ? "quickGuard" : "wideGuard";
    const attacker = battlers[source];
    const current = volatileOf(attacker);
    if (effects.sides[source][key]) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    effects.sides[source][key] = true;
    battlers[source] = withVolatile(attacker, { ...current, guarded: true,
      protectRate: Math.min(65_536, current.protectRate * 2) });
    events.push({ type: "volatileApplied", source, target: source,
      effect: key === "quickGuard" ? "quick-guard" : "wide-guard", turns: 1, move: move.internalName });
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
  if (move.functionCode === "0A8") {
    const defender = battlers[target];
    battlers[target] = withVolatile(defender, { ...volatileOf(defender), miracleEye: true });
    events.push({ type: "volatileApplied", source, target, effect: "miracle-eye", turns: null, move: move.internalName });
    return;
  }
  if (move.functionCode === "0A6") {
    const defender = battlers[target];
    battlers[target] = withVolatile(defender, { ...volatileOf(defender), lockOnBy: battlers[source].id,
      lockOnTurns: 2 });
    events.push({ type: "volatileApplied", source, target, effect: "lock-on", turns: 1, move: move.internalName });
    return;
  }
  if (move.functionCode === "0B7") {
    const defender = battlers[target];
    const current = volatileOf(defender);
    if (current.tormented) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    battlers[target] = withVolatile(defender, { ...current, tormented: true });
    events.push({ type: "volatileApplied", source, target, effect: "torment", turns: null, move: move.internalName });
    return;
  }
  if (move.functionCode === "0B8") {
    const user = battlers[source];
    const current = volatileOf(user);
    if (current.imprisoning) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    battlers[source] = withVolatile(user, { ...current, imprisoning: true });
    events.push({ type: "volatileApplied", source, target: source, effect: "imprison", turns: null, move: move.internalName });
    return;
  }
  if (move.functionCode === "0B1") {
    const user = battlers[source];
    battlers[source] = withVolatile(user, { ...volatileOf(user), magicCoat: true });
    events.push({ type: "volatileApplied", source, target: source, effect: "magic-coat", turns: 1,
      move: move.internalName });
    return;
  }
  if (move.functionCode === "0B2") {
    const user = battlers[source];
    battlers[source] = withVolatile(user, { ...volatileOf(user), snatching: true });
    events.push({ type: "volatileApplied", source, target: source, effect: "snatch", turns: 1,
      move: move.internalName });
    return;
  }
  if (move.functionCode === "0BB") {
    const defender = battlers[target];
    const current = volatileOf(defender);
    if (current.healBlockTurns > 0) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    battlers[target] = withVolatile(defender, { ...current, healBlockTurns: 5 });
    events.push({ type: "volatileApplied", source, target, effect: "heal-block", turns: 5,
      move: move.internalName });
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
  if (move.functionCode === "112") {
    const current = volatileOf(battlers[source]);
    if (current.stockpileCount >= 3) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    const defense = applyStatChange(source, source,
      { target: "self", stat: "defense", delta: 1 }, battlers, events, effects);
    const specialDefense = applyStatChange(source, source,
      { target: "self", stat: "specialDefense", delta: 1 }, battlers, events, effects);
    const next = volatileOf(battlers[source]);
    battlers[source] = withVolatile(battlers[source], { ...next,
      stockpileCount: current.stockpileCount + 1,
      stockpileDefense: current.stockpileDefense + (defense ? 1 : 0),
      stockpileSpecialDefense: current.stockpileSpecialDefense + (specialDefense ? 1 : 0) });
    events.push({ type: "volatileApplied", source, target: source, effect: "stockpile",
      turns: current.stockpileCount + 1, move: move.internalName });
    return;
  }
  if (move.functionCode === "114") {
    const user = battlers[source];
    const stored = volatileOf(user);
    if (stored.stockpileCount === 0 || user.hp === user.stats.maxHp
      && stored.stockpileDefense === 0 && stored.stockpileSpecialDefense === 0) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    const raw = stored.stockpileCount === 1 ? Math.floor(user.stats.maxHp / 4)
      : stored.stockpileCount === 2 ? Math.floor(user.stats.maxHp / 2) : user.stats.maxHp;
    const amount = Math.min(user.stats.maxHp - user.hp, raw);
    if (amount > 0) {
      battlers[source] = { ...user, hp: user.hp + amount };
      events.push({ type: "hpRestored", side: source, source: "move", move: move.internalName,
        amount, hp: user.hp + amount });
    }
    releaseStockpile(source, battlers, events, effects);
    return;
  }
  if (move.functionCode === "019") {
    const user = battlers[source];
    if (user.majorStatus !== null) {
      battlers[source] = { ...user, majorStatus: null };
      events.push({ type: "statusCured", side: source, status: user.majorStatus.kind });
    }
    events.push({ type: "partyStatusCureRequested", side: source, move: move.internalName });
    return;
  }
  if (move.functionCode === "018") {
    const user = battlers[source];
    const kind = user.majorStatus?.kind;
    if (kind !== "burn" && kind !== "poison" && kind !== "paralysis") {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    battlers[source] = { ...user, majorStatus: null };
    events.push({ type: "statusCured", side: source, status: kind });
    return;
  }
  if (move.functionCode === "01A") {
    const current = effects.sides[source];
    if (current.safeguardTurns > 0) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    effects.sides[source] = { ...current, safeguardTurns: 5 };
    events.push({ type: "battleEffectChanged", side: source, effect: "safeguard", turns: 5 });
    return;
  }
  if (move.functionCode === "01B") {
    const user = battlers[source];
    const status = user.majorStatus;
    const code = status?.kind === "sleep" ? "003" : status?.kind === "poison" ? "005"
      : status?.kind === "burn" ? "00A" : status?.kind === "paralysis" ? "007"
        : status?.kind === "frozen" ? "00C" : null;
    if (code === null || battlers[target].majorStatus !== null) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    applyStatusMove(source, target, { ...move, functionCode: code }, battlers,
      rng, events, trace, effects, weather);
    if (battlers[target].majorStatus === null) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    if (status?.kind === "poison" && status.toxicCounter !== null) battlers[target] = {
      ...battlers[target], majorStatus: { kind: "poison", toxicCounter: 0 },
    };
    battlers[source] = { ...user, majorStatus: null };
    events.push({ type: "statusCured", side: source, status: status!.kind });
    return;
  }
  if (["0FF", "100", "101", "102"].includes(move.functionCode)) {
    const weather = move.functionCode === "0FF" ? "sun" : move.functionCode === "100" ? "rain"
      : move.functionCode === "101" ? "sand" : "hail";
    if (effects.weather === weather || ["heavy-rain", "harsh-sun", "strong-winds"].includes(effects.weather ?? "")) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    const rock = weather === "sun" ? "HEATROCK" : weather === "rain" ? "DAMPROCK"
      : weather === "sand" ? "SMOOTHROCK" : "ICYROCK";
    const turns = heldItemIsActive(battlers[source], effects.magicRoomTurns)
      && battlers[source].heldItem === rock ? 8 : 5;
    effects.weather = weather;
    effects.weatherTurns = turns;
    events.push({ type: "battleEffectChanged", side: null, effect: "weather", turns });
    return;
  }
  if (["103", "104", "105"].includes(move.functionCode)) {
    const side = opponentOf(source);
    const current = effects.sides[side];
    const effect = move.functionCode === "103" ? "spikes"
      : move.functionCode === "104" ? "toxic-spikes" : "stealth-rock";
    const existing = effect === "spikes" ? current.spikesLayers ?? 0
      : effect === "toxic-spikes" ? current.toxicSpikesLayers ?? 0 : Number(current.stealthRock ?? false);
    const maximum = effect === "spikes" ? 3 : effect === "toxic-spikes" ? 2 : 1;
    if (existing >= maximum) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    effects.sides[side] = { ...current, ...(effect === "spikes" ? { spikesLayers: existing + 1 }
      : effect === "toxic-spikes" ? { toxicSpikesLayers: existing + 1 } : { stealthRock: true }) };
    events.push({ type: "battleEffectChanged", side, effect, turns: existing + 1 });
    return;
  }
  if (move.functionCode === "11F") {
    effects.trickRoomTurns = effects.trickRoomTurns > 0 ? 0 : 5;
    events.push({ type: "battleEffectChanged", side: null, effect: "trick-room",
      turns: effects.trickRoomTurns });
    return;
  }
  if (move.functionCode === "118") {
    if (effects.gravityTurns > 0) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    effects.gravityTurns = 5;
    events.push({ type: "battleEffectChanged", side: null, effect: "gravity", turns: 5 });
    const seen = new Set<string>();
    for (const side of SIDES) {
      if (seen.has(battlers[side].id)) continue;
      seen.add(battlers[side].id);
      const grounded = clearAirborneEffects(battlers[side], side);
      battlers[side] = grounded.battler;
      events.push(...grounded.events);
    }
    return;
  }
  if (move.functionCode === "119") {
    const user = battlers[source];
    const current = volatileOf(user);
    if (effects.gravityTurns > 0 || current.ingrain || current.smackDown || current.magnetRiseTurns > 0) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    battlers[source] = withVolatile(user, { ...current, magnetRiseTurns: 5 });
    events.push({ type: "volatileApplied", source, target: source, effect: "magnet-rise",
      turns: 5, move: move.internalName });
    return;
  }
  if (move.functionCode === "11A") {
    const victim = battlers[target];
    const current = volatileOf(victim);
    if (effects.gravityTurns > 0 || current.ingrain || current.smackDown || current.telekinesisTurns > 0) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    battlers[target] = withVolatile(victim, { ...current, telekinesisTurns: 3 });
    events.push({ type: "volatileApplied", source, target, effect: "telekinesis",
      turns: 3, move: move.internalName });
    return;
  }
  if (move.functionCode === "140" && move.category === "Status") {
    const poisoned = battlers[target].majorStatus?.kind === "poison";
    if (!poisoned) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    let changed = false;
    for (const stat of ["attack", "specialAttack", "speed"] as const) {
      changed = applyStatChange(source, target,
        { target: "opponent", stat, delta: -1 }, battlers, events, effects) || changed;
    }
    if (!changed) events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
    return;
  }
  if (move.functionCode === "0D7") {
    const user = battlers[source];
    const current = volatileOf(user);
    if (current.wishTurns > 0) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    battlers[source] = withVolatile(user, { ...current, wishTurns: 2,
      wishAmount: Math.floor((user.stats.maxHp + 1) / 2), wishMaker: user.id });
    events.push({ type: "volatileApplied", source, target: source, effect: "wish", turns: 2,
      move: move.internalName });
    return;
  }
  if (move.functionCode === "0DA" || move.functionCode === "0DB") {
    const user = battlers[source];
    const current = volatileOf(user);
    const ingrain = move.functionCode === "0DB";
    if (ingrain ? current.ingrain : current.aquaRing) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    battlers[source] = withVolatile(user, { ...current,
      [ingrain ? "ingrain" : "aquaRing"]: true });
    events.push({ type: "volatileApplied", source, target: source,
      effect: ingrain ? "ingrain" : "aqua-ring", turns: null, move: move.internalName });
    return;
  }
  if (move.functionCode === "0D9") {
    const user = battlers[source];
    const protection = statusProtectionAbility(user, "sleep");
    if (user.hp === user.stats.maxHp || user.majorStatus?.kind === "sleep" || protection !== null
      || effects.terrain === "electric" && isGrounded(user, effects)) {
      if (protection !== null) events.push({ type: "abilityActivated", side: source,
        ability: protection, effect: "prevent-status" });
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    battlers[source] = { ...user, hp: user.stats.maxHp,
      majorStatus: { kind: "sleep", turnsRemaining: sleepDurationForAbility(user, 3) } };
    events.push({ type: "statusApplied", source, target: source, status: "sleep" },
      { type: "hpRestored", side: source, source: "move", move: move.internalName,
        amount: user.stats.maxHp - user.hp, hp: user.stats.maxHp });
    return;
  }
  if (move.functionCode === "0DF") {
    const receiver = battlers[target];
    if (receiver.hp === receiver.stats.maxHp) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    const raw = battlers[source].ability === "MEGALAUNCHER"
      ? Math.round(receiver.stats.maxHp * 3 / 4) : Math.floor((receiver.stats.maxHp + 1) / 2);
    const amount = Math.min(receiver.stats.maxHp - receiver.hp, raw);
    battlers[target] = { ...receiver, hp: receiver.hp + amount };
    events.push({ type: "hpRestored", side: target, source: "move", move: move.internalName,
      amount, hp: receiver.hp + amount });
    return;
  }
  if (move.functionCode === "0D6") {
    const user = battlers[source];
    if (user.hp === user.stats.maxHp) {
      events.push({ type: "moveFailed", side: source, move: move.internalName, reason: "condition" });
      return;
    }
    const amount = Math.min(user.stats.maxHp - user.hp, Math.floor((user.stats.maxHp + 1) / 2));
    const current = volatileOf(user);
    const types = user.types.includes("FLYING")
      ? user.types.filter((type) => type !== "FLYING") : user.types;
    battlers[source] = withVolatile({ ...user, hp: user.hp + amount,
      types: types.length === 0 ? ["NORMAL"] : types }, { ...current,
      originalTypes: current.originalTypes ?? user.types,
      roostOriginalTypes: user.types });
    events.push({ type: "hpRestored", side: source, source: "move", move: move.internalName,
      amount, hp: user.hp + amount },
      { type: "volatileApplied", source, target: source, effect: "roost", turns: 1,
        move: move.internalName });
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
  rng: RandomSource, events: BattleEvent[], trace: BattleTrace[], effects: BattleEffects): boolean {
  const battler = battlers[target];
  if (battler.hp <= 0 || battler.majorStatus !== null || typePreventsStatus(battler, status)
    || effects.terrain === "misty" && isGrounded(battler, effects)
    || status === "sleep" && effects.terrain === "electric" && isGrounded(battler, effects)) return false;
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
  if (blockedByType || effects.terrain === "misty" && isGrounded(defender, effects)
    || ordinaryWeather(weather) === "sun" && defender.ability === "LEAFGUARD"
    || kind === "sleep" && (SIDES.some((side) => volatileOf(battlers[side]).uproarTurns > 0)
      || effects.terrain === "electric" && isGrounded(defender, effects))) {
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
    && !typePreventsStatus(attacker, kind) && statusProtectionAbility(attacker, kind) === null
    && !(effects.terrain === "misty" && isGrounded(attacker, effects))) {
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
  sleepTalk = false,
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
    if (sleepTalk) return true;
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
  effects?: BattleEffects): {
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
  if (volatile.magnetRiseTurns > 0) {
    const turns = volatile.magnetRiseTurns - 1;
    volatile = { ...volatile, magnetRiseTurns: turns };
    if (turns === 0) events.push({ type: "volatileEnded", side, effect: "magnet-rise" });
  }
  if (volatile.telekinesisTurns > 0) {
    const turns = volatile.telekinesisTurns - 1;
    volatile = { ...volatile, telekinesisTurns: turns };
    if (turns === 0) events.push({ type: "volatileEnded", side, effect: "telekinesis" });
  }
  if (volatile.yawnTurns > 0) {
    const yawnTurns = volatile.yawnTurns - 1;
    const yawnBypassesAbility = volatile.yawnBypassesAbility;
    volatile = { ...volatile, yawnTurns, yawnBypassesAbility: yawnTurns === 0 ? false : yawnBypassesAbility };
    if (yawnTurns === 0 && next.majorStatus === null
      && !((effects?.terrain === "electric" || effects?.terrain === "misty") && isGrounded(next, effects))) {
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
  for (const [active, move] of [[volatile.aquaRing, "AQUARING"], [volatile.ingrain, "INGRAIN"]] as const) {
    if (volatile.healBlockTurns > 0) continue;
    if (!active || next.hp <= 0) continue;
    const amount = Math.min(next.stats.maxHp - next.hp, Math.max(1, Math.floor(next.stats.maxHp / 16)));
    if (amount <= 0) continue;
    next = { ...next, hp: next.hp + amount };
    events.push({ type: "hpRestored", side, source: "move", move, amount, hp: next.hp });
  }
  if (volatile.wishTurns > 0) {
    const turns = volatile.wishTurns - 1;
    volatile = { ...volatile, wishTurns: turns };
    if (turns === 0 && next.hp > 0) {
      const amount = Math.min(next.stats.maxHp - next.hp, volatile.wishAmount);
      if (amount > 0 && volatile.healBlockTurns === 0) {
        next = { ...next, hp: next.hp + amount };
        events.push({ type: "hpRestored", side, source: "move", move: "WISH", amount, hp: next.hp });
      }
      volatile = { ...volatile, wishAmount: 0, wishMaker: null };
    }
  }
  if (volatile.roostOriginalTypes !== null) {
    next = { ...next, types: volatile.roostOriginalTypes };
    volatile = { ...volatile, roostOriginalTypes: null };
  }
  if (volatile.chargeTurns > 0) volatile = { ...volatile, chargeTurns: volatile.chargeTurns - 1 };
  if (volatile.uproarTurns > 0) volatile = { ...volatile, uproarTurns: volatile.uproarTurns - 1 };
  if (volatile.embargoTurns > 0) volatile = { ...volatile, embargoTurns: volatile.embargoTurns - 1 };
  if (volatile.healBlockTurns > 0) {
    const healBlockTurns = volatile.healBlockTurns - 1;
    volatile = { ...volatile, healBlockTurns };
    if (healBlockTurns === 0) events.push({ type: "volatileEnded", side, effect: "heal-block" });
  }
  if (volatile.perishTurns > 0 && next.hp > 0) {
    const turns = volatile.perishTurns - 1;
    volatile = { ...volatile, perishTurns: turns };
    if (turns === 0) {
      next = { ...next, hp: 0 };
      events.push({ type: "volatileEnded", side, effect: "perish-song" });
    }
  }
  if (next.ability === "TRUANT" && !volatile.enteredMidTurn) {
    volatile = { ...volatile, truantLoafing: !volatile.truantLoafing };
  }
  volatile = { ...volatile, flinched: false,
    lockOnTurns: Math.max(0, volatile.lockOnTurns - 1),
    lockOnBy: volatile.lockOnTurns <= 1 ? null : volatile.lockOnBy,
    protectRate: volatile.protected || volatile.endured || volatile.guarded ? volatile.protectRate : 1,
    protected: false, endured: false, guarded: false, magicCoat: false, snatching: false,
    activeTurns: Math.min(999, volatile.activeTurns + 1) };
  return { battler: withVolatile(next, volatile), events };
}

function applyResidualVolatile(battlers: Record<BattleSide, BattlerState>, events: BattleEvent[],
  effects: BattleEffects): BattleSide | null {
  for (const side of SIDES) {
    const seededBy = volatileOf(battlers[side]).leechSeededBy;
    const result = resolveBattleVolatileEndOfTurn(battlers[side], side, effects);
    battlers[side] = result.battler;
    events.push(...result.events);
    const drained = result.events.find((event): event is Extract<BattleEvent, { type: "leechSeedDamage" }> =>
      event.type === "leechSeedDamage");
    if (drained !== undefined && seededBy !== null && battlers[seededBy].hp > 0
      && (battlers[seededBy].volatile?.healBlockTurns ?? 0) === 0) {
      const receiver = battlers[seededBy];
      const amount = Math.min(drained.amount, receiver.stats.maxHp - receiver.hp);
      if (amount > 0) {
        battlers[seededBy] = { ...receiver, hp: receiver.hp + amount };
        events.push({ type: "hpRestored", side: seededBy, source: "move", move: "LEECHSEED",
          amount, hp: receiver.hp + amount });
      }
    }
    if (result.battler.hp === 0) {
      events.push({ type: "fainted", side });
    }
  }
  const fainted = SIDES.filter((side) => battlers[side].hp === 0);
  if (fainted.length > 0) {
    const winner = fainted.length === SIDES.length ? null : opponentOf(fainted[0]!);
    events.push({ type: "battleEnded", winner });
    return winner;
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

/** The room-owned battle state is the sole authority for berry consumption in solo and Coop. */
export function resolveBattleBerryCheck(battler: BattlerState, side: BattleSide,
  rng: RandomSource, trace: BattleTrace[], berriesBlocked = false, nextPickupUse = 0, magicRoomTurns = 0,
  hpCure = false, forced = false): {
    readonly battler: BattlerState; readonly events: readonly BattleEvent[]; readonly nextPickupUse: number;
  } {
  const events: BattleEvent[] = [];
  let next = battler;
  if (next.hp > 0 && heldItemIsActive(next, magicRoomTurns)) {
    if ((hpCure || forced) && !berriesBlocked && (next.heldItem === "ORANBERRY" || next.heldItem === "SITRUSBERRY"
      || forced && next.heldItem === "ENIGMABERRY")
      && (forced || next.hp <= Math.floor(next.stats.maxHp / 2))) {
      const berry = next.heldItem;
      const amount = Math.min(berry === "ORANBERRY" ? 10 : Math.floor(next.stats.maxHp / 4),
        next.stats.maxHp - next.hp);
      if (amount > 0) {
        nextPickupUse += 1;
        next = consumeHeldItem({ ...next, hp: next.hp + amount }, berry, nextPickupUse);
        events.push({ type: "itemActivated", side, item: berry, effect: "heal", amount, hp: next.hp });
        events.push({ type: "heldItemConsumed", side, item: berry, effect: "heal", hp: next.hp });
        next = applyCheekPouch(next, side, events);
      }
    }
    const flavorBerries = { FIGYBERRY: "spicy", WIKIBERRY: "dry", MAGOBERRY: "sweet",
      AGUAVBERRY: "bitter", IAPAPABERRY: "sour" } as const;
    if ((hpCure || forced) && !berriesBlocked && next.heldItem !== null && next.heldItem in flavorBerries
      && (forced || next.hp <= Math.floor(next.stats.maxHp / 2))) {
      const berry = next.heldItem as keyof typeof flavorBerries;
      const amount = Math.min(Math.floor(next.stats.maxHp / 8), next.stats.maxHp - next.hp);
      if (amount > 0) {
        nextPickupUse += 1;
        next = consumeHeldItem({ ...next, hp: next.hp + amount }, berry, nextPickupUse);
        events.push({ type: "itemActivated", side, item: berry, effect: "heal", amount, hp: next.hp },
          { type: "heldItemConsumed", side, item: berry, effect: "heal", hp: next.hp });
        if (next.berryFlavorDislike === flavorBerries[berry] && next.ability !== "OWNTEMPO"
          && (next.volatile?.confusionTurns ?? 0) === 0) {
          const turns = 2 + draw(rng, trace, "confusion-duration", 4);
          next = withVolatile(next, { ...volatileOf(next), confusionTurns: turns });
          events.push({ type: "volatileApplied", source: side, target: side, effect: "confusion",
            turns, move: berry });
        }
        next = applyCheekPouch(next, side, events);
      }
    }
    const liechiThreshold = next.ability === "GLUTTONY" ? Math.floor(next.stats.maxHp / 2)
      : Math.floor(next.stats.maxHp / 4);
    const pinchStats = {
      LIECHIBERRY: "attack", GANLONBERRY: "defense", SALACBERRY: "speed",
      PETAYABERRY: "specialAttack", APICOTBERRY: "specialDefense",
      ...(forced ? { KEEBERRY: "defense" as const, MARANGABERRY: "specialDefense" as const } : {}),
    } as const;
    if (!berriesBlocked && next.heldItem !== null && next.heldItem in pinchStats
      && (forced || next.hp <= liechiThreshold)) {
      const berry = next.heldItem as keyof typeof pinchStats;
      const stat = pinchStats[berry]!;
      const resolved = resolveStatStageChange(next, stat, 1);
      if (resolved !== null) {
        nextPickupUse += 1;
        next = consumeHeldItem(resolved.battler, berry, nextPickupUse);
        events.push({ type: "itemActivated", side, item: berry, effect: "boost", amount: 0, hp: next.hp });
        events.push({ type: "heldItemConsumed", side, item: berry, effect: "boost", hp: next.hp });
        events.push({ type: "statStageChanged", source: side, target: side, stat,
          delta: resolved.delta, stage: resolved.stage });
        next = applyCheekPouch(next, side, events);
      }
    }
    if (!berriesBlocked && (forced || next.hp <= liechiThreshold) && next.heldItem === "LANSATBERRY"
      && volatileOf(next).focusEnergy < 2) {
      nextPickupUse += 1;
      next = consumeHeldItem(withVolatile(next, { ...volatileOf(next), focusEnergy: 2 }),
        "LANSATBERRY", nextPickupUse);
      events.push({ type: "itemActivated", side, item: "LANSATBERRY", effect: "boost", amount: 0, hp: next.hp },
        { type: "heldItemConsumed", side, item: "LANSATBERRY", effect: "boost", hp: next.hp },
        { type: "volatileApplied", source: side, target: side, effect: "focus-energy", turns: null,
          move: "LANSATBERRY" });
      next = applyCheekPouch(next, side, events);
    }
    if (!berriesBlocked && (forced || next.hp <= liechiThreshold) && next.heldItem === "MICLEBERRY"
      && volatileOf(next).micleBerry !== true) {
      nextPickupUse += 1;
      next = consumeHeldItem(withVolatile(next, { ...volatileOf(next), micleBerry: true }),
        "MICLEBERRY", nextPickupUse);
      events.push({ type: "itemActivated", side, item: "MICLEBERRY", effect: "boost", amount: 0, hp: next.hp },
        { type: "heldItemConsumed", side, item: "MICLEBERRY", effect: "boost", hp: next.hp });
      next = applyCheekPouch(next, side, events);
    }
    if (!berriesBlocked && (forced || next.hp <= liechiThreshold) && next.heldItem === "STARFBERRY") {
      const stats = ["attack", "defense", "specialAttack", "specialDefense", "speed"] as const;
      const eligible = stats.filter((stat) => next.stages[stat] < 6);
      if (eligible.length > 0) {
        const stat = eligible[draw(rng, trace, "additional-effect", eligible.length)]!;
        const resolved = resolveStatStageChange(next, stat, 2)!;
        nextPickupUse += 1;
        next = consumeHeldItem(resolved.battler, "STARFBERRY", nextPickupUse);
        events.push({ type: "itemActivated", side, item: "STARFBERRY", effect: "boost", amount: 0, hp: next.hp },
          { type: "heldItemConsumed", side, item: "STARFBERRY", effect: "boost", hp: next.hp },
          { type: "statStageChanged", source: side, target: side, stat,
            delta: resolved.delta, stage: resolved.stage });
        next = applyCheekPouch(next, side, events);
      }
    }
    if (!berriesBlocked && next.heldItem === "LEPPABERRY") {
      const eligible = next.moves.flatMap((slot, index) =>
        (forced ? slot.pp < slot.move.pp : slot.pp === 0) && slot.move.internalName !== "" ? [index] : []);
      const index = eligible.length === 0 ? -1
        : forced ? eligible[draw(rng, trace, "additional-effect", eligible.length)]! : eligible[0]!;
      if (index >= 0) {
        const slot = next.moves[index]!;
        const pp = Math.min(slot.move.pp, slot.pp + 10);
        if (pp > slot.pp) {
          nextPickupUse += 1;
          next = consumeHeldItem({ ...next, moves: next.moves.map((candidate, candidateIndex) =>
            candidateIndex === index ? { ...candidate, pp } : candidate) }, "LEPPABERRY", nextPickupUse);
          events.push({ type: "itemActivated", side, item: "LEPPABERRY", effect: "boost", amount: pp - slot.pp, hp: next.hp },
            { type: "ppChanged", side, move: slot.move.internalName, pp },
            { type: "heldItemConsumed", side, item: "LEPPABERRY", effect: "eaten", hp: next.hp });
          next = applyCheekPouch(next, side, events);
        }
      }
    }
    const status = next.majorStatus?.kind;
    const statusBerries: Partial<Record<NonNullable<typeof status>, string>> = {
      sleep: "CHESTOBERRY", poison: "PECHABERRY", burn: "RAWSTBERRY",
      paralysis: "CHERIBERRY", frozen: "ASPEARBERRY",
    };
    const curesStatus = status !== undefined && (next.heldItem === statusBerries[status]
      || next.heldItem === "LUMBERRY");
    const curesConfusion = (next.volatile?.confusionTurns ?? 0) > 0
      && (next.heldItem === "PERSIMBERRY" || next.heldItem === "LUMBERRY");
    if (!berriesBlocked && (curesStatus || curesConfusion) && next.heldItem !== null) {
      const berry = next.heldItem;
      nextPickupUse += 1;
      next = consumeHeldItem({ ...next,
        ...(curesStatus ? { majorStatus: null } : {}),
        ...(curesConfusion ? { volatile: { ...volatileOf(next), confusionTurns: 0 } } : {}),
      }, berry, nextPickupUse);
      events.push({ type: "itemActivated", side, item: berry, effect: "boost", amount: 0, hp: next.hp });
      if (curesStatus && status !== undefined) events.push({ type: "statusCured", side, status });
      if (curesConfusion) events.push({ type: "volatileEnded", side, effect: "confusion" });
      events.push({ type: "heldItemConsumed", side, item: berry, effect: "eaten", hp: next.hp });
      next = applyCheekPouch(next, side, events);
    }
  }
  return { battler: next, events, nextPickupUse };
}

/** Activate a stolen/thrown berry without replacing or consuming the eater's own held item. */
function activateExternalBerry(battler: BattlerState, side: BattleSide, berry: NonNullable<BattlerState["heldItem"]>,
  rng: RandomSource, trace: BattleTrace[], nextPickupUse: number): {
    readonly battler: BattlerState; readonly events: readonly BattleEvent[]; readonly nextPickupUse: number;
  } {
  if (battler.hp <= 0) {
    return { battler, events: [], nextPickupUse };
  }
  const activated = resolveBattleBerryCheck({ ...battler, heldItem: berry,
    ability: battler.ability === "KLUTZ" ? null : battler.ability,
    volatile: { ...volatileOf(battler), embargoTurns: 0 } }, side, rng, trace,
    false, nextPickupUse, 0, true, true);
  const { recyclableItem: _temporaryRecycle, ...withoutTemporaryRecycle } = activated.battler;
  return { battler: { ...withoutTemporaryRecycle, heldItem: battler.heldItem, ability: battler.ability,
    ...(battler.recyclableItem === undefined ? {} : { recyclableItem: battler.recyclableItem }),
    volatile: { ...activated.battler.volatile!, embargoTurns: battler.volatile?.embargoTurns ?? 0,
      unburdened: battler.volatile?.unburdened ?? false,
      pickupItem: battler.volatile?.pickupItem ?? null, pickupUse: battler.volatile?.pickupUse ?? 0 } },
  events: activated.events.filter((event) => event.type !== "heldItemConsumed"),
  nextPickupUse };
}

export function resolveBattlePassiveEndOfTurn(battler: BattlerState, side: BattleSide,
  rng: RandomSource, trace: BattleTrace[], berriesBlocked = false, nextPickupUse = 0,
  magicRoomTurns = 0): {
  readonly battler: BattlerState; readonly events: readonly BattleEvent[]; readonly nextPickupUse: number;
} {
  const berry = resolveBattleBerryCheck(battler, side, rng, trace, berriesBlocked, nextPickupUse, magicRoomTurns, true);
  const events: BattleEvent[] = [...berry.events];
  let next = berry.battler;
  nextPickupUse = berry.nextPickupUse;
  if (next.hp > 0 && heldItemIsActive(next, magicRoomTurns)) {
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
    const weatherResult = resolveWeatherEndOfTurn(battlers[side], side, weather, effects.magicRoomTurns);
    battlers[side] = weatherResult.battler;
    events.push(...weatherResult.events);
    if (weatherResult.battler.hp === 0) {
      const winner = opponentOf(side);
      events.push({ type: "fainted", side }, { type: "battleEnded", winner });
      return winner;
    }
    const result = resolveBattlePassiveEndOfTurn(battlers[side], side, rng, trace,
      berriesBlockedBy([battlers[opponentOf(side)]]), effects.nextPickupUse, effects.magicRoomTurns);
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
        berriesBlockedBy([battlers[opponentOf(side)]]), effects.nextPickupUse, effects.magicRoomTurns);
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
    effects.sides[side] = { ...current, reflectTurns, lightScreenTurns, luckyChantTurns, mistTurns, safeguardTurns, tailwindTurns,
      quickGuard: false, wideGuard: false };
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
  if (effects.magicRoomTurns > 0) {
    effects.magicRoomTurns -= 1;
    if (effects.magicRoomTurns === 0) {
      events.push({ type: "battleEffectChanged", side: null, effect: "magic-room", turns: 0 });
    }
  }
  if (effects.wonderRoomTurns > 0) {
    effects.wonderRoomTurns -= 1;
    if (effects.wonderRoomTurns === 0) events.push({ type: "battleEffectChanged",
      side: null, effect: "wonder-room", turns: 0 });
  }
  if (effects.gravityTurns > 0) {
    effects.gravityTurns -= 1;
    if (effects.gravityTurns === 0) events.push({ type: "battleEffectChanged", side: null, effect: "gravity", turns: 0 });
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
  weather: BattleEffects["weather"] = state.effects?.weather,
  custap: Readonly<Partial<Record<BattleSide, boolean>>> = {}): BattleSide[] {
  const decorated = SIDES.filter((side) => actions[side] !== undefined).map((side) => {
    const battler = state.battlers[side];
    const action = actions[side];
    if (action === undefined) throw new Error(`Missing selected action for ${side}.`);
    const slot = battler.moves[action.moveIndex];
    if (slot === undefined) throw new RangeError(`Invalid move index for ${side}.`);
    const speed = effectiveSpeed(battler, (state.effects?.sides[side].tailwindTurns ?? 0) > 0, state.effects?.terrain)
      * weatherSpeedMultiplier(battler, weather);
    const priority = effectiveMovePriority(battler, slot.move, state.effects?.terrain);
    trace.push({ type: "order", side, priority, speed });
    return { side, priority, speed, lagging: battler.ability === "STALL", custap: custap[side] === true };
  });
  if (decorated.length === 0) return [];
  const only = decorated[0];
  if (decorated.length === 1 && only !== undefined) return [only.side];
  const [player, opponent] = decorated;
  if (player === undefined || opponent === undefined) throw new Error("Battle requires two sides.");
  if (player.priority !== opponent.priority) return player.priority > opponent.priority ? [player.side, opponent.side] : [opponent.side, player.side];
  if (player.custap !== opponent.custap) return player.custap ? [player.side, opponent.side] : [opponent.side, player.side];
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
  context: { readonly attackerPartnerAbility?: BattlerState["ability"]; readonly hostile?: boolean;
    readonly magicRoomTurns?: number; readonly gravityTurns?: number } = {}): boolean {
  if (move.functionCode === "070") {
    const threshold = defender.level > attacker.level ? 0 : move.accuracy + attacker.level - defender.level;
    const hit = threshold > 0 && draw(rng, trace, "accuracy", 100) < threshold;
    trace.push({ type: "accuracy", side, base: move.accuracy, accuracyStage: 0,
      evasionStage: 0, threshold, hit });
    return hit;
  }
  const accuracy = move.functionCode === "002" ? 100
    : move.functionCode === "015" && (weather === "sun" || weather === "harsh-sun") ? 50
      : move.accuracy;
  const drawnIn = defender.ability === "STORMDRAIN" && move.type === "WATER"
    || defender.ability === "LIGHTNINGROD" && move.type === "ELECTRIC";
  if (defender.volatile?.lockOnTurns && defender.volatile.lockOnBy === attacker.id) {
    trace.push({ type: "accuracy", side, base: accuracy, accuracyStage: attacker.stages.accuracy,
      evasionStage: defender.stages.evasion, threshold: Number.POSITIVE_INFINITY, hit: true });
    return true;
  }
  if ((defender.volatile?.telekinesisTurns ?? 0) > 0) {
    trace.push({ type: "accuracy", side, base: accuracy, accuracyStage: attacker.stages.accuracy,
      evasionStage: defender.stages.evasion, threshold: Number.POSITIVE_INFINITY, hit: true });
    return true;
  }
  if (accuracy === 0 || drawnIn || move.functionCode === "13C"
    || move.functionCode === "00D" && weather === "hail"
    || move.functionCode === "015" && (weather === "rain" || weather === "heavy-rain")
    || move.functionCode === "144" && defender.volatile?.minimized === true) {
    trace.push({ type: "accuracy", side, base: 0, accuracyStage: attacker.stages.accuracy, evasionStage: defender.stages.evasion, threshold: Number.POSITIVE_INFINITY, hit: true });
    return true;
  }
  if (attacker.ability === "NOGUARD" || defender.ability === "NOGUARD") {
    trace.push({ type: "accuracy", side, base: accuracy, accuracyStage: attacker.stages.accuracy,
      evasionStage: defender.stages.evasion, threshold: Number.POSITIVE_INFINITY, hit: true });
    return true;
  }
  const itemModifier = (heldItemIsActive(attacker, context.magicRoomTurns) && attacker.heldItem === "WIDELENS" ? 1.1 : 1)
    * (attacker.volatile?.micleBerry === true ? 1.2 : 1);
  const abilityModifier = (attacker.ability === "COMPOUNDEYES" ? 1.3 : 1)
    * (attacker.ability === "HUSTLE" && move.category === "Physical" ? 0.8 : 1)
    * (attacker.ability === "VICTORYSTAR" ? 1.1 : 1)
    * (context.attackerPartnerAbility === "VICTORYSTAR" ? 1.1 : 1);
  const evasionStage = move.functionCode === "0A9" || defender.volatile?.identified === true
    || defender.volatile?.miracleEye === true
    || (attacker.ability === "KEENEYE" && defender.stages.evasion > 0) ? 0 : defender.stages.evasion;
  const tangledFeetModifier = !hasMoldBreaker(attacker) && defender.ability === "TANGLEDFEET"
    && (defender.volatile?.confusionTurns ?? 0) > 0 ? 1.2 : 1;
  const illusoryFormModifier = !hasMoldBreaker(attacker) && defender.ability === "FORMAILUSORIA"
    && defender.hp > defender.stats.maxHp / 1.3333333 ? 1.7 : 1;
  const rawAccuracyModifier = itemModifier * abilityModifier * accuracyFactor(attacker.stages.accuracy);
  const accuracyModifier = !hasMoldBreaker(attacker) && defender.ability === "WONDERSKIN"
    && move.category === "Status" && context.hostile === true
    ? Math.min(0.5, rawAccuracyModifier) : rawAccuracyModifier;
  const threshold = accuracy * accuracyModifier * ((context.gravityTurns ?? 0) > 0 ? 5 / 3 : 1)
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

function micleAccuracyWasChecked(attacker: BattlerState, defender: BattlerState, move: BattleMove): boolean {
  return move.functionCode !== "070" && move.accuracy !== 0
    && attacker.ability !== "NOGUARD" && defender.ability !== "NOGUARD"
    && !(defender.ability === "STORMDRAIN" && move.type === "WATER")
    && !(defender.ability === "LIGHTNINGROD" && move.type === "ELECTRIC");
}

function missesSemiInvulnerable(attacker: BattlerState, defender: BattlerState, move: BattleMove): boolean {
  if (attacker.ability === "NOGUARD" || defender.ability === "NOGUARD") return false;
  if ((defender.volatile?.telekinesisTurns ?? 0) > 0) return false;
  if ((defender.volatile?.lockOnTurns ?? 0) > 0 && defender.volatile?.lockOnBy === attacker.id) return false;
  const code = move.functionCode;
  const airborneHits = ["008", "015", "077", "078", "11B", "11C"].includes(code);
  const charge = defender.volatile?.chargingMove;
  const chargedCode = defender.volatile?.chargingCalledMove?.functionCode
    ?? defender.moves.find((slot) => slot.move.internalName === charge)?.move.functionCode;
  if (defender.volatile?.skyDropCarrierId != null
    && !airborneHits && code !== "0CE") return true;
  if (chargedCode === "0C9" || chargedCode === "0CC") {
    return !airborneHits && move.internalName !== "WHIRLWIND";
  }
  if (chargedCode === "0CA") return !["076", "095"].includes(code);
  if (chargedCode === "0CB") return !["075", "0D0"].includes(code);
  return chargedCode === "0CD" || chargedCode === "0CE" && !airborneHits;
}

/** Pokemon Z deliberately requires the Shield Dust + Covert Cloak combination. */
function blocksAdditionalEffects(attacker: BattlerState, defender: BattlerState, magicRoomTurns = 0): boolean {
  return !hasMoldBreaker(attacker) && defender.ability === "SHIELDDUST"
    && heldItemIsActive(defender, magicRoomTurns) && defender.heldItem === "COVERTCLOAK";
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
    /** True when any conscious opposing slot has Unnerve. */
    readonly attackerBerriesBlocked?: boolean;
    /** Active partner context supplied by the positioned double-battle adapter. */
    readonly attackerPartnerAbility?: BattlerState["ability"];
    readonly defenderPartnerAbility?: BattlerState["ability"];
    /** All active, conscious abilities supplied by the team/double adapter for global effects. */
    readonly activeAbilities?: readonly NonNullable<BattlerState["ability"]>[];
    /** Positioned double adapter supplies both speeds because mini duels do not contain all field context. */
    readonly effectiveSpeeds?: Readonly<Partial<Record<BattleSide, number>>>;
    readonly targetIsAlly?: boolean;
    readonly targetPresentationSide?: BattleSide;
    /** Authoritative total cost for double-battle multi-target Pressure. */
    readonly ppCost?: number;
    /** Double battles derive global Damp from all four active slots. */
    readonly dampSide?: BattleSide | null;
    /** Double battles activate Tailwind abilities for every ally before resolving its mini duel. */
    readonly windSideAbilitiesHandled?: boolean;
    readonly attackerCanSwitch?: Readonly<Partial<Record<BattleSide, boolean>>>;
    /** All moves held by active opposing Imprison users, including the partner in doubles. */
    readonly opponentImprisonMoves?: readonly string[];
    /** Double battles resolve called moves before expanding copied spread targets. */
    readonly calledMove?: BattleMove | null;
    /** Full public battle roster, in party order, for Beat Up's eligible participants. */
    readonly attackerParty?: Readonly<Partial<Record<BattleSide, readonly BattlerState[]>>>;
    readonly wildBattle?: boolean; readonly escapable?: boolean } = {}): TurnResult {
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
  if (effects.gravityTurns > 0) for (const side of SIDES) {
    const current = battlers[side];
    const chargeCode = current.volatile?.chargingCalledMove?.functionCode
      ?? current.moves.find((candidate) => candidate.move.internalName
        === current.volatile?.chargingMove)?.move.functionCode;
    if (!["0C9", "0CC", "0CE"].includes(chargeCode ?? "")) continue;
    battlers[side] = withVolatile(current, { ...volatileOf(current), chargingMove: null,
      chargingCalledMove: null, chargingTargetId: null });
    for (const targetSide of SIDES) {
      const target = battlers[targetSide];
      if (target.volatile?.skyDropCarrierId !== current.id) continue;
      battlers[targetSide] = withVolatile(target, { ...volatileOf(target), skyDropCarrierId: null });
      events.push({ type: "volatileEnded", side: targetSide, effect: "sky-drop" });
    }
  }
  let effectiveWeather = effectiveBattleWeather(effects.weather, Object.values(battlers), options.weatherSuppressed);
  const moved = new Set<BattleSide>();
  const damagedThisTurn = new Set<BattleSide>();
  const selectedActions: Partial<Record<BattleSide, MoveAction>> = { ...actions };
  for (const side of SIDES) {
    const encore = volatileOf(battlers[side]);
    const lockedMove = battlers[side].ability === "PODERSABIO" && encore.choiceLockedMove !== null
      ? encore.choiceLockedMove
      : encore.chargingMove !== null ? encore.chargingMove
      : encore.rolloutTurns > 0 ? battlers[side].moves.find((slot) => slot.move.functionCode === "0D3")?.move.internalName
      : encore.outrageTurns > 0 ? battlers[side].moves.find((slot) => slot.move.functionCode === "0D2")?.move.internalName
      : encore.bideTurns > 0 ? battlers[side].moves.find((slot) => slot.move.functionCode === "0D4")?.move.internalName
      : encore.uproarTurns > 0 ? battlers[side].moves.find((slot) => slot.move.functionCode === "0D1")?.move.internalName
        : encore.encoreTurns > 0 ? encore.encoreMove : null;
    if (lockedMove === null || lockedMove === undefined || selectedActions[side] === undefined) continue;
    const moveIndex = battlers[side].moves.findIndex((slot) => slot.move.internalName === lockedMove
      && (slot.pp > 0 || encore.chargingMove !== null || encore.bideTurns > 0 || encore.outrageTurns > 0));
    if (moveIndex >= 0) selectedActions[side] = { kind: "move", moveIndex };
  }
  const custap: Partial<Record<BattleSide, boolean>> = {};
  for (const side of SIDES) {
    if (selectedActions[side] === undefined || !custapBerryReady(battlers[side],
      [battlers[opponentOf(side)]], effects.magicRoomTurns)) continue;
    battlers[side] = consumeTrackedItem(battlers[side], "CUSTAPBERRY", effects);
    custap[side] = true;
    events.push({ type: "itemActivated", side, item: "CUSTAPBERRY", effect: "boost", amount: 0,
      hp: battlers[side].hp },
      { type: "heldItemConsumed", side, item: "CUSTAPBERRY", effect: "boost", hp: battlers[side].hp });
  }
  const order = orderedSides({ ...state, battlers }, selectedActions, rng, trace, effectiveWeather, custap);
  events.push({ type: "actionOrdered", order });
  let winner: BattleSide | null = null;
  let battleDraw = false;
  const checkReactiveBerries = (actingSide: BattleSide): void => {
    for (const candidate of SIDES) {
      const blocked = candidate === actingSide ? options.attackerBerriesBlocked : options.defenderBerriesBlocked;
      const result = resolveBattleBerryCheck(battlers[candidate], candidate, rng, trace,
        blocked ?? berriesBlockedBy([battlers[opponentOf(candidate)]]),
        effects.nextPickupUse, effects.magicRoomTurns);
      battlers[candidate] = result.battler;
      effects.nextPickupUse = result.nextPickupUse;
      events.push(...result.events);
    }
  };

  for (const side of order) {
    checkReactiveBerries(side);
    refreshNeutralizingGas();
    effectiveWeather = effectiveBattleWeather(effects.weather, Object.values(battlers), options.weatherSuppressed);
    const targetSide = opponentOf(side);
    let attacker = battlers[side];
    if (attacker.hp === 0) {
      events.push({ type: "actionSkipped", side, reason: "fainted" });
      continue;
    }
    if (volatileOf(attacker).skyDropCarrierId !== null
      || volatileOf(attacker).skyDropLockedTurn === state.turn) {
      events.push({ type: "actionSkipped", side, reason: "sky-drop" });
      continue;
    }
    if (volatileOf(attacker).rechargeTurns > 0) {
      battlers[side] = withVolatile(attacker, { ...volatileOf(attacker), rechargeTurns: 0 });
      events.push({ type: "actionSkipped", side, reason: "recharge" });
      continue;
    }
    const intendedAction = selectedActions[side];
    const usingSleepTalk = intendedAction !== undefined
      && ["0B4", "011"].includes(battlers[side].moves[intendedAction.moveIndex]?.move.functionCode ?? "");
    if (!canAct(side, battlers, rng, events, trace, usingSleepTalk)) {
      if (volatileOf(battlers[side]).chargingMove !== null) battlers[side] = withVolatile(battlers[side], {
        ...volatileOf(battlers[side]), chargingMove: null, chargingCalledMove: null });
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
    let bideReleaseDamage = 0;
    const copiedMove = selectedSlot.move.functionCode === "0AE"
      ? attacker.volatile?.chargingMove === selectedSlot.move.internalName
        && attacker.volatile.chargingCalledMove != null ? attacker.volatile.chargingCalledMove
        : options.calledMove === undefined ? mirrorMoveFrom(battlers[targetSide]) : options.calledMove
      : selectedSlot.move.functionCode === "0AF"
        ? options.calledMove === undefined ? copycatMoveFrom(effects) : options.calledMove
      : selectedSlot.move.functionCode === "0B0"
        ? attacker.volatile?.chargingMove === selectedSlot.move.internalName
          && attacker.volatile.chargingCalledMove != null ? attacker.volatile.chargingCalledMove
          : options.calledMove === undefined ? meFirstMoveFrom(
            battlers[targetSide].moves[(selectedActions[targetSide] ?? options.targetPlannedAction)?.moveIndex ?? -1]?.move,
            moved.has(targetSide) || options.targetAlreadyMoved === true) : options.calledMove
      : selectedSlot.move.functionCode === "0B4"
        ? options.calledMove === undefined ? sleepTalkMoveFrom(attacker, rng, trace) : options.calledMove
      : selectedSlot.move.functionCode === "0B5"
        ? options.calledMove === undefined ? assistMoveFrom(attacker,
          options.attackerParty?.[side] ?? [attacker], rng, trace) : options.calledMove
      : null;
    const slot = selectedSlot.move.functionCode === "0B3"
      ? { ...selectedSlot, move: naturePowerMove(selectedSlot.move, effects) }
      : copiedMove === null ? selectedSlot : { ...selectedSlot, move: copiedMove };
    const stance = applyStanceChange(attacker, side, slot.move);
    if (stance.battler !== attacker) {
      battlers[side] = stance.battler;
      attacker = stance.battler;
      events.push(...stance.events);
    }
    if (selectedSlot.pp === 0 && selectedSlot.move.functionCode !== "002"
      && volatileOf(attacker).chargingMove !== selectedSlot.move.internalName
      && !(selectedSlot.move.functionCode === "0D4" && volatileOf(attacker).bideTurns > 0)
      && !(selectedSlot.move.functionCode === "0D2" && volatileOf(attacker).outrageTurns > 0)) {
      events.push({ type: "actionSkipped", side, reason: "no-pp" });
      continue;
    }
    const volatile = volatileOf(attacker);
    if (volatile.disableTurns > 0 && volatile.disabledMove === slot.move.internalName) {
      events.push({ type: "actionSkipped", side, reason: "disabled" });
      continue;
    }
    if (volatile.tormented && volatile.chargingMove === null
      && volatile.lastMoveUsed === selectedSlot.move.internalName) {
      events.push({ type: "actionSkipped", side, reason: "tormented" });
      continue;
    }
    const imprisoned = options.opponentImprisonMoves?.includes(selectedSlot.move.internalName)
      ?? (battlers[targetSide].volatile?.imprisoning === true
        && battlers[targetSide].moves.some((candidate) => candidate.move.internalName === selectedSlot.move.internalName));
    if (imprisoned) {
      events.push({ type: "actionSkipped", side, reason: "imprisoned" });
      continue;
    }
    if (volatile.healBlockTurns > 0 && isHealingMove(slot.move)) {
      events.push({ type: "actionSkipped", side, reason: "heal-blocked" });
      continue;
    }
    if (heldItemIsActive(attacker, effects.magicRoomTurns) && attacker.heldItem === "ASSAULTVEST" && slot.move.category === "Status") {
      events.push({ type: "actionSkipped", side, reason: "item-blocked" });
      continue;
    }
    if (volatile.tauntTurns > 0 && slot.move.category === "Status") {
      events.push({ type: "actionSkipped", side, reason: "taunted" });
      continue;
    }
    if (effects.gravityTurns > 0 && ["0C9", "0CC", "0CE"].includes(slot.move.functionCode)) {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    const ppCost = selectedSlot.move.functionCode === "002" ? 0
      : volatile.chargingMove === selectedSlot.move.internalName
      || selectedSlot.move.functionCode === "0D4" && volatile.bideTurns > 0
      || selectedSlot.move.functionCode === "0D2" && volatile.outrageTurns > 0 ? 0
      : options.ppCost ?? (moveCanTriggerPressure(selectedSlot.move)
      && battlers[targetSide].ability === "PRESSURE" ? 2 : 1);
    const nextPp = Math.max(0, selectedSlot.pp - ppCost);
    const nextMoves = attacker.moves.map((candidate, index) => index === action.moveIndex ? { ...candidate, pp: nextPp } : candidate);
    const furyCutterCount = selectedSlot.move.functionCode === "091"
      ? Math.min(4, volatile.lastMoveUsed === selectedSlot.move.internalName ? volatile.furyCutterCount + 1 : 1) : 0;
    const rolloutTurns = selectedSlot.move.functionCode === "0D3"
      ? volatile.rolloutTurns > 0 ? volatile.rolloutTurns - 1 : 4 : 0;
    const previouslyUsed = volatile.usedMoveNames ?? [];
    battlers[side] = withVolatile({ ...attacker, moves: nextMoves }, { ...volatile,
      lastMoveUsed: selectedSlot.move.internalName, furyCutterCount, rolloutTurns,
      usedMoveNames: previouslyUsed.includes(selectedSlot.move.internalName) ? previouslyUsed
        : [...previouslyUsed, selectedSlot.move.internalName],
      grudge: false, destinyBond: false,
      choiceLockedMove: attacker.ability === "PODERSABIO"
        ? volatile.choiceLockedMove ?? selectedSlot.move.internalName : volatile.choiceLockedMove });
    events.push({ type: "moveUsed", side, move: selectedSlot.move.internalName });
    if (slot.move.internalName !== selectedSlot.move.internalName) events.push({ type: "moveUsed", side, move: slot.move.internalName });
    events.push({ type: "ppChanged", side, move: selectedSlot.move.internalName, pp: nextPp });
    moved.add(side);
    if (["0AE", "0AF", "0B0", "0B4", "0B5"].includes(selectedSlot.move.functionCode) && copiedMove === null
      || selectedSlot.move.functionCode === "0B4" && battlers[side].majorStatus?.kind !== "sleep") {
      events.push({ type: "moveFailed", side, move: selectedSlot.move.internalName, reason: "condition" });
      continue;
    }
    effects.lastMoveUsed = { ...slot.move };
    if (slot.move.functionCode === "011" && battlers[side].majorStatus?.kind !== "sleep") {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    if (slot.move.functionCode === "140" && slot.move.category !== "Status"
      && (battlers[side].moves.filter((candidate) => candidate.move.internalName !== slot.move.internalName).length === 0
        || battlers[side].moves.some((candidate) => candidate.move.internalName !== slot.move.internalName
          && !previouslyUsed.includes(candidate.move.internalName)))) {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    if (slot.move.functionCode === "113" && volatileOf(battlers[side]).stockpileCount === 0) {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    const beatUpParticipants = slot.move.functionCode === "0C1"
      ? (options.attackerParty?.[side] ?? [battlers[side]]).filter((member) =>
        member.id === battlers[side].id || member.hp > 0 && member.majorStatus === null)
      : [];
    if (slot.move.functionCode === "0C1"
      && (beatUpParticipants.length === 0 || beatUpParticipants.some((member) => member.baseAttack == null))) {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    const skyDropReleasing = slot.move.functionCode === "0CE"
      && volatile.chargingMove === selectedSlot.move.internalName;
    const twoTurnCharge = ["0C3", "0C4", "0C5", "0C6", "0C7", "0C8",
      "0C9", "0CA", "0CB", "0CC", "0CD"].includes(slot.move.functionCode);
    const releasingCharge = twoTurnCharge && volatile.chargingMove === selectedSlot.move.internalName;
    if (releasingCharge) battlers[side] = withVolatile(battlers[side], {
      ...volatileOf(battlers[side]), chargingMove: null, chargingCalledMove: null });
    if (twoTurnCharge && !releasingCharge) {
      const sunnySolarBeam = slot.move.functionCode === "0C4"
        && (effectiveWeather === "sun" || effectiveWeather === "harsh-sun");
      const herb = !sunnySolarBeam && heldItemIsActive(battlers[side], effects.magicRoomTurns)
        && battlers[side].heldItem === "POWERHERB";
      if (slot.move.functionCode === "0C8") applyStatChange(side, side,
        { target: "self", stat: "defense", delta: 1 }, battlers, events);
      if (herb) {
        battlers[side] = consumeTrackedItem(battlers[side], "POWERHERB", effects);
        events.push({ type: "heldItemConsumed", side, item: "POWERHERB", effect: "boost", hp: battlers[side].hp });
      } else if (!sunnySolarBeam) {
        battlers[side] = withVolatile(battlers[side], { ...volatileOf(battlers[side]),
          chargingMove: selectedSlot.move.internalName,
          chargingCalledMove: ["0AE", "0B0"].includes(selectedSlot.move.functionCode) ? slot.move : null });
        events.push({ type: "volatileApplied", source: side, target: side,
          effect: "charge", turns: 1, move: slot.move.internalName });
        continue;
      }
    }
    if (slot.move.functionCode === "0D4") {
      const user = battlers[side];
      const current = volatileOf(user);
      if (current.bideTurns === 0) {
        battlers[side] = withVolatile(user, { ...current, bideTurns: 2,
          bideDamage: 0, bideTargetId: null });
        events.push({ type: "volatileApplied", source: side, target: side,
          effect: "bide", turns: 2, move: slot.move.internalName });
        continue;
      }
      if (current.bideTurns > 1) {
        battlers[side] = withVolatile(user, { ...current, bideTurns: current.bideTurns - 1 });
        continue;
      }
      bideReleaseDamage = current.bideDamage;
      battlers[side] = withVolatile(user, { ...current, bideTurns: 0,
        bideDamage: 0, bideTargetId: null });
      if (bideReleaseDamage <= 0) {
        events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
        continue;
      }
    }
    if (["0E3", "0E4", "0ED"].includes(slot.move.functionCode)
      && options.attackerCanSwitch?.[side] !== true) {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    if (slot.move.functionCode === "0EA" && (options.wildBattle !== true
      || options.escapable === false || battlers[side].volatile?.meanLookBy != null
      || battlers[side].volatile?.ingrain === true
      || switchTrapAbility(battlers[side], [battlers[targetSide]], effects.magicRoomTurns) !== null)) {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    if (slot.move.functionCode === "0DE" && battlers[targetSide].majorStatus?.kind !== "sleep") {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    if (slot.move.functionCode === "0EB" && options.wildBattle !== true
      && options.attackerCanSwitch?.[targetSide] !== true) {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
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
    if (slot.move.functionCode === "096" && (naturalGiftProfile(battlers[side].heldItem) === null
      || !heldItemIsActive(battlers[side]) || effects.magicRoomTurns > 0
      || (options.attackerBerriesBlocked ?? berriesBlockedBy([battlers[targetSide]])))) {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    if (slot.move.functionCode === "0F7" && (flingPower(battlers[side].heldItem) === null
      || !heldItemIsActive(battlers[side], effects.magicRoomTurns)
      || heldItemIsUnlosable(battlers[side])
      || isSupportedBerry(battlers[side].heldItem)
        && (options.attackerBerriesBlocked ?? berriesBlockedBy([battlers[targetSide]])))) {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    const moveType = effectiveMoveType(battlers[side], slot.move, effectiveWeather, effects.magicRoomTurns).type;
    const moveCategory = effectiveMoveCategory(battlers[side], slot.move);
    const resolvedMove = moveType === slot.move.type && moveCategory === slot.move.category ? slot.move
      : { ...slot.move, type: moveType, category: moveCategory };
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
    if (resolvedMove.category !== "Status"
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
    if (slot.move.functionCode === "123"
      && !battlers[side].types.some((type) => defender.types.includes(type))) {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    if (options.targetIsAlly === true && resolvedMove.category !== "Status"
      && defender.ability === "TELEPATHY" && !hasMoldBreaker(battlers[side])) {
      events.push({ type: "abilityActivated", side: options.targetPresentationSide ?? actualTargetSide,
        ability: "TELEPATHY", effect: "block-move" });
      continue;
    }
    const statusTargetSide = moveTargetsUser(slot.move) ? side : actualTargetSide;
    if (resolvedMove.category === "Status" && hasMoveFlag(slot.move, "d")
      && actualTargetSide !== side && battlers[actualTargetSide].volatile?.snatching === true) {
      const snatcher = battlers[actualTargetSide];
      battlers[actualTargetSide] = withVolatile(snatcher, { ...volatileOf(snatcher), snatching: false });
      events.push({ type: "moveSnatched", source: side, target: actualTargetSide, move: slot.move.internalName });
      applyMoveEffect(actualTargetSide, side, resolvedMove, battlers, rng, events, trace, effects, effectiveWeather);
      continue;
    }
    const statusTarget = battlers[statusTargetSide];
    if (resolvedMove.category === "Status" && statusTarget.ability === "GOODASGOLD"
      && !hasMoldBreaker(battlers[side])) {
      events.push({ type: "abilityActivated", side: statusTargetSide === actualTargetSide
        ? options.targetPresentationSide ?? actualTargetSide : statusTargetSide,
        ability: "GOODASGOLD", effect: "block-move" },
      { type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    const hostileTarget = options.targetIsAlly !== true && actualTargetSide !== side;
    if (hostileTarget && effects.terrain === "psychic" && isGrounded(defender, effects)
      && effectiveMovePriority(battlers[side], slot.move, effects.terrain) > 0) {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    if (hostileTarget && defender.ability === "QUEENLYMAJESTY"
      && effectiveMovePriority(battlers[side], slot.move, effects.terrain) > 0 && !hasMoldBreaker(battlers[side])) {
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
    if (statusTargetSide === actualTargetSide && hasMoveFlag(slot.move, "l") && (defender.types.includes("GRASS")
      || heldItemIsActive(defender, effects.magicRoomTurns) && defender.heldItem === "SAFETYGOGGLES"
      || defender.ability === "OVERCOAT" && !hasMoldBreaker(battlers[side]))) {
      if (defender.ability === "OVERCOAT" && !defender.types.includes("GRASS")
        && !(heldItemIsActive(defender, effects.magicRoomTurns) && defender.heldItem === "SAFETYGOGGLES")) {
        events.push({ type: "abilityActivated", side: actualTargetSide, ability: "OVERCOAT", effect: "block-move" });
      }
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    if (statusTargetSide === actualTargetSide && moveType === "GRASS"
      && defender.ability === "SAPSIPPER" && !hasMoldBreaker(battlers[side])) {
      events.push({ type: "abilityActivated", side: actualTargetSide, ability: "SAPSIPPER", effect: "boost-stat" });
      applyStatChange(actualTargetSide, side, { target: "self", stat: "attack", delta: 1 }, battlers, events);
      continue;
    }
    if (statusTargetSide === actualTargetSide && defender.ability === "SOUNDPROOF"
      && hasMoveFlag(slot.move, "k") && !hasMoldBreaker(battlers[side])) {
      events.push({ type: "abilityActivated", side: actualTargetSide, ability: "SOUNDPROOF", effect: "block-move" });
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    if (statusTargetSide === actualTargetSide && defender.ability === "BULLETPROOF"
      && isBombMove(slot.move) && !hasMoldBreaker(battlers[side])) {
      events.push({ type: "abilityActivated", side: actualTargetSide, ability: "BULLETPROOF", effect: "block-move" },
        { type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    if (resolvedMove.category === "Status" && hasMoveFlag(slot.move, "c")
      && (defender.volatile?.magicCoat === true || defender.ability === "MAGICBOUNCE"
        && !hasMoldBreaker(battlers[side])) && actualTargetSide !== side) {
      if (defender.volatile?.magicCoat === true) {
        events.push({ type: "moveReflected", source: side, target: actualTargetSide, move: slot.move.internalName });
      } else {
        events.push({ type: "abilityActivated", side: actualTargetSide, ability: "MAGICBOUNCE", effect: "reflect-move" });
      }
      const reflectedHit = accuracyCheck(actualTargetSide, defender, battlers[side], slot.move, rng, trace, effectiveWeather,
        { ...(neutralizingGas || options.defenderPartnerAbility === undefined ? {} : {
          attackerPartnerAbility: options.defenderPartnerAbility }), hostile: options.targetIsAlly !== true,
          magicRoomTurns: effects.magicRoomTurns, gravityTurns: effects.gravityTurns });
      if (volatileOf(defender).micleBerry === true
        && micleAccuracyWasChecked(defender, battlers[side], slot.move)) battlers[actualTargetSide] = withVolatile(
        battlers[actualTargetSide], { ...volatileOf(battlers[actualTargetSide]), micleBerry: false });
      if (!reflectedHit) {
        events.push({ type: "moveMissed", side: actualTargetSide, move: slot.move.internalName });
      } else {
        applyMoveEffect(actualTargetSide, side, resolvedMove, battlers, rng, events, trace, effects, effectiveWeather);
      }
      continue;
    }
    if (skyDropReleasing) {
      const carrier = battlers[side];
      battlers[side] = withVolatile(carrier, { ...volatileOf(carrier), chargingMove: null,
        chargingCalledMove: null, chargingTargetId: null });
      if (defender.id === volatile.chargingTargetId
        && volatileOf(defender).skyDropCarrierId === carrier.id) {
        battlers[actualTargetSide] = withVolatile(defender, { ...volatileOf(defender),
          skyDropCarrierId: null, skyDropLockedTurn: state.turn });
        defender = battlers[actualTargetSide];
        events.push({ type: "volatileEnded", side: actualTargetSide, effect: "sky-drop" });
      }
    }
    const targetVolatile = volatileOf(defender);
    if (missesSemiInvulnerable(battlers[side], defender, slot.move)) {
      events.push({ type: "moveMissed", side, move: slot.move.internalName });
      continue;
    }
    const guardedTargetCode = (slot.move.targetCode ?? "00").toUpperCase().replace(/^0X/u, "");
    const guardedSide = options.targetIsAlly === true ? side : actualTargetSide;
    if (effects.sides[guardedSide].quickGuard && hasMoveFlag(slot.move, "b")
        && effectiveMovePriority(battlers[side], slot.move, effects.terrain) > 0
        || effects.sides[guardedSide].wideGuard && resolvedMove.category !== "Status"
          && ["04", "08"].includes(guardedTargetCode)) {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "protected" });
      continue;
    }
    if (targetVolatile.protected && !["0AD", "0CD", "942"].includes(slot.move.functionCode)) {
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
    const hit = accuracyCheck(side, battlers[side], defender, slot.move, rng, trace, effectiveWeather,
      { ...(neutralizingGas || options.attackerPartnerAbility === undefined ? {} : {
        attackerPartnerAbility: options.attackerPartnerAbility }), hostile: hostileTarget,
        magicRoomTurns: effects.magicRoomTurns, gravityTurns: effects.gravityTurns });
    if (volatileOf(battlers[side]).micleBerry === true
      && micleAccuracyWasChecked(battlers[side], defender, slot.move)) battlers[side] = withVolatile(battlers[side], {
      ...volatileOf(battlers[side]), micleBerry: false });
    if (!hit) {
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
    if (slot.move.functionCode === "0CE") {
      if (!skyDropReleasing) {
        if (options.targetIsAlly === true || defender.volatile?.chargingMove != null
          || defender.volatile?.skyDropCarrierId != null || effectiveWeight(defender, battlers[side]) >= 2000) {
          events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
          continue;
        }
        const carrier = battlers[side];
        battlers[side] = withVolatile(carrier, { ...volatileOf(carrier),
          chargingMove: selectedSlot.move.internalName,
          chargingCalledMove: ["0AE", "0B0"].includes(selectedSlot.move.functionCode) ? slot.move : null,
          chargingTargetId: defender.id });
        battlers[actualTargetSide] = withVolatile(defender, { ...volatileOf(defender),
          skyDropCarrierId: carrier.id });
        events.push({ type: "volatileApplied", source: side, target: side,
          effect: "charge", turns: 1, move: slot.move.internalName },
        { type: "volatileApplied", source: side, target: actualTargetSide,
          effect: "sky-drop", turns: 1, move: slot.move.internalName });
        continue;
      }
      if (defender.types.includes("FLYING")
        || defender.ability === "LEVITATE" && !hasMoldBreaker(battlers[side])) {
        events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
        continue;
      }
    }
    if (slot.move.functionCode === "092") {
      const ownSide = effects.sides[side];
      const count = ownSide.echoedVoiceLastTurn === state.turn ? ownSide.echoedVoiceCount ?? 1
        : ownSide.echoedVoiceLastTurn === state.turn - 1 ? Math.min(5, (ownSide.echoedVoiceCount ?? 0) + 1) : 1;
      effects.sides[side] = { ...ownSide, echoedVoiceCount: count, echoedVoiceLastTurn: state.turn };
    }
    if (applyTypeAbsorption(side, actualTargetSide, slot.move, effectiveWeather, battlers, events)) continue;
    if (resolvedMove.category !== "Status" && defender.ability === "WONDERGUARD"
      && !hasMoldBreaker(battlers[side])
      && effectiveTypeMultiplier(battlers[side], defender, resolvedMove, effectiveWeather,
        effects.magicRoomTurns, effects.gravityTurns) <= 1) {
      events.push({ type: "abilityActivated", side: options.targetPresentationSide ?? actualTargetSide,
        ability: "WONDERGUARD", effect: "block-move" },
      { type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    const targetCode = (slot.move.targetCode ?? "00").toUpperCase().replace(/^0X/u, "");
    const fixedDamageMove = ["06A", "06B", "06C", "06D", "06E", "06F", "070", "071", "072", "073", "0D4", "0E1"]
      .includes(slot.move.functionCode);
    const parentalEligible = battlers[side].ability === "PARENTALBOND" && resolvedMove.category !== "Status"
      && !["04", "08"].includes(targetCode)
      && !fixedDamageMove
      && !["0C0", "0C1", "0BD", "0BE", "0E0", "0E1", "0F7"].includes(slot.move.functionCode);
    if (resolvedMove.category !== "Status" && defender.ability === "DISGUISE"
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
    if (resolvedMove.category === "Status") {
      applyMoveEffect(side, actualTargetSide, resolvedMove, battlers, rng, events, trace, effects, effectiveWeather,
        slot.move.functionCode === "051" && options.targetPresentationSide === side, options.wildBattle === true);
      if (events.some((event) => event.type === "battleEscaped")) break;
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
    const damageContext = { reflect: slot.move.functionCode !== "10A"
        && !infiltrates && effects.sides[actualTargetSide].reflectTurns > 0,
      lightScreen: slot.move.functionCode !== "10A"
        && !infiltrates && effects.sides[actualTargetSide].lightScreenTurns > 0,
      luckyChant: effects.sides[actualTargetSide].luckyChantTurns > 0,
      mudSport: effects.mudSportTurns > 0,
      waterSport: effects.waterSportTurns > 0, weather: effectiveWeather, terrain: effects.terrain,
      magicRoomTurns: effects.magicRoomTurns, gravityTurns: effects.gravityTurns,
      wonderRoomTurns: effects.wonderRoomTurns,
      turn: state.turn, lastFaintedTurn: effects.sides[side].lastFaintedTurn ?? null,
      echoedVoiceCount: effects.sides[side].echoedVoiceCount ?? 1,
      remainingPp: nextPp,
      attackerEffectiveSpeed: options.effectiveSpeeds?.[side] ?? effectiveSpeed(battlers[side],
        effects.sides[side].tailwindTurns > 0, effects.terrain)
        * weatherSpeedMultiplier(battlers[side], effectiveWeather),
      defenderEffectiveSpeed: options.effectiveSpeeds?.[actualTargetSide] ?? effectiveSpeed(defender,
        effects.sides[actualTargetSide].tailwindTurns > 0, effects.terrain)
        * weatherSpeedMultiplier(defender, effectiveWeather),
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
      ...(retaliationHit === undefined ? {} : { retaliationDamage: retaliationHit.amount }),
      ...(bideReleaseDamage <= 0 ? {} : { bideDamage: bideReleaseDamage }) };
    const assuranceMultiplier = slot.move.functionCode === "082"
      && (options.targetTookDamageThisTurn === true || damagedThisTurn.has(actualTargetSide)) ? 2 : 1;
    const revengeMultiplier = slot.move.functionCode === "081"
      && retaliation?.turn === state.turn && retaliation.attackers?.includes(defender.id) === true ? 2 : 1;
    const roundMultiplier = slot.move.functionCode === "083" ? options.roundMultiplier ?? 1 : 1;
    const chargeMultiplier = moveType === "ELECTRIC" && volatileOf(battlers[side]).chargeTurns > 0 ? 2 : 1;
    const fusionBoost = slot.move.functionCode === "079" && effects.fusionBoltTurn === state.turn
      || slot.move.functionCode === "07A" && effects.fusionFlareTurn === state.turn;
    if (fusionBoost) {
      if (slot.move.functionCode === "079") effects.fusionBoltTurn = null;
      else effects.fusionFlareTurn = null;
    }
    const solarWeatherMultiplier = slot.move.functionCode === "0C4" && effectiveWeather !== null
      && effectiveWeather !== "sun" && effectiveWeather !== "harsh-sun" ? 0.5 : 1;
    const defendingCharge = defender.volatile?.chargingCalledMove?.functionCode
      ?? defender.moves.find((candidate) => candidate.move.internalName
        === defender.volatile?.chargingMove)?.move.functionCode;
    const semiInvulnerableBonus = ["0C9", "0CC", "0CE"].includes(defendingCharge ?? "")
      && slot.move.functionCode === "11C"
      || defender.volatile?.skyDropCarrierId != null && slot.move.functionCode === "11C"
      || defendingCharge === "0CB" && ["075", "0D0"].includes(slot.move.functionCode)
      || defendingCharge === "0CA" && ["076", "095"].includes(slot.move.functionCode)
      || ["0C9", "0CC", "0CE"].includes(defendingCharge ?? "")
        && ["077", "078"].includes(slot.move.functionCode)
      || defender.volatile?.skyDropCarrierId != null && ["077", "078"].includes(slot.move.functionCode)
      ? 2 : 1;
    const grassyEarthquakeMultiplier = ["076", "095"].includes(slot.move.functionCode)
      && effects.terrain === "grassy" ? 0.5 : 1;
    const terrainFunctionMultiplier = slot.move.functionCode === "201" && effects.terrain === "electric" ? 2
      : slot.move.functionCode === "207" && effects.terrain === "psychic" ? 1.5 : 1;
    const firstStrikeMultiplier = slot.move.functionCode === "303"
      && (selectedActions[actualTargetSide] ?? options.targetPlannedAction) !== undefined
      && !moved.has(actualTargetSide) && options.targetAlreadyMoved !== true ? 2 : 1;
    const powerMultiplier = assuranceMultiplier * revengeMultiplier * roundMultiplier * chargeMultiplier
      * solarWeatherMultiplier * semiInvulnerableBonus * grassyEarthquakeMultiplier
      * terrainFunctionMultiplier * firstStrikeMultiplier
      * (selectedSlot.move.functionCode === "0B0" ? 1.5 : 1);
    let damageMove = powerMultiplier === 1 ? slot.move : { ...slot.move, power: slot.move.power * powerMultiplier };
    if (slot.move.functionCode === "0C1") damageMove = { ...damageMove,
      power: 5 + Math.floor(beatUpParticipants[0]!.baseAttack! / 10) };
    if (slot.move.functionCode === "113") damageMove = { ...damageMove,
      power: 100 * volatileOf(battlers[side]).stockpileCount };
    if (slot.move.functionCode === "0F7") damageMove = { ...damageMove,
      power: flingPower(battlers[side].heldItem)! };
    if (slot.move.functionCode === "090") damageMove = { ...damageMove, category: moveCategory };
    if (slot.move.functionCode === "095") {
      const magnitudePowers = [10, 30, 30, 50, 50, 50, 50, 70, 70, 70, 70, 70, 70, 90, 90, 90, 90, 110, 110, 150];
      damageMove = { ...slot.move,
        power: magnitudePowers[draw(rng, trace, "magnitude", magnitudePowers.length)]! * powerMultiplier };
    }
    if (slot.move.functionCode === "094") {
      const presentRoll = draw(rng, trace, "present", 10);
      if (presentRoll >= 8) {
        if (effectiveTypeMultiplier(battlers[side], defender, slot.move, effectiveWeather,
          effects.magicRoomTurns, effects.gravityTurns) === 0
          || defender.hp === defender.stats.maxHp) {
          events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
          continue;
        }
        // The source calculates damage even on its healing branch so a matching Gem is spent.
        calculateDamage(side, battlers[side], defender, { ...slot.move, power: 1 }, rng, trace, damageContext);
        const gem = heldItemIsActive(battlers[side], effects.magicRoomTurns) && ((battlers[side].heldItem === "FIGHTINGGEM" && moveType === "FIGHTING")
          || (battlers[side].heldItem === "BUGGEM" && moveType === "BUG"))
          ? battlers[side].heldItem as "FIGHTINGGEM" | "BUGGEM" : null;
        if (gem !== null) {
          battlers[side] = consumeTrackedItem(battlers[side], gem, effects);
          events.push({ type: "heldItemConsumed", side, item: gem, effect: "boost", hp: battlers[side].hp });
        }
        const amount = Math.min(defender.stats.maxHp - defender.hp, Math.floor(defender.stats.maxHp / 4));
        battlers[actualTargetSide] = { ...defender, hp: defender.hp + amount };
        events.push({ type: "hpRestored", side: actualTargetSide, source: "move",
          move: slot.move.internalName, amount, hp: defender.hp + amount });
        continue;
      }
      damageMove = { ...damageMove, power: presentPower(presentRoll) };
    }
    const firstDamage = calculateDamage(side, battlers[side], defender, damageMove, rng, trace, damageContext);
    const flyingEffectiveness = slot.move.functionCode === "144"
      ? effectiveTypeMultiplier(battlers[side], defender, { ...slot.move, type: "FLYING" },
        effectiveWeather, effects.magicRoomTurns, effects.gravityTurns) : 1;
    if (slot.move.functionCode === "0E1" && firstDamage === 0) {
      events.push({ type: "moveFailed", side, move: slot.move.internalName, reason: "condition" });
      continue;
    }
    const damageRolls = [firstDamage];
    const parentalBond = parentalEligible && damageRolls[0]! > 0;
    if (parentalBond) {
      events.push({ type: "abilityActivated", side, ability: "PARENTALBOND", effect: "extra-hit" });
    }
    if (parentalBond) {
      damageRolls.push(0);
    }
    if ((slot.move.functionCode === "0C0" || slot.move.functionCode === "0BD"
      || slot.move.functionCode === "0BE") && damageRolls[0]! > 0) {
      const hitTable = [2, 2, 3, 3, 4, 5] as const;
      const hits = slot.move.functionCode === "0BD" || slot.move.functionCode === "0BE" ? 2
        : battlers[side].ability === "SKILLLINK" ? 5
        : hitTable[draw(rng, trace, "additional-effect", hitTable.length)]!;
      for (let hit = 1; hit < hits; hit += 1) damageRolls.push(0);
    }
    if (slot.move.functionCode === "0C1" && damageRolls[0]! > 0) {
      for (let hit = 1; hit < beatUpParticipants.length; hit += 1) damageRolls.push(0);
    }
    if ((slot.move.functionCode === "0BF" || slot.move.functionCode === "942") && damageRolls[0]! > 0) damageRolls.push(0, 0);
    const damageTraces = trace.slice(traceStart).filter((entry) => entry.type === "damage");
    const damageTrace = damageTraces[0];
    if (damageTrace === undefined) throw new Error("Damage calculation did not emit its trace.");
    const gem = heldItemIsActive(battlers[side], effects.magicRoomTurns) && ((battlers[side].heldItem === "FIGHTINGGEM" && moveType === "FIGHTING")
      || (battlers[side].heldItem === "BUGGEM" && moveType === "BUG")
      ) ? battlers[side].heldItem as "FIGHTINGGEM" | "BUGGEM" : null;
    if (gem !== null) {
      battlers[side] = consumeTrackedItem(battlers[side], gem, effects);
      events.push({ type: "heldItemConsumed", side, item: gem, effect: "boost", hp: battlers[side].hp });
    }
    if ((slot.move.functionCode === "0E0" || slot.move.functionCode === "0E1") && battlers[side].hp > 0) {
      const current = battlers[side];
      battlers[side] = { ...current, hp: 0 };
      events.push({ type: "recoilDamage", side, move: slot.move.internalName,
        reason: "self-destruct", amount: current.hp, hp: 0 }, { type: "fainted", side });
    }
    const resistBerry = !(options.defenderBerriesBlocked ?? berriesBlockedBy([battlers[side]]))
      && heldItemIsActive(defender, effects.magicRoomTurns)
      && resistBerryApplies(defender.heldItem, moveType, damageTrace.effectiveness)
      ? defender.heldItem : null;
    let hp = defender.hp;
    let damage = 0;
    const appliedHits: { hpBefore: number; hpAfter: number; critical: boolean }[] = [];
    let landedHits = 0;
    let focusSash = false;
    let sturdy = false;
    for (const [hitIndex, initialDamage] of damageRolls.entries()) {
      if (hp <= 0 || hitIndex > 0 && battlers[side].hp <= 0) break;
      if (slot.move.functionCode === "0BF" && hitIndex > 0
        && !accuracyCheck(side, battlers[side], battlers[actualTargetSide], slot.move,
          rng, trace, effectiveWeather, { hostile: hostileTarget,
            magicRoomTurns: effects.magicRoomTurns, gravityTurns: effects.gravityTurns })) break;
      const hitMove = slot.move.functionCode === "0C1"
        ? { ...damageMove, power: 5 + Math.floor(beatUpParticipants[hitIndex]!.baseAttack! / 10) }
        : slot.move.functionCode === "0BF" ? { ...damageMove, power: damageMove.power * (hitIndex + 1) }
        : parentalBond && hitIndex === 1 && slot.move.functionCode === "094"
          ? { ...damageMove, power: presentPower(draw(rng, trace, "present", 8)) } : damageMove;
      const rawDamage = hitIndex === 0 ? initialDamage : calculateDamage(side, battlers[side],
        battlers[actualTargetSide], hitMove, rng, trace, damageContext);
      if (hitIndex > 0) {
        const lastTrace = [...trace].reverse().find((entry) => entry.type === "damage");
        if (lastTrace !== undefined) damageTraces.push(lastTrace);
      }
      const presentationMultiplier = fixedDamageMove ? 1
        : (options.damageMultiplier ?? 1) * (options.helpingHandMultiplier ?? 1)
          * (fusionBoost ? 2 : 1) * flyingEffectiveness
          * (slot.move.functionCode === "144" && defender.volatile?.minimized === true ? 2 : 1);
      let hitDamage = rawDamage === 0 || presentationMultiplier === 0 ? 0 : Math.max(1, Math.floor(rawDamage * presentationMultiplier
        * (parentalBond && hitIndex === 1 ? 0.5 : 1)));
      if (slot.move.functionCode === "088" && options.switchingTarget === targetSide) hitDamage *= 2;
      const sashOnThisHit: boolean = !focusSash && heldItemIsActive(defender, effects.magicRoomTurns) && defender.heldItem === "FOCUSSASH"
        && hp === defender.stats.maxHp && hitDamage >= hp;
      const sturdyOnThisHit: boolean = !sturdy && defender.ability === "STURDY"
        && hp === defender.stats.maxHp && hitDamage >= hp;
      if (sashOnThisHit || sturdyOnThisHit || targetVolatile.endured && hitDamage >= hp) hitDamage = Math.max(0, hp - 1);
      if (slot.move.functionCode === "0E9") hitDamage = Math.min(hitDamage, Math.max(0, hp - 1));
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
        const attackers = record.attackers?.includes(hit.attackerId) === true
          ? record.attackers : [...(record.attackers ?? []), hit.attackerId];
        const currentVolatile = volatileOf(current);
        battlers[actualTargetSide] = withVolatile(current, { ...currentVolatile,
          bideDamage: currentVolatile.bideTurns > 0 ? currentVolatile.bideDamage + applied : currentVolatile.bideDamage,
          bideTargetId: currentVolatile.bideTurns > 0 ? battlers[side].id : currentVolatile.bideTargetId,
          retaliation: {
          ...record, attackers, last: hit,
          ...(resolvedMove.category === "Physical" ? { physical: hit }
            : resolvedMove.category === "Special" ? { special: hit } : {}),
        } });
      }
      events.push({ type: "damageApplied", source: side, target: actualTargetSide,
        amount: applied, hp, critical: hitTrace.critical,
        effectiveness: hitTrace.effectiveness * flyingEffectiveness });
      battlers[actualTargetSide] = { ...battlers[actualTargetSide], hp };
      if (applied > 0 && hitIndex === 0 && resistBerry !== null) {
        battlers[actualTargetSide] = consumeTrackedItem(battlers[actualTargetSide], resistBerry, effects);
        events.push({ type: "heldItemConsumed", side: actualTargetSide,
          item: resistBerry, effect: "weaken", hp });
        battlers[actualTargetSide] = applyCheekPouch(battlers[actualTargetSide], actualTargetSide, events);
        hp = battlers[actualTargetSide].hp;
      }
      if (sashOnThisHit) {
        battlers[actualTargetSide] = consumeTrackedItem(battlers[actualTargetSide], "FOCUSSASH", effects);
        events.push({ type: "heldItemConsumed", side: actualTargetSide,
          item: "FOCUSSASH", effect: "survive", hp });
      }
      if (sturdyOnThisHit) events.push({ type: "abilityActivated", side: actualTargetSide,
        ability: "STURDY", effect: "survive" });
      const impactBerry = battlers[actualTargetSide];
      if (applied > 0 && impactBerry.hp > 0 && heldItemIsActive(impactBerry, effects.magicRoomTurns)
        && slot.move.functionCode !== "0F4" && slot.move.functionCode !== "0F5") {
        if (impactBerry.heldItem === "ENIGMABERRY" && hitTrace.effectiveness > 1) {
          const amount = Math.min(Math.floor(impactBerry.stats.maxHp / 4), impactBerry.stats.maxHp - impactBerry.hp);
          if (amount > 0) {
            battlers[actualTargetSide] = consumeTrackedItem({ ...impactBerry, hp: impactBerry.hp + amount },
              "ENIGMABERRY", effects);
            events.push({ type: "itemActivated", side: actualTargetSide, item: "ENIGMABERRY",
              effect: "heal", amount, hp: impactBerry.hp + amount },
            { type: "heldItemConsumed", side: actualTargetSide, item: "ENIGMABERRY",
              effect: "heal", hp: impactBerry.hp + amount });
            battlers[actualTargetSide] = applyCheekPouch(battlers[actualTargetSide], actualTargetSide, events);
          }
        } else if ((impactBerry.heldItem === "JABOCABERRY" && resolvedMove.category === "Physical"
          || impactBerry.heldItem === "ROWAPBERRY" && resolvedMove.category === "Special")
          && battlers[side].hp > 0 && battlers[side].ability !== "MAGICGUARD") {
          const berry = impactBerry.heldItem;
          const amount = Math.min(battlers[side].hp, Math.floor(battlers[side].stats.maxHp / 8));
          if (amount > 0) {
            battlers[side] = { ...battlers[side], hp: battlers[side].hp - amount };
            battlers[actualTargetSide] = consumeTrackedItem(impactBerry, berry, effects);
            events.push({ type: "itemActivated", side, item: berry, effect: "damage", amount,
              hp: battlers[side].hp },
              { type: "heldItemConsumed", side: actualTargetSide, item: berry,
                effect: "eaten", hp: impactBerry.hp });
            if (battlers[side].hp === 0) events.push({ type: "fainted", side });
            battlers[actualTargetSide] = applyCheekPouch(battlers[actualTargetSide], actualTargetSide, events);
          }
        }
        hp = battlers[actualTargetSide].hp;
      }
      if (applied > 0 && battlers[actualTargetSide].hp > 0
        && slot.move.functionCode !== "0F4" && slot.move.functionCode !== "0F5") {
        const berry = resolveBattleBerryCheck(battlers[actualTargetSide], actualTargetSide,
          rng, trace, options.defenderBerriesBlocked ?? berriesBlockedBy([battlers[side]]),
          effects.nextPickupUse, effects.magicRoomTurns, true);
        battlers[actualTargetSide] = berry.battler;
        effects.nextPickupUse = berry.nextPickupUse;
        events.push(...berry.events);
        hp = berry.battler.hp;
      }
    }
    battlers[actualTargetSide] = { ...battlers[actualTargetSide], hp };
    if (damage > 0 && slot.move.functionCode === "11C" && hp > 0
      && defender.volatile?.roostOriginalTypes == null) {
      const current = battlers[actualTargetSide];
      const grounded = clearAirborneEffects(current, actualTargetSide);
      battlers[actualTargetSide] = withVolatile(grounded.battler, {
        ...volatileOf(grounded.battler), smackDown: true });
      events.push(...grounded.events,
        { type: "volatileApplied", source: side, target: actualTargetSide,
          effect: "smack-down", turns: null, move: slot.move.internalName });
    }
    if (slot.move.functionCode === "113" && damage > 0 && battlers[side].hp > 0) {
      releaseStockpile(side, battlers, events, effects);
    }
    if (slot.move.functionCode === "10A") {
      const screen = effects.sides[actualTargetSide];
      if (screen.reflectTurns > 0) events.push({ type: "battleEffectChanged", side: actualTargetSide,
        effect: "reflect", turns: 0 });
      if (screen.lightScreenTurns > 0) events.push({ type: "battleEffectChanged", side: actualTargetSide,
        effect: "light-screen", turns: 0 });
      effects.sides[actualTargetSide] = { ...screen, reflectTurns: 0, lightScreenTurns: 0 };
    }
    if (damage > 0 && slot.move.functionCode === "096" && battlers[side].heldItem !== null) {
      const berry = battlers[side].heldItem;
      battlers[side] = consumeTrackedItem(battlers[side], berry, effects);
      events.push({ type: "heldItemConsumed", side, item: berry, effect: "eaten", hp: battlers[side].hp });
    }
    if (slot.move.functionCode === "0F7" && battlers[side].heldItem !== null) {
      const thrown = battlers[side].heldItem;
      if (damage > 0 && battlers[actualTargetSide].hp > 0
        && (hasMoldBreaker(battlers[side]) || battlers[actualTargetSide].ability !== "SHIELDDUST")
        && !(heldItemIsActive(battlers[actualTargetSide], effects.magicRoomTurns)
          && battlers[actualTargetSide].heldItem === "COVERTCLOAK")) {
        if (isSupportedBerry(thrown)) {
          const activated = activateExternalBerry(battlers[actualTargetSide], actualTargetSide,
            thrown, rng, trace, effects.nextPickupUse);
          battlers[actualTargetSide] = activated.battler;
          events.push(...activated.events);
        } else if (thrown === "FLAMEORB" || thrown === "TOXICORB" || thrown === "POISONBARB" || thrown === "LIGHTBALL") {
          const functionCode = thrown === "FLAMEORB" ? "00A" as const
            : thrown === "LIGHTBALL" ? "007" as const
              : thrown === "TOXICORB" ? "006" as const : "005" as const;
          applyMoveEffect(side, actualTargetSide, { ...slot.move, functionCode, category: "Status" },
            battlers, rng, events, trace, effects, effectiveWeather);
        } else if (thrown === "KINGSROCK" || thrown === "RAZORFANG") {
          const target = battlers[actualTargetSide];
          if (target.ability !== "INNERFOCUS") {
            battlers[actualTargetSide] = withVolatile(target, { ...volatileOf(target), flinched: true });
            events.push({ type: "volatileApplied", source: side, target: actualTargetSide,
              effect: "flinch", turns: 1, move: slot.move.internalName });
          }
        } else if (thrown === "MENTALHERB") {
          const target = battlers[actualTargetSide];
          battlers[actualTargetSide] = withVolatile(target, { ...volatileOf(target),
            infatuated: false, tauntTurns: 0, encoreMove: null, encoreTurns: 0,
            disabledMove: null, disableTurns: 0 });
        } else if (thrown === "WHITEHERB") {
          const target = battlers[actualTargetSide];
          const stages = { ...target.stages };
          for (const stat of ["attack", "defense", "specialAttack", "specialDefense", "speed",
            "accuracy", "evasion"] as const) {
            if (stages[stat] >= 0) continue;
            const delta = -stages[stat];
            stages[stat] = 0;
            events.push({ type: "statStageChanged", source: actualTargetSide,
              target: actualTargetSide, stat, delta, stage: 0 });
          }
          battlers[actualTargetSide] = { ...target, stages };
        }
      }
      battlers[side] = consumeTrackedItem(battlers[side], thrown, effects);
      events.push({ type: "heldItemConsumed", side, item: thrown, effect: "eaten", hp: battlers[side].hp });
    }
    refreshNeutralizingGas();
    effectiveWeather = effectiveBattleWeather(effects.weather, Object.values(battlers), options.weatherSuppressed);
    if (damage > 0 && (slot.move.functionCode === "109" || slot.move.functionCode === "931")) {
      const actor = battlers[side];
      effects.scatteredCoins[actor.id] = Math.min(999999,
        (effects.scatteredCoins[actor.id] ?? 0) + 5 * actor.level);
    }
    if (slot.move.functionCode === "931") applySelfStatChanges(side,
      [{ stat: "specialAttack", delta: -1 }], battlers, events);
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
    if (damage > 0) damagedThisTurn.add(actualTargetSide);
    if (slot.move.functionCode === "0D2") {
      const user = battlers[side];
      const current = volatileOf(user);
      if (damage > 0 && user.hp > 0) {
        const turns = (current.outrageTurns > 0
          ? current.outrageTurns : 2 + draw(rng, trace, "additional-effect", 2)) - 1;
        const confusionTurns = turns === 0 && user.ability !== "OWNTEMPO"
          ? 2 + draw(rng, trace, "confusion-duration", 4) : current.confusionTurns;
        battlers[side] = withVolatile(user, { ...current, outrageTurns: turns, confusionTurns });
        if (turns === 0 && confusionTurns > current.confusionTurns) events.push({
          type: "volatileApplied", source: side, target: side, effect: "confusion",
          turns: confusionTurns, move: slot.move.internalName });
      } else if (current.outrageTurns > 0) {
        battlers[side] = withVolatile(user, { ...current, outrageTurns: 0 });
      }
    }
    if (damage > 0 && hp === 0 && defender.volatile?.grudge === true) {
      const attacker = battlers[side];
      battlers[side] = { ...attacker, moves: attacker.moves.map((candidate, index) =>
        index === action.moveIndex ? { ...candidate, pp: 0 } : candidate) };
      events.push({ type: "ppChanged", side, move: selectedSlot.move.internalName, pp: 0 });
    }
    if (damage > 0 && hp === 0 && defender.volatile?.destinyBond === true
      && battlers[side].hp > 0) {
      const attacker = battlers[side];
      battlers[side] = { ...attacker, hp: 0 };
      events.push({ type: "recoilDamage", side, move: slot.move.internalName,
        reason: "self-destruct", amount: attacker.hp, hp: 0 }, { type: "fainted", side });
    }
    if (damage > 0 && hp > 0 && battlers[side].hp > 0 && slot.move.functionCode === "0EC"
      && options.wildBattle === true && defender.level <= battlers[side].level
      && (defender.ability !== "SUCTIONCUPS" || hasMoldBreaker(battlers[side]))
      && defender.volatile?.ingrain !== true) {
      events.push({ type: "battleEscaped", side: actualTargetSide, move: slot.move.internalName });
      break;
    }
    if (damage > 0 && battlers[side].hp > 0
      && (slot.move.functionCode === "0EE" || slot.move.functionCode === "0EC")) {
      const pivotSide = slot.move.functionCode === "0EE" ? side : actualTargetSide;
      if ((slot.move.functionCode === "0EE" || hp > 0 && options.wildBattle !== true)
        && (slot.move.functionCode !== "0EC" || defender.volatile?.ingrain !== true
          && (defender.ability !== "SUCTIONCUPS" || hasMoldBreaker(battlers[side])))
        && options.attackerCanSwitch?.[pivotSide] === true) events.push({
        type: "forcedSwitchRequested", side: pivotSide, move: slot.move.internalName });
    }
    if (damage > 0 && hp > 0 && slot.move.functionCode === "0EF"
      && !battlers[actualTargetSide].types.includes("GHOST")) {
      const trapped = battlers[actualTargetSide];
      battlers[actualTargetSide] = withVolatile(trapped, { ...volatileOf(trapped),
        meanLookBy: battlers[side].id });
      events.push({ type: "volatileApplied", source: side, target: actualTargetSide,
        effect: "mean-look", turns: null, move: slot.move.internalName });
    }
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
    if (damage > 0 && battlers[actualTargetSide].hp > 0
      && (slot.move.functionCode === "07C" || slot.move.functionCode === "07D")) {
      const expected = slot.move.functionCode === "07C" ? "paralysis" : "sleep";
      const affected = battlers[actualTargetSide];
      if (affected.majorStatus?.kind === expected) {
        battlers[actualTargetSide] = { ...affected, majorStatus: null };
        events.push({ type: "statusCured", side: actualTargetSide, status: expected });
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
    if ((slot.move.functionCode === "0DD" || slot.move.functionCode === "0DE") && battlers[side].hp > 0) {
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
    if (hp > 0 && damage > 0 && (slot.move.functionCode === "0CF" || slot.move.functionCode === "0D0")) {
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
      : Math.min(100, (slot.move.functionCode === "014" ? 100 : slot.move.effectChance)
        * (battlers[side].ability === "SERENEGRACE" ? 2 : 1));
    if (hp > 0 && (slot.move.functionCode === "0BE" || parentalBond) && effectChance > 0) {
      for (let hit = 0; hit < landedHits && battlers[actualTargetSide].majorStatus === null; hit += 1) {
        if (draw(rng, trace, "additional-effect", 100) >= effectChance) continue;
        if (blocksAdditionalEffects(battlers[side], battlers[actualTargetSide], effects.magicRoomTurns)) {
          events.push({ type: "abilityActivated", side: actualTargetSide,
            ability: "SHIELDDUST", effect: "prevent-additional-effect" });
          break;
        }
        applyMoveEffect(side, actualTargetSide, slot.move, battlers, rng, events, trace, effects);
      }
    }
    if (hp > 0 && slot.move.functionCode !== "0BE" && slot.move.functionCode !== "0C7"
      && slot.move.functionCode !== "00B" && slot.move.functionCode !== "00E"
      && !parentalBond && effectChance > 0
      && draw(rng, trace, "additional-effect", 100) < effectChance) {
      if (blocksAdditionalEffects(battlers[side], battlers[actualTargetSide], effects.magicRoomTurns)) {
        events.push({ type: "abilityActivated", side: actualTargetSide, ability: "SHIELDDUST", effect: "prevent-additional-effect" });
      } else applyMoveEffect(side, actualTargetSide, slot.move, battlers, rng, events, trace, effects);
    }
    if (hp > 0 && damage > 0 && ["00B", "00E"].includes(slot.move.functionCode)
      && battlers[side].ability !== "SHEERFORCE") {
      for (const effect of ["status", "flinch"] as const) {
        if (draw(rng, trace, "additional-effect", 100) >= Math.min(100,
          10 * (battlers[side].ability === "SERENEGRACE" ? 2 : 1))) continue;
        if (blocksAdditionalEffects(battlers[side], battlers[actualTargetSide], effects.magicRoomTurns)) {
          events.push({ type: "abilityActivated", side: actualTargetSide,
            ability: "SHIELDDUST", effect: "prevent-additional-effect" });
          continue;
        }
        if (effect === "status") applyMoveEffect(side, actualTargetSide, slot.move,
          battlers, rng, events, trace, effects, effectiveWeather);
        else {
          const target = battlers[actualTargetSide];
          if (target.ability === "INNERFOCUS") continue;
          battlers[actualTargetSide] = withVolatile(target, { ...volatileOf(target), flinched: true });
          events.push({ type: "volatileApplied", source: side, target: actualTargetSide,
            effect: "flinch", turns: 1, move: slot.move.internalName });
        }
      }
    }
    if (hp > 0 && slot.move.functionCode === "009" && battlers[side].ability !== "SHEERFORCE"
      && !blocksAdditionalEffects(battlers[side], battlers[actualTargetSide], effects.magicRoomTurns)
      && draw(rng, trace, "additional-effect", 10) === 0) {
      const target = battlers[actualTargetSide];
      if (target.ability !== "INNERFOCUS") {
        battlers[actualTargetSide] = withVolatile(target, { ...volatileOf(target), flinched: true });
        events.push({ type: "volatileApplied", source: side, target: actualTargetSide,
          effect: "flinch", turns: 1, move: slot.move.internalName });
      }
    }
    if (hp > 0 && damage > 0 && (slot.move.functionCode === "0C7" || slot.move.functionCode === "078")
      && battlers[side].ability !== "SHEERFORCE"
      && !blocksAdditionalEffects(battlers[side], battlers[actualTargetSide], effects.magicRoomTurns)
      && draw(rng, trace, "additional-effect", 100) < effectChance) {
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
      && !stenchExcluded && !blocksAdditionalEffects(battlers[side], battlers[actualTargetSide], effects.magicRoomTurns)
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
      && abilityFlinch !== null && !blocksAdditionalEffects(battlers[side], battlers[actualTargetSide], effects.magicRoomTurns)
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
    if (damage > 0 && slot.move.functionCode === "0F4" && battlers[side].hp > 0
      && battlers[actualTargetSide].hp > 0 && isSupportedBerry(battlers[actualTargetSide].heldItem)) {
      if (battlers[actualTargetSide].ability === "STICKYHOLD" && !hasMoldBreaker(battlers[side])) {
        events.push({ type: "abilityActivated", side: actualTargetSide, ability: "STICKYHOLD", effect: "block-move" });
      } else {
        const berry = battlers[actualTargetSide].heldItem!;
        battlers[actualTargetSide] = removeHeldItem(battlers[actualTargetSide]);
        events.push({ type: "heldItemConsumed", side: actualTargetSide, item: berry, effect: "eaten", hp: battlers[actualTargetSide].hp });
        if (battlers[side].ability !== "KLUTZ" && volatileOf(battlers[side]).embargoTurns === 0) {
          const activated = activateExternalBerry(battlers[side], side, berry,
            rng, trace, effects.nextPickupUse);
          battlers[side] = activated.battler;
          events.push(...activated.events);
        }
      }
    }
    const incineratedItem = battlers[actualTargetSide].heldItem;
    if (damage > 0 && slot.move.functionCode === "0F5" && battlers[side].hp > 0
      && incineratedItem !== null
      && (isSupportedBerry(incineratedItem) || incineratedItem.endsWith("GEM"))) {
      const item = incineratedItem;
      battlers[actualTargetSide] = removeHeldItem(battlers[actualTargetSide]);
      events.push({ type: "heldItemConsumed", side: actualTargetSide, item, effect: "eaten",
        hp: battlers[actualTargetSide].hp });
    }
    if (damage > 0 && slot.move.functionCode === "0FA" && battlers[side].hp > 0
      && !["ROCKHEAD", "MAGICGUARD", "CABEZAHIELO"].includes(battlers[side].ability ?? "")
      && !(heldItemIsActive(battlers[side], effects.magicRoomTurns) && battlers[side].heldItem === "CASCOPROTECTOR")) {
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
        || heldItemIsActive(attacker, effects.magicRoomTurns) && attacker.heldItem === "SAFETYGOGGLES";
      if (!powderImmune) {
        const status = (["poison", "sleep", "paralysis"] as const)[draw(rng, trace, "ability", 3)]!;
        applyAbilityStatus(actualTargetSide, side, "EFFECTSPORE", status, battlers, rng, events, trace, effects);
      }
    }
    if (contact && defender.ability === "FLAMEBODY" && draw(rng, trace, "ability", 10) < 3) {
      applyAbilityStatus(actualTargetSide, side, "FLAMEBODY", "burn", battlers, rng, events, trace, effects);
    }
    if (contact && defender.ability === "POISONPOINT" && draw(rng, trace, "ability", 10) < 3) {
      applyAbilityStatus(actualTargetSide, side, "POISONPOINT", "poison", battlers, rng, events, trace, effects);
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
      applyAbilityStatus(actualTargetSide, side, "STATIC", "paralysis", battlers, rng, events, trace, effects);
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
      applyAbilityStatus(side, actualTargetSide, "POISONTOUCH", "poison", battlers, rng, events, trace, effects);
    }
    if (contact && battlers[side].ability === "BRUTALIDAD" && battlers[actualTargetSide].hp > 0
      && battlers[actualTargetSide].majorStatus === null
      && !typePreventsStatus(battlers[actualTargetSide], "hemorrhage") && draw(rng, trace, "ability", 10) < 5) {
      applyAbilityStatus(side, actualTargetSide, "BRUTALIDAD", "hemorrhage", battlers, rng, events, trace, effects);
    }
    if (contact && battlers[side].ability === "RELAMPAGUEO" && battlers[actualTargetSide].hp > 0
      && battlers[actualTargetSide].majorStatus === null
      && !typePreventsStatus(battlers[actualTargetSide], "paralysis")
      && draw(rng, trace, "ability", 10) < 3) {
      applyAbilityStatus(side, actualTargetSide, "RELAMPAGUEO", "paralysis", battlers, rng, events, trace, effects);
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
    if (damage > 0 && slot.move.flags?.includes("a") === true && heldItemIsActive(defender, effects.magicRoomTurns)
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
    if (slot.move.functionCode === "304" && battlers[side].hp > 0
      && battlers[side].ability !== "MAGICGUARD") {
      const current = battlers[side];
      const amount = Math.min(current.hp, Math.round(current.stats.maxHp / 2));
      battlers[side] = { ...current, hp: current.hp - amount };
      events.push({ type: "recoilDamage", side, move: slot.move.internalName,
        reason: "recoil", amount, hp: current.hp - amount });
      if (current.hp === amount) events.push({ type: "fainted", side });
    }
    if (slot.move.functionCode === "002" && damage > 0 && battlers[side].hp > 0
      && battlers[side].ability !== "MAGICGUARD") {
      const current = battlers[side];
      const amount = Math.min(current.hp, Math.max(1, Math.round(current.stats.maxHp / 4)));
      battlers[side] = { ...current, hp: current.hp - amount };
      events.push({ type: "recoilDamage", side, move: slot.move.internalName,
        reason: "recoil", amount, hp: current.hp - amount });
      if (current.hp - amount === 0) events.push({ type: "fainted", side });
    }
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
      && heldItemIsActive(battlers[side], effects.magicRoomTurns) && battlers[side].heldItem === "LIFEORB" && battlers[side].hp > 0
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
    if (damage > 0 && slot.move.functionCode === "0C2" && battlers[side].hp > 0) {
      battlers[side] = withVolatile(battlers[side], { ...volatileOf(battlers[side]), rechargeTurns: 1 });
    }
    if (damage > 0 && slot.move.functionCode === "0CD" && targetVolatile.protected) {
      battlers[actualTargetSide] = withVolatile(battlers[actualTargetSide], {
        ...volatileOf(battlers[actualTargetSide]), protected: false });
      events.push({ type: "volatileEnded", side: actualTargetSide, effect: "protect" });
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

  // A fainted/interrupted carrier must not leave its target suspended in a restored snapshot.
  for (const side of SIDES) {
    const current = battlers[side];
    const carrierId = current.volatile?.skyDropCarrierId;
    if (carrierId == null) continue;
    const carrier = SIDES.map((candidate) => battlers[candidate]).find((candidate) => candidate.id === carrierId);
    if (carrier !== undefined && carrier.hp > 0
      && carrier.volatile?.chargingTargetId === current.id) continue;
    battlers[side] = withVolatile(current, { ...volatileOf(current), skyDropCarrierId: null });
    events.push({ type: "volatileEnded", side, effect: "sky-drop" });
  }
  for (const side of SIDES) {
    const current = battlers[side];
    const targetId = current.volatile?.chargingTargetId;
    if (targetId == null) continue;
    const carried = SIDES.map((candidate) => battlers[candidate]).find((candidate) => candidate.id === targetId);
    if (carried !== undefined && carried.hp > 0 && carried.volatile?.skyDropCarrierId === current.id) continue;
    battlers[side] = withVolatile(current, { ...volatileOf(current),
      chargingMove: null, chargingCalledMove: null, chargingTargetId: null });
  }

  if (events.some((event) => event.type === "battleEscaped")) {
    events.push({ type: "turnEnded", turn: state.turn });
    return { state: { turn: state.turn + (options.endOfTurn === false ? 0 : 1),
      status: "finished", winner: null, battlers, effects }, events, trace };
  }
  checkReactiveBerries(order[order.length - 1] ?? "player");

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
    if (winner === null && !battleDraw) winner = applyResidualVolatile(battlers, events, effects);
    if (winner === null && !battleDraw) for (const side of SIDES) {
      const healed = resolveGrassyTerrainHealing(battlers[side], side, effects);
      battlers[side] = healed.battler;
      events.push(...healed.events);
    }
    if (battlers.player.hp === 0 && battlers.opponent.hp === 0) battleDraw = true;
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
