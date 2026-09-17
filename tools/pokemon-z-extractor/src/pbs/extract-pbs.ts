import type {
  AbilityDefinition,
  DatasetKind,
  EncounterDefinition,
  EngineSupportReport,
  ExtractionReport,
  ItemDefinition,
  MoveDefinition,
  NormalizedDataset,
  PokemonDefinition,
  TrainerDefinition,
  TrainerTypeDefinition,
  TypeDefinition,
  ValidationReport,
} from "@pokemon-z-battle/game-data";
import path from "node:path";
import { writeJsonAtomically } from "../io/write-json.js";
import { hashFile } from "../inventory/hash-file.js";
import { assertOutputOutsideSource } from "../inventory/path-safety.js";
import { validatePokemonZSource } from "../inventory/source-validation.js";
import { parseAbilities } from "./parse-abilities.js";
import { createExtractionReport, analyzeDataset } from "./diagnostics.js";
import { parseCsvDocument } from "./csv.js";
import { parseItems } from "./parse-items.js";
import { parseMoves } from "./parse-moves.js";
import { parsePokemon } from "./parse-pokemon.js";
import { parseSectionDocument } from "./sections.js";
import { readPbsText } from "./text.js";
import { parseTypes } from "./parse-types.js";
import { parseTrainerTypes } from "./parse-trainer-types.js";
import { parseTrainers } from "./parse-trainers.js";
import { parseEncounters } from "./parse-encounters.js";
import { createEngineSupportReport } from "../validation/engine-support.js";
import { validateReferences } from "../validation/validate-references.js";

const PBS_FILES = {
  types: "PBS/types.txt",
  pokemon: "PBS/pokemon.txt",
  moves: "PBS/moves.txt",
  abilities: "PBS/abilities.txt",
  items: "PBS/items.txt",
  trainerTypes: "PBS/trainertypes.txt",
  trainers: "PBS/trainers.txt",
  encounters: "PBS/encounters.txt",
} as const satisfies Readonly<Record<DatasetKind, string>>;

interface LoadedPbsFile {
  readonly relativePath: string;
  readonly text: string;
  readonly sha256: string;
}

export interface PbsExtractionResult {
  readonly outputDirectory: string;
  readonly report: ExtractionReport;
  readonly validationReport: ValidationReport;
  readonly engineSupportReport: EngineSupportReport;
  readonly files: readonly string[];
}

async function loadPbsFile(sourceDirectory: string, relativePath: string): Promise<LoadedPbsFile> {
  const absolutePath = path.join(sourceDirectory, ...relativePath.split("/"));
  const [text, sha256] = await Promise.all([readPbsText(absolutePath), hashFile(absolutePath)]);
  return { relativePath, text, sha256 };
}

function context(file: LoadedPbsFile): { readonly file: string; readonly sha256: string } {
  return { file: file.relativePath, sha256: file.sha256 };
}

export async function extractPbsData(
  sourceDirectory: string,
  outputDirectory: string,
): Promise<PbsExtractionResult> {
  const paths = await assertOutputOutsideSource(sourceDirectory, outputDirectory);
  await validatePokemonZSource(paths.source);

  const [typesFile, pokemonFile, movesFile, abilitiesFile, itemsFile, trainerTypesFile,
    trainersFile, encountersFile] = await Promise.all([
    loadPbsFile(paths.source, PBS_FILES.types),
    loadPbsFile(paths.source, PBS_FILES.pokemon),
    loadPbsFile(paths.source, PBS_FILES.moves),
    loadPbsFile(paths.source, PBS_FILES.abilities),
    loadPbsFile(paths.source, PBS_FILES.items),
    loadPbsFile(paths.source, PBS_FILES.trainerTypes),
    loadPbsFile(paths.source, PBS_FILES.trainers),
    loadPbsFile(paths.source, PBS_FILES.encounters),
  ]);

  const types: NormalizedDataset<"types", TypeDefinition> = parseTypes(
    parseSectionDocument(typesFile.text, typesFile.relativePath),
    context(typesFile),
  );
  const pokemon: NormalizedDataset<"pokemon", PokemonDefinition> = parsePokemon(
    parseSectionDocument(pokemonFile.text, pokemonFile.relativePath),
    context(pokemonFile),
  );
  const moves: NormalizedDataset<"moves", MoveDefinition> = parseMoves(
    parseCsvDocument(movesFile.text, movesFile.relativePath),
    context(movesFile),
  );
  const abilities: NormalizedDataset<"abilities", AbilityDefinition> = parseAbilities(
    parseCsvDocument(abilitiesFile.text, abilitiesFile.relativePath),
    context(abilitiesFile),
  );
  const items: NormalizedDataset<"items", ItemDefinition> = parseItems(
    parseCsvDocument(itemsFile.text, itemsFile.relativePath),
    context(itemsFile),
  );
  const trainerTypes: NormalizedDataset<"trainerTypes", TrainerTypeDefinition> = parseTrainerTypes(
    parseCsvDocument(trainerTypesFile.text, trainerTypesFile.relativePath),
    context(trainerTypesFile),
  );
  const trainers: NormalizedDataset<"trainers", TrainerDefinition> = parseTrainers(
    trainersFile.text,
    context(trainersFile),
  );
  const encounters: NormalizedDataset<"encounters", EncounterDefinition> = parseEncounters(
    encountersFile.text,
    context(encountersFile),
  );

  const report = createExtractionReport({
    types: analyzeDataset("types", types.records),
    pokemon: analyzeDataset("pokemon", pokemon.records),
    moves: analyzeDataset("moves", moves.records),
    abilities: analyzeDataset("abilities", abilities.records),
    items: analyzeDataset("items", items.records),
    trainerTypes: analyzeDataset("trainerTypes", trainerTypes.records),
    trainers: analyzeDataset("trainers", trainers.records),
    encounters: analyzeDataset("encounters", encounters.records, { detectMissingIds: false }),
  });
  const normalizedData = {
    types,
    pokemon,
    moves,
    abilities,
    items,
    trainerTypes,
    trainers,
    encounters,
  };
  const [validationReport, engineSupportReport] = await Promise.all([
    validateReferences(normalizedData, paths.source),
    Promise.resolve(createEngineSupportReport(normalizedData)),
  ]);

  const outputs = await Promise.all([
    writeJsonAtomically(paths.output, "types.json", types),
    writeJsonAtomically(paths.output, "pokemon.json", pokemon),
    writeJsonAtomically(paths.output, "moves.json", moves),
    writeJsonAtomically(paths.output, "abilities.json", abilities),
    writeJsonAtomically(paths.output, "items.json", items),
    writeJsonAtomically(paths.output, "trainer-types.json", trainerTypes),
    writeJsonAtomically(paths.output, "trainers.json", trainers),
    writeJsonAtomically(paths.output, "encounters.json", encounters),
    writeJsonAtomically(paths.output, "extraction-report.json", report),
    writeJsonAtomically(paths.output, "validation-report.json", validationReport),
    writeJsonAtomically(paths.output, "engine-support-report.json", engineSupportReport),
  ]);

  return {
    outputDirectory: paths.output,
    report,
    validationReport,
    engineSupportReport,
    files: outputs,
  };
}
