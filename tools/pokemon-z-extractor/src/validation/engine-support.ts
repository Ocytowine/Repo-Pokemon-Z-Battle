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

const SUPPORTED_MOVE_FUNCTION_CODES = new Set([
  "00", "000", "003", "005", "006", "007", "009", "00A", "00C", "00F", "012", "013",
  "01C", "01D", "01E", "01F", "020", "022", "023", "027", "028", "030",
  "042", "043", "044", "045", "046", "047", "048", "04B", "04D",
  "06F", "077", "07B", "088", "09A", "09E", "0A1", "0A2", "0A5", "0A7", "0AA", "0AD", "0B9", "0BA", "0BC", "0C0", "0CF", "0D8", "0DD", "0E8", "10D", "10E", "116", "159", "906",
]);
const PARTIAL_MOVE_FUNCTION_CODES = new Set(["049", "093", "0F4", "110"]);
const SUPPORTED_ABILITIES = new Set(["ACOMETIDA", "BIGPECKS", "BLAZE", "CHEEKPOUCH", "CONTRAGUARDIA", "FLORACION", "GUTS", "HUGEPOWER", "INNERFOCUS", "KEENEYE", "MAGICGUARD", "NOGUARD", "OVERGROW",
  "PUREPOWER", "QUICKFEET", "REGENERATOR", "RIVALRY", "SERENEGRACE", "SHEDSKIN", "SHIELDDUST", "SIMPLE", "STATIC", "STEADFAST", "SWARM", "SYNCHRONIZE", "TORRENT"]);
const PARTIAL_ABILITIES = new Set(["CHLOROPHYLL", "DRYSKIN", "INTIMIDATE"]);
const SUPPORTED_EVOLUTION_METHODS = new Set([
  "AtkDefEqual", "AttackGreater", "Cascoon", "DayHoldItem", "DefenseGreater",
  "Happiness", "HappinessDay", "HappinessNight", "HasInParty", "HasMove",
  "Item", "ItemFemale", "Level", "LevelFemale", "LevelMale", "Ninjask",
  "Silcoon",
]);

function entries(
  keys: Iterable<string>,
  supportedKeys: ReadonlySet<string> = new Set(),
  partialKeys: ReadonlySet<string> = new Set(),
): readonly EngineMechanicSupportEntry[] {
  return [...new Set(keys)]
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .map((key) => ({
      key,
      extracted: true,
      engineSupport: supportedKeys.has(key) ? "supported" : partialKeys.has(key) ? "partial" : "not-implemented",
    }));
}

export function createEngineSupportReport(input: EngineSupportInput): EngineSupportReport {
  const categories = {
    typeInteractions: entries(
      input.types.records.map((record) => record.internalName),
      new Set(input.types.records.map((record) => record.internalName)),
    ),
    moveFunctionCodes: entries(
      input.moves.records.map((record) => record.functionCode),
      SUPPORTED_MOVE_FUNCTION_CODES,
      PARTIAL_MOVE_FUNCTION_CODES,
    ),
    abilities: entries(input.abilities.records.map((record) => record.internalName), SUPPORTED_ABILITIES, PARTIAL_ABILITIES),
    itemTypes: entries(
      input.items.records.map((record) =>
        record.itemType === null ? "none" : String(record.itemType),
      ),
      new Set(),
      new Set(["0"]),
    ),
    evolutionMethods: entries(
      input.pokemon.records.flatMap((record) =>
        record.evolutions.map((evolution) => evolution.method),
      ),
      SUPPORTED_EVOLUTION_METHODS,
    ),
  } as const;
  const extractedMechanics = Object.values(categories).reduce(
    (total, category) => total + category.length,
    0,
  );
  const supportedMechanics = Object.values(categories).reduce(
    (total, category) =>
      total + category.filter((entry) => entry.engineSupport === "supported").length,
    0,
  );

  return {
    schemaVersion: GAME_DATA_SCHEMA_VERSION,
    engineState: "in-development",
    categories,
    summary: {
      extractedMechanics,
      supportedMechanics,
      coveragePercent:
        extractedMechanics === 0
          ? 0
          : Math.round((supportedMechanics / extractedMechanics) * 10_000) / 100,
    },
  };
}
