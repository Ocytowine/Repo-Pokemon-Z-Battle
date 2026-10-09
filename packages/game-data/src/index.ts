export const GAME_DATA_SCHEMA_VERSION = "1.0.0" as const;

export const LOCAL_DATA_MANIFEST_SCHEMA_VERSION = "1.0.0" as const;
export const LOCAL_DATA_MANIFEST_FILE = "local-data-manifest.json" as const;

export const LOCAL_DATA_REQUIRED_FILES = Object.freeze([
  "abilities.json",
  "asset-manifest.json",
  "battle-animations.json",
  "encounters.json",
  "items.json",
  "localization.json",
  "machines.json",
  "map-animations.json",
  "map-battle-metadata.json",
  "moves.json",
  "player-avatar-report.json",
  "player-avatars.json",
  "pokemon-assets.json",
  "pokemon.json",
  "tilesets.json",
  "trainer-types.json",
  "trainers.json",
] as const);

export interface LocalDataManifest {
  readonly schemaVersion: typeof LOCAL_DATA_MANIFEST_SCHEMA_VERSION;
  readonly gameDataSchemaVersion: typeof GAME_DATA_SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly files: readonly string[];
}

export type GameDataSchemaVersion = typeof GAME_DATA_SCHEMA_VERSION;
export type DatasetKind =
  | "types"
  | "pokemon"
  | "moves"
  | "abilities"
  | "items"
  | "machines"
  | "trainerTypes"
  | "trainers"
  | "encounters";

export interface DatasetSource {
  readonly game: "Pokemon Z";
  readonly version: "2.12 FR";
  readonly file: string;
  readonly sha256: string;
}

export interface EntitySource {
  readonly game: "Pokemon Z";
  readonly version: "2.12 FR";
  readonly file: string;
  readonly sourceId: number;
  readonly line: number;
}

export interface NormalizedDataset<TKind extends DatasetKind, TRecord> {
  readonly schemaVersion: GameDataSchemaVersion;
  readonly kind: TKind;
  readonly source: DatasetSource;
  readonly count: number;
  readonly records: readonly TRecord[];
}

export interface TypeDefinition {
  readonly id: number;
  readonly internalName: string;
  readonly name: string;
  readonly isPseudoType: boolean;
  readonly isSpecialType: boolean;
  readonly weaknesses: readonly string[];
  readonly resistances: readonly string[];
  readonly immunities: readonly string[];
  readonly raw: Readonly<Record<string, string>>;
  readonly _source: EntitySource;
}

export interface Stats {
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly speed: number;
  readonly specialAttack: number;
  readonly specialDefense: number;
}

export interface LevelUpMove {
  readonly level: number;
  readonly move: string;
}

export interface EvolutionDefinition {
  readonly species: string;
  readonly method: string;
  readonly parameter: string | null;
}

export interface PokemonDefinition {
  readonly id: number;
  readonly internalName: string;
  readonly name: string;
  readonly kind: string;
  readonly pokedexEntry: string;
  readonly types: readonly string[];
  readonly baseStats: Stats;
  readonly effortPoints: Stats;
  readonly genderRate: string;
  readonly growthRate: string;
  readonly baseExperience: number;
  readonly captureRate: number;
  readonly happiness: number;
  readonly abilities: readonly string[];
  readonly hiddenAbilities: readonly string[];
  readonly levelUpMoves: readonly LevelUpMove[];
  readonly eggMoves: readonly string[];
  readonly eggGroups: readonly string[];
  readonly evolutions: readonly EvolutionDefinition[];
  readonly formNames: readonly string[];
  readonly stepsToHatch: number;
  readonly height: number;
  readonly weight: number;
  readonly color: string;
  readonly habitat: string | null;
  readonly wildHeldItems: {
    readonly common: string | null;
    readonly uncommon: string | null;
    readonly rare: string | null;
  };
  readonly spriteMetrics: {
    readonly playerY: number;
    readonly enemyY: number;
    readonly altitude: number;
  };
  readonly raw: Readonly<Record<string, string>>;
  readonly _source: EntitySource;
}

export type MoveCategory = "Physical" | "Special" | "Status";

export interface MoveDefinition {
  readonly id: number;
  readonly internalName: string;
  readonly name: string;
  readonly functionCode: string;
  readonly power: number;
  readonly type: string;
  readonly category: MoveCategory;
  readonly accuracy: number;
  readonly pp: number;
  readonly effectChance: number;
  readonly targetCode: string;
  readonly priority: number;
  readonly flags: string;
  readonly description: string;
  readonly raw: readonly string[];
  readonly _source: EntitySource;
}

export interface AbilityDefinition {
  readonly id: number;
  readonly internalName: string;
  readonly name: string;
  readonly description: string;
  readonly raw: readonly string[];
  readonly _source: EntitySource;
}

export interface ItemDefinition {
  readonly id: number;
  readonly internalName: string;
  readonly name: string;
  readonly pluralName: string;
  readonly pocket: number;
  readonly price: number;
  readonly description: string;
  readonly fieldUse: number;
  readonly battleUse: number;
  readonly itemType: number | null;
  readonly machineMove: string | null;
  readonly raw: readonly string[];
  readonly _source: EntitySource;
}

export interface MachineCompatibilityDefinition {
  readonly id: number;
  readonly internalName: string;
  readonly move: string;
  readonly species: readonly string[];
  readonly raw: readonly string[];
  readonly _source: EntitySource;
}

export type TrainerGender = "Male" | "Female" | "Mixed" | null;

export interface TrainerTypeDefinition {
  readonly id: number;
  readonly internalName: string;
  readonly name: string;
  readonly baseMoney: number;
  readonly battleBgm: string | null;
  readonly victoryMe: string | null;
  readonly introMe: string | null;
  readonly gender: TrainerGender;
  readonly skillLevel: number | null;
  readonly skillCodes: string | null;
  readonly raw: readonly string[];
  readonly _source: EntitySource;
}

export interface TrainerPokemonDefinition {
  readonly species: string;
  readonly level: number;
  readonly heldItem: string | null;
  readonly moves: readonly (string | null)[];
  readonly abilityIndex: number | null;
  readonly gender: "Male" | "Female" | null;
  readonly form: number | null;
  readonly shiny: boolean;
  readonly nature: string | null;
  readonly iv: number | null;
  readonly happiness: number | null;
  readonly nickname: string | null;
  readonly shadow: boolean;
  readonly pokeBall: string | null;
  readonly raw: readonly string[];
  readonly line: number;
}

export interface TrainerDefinition {
  readonly id: number;
  readonly internalName: string;
  readonly trainerType: string;
  readonly name: string;
  readonly version: number;
  readonly items: readonly string[];
  readonly pokemon: readonly TrainerPokemonDefinition[];
  readonly raw: readonly (readonly string[])[];
  readonly _source: EntitySource;
}

export interface EncounterSlotDefinition {
  readonly species: string;
  readonly minimumLevel: number;
  readonly maximumLevel: number;
  readonly weight: number | null;
  readonly line: number;
}

export interface EncounterMethodDefinition {
  readonly method: string;
  readonly slots: readonly EncounterSlotDefinition[];
}

export interface EncounterDefinition {
  readonly id: number;
  readonly internalName: string;
  readonly mapId: number;
  readonly mapName: string | null;
  readonly encounterRates: {
    readonly land: number;
    readonly cave: number;
    readonly water: number;
  };
  readonly methods: readonly EncounterMethodDefinition[];
  readonly raw: readonly string[];
  readonly _source: EntitySource;
}

export type DiagnosticSeverity = "warning" | "error";

export interface ExtractionDiagnostic {
  readonly severity: DiagnosticSeverity;
  readonly code: "MISSING_ID" | "DUPLICATE_ID" | "DUPLICATE_INTERNAL_NAME";
  readonly dataset: DatasetKind;
  readonly message: string;
  readonly ids?: readonly number[];
  readonly lines?: readonly number[];
}

export interface DatasetSummary {
  readonly records: number;
  readonly uniqueIds: number;
  readonly minId: number | null;
  readonly maxId: number | null;
  readonly missingIds: readonly number[];
  readonly duplicateIds: readonly number[];
}

export interface ExtractionReport {
  readonly schemaVersion: GameDataSchemaVersion;
  readonly source: {
    readonly game: "Pokemon Z";
    readonly version: "2.12 FR";
  };
  readonly datasets: Readonly<Record<DatasetKind, DatasetSummary>>;
  readonly diagnostics: readonly ExtractionDiagnostic[];
}

export type ReferenceIssueCode =
  | "UNKNOWN_TYPE"
  | "UNKNOWN_ABILITY"
  | "UNKNOWN_MOVE"
  | "UNKNOWN_POKEMON"
  | "UNKNOWN_ITEM"
  | "UNKNOWN_TRAINER_TYPE"
  | "UNKNOWN_MAP"
  | "UNKNOWN_EVOLUTION_METHOD"
  | "INVALID_EVOLUTION_PARAMETER"
  | "AMBIGUOUS_REFERENCE";

export interface ReferenceIssue {
  readonly severity: "warning" | "error";
  readonly code: ReferenceIssueCode;
  readonly dataset: DatasetKind;
  readonly recordId: number;
  readonly internalName: string;
  readonly field: string;
  readonly reference: string;
  readonly message: string;
  readonly line: number;
}

export interface DefinitionCollision {
  readonly dataset: DatasetKind;
  readonly field: "id" | "internalName";
  readonly value: string;
  readonly ids: readonly number[];
  readonly lines: readonly number[];
}

export interface UnreferencedDefinition {
  readonly dataset: DatasetKind;
  readonly id: number;
  readonly internalName: string;
}

export interface CompiledFileComparison {
  readonly file: string;
  readonly sha256: string;
  readonly status: "match" | "mismatch";
  readonly checkedRecords: number;
  readonly mismatches: readonly string[];
}

export interface ValidationReport {
  readonly schemaVersion: GameDataSchemaVersion;
  readonly source: {
    readonly game: "Pokemon Z";
    readonly version: "2.12 FR";
  };
  readonly summary: {
    readonly checkedReferences: number;
    readonly validReferences: number;
    readonly errors: number;
    readonly warnings: number;
    readonly collisions: number;
    readonly provisionalUnreferencedDefinitions: number;
  };
  readonly issues: readonly ReferenceIssue[];
  readonly collisions: readonly DefinitionCollision[];
  readonly unreferencedScope: string;
  readonly unreferencedDefinitions: readonly UnreferencedDefinition[];
  readonly compiledComparisons: readonly CompiledFileComparison[];
}

export interface EngineMechanicSupportEntry {
  readonly key: string;
  readonly extracted: true;
  readonly engineSupport: "not-implemented" | "partial" | "supported";
}

export type EngineMechanicCategory =
  | "typeInteractions"
  | "moveFunctionCodes"
  | "abilities"
  | "itemTypes"
  | "evolutionMethods";

export interface EngineSupportReport {
  readonly schemaVersion: GameDataSchemaVersion;
  readonly engineState: "not-started" | "in-development" | "available";
  readonly categories: Readonly<
    Record<EngineMechanicCategory, readonly EngineMechanicSupportEntry[]>
  >;
  readonly summary: {
    readonly extractedMechanics: number;
    readonly supportedMechanics: number;
    readonly coveragePercent: number;
  };
}
