import type {
  NormalizedDataset,
  TrainerGender,
  TrainerTypeDefinition,
} from "@pokemon-z-battle/game-data";
import { createDataset, createEntitySource, type ParserContext } from "../domain/game-data.js";
import type { PbsCsvRow } from "./csv.js";
import { PbsParseError } from "./errors.js";
import { parseInteger } from "./values.js";

function optional(value: string | undefined): string | null {
  return value === undefined || value === "" ? null : value;
}

function parseGender(value: string | undefined, file: string, line: number): TrainerGender {
  if (value === undefined || value === "") return null;
  if (value === "Male" || value === "Female" || value === "Mixed") return value;
  throw new PbsParseError(`Genre de type de dresseur invalide : ${value}.`, file, line);
}

export function parseTrainerTypes(
  rows: readonly PbsCsvRow[],
  context: ParserContext,
): NormalizedDataset<"trainerTypes", TrainerTypeDefinition> {
  const records = rows.map((row): TrainerTypeDefinition => {
    if (row.values.length !== 10) {
      throw new PbsParseError(
        `Nombre de champs invalide : ${row.values.length}, attendu : 10.`,
        context.file,
        row.line,
      );
    }
    const [rawId, internalName, name, rawMoney, battleBgm, victoryMe, introMe, gender,
      rawSkillLevel, skillCodes] = row.values;
    const id = parseInteger(rawId ?? "", "ID", context.file, row.line);
    return {
      id,
      internalName: internalName ?? "",
      name: name ?? "",
      baseMoney: parseInteger(rawMoney ?? "", "argent de base", context.file, row.line),
      battleBgm: optional(battleBgm),
      victoryMe: optional(victoryMe),
      introMe: optional(introMe),
      gender: parseGender(gender, context.file, row.line),
      skillLevel: rawSkillLevel === undefined || rawSkillLevel === ""
        ? null
        : parseInteger(rawSkillLevel, "niveau d'IA", context.file, row.line),
      skillCodes: optional(skillCodes),
      raw: row.values,
      _source: createEntitySource(id, row.line, context.file),
    };
  });
  return createDataset("trainerTypes", context, records);
}
