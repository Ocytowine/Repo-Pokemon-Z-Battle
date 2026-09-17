interface TypeDefense {
  readonly weak: readonly string[];
  readonly resistant: readonly string[];
  readonly immune: readonly string[];
}

const TYPE_DEFENSES: Readonly<Record<string, TypeDefense>> = {
  NORMAL: { weak: ["FIGHTING"], resistant: [], immune: ["GHOST"] },
  FIGHTING: { weak: ["FLYING", "PSYCHIC", "FAIRY"], resistant: ["ROCK", "BUG", "DARK"], immune: [] },
  FLYING: { weak: ["ROCK", "ELECTRIC", "ICE"], resistant: ["FIGHTING", "BUG", "GRASS"], immune: ["GROUND"] },
  POISON: { weak: ["GROUND", "PSYCHIC"], resistant: ["FIGHTING", "POISON", "BUG", "GRASS", "FAIRY"], immune: [] },
  GROUND: { weak: ["WATER", "GRASS", "ICE"], resistant: ["POISON", "ROCK"], immune: ["ELECTRIC"] },
  ROCK: { weak: ["FIGHTING", "GROUND", "STEEL", "WATER", "GRASS"], resistant: ["NORMAL", "FLYING", "POISON", "FIRE"], immune: [] },
  BUG: { weak: ["FLYING", "ROCK", "FIRE"], resistant: ["FIGHTING", "GROUND", "GRASS"], immune: [] },
  GHOST: { weak: ["GHOST", "DARK"], resistant: ["POISON", "BUG"], immune: ["NORMAL", "FIGHTING"] },
  STEEL: { weak: ["FIGHTING", "GROUND", "FIRE"], resistant: ["NORMAL", "FLYING", "ROCK", "BUG", "STEEL", "GRASS", "PSYCHIC", "ICE", "DRAGON", "FAIRY"], immune: ["POISON"] },
  QMARKS: { weak: [], resistant: [], immune: [] },
  FIRE: { weak: ["GROUND", "ROCK", "WATER"], resistant: ["BUG", "STEEL", "FIRE", "GRASS", "ICE", "FAIRY"], immune: [] },
  WATER: { weak: ["GRASS", "ELECTRIC"], resistant: ["STEEL", "FIRE", "WATER", "ICE"], immune: [] },
  GRASS: { weak: ["FLYING", "POISON", "BUG", "FIRE", "ICE"], resistant: ["GROUND", "WATER", "GRASS", "ELECTRIC"], immune: [] },
  ELECTRIC: { weak: ["GROUND"], resistant: ["FLYING", "STEEL", "ELECTRIC"], immune: [] },
  PSYCHIC: { weak: ["BUG", "GHOST", "DARK"], resistant: ["FIGHTING", "PSYCHIC"], immune: [] },
  ICE: { weak: ["FIGHTING", "ROCK", "STEEL", "FIRE"], resistant: ["ICE"], immune: [] },
  DRAGON: { weak: ["ICE", "DRAGON", "FAIRY"], resistant: ["FIRE", "WATER", "GRASS", "ELECTRIC"], immune: [] },
  DARK: { weak: ["FIGHTING", "BUG", "FAIRY"], resistant: ["GHOST", "DARK"], immune: ["PSYCHIC"] },
  FAIRY: { weak: ["STEEL", "POISON"], resistant: ["DARK", "FIGHTING", "BUG"], immune: ["DRAGON"] },
};

export function typeEffectiveness(moveType: string, defenderTypes: readonly string[]): number {
  return defenderTypes.reduce((multiplier, defenderType) => {
    const defense = TYPE_DEFENSES[defenderType];
    if (defense === undefined) {
      throw new Error(`Unknown Pokemon Z type: ${defenderType}`);
    }
    if (defense.immune.includes(moveType)) return 0;
    if (defense.weak.includes(moveType)) return multiplier * 2;
    if (defense.resistant.includes(moveType)) return multiplier * 0.5;
    return multiplier;
  }, 1);
}

export function isKnownType(type: string): boolean {
  return TYPE_DEFENSES[type] !== undefined;
}
