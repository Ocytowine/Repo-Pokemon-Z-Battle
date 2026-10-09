import { typeEffectiveness } from "./type-chart.js";
import type { BattleMove, BattlerState, BattleSide, BattleTrace, RandomSource } from "./types.js";

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
): number {
  if (move.functionCode === "06F") {
    const variance = 50 + draw(rng, trace, "damage-variance", 101);
    const result = Math.max(1, Math.floor((attacker.level * variance) / 100));
    trace.push({ type: "damage", side, move: move.internalName, attack: 0, defense: 0, baseDamage: result,
      critical: false, variance, stab: 1, effectiveness: 1, statusModifier: 1, result });
    return result;
  }
  const attackKey = move.category === "Physical" ? "attack" : "specialAttack";
  const defenseKey = move.category === "Physical" ? "defense" : "specialDefense";
  const criticalStage = Math.min(4,
    (defender.majorStatus?.kind === "hemorrhage" ? 2 : 0)
    + (attacker.heldItem === "SCOPELENS" ? 1 : 0));
  const critical = draw(rng, trace, "critical", [16, 8, 2, 1, 1][criticalStage] ?? 16) === 0;
  const attackStage = critical && attacker.stages[attackKey] < 0 ? 0 : attacker.stages[attackKey];
  const defenseStage = critical && defender.stages[defenseKey] > 0 ? 0 : defender.stages[defenseKey];
  const stagedAttack = stagedStat(attacker.stats[attackKey], attackStage);
  let attack = stagedAttack;
  if (attacker.ability === "GUTS" && attacker.majorStatus !== null && move.category === "Physical") attack = Math.round(attack * 1.5);
  if ((attacker.ability === "HUGEPOWER" || attacker.ability === "PUREPOWER") && move.category === "Physical") attack = Math.round(attack * 2);
  const lowHpAbilityType = attacker.ability === "OVERGROW" ? "GRASS"
    : attacker.ability === "BLAZE" ? "FIRE" : attacker.ability === "TORRENT" ? "WATER" : null;
  if (lowHpAbilityType === move.type && attacker.hp <= Math.floor(attacker.stats.maxHp / 3)) attack = Math.round(attack * 1.5);
  if (attacker.ability === "FLORACION" && move.type === "GRASS") attack = Math.round(attack * 1.5);
  let defense = Math.max(1, stagedStat(defender.stats[defenseKey], defenseStage));
  if (defender.heldItem === "ASSAULTVEST" && move.category === "Special") defense = Math.max(1, Math.round(defense * 1.5));
  const baseDamage = Math.floor(Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * move.power * attack) / defense) / 50) + 2;
  const variance = 85 + draw(rng, trace, "damage-variance", 16);
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const effectiveness = typeEffectiveness(move.type, defender.types);

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
  result = Math.round(result * statusModifier);
  if (effectiveness !== 0) result = Math.max(1, result);

  trace.push({ type: "damage", side, move: move.internalName, attack, defense, baseDamage, critical, variance, stab, effectiveness, statusModifier, result });
  return result;
}
