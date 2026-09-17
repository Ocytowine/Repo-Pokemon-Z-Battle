import type {
  DatasetKind,
  DatasetSource,
  EntitySource,
  GameDataSchemaVersion,
  NormalizedDataset,
} from "@pokemon-z-battle/game-data";

export const GAME_DATA_SCHEMA_VERSION = "1.0.0" as const satisfies GameDataSchemaVersion;

export interface ParserContext {
  readonly file: string;
  readonly sha256: string;
}

export function createEntitySource(id: number, line: number, file: string): EntitySource {
  return {
    game: "Pokemon Z",
    version: "2.12 FR",
    file,
    sourceId: id,
    line,
  };
}

export function createDataset<TKind extends DatasetKind, TRecord>(
  kind: TKind,
  context: ParserContext,
  records: readonly TRecord[],
): NormalizedDataset<TKind, TRecord> {
  const source: DatasetSource = {
    game: "Pokemon Z",
    version: "2.12 FR",
    file: context.file,
    sha256: context.sha256,
  };

  return {
    schemaVersion: GAME_DATA_SCHEMA_VERSION,
    kind,
    source,
    count: records.length,
    records,
  };
}
