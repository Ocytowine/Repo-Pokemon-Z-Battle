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
export { buildPlayerAvatarCatalog, PLAYER_AVATAR_CATALOG_SCHEMA_VERSION,
  type PlayerAvatarAssetReference, type PlayerAvatarAuditReport, type PlayerAvatarCatalog,
  type PlayerAvatarCatalogRecord, type PlayerAvatarContext } from "./assets/player-avatar-catalog.js";
export { extractWorldMaps, type WorldMapExtractionResult } from "./runtime/extract-world-maps.js";
export { prepareLocalTest, type LocalTestPreparationResult } from "./runtime/prepare-local-test.js";
export { extractEvents, type EventExtractionResult } from "./runtime/extract-events.js";
export { extractScriptHooks, type ScriptHookExtractionResult } from "./runtime/extract-script-hooks.js";
export { SCRIPT_FAMILY_POLICIES, classifyRubyHook, normalizeRubySignature, portTargetRubyLine, type CoopPolicy, type PortedScriptAction, type ScriptFamilyPolicy, type ScriptHookFamily } from "./runtime/script-hooks.js";
export { convertEventCommand, convertEventPage, convertMoveCommand, convertMoveRoute, rubyValueToJson, type EventAstCommand, type EventCommandFamily, type EventCommandStatus, type EventPageAst } from "./runtime/event-ast.js";
export { buildCollisionMasks, extractSimpleTransfers, normalizeTilesets, normalizeWorldMap, renderMapPreview, tileAllowsDirection } from "./runtime/world-map.js";
export { parseMapBattleMetadata, type MapBattleMetadata } from "./runtime/extract-map-metadata.js";
export { classifyPokemonAsset, normalizedWebPath } from "./assets/classify-assets.js";
export { readImageDimensions, readImageMetadata, type ImageDimensions, type ImageMetadata } from "./assets/image-metadata.js";
export { createEngineSupportReport, type EngineSupportInput } from "./validation/engine-support.js";
export {
  validateReferences,
  type ReferenceValidationInput,
} from "./validation/validate-references.js";
