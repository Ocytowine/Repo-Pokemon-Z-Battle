import type {
  EncounterDefinition,
  EncounterMethodDefinition,
  EncounterSlotDefinition,
  NormalizedDataset,
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

const METHOD_WEIGHTS: Readonly<Record<string, readonly number[]>> = {
  Land: [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1],
  Cave: [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1],
  LandMorning: [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1],
  LandDay: [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1],
  LandNight: [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1],
  BugContest: [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1],
  Water: [60, 30, 5, 4, 1],
  RockSmash: [60, 30, 5, 4, 1],
  OldRod: [70, 30],
  GoodRod: [60, 20, 20],
  SuperRod: [40, 40, 15, 4, 1],
  HeadbuttLow: [30, 25, 20, 10, 5, 5, 4, 1],
  HeadbuttHigh: [30, 25, 20, 10, 5, 5, 4, 1],
};

function meaningfulLines(text: string): readonly SourceLine[] {
  return normalizeLines(text)
    .map((line, index) => ({ line: index + 1, text: line.trim() }))
    .filter(({ text: line }) => line !== "" && !/^#+$/u.test(line));
}

function isHeader(text: string): boolean {
  return /^\d+(?:\s*#.*)?$/u.test(text);
}

function applyWeights(method: string, slots: readonly EncounterSlotDefinition[]): readonly EncounterSlotDefinition[] {
  const weights = METHOD_WEIGHTS[method];
  if (weights === undefined || weights.length !== slots.length) return slots;
  return slots.map((slot, index) => ({ ...slot, weight: weights[index] ?? null }));
}

export function parseEncounters(
  text: string,
  context: ParserContext,
): NormalizedDataset<"encounters", EncounterDefinition> {
  const lines = meaningfulLines(text);
  const records: EncounterDefinition[] = [];
  let cursor = 0;
  while (cursor < lines.length) {
    const header = lines[cursor];
    if (header === undefined || !isHeader(header.text)) {
      throw new PbsParseError("ID de carte attendu.", context.file, header?.line ?? 1);
    }
    const match = /^(\d+)(?:\s*#\s*(.*))?$/u.exec(header.text);
    const mapId = parseInteger(match?.[1] ?? "", "ID de carte", context.file, header.line);
    const mapName = match?.[2]?.trim() || null;
    cursor += 1;
    const rateLine = lines[cursor];
    if (rateLine === undefined) {
      throw new PbsParseError("Taux de rencontre absents.", context.file, header.line);
    }
    const rates = parseCsvLine(rateLine.text, context.file, rateLine.line);
    if (rates.length !== 3) {
      throw new PbsParseError("Trois taux de rencontre sont attendus.", context.file, rateLine.line);
    }
    cursor += 1;
    const methods: EncounterMethodDefinition[] = [];
    let currentMethod: { method: string; slots: EncounterSlotDefinition[] } | null = null;
    const flushMethod = (): void => {
      if (currentMethod === null) return;
      const expectedWeights = METHOD_WEIGHTS[currentMethod.method];
      if (expectedWeights !== undefined && expectedWeights.length !== currentMethod.slots.length) {
        throw new PbsParseError(
          `${currentMethod.method} contient ${currentMethod.slots.length} emplacements, ${expectedWeights.length} attendus.`,
          context.file,
          header.line,
        );
      }
      methods.push({
        method: currentMethod.method,
        slots: applyWeights(currentMethod.method, currentMethod.slots),
      });
      currentMethod = null;
    };
    const raw = [header.text, rateLine.text];
    while (cursor < lines.length && !isHeader(lines[cursor]?.text ?? "")) {
      const line = lines[cursor];
      if (line === undefined) break;
      raw.push(line.text);
      const fields = parseCsvLine(line.text, context.file, line.line);
      if (fields.length === 1) {
        flushMethod();
        currentMethod = { method: fields[0] ?? "", slots: [] };
      } else {
        if (currentMethod === null) {
          throw new PbsParseError("Methode de rencontre attendue.", context.file, line.line);
        }
        if (fields.length !== 3) {
          throw new PbsParseError("Une rencontre doit contenir espece, niveau min et niveau max.", context.file, line.line);
        }
        currentMethod.slots.push({
          species: fields[0] ?? "",
          minimumLevel: parseInteger(fields[1] ?? "", "niveau minimum", context.file, line.line),
          maximumLevel: parseInteger(fields[2] ?? "", "niveau maximum", context.file, line.line),
          weight: null,
          line: line.line,
        });
      }
      cursor += 1;
    }
    flushMethod();
    records.push({
      id: mapId,
      internalName: String(mapId),
      mapId,
      mapName,
      encounterRates: {
        land: parseInteger(rates[0] ?? "", "taux terrestre", context.file, rateLine.line),
        cave: parseInteger(rates[1] ?? "", "taux grotte", context.file, rateLine.line),
        water: parseInteger(rates[2] ?? "", "taux aquatique", context.file, rateLine.line),
      },
      methods,
      raw,
      _source: createEntitySource(mapId, header.line, context.file),
    });
  }
  return createDataset("encounters", context, records);
}
