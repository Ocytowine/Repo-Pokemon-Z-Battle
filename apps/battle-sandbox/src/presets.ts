import { MINIMAL_MOVE_CATALOG, type BattleMove, type BattleStats } from "@pokemon-z-battle/battle-engine";

export interface PokemonPreset {
  readonly id: number;
  readonly species: string;
  readonly name: string;
  readonly types: readonly string[];
  readonly baseStats: Omit<BattleStats, "maxHp"> & { readonly hp: number };
  readonly moves: readonly BattleMove[];
}

export const POKEMON_PRESETS = [
  {
    id: 1,
    species: "BULBASAUR",
    name: "Bulbizarre",
    types: ["GRASS", "POISON"],
    baseStats: { hp: 50, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 },
    moves: [MINIMAL_MOVE_CATALOG.TACKLE, MINIMAL_MOVE_CATALOG.VINEWHIP, MINIMAL_MOVE_CATALOG.SLEEPPOWDER, MINIMAL_MOVE_CATALOG.POISONPOWDER],
  },
  {
    id: 4,
    species: "CHARMANDER",
    name: "Salamèche",
    types: ["FIRE"],
    baseStats: { hp: 44, attack: 52, defense: 43, specialAttack: 60, specialDefense: 50, speed: 65 },
    moves: [MINIMAL_MOVE_CATALOG.SCRATCH, MINIMAL_MOVE_CATALOG.SWIFT, MINIMAL_MOVE_CATALOG.WILLOWISP, MINIMAL_MOVE_CATALOG.LUZDECADENTE],
  },
  {
    id: 7,
    species: "SQUIRTLE",
    name: "Carapuce",
    types: ["WATER"],
    baseStats: { hp: 49, attack: 48, defense: 65, specialAttack: 50, specialDefense: 64, speed: 43 },
    moves: [MINIMAL_MOVE_CATALOG.TACKLE, MINIMAL_MOVE_CATALOG.WATERGUN, MINIMAL_MOVE_CATALOG.ICEBEAM, MINIMAL_MOVE_CATALOG.CUT],
  },
  {
    id: 25,
    species: "PIKACHU",
    name: "Pikachu",
    types: ["ELECTRIC", "POISON"],
    baseStats: { hp: 45, attack: 65, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
    moves: [MINIMAL_MOVE_CATALOG.QUICKATTACK, MINIMAL_MOVE_CATALOG.CHARGEBEAM, MINIMAL_MOVE_CATALOG.THUNDERWAVE, MINIMAL_MOVE_CATALOG.SANDATTACK],
  },
  {
    id: 133,
    species: "EEVEE",
    name: "Évoli",
    types: ["NORMAL"],
    baseStats: { hp: 65, attack: 75, defense: 60, specialAttack: 65, specialDefense: 75, speed: 75 },
    moves: [MINIMAL_MOVE_CATALOG.TACKLE, MINIMAL_MOVE_CATALOG.QUICKATTACK, MINIMAL_MOVE_CATALOG.SWIFT, MINIMAL_MOVE_CATALOG.TOXIC],
  },
] as const satisfies readonly PokemonPreset[];

export function findPreset(species: string): PokemonPreset | undefined {
  return POKEMON_PRESETS.find((preset) => preset.species === species);
}
