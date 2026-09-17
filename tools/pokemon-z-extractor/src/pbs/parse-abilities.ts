import type { AbilityDefinition, NormalizedDataset } from "@pokemon-z-battle/game-data";
import {
  createDataset,
  createEntitySource,
  type ParserContext,
} from "../domain/game-data.js";
import type { PbsCsvRow } from "./csv.js";
import { assertFieldCount, parseInteger } from "./values.js";

export function parseAbilities(
  rows: readonly PbsCsvRow[],
  context: ParserContext,
): NormalizedDataset<"abilities", AbilityDefinition> {
  const records = rows.map((row): AbilityDefinition => {
    assertFieldCount(row.values, 4, context.file, row.line);
    const [rawId, internalName, name, description] = row.values;
    const id = parseInteger(rawId ?? "", "ID", context.file, row.line);

    return {
      id,
      internalName: internalName ?? "",
      name: name ?? "",
      description: description ?? "",
      raw: row.values,
      _source: createEntitySource(id, row.line, context.file),
    };
  });

  return createDataset("abilities", context, records);
}
