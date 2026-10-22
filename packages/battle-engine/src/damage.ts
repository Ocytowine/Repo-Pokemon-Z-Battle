import { typeEffectiveness } from "./type-chart.js";
import { preventsCriticalHit } from "./ability-protection.js";
import { effectiveMoveType, hasHighCriticalRate, hasMoldBreaker, hasMoveFlag, isCuttingMove,
  isKickingMove, isRecklessBoostedMove, isSoundMove } from "./move-properties.js";
import { ordinaryWeather, weatherSpeedMultiplier } from "./ability-weather.js";
import { heldItemIsActive } from "./ability-item-control.js";
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

export interface BattleDamageContext {
  readonly reflect: boolean;
  readonly lightScreen: boolean;
  readonly luckyChant: boolean;
  readonly mudSport: boolean;
  readonly waterSport: boolean;
  readonly weather?: BattleEffects["weather"];
  readonly terrain?: BattleEffects["terrain"];
  readonly defenderBerriesBlocked?: boolean;
  /** The defender already acted, or did not select a move, as required by Pokemon Z's Analytic check. */
  readonly defenderAlreadyMoved?: boolean;
  /** Active, conscious partner abilities supplied by the positioned double-battle adapter. */
  readonly attackerPartnerAbility?: BattleAbility | null;
  readonly defenderPartnerAbility?: BattleAbility | null;
  /** Every active, conscious battler ability. Global auras are side-independent and do not stack. */
  readonly activeAbilities?: readonly BattleAbility[];
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
  const effectiveMove = effectiveMoveType(attacker, move);
  const attackerItemActive = heldItemIsActive(attacker);
  const defenderItemActive = heldItemIsActive(defender);
  const moveType = effectiveMove.type;
  const activeAbilities = new Set(context.activeAbilities
    ?? [attacker.ability, defender.ability].filter((ability): ability is BattleAbility => ability !== null));
  const ignoresDefenderAbility = hasMoldBreaker(attacker);
  const defenderTypes = (defender.volatile?.identified === true || attacker.ability === "SCRAPPY")
    && (moveType === "NORMAL" || moveType === "FIGHTING")
    ? defender.types.filter((type) => type !== "GHOST") : defender.types;
  const typeEffect = defenderTypes.length === 0 ? 1 : defenderTypes.reduce((multiplier, type) => {
    const component = typeEffectiveness(moveType, [type]);
    return multiplier * (context.weather === "strong-winds" && type === "FLYING" && component > 1 ? 1 : component);
  }, 1);
  const effectiveness = !ignoresDefenderAbility && defender.ability === "LEVITATE" && moveType === "GROUND"
    ? 0 : typeEffect;
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
  const attackKey = move.category === "Physical" ? "attack" : "specialAttack";
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
    + (attacker.ability === "SUPERLUCK" ? 1 : 0));
  const critical = !ignoresDefenderAbility && preventsCriticalHit(defender) ? false
    : !ignoresDefenderAbility && attacker.ability === "MERCILESS" && defender.majorStatus?.kind === "poison" ? true
      : context.luckyChant ? false
        : draw(rng, trace, "critical", [16, 8, 2, 1, 1][criticalStage] ?? 16) === 0;
  const attackStage = defender.ability === "UNAWARE" && !ignoresDefenderAbility ? 0
    : critical && attacker.stages[attackKey] < 0 ? 0 : attacker.stages[attackKey];
  const defenseStage = attacker.ability === "UNAWARE" ? 0
    : critical && defender.stages[defenseKey] > 0 ? 0 : defender.stages[defenseKey];
  const stagedAttack = stagedStat(attacker.stats[attackKey], attackStage);
  let attack = stagedAttack;
  if (attacker.ability === "GUTS" && attacker.majorStatus !== null && move.category === "Physical") attack = Math.round(attack * 1.5);
  if (attacker.ability === "HUSTLE" && move.category === "Physical") attack = Math.round(attack * 1.5);
  if ((attacker.ability === "HUGEPOWER" || attacker.ability === "PUREPOWER") && move.category === "Physical") attack = Math.round(attack * 2);
  if (attacker.ability === "SLOWSTART" && move.category === "Physical"
    && (attacker.volatile?.activeTurns ?? 0) <= 5) {
    attack = Math.max(1, Math.round(attack * 0.5));
    recordAbilityModifier("SLOWSTART", 0.5);
  }
  if (attacker.ability === "SILVANO" && move.category === "Physical" && context.terrain === "grassy") {
    attack = Math.max(1, Math.round(attack * 1.3));
    recordAbilityModifier("SILVANO", 1.3);
  }
  const lowHpAbilityType = attacker.ability === "OVERGROW" ? "GRASS"
    : attacker.ability === "BLAZE" ? "FIRE" : attacker.ability === "TORRENT" ? "WATER" : null;
  if (lowHpAbilityType === moveType && attacker.hp <= Math.floor(attacker.stats.maxHp / 3)) attack = Math.round(attack * 1.5);
  if (attacker.ability === "SWARM" && moveType === "BUG" && attacker.hp <= Math.floor(attacker.stats.maxHp / 3)) attack = Math.round(attack * 1.5);
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
  let defense = Math.max(1, stagedStat(defender.stats[defenseKey], defenseStage));
  const currentWeather = ordinaryWeather(context.weather);
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
  if (defenderItemActive && defender.heldItem === "ASSAULTVEST" && move.category === "Special") defense = Math.max(1, Math.round(defense * 1.5));
  if (defenderItemActive && defender.heldItem === "EVIOLITE" && defender.canEvolve === true) defense = Math.max(1, Math.round(defense * 1.5));
  const targetWeight = defender.capture?.weight ?? 0;
  const flailRatio = Math.floor((48 * attacker.hp) / attacker.stats.maxHp);
  let power = move.functionCode === "098"
    ? flailRatio < 2 ? 200 : flailRatio < 5 ? 150 : flailRatio < 10 ? 100
      : flailRatio < 17 ? 80 : flailRatio < 33 ? 40 : 20
    : move.functionCode !== "09A" ? move.power
    : targetWeight >= 2_000 ? 120 : targetWeight >= 1_000 ? 100 : targetWeight >= 500 ? 80
      : targetWeight >= 250 ? 60 : targetWeight >= 100 ? 40 : 20;
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
  if (move.functionCode === "07B" && defender.majorStatus?.kind === "poison") power *= 2;
  if (move.functionCode === "091") power *= 2 ** Math.max(0, (attacker.volatile?.furyCutterCount ?? 1) - 1);
  if (move.functionCode === "0D3") power *= 2 ** Math.max(0, 4 - (attacker.volatile?.rolloutTurns ?? 4));
  if (move.functionCode === "086" && attacker.heldItem === null) power *= 2;
  if (move.functionCode === "0F0" && defender.heldItem !== null) power = Math.floor(power * 1.5);
  const baseDamage = Math.floor(Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * power * attack) / defense) / 50) + 2;
  const variance = 85 + draw(rng, trace, "damage-variance", 16);
  const stab = attacker.types.includes(moveType) ? 1.5 : 1;
  let result = baseDamage;
  if (critical) result = Math.round(result * 1.5);
  result = Math.floor((result * variance) / 100);
  result = Math.round(result * stab);
  result = Math.round(result * effectiveness);
  let statusModifier = 1;
  if (attacker.ability !== "GUTS") {
    if (attacker.majorStatus?.kind === "burn" && move.category === "Physical") statusModifier *= 0.5;
    if (attacker.majorStatus?.kind === "frozen" && move.category === "Special") statusModifier *= 0.5;
  }
  if (defender.majorStatus?.kind === "caduco" && defender.hp <= Math.floor(defender.stats.maxHp / 2)) statusModifier *= 1.5;
  if (attackerItemActive && attacker.heldItem === "MUSCLEBAND" && move.category === "Physical") statusModifier *= 1.1;
  if (attackerItemActive && attacker.heldItem === "WISEGLASSES" && move.category === "Special") statusModifier *= 1.1;
  if (attackerItemActive && attacker.heldItem === "EXPERTBELT" && effectiveness > 1) statusModifier *= 1.2;
  if (attackerItemActive && attacker.heldItem === "LIFEORB" && effectiveness > 0) statusModifier *= 1.3;
  if (!ignoresDefenderAbility && defender.ability === "DRYSKIN" && moveType === "FIRE") statusModifier *= 1.25;
  if (!ignoresDefenderAbility && defender.ability === "HEATPROOF" && moveType === "FIRE") statusModifier *= 0.5;
  if (context.reflect && move.category === "Physical" && !critical) statusModifier *= 0.5;
  if (context.lightScreen && move.category === "Special" && !critical) statusModifier *= 0.5;
  if (context.mudSport && moveType === "ELECTRIC") statusModifier /= 3;
  if (context.waterSport && moveType === "FIRE") statusModifier /= 3;
  if (context.terrain === "electric" && moveType === "ELECTRIC"
    && !attacker.types.includes("FLYING") && attacker.ability !== "LEVITATE") statusModifier *= 1.5;
  if (currentWeather === "sun" && moveType === "FIRE" || currentWeather === "rain" && moveType === "WATER") statusModifier *= 1.5;
  if (currentWeather === "sun" && moveType === "WATER" || currentWeather === "rain" && moveType === "FIRE") statusModifier *= 0.5;
  if (attackerItemActive && ((attacker.heldItem === "FIGHTINGGEM" && moveType === "FIGHTING")
    || (attacker.heldItem === "BUGGEM" && moveType === "BUG"))) statusModifier *= 1.3;
  if (!context.defenderBerriesBlocked && defenderItemActive && defender.heldItem === "PAYAPABERRY"
    && moveType === "PSYCHIC" && effectiveness > 1) statusModifier *= 0.5;
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
  if (attacker.ability === "SHEERFORCE" && move.effectChance > 0) addAbilityModifier("SHEERFORCE", 1.3);
  if (attacker.ability === "RECKLESS" && isRecklessBoostedMove(move)) addAbilityModifier("RECKLESS", 1.2);
  if (attacker.ability === "TINTEDLENS" && effectiveness < 1) addAbilityModifier("TINTEDLENS", 2);
  if (attacker.ability === "RIVALRY"
    && (attackerGender === "male" || attackerGender === "female")
    && (defenderGender === "male" || defenderGender === "female")) {
    addAbilityModifier("RIVALRY", attackerGender === defenderGender ? 1.25 : 1);
  }
  if (attacker.ability === "TECHNICIAN" && power <= 60 && move.id > 0) addAbilityModifier("TECHNICIAN", 1.5);
  if (attacker.ability === "IRONFIST" && hasMoveFlag(move, "j")) addAbilityModifier("IRONFIST", 1.2);
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
