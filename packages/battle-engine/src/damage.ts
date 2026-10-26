import { typeEffectiveness } from "./type-chart.js";
import { preventsCriticalHit } from "./ability-protection.js";
import { effectiveMoveCategory, effectiveMoveType, hasHighCriticalRate, hasMoldBreaker, hasMoveFlag, isCuttingMove,
  isKickingMove, isRecklessBoostedMove, isSoundMove, isWindMove } from "./move-properties.js";
import { ordinaryWeather, weatherSpeedMultiplier } from "./ability-weather.js";
import { heldItemIsActive, ringTargetIsActive } from "./ability-item-control.js";
import { superEvioliteApplies, tablaEsquiApplies } from "./held-z-stat-items.js";
import { PLATE_TYPES, TYPE_BOOST_HELD_ITEM_TYPES } from "./held-item-types.js";
import { matchingHeldGem } from "./held-gems.js";
import { naturalGiftProfile } from "./natural-gift.js";
import { resistBerryApplies } from "./battle-berries.js";
import type { BattleAbility, BattleEffects, BattleMove, BattlerState, BattleSide, BattleTrace, ImplementedBattleAbility, RandomSource } from "./types.js";

/** Exact non-Normal type list named by Pokemon Z's Realeza branch; QMARKS is intentionally excluded. */
const REALEZA_TYPES = new Set([
  "FIRE", "BUG", "DARK", "DRAGON", "ELECTRIC", "FAIRY", "FIGHTING", "FLYING", "GHOST",
  "GRASS", "GROUND", "ICE", "POISON", "PSYCHIC", "ROCK", "STEEL", "WATER",
]);

/** Pokemon Z abilities whose only battle effect is a 1.5 offensive multiplier for one effective move type. */
const OFFENSIVE_TYPE_BOOSTS = {
  ALBINISMO: "ICE",
  DRAGONSMAW: "DRAGON",
  FLORACION: "GRASS",
  INFLAMABLE: "FIRE",
  PEDANTE: "PSYCHIC",
  STEELWORKER: "STEEL",
  TRANSPORTARROCA: "ROCK",
} as const;

/** Pokemon Z's one-third-HP offensive abilities, evaluated on the effective move type. */
const LOW_HP_TYPE_BOOSTS = {
  BLAZE: "FIRE",
  OVERGROW: "GRASS",
  SOBRECARGA: "ELECTRIC",
  SWARM: "BUG",
  TORRENT: "WATER",
} as const;

export interface BattleDamageContext {
  readonly reflect: boolean;
  readonly lightScreen: boolean;
  readonly luckyChant: boolean;
  readonly mudSport: boolean;
  readonly waterSport: boolean;
  readonly weather?: BattleEffects["weather"];
  readonly terrain?: BattleEffects["terrain"];
  readonly magicRoomTurns?: number;
  readonly gravityTurns?: number;
  readonly wonderRoomTurns?: number;
  readonly defenderBerriesBlocked?: boolean;
  readonly soulDewClause?: boolean;
  /** The defender already acted, or did not select a move, as required by Pokemon Z's Analytic check. */
  readonly defenderAlreadyMoved?: boolean;
  readonly turn?: number;
  readonly lastFaintedTurn?: number | null;
  readonly echoedVoiceCount?: number;
  /** PP remaining after the source move's cost was paid this turn. */
  readonly remainingPp?: number;
  /** Effective speeds at impact, including each side's field effects; supplied by the turn adapter. */
  readonly attackerEffectiveSpeed?: number;
  readonly defenderEffectiveSpeed?: number;
  /** Active, conscious partner abilities supplied by the positioned double-battle adapter. */
  readonly attackerPartnerAbility?: BattleAbility | null;
  readonly defenderPartnerAbility?: BattleAbility | null;
  /** Every active, conscious battler ability. Global auras are side-independent and do not stack. */
  readonly activeAbilities?: readonly BattleAbility[];
  /** Actual HP lost by the qualifying previous hit, supplied by the turn resolver. */
  readonly retaliationDamage?: number;
  readonly bideDamage?: number;
}

/** Source-faithful type multiplier shared by damage calculation and pre-damage abilities. */
export function effectiveTypeMultiplier(attacker: BattlerState, defender: BattlerState, move: BattleMove,
  weather?: BattleEffects["weather"], magicRoomTurns = 0, gravityTurns = 0): number {
  if (move.functionCode === "002") return 1;
  const moveType = effectiveMoveType(attacker, move, weather, magicRoomTurns).type;
  const ignoresDefenderAbility = hasMoldBreaker(attacker);
  const defenderTypes = (defender.volatile?.identified === true || attacker.ability === "SCRAPPY")
    && (moveType === "NORMAL" || moveType === "FIGHTING")
    ? defender.types.filter((type) => type !== "GHOST")
    : moveType === "PSYCHIC" && defender.volatile?.miracleEye === true
      ? defender.types.filter((type) => type !== "DARK") : defender.types;
  const grounded = gravityTurns > 0 || defender.volatile?.ingrain === true
    || defender.volatile?.smackDown === true || move.functionCode === "11C"
    || defender.heldItem === "IRONBALL" && heldItemIsActive(defender, magicRoomTurns);
  const effectiveDefenderTypes = grounded && moveType === "GROUND"
    ? defenderTypes.filter((type) => type !== "FLYING") : defenderTypes;
  const ringTarget = ringTargetIsActive(defender, magicRoomTurns);
  const typeEffect = effectiveDefenderTypes.length === 0 ? 1 : effectiveDefenderTypes.reduce((multiplier, type) => {
    const rawComponent = move.functionCode === "135" && type === "WATER"
      ? 2 : typeEffectiveness(moveType, [type]);
    const component = ringTarget && rawComponent === 0 ? 1 : rawComponent;
    return multiplier * (weather === "strong-winds" && type === "FLYING" && component > 1 ? 1 : component);
  }, 1);
  return moveType === "GROUND" && !grounded && !ringTarget
    && (!ignoresDefenderAbility && defender.ability === "LEVITATE"
      || (defender.volatile?.magnetRiseTurns ?? 0) > 0
      || heldItemIsActive(defender, magicRoomTurns) && defender.heldItem === "AIRBALLOON") ? 0 : typeEffect;
}

/** Pokemon Z effective weight in hectograms, shared by every weight-based move. */
export function effectiveWeight(battler: BattlerState, attacker?: BattlerState, magicRoomTurns = 0): number {
  let weight = battler.capture?.weight ?? 0;
  if (attacker === undefined || !hasMoldBreaker(attacker)) {
    if (battler.ability === "HEAVYMETAL") weight *= 2;
    if (battler.ability === "LIGHTMETAL") weight /= 2;
  }
  if (battler.heldItem === "FLOATSTONE" && heldItemIsActive(battler, magicRoomTurns)) weight /= 2;
  return Math.max(1, Math.floor(weight + (battler.volatile?.weightChange ?? 0)));
}

function stagedStat(value: number, stage: number): number {
  return stage >= 0
    ? Math.floor((value * (2 + stage)) / 2)
    : Math.floor((value * 2) / (2 - stage));
}

function draw(rng: RandomSource, trace: BattleTrace[], purpose: "critical" | "damage-variance", maxExclusive: number): number {
  const value = rng.nextInt(maxExclusive);
  trace.push({ type: "rng", purpose, maxExclusive, value });
  return value;
}

export function calculateDamage(
  side: BattleSide,
  attacker: BattlerState,
  defender: BattlerState,
  move: BattleMove,
  rng: RandomSource,
  trace: BattleTrace[],
  context: BattleDamageContext = { reflect: false, lightScreen: false, luckyChant: false, mudSport: false, waterSport: false },
): number {
  if (move.functionCode === "090" || move.functionCode === "1001")
    move = { ...move, category: effectiveMoveCategory(attacker, move) };
  const effectiveMove = effectiveMoveType(attacker, move, context.weather, context.magicRoomTurns);
  const attackerItemActive = heldItemIsActive(attacker, context.magicRoomTurns);
  const defenderItemActive = heldItemIsActive(defender, context.magicRoomTurns);
  const moveType = effectiveMove.type;
  const activeAbilities = new Set(context.activeAbilities
    ?? [attacker.ability, defender.ability].filter((ability): ability is BattleAbility => ability !== null));
  const ignoresDefenderAbility = hasMoldBreaker(attacker);
  const currentWeather = ordinaryWeather(context.weather);
  const effectiveness = effectiveTypeMultiplier(attacker, defender, move, context.weather,
    context.magicRoomTurns, context.gravityTurns);
    if (["06A", "06B", "06C", "06E", "070", "071", "072", "073", "0D4", "0E1", "1002"].includes(move.functionCode)) {
      const fixed = move.functionCode === "0D4" ? (context.bideDamage ?? 0) * 2
        : move.functionCode === "0E1" ? attacker.hp
        : move.functionCode === "06A" ? 20 : move.functionCode === "06B" ? 40
      : move.functionCode === "06C" ? Math.max(1, Math.floor(defender.hp / 2))
        : move.functionCode === "06E" ? Math.max(0, defender.hp - attacker.hp)
          : move.functionCode === "071" || move.functionCode === "072" ? (context.retaliationDamage ?? 0) * 2
            : move.functionCode === "073" ? Math.floor((context.retaliationDamage ?? 0) * 1.5)
          : defender.stats.maxHp;
    const result = effectiveness === 0 ? 0 : fixed;
    trace.push({ type: "damage", side, move: move.internalName, attack: 0, defense: 0,
      baseDamage: result, critical: false, variance: 100, stab: 1, effectiveness,
      statusModifier: 1, abilityModifier: null, abilityModifiers: [], result });
    return result;
  }
  if (move.functionCode === "06F") {
    const variance = 50 + draw(rng, trace, "damage-variance", 101);
    const result = effectiveness === 0 ? 0 : Math.max(1, Math.floor((attacker.level * variance) / 100));
    trace.push({ type: "damage", side, move: move.internalName, attack: 0, defense: 0, baseDamage: result,
      critical: false, variance, stab: 1, effectiveness, statusModifier: 1, abilityModifier: null,
      abilityModifiers: [], result });
    return result;
  }
  if (move.functionCode === "06D") {
    const result = effectiveness === 0 ? 0 : attacker.level;
    trace.push({ type: "damage", side, move: move.internalName, attack: 0, defense: 0, baseDamage: result,
      critical: false, variance: 100, stab: 1, effectiveness, statusModifier: 1, abilityModifier: null,
      abilityModifiers: [], result });
    return result;
  }
  const attackKey = move.functionCode === "175" ? "defense"
    : move.category === "Physical" ? "attack" : "specialAttack";
  const attackOwner = move.functionCode === "121" ? defender : attacker;
  const usesPhysicalDefense = move.category === "Physical" || (move.functionCode as string) === "122";
  const defenseKey = usesPhysicalDefense ? "defense" : "specialDefense";
  const abilityModifiers: { ability: ImplementedBattleAbility; multiplier: number }[] = [];
  const recordAbilityModifier = (ability: ImplementedBattleAbility, multiplier: number): void => {
    abilityModifiers.push({ ability, multiplier });
  };
  const criticalStage = Math.min(4,
    (defender.majorStatus?.kind === "hemorrhage" ? 2 : 0)
    + (attacker.volatile?.focusEnergy ?? 0)
    + (hasHighCriticalRate(move) ? 1 : 0)
    + (attackerItemActive && attacker.heldItem === "SCOPELENS" ? 1 : 0)
    + (attackerItemActive && attacker.heldItem === "RAZORCLAW" ? 1 : 0)
    + (attackerItemActive && attacker.heldItem === "ARMAZONDEFAUCES"
      && hasMoveFlag(move, "i") ? 1 : 0)
    + (attackerItemActive && attacker.heldItem === "STICK"
      && (attacker.species === "FARFETCHD" || attacker.species === "SIRFETCHD") ? 2 : 0)
    + (attackerItemActive && attacker.heldItem === "LUCKYPUNCH"
      && attacker.species === "CHANSEY" ? 2 : 0)
    + (attacker.ability === "SUPERLUCK" ? 1 : 0));
  const critical = !ignoresDefenderAbility && (preventsCriticalHit(defender)
    || defenderItemActive && defender.heldItem === "ANTICRITICO") ? false
    : !ignoresDefenderAbility && attacker.ability === "MERCILESS" && defender.majorStatus?.kind === "poison" ? true
      : context.luckyChant ? false
        : move.functionCode === "0A0" || move.functionCode === "942" ? true
        : draw(rng, trace, "critical", [16, 8, 2, 1, 1][criticalStage] ?? 16) === 0;
  const attackStage = defender.ability === "UNAWARE" && !ignoresDefenderAbility ? 0
    : critical && attackOwner.stages[attackKey] < 0 ? 0 : attackOwner.stages[attackKey];
  const defenseStage = attacker.ability === "UNAWARE" || move.functionCode === "0A9" ? 0
    : critical && defender.stages[defenseKey] > 0 ? 0 : defender.stages[defenseKey];
  const stagedAttack = stagedStat(attackOwner.stats[attackKey], attackStage);
  let attack = stagedAttack;
  if (attacker.ability === "GUTS" && attacker.majorStatus !== null && move.category === "Physical") attack = Math.round(attack * 1.5);
  if (attacker.ability === "HUSTLE" && move.category === "Physical") attack = Math.round(attack * 1.5);
  if ((attacker.ability === "HUGEPOWER" || attacker.ability === "PUREPOWER") && move.category === "Physical") attack = Math.round(attack * 2);
  if (attacker.ability === "PODERSABIO" && move.category === "Special") {
    attack = Math.round(attack * 1.5);
    recordAbilityModifier("PODERSABIO", 1.5);
  }
  if (attackerItemActive && (attacker.heldItem === "CHOICEBAND" && move.category === "Physical"
    || attacker.heldItem === "CHOICESPECS" && move.category === "Special")) {
    attack = Math.round(attack * 1.5);
  }
  if (attackerItemActive && attacker.heldItem === "LAGGINGTAIL"
    && ["CUBONE", "MAROWAK", "MAROLIER"].includes(attacker.species)
    && move.category === "Physical") attack = Math.round(attack * 2);
  if (attackerItemActive && attacker.heldItem === "DEEPSEATOOTH"
    && attacker.species === "CLAMPERL" && move.category === "Special") attack = Math.round(attack * 2);
  if (attackerItemActive && attacker.heldItem === "LIGHTBALL") {
    if (attacker.species === "PIKACHU") attack = Math.round(attack * 1.75);
    if (attacker.species === "RAICHU") attack = Math.round(attack * 1.5);
  }
  if (attackerItemActive && attacker.heldItem === "SOULDEW"
    && (attacker.species === "LATIAS" || attacker.species === "LATIOS")
    && move.category === "Special" && context.soulDewClause !== true)
    attack = Math.round(attack * 1.5);
  if (attacker.ability === "SLOWSTART" && move.category === "Physical"
    && (attacker.volatile?.activeTurns ?? 0) <= 5) {
    attack = Math.max(1, Math.round(attack * 0.5));
    recordAbilityModifier("SLOWSTART", 0.5);
  }
  if (attacker.ability === "SILVANO" && move.category === "Physical" && context.terrain === "grassy") {
    attack = Math.max(1, Math.round(attack * 1.3));
    recordAbilityModifier("SILVANO", 1.3);
  }
  const lowHpAbility = attacker.ability !== null && attacker.ability in LOW_HP_TYPE_BOOSTS
    ? attacker.ability as keyof typeof LOW_HP_TYPE_BOOSTS : null;
  if (lowHpAbility !== null && LOW_HP_TYPE_BOOSTS[lowHpAbility] === moveType
    && attacker.hp <= Math.floor(attacker.stats.maxHp / 3)) {
    attack = Math.round(attack * 1.5);
    recordAbilityModifier(lowHpAbility, 1.5);
  }
  if (attacker.ability === "ACOMETIDA" && move.category === "Physical" && (attacker.volatile?.activeTurns ?? 0) === 0) attack = Math.round(attack * 1.2);
  if (attacker.ability === "DEFEATIST" && attacker.hp <= Math.floor(attacker.stats.maxHp / 2)) {
    attack = Math.round(attack * 0.5);
    recordAbilityModifier("DEFEATIST", 0.5);
  }
  if ((attacker.ability === "PLUS" || attacker.ability === "MINUS") && move.category === "Special"
    && (context.attackerPartnerAbility === "PLUS" || context.attackerPartnerAbility === "MINUS")) {
    attack = Math.round(attack * 1.5);
    recordAbilityModifier(attacker.ability === "PLUS" ? "PLUS" : "MINUS", 1.5);
  }
  if (currentWeather === "sun" && move.category === "Physical"
    && (attacker.ability === "FLOWERGIFT" || context.attackerPartnerAbility === "FLOWERGIFT")) {
    attack = Math.round(attack * 1.5);
    recordAbilityModifier("FLOWERGIFT", 1.5);
  }
  const roomDefenseKey = (context.wonderRoomTurns ?? 0) > 0
    ? defenseKey === "defense" ? "specialDefense" : "defense" : defenseKey;
  let defense = Math.max(1, stagedStat(defender.stats[roomDefenseKey], defenseStage));
  if (currentWeather === "sand" && move.category === "Special" && !usesPhysicalDefense
    && defender.types.includes("ROCK")) defense = Math.round(defense * 1.5);
  if (currentWeather === "hail" && move.category === "Physical" && defender.types.includes("ICE")) defense = Math.round(defense * 1.5);
  if (!ignoresDefenderAbility && defender.ability === "MARVELSCALE"
    && defender.majorStatus !== null && move.category === "Physical") {
    defense = Math.max(1, Math.round(defense * 1.5));
    recordAbilityModifier("MARVELSCALE", 2 / 3);
  }
  if (!ignoresDefenderAbility && defender.ability === "ICESCALES" && move.category === "Special") {
    defense = Math.max(1, Math.round(defense * 1.5));
    recordAbilityModifier("ICESCALES", 2 / 3);
  }
  if (!ignoresDefenderAbility && currentWeather === "sun" && move.category === "Special"
    && (defender.ability === "FLOWERGIFT" || context.defenderPartnerAbility === "FLOWERGIFT")) {
    defense = Math.max(1, Math.round(defense * 1.5));
    recordAbilityModifier("FLOWERGIFT", 2 / 3);
  }
  if (defenderItemActive && defender.heldItem === "ASSAULTVEST" && move.category === "Special") defense = Math.max(1, Math.round(defense * 1.5));
  if (defenderItemActive && defender.heldItem === "CORAZAASALTO" && move.category === "Special")
    defense = Math.max(1, Math.round(defense * 1.4));
  if (defenderItemActive && defender.heldItem === "IRONBALL" && move.category === "Physical")
    defense = Math.max(1, Math.round(defense * 1.25));
  if (defenderItemActive && defender.heldItem === "CLEARAMULET")
    defense = Math.max(1, Math.round(defense * 1.1));
  if (defenderItemActive && defender.heldItem === "DEEPSEASCALE"
    && defender.species === "CLAMPERL" && move.category === "Physical")
    defense = Math.max(1, Math.round(defense * 2));
  if (defenderItemActive && defender.heldItem === "METALPOWDER"
    && defender.species === "DITTO" && defender.transformOriginal === undefined)
    defense = Math.max(1, Math.round(defense * 1.5));
  if (defenderItemActive && defender.heldItem === "SOULDEW"
    && (defender.species === "LATIAS" || defender.species === "LATIOS")
    && move.category === "Special" && context.soulDewClause !== true)
    defense = Math.max(1, Math.round(defense * 1.5));
  if (defenderItemActive && defender.heldItem === "EVIOLITE" && defender.canEvolve === true) defense = Math.max(1, Math.round(defense * 1.5));
  if (superEvioliteApplies(defender, context.magicRoomTurns)) defense = Math.max(1, Math.round(defense * 1.5));
  const targetWeight = effectiveWeight(defender, attacker, context.magicRoomTurns);
  const flailRatio = Math.floor((48 * attacker.hp) / attacker.stats.maxHp);
  let power = move.functionCode === "098"
    ? flailRatio < 2 ? 200 : flailRatio < 5 ? 150 : flailRatio < 10 ? 100
      : flailRatio < 17 ? 80 : flailRatio < 33 ? 40 : 20
    : move.functionCode !== "09A" ? move.power
    : targetWeight >= 2_000 ? 120 : targetWeight >= 1_000 ? 100 : targetWeight >= 500 ? 80
      : targetWeight >= 250 ? 60 : targetWeight >= 100 ? 40 : 20;
  if (move.functionCode === "09B") {
    const ratio = Math.floor(effectiveWeight(attacker, undefined, context.magicRoomTurns) / targetWeight);
    power = ratio >= 5 ? 120 : ratio >= 4 ? 100 : ratio >= 3 ? 80 : ratio >= 2 ? 60 : 40;
  }
  if (move.functionCode === "089") power = Math.max(1, Math.floor((attacker.happiness ?? 0) * 2 / 5));
  if (move.functionCode === "08A") power = Math.max(1, Math.floor((255 - (attacker.happiness ?? 0)) * 2 / 5));
  if (move.functionCode === "08B") power = Math.max(1, Math.floor(150 * attacker.hp / attacker.stats.maxHp));
  if (move.functionCode === "08C") power = Math.max(1, Math.floor(120 * defender.hp / defender.stats.maxHp));
  if (move.functionCode === "090") power = 70;
  if (move.functionCode === "096") power = naturalGiftProfile(attacker.heldItem)?.power ?? 1;
  if (move.functionCode === "097") power = [200, 80, 60, 50, 40][Math.min(4, context.remainingPp ?? 4)]!;
  if (move.functionCode === "099") {
    const attackerSpeed = Math.max(1, context.attackerEffectiveSpeed
      ?? stagedStat(attacker.stats.speed, attacker.stages.speed));
    const defenderSpeed = Math.max(1, context.defenderEffectiveSpeed
      ?? stagedStat(defender.stats.speed, defender.stages.speed));
    const ratio = Math.floor(attackerSpeed / defenderSpeed);
    power = ratio >= 4 ? 150 : ratio >= 3 ? 120 : ratio >= 2 ? 80 : 60;
  }
  const positiveStages = (battler: BattlerState): number => Object.values(battler.stages)
    .reduce((sum, stage) => sum + Math.max(0, stage), 0);
  if (move.functionCode === "08E") power = 20 * (1 + positiveStages(attacker));
  if (move.functionCode === "08F") power = Math.min(200, 20 * (3 + positiveStages(defender)));
  if (move.functionCode === "084" && context.defenderAlreadyMoved) power *= 2;
  if (move.functionCode === "085" && context.turn !== undefined
    && context.lastFaintedTurn === context.turn - 1) power *= 2;
  if (move.functionCode === "092") power *= Math.max(1, Math.min(5, context.echoedVoiceCount ?? 1));
  if (move.functionCode === "087" && context.weather !== null && context.weather !== undefined) power *= 2;
  if (move.functionCode === "08D") {
    const speed = (battler: BattlerState): number => {
      let value = stagedStat(battler.stats.speed, battler.stages.speed);
      if (battler.ability === "QUICKFEET" && battler.majorStatus !== null) value = Math.max(1, Math.round(value * 1.5));
      else if (battler.majorStatus?.kind === "paralysis") value = Math.max(1, Math.round(value / 4));
      value *= weatherSpeedMultiplier(battler, context.weather);
      return Math.max(1, value);
    };
    power = Math.max(1, Math.min(150, Math.floor((25 * speed(defender)) / speed(attacker))));
  }
  if (move.functionCode === "07C" && defender.majorStatus?.kind === "paralysis"
    || move.functionCode === "07D" && defender.majorStatus?.kind === "sleep"
    || move.functionCode === "07E" && (attacker.majorStatus?.kind === "poison"
      || attacker.majorStatus?.kind === "burn" || attacker.majorStatus?.kind === "paralysis")
    || move.functionCode === "07F" && defender.majorStatus !== null
    || move.functionCode === "080" && defender.hp <= Math.floor(defender.stats.maxHp / 2)) power *= 2;
  if (move.functionCode === "07B" && defender.majorStatus?.kind === "poison") power *= 2;
  if (move.functionCode === "091") power *= 2 ** Math.max(0, (attacker.volatile?.furyCutterCount ?? 1) - 1);
  if (move.functionCode === "0D3") power *= 2 ** Math.max(0, 4 - (attacker.volatile?.rolloutTurns ?? 4));
  if (move.functionCode === "086" && attacker.heldItem === null) power *= 2;
  if (move.functionCode === "0F0" && defender.heldItem !== null) power = Math.floor(power * 1.5);
  const baseDamage = Math.floor(Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * power * attack) / defense) / 50) + 2;
  const variance = 85 + draw(rng, trace, "damage-variance", 16);
  const stab = move.functionCode !== "002" && attacker.types.includes(moveType) ? 1.5 : 1;
  let result = baseDamage;
  if (critical) result = Math.round(result * 1.5);
  result = Math.floor((result * variance) / 100);
  result = Math.round(result * stab);
  result = Math.round(result * effectiveness);
  let statusModifier = 1;
  if (attacker.ability !== "GUTS") {
    if (attacker.majorStatus?.kind === "burn" && move.category === "Physical"
      && move.functionCode !== "07E") statusModifier *= 0.5;
    if (attacker.majorStatus?.kind === "frozen" && move.category === "Special"
      && move.functionCode !== "07E") statusModifier *= 0.5;
  }
  if (defender.majorStatus?.kind === "caduco" && defender.hp <= Math.floor(defender.stats.maxHp / 2)) statusModifier *= 1.5;
  if (attackerItemActive && attacker.heldItem === "MUSCLEBAND" && move.category === "Physical") statusModifier *= 1.1;
  if (attackerItemActive && attacker.heldItem === "WISEGLASSES" && move.category === "Special") statusModifier *= 1.1;
  if (attackerItemActive && attacker.heldItem === "EXPERTBELT" && effectiveness > 1) statusModifier *= 1.2;
  if (attackerItemActive && attacker.heldItem === "LIFEORB" && effectiveness > 0) statusModifier *= 1.3;
  if (attackerItemActive && attacker.heldItem === "ARMAZONDEFAUCES"
    && hasMoveFlag(move, "i")) statusModifier *= 1.2;
  if (attackerItemActive && attacker.heldItem === "CANONDEMANO"
    && hasMoveFlag(move, "m")) statusModifier *= 1.3;
  if (attackerItemActive && attacker.heldItem === "FUELLENEUMATICO"
    && isWindMove(move)) statusModifier *= 1.5;
  if (attackerItemActive && attacker.heldItem === "ESPADAVALIENTE"
    && isCuttingMove(move)) statusModifier *= attacker.species === "KRICKETUNE" ? 1.5 : 1.3;
  if (attackerItemActive && attacker.heldItem === "MASCARACRUEL"
    && defender.majorStatus !== null && defender.majorStatus.kind !== "caduco") statusModifier *= 1.3;
  if (attackerItemActive && attacker.heldItem === "ANILLODESANGRE" && critical) statusModifier *= 1.4;
  if (attackerItemActive && (
    attacker.heldItem === "ADAMANTORB" && attacker.species === "DIALGA"
      && (moveType === "DRAGON" || moveType === "STEEL")
    || attacker.heldItem === "LUSTROUSORB" && attacker.species === "PALKIA"
      && (moveType === "DRAGON" || moveType === "WATER")
    || attacker.heldItem === "GRISEOUSORB" && attacker.species === "GIRATINA"
      && (moveType === "DRAGON" || moveType === "GHOST"))) statusModifier *= 1.2;
  if (superEvioliteApplies(attacker, context.magicRoomTurns)) statusModifier *= 1.5;
  if (tablaEsquiApplies(attacker, context.magicRoomTurns)) statusModifier *= 1.3;
  if (attackerItemActive && attacker.heldItem !== null && PLATE_TYPES[attacker.heldItem] === moveType) {
    statusModifier *= 1.25;
  }
  if (attackerItemActive && attacker.heldItem !== null
    && TYPE_BOOST_HELD_ITEM_TYPES[attacker.heldItem] === moveType) statusModifier *= 1.2;
  if (!ignoresDefenderAbility && defender.ability === "DRYSKIN" && moveType === "FIRE") statusModifier *= 1.25;
  if (!ignoresDefenderAbility && defender.ability === "HEATPROOF" && moveType === "FIRE") statusModifier *= 0.5;
  if (context.reflect && move.category === "Physical" && !critical) statusModifier *= 0.5;
  if (context.lightScreen && move.category === "Special" && !critical) statusModifier *= 0.5;
  if (context.mudSport && moveType === "ELECTRIC") statusModifier /= 3;
  if (context.waterSport && moveType === "FIRE") statusModifier /= 3;
  const grounded = (battler: BattlerState): boolean => (context.gravityTurns ?? 0) > 0
    || battler.volatile?.ingrain === true || battler.volatile?.smackDown === true
    || battler.heldItem === "IRONBALL" && heldItemIsActive(battler, context.magicRoomTurns)
    || !battler.types.includes("FLYING") && battler.ability !== "LEVITATE"
      && (battler.volatile?.magnetRiseTurns ?? 0) === 0
      && (battler.volatile?.telekinesisTurns ?? 0) === 0
      && !(heldItemIsActive(battler, context.magicRoomTurns) && battler.heldItem === "AIRBALLOON");
  if (context.terrain === "electric" && moveType === "ELECTRIC" && grounded(attacker)) statusModifier *= 1.5;
  if (context.terrain === "grassy" && moveType === "GRASS" && grounded(attacker)) statusModifier *= 1.5;
  if (context.terrain === "psychic" && moveType === "PSYCHIC" && grounded(attacker)) statusModifier *= 1.5;
  if (context.terrain === "misty" && moveType === "DRAGON" && grounded(defender)) statusModifier *= 0.5;
  if (currentWeather === "sun" && moveType === "FIRE" || currentWeather === "rain" && moveType === "WATER") statusModifier *= 1.5;
  if (currentWeather === "sun" && moveType === "WATER" || currentWeather === "rain" && moveType === "FIRE") statusModifier *= 0.5;
  if (matchingHeldGem(attacker, moveType, move.functionCode, context.magicRoomTurns) !== null)
    statusModifier *= 1.3;
  if (!context.defenderBerriesBlocked && defenderItemActive
    && resistBerryApplies(defender.heldItem, moveType, effectiveness)) statusModifier *= 0.5;
  const attackerGender = attacker.appearance?.gender;
  const defenderGender = defender.appearance?.gender;
  const addAbilityModifier = (ability: ImplementedBattleAbility, multiplier: number): void => {
    recordAbilityModifier(ability, multiplier);
    statusModifier *= multiplier;
  };
  const typeBoostAbility = attacker.ability !== null && attacker.ability in OFFENSIVE_TYPE_BOOSTS
    ? attacker.ability as keyof typeof OFFENSIVE_TYPE_BOOSTS : null;
  if (typeBoostAbility !== null && moveType === OFFENSIVE_TYPE_BOOSTS[typeBoostAbility]) {
    addAbilityModifier(typeBoostAbility, 1.5);
  }
  if (attacker.ability === "FLAREBOOST" && attacker.majorStatus?.kind === "burn"
    && move.category === "Special") addAbilityModifier("FLAREBOOST", 1.5);
  if (attacker.ability === "TOXICBOOST" && attacker.majorStatus?.kind === "poison"
    && move.category === "Physical") addAbilityModifier("TOXICBOOST", 1.5);
  if (attacker.ability === "ANALYTIC" && context.defenderAlreadyMoved === true) addAbilityModifier("ANALYTIC", 1.3);
  if (attacker.ability === "CAMORRISTA" && isKickingMove(move)) addAbilityModifier("CAMORRISTA", 1.2);
  if (attacker.ability === "CORTANTE" && isCuttingMove(move)) addAbilityModifier("CORTANTE", 1.5);
  if (attacker.ability === "PUNKROCK" && isSoundMove(move)) addAbilityModifier("PUNKROCK", 1.3);
  if (attacker.ability === "REALEZA" && REALEZA_TYPES.has(moveType)) addAbilityModifier("REALEZA", 1.5);
  const auraAbility = moveType === "DARK" ? "DARKAURA"
    : moveType === "FAIRY" ? "FAIRYAURA" : moveType === "ELECTRIC" ? "AURADORADA" : null;
  if (auraAbility !== null && activeAbilities.has(auraAbility)) {
    addAbilityModifier(activeAbilities.has("AURABREAK") ? "AURABREAK" : auraAbility,
      activeAbilities.has("AURABREAK") ? 2 / 3 : 4 / 3);
  }
  if (attacker.ability === "WATERBUBBLE" && moveType === "WATER") addAbilityModifier("WATERBUBBLE", 2);
  if (attacker.ability === "SHEERFORCE" && move.effectChance > 0
    && !["150", "912"].includes(move.functionCode)) addAbilityModifier("SHEERFORCE", 1.3);
  if (attacker.ability === "RECKLESS" && isRecklessBoostedMove(move)) addAbilityModifier("RECKLESS", 1.2);
  if (attacker.ability === "TINTEDLENS" && effectiveness < 1) addAbilityModifier("TINTEDLENS", 2);
  if (attacker.ability === "RIVALRY"
    && (attackerGender === "male" || attackerGender === "female")
    && (defenderGender === "male" || defenderGender === "female")) {
    addAbilityModifier("RIVALRY", attackerGender === defenderGender ? 1.25 : 1);
  }
  if (attacker.ability === "TECHNICIAN" && power <= 60 && move.id > 0) addAbilityModifier("TECHNICIAN", 1.5);
  if (attacker.ability === "IRONFIST" && hasMoveFlag(move, "j")) addAbilityModifier("IRONFIST", 1.2);
  if (attackerItemActive && attacker.heldItem === "PUNCHINGGLOVE" && hasMoveFlag(move, "j")) {
    statusModifier *= 1.15;
  }
  if (attacker.ability === "MEGALAUNCHER" && hasMoveFlag(move, "m")) addAbilityModifier("MEGALAUNCHER", 1.5);
  if (attacker.ability === "NEUROFORCE" && effectiveness > 1) addAbilityModifier("NEUROFORCE", 1.25);
  if (attacker.ability === "SOLARPOWER" && currentWeather === "sun" && move.category === "Special") addAbilityModifier("SOLARPOWER", 1.5);
  if (attacker.ability === "SANDFORCE" && currentWeather === "sand"
    && ["ROCK", "GROUND", "STEEL"].includes(moveType)) addAbilityModifier("SANDFORCE", 1.3);
  if (attacker.ability === "PODERGELIDO" && currentWeather === "hail" && moveType === "ICE") {
    addAbilityModifier("PODERGELIDO", 1.5);
  }
  if (attacker.ability === "STRONGJAW" && hasMoveFlag(move, "i")) addAbilityModifier("STRONGJAW", 1.5);
  if (attacker.ability === "TOUGHCLAWS" && hasMoveFlag(move, "a")) addAbilityModifier("TOUGHCLAWS", 4 / 3);
  if (attacker.ability === "ADAPTABILITY" && attacker.types.includes(moveType)) {
    addAbilityModifier("ADAPTABILITY", 4 / 3);
  }
  if (effectiveMove.abilityBoost !== 1 && attacker.ability !== null) {
    addAbilityModifier(attacker.ability as ImplementedBattleAbility, effectiveMove.abilityBoost);
  }
  if (attacker.ability === "SNIPER" && critical) addAbilityModifier("SNIPER", 1.5);
  if (attacker.ability === "FLASHFIRE" && attacker.volatile?.flashFire === true && moveType === "FIRE") {
    addAbilityModifier("FLASHFIRE", 1.5);
  }
  if (!ignoresDefenderAbility && defender.ability === "THICKFAT" && (moveType === "FIRE" || moveType === "ICE")) {
    addAbilityModifier("THICKFAT", 0.5);
  }
  if (!ignoresDefenderAbility && defender.ability === "FURCOAT"
    && (move.category === "Physical" || (move.functionCode as string) === "122")) addAbilityModifier("FURCOAT", 0.5);
  if (!ignoresDefenderAbility && defender.ability === "WATERBUBBLE" && moveType === "FIRE") {
    addAbilityModifier("WATERBUBBLE", 0.5);
  }
  if (!ignoresDefenderAbility && defender.ability === "FLUFFY") {
    if (moveType === "FIRE") addAbilityModifier("FLUFFY", 2);
    else if (hasMoveFlag(move, "a")) addAbilityModifier("FLUFFY", 0.5);
  }
  if (!ignoresDefenderAbility && defender.ability === "PUNKROCK" && isSoundMove(move)) {
    addAbilityModifier("PUNKROCK", 0.5);
  }
  if (!ignoresDefenderAbility && defender.ability === "PURIFYINGSALT" && moveType === "GHOST") {
    addAbilityModifier("PURIFYINGSALT", 0.5);
  }
  if (!ignoresDefenderAbility && defender.ability === "CANASTO"
    && (moveType === "FLYING" || moveType === "ROCK")) addAbilityModifier("CANASTO", 0.3);
  if (!ignoresDefenderAbility && (defender.ability === "FILTER" || defender.ability === "SOLIDROCK") && effectiveness > 1) {
    addAbilityModifier(defender.ability === "FILTER" ? "FILTER" : "SOLIDROCK", 0.75);
  }
  if (!ignoresDefenderAbility && context.defenderPartnerAbility === "FRIENDGUARD") {
    addAbilityModifier("FRIENDGUARD", 0.75);
  }
  if (attackerItemActive && attacker.heldItem === "METRONOME") {
    statusModifier *= 1 + 0.2 * Math.min(5, attacker.volatile?.metronomeCount ?? 0);
  }
  if (!ignoresDefenderAbility && defender.ability === "MULTISCALE" && defender.hp === defender.stats.maxHp) {
    addAbilityModifier("MULTISCALE", 0.5);
  }
  const abilityModifier = abilityModifiers[0] ?? null;
  result = Math.round(result * statusModifier);
  if (effectiveness !== 0) result = Math.max(1, result);

  trace.push({ type: "damage", side, move: move.internalName, attack, defense, baseDamage, critical, variance, stab, effectiveness, statusModifier,
    abilityModifier, abilityModifiers, result });
  return result;
}
