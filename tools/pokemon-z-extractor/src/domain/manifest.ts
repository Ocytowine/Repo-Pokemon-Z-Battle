export const MANIFEST_SCHEMA_VERSION = "1.0.0" as const;
export const EXTRACTOR_NAME = "@pokemon-z-battle/extractor" as const;
export const EXTRACTOR_VERSION = "0.1.0" as const;

export interface SourceFileEntry {
  readonly path: string;
  readonly size: number;
  readonly sha256: string;
}

export interface SourceManifest {
  readonly schemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  readonly generator: {
    readonly name: typeof EXTRACTOR_NAME;
    readonly version: typeof EXTRACTOR_VERSION;
  };
  readonly source: {
    readonly game: "Pokemon Z";
    readonly version: "2.12 FR";
    readonly rootSha256: string;
  };
  readonly summary: {
    readonly fileCount: number;
    readonly totalBytes: number;
  };
  readonly files: readonly SourceFileEntry[];
}
