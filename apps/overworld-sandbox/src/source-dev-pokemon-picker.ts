import { resolvePokemonAsset, type PokemonAssetsManifest } from "@pokemon-z-battle/local-assets";
import type { PlayerDetailsCatalog, PokemonGender } from "@pokemon-z-battle/player-state";

export const SOURCE_DEV_POKEMON_PAGE_SIZE = 12;

export type SourceDevPokemonSort = "number" | "name";
export type SourceDevPokemonGender = "auto" | PokemonGender;

export interface SourceDevPokemonGenderOption {
  readonly value: SourceDevPokemonGender;
  readonly label: string;
}

export interface SourceDevPokemonEntry {
  readonly species: string;
  readonly number: number;
  readonly name: string;
  readonly types: readonly string[];
  readonly genderRate: string;
  readonly iconUrl: string;
}

export interface SourceDevPokemonFilters {
  readonly query: string;
  readonly type: string | null;
  readonly sort: SourceDevPokemonSort;
}

function searchableText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("fr-FR");
}

function sourceAssetUrl(path: string): string {
  return `/__pokemon-z/source/${path.replaceAll("\\", "/").split("/").map(encodeURIComponent).join("/")}`;
}

export function createSourceDevPokemonEntries(catalog: PlayerDetailsCatalog,
  assets: PokemonAssetsManifest): readonly SourceDevPokemonEntry[] {
  const records = new Map(assets.records.map((record) => [record.id, record]));
  return catalog.pokemon.filter((pokemon) => pokemon.id > 0).map((pokemon) => {
    const record = records.get(pokemon.id);
    const icon = record === undefined ? null : resolvePokemonAsset(record,
      { kind: "icon", form: 0, shiny: false, female: false }).asset;
    return {
      species: pokemon.internalName,
      number: pokemon.id,
      // parseBattleCatalog has already applied Data/french.dat here.
      name: pokemon.name,
      types: pokemon.types,
      genderRate: pokemon.genderRate,
      iconUrl: icon === null
        ? `/__pokemon-z/source/Graphics/Icons/icon${String(pokemon.id).padStart(3, "0")}.png`
        : sourceAssetUrl(icon.path),
    };
  });
}

export function sourceDevPokemonGenderOptions(genderRate: string): readonly SourceDevPokemonGenderOption[] {
  if (genderRate === "Genderless") return [{ value: "genderless", label: "Sans genre" }];
  if (genderRate === "AlwaysFemale") return [{ value: "female", label: "Femelle ♀" }];
  if (genderRate === "AlwaysMale") return [{ value: "male", label: "Mâle ♂" }];
  return [
    { value: "auto", label: "Aléatoire (espèce)" },
    { value: "female", label: "Femelle ♀" },
    { value: "male", label: "Mâle ♂" },
  ];
}

export function resolveSourceDevPokemonGender(genderRate: string, requested: SourceDevPokemonGender,
  generated: PokemonGender): PokemonGender {
  const options = sourceDevPokemonGenderOptions(genderRate);
  if (requested === "auto") return generated;
  return options.some((option) => option.value === requested)
    ? requested
    : options[0]?.value === "auto" || options[0] === undefined ? generated : options[0].value;
}

export function sourceDevPokemonTypes(entries: readonly SourceDevPokemonEntry[]): readonly string[] {
  return [...new Set(entries.flatMap((entry) => entry.types))].sort((left, right) => left.localeCompare(right));
}

export function filterSourceDevPokemonEntries(entries: readonly SourceDevPokemonEntry[],
  filters: SourceDevPokemonFilters): readonly SourceDevPokemonEntry[] {
  const query = searchableText(filters.query.trim());
  return entries.filter((entry) => {
    if (filters.type !== null && !entry.types.includes(filters.type)) return false;
    if (query === "") return true;
    return searchableText(`${entry.name} ${entry.species} ${entry.number}`).includes(query);
  }).sort((left, right) => filters.sort === "name"
    ? left.name.localeCompare(right.name, "fr") || left.number - right.number
    : left.number - right.number);
}

