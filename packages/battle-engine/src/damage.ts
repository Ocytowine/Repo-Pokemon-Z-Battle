import { typeEffectiveness } from "./type-chart.js";
import { preventsCriticalHit } from "./ability-protection.js";
import { isRecklessBoostedMove } from "./move-properties.js";
import type { BattleMove, BattlerState, BattleSide, BattleTrace, ImplementedBattleAbility, RandomSource } from "./types.js";

export interface BattleDamageContext {
  readonly reflect: boolean;
  readonly luckyChant: boolean;
  readonly waterSport: boolean;
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
  context: BattleDamageContext = { reflect: false, luckyChant: false, waterSport: false },
): number {
  if (move.functionCode === "06F") {
    const variance = 50 + draw(rng, trace, "damage-variance", 101);
    const result = Math.max(1, Math.floor((attacker.level * variance) / 100));
    trace.push({ type: "damage", side, move: move.internalName, attack: 0, defense: 0, baseDamage: result,
      critical: false, variance, stab: 1, effectiveness: 1, statusModifier: 1, abilityModifier: null,
      abilityModifiers: [], result });
    return result;
  }
  const attackKey = move.category === "Physical" ? "attack" : "specialAttack";
  const defenseKey = move.category === "Physical" ? "defense" : "specialDefense";
  const criticalStage = Math.min(4,
    (defender.majorStatus?.kind === "hemorrhage" ? 2 : 0)
    + (attacker.volatile?.focusEnergy ?? 0)
    + (attacker.heldItem === "SCOPELENS" ? 1 : 0)
    + (attacker.ability === "SUPERLUCK" ? 1 : 0));
  const critical = !context.luckyChant && !preventsCriticalHit(defender)
    && draw(rng, trace, "critical", [16, 8, 2, 1, 1][criticalStage] ?? 16) === 0;
  const attackStage = critical && attacker.stages[attackKey] < 0 ? 0 : attacker.stages[attackKey];
  const defenseStage = critical && defender.stages[defenseKey] > 0 ? 0 : defender.stages[defenseKey];
  const stagedAttack = stagedStat(attacker.stats[attackKey], attackStage);
  let attack = stagedAttack;
  if (attacker.ability === "GUTS" && attacker.majorStatus !== null && move.category === "Physical") attack = Math.round(attack * 1.5);
  if ((attacker.ability === "HUGEPOWER" || attacker.ability === "PUREPOWER") && move.category === "Physical") attack = Math.round(attack * 2);
  const lowHpAbilityType = attacker.ability === "OVERGROW" ? "GRASS"
    : attacker.ability === "BLAZE" ? "FIRE" : attacker.ability === "TORRENT" ? "WATER" : null;
  if (lowHpAbilityType === move.type && attacker.hp <= Math.floor(attacker.stats.maxHp / 3)) attack = Math.round(attack * 1.5);
  if (attacker.ability === "SWARM" && move.type === "BUG" && attacker.hp <= Math.floor(attacker.stats.maxHp / 3)) attack = Math.round(attack * 1.5);
  if (attacker.ability === "ACOMETIDA" && move.category === "Physical" && (attacker.volatile?.activeTurns ?? 0) === 0) attack = Math.round(attack * 1.2);
  let defense = Math.max(1, stagedStat(defender.stats[defenseKey], defenseStage));
  if (defender.heldItem === "ASSAULTVEST" && move.category === "Special") defense = Math.max(1, Math.round(defense * 1.5));
  if (defender.heldItem === "EVIOLITE" && defender.canEvolve === true) defense = Math.max(1, Math.round(defense * 1.5));
  const targetWeight = defender.capture?.weight ?? 0;
  let power = move.functionCode !== "09A" ? move.power
    : targetWeight >= 2_000 ? 120 : targetWeight >= 1_000 ? 100 : targetWeight >= 500 ? 80
      : targetWeight >= 250 ? 60 : targetWeight >= 100 ? 40 : 20;
  if (move.functionCode === "07B" && defender.majorStatus?.kind === "poison") power *= 2;
  const baseDamage = Math.floor(Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * power * attack) / defense) / 50) + 2;
  const variance = 85 + draw(rng, trace, "damage-variance", 16);
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const defenderTypes = defender.volatile?.identified === true && (move.type === "NORMAL" || move.type === "FIGHTING")
    ? defender.types.filter((type) => type !== "GHOST") : defender.types;
  const effectiveness = defenderTypes.length === 0 ? 1 : typeEffectiveness(move.type, defenderTypes);

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
  if (attacker.heldItem === "MUSCLEBAND" && move.category === "Physical") statusModifier *= 1.1;
  if (attacker.heldItem === "WISEGLASSES" && move.category === "Special") statusModifier *= 1.1;
  if (attacker.heldItem === "EXPERTBELT" && effectiveness > 1) statusModifier *= 1.2;
  if (attacker.heldItem === "LIFEORB" && effectiveness > 0) statusModifier *= 1.3;
  if (defender.ability === "DRYSKIN" && move.type === "FIRE") statusModifier *= 1.25;
  if (context.reflect && move.category === "Physical" && !critical) statusModifier *= 0.5;
  if (context.waterSport && move.type === "FIRE") statusModifier /= 3;
  if ((attacker.heldItem === "FIGHTINGGEM" && move.type === "FIGHTING")
    || (attacker.heldItem === "BUGGEM" && move.type === "BUG")) statusModifier *= 1.3;
  if (defender.heldItem === "PAYAPABERRY" && move.type === "PSYCHIC" && effectiveness > 1) statusModifier *= 0.5;
  const attackerGender = attacker.appearance?.gender;
  const defenderGender = defender.appearance?.gender;
  const abilityModifiers: { ability: ImplementedBattleAbility; multiplier: number }[] = [];
  const addAbilityModifier = (ability: ImplementedBattleAbility, multiplier: number): void => {
    abilityModifiers.push({ ability, multiplier });
    statusModifier *= multiplier;
  };
  if (attacker.ability === "FLORACION" && move.type === "GRASS") addAbilityModifier("FLORACION", 1.5);
  if (attacker.ability === "SHEERFORCE" && move.effectChance > 0) addAbilityModifier("SHEERFORCE", 1.3);
  if (attacker.ability === "RECKLESS" && isRecklessBoostedMove(move)) addAbilityModifier("RECKLESS", 1.2);
  if (attacker.ability === "TINTEDLENS" && effectiveness < 1) addAbilityModifier("TINTEDLENS", 2);
  if (attacker.ability === "RIVALRY"
    && (attackerGender === "male" || attackerGender === "female")
    && (defenderGender === "male" || defenderGender === "female")) {
    addAbilityModifier("RIVALRY", attackerGender === defenderGender ? 1.25 : 1);
  }
  if (attacker.ability === "TECHNICIAN" && power <= 60 && move.id > 0) addAbilityModifier("TECHNICIAN", 1.5);
  if (attacker.ability === "IRONFIST" && move.flags?.includes("j") === true) addAbilityModifier("IRONFIST", 1.2);
  if (attacker.ability === "STRONGJAW" && move.flags?.includes("i") === true) addAbilityModifier("STRONGJAW", 1.5);
  if (attacker.ability === "TOUGHCLAWS" && move.flags?.includes("a") === true) addAbilityModifier("TOUGHCLAWS", 4 / 3);
  if (attacker.ability === "ADAPTABILITY" && attacker.types.includes(move.type)) addAbilityModifier("ADAPTABILITY", 4 / 3);
  if (attacker.ability === "SNIPER" && critical) addAbilityModifier("SNIPER", 1.5);
  if (attacker.ability === "FLASHFIRE" && attacker.volatile?.flashFire === true && move.type === "FIRE") {
    addAbilityModifier("FLASHFIRE", 1.5);
  }
  if (defender.ability === "THICKFAT" && (move.type === "FIRE" || move.type === "ICE")) addAbilityModifier("THICKFAT", 0.5);
  if ((defender.ability === "FILTER" || defender.ability === "SOLIDROCK") && effectiveness > 1) {
    addAbilityModifier(defender.ability === "FILTER" ? "FILTER" : "SOLIDROCK", 0.75);
  }
  if (defender.ability === "MULTISCALE" && defender.hp === defender.stats.maxHp) addAbilityModifier("MULTISCALE", 0.5);
  const abilityModifier = abilityModifiers[0] ?? null;
  result = Math.round(result * statusModifier);
  if (effectiveness !== 0) result = Math.max(1, result);

  trace.push({ type: "damage", side, move: move.internalName, attack, defense, baseDamage, critical, variance, stab, effectiveness, statusModifier,
    abilityModifier, abilityModifiers, result });
  return result;
}
