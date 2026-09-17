import type {
  MoveCategory,
  MoveDefinition,
  NormalizedDataset,
} from "@pokemon-z-battle/game-data";
import {
  createDataset,
  createEntitySource,
  type ParserContext,
} from "../domain/game-data.js";
import type { PbsCsvRow } from "./csv.js";
import { PbsParseError } from "./errors.js";
import { assertFieldCount, parseInteger } from "./values.js";

function parseCategory(value: string, context: ParserContext, line: number): MoveCategory {
  if (value === "Physical" || value === "Special" || value === "Status") return value;
  throw new PbsParseError(`Categorie d'attaque inconnue : ${value}.`, context.file, line);
}

export function parseMoves(
  rows: readonly PbsCsvRow[],
  context: ParserContext,
): NormalizedDataset<"moves", MoveDefinition> {
  const records = rows.map((row): MoveDefinition => {
    assertFieldCount(row.values, 14, context.file, row.line);
    const [
      rawId,
      internalName,
      name,
      functionCode,
      rawPower,
      type,
      rawCategory,
      rawAccuracy,
      rawPp,
      rawEffectChance,
      targetCode,
      rawPriority,
      flags,
      description,
    ] = row.values;
    const id = parseInteger(rawId ?? "", "ID", context.file, row.line);

    return {
      id,
      internalName: internalName ?? "",
      name: name ?? "",
      functionCode: functionCode ?? "",
      power: parseInteger(rawPower ?? "", "puissance", context.file, row.line),
      type: type ?? "",
      category: parseCategory(rawCategory ?? "", context, row.line),
      accuracy: parseInteger(rawAccuracy ?? "", "precision", context.file, row.line),
      pp: parseInteger(rawPp ?? "", "PP", context.file, row.line),
      effectChance: parseInteger(
        rawEffectChance ?? "",
        "chance d'effet",
        context.file,
        row.line,
      ),
      targetCode: targetCode ?? "",
      priority: parseInteger(rawPriority ?? "", "priorite", context.file, row.line),
      flags: flags ?? "",
      description: description ?? "",
      raw: row.values,
      _source: createEntitySource(id, row.line, context.file),
    };
  });

  return createDataset("moves", context, records);
}
