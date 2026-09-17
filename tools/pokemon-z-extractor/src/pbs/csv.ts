import { PbsParseError } from "./errors.js";
import { normalizeLines } from "./text.js";

export interface PbsCsvRow {
  readonly line: number;
  readonly values: readonly string[];
}

export function parseCsvLine(line: string, file: string, lineNumber: number): readonly string[] {
  const values: string[] = [];
  let value = "";
  let inQuotes = false;
  let quoted = false;
  let quoteClosed = false;

  function pushValue(): void {
    values.push(quoted ? value : value.trim());
    value = "";
    quoted = false;
    quoteClosed = false;
  }

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === undefined) continue;

    if (inQuotes) {
      if (character === '"') {
        if (line[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          inQuotes = false;
          quoteClosed = true;
        }
      } else {
        value += character;
      }
      continue;
    }

    if (quoteClosed) {
      if (character === ",") {
        pushValue();
      } else if (!/\s/u.test(character)) {
        throw new PbsParseError("Caractere inattendu apres un champ CSV cite.", file, lineNumber);
      }
      continue;
    }

    if (character === ",") {
      pushValue();
    } else if (character === '"' && value.trim() === "") {
      value = "";
      quoted = true;
      inQuotes = true;
    } else {
      value += character;
    }
  }

  if (inQuotes) {
    throw new PbsParseError("Champ CSV cite non termine.", file, lineNumber);
  }
  pushValue();
  return values;
}

export function parseCsvDocument(text: string, file: string): readonly PbsCsvRow[] {
  const rows: PbsCsvRow[] = [];
  const lines = normalizeLines(text.startsWith("\uFEFF") ? text.slice(1) : text);

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    rows.push({ line: index + 1, values: parseCsvLine(rawLine, file, index + 1) });
  }

  return rows;
}
