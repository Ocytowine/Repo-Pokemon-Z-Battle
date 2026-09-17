import type {
  DatasetKind,
  DatasetSummary,
  ExtractionDiagnostic,
  ExtractionReport,
} from "@pokemon-z-battle/game-data";
import { GAME_DATA_SCHEMA_VERSION } from "../domain/game-data.js";

interface IdentifiableRecord {
  readonly id: number;
  readonly internalName: string;
  readonly _source: {
    readonly line: number;
  };
}

export interface DatasetAnalysis {
  readonly summary: DatasetSummary;
  readonly diagnostics: readonly ExtractionDiagnostic[];
}

export function analyzeDataset(
  dataset: DatasetKind,
  records: readonly IdentifiableRecord[],
  options: { readonly detectMissingIds?: boolean } = {},
): DatasetAnalysis {
  const byId = new Map<number, IdentifiableRecord[]>();
  const byInternalName = new Map<string, IdentifiableRecord[]>();

  for (const record of records) {
    const idRecords = byId.get(record.id) ?? [];
    idRecords.push(record);
    byId.set(record.id, idRecords);

    const nameRecords = byInternalName.get(record.internalName) ?? [];
    nameRecords.push(record);
    byInternalName.set(record.internalName, nameRecords);
  }

  const ids = [...byId.keys()].sort((left, right) => left - right);
  const minId = ids[0] ?? null;
  const maxId = ids.at(-1) ?? null;
  const missingIds: number[] = [];
  if (options.detectMissingIds !== false && minId !== null && maxId !== null) {
    for (let id = minId; id <= maxId; id += 1) {
      if (!byId.has(id)) missingIds.push(id);
    }
  }

  const duplicateIds = [...byId.entries()]
    .filter(([, matches]) => matches.length > 1)
    .map(([id]) => id)
    .sort((left, right) => left - right);

  const diagnostics: ExtractionDiagnostic[] = [];
  if (missingIds.length > 0) {
    diagnostics.push({
      severity: "warning",
      code: "MISSING_ID",
      dataset,
      message: `IDs absents entre ${minId} et ${maxId} : ${missingIds.join(", ")}.`,
      ids: missingIds,
    });
  }

  for (const id of duplicateIds) {
    const matches = byId.get(id) ?? [];
    diagnostics.push({
      severity: "warning",
      code: "DUPLICATE_ID",
      dataset,
      message: `ID ${id} present ${matches.length} fois.`,
      ids: [id],
      lines: matches.map((record) => record._source.line),
    });
  }

  for (const [internalName, matches] of [...byInternalName.entries()].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  )) {
    if (matches.length < 2) continue;
    diagnostics.push({
      severity: "warning",
      code: "DUPLICATE_INTERNAL_NAME",
      dataset,
      message: `Nom interne ${internalName} present ${matches.length} fois.`,
      ids: matches.map((record) => record.id),
      lines: matches.map((record) => record._source.line),
    });
  }

  return {
    summary: {
      records: records.length,
      uniqueIds: byId.size,
      minId,
      maxId,
      missingIds,
      duplicateIds,
    },
    diagnostics,
  };
}

export function createExtractionReport(
  analyses: Readonly<Record<DatasetKind, DatasetAnalysis>>,
): ExtractionReport {
  return {
    schemaVersion: GAME_DATA_SCHEMA_VERSION,
    source: {
      game: "Pokemon Z",
      version: "2.12 FR",
    },
    datasets: {
      types: analyses.types.summary,
      pokemon: analyses.pokemon.summary,
      moves: analyses.moves.summary,
      abilities: analyses.abilities.summary,
      items: analyses.items.summary,
      trainerTypes: analyses.trainerTypes.summary,
      trainers: analyses.trainers.summary,
      encounters: analyses.encounters.summary,
    },
    diagnostics: [
      ...analyses.types.diagnostics,
      ...analyses.pokemon.diagnostics,
      ...analyses.moves.diagnostics,
      ...analyses.abilities.diagnostics,
      ...analyses.items.diagnostics,
      ...analyses.trainerTypes.diagnostics,
      ...analyses.trainers.diagnostics,
      ...analyses.encounters.diagnostics,
    ],
  };
}
