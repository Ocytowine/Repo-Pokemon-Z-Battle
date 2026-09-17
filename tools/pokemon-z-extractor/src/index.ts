export {
  EXTRACTOR_NAME,
  EXTRACTOR_VERSION,
  MANIFEST_SCHEMA_VERSION,
  type SourceFileEntry,
  type SourceManifest,
} from "./domain/manifest.js";
export { buildSourceManifest } from "./inventory/build-manifest.js";
export {
  createInventory,
  type CreateInventoryOptions,
} from "./inventory/create-inventory.js";
export { assertOutputOutsideSource } from "./inventory/path-safety.js";
export { validatePokemonZSource } from "./inventory/source-validation.js";
export { extractPbsData, type PbsExtractionResult } from "./pbs/extract-pbs.js";
export { parseCsvDocument, parseCsvLine, type PbsCsvRow } from "./pbs/csv.js";
export { parseSectionDocument, type PbsSection } from "./pbs/sections.js";
export { parseTrainerTypes } from "./pbs/parse-trainer-types.js";
export { parseTrainers } from "./pbs/parse-trainers.js";
export { parseEncounters } from "./pbs/parse-encounters.js";
export { readRubyMarshal, RubyMarshalError, RubyMarshalReader } from "./ruby-marshal/reader.js";
export { decodeRpgTable } from "./ruby-marshal/table.js";
export type * from "./ruby-marshal/types.js";
export { extractRuntimeData, type RuntimeExtractionResult } from "./runtime/extract-runtime.js";
export { extractAssets, type AssetManifestEntry } from "./assets/extract-assets.js";
export { classifyPokemonAsset, normalizedWebPath } from "./assets/classify-assets.js";
export { readImageDimensions, readImageMetadata, type ImageDimensions, type ImageMetadata } from "./assets/image-metadata.js";
export { createEngineSupportReport, type EngineSupportInput } from "./validation/engine-support.js";
export {
  validateReferences,
  type ReferenceValidationInput,
} from "./validation/validate-references.js";
