import type { PersistentPokemon, PlayerCreationCatalog, PlayerPartyState,
  PlayerPokemonStorageState } from "@pokemon-z-battle/player-state";

export type SourcePokemonLocation = "team" | "ranch";
export type SourcePokemonSort = "number" | "name" | "current-power" | "potential-power" | "level";

export interface SourcePokemonCollectionEntry {
  readonly pokemon: PersistentPokemon;
  readonly location: SourcePokemonLocation;
  readonly teamIndex: number | null;
  readonly number: number;
  readonly speciesName: string;
  readonly displayName: string;
  readonly types: readonly string[];
  readonly currentPower: number;
  readonly potentialPower: number;
  readonly iconUrl: string;
}

export interface SourcePokemonFilters {
  readonly query: string;
  readonly firstType: string | null;
  readonly secondType: string | null;
  readonly minimumNumber: number | null;
  readonly maximumNumber: number | null;
  readonly minimumCurrentPower: number | null;
  readonly minimumPotentialPower: number | null;
  readonly sort: SourcePokemonSort;
}

function statTotal(stats: { readonly maxHp: number; readonly attack: number; readonly defense: number;
  readonly specialAttack: number; readonly specialDefense: number; readonly speed: number }): number {
  return stats.maxHp + stats.attack + stats.defense + stats.specialAttack + stats.specialDefense + stats.speed;
}

function baseStatTotal(stats: { readonly hp: number; readonly attack: number; readonly defense: number;
  readonly specialAttack: number; readonly specialDefense: number; readonly speed: number }): number {
  return stats.hp + stats.attack + stats.defense + stats.specialAttack + stats.specialDefense + stats.speed;
}

function searchText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("fr-FR");
}

export function sourcePokemonIconUrl(number: number): string {
  return `/__pokemon-z/source/Graphics/Icons/icon${String(number).padStart(3, "0")}.png`;
}

export function createSourcePokemonCollection(party: PlayerPartyState, ranch: PlayerPokemonStorageState,
  catalog: PlayerCreationCatalog): readonly SourcePokemonCollectionEntry[] {
  const definitions = new Map(catalog.pokemon.map((definition) => [definition.internalName, definition]));
  const entry = (pokemon: PersistentPokemon, location: SourcePokemonLocation,
    teamIndex: number | null): SourcePokemonCollectionEntry | null => {
    const definition = definitions.get(pokemon.species);
    if (definition === undefined) return null;
    const number = definition.id ?? 0;
    return { pokemon, location, teamIndex, number, speciesName: definition.name,
      displayName: pokemon.nickname ?? definition.name, types: [...definition.types],
      currentPower: statTotal(pokemon.stats), potentialPower: baseStatTotal(definition.baseStats),
      iconUrl: sourcePokemonIconUrl(number) };
  };
  return [
    ...party.members.map((pokemon, index) => entry(pokemon, "team", index)),
    ...ranch.members.map((pokemon) => entry(pokemon, "ranch", null)),
  ].filter((pokemon): pokemon is SourcePokemonCollectionEntry => pokemon !== null);
}

export function sourcePokemonTypes(catalog: PlayerCreationCatalog): readonly string[] {
  return [...new Set(catalog.pokemon.flatMap((pokemon) => pokemon.types))].sort((left, right) => left.localeCompare(right));
}

function validMinimum(value: number | null, actual: number): boolean {
  return value === null || actual >= value;
}

export function filterSourcePokemonCollection(collection: readonly SourcePokemonCollectionEntry[],
  filters: SourcePokemonFilters): readonly SourcePokemonCollectionEntry[] {
  const query = searchText(filters.query.trim());
  const result = collection.filter((entry) => {
    if (query !== "" && !searchText(`${entry.displayName} ${entry.speciesName} ${entry.pokemon.species} ${entry.number}`).includes(query)) return false;
    if (filters.firstType !== null && !entry.types.includes(filters.firstType)) return false;
    if (filters.secondType !== null && !entry.types.includes(filters.secondType)) return false;
    if (filters.firstType !== null && filters.secondType !== null && filters.firstType === filters.secondType) return false;
    if (!validMinimum(filters.minimumNumber, entry.number)
      || filters.maximumNumber !== null && entry.number > filters.maximumNumber
      || !validMinimum(filters.minimumCurrentPower, entry.currentPower)
      || !validMinimum(filters.minimumPotentialPower, entry.potentialPower)) return false;
    return true;
  });
  return result.sort((left, right) => {
    const difference = filters.sort === "number" ? left.number - right.number
      : filters.sort === "name" ? left.displayName.localeCompare(right.displayName, "fr")
        : filters.sort === "current-power" ? right.currentPower - left.currentPower
          : filters.sort === "potential-power" ? right.potentialPower - left.potentialPower
            : right.pokemon.level - left.pokemon.level;
    return difference || left.number - right.number || left.pokemon.id.localeCompare(right.pokemon.id);
  });
}

const FRENCH_TYPES: Readonly<Record<string, string>> = Object.freeze({
  BUG: "Insecte", DARK: "Ténèbres", DRAGON: "Dragon", ELECTRIC: "Électrik", FAIRY: "Fée",
  FIGHTING: "Combat", FIRE: "Feu", FLYING: "Vol", GHOST: "Spectre", GRASS: "Plante",
  GROUND: "Sol", ICE: "Glace", NORMAL: "Normal", POISON: "Poison", PSYCHIC: "Psy",
  ROCK: "Roche", STEEL: "Acier", WATER: "Eau",
});

export function sourcePokemonTypeLabel(type: string): string {
  return FRENCH_TYPES[type] ?? type.charAt(0) + type.slice(1).toLocaleLowerCase("fr-FR");
}
