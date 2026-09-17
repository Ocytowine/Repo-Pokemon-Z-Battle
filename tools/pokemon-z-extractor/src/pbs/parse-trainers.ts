import type {
  NormalizedDataset,
  TrainerDefinition,
  TrainerPokemonDefinition,
} from "@pokemon-z-battle/game-data";
import { createDataset, createEntitySource, type ParserContext } from "../domain/game-data.js";
import { parseCsvLine } from "./csv.js";
import { PbsParseError } from "./errors.js";
import { normalizeLines } from "./text.js";
import { parseInteger } from "./values.js";

interface SourceLine {
  readonly line: number;
  readonly text: string;
}

function optional(value: string | undefined): string | null {
  return value === undefined || value === "" ? null : value;
}

function optionalInteger(
  value: string | undefined,
  label: string,
  context: ParserContext,
  line: number,
): number | null {
  return value === undefined || value === ""
    ? null
    : parseInteger(value, label, context.file, line);
}

function optionalGender(
  value: string | undefined,
  context: ParserContext,
  line: number,
): "Male" | "Female" | null {
  if (value === undefined || value === "") return null;
  if (value === "M" || value === "Male" || value === "0") return "Male";
  if (value === "F" || value === "Female" || value === "1") return "Female";
  throw new PbsParseError(`Genre invalide : ${value}.`, context.file, line);
}

function sourceBlocks(text: string): readonly (readonly SourceLine[])[] {
  const blocks: SourceLine[][] = [];
  let current: SourceLine[] = [];
  const flush = (): void => {
    if (current.length > 0) blocks.push(current);
    current = [];
  };
  for (const [index, rawLine] of normalizeLines(text).entries()) {
    const line = rawLine.trim();
    if (line.startsWith("#")) {
      flush();
    } else if (line !== "") {
      current.push({ line: index + 1, text: rawLine });
    }
  }
  flush();
  return blocks;
}

function parseMember(line: SourceLine, context: ParserContext): TrainerPokemonDefinition {
  const fields = parseCsvLine(line.text, context.file, line.line);
  if (fields.length < 2 || fields.length > 17) {
    throw new PbsParseError(
      `Pokemon de dresseur : ${fields.length} champs, attendu entre 2 et 17.`,
      context.file,
      line.line,
    );
  }
  const [species, rawLevel, heldItem, ...options] = fields;
  const moves = [options[0], options[1], options[2], options[3]].map(optional);
  return {
    species: species ?? "",
    level: parseInteger(rawLevel ?? "", "niveau", context.file, line.line),
    heldItem: optional(heldItem),
    moves,
    abilityIndex: optionalInteger(options[4], "index de talent", context, line.line),
    gender: optionalGender(options[5], context, line.line),
    form: optionalInteger(options[6], "forme", context, line.line),
    shiny: options[7]?.toLowerCase() === "true" || options[7] === "1",
    nature: optional(options[8]),
    iv: optionalInteger(options[9], "IV", context, line.line),
    happiness: optionalInteger(options[10], "bonheur", context, line.line),
    nickname: optional(options[11]),
    shadow: options[12]?.toLowerCase() === "true" || options[12] === "1",
    pokeBall: optional(options[13]),
    raw: fields,
    line: line.line,
  };
}

export function parseTrainers(
  text: string,
  context: ParserContext,
): NormalizedDataset<"trainers", TrainerDefinition> {
  const records = sourceBlocks(text).map((block, id): TrainerDefinition => {
    const first = block[0];
    if (first === undefined || block.length < 4) {
      throw new PbsParseError("Bloc de dresseur incomplet.", context.file, first?.line ?? 1);
    }
    const trainerTypeFields = parseCsvLine(first.text, context.file, first.line);
    if (trainerTypeFields.length !== 1 || trainerTypeFields[0] === "") {
      throw new PbsParseError("Type de dresseur invalide.", context.file, first.line);
    }
    const identity = parseCsvLine(block[1]?.text ?? "", context.file, block[1]?.line ?? first.line);
    if (identity.length < 1 || identity.length > 2 || identity[0] === "") {
      throw new PbsParseError("Identite de dresseur invalide.", context.file, block[1]?.line ?? first.line);
    }
    const party = parseCsvLine(block[2]?.text ?? "", context.file, block[2]?.line ?? first.line);
    const declaredCount = parseInteger(
      party[0] ?? "",
      "taille d'equipe",
      context.file,
      block[2]?.line ?? first.line,
    );
    const members = block.slice(3).map((line) => parseMember(line, context));
    if (declaredCount !== members.length) {
      throw new PbsParseError(
        `Equipe annoncee a ${declaredCount} Pokemon, ${members.length} lignes trouvees.`,
        context.file,
        block[2]?.line ?? first.line,
      );
    }
    const trainerType = trainerTypeFields[0] ?? "";
    const name = identity[0] ?? "";
    const version = identity[1] === undefined || identity[1] === ""
      ? 0
      : parseInteger(identity[1], "version", context.file, block[1]?.line ?? first.line);
    return {
      id,
      internalName: JSON.stringify([trainerType, name, version]),
      trainerType,
      name,
      version,
      items: party.slice(1).filter((item) => item !== ""),
      pokemon: members,
      raw: block.map((line) => parseCsvLine(line.text, context.file, line.line)),
      _source: createEntitySource(id, first.line, context.file),
    };
  });
  return createDataset("trainers", context, records);
}
