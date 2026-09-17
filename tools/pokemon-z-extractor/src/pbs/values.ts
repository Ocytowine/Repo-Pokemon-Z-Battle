import { PbsParseError } from "./errors.js";
import { parseCsvLine } from "./csv.js";
import type { PbsSection } from "./sections.js";

export function requireProperty(section: PbsSection, key: string, file: string): string {
  const value = section.properties[key];
  if (value === undefined || value === "") {
    throw new PbsParseError(`Propriete obligatoire absente : ${key}.`, file, section.line);
  }
  return value;
}

export function optionalProperty(section: PbsSection, key: string): string | null {
  const value = section.properties[key];
  return value === undefined || value === "" ? null : value;
}

export function parseInteger(
  value: string,
  label: string,
  file: string,
  line: number,
): number {
  if (!/^-?\d+$/u.test(value.trim())) {
    throw new PbsParseError(`Entier invalide pour ${label} : ${value}.`, file, line);
  }
  return Number(value);
}

export function parseNumberValue(
  value: string,
  label: string,
  file: string,
  line: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new PbsParseError(`Nombre invalide pour ${label} : ${value}.`, file, line);
  }
  return parsed;
}

export function parseBoolean(value: string | null): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function parseList(value: string | null, file: string, line: number): readonly string[] {
  if (value === null) return [];
  return parseCsvValues(value, file, line).filter((entry) => entry !== "");
}

export function parseCsvValues(
  value: string | null,
  file: string,
  line: number,
): readonly string[] {
  if (value === null) return [];
  return parseCsvLine(value, file, line);
}

export function assertFieldCount(
  fields: readonly string[],
  expected: number,
  file: string,
  line: number,
): void {
  if (fields.length !== expected) {
    throw new PbsParseError(
      `Nombre de champs invalide : ${fields.length}, attendu : ${expected}.`,
      file,
      line,
    );
  }
}
