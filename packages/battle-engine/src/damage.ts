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
  const attackKey = move.category === "Physical" ? "attack" : "specialAttack";
  const defenseKey = move.category === "Physical" ? "defense" : "specialDefense";
  const critical = draw(rng, trace, "critical", 16) === 0;
  const attackStage = critical && attacker.stages[attackKey] < 0 ? 0 : attacker.stages[attackKey];
  const defenseStage = critical && defender.stages[defenseKey] > 0 ? 0 : defender.stages[defenseKey];
  const attack = stagedStat(attacker.stats[attackKey], attackStage);
  const defense = Math.max(1, stagedStat(defender.stats[defenseKey], defenseStage));
  const baseDamage = Math.floor(Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * move.power * attack) / defense) / 50) + 2;
  const variance = 85 + draw(rng, trace, "damage-variance", 16);
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const effectiveness = typeEffectiveness(move.type, defender.types);

  let result = baseDamage;
  if (critical) result = Math.round(result * 1.5);
  result = Math.floor((result * variance) / 100);
  result = Math.round(result * stab);
  result = Math.round(result * effectiveness);
  if (effectiveness !== 0) result = Math.max(1, result);

  trace.push({ type: "damage", side, move: move.internalName, attack, defense, baseDamage, critical, variance, stab, effectiveness, result });
  return result;
}
