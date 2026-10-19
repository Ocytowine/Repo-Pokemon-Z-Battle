import { typeEffectiveness } from "./type-chart.js";
import { effectiveMoveType, hasMoldBreaker, hasMoveFlag } from "./move-properties.js";
import type { BattleMove, BattlerState, BattleSide, BattleTrace, RandomSource } from "./types.js";

export interface BattleDamageContext {
  readonly reflect: boolean;
  readonly lightScreen: boolean;
  readonly luckyChant: boolean;
  readonly mudSport: boolean;
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
  context: BattleDamageContext = { reflect: false, lightScreen: false, luckyChant: false, mudSport: false, waterSport: false },
): number {
  const effectiveMove = effectiveMoveType(attacker, move);
  const moveType = effectiveMove.type;
  const ignoresDefenderAbility = hasMoldBreaker(attacker);
  if (move.functionCode === "06F") {
    const variance = 50 + draw(rng, trace, "damage-variance", 101);
    const result = Math.max(1, Math.floor((attacker.level * variance) / 100));
    trace.push({ type: "damage", side, move: move.internalName, attack: 0, defense: 0, baseDamage: result,
      critical: false, variance, stab: 1, effectiveness: 1, statusModifier: 1, abilityModifier: null, result });
    return result;
  }
  const attackKey = move.category === "Physical" ? "attack" : "specialAttack";
  const defenseKey = move.category === "Physical" ? "defense" : "specialDefense";
  const criticalStage = Math.min(4,
    (defender.majorStatus?.kind === "hemorrhage" ? 2 : 0)
    + (attacker.volatile?.focusEnergy ?? 0)
    + (attacker.heldItem === "SCOPELENS" ? 1 : 0));
  const criticalBlocked = context.luckyChant || !ignoresDefenderAbility
    && (defender.ability === "BATTLEARMOR" || defender.ability === "SHELLARMOR");
  const critical = !criticalBlocked && draw(rng, trace, "critical", [16, 8, 2, 1, 1][criticalStage] ?? 16) === 0;
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
  if (defender.heldItem === "ASSAULTVEST" && move.category === "Special") defense = Math.max(1, Math.round(defense * 1.5));
  if (defender.heldItem === "EVIOLITE" && defender.canEvolve === true) defense = Math.max(1, Math.round(defense * 1.5));
  const targetWeight = defender.capture?.weight ?? 0;
  let power = move.functionCode === "098"
    ? attacker.hp * 48 <= attacker.stats.maxHp ? 200 : attacker.hp * 5 <= attacker.stats.maxHp ? 150
      : attacker.hp * 3 <= attacker.stats.maxHp ? 100 : attacker.hp * 2 <= attacker.stats.maxHp ? 80
        : attacker.hp * 3 <= attacker.stats.maxHp * 2 ? 40 : 20
    : move.functionCode !== "09A" ? move.power
    : targetWeight >= 2_000 ? 120 : targetWeight >= 1_000 ? 100 : targetWeight >= 500 ? 80
      : targetWeight >= 250 ? 60 : targetWeight >= 100 ? 40 : 20;
  if (move.functionCode === "07B" && defender.majorStatus?.kind === "poison") power *= 2;
  const baseDamage = Math.floor(Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * power * attack) / defense) / 50) + 2;
  const variance = 85 + draw(rng, trace, "damage-variance", 16);
  const stab = attacker.types.includes(moveType) ? attacker.ability === "ADAPTABILITY" ? 2 : 1.5 : 1;
  const defenderTypes = (defender.volatile?.identified === true || attacker.ability === "SCRAPPY")
    && (moveType === "NORMAL" || moveType === "FIGHTING")
    ? defender.types.filter((type) => type !== "GHOST") : defender.types;
  const typeEffect = defenderTypes.length === 0 ? 1 : typeEffectiveness(moveType, defenderTypes);
  const effectiveness = !ignoresDefenderAbility && defender.ability === "LEVITATE" && moveType === "GROUND"
    ? 0 : typeEffect;

  let result = baseDamage;
  if (critical) result = Math.round(result * (attacker.ability === "SNIPER" ? 2.25 : 1.5));
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
  if (!ignoresDefenderAbility && defender.ability === "DRYSKIN" && moveType === "FIRE") statusModifier *= 1.25;
  if (context.reflect && move.category === "Physical" && !critical) statusModifier *= 0.5;
  if (context.lightScreen && move.category === "Special" && !critical) statusModifier *= 0.5;
  if (context.mudSport && moveType === "ELECTRIC") statusModifier /= 3;
  if (context.waterSport && moveType === "FIRE") statusModifier /= 3;
  if ((attacker.heldItem === "FIGHTINGGEM" && moveType === "FIGHTING")
    || (attacker.heldItem === "BUGGEM" && moveType === "BUG")) statusModifier *= 1.3;
  if (defender.heldItem === "PAYAPABERRY" && moveType === "PSYCHIC" && effectiveness > 1) statusModifier *= 0.5;
  const attackerGender = attacker.appearance?.gender;
  const defenderGender = defender.appearance?.gender;
  const offensiveAbilityModifier = attacker.ability === "IRONFIST" && hasMoveFlag(move, "j")
    ? { ability: "IRONFIST" as const, multiplier: 1.2 }
    : attacker.ability === "MEGALAUNCHER" && hasMoveFlag(move, "m")
    ? { ability: "MEGALAUNCHER" as const, multiplier: 1.5 }
    : attacker.ability === "NEUROFORCE" && effectiveness > 1
    ? { ability: "NEUROFORCE" as const, multiplier: 1.25 }
    : attacker.ability === "STRONGJAW" && hasMoveFlag(move, "i")
    ? { ability: "STRONGJAW" as const, multiplier: 1.5 }
    : attacker.ability === "TECHNICIAN" && power <= 60
    ? { ability: "TECHNICIAN" as const, multiplier: 1.5 }
    : attacker.ability === "SHEERFORCE" && move.effectChance > 0
    ? { ability: "SHEERFORCE" as const, multiplier: 1.3 }
    : attacker.ability === "TOUGHCLAWS" && hasMoveFlag(move, "a")
    ? { ability: "TOUGHCLAWS" as const, multiplier: 4 / 3 }
    : effectiveMove.abilityBoost !== 1
    ? { ability: attacker.ability as "AERILATE" | "LIQUIDVOICE" | "PIELHELADA" | "PIELHERBACEA" | "PIXILATE",
      multiplier: effectiveMove.abilityBoost }
    : null;
  const defensiveAbilityModifier = !ignoresDefenderAbility && defender.ability === "FILTER" && effectiveness > 1
    ? { ability: "FILTER" as const, multiplier: 0.75 }
    : !ignoresDefenderAbility && defender.ability === "SOLIDROCK" && effectiveness > 1
    ? { ability: "SOLIDROCK" as const, multiplier: 0.75 }
    : !ignoresDefenderAbility && defender.ability === "MULTISCALE" && defender.hp === defender.stats.maxHp
    ? { ability: "MULTISCALE" as const, multiplier: 0.5 }
    : !ignoresDefenderAbility && defender.ability === "THICKFAT" && (moveType === "FIRE" || moveType === "ICE")
    ? { ability: "THICKFAT" as const, multiplier: 0.5 }
    : null;
  const abilityModifier = offensiveAbilityModifier ?? defensiveAbilityModifier ?? (attacker.ability === "FLORACION" && moveType === "GRASS"
    ? { ability: "FLORACION" as const, multiplier: 1.5 }
    : attacker.ability === "RIVALRY"
    && (attackerGender === "male" || attackerGender === "female")
    && (defenderGender === "male" || defenderGender === "female")
    ? { ability: "RIVALRY" as const, multiplier: attackerGender === defenderGender ? 1.25 : 1 }
    : null);
  if (offensiveAbilityModifier !== null) statusModifier *= offensiveAbilityModifier.multiplier;
  if (defensiveAbilityModifier !== null) statusModifier *= defensiveAbilityModifier.multiplier;
  if (offensiveAbilityModifier === null && defensiveAbilityModifier === null && abilityModifier !== null) {
    statusModifier *= abilityModifier.multiplier;
  }
  result = Math.round(result * statusModifier);
  if (effectiveness !== 0) result = Math.max(1, result);

  trace.push({ type: "damage", side, move: move.internalName, attack, defense, baseDamage, critical, variance, stab, effectiveness, statusModifier,
    abilityModifier, result });
  return result;
}
