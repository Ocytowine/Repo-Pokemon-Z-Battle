import type {
  AbilityDefinition,
  EngineMechanicSupportEntry,
  EngineSupportReport,
  ItemDefinition,
  MoveDefinition,
  NormalizedDataset,
  PokemonDefinition,
  TypeDefinition,
} from "@pokemon-z-battle/game-data";
import { GAME_DATA_SCHEMA_VERSION } from "../domain/game-data.js";

export interface EngineSupportInput {
  readonly types: NormalizedDataset<"types", TypeDefinition>;
  readonly pokemon: NormalizedDataset<"pokemon", PokemonDefinition>;
  readonly moves: NormalizedDataset<"moves", MoveDefinition>;
  readonly abilities: NormalizedDataset<"abilities", AbilityDefinition>;
  readonly items: NormalizedDataset<"items", ItemDefinition>;
}

function entries(keys: Iterable<string>): readonly EngineMechanicSupportEntry[] {
  return [...new Set(keys)]
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .map((key) => ({ key, extracted: true, engineSupport: "not-implemented" }));
}

export function createEngineSupportReport(input: EngineSupportInput): EngineSupportReport {
  const categories = {
    typeInteractions: entries(input.types.records.map((record) => record.internalName)),
    moveFunctionCodes: entries(input.moves.records.map((record) => record.functionCode)),
    abilities: entries(input.abilities.records.map((record) => record.internalName)),
    itemTypes: entries(
      input.items.records.map((record) =>
        record.itemType === null ? "none" : String(record.itemType),
      ),
    ),
    evolutionMethods: entries(
      input.pokemon.records.flatMap((record) =>
        record.evolutions.map((evolution) => evolution.method),
      ),
    ),
  } as const;
  const extractedMechanics = Object.values(categories).reduce(
    (total, category) => total + category.length,
    0,
  );

  return {
    schemaVersion: GAME_DATA_SCHEMA_VERSION,
    engineState: "not-started",
    categories,
    summary: {
      extractedMechanics,
      supportedMechanics: 0,
      coveragePercent: 0,
    },
  };
}
