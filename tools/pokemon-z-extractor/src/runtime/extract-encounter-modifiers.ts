import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ScriptManifestEntry } from "./extract-scripts.js";

export type ExtractedEncounterMajorStatus = "sleep" | "poison" | "burn" | "paralysis" | "frozen"
  | "caduco" | "hemorrhage";
export type ExtractedTrainingStat = "hp" | "attack" | "defense" | "speed" | "specialAttack" | "specialDefense";

export interface ExtractedEncounterModifierEffects {
  readonly majorStatus?: ExtractedEncounterMajorStatus;
  readonly form?: number;
  readonly learnedMoves?: readonly string[];
  readonly ivs?: Readonly<Partial<Record<ExtractedTrainingStat, number>>>;
  readonly evs?: Readonly<Partial<Record<ExtractedTrainingStat, number>>>;
  readonly heldItem?: string;
  readonly shiny?: true;
  readonly nickname?: string;
  readonly levelPolicy?: "balanced-minus-four-to-zero";
}

export interface ExtractedEncounterModifierRule {
  readonly mapIds: readonly number[];
  readonly species: readonly string[];
  readonly requiredSwitches: readonly number[];
  readonly effects: ExtractedEncounterModifierEffects;
  readonly source: { readonly file: string; readonly line: number };
}

export interface ExtractedEncounterModifierIssue {
  readonly reason: "dynamic-effect" | "unsupported-condition";
  readonly source: { readonly file: string; readonly line: number };
  readonly ruby: string;
}

export interface ExtractedEncounterModifierCatalog {
  readonly schemaVersion: "1.0.0";
  readonly records: readonly ExtractedEncounterModifierRule[];
  readonly audit: { readonly unsupported: readonly ExtractedEncounterModifierIssue[] };
}

const STATUS_NAMES: Readonly<Record<string, ExtractedEncounterMajorStatus>> = {
  SLEEP: "sleep", POISON: "poison", BURN: "burn", PARALYSIS: "paralysis", FROZEN: "frozen",
  CADUCO: "caduco", HEMORRAGIA: "hemorrhage",
};
const TRAINING_STATS: readonly ExtractedTrainingStat[] = [
  "hp", "attack", "defense", "speed", "specialAttack", "specialDefense",
];

interface RubyBlock { readonly condition: string | null; readonly conditional: boolean }
interface MutableEffects {
  majorStatus?: ExtractedEncounterMajorStatus;
  form?: number;
  learnedMoves?: string[];
  ivs?: Partial<Record<ExtractedTrainingStat, number>>;
  evs?: Partial<Record<ExtractedTrainingStat, number>>;
  heldItem?: string;
  shiny?: true;
  nickname?: string;
  levelPolicy?: "balanced-minus-four-to-zero";
}
interface DetailedParseResult {
  readonly records: readonly ExtractedEncounterModifierRule[];
  readonly unsupported: readonly ExtractedEncounterModifierIssue[];
}

function uniqueNumbers(values: readonly number[]): readonly number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}
function uniqueStrings(values: readonly string[]): readonly string[] { return [...new Set(values)].sort(); }

function parsedScope(conditions: readonly string[]): {
  readonly mapIds: readonly number[]; readonly species: readonly string[];
  readonly requiredSwitches: readonly number[]; readonly supported: boolean;
} {
  const mapIds = uniqueNumbers(conditions.flatMap((condition) =>
    [...condition.matchAll(/\$game_map\.map_id\s*==\s*(\d+)/gu)].map((match) => Number(match[1]))));
  const species = uniqueStrings(conditions.flatMap((condition) =>
    [...condition.matchAll(/pokemon\.species\s*==\s*PBSpecies::([A-Z][A-Z0-9_]*)/gu)].map((match) => match[1]!)));
  const requiredSwitches = uniqueNumbers(conditions.flatMap((condition) =>
    [...condition.matchAll(/\$game_switches\[(\d+)\]/gu)].map((match) => Number(match[1]))));
  const supported = conditions.every((condition) => {
    const withoutComment = condition.replace(/#.*$/u, "");
    const recognized = /\$game_switches\[\d+\]|\$game_map\.map_id\s*==\s*\d+|pokemon\.species\s*==\s*PBSpecies::[A-Z][A-Z0-9_]*/u
      .test(withoutComment);
    const remainder = withoutComment
      .replace(/\$game_switches\[\d+\]/gu, "")
      .replace(/\$game_map\.map_id\s*==\s*\d+/gu, "")
      .replace(/pokemon\.species\s*==\s*PBSpecies::[A-Z][A-Z0-9_]*/gu, "")
      .replace(/&&|\|\||[()\s]/gu, "");
    return recognized && remainder === "";
  });
  return { mapIds, species, requiredSwitches, supported };
}

function parseEncounterModifierScriptDetailed(source: string, file: string): DetailedParseResult {
  const builders = new Map<string, { scope: ReturnType<typeof parsedScope>; effects: MutableEffects;
    source: { file: string; line: number } }>();
  const unsupported: ExtractedEncounterModifierIssue[] = [];
  const blocks: RubyBlock[] = [];
  const lines = source.split(/\r?\n/u);
  const mutate = (line: string, lineNumber: number, apply: (effects: MutableEffects) => void): void => {
    const conditions = blocks.flatMap((block) => block.condition === null ? [] : [block.condition]);
    const scope = parsedScope(conditions);
    if (!scope.supported) {
      unsupported.push({ reason: "unsupported-condition", source: { file, line: lineNumber }, ruby: line });
      return;
    }
    const key = JSON.stringify([scope.mapIds, scope.species, scope.requiredSwitches]);
    const builder = builders.get(key) ?? { scope, effects: {}, source: { file, line: lineNumber } };
    apply(builder.effects);
    builders.set(key, builder);
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    const lineNumber = index + 1;
    const ifMatch = /^if\s+(.+)$/u.exec(line);
    const elsifMatch = /^elsif\s+(.+)$/u.exec(line);
    if (ifMatch !== null) { blocks.push({ condition: ifMatch[1]!, conditional: true }); return; }
    if (elsifMatch !== null) {
      let conditionalIndex = -1;
      for (let blockIndex = blocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
        if (blocks[blockIndex]?.conditional === true) { conditionalIndex = blockIndex; break; }
      }
      if (conditionalIndex >= 0) blocks.splice(conditionalIndex, 1,
        { condition: elsifMatch[1]!, conditional: true });
      return;
    }
    if (/\b(?:proc|do)\s*(?:\{[^}]*\})?\s*$/u.test(line) || /\+=\s*proc\s*\{/u.test(line)) {
      blocks.push({ condition: null, conditional: false }); return;
    }
    if (/^end\b/u.test(line) || /^\}\s*$/u.test(line)) { blocks.pop(); return; }

    let match = /^pokemon\.status\s*=\s*PBStatuses::([A-Z_]+)\b/u.exec(line);
    if (match !== null && STATUS_NAMES[match[1]!] !== undefined) {
      const status = STATUS_NAMES[match[1]!]!;
      mutate(line, lineNumber, (effects) => { effects.majorStatus = status; }); return;
    }
    match = /^pokemon\.form\s*=\s*(\d+)\b/u.exec(line);
    if (match !== null) { const form = Number(match[1]); mutate(line, lineNumber, (effects) => { effects.form = form; }); return; }
    match = /^pokemon\.pbLearnMove\(\s*:([A-Z][A-Z0-9_]*)\s*\)/u.exec(line);
    if (match !== null) {
      const move = match[1]!;
      mutate(line, lineNumber, (effects) => { (effects.learnedMoves ??= []).push(move); }); return;
    }
    match = /^pokemon\.(iv|ev)\[(\d+)\]\s*=\s*(\d+)\b/u.exec(line);
    if (match !== null) {
      const kind = match[1]!;
      const stat = TRAINING_STATS[Number(match[2])];
      const value = Number(match[3]);
      if (stat !== undefined) mutate(line, lineNumber, (effects) => {
        const values = kind === "iv" ? (effects.ivs ??= {}) : (effects.evs ??= {});
        values[stat] = value;
      });
      return;
    }
    match = /^pokemon\.setItem\(\s*:([A-Z][A-Z0-9_]*)\s*\)/u.exec(line);
    if (match !== null) { const item = match[1]!; mutate(line, lineNumber, (effects) => { effects.heldItem = item; }); return; }
    if (/^pokemon\.makeShiny\b/u.test(line)) {
      mutate(line, lineNumber, (effects) => { effects.shiny = true; }); return;
    }
    match = /^pokemon\.name\s*=\s*"([^"]*)"/u.exec(line);
    if (match !== null) { const nickname = match[1]!; mutate(line, lineNumber, (effects) => { effects.nickname = nickname; }); return; }
    if (/^pokemon\.level\s*=\s*newlevel$/u.test(line)) {
      const conditions = blocks.flatMap((block) => block.condition === null ? [] : [block.condition]);
      const scope = parsedScope(conditions);
      if (scope.supported && scope.mapIds.length === 1 && scope.mapIds[0] === 999) {
        mutate(line, lineNumber, (effects) => { effects.levelPolicy = "balanced-minus-four-to-zero"; });
        return;
      }
    }
    if (/^pokemon\.(?:calcStats|resetMoves)\b/u.test(line)) {
      const conditions = blocks.flatMap((block) => block.condition === null ? [] : [block.condition]);
      const scope = parsedScope(conditions);
      if (scope.supported && scope.mapIds.length === 1 && scope.mapIds[0] === 999) return;
    }
    if (/^pokemon\.(?:level\s*=|calcStats\b|resetMoves\b)/u.test(line)) {
      unsupported.push({ reason: "dynamic-effect", source: { file, line: lineNumber }, ruby: line });
    }
  });
  return {
    records: [...builders.values()].map((builder) => ({
      mapIds: builder.scope.mapIds, species: builder.scope.species,
      requiredSwitches: builder.scope.requiredSwitches, effects: builder.effects, source: builder.source,
    })),
    unsupported,
  };
}

/** Extracts declarative pre-battle mutations while retaining their source conditions. */
export function parseEncounterModifierScript(source: string, file: string): readonly ExtractedEncounterModifierRule[] {
  return parseEncounterModifierScriptDetailed(source, file).records;
}

export async function extractEncounterModifiers(outputDirectory: string,
  scripts: readonly ScriptManifestEntry[]): Promise<ExtractedEncounterModifierCatalog> {
  const records: ExtractedEncounterModifierRule[] = [];
  const unsupported: ExtractedEncounterModifierIssue[] = [];
  for (const script of scripts) {
    const source = await readFile(path.join(outputDirectory, ...script.file.split("/")), "utf8");
    if (!source.includes("Events.onWildPokemonCreate") || !source.includes("pokemon.")) continue;
    const parsed = parseEncounterModifierScriptDetailed(source, script.file);
    records.push(...parsed.records);
    unsupported.push(...parsed.unsupported);
  }
  return { schemaVersion: "1.0.0", records, audit: { unsupported } };
}
