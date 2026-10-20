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
<<<<<<< HEAD
  "00", "000", "003", "005", "006", "007", "009", "00A", "00C", "00F", "012", "013",
  "01C", "01D", "01E", "01F", "020", "022", "023", "027", "028", "030",
  "042", "043", "044", "045", "046", "047", "048", "04B", "04D",
  "06F", "077", "07B", "088", "09A", "09E", "0A1", "0A2", "0A5", "0A7", "0AA", "0AD", "0B9", "0BA", "0BC", "0C0", "0CF", "0D8", "0DD", "0E8", "0FA", "0FB", "0FC", "0FD", "0FE", "10B", "10D", "10E", "116", "159", "906",
]);
const PARTIAL_MOVE_FUNCTION_CODES = new Set(["049", "093", "0F4", "110"]);
const SUPPORTED_ABILITIES = new Set(["ACOMETIDA", "ADAPTABILITY", "ANGERPOINT", "ANTICIPATION", "BATTLEARMOR", "BERSERK", "BIGPECKS", "BLAZE", "CHEEKPOUCH", "CLEARBODY", "COMPETITIVE", "CONTRAGUARDIA", "DEFIANT", "DOWNLOAD", "EFFECTSPORE", "FILTER", "FLAMEBODY", "FLASHFIRE", "FLORACION", "FOREWARN", "FRISK", "GOOEY", "GUTS", "HUGEPOWER", "HYPERCUTTER", "IMMUNITY", "INNERFOCUS", "INSOMNIA", "IRONBARBS", "IRONFIST", "KEENEYE", "LEVITATE", "LIGHTNINGROD", "LIMBER", "MAGICGUARD", "MAGMAARMOR", "MOTORDRIVE", "MULTISCALE", "NATURALCURE", "NOGUARD", "OWNTEMPO", "OVERGROW",
  "PICKPOCKET", "POISONPOINT", "POISONTOUCH", "PUREPOWER", "QUICKFEET", "RATTLED", "RECKLESS", "REGENERATOR", "RIVALRY", "ROCKHEAD", "ROUGHSKIN", "SAPSIPPER", "SERENEGRACE", "SHEDSKIN", "SHEERFORCE", "SHELLARMOR", "SHIELDDUST", "SIMPLE", "SKILLLINK", "SNIPER", "SOLIDROCK", "STAMINA", "STATIC", "STEADFAST", "STEAMENGINE", "STORMDRAIN", "STRONGJAW", "SUPERLUCK", "SWARM", "SYNCHRONIZE", "TECHNICIAN", "THICKFAT", "TINTEDLENS", "TORRENT", "TOUGHCLAWS", "TRACE", "VITALSPIRIT", "VOLTABSORB", "WATERABSORB", "WATERCOMPACTION", "WATERVEIL", "WEAKARMOR", "WHITESMOKE"]);
const PARTIAL_ABILITIES = new Set(["CHLOROPHYLL", "COMPOUNDEYES", "DRYSKIN", "INTIMIDATE", "STURDY"]);
=======
  "00", "000", "001", "003", "004", "005", "006", "007", "008", "009", "00A", "00C", "00F", "010", "012", "013", "016", "017",
  "01C", "01D", "01E", "01F", "020", "021", "022", "023", "027", "028", "030",
  "02D", "02F", "033", "034", "042", "043", "044", "045", "046", "047", "048", "049", "04B", "04C", "04D", "04F",
  "064", "069", "06D", "06F", "077", "07B", "082", "083", "086", "088", "08D", "091", "093", "095", "098", "09A", "09C", "09D", "09E", "0A1", "0A2", "0A3", "0A5", "0A7", "0AA", "0AD", "0B3", "0B9", "0BA", "0BC", "0BD", "0BE", "0C0", "0CF", "0D1", "0D3", "0D5", "0D8", "0DC", "0DD", "0E8", "0F0", "0F1", "0F4", "0F8", "0FA", "10D", "10E", "110", "116", "159", "906",
]);
const PARTIAL_MOVE_FUNCTION_CODES = new Set<string>();
const SUPPORTED_ABILITIES = new Set(["ACOMETIDA", "ADAPTABILITY", "AERILATE", "ALQUIMIAVIL", "BATTLEARMOR", "BIGPECKS", "BLAZE", "CHEEKPOUCH", "CHLOROPHYLL", "COMPOUNDEYES", "CORROSION", "CONTRAGUARDIA", "FILTER", "FLAMEBODY", "FLORACION", "GLUTTONY", "GOOEY", "GRASSYSURGE", "GUTS", "HEATPROOF", "HUGEPOWER", "IMMUNITY", "IMPOSTER", "INNERFOCUS", "IRONFIST", "KEENEYE", "LEAFGUARD", "LEVITATE", "LIQUIDVOICE", "MAGICGUARD", "MEGALAUNCHER", "MOLDBREAKER", "MULTISCALE", "NEUROFORCE", "NOGUARD", "OVERGROW", "OWNTEMPO", "PIELHELADA", "PIXILATE", "RATTLED", "ROCKHEAD", "ROUGHSKIN", "RUNAWAY",
  "COMPETITIVE", "INTIMIDATE", "NATURALCURE", "PIELHERBACEA", "PRANKSTER", "PROTEAN", "PUREPOWER", "QUICKFEET", "REGENERATOR", "RIVALRY", "SAPSIPPER", "SCRAPPY", "SERENEGRACE", "SHEERFORCE", "SHELLARMOR", "SHEDSKIN", "SHIELDDUST", "SIMPLE", "SKILLLINK", "SNIPER", "SOLIDROCK", "SOUNDPROOF", "STATIC", "STEADFAST", "STICKYHOLD", "STRONGJAW", "SWARM", "SWIFTSWIM", "SYNCHRONIZE", "TECHNICIAN", "THICKFAT", "TORRENT", "TOUGHCLAWS", "UNAWARE", "WATERABSORB"]);
const PARTIAL_ABILITIES = new Set(["DRYSKIN"]);
>>>>>>> 52b0b9123ed2c596c96a1144d039db8d7777731e
const SUPPORTED_EVOLUTION_METHODS = new Set([
  "AtkDefEqual", "AttackGreater", "Cascoon", "DayHoldItem", "DefenseGreater",
  "Happiness", "HappinessDay", "HappinessNight", "HasInParty", "HasMove",
  "Item", "ItemFemale", "Level", "LevelFemale", "LevelMale", "Ninjask",
  "Silcoon",
]);

export type EngineMechanicSupport = "not-implemented" | "partial" | "supported";

export function moveFunctionEngineSupport(functionCode: string): EngineMechanicSupport {
  return SUPPORTED_MOVE_FUNCTION_CODES.has(functionCode) ? "supported"
    : PARTIAL_MOVE_FUNCTION_CODES.has(functionCode) ? "partial" : "not-implemented";
}

export function abilityEngineSupport(internalName: string): EngineMechanicSupport {
  return SUPPORTED_ABILITIES.has(internalName) ? "supported"
    : PARTIAL_ABILITIES.has(internalName) ? "partial" : "not-implemented";
}

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
