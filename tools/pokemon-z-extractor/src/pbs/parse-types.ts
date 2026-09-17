import type { NormalizedDataset, TypeDefinition } from "@pokemon-z-battle/game-data";
import {
  createDataset,
  createEntitySource,
  type ParserContext,
} from "../domain/game-data.js";
import type { PbsSection } from "./sections.js";
import {
  optionalProperty,
  parseBoolean,
  parseList,
  requireProperty,
} from "./values.js";

export function parseTypes(
  sections: readonly PbsSection[],
  context: ParserContext,
): NormalizedDataset<"types", TypeDefinition> {
  const records = sections.map((section): TypeDefinition => ({
    id: section.id,
    internalName: requireProperty(section, "InternalName", context.file),
    name: requireProperty(section, "Name", context.file),
    isPseudoType: parseBoolean(optionalProperty(section, "IsPseudoType")),
    isSpecialType: parseBoolean(optionalProperty(section, "IsSpecialType")),
    weaknesses: parseList(optionalProperty(section, "Weaknesses"), context.file, section.line),
    resistances: parseList(optionalProperty(section, "Resistances"), context.file, section.line),
    immunities: parseList(optionalProperty(section, "Immunities"), context.file, section.line),
    raw: section.properties,
    _source: createEntitySource(section.id, section.line, context.file),
  }));

  return createDataset("types", context, records);
}
