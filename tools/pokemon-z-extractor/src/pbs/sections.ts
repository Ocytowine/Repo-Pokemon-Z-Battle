import { PbsParseError } from "./errors.js";
import { normalizeLines } from "./text.js";

export interface PbsSection {
  readonly id: number;
  readonly line: number;
  readonly properties: Readonly<Record<string, string>>;
}

export function parseSectionDocument(text: string, file: string): readonly PbsSection[] {
  const sections: PbsSection[] = [];
  const lines = normalizeLines(text.startsWith("\uFEFF") ? text.slice(1) : text);
  let currentId: number | undefined;
  let currentLine = 0;
  let properties: Record<string, string> = {};

  function finishSection(): void {
    if (currentId === undefined) return;
    sections.push({ id: currentId, line: currentLine, properties });
  }

  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;

    const sectionMatch = /^\[\s*(\d+)\s*\]$/u.exec(line);
    if (sectionMatch !== null) {
      finishSection();
      currentId = Number(sectionMatch[1]);
      currentLine = lineNumber;
      properties = {};
      continue;
    }

    if (currentId === undefined) {
      throw new PbsParseError("Propriete rencontree avant la premiere section.", file, lineNumber);
    }

    const propertyMatch = /^([A-Za-z][A-Za-z0-9]*)\s*=\s*(.*)$/u.exec(rawLine.trimStart());
    if (propertyMatch === null) {
      throw new PbsParseError("Ligne de propriete invalide.", file, lineNumber);
    }

    const key = propertyMatch[1];
    const value = propertyMatch[2];
    if (key === undefined || value === undefined) {
      throw new PbsParseError("Ligne de propriete incomplete.", file, lineNumber);
    }
    if (Object.hasOwn(properties, key)) {
      throw new PbsParseError(`Propriete dupliquee : ${key}.`, file, lineNumber);
    }
    properties[key] = value;
  }

  finishSection();
  return sections;
}
