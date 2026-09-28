import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { hashFile } from "../inventory/hash-file.js";
import { assertOutputOutsideSource } from "../inventory/path-safety.js";
import { validatePokemonZSource } from "../inventory/source-validation.js";
import { writeJsonAtomically } from "../io/write-json.js";
import { readRubyMarshal } from "../ruby-marshal/reader.js";
import type { RubyHash, RubyMarshalValue, RubyObject } from "../ruby-marshal/types.js";
import { rubyText } from "../ruby-marshal/values.js";
import { convertEventCommand, convertEventPage, type EventAstCommand, type EventCommandFamily, type EventCommandStatus, type EventPageAst } from "./event-ast.js";
import { extractMapInfos } from "./extract-map-infos.js";

interface EventAst {
  readonly id: number;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly pages: readonly EventPageAst[];
}

interface CoverageCounters {
  total: number;
  statuses: Record<EventCommandStatus, number>;
  families: Record<EventCommandFamily, number>;
  codes: Map<number, { total: number; converted: number; referenceOnly: number; raw: number; kind: string }>;
}

export interface EventExtractionResult {
  readonly outputDirectory: string;
  readonly mapCount: number;
  readonly eventCount: number;
  readonly pageCount: number;
  readonly commandCount: number;
  readonly convertedCommands: number;
  readonly referenceOnlyCommands: number;
  readonly rawCommands: number;
}

function objectOfClass(value: RubyMarshalValue, className: string, context: string): RubyObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || value.kind !== "object" || value.className !== className) throw new TypeError(`${context}: ${className} attendu.`);
  return value;
}

function numberIvar(value: RubyObject, name: string, context: string): number {
  const entry = value.ivars[name];
  if (typeof entry !== "number") throw new TypeError(`${context}.${name} doit etre un nombre.`);
  return entry;
}

function eventsHash(value: RubyMarshalValue, context: string): RubyHash {
  if (typeof value !== "object" || value === null || Array.isArray(value) || value.kind !== "hash") {
    throw new TypeError(`${context}: Hash Ruby attendu.`);
  }
  return value;
}

function convertMapEvent(value: RubyMarshalValue, fallbackId: number): EventAst {
  const event = objectOfClass(value, "RPG::Event", `evenement ${fallbackId}`);
  const pages = event.ivars["@pages"];
  if (!Array.isArray(pages)) throw new TypeError(`evenement ${fallbackId}.@pages doit etre un tableau.`);
  return {
    id: numberIvar(event, "@id", `evenement ${fallbackId}`),
    name: rubyText(event.ivars["@name"] ?? null) ?? "",
    x: numberIvar(event, "@x", `evenement ${fallbackId}`),
    y: numberIvar(event, "@y", `evenement ${fallbackId}`),
    pages: pages.map(convertEventPage),
  };
}

function counters(): CoverageCounters {
  return {
    total: 0,
    statuses: { converted: 0, "reference-only": 0, raw: 0 },
    families: { flow: 0, dialogue: 0, state: 0, movement: 0, transition: 0, audio: 0, visual: 0, gameplay: 0, script: 0, unknown: 0 },
    codes: new Map(),
  };
}

function addCommand(coverage: CoverageCounters, command: EventAstCommand): void {
  coverage.total += 1;
  coverage.statuses[command.status] += 1;
  coverage.families[command.family] += 1;
  const current = coverage.codes.get(command.code) ?? { total: 0, converted: 0, referenceOnly: 0, raw: 0, kind: command.kind };
  current.total += 1;
  if (command.status === "converted") current.converted += 1;
  else if (command.status === "reference-only") current.referenceOnly += 1;
  else current.raw += 1;
  coverage.codes.set(command.code, current);
}

function addPages(coverage: CoverageCounters, pages: readonly EventPageAst[]): void {
  for (const page of pages) for (const command of page.commands) addCommand(coverage, command);
}

function coverageSummary(coverage: CoverageCounters): object {
  return {
    commands: coverage.total,
    converted: coverage.statuses.converted,
    referenceOnly: coverage.statuses["reference-only"],
    raw: coverage.statuses.raw,
    convertedPercent: coverage.total === 0 ? 100 : Number((coverage.statuses.converted * 100 / coverage.total).toFixed(2)),
  };
}

export async function extractEvents(sourceDirectory: string, outputDirectory: string): Promise<EventExtractionResult> {
  const paths = await assertOutputOutsideSource(sourceDirectory, outputDirectory);
  await validatePokemonZSource(paths.source);
  const dataDirectory = path.join(paths.source, "Data");
  const [dataFiles, mapInfos] = await Promise.all([readdir(dataDirectory), extractMapInfos(paths.source)]);
  const mapNames = new Map(mapInfos.map((entry) => [entry.id, entry.name]));
  const mapFiles = dataFiles.filter((file) => /^Map\d{3}\.rxdata$/u.test(file)).sort();
  const outputEvents = path.join(paths.output, "events");
  const coverage = counters();
  const manifestRecords: Array<object> = [];
  const rawExamples: Array<object> = [];
  let eventCount = 0;
  let pageCount = 0;

  for (const fileName of mapFiles) {
    const mapId = Number.parseInt(fileName.slice(3, 6), 10);
    const absolute = path.join(dataDirectory, fileName);
    const [bytes, sha256] = await Promise.all([readFile(absolute), hashFile(absolute)]);
    const map = objectOfClass(readRubyMarshal(bytes), "RPG::Map", fileName);
    const events = eventsHash(map.ivars["@events"] ?? null, `${fileName}.@events`).entries.map(([key, event]) => {
      if (typeof key !== "number") throw new TypeError(`${fileName}: ID evenement non numerique.`);
      return convertMapEvent(event, key);
    }).sort((left, right) => left.id - right.id);
    const mapCoverage = counters();
    for (const event of events) {
      pageCount += event.pages.length;
      addPages(coverage, event.pages);
      addPages(mapCoverage, event.pages);
      for (const [pageIndex, page] of event.pages.entries()) {
        for (const entry of page.commands) if (entry.status === "raw" && rawExamples.length < 100) {
          rawExamples.push({ file: `Data/${fileName}`, mapId, eventId: event.id, pageIndex, commandIndex: entry.sourceIndex, code: entry.code });
        }
      }
    }
    eventCount += events.length;
    const outputName = fileName.replace(".rxdata", ".json");
    await writeJsonAtomically(outputEvents, outputName, {
      schemaVersion: "1.0.0", mapId, mapName: mapNames.get(mapId) ?? "", source: { file: `Data/${fileName}`, sha256 }, events,
    });
    manifestRecords.push({ mapId, mapName: mapNames.get(mapId) ?? "", events: events.length, pages: events.reduce((sum, event) => sum + event.pages.length, 0), coverage: coverageSummary(mapCoverage), dataFile: `events/${outputName}`, source: { file: `Data/${fileName}`, sha256 } });
  }

  const commonPath = path.join(dataDirectory, "CommonEvents.rxdata");
  const [commonBytes, commonSha256] = await Promise.all([readFile(commonPath), hashFile(commonPath)]);
  const commonValue = readRubyMarshal(commonBytes);
  if (!Array.isArray(commonValue)) throw new TypeError("CommonEvents.rxdata doit contenir un tableau.");
  const commonEvents = commonValue.flatMap((value, index): readonly object[] => {
    if (value === null) return [];
    const event = objectOfClass(value, "RPG::CommonEvent", `evenement commun ${index}`);
    const list = event.ivars["@list"];
    if (!Array.isArray(list)) throw new TypeError(`evenement commun ${index}.@list doit etre un tableau.`);
    const commands = list.map(convertEventCommand);
    commands.forEach((entry) => addCommand(coverage, entry));
    for (const entry of commands) if (entry.status === "raw" && rawExamples.length < 100) {
      rawExamples.push({ file: "Data/CommonEvents.rxdata", commonEventId: numberIvar(event, "@id", `evenement commun ${index}`), commandIndex: entry.sourceIndex, code: entry.code });
    }
    return [{
      id: numberIvar(event, "@id", `evenement commun ${index}`), name: rubyText(event.ivars["@name"] ?? null) ?? "",
      trigger: numberIvar(event, "@trigger", `evenement commun ${index}`), switchId: numberIvar(event, "@switch_id", `evenement commun ${index}`), commands,
    }];
  });
  await writeJsonAtomically(paths.output, "common-events.json", { schemaVersion: "1.0.0", source: { file: "Data/CommonEvents.rxdata", sha256: commonSha256 }, count: commonEvents.length, records: commonEvents });
  const codeCoverage = [...coverage.codes.entries()].map(([code, values]) => ({ code, ...values })).sort((left, right) => right.total - left.total || left.code - right.code);
  await Promise.all([
    writeJsonAtomically(paths.output, "event-manifest.json", { schemaVersion: "1.0.0", count: manifestRecords.length, records: manifestRecords }),
    writeJsonAtomically(paths.output, "event-coverage-report.json", {
      schemaVersion: "1.0.0",
      summary: { maps: mapFiles.length, events: eventCount, pages: pageCount, commonEvents: commonEvents.length, ...coverageSummary(coverage) },
      byStatus: coverage.statuses,
      byFamily: coverage.families,
      byCode: codeCoverage,
      rawExamples,
      executionPolicy: { converted: "normalized-not-yet-executed", "reference-only": "preserved-never-evaluated", raw: "preserved-never-evaluated" },
    }),
  ]);
  return {
    outputDirectory: paths.output, mapCount: mapFiles.length, eventCount, pageCount, commandCount: coverage.total,
    convertedCommands: coverage.statuses.converted, referenceOnlyCommands: coverage.statuses["reference-only"], rawCommands: coverage.statuses.raw,
  };
}
