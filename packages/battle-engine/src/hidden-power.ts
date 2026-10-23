/** Pokemon Z's non-pseudo PBTypes order, excluding Normal and Shadow. */
const HIDDEN_POWER_TYPES = ["FIGHTING", "FLYING", "POISON", "GROUND", "ROCK", "BUG", "GHOST", "STEEL",
  "FIRE", "WATER", "GRASS", "ELECTRIC", "PSYCHIC", "ICE", "DRAGON", "DARK", "FAIRY"] as const;

const IV_ORDER = ["hp", "attack", "defense", "speed", "specialAttack", "specialDefense"] as const;

export function hiddenPowerTypeFromIvs(ivs: Readonly<Record<typeof IV_ORDER[number], number>>): string {
  const bits = IV_ORDER.reduce((value, stat, index) => value | ((ivs[stat] & 1) << index), 0);
  return HIDDEN_POWER_TYPES[Math.floor((bits * (HIDDEN_POWER_TYPES.length - 1)) / 63)]!;
}
