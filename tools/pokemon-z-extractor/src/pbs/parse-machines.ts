import type { MachineCompatibilityDefinition, NormalizedDataset } from "@pokemon-z-battle/game-data";
import { createDataset, createEntitySource, type ParserContext } from "../domain/game-data.js";
import { PbsParseError } from "./errors.js";
import { normalizeLines } from "./text.js";

/** Parses Pokemon Essentials tm.txt where each move section owns one or more CSV species lines. */
export function parseMachines(text: string,
  context: ParserContext): NormalizedDataset<"machines", MachineCompatibilityDefinition> {
  const records: MachineCompatibilityDefinition[] = [];
  const lines = normalizeLines(text.startsWith("\uFEFF") ? text.slice(1) : text);
  let move: string | null = null;
  let sectionLine = 0;
  let raw: string[] = [];
  let species: string[] = [];

  const finish = (): void => {
    if (move === null) return;
    const id = records.length + 1;
    records.push({ id, internalName: move, move, species: [...new Set(species)], raw,
      _source: createEntitySource(id, sectionLine, context.file) });
  };

  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const header = /^\[\s*([^\]]+)\s*\]$/u.exec(line);
    if (header !== null) {
      finish();
      const name = header[1]?.trim() ?? "";
      if (!/^[A-Za-z0-9_]+$/u.test(name)) {
        throw new PbsParseError("Nom de capacité machine invalide.", context.file, lineNumber);
      }
      move = name;
      sectionLine = lineNumber;
      raw = [rawLine];
      species = [];
      continue;
    }
    if (move === null) {
      throw new PbsParseError("Compatibilité rencontrée avant la première capacité.", context.file, lineNumber);
    }
    raw.push(rawLine);
    const entries = line.split(",").map((entry) => entry.trim()).filter((entry) => entry !== "");
    if (entries.some((entry) => !/^[A-Za-z0-9_]+$/u.test(entry))) {
      throw new PbsParseError("Nom d'espèce compatible invalide.", context.file, lineNumber);
    }
    species.push(...entries);
  }
  finish();
  return createDataset("machines", context, records);
}
