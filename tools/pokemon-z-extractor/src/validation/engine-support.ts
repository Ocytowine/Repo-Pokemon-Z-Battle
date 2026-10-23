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
import { SUPPORTED_MOVE_FUNCTION_CODES } from "@pokemon-z-battle/battle-engine";
import { GAME_DATA_SCHEMA_VERSION } from "../domain/game-data.js";

export interface EngineSupportInput {
  readonly types: NormalizedDataset<"types", TypeDefinition>;
  readonly pokemon: NormalizedDataset<"pokemon", PokemonDefinition>;
  readonly moves: NormalizedDataset<"moves", MoveDefinition>;
  readonly abilities: NormalizedDataset<"abilities", AbilityDefinition>;
  readonly items: NormalizedDataset<"items", ItemDefinition>;
}

const PARTIAL_MOVE_FUNCTION_CODES = new Set<string>(["096", "0F9"]);
const SUPPORTED_ABILITIES = new Set(["ACOMETIDA", "ADAPTABILITY", "AERILATE", "ALQUIMIAVIL", "ANGERPOINT", "ANTICIPATION", "BATTLEARMOR", "BERSERK", "BIGPECKS", "BLAZE", "CHEEKPOUCH", "CHLOROPHYLL", "CLEARBODY", "COMPETITIVE", "COMPOUNDEYES", "CONTRAGUARDIA", "CORROSION", "DEFIANT", "DOWNLOAD", "EFFECTSPORE", "ELECTRICSURGE", "ESPANTO", "FILTER", "FLAMEBODY", "FLASHFIRE", "FLORACION", "FOREWARN", "FRISK", "GLUTTONY", "GOOEY", "GRASSYSURGE", "GUTS", "HEATPROOF", "HUGEPOWER", "HYPERCUTTER", "ILLUMINATE", "IMMUNITY", "IMPOSTER", "INNERFOCUS", "INSOMNIA", "INTIMIDATE", "IRONBARBS", "IRONFIST", "KEENEYE", "LEAFGUARD", "LEVITATE", "LIGHTNINGROD", "LIMBER", "LIQUIDVOICE", "MAGICGUARD", "MAGMAARMOR", "MEGALAUNCHER", "MOLDBREAKER", "MOTORDRIVE", "MULTISCALE", "NATURALCURE", "NEUROFORCE", "NOGUARD", "OVERGROW", "OWNTEMPO", "PICKPOCKET", "PIELHELADA", "PIELHERBACEA", "PIXILATE", "POISONPOINT", "POISONTOUCH", "PRANKSTER", "PRESENCIARARA", "PROTEAN", "PUREPOWER", "QUICKFEET", "RATTLED", "RECKLESS", "REGENERATOR", "RIVALRY", "ROCKHEAD", "ROUGHSKIN", "RUNAWAY", "SAPSIPPER", "SCRAPPY", "SERENEGRACE", "SHEDSKIN", "SHEERFORCE", "SHELLARMOR", "SHIELDDUST", "SIMPLE", "SKILLLINK", "SNIPER", "SOLIDROCK", "SOUNDPROOF", "STAMINA", "STATIC", "STEADFAST", "STEAMENGINE", "STICKYHOLD", "STORMDRAIN", "STRONGJAW", "SUPERLUCK", "SWARM", "SWIFTSWIM", "SYNCHRONIZE", "TECHNICIAN", "THICKFAT", "TINTEDLENS", "TORRENT", "TOUGHCLAWS", "TRACE", "UNAWARE", "VITALSPIRIT", "VOLTABSORB", "WATERABSORB", "WATERCOMPACTION", "WATERVEIL", "WEAKARMOR", "WHITESMOKE"]);
for (const ability of ["DRIZZLE", "DROUGHT", "DRYSKIN", "ICEBODY", "RAINDISH", "SANDFORCE", "SANDRUSH",
  "SANDSTREAM", "SANDVEIL", "SNOWCLOAK", "SNOWWARNING", "SOLARPOWER", "AIRLOCK", "CLOUDNINE", "OVERCOAT",
  "PODERGELIDO", "SLUSHRUSH", "PRIMORDIALSEA", "DESOLATELAND", "DELTASTREAM", "BADDREAMS", "EARLYBIRD",
  "HYDRATION", "POISONHEAL", "SPEEDBOOST", "KLUTZ", "PRESSURE", "UNNERVE",
  "HARVEST", "PICKUP", "UNBURDEN", "CURSEDBODY", "INFILTRATOR", "MAGICBOUNCE", "OBLIVIOUS", "STENCH",
  "AFTERMATH", "ANALYTIC", "ARENATRAP", "BRUTALIDAD", "CABEZAHIELO", "COLORCHANGE", "CORAZAIRA", "CORTANTE", "CUERPOHORNEADO", "CUTECHARM", "DAMP", "DEFEATIST", "DESPIERTALLAMA", "DINAMO", "FLUFFY", "FURCOAT", "GOODASGOLD", "GRANPESADILLA", "GRIMNEIGH", "HEALER", "HEAVYMETAL", "HUSTLE", "ICESCALES", "INNARDSOUT", "LIGHTMETAL", "LIQUIDOOZE", "MAGNETPULL", "MIRRORARMOR", "MOODY", "POISONPUPPETEER", "SHADOWTAG", "TRUANT", "WONDERGUARD",
  "ALBINISMO", "AURABREAK", "AURADORADA", "BULLETPROOF", "CAMORRISTA", "CANASTO", "CAPATOXICA", "COLEOPTERO", "CONTRARY", "DARKAURA", "DISGUISE", "DRAGONSMAW", "EARTHEATER", "EMERGENCYEXIT", "FAIRYAURA", "FLAREBOOST", "FLOWERGIFT", "FORECAST", "FORMAILUSORIA", "FRIENDGUARD", "GALEWINGS", "HONEYGATHER", "ILLUSION", "INFLAMABLE", "JUSTIFIED", "MARVELSCALE", "MERCILESS", "MINUS", "MISTYSURGE", "MOXIE", "MULTITYPE", "MUMMY", "NEUTRALIZINGGAS", "NORMALIZE", "OLORPORCINO", "PARENTALBOND", "PEDANTE", "PENETRANTE", "PIELELECTRICA", "PIELMALDITA", "PLUS", "PODERSABIO", "PSYCHICSURGE", "PUNKROCK", "PURIFYINGSALT", "QUEENLYMAJESTY", "REALEZA", "RELAMPAGUEO", "SILVANO", "SLOWSTART", "SOBRECARGA", "STALL", "STANCECHANGE", "STEELWORKER", "SUCTIONCUPS", "SURGESURFER", "TANGLEDFEET", "TELEPATHY", "TERAVOLT", "TERMOCONVERSION", "TINTINEO", "TOQUEMAGICO", "TOXICBOOST", "TRANSPORTARROCA", "TRIAGE", "TURBOBLAZE", "VICTORYSTAR", "VOZVALQUIRIA", "WATERBUBBLE", "WINDPOWER", "WINDRIDER", "WONDERSKIN", "ZENMODE"])
  SUPPORTED_ABILITIES.add(ability);
const PARTIAL_ABILITIES = new Set(["STURDY"]);
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
