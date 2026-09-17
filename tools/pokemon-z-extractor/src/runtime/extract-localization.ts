import { readFile } from "node:fs/promises";
import path from "node:path";
import { hashFile } from "../inventory/hash-file.js";
import { readRubyMarshal } from "../ruby-marshal/reader.js";
import type { RubyMarshalValue } from "../ruby-marshal/types.js";
import { decodeOrderedHash, rubyText } from "../ruby-marshal/values.js";

export const MESSAGE_CATEGORIES = [
  "mapDialogues",
  "pokemonNames",
  "pokemonKinds",
  "pokedexEntries",
  "pokemonFormNames",
  "moveNames",
  "moveDescriptions",
  "itemNames",
  "itemPluralNames",
  "itemDescriptions",
  "abilityNames",
  "abilityDescriptions",
  "typeNames",
  "trainerTypeNames",
  "trainerNames",
  "trainerBeginSpeech",
  "trainerWinSpeech",
  "trainerLoseSpeech",
  "regionNames",
  "placeNames",
  "placeDescriptions",
  "mapNames",
  "phoneMessages",
  "scriptTexts",
] as const;

export type MessageCategory = typeof MESSAGE_CATEGORIES[number];

export interface LocalizedTextEntry {
  readonly key: string;
  readonly context: string | null;
  readonly value: string;
  readonly provenance: {
    readonly source: "french" | "messages" | "pbs";
    readonly file: string;
    readonly path: string;
    readonly line?: number;
  };
}

export interface LocalizationConflict {
  readonly kind: "translation" | "pbs";
  readonly category: MessageCategory;
  readonly key: string;
  readonly context: string | null;
  readonly lowerPriorityValue: string;
  readonly chosenValue: string;
  readonly resolution: "french-over-messages" | "compiled-over-pbs";
}

export interface LocalizationExtraction {
  readonly catalog: {
    readonly schemaVersion: "1.0.0";
    readonly locale: "fr";
    readonly fallbackLocale: "source";
    readonly priority: readonly ["Data/french.dat", "Data/messages.dat", "PBS"];
    readonly categories: Readonly<Record<MessageCategory, readonly LocalizedTextEntry[]>>;
  };
  readonly report: {
    readonly schemaVersion: "1.0.0";
    readonly sources: readonly { readonly file: string; readonly sha256: string }[];
    readonly summary: {
      readonly entries: number;
      readonly frenchEntries: number;
      readonly messageFallbacks: number;
      readonly pbsFallbacks: number;
      readonly translationConflicts: number;
      readonly pbsConflicts: number;
    };
    readonly categoryCounts: Readonly<Record<MessageCategory, number>>;
    readonly conflicts: readonly LocalizationConflict[];
  };
}

interface PbsValue {
  readonly value: string;
  readonly file: string;
  readonly line: number;
}

export function selectLocalizedValue(
  translated: string | null,
  base: string | null,
  pbs: string | null,
): { readonly value: string; readonly source: "french" | "messages" | "pbs" } | null {
  if (translated !== null) return { value: translated, source: "french" };
  if (base !== null) return { value: base, source: "messages" };
  if (pbs !== null) return { value: pbs, source: "pbs" };
  return null;
}

interface JsonRecord {
  readonly id: number;
  readonly name?: string;
  readonly kind?: string;
  readonly pokedexEntry?: string;
  readonly description?: string;
  readonly pluralName?: string;
  readonly _source: { readonly file: string; readonly line: number };
}

interface JsonDataset {
  readonly records: readonly JsonRecord[];
}

async function readDataset(outputDirectory: string, file: string): Promise<JsonDataset> {
  try {
    return JSON.parse(await readFile(path.join(outputDirectory, file), "utf8")) as JsonDataset;
  } catch (error) {
    throw new Error(`Impossible de lire ${file}. Lancez extract-pbs avant extract-runtime.`, { cause: error });
  }
}

function addPbsFields(
  target: Map<number, Map<string, PbsValue>>,
  category: number,
  records: readonly JsonRecord[],
  field: keyof JsonRecord,
): void {
  const values = new Map<string, PbsValue>();
  for (const record of records) {
    const value = record[field];
    if (typeof value !== "string" || value === "") continue;
    values.set(String(record.id), { value, file: record._source.file, line: record._source.line });
  }
  target.set(category, values);
}

async function loadPbsValues(outputDirectory: string): Promise<Map<number, Map<string, PbsValue>>> {
  const [pokemon, moves, items, abilities, types, trainerTypes] = await Promise.all([
    readDataset(outputDirectory, "pokemon.json"),
    readDataset(outputDirectory, "moves.json"),
    readDataset(outputDirectory, "items.json"),
    readDataset(outputDirectory, "abilities.json"),
    readDataset(outputDirectory, "types.json"),
    readDataset(outputDirectory, "trainer-types.json"),
  ]);
  const result = new Map<number, Map<string, PbsValue>>();
  addPbsFields(result, 1, pokemon.records, "name");
  addPbsFields(result, 2, pokemon.records, "kind");
  addPbsFields(result, 3, pokemon.records, "pokedexEntry");
  addPbsFields(result, 5, moves.records, "name");
  addPbsFields(result, 6, moves.records, "description");
  addPbsFields(result, 7, items.records, "name");
  addPbsFields(result, 8, items.records, "pluralName");
  addPbsFields(result, 9, items.records, "description");
  addPbsFields(result, 10, abilities.records, "name");
  addPbsFields(result, 11, abilities.records, "description");
  addPbsFields(result, 12, types.records, "name");
  addPbsFields(result, 13, trainerTypes.records, "name");
  return result;
}

function asCatalog(value: RubyMarshalValue, file: string): readonly RubyMarshalValue[] {
  if (!Array.isArray(value) || value.length !== MESSAGE_CATEGORIES.length) {
    throw new TypeError(`${file} doit contenir ${MESSAGE_CATEGORIES.length} categories.`);
  }
  return value;
}

function indexedValues(value: RubyMarshalValue): readonly (string | null)[] {
  if (!Array.isArray(value)) throw new TypeError("Tableau de messages indexe attendu.");
  return value.map(rubyText);
}

function orderedValues(value: RubyMarshalValue): readonly (readonly [string, string | null])[] {
  if (value === null) return [];
  return decodeOrderedHash(value);
}

export async function extractLocalization(
  sourceDirectory: string,
  outputDirectory: string,
): Promise<LocalizationExtraction> {
  const messagesPath = path.join(sourceDirectory, "Data", "messages.dat");
  const frenchPath = path.join(sourceDirectory, "Data", "french.dat");
  const [messagesBytes, frenchBytes, pbsValues, messagesHash, frenchHash] = await Promise.all([
    readFile(messagesPath),
    readFile(frenchPath),
    loadPbsValues(outputDirectory),
    hashFile(messagesPath),
    hashFile(frenchPath),
  ]);
  const messages = asCatalog(readRubyMarshal(messagesBytes), "Data/messages.dat");
  const french = asCatalog(readRubyMarshal(frenchBytes), "Data/french.dat");
  const categories = Object.fromEntries(MESSAGE_CATEGORIES.map((name) => [name, []])) as unknown as
    Record<MessageCategory, LocalizedTextEntry[]>;
  const conflicts: LocalizationConflict[] = [];
  let frenchEntries = 0;
  let messageFallbacks = 0;
  let pbsFallbacks = 0;

  const add = (
    categoryIndex: number,
    key: string,
    context: string | null,
    base: string | null,
    translated: string | null,
    basePath: string,
    translatedPath: string,
  ): void => {
    const category = MESSAGE_CATEGORIES[categoryIndex];
    if (category === undefined) throw new TypeError(`Categorie ${categoryIndex} inconnue.`);
    const pbs = context === null ? pbsValues.get(categoryIndex)?.get(key) : undefined;
    const selected = selectLocalizedValue(translated, base, pbs?.value ?? null);
    let entry: LocalizedTextEntry | null = null;
    if (selected?.source === "french") {
      entry = {
        key,
        context,
        value: selected.value,
        provenance: { source: "french", file: "Data/french.dat", path: translatedPath },
      };
      frenchEntries += 1;
      if (base !== null && base !== selected.value) {
        conflicts.push({
          kind: "translation", category, key, context,
          lowerPriorityValue: base, chosenValue: selected.value,
          resolution: "french-over-messages",
        });
      }
    } else if (selected?.source === "messages") {
      entry = {
        key,
        context,
        value: selected.value,
        provenance: { source: "messages", file: "Data/messages.dat", path: basePath },
      };
      messageFallbacks += 1;
    } else if (selected?.source === "pbs" && pbs !== undefined) {
      entry = {
        key,
        context,
        value: selected.value,
        provenance: { source: "pbs", file: pbs.file, path: `record:${key}`, line: pbs.line },
      };
      pbsFallbacks += 1;
    }
    if (entry === null) return;
    if (pbs !== undefined && entry.provenance.source !== "pbs" && pbs.value !== entry.value) {
      conflicts.push({
        kind: "pbs", category, key, context,
        lowerPriorityValue: pbs.value, chosenValue: entry.value,
        resolution: "compiled-over-pbs",
      });
    }
    categories[category].push(entry);
  };

  const orderedCategoryIndexes = new Set([14, 15, 16, 17, 19, 20, 22, 23]);
  for (let categoryIndex = 0; categoryIndex < MESSAGE_CATEGORIES.length; categoryIndex += 1) {
    if (categoryIndex === 0) {
      const baseMaps = messages[0];
      const translatedMaps = french[0];
      if (!Array.isArray(baseMaps) || !Array.isArray(translatedMaps)) {
        throw new TypeError("Categorie mapDialogues invalide.");
      }
      const mapCount = Math.max(baseMaps.length, translatedMaps.length);
      for (let mapId = 0; mapId < mapCount; mapId += 1) {
        const base = new Map(orderedValues(baseMaps[mapId] ?? null));
        const translated = new Map(orderedValues(translatedMaps[mapId] ?? null));
        const keys = [...base.keys(), ...[...translated.keys()].filter((key) => !base.has(key))];
        for (const key of keys) {
          add(0, key, String(mapId), base.get(key) ?? null, translated.get(key) ?? null,
            `categories[0][${mapId}][${JSON.stringify(key)}]`,
            `categories[0][${mapId}][${JSON.stringify(key)}]`);
        }
      }
    } else if (orderedCategoryIndexes.has(categoryIndex)) {
      const base = new Map(orderedValues(messages[categoryIndex] ?? null));
      const translated = new Map(orderedValues(french[categoryIndex] ?? null));
      const keys = [...base.keys(), ...[...translated.keys()].filter((key) => !base.has(key))];
      for (const key of keys) {
        add(categoryIndex, key, null, base.get(key) ?? null, translated.get(key) ?? null,
          `categories[${categoryIndex}][${JSON.stringify(key)}]`,
          `categories[${categoryIndex}][${JSON.stringify(key)}]`);
      }
    } else {
      const base = indexedValues(messages[categoryIndex] ?? []);
      const translated = indexedValues(french[categoryIndex] ?? []);
      const pbs = pbsValues.get(categoryIndex);
      const length = Math.max(base.length, translated.length,
        pbs === undefined ? 0 : Math.max(0, ...[...pbs.keys()].map(Number)) + 1);
      for (let index = 0; index < length; index += 1) {
        add(categoryIndex, String(index), null, base[index] ?? null, translated[index] ?? null,
          `categories[${categoryIndex}][${index}]`, `categories[${categoryIndex}][${index}]`);
      }
    }
  }

  const categoryCounts = Object.fromEntries(
    MESSAGE_CATEGORIES.map((category) => [category, categories[category].length]),
  ) as Readonly<Record<MessageCategory, number>>;
  const entries = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
  return {
    catalog: {
      schemaVersion: "1.0.0",
      locale: "fr",
      fallbackLocale: "source",
      priority: ["Data/french.dat", "Data/messages.dat", "PBS"],
      categories,
    },
    report: {
      schemaVersion: "1.0.0",
      sources: [
        { file: "Data/messages.dat", sha256: messagesHash },
        { file: "Data/french.dat", sha256: frenchHash },
      ],
      summary: {
        entries,
        frenchEntries,
        messageFallbacks,
        pbsFallbacks,
        translationConflicts: conflicts.filter((entry) => entry.kind === "translation").length,
        pbsConflicts: conflicts.filter((entry) => entry.kind === "pbs").length,
      },
      categoryCounts,
      conflicts,
    },
  };
}
