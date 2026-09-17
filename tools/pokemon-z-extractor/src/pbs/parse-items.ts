import type { ItemDefinition, NormalizedDataset } from "@pokemon-z-battle/game-data";
import {
  createDataset,
  createEntitySource,
  type ParserContext,
} from "../domain/game-data.js";
import type { PbsCsvRow } from "./csv.js";
import { PbsParseError } from "./errors.js";
import { parseInteger } from "./values.js";

function parseOptionalInteger(
  value: string,
  label: string,
  context: ParserContext,
  line: number,
): number | null {
  return value === "" ? null : parseInteger(value, label, context.file, line);
}

export function parseItems(
  rows: readonly PbsCsvRow[],
  context: ParserContext,
): NormalizedDataset<"items", ItemDefinition> {
  const records = rows.map((row): ItemDefinition => {
    if (row.values.length < 10 || row.values.length > 11) {
      throw new PbsParseError(
        `Nombre de champs invalide : ${row.values.length}, attendu : 10 ou 11.`,
        context.file,
        row.line,
      );
    }
    const [
      rawId,
      internalName,
      name,
      pluralName,
      rawPocket,
      rawPrice,
      description,
      rawFieldUse,
      rawBattleUse,
      rawItemType,
      machineMove,
    ] = row.values;
    const id = parseInteger(rawId ?? "", "ID", context.file, row.line);

    return {
      id,
      internalName: internalName ?? "",
      name: name ?? "",
      pluralName: pluralName ?? "",
      pocket: parseInteger(rawPocket ?? "", "poche", context.file, row.line),
      price: parseInteger(rawPrice ?? "", "prix", context.file, row.line),
      description: description ?? "",
      fieldUse: parseInteger(rawFieldUse ?? "", "usage terrain", context.file, row.line),
      battleUse: parseInteger(rawBattleUse ?? "", "usage combat", context.file, row.line),
      itemType: parseOptionalInteger(rawItemType ?? "", "type d'objet", context, row.line),
      machineMove: machineMove === undefined || machineMove === "" ? null : machineMove,
      raw: row.values,
      _source: createEntitySource(id, row.line, context.file),
    };
  });

  return createDataset("items", context, records);
}
