import { typeEffectiveness } from "./type-chart.js";
import { preventsCriticalHit } from "./ability-protection.js";
import { effectiveMoveType, hasMoldBreaker, hasMoveFlag, isRecklessBoostedMove } from "./move-properties.js";
import { ordinaryWeather, weatherSpeedMultiplier } from "./ability-weather.js";
import { heldItemIsActive } from "./ability-item-control.js";
import type { BattleEffects, BattleMove, BattlerState, BattleSide, BattleTrace, ImplementedBattleAbility, RandomSource } from "./types.js";

export interface BattleDamageContext {
  readonly reflect: boolean;
  readonly lightScreen: boolean;
  readonly luckyChant: boolean;
  readonly mudSport: boolean;
  readonly waterSport: boolean;
  readonly weather?: BattleEffects["weather"];
  readonly terrain?: BattleEffects["terrain"];
  readonly defenderBerriesBlocked?: boolean;
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
  const defenseKey = move.category === "Physical" ? "defense" : "specialDefense";
  const criticalStage = Math.min(4,
    (defender.majorStatus?.kind === "hemorrhage" ? 2 : 0)
    + (attacker.volatile?.focusEnergy ?? 0)
    + (attackerItemActive && attacker.heldItem === "SCOPELENS" ? 1 : 0)
    + (attacker.ability === "SUPERLUCK" ? 1 : 0));
  const critical = !context.luckyChant && (ignoresDefenderAbility || !preventsCriticalHit(defender))
    && draw(rng, trace, "critical", [16, 8, 2, 1, 1][criticalStage] ?? 16) === 0;
  const attackStage = defender.ability === "UNAWARE" && !ignoresDefenderAbility ? 0
    : critical && attacker.stages[attackKey] < 0 ? 0 : attacker.stages[attackKey];
  const defenseStage = attacker.ability === "UNAWARE" ? 0
    : critical && defender.stages[defenseKey] > 0 ? 0 : defender.stages[defenseKey];
  const stagedAttack = stagedStat(attacker.stats[attackKey], attackStage);
  let attack = stagedAttack;
  if (attacker.ability === "GUTS" && attacker.majorStatus !== null && move.category === "Physical") attack = Math.round(attack * 1.5);
  if ((attacker.ability === "HUGEPOWER" || attacker.ability === "PUREPOWER") && move.category === "Physical") attack = Math.round(attack * 2);
  const lowHpAbilityType = attacker.ability === "OVERGROW" ? "GRASS"
    : attacker.ability === "BLAZE" ? "FIRE" : attacker.ability === "TORRENT" ? "WATER" : null;
  if (lowHpAbilityType === moveType && attacker.hp <= Math.floor(attacker.stats.maxHp / 3)) attack = Math.round(attack * 1.5);
  if (attacker.ability === "SWARM" && moveType === "BUG" && attacker.hp <= Math.floor(attacker.stats.maxHp / 3)) attack = Math.round(attack * 1.5);
  if (attacker.ability === "ACOMETIDA" && move.category === "Physical" && (attacker.volatile?.activeTurns ?? 0) === 0) attack = Math.round(attack * 1.2);
  let defense = Math.max(1, stagedStat(defender.stats[defenseKey], defenseStage));
  const currentWeather = ordinaryWeather(context.weather);
  if (currentWeather === "sand" && move.category === "Special" && defender.types.includes("ROCK")) defense = Math.round(defense * 1.5);
  if (currentWeather === "hail" && move.category === "Physical" && defender.types.includes("ICE")) defense = Math.round(defense * 1.5);
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
  const abilityModifiers: { ability: ImplementedBattleAbility; multiplier: number }[] = [];
  const addAbilityModifier = (ability: ImplementedBattleAbility, multiplier: number): void => {
    abilityModifiers.push({ ability, multiplier });
    statusModifier *= multiplier;
  };
  if (attacker.ability === "FLORACION" && moveType === "GRASS") addAbilityModifier("FLORACION", 1.5);
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
  if (!ignoresDefenderAbility && (defender.ability === "FILTER" || defender.ability === "SOLIDROCK") && effectiveness > 1) {
    addAbilityModifier(defender.ability === "FILTER" ? "FILTER" : "SOLIDROCK", 0.75);
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
