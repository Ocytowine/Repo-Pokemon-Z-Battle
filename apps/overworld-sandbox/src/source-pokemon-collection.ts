import type { PersistentPokemon, PlayerCreationCatalog, PlayerPartyState,
  PlayerPokemonStorageState } from "@pokemon-z-battle/player-state";
import { resolvePokemonAsset, type PokemonAssetsManifest } from "@pokemon-z-battle/local-assets";

export type SourcePokemonLocation = "team" | "ranch";
export type SourcePokemonSort = "number" | "name" | "level" | "type" | "potential-power" | "iv-quality" | "ev-training";
export type SourcePokemonPowerTier = "all" | "very-low" | "low" | "moderate" | "good" | "very-powerful" | "super-powerful";
export type SourcePokemonQualityTier = "all" | "one" | "two" | "three" | "four";

export const SOURCE_POKEMON_POWER_TIERS: readonly {
  readonly id: Exclude<SourcePokemonPowerTier, "all">;
  readonly label: string;
  readonly minimum: number;
  readonly maximum: number | null;
}[] = [
  { id: "very-low", label: "Très faible", minimum: 0, maximum: 299 },
  { id: "low", label: "Faible", minimum: 300, maximum: 399 },
  { id: "moderate", label: "Modéré", minimum: 400, maximum: 449 },
  { id: "good", label: "Bon", minimum: 450, maximum: 499 },
  { id: "very-powerful", label: "Très puissant", minimum: 500, maximum: 599 },
  { id: "super-powerful", label: "Super puissant", minimum: 600, maximum: null },
] as const;

export interface SourcePokemonMoveSummary {
  readonly internalName: string;
  readonly name: string;
  readonly type: string;
  readonly pp: number;
  readonly maxPp: number;
}

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
  readonly ivAverage: number;
  readonly evAverage: number;
  readonly ivStars: number;
  readonly evStars: number;
  readonly iconUrl: string;
  readonly moves: readonly SourcePokemonMoveSummary[];
}

export interface SourcePokemonFilters {
  readonly query: string;
  readonly firstType: string | null;
  readonly secondType: string | null;
  readonly potentialTier: SourcePokemonPowerTier;
  readonly minimumIvStars: SourcePokemonQualityTier;
  readonly minimumEvStars: SourcePokemonQualityTier;
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

export function sourcePokemonPowerTier(score: number): typeof SOURCE_POKEMON_POWER_TIERS[number] {
  return SOURCE_POKEMON_POWER_TIERS.find((tier) => score >= tier.minimum
    && (tier.maximum === null || score <= tier.maximum)) ?? SOURCE_POKEMON_POWER_TIERS[0]!;
}

export function sourcePokemonStarText(stars: number): string {
  const count = Math.max(1, Math.min(4, Math.round(stars)));
  return `${"★".repeat(count)}${"☆".repeat(4 - count)}`;
}

function averageTrainingValue(values: PersistentPokemon["metadata"]["ivs"]): number {
  return (values.hp + values.attack + values.defense + values.specialAttack + values.specialDefense + values.speed) / 6;
}

export function sourcePokemonIvStars(average: number): number {
  return average > 25 ? 4 : average > 16 ? 3 : average > 6 ? 2 : 1;
}

export function sourcePokemonEvStars(average: number): number {
  return average >= 64 ? 4 : average >= 32 ? 3 : average >= 16 ? 2 : 1;
}

export function sourcePokemonIconUrl(number: number): string {
  return `/__pokemon-z/source/Graphics/Icons/icon${String(number).padStart(3, "0")}.png`;
}

function sourcePokemonAssetUrl(path: string): string {
  return `/__pokemon-z/source/${path.replaceAll("\\", "/").split("/").map(encodeURIComponent).join("/")}`;
}

export function createSourcePokemonCollection(party: PlayerPartyState, ranch: PlayerPokemonStorageState,
  catalog: PlayerCreationCatalog, assets?: PokemonAssetsManifest): readonly SourcePokemonCollectionEntry[] {
  const definitions = new Map(catalog.pokemon.map((definition) => [definition.internalName, definition]));
  const moves = new Map(catalog.moves.map((move) => [move.internalName, move]));
  const entry = (pokemon: PersistentPokemon, location: SourcePokemonLocation,
    teamIndex: number | null): SourcePokemonCollectionEntry | null => {
    const definition = definitions.get(pokemon.species);
    if (definition === undefined) return null;
    const number = definition.id ?? 0;
    const record = assets?.records.find((candidate) => candidate.id === number);
    const icon = record === undefined ? null : resolvePokemonAsset(record, { kind: "icon", form: pokemon.metadata.form,
      shiny: pokemon.metadata.shiny, female: pokemon.metadata.gender === "female" }).asset;
    const ivAverage = averageTrainingValue(pokemon.metadata.ivs);
    const evAverage = averageTrainingValue(pokemon.metadata.evs);
    return { pokemon, location, teamIndex, number, speciesName: definition.name,
      displayName: pokemon.nickname ?? definition.name, types: [...definition.types],
      currentPower: statTotal(pokemon.stats), potentialPower: baseStatTotal(definition.baseStats),
      ivAverage, evAverage, ivStars: sourcePokemonIvStars(ivAverage), evStars: sourcePokemonEvStars(evAverage),
      iconUrl: icon === null ? sourcePokemonIconUrl(number) : sourcePokemonAssetUrl(icon.path), moves: pokemon.moves.map((slot) => {
        const definition = moves.get(slot.internalName);
        return { internalName: slot.internalName, name: definition?.name ?? slot.internalName,
          type: definition?.type ?? "UNKNOWN", pp: slot.pp, maxPp: slot.maxPp };
      }) };
  };
  return [
    ...party.members.map((pokemon, index) => entry(pokemon, "team", index)),
    ...ranch.members.map((pokemon) => entry(pokemon, "ranch", null)),
  ].filter((pokemon): pokemon is SourcePokemonCollectionEntry => pokemon !== null);
}

export function sourcePokemonTypes(catalog: PlayerCreationCatalog): readonly string[] {
  return [...new Set(catalog.pokemon.flatMap((pokemon) => pokemon.types))].sort((left, right) => left.localeCompare(right));
}

function qualityMinimum(value: SourcePokemonQualityTier): number {
  return value === "four" ? 4 : value === "three" ? 3 : value === "two" ? 2 : value === "one" ? 1 : 0;
}

export function filterSourcePokemonCollection(collection: readonly SourcePokemonCollectionEntry[],
  filters: SourcePokemonFilters): readonly SourcePokemonCollectionEntry[] {
  const query = searchText(filters.query.trim());
  const result = collection.filter((entry) => {
    if (query !== "" && !searchText(`${entry.displayName} ${entry.speciesName} ${entry.pokemon.species} ${entry.number}`).includes(query)) return false;
    if (filters.firstType !== null && !entry.types.includes(filters.firstType)) return false;
    if (filters.secondType !== null && !entry.types.includes(filters.secondType)) return false;
    if (filters.firstType !== null && filters.secondType !== null && filters.firstType === filters.secondType) return false;
    if (filters.potentialTier !== "all" && sourcePokemonPowerTier(entry.potentialPower).id !== filters.potentialTier) return false;
    if (entry.ivStars < qualityMinimum(filters.minimumIvStars)
      || entry.evStars < qualityMinimum(filters.minimumEvStars)) return false;
    return true;
  });
  return result.sort((left, right) => {
    const difference = filters.sort === "number" ? left.number - right.number
        : filters.sort === "name" ? left.displayName.localeCompare(right.displayName, "fr")
          : filters.sort === "type" ? (left.types[0] ?? "").localeCompare(right.types[0] ?? "", "fr")
          : filters.sort === "potential-power" ? right.potentialPower - left.potentialPower
            : filters.sort === "iv-quality" ? right.ivAverage - left.ivAverage
              : filters.sort === "ev-training" ? right.evAverage - left.evAverage
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
