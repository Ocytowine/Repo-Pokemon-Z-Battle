import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { assertOutputOutsideSource } from "../inventory/path-safety.js";
import { validatePokemonZSource } from "../inventory/source-validation.js";
import { writeJsonAtomically } from "../io/write-json.js";
import { readRubyMarshal } from "../ruby-marshal/reader.js";
import type { RubyMarshalValue, RubyObject } from "../ruby-marshal/types.js";
import { rubyText } from "../ruby-marshal/values.js";
import { SCRIPT_FAMILY_POLICIES, classifyRubyHook, normalizeRubySignature, portTargetRubyLine, type ScriptHookFamily } from "./script-hooks.js";
import { extractMapInfos } from "./extract-map-infos.js";

const TARGET_MAP_IDS = new Set([1]);

interface HookLocation {
  readonly source: "map" | "common-event";
  readonly mapId?: number;
  readonly eventId?: number;
  readonly pageIndex?: number;
  readonly commonEventId?: number;
  readonly commandIndex: number;
  readonly code: 355 | 655;
}

interface SignatureAggregate {
  readonly source: string;
  readonly normalized: string;
  readonly family: ScriptHookFamily;
  count: number;
  mapCount: number;
  commonCount: number;
  readonly maps: Set<number>;
  readonly locations: HookLocation[];
}

interface GroupAggregate {
  readonly normalized: string;
  readonly family: ScriptHookFamily;
  count: number;
  mapCount: number;
  commonCount: number;
  readonly variants: Set<string>;
  readonly maps: Set<number>;
}

export interface ScriptHookExtractionResult {
  readonly outputDirectory: string;
  readonly mapScriptLines: number;
  readonly distinctMapSignatures: number;
  readonly normalizedGroups: number;
  readonly targetOccurrences: number;
  readonly targetPorted: number;
}

function objectOfClass(value: RubyMarshalValue, className: string, context: string): RubyObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || value.kind !== "object" || value.className !== className) throw new TypeError(`${context}: ${className} attendu.`);
  return value;
}

function numberIvar(value: RubyObject, name: string, context: string): number {
  const entry = value.ivars[name];
  if (typeof entry !== "number") throw new TypeError(`${context}.${name} doit etre numerique.`);
  return entry;
}

function commandParts(value: RubyMarshalValue, context: string): { readonly code: number; readonly parameters: readonly RubyMarshalValue[] } {
  const command = objectOfClass(value, "RPG::EventCommand", context);
  const code = command.ivars["@code"];
  const parameters = command.ivars["@parameters"];
  if (typeof code !== "number" || !Array.isArray(parameters)) throw new TypeError(`${context}: commande invalide.`);
  return { code, parameters };
}

function moveCommandCode(value: RubyMarshalValue, context: string): number {
  const command = objectOfClass(value, "RPG::MoveCommand", context);
  return numberIvar(command, "@code", context);
}

export async function extractScriptHooks(sourceDirectory: string, outputDirectory: string): Promise<ScriptHookExtractionResult> {
  const paths = await assertOutputOutsideSource(sourceDirectory, outputDirectory);
  await validatePokemonZSource(paths.source);
  const dataDirectory = path.join(paths.source, "Data");
  const [files, mapInfos] = await Promise.all([readdir(dataDirectory), extractMapInfos(paths.source)]);
  const mapNames = new Map(mapInfos.map((entry) => [entry.id, entry.name]));
  const signatures = new Map<string, SignatureAggregate>();
  const groups = new Map<string, GroupAggregate>();
  const targetHooks: Array<HookLocation & {
    readonly sourceText: string;
    readonly normalized: string;
    readonly family: ScriptHookFamily;
    readonly policy: string;
    readonly action: ReturnType<typeof portTargetRubyLine>;
  }> = [];
  let mapScriptLines = 0;
  let commonScriptLines = 0;
  let scriptConditions = 0;
  let movementScripts = 0;

  const addLine = (source: string, location: HookLocation): void => {
    const normalized = normalizeRubySignature(source);
    const family = classifyRubyHook(source);
    const signature = signatures.get(source) ?? {
      source, normalized, family, count: 0, mapCount: 0, commonCount: 0, maps: new Set<number>(), locations: [],
    };
    signature.count += 1;
    if (location.source === "map" && location.mapId !== undefined) {
      signature.mapCount += 1;
      signature.maps.add(location.mapId);
      mapScriptLines += 1;
    } else {
      signature.commonCount += 1;
      commonScriptLines += 1;
    }
    if (signature.locations.length < 20) signature.locations.push(location);
    signatures.set(source, signature);
    const group = groups.get(normalized) ?? { normalized, family, count: 0, mapCount: 0, commonCount: 0, variants: new Set<string>(), maps: new Set<number>() };
    group.count += 1;
    group.variants.add(source);
    if (location.source === "map" && location.mapId !== undefined) { group.mapCount += 1; group.maps.add(location.mapId); } else group.commonCount += 1;
    groups.set(normalized, group);
    if (location.source === "map" && location.mapId !== undefined && TARGET_MAP_IDS.has(location.mapId)) {
      targetHooks.push({ ...location, sourceText: source, normalized, family, policy: SCRIPT_FAMILY_POLICIES[family].policy, action: portTargetRubyLine(source) });
    }
  };

  const inspectCommands = (list: readonly RubyMarshalValue[], base: Omit<HookLocation, "commandIndex" | "code">): void => {
    list.forEach((value, commandIndex) => {
      const command = commandParts(value, `commande ${commandIndex}`);
      if (command.code === 355 || command.code === 655) {
        addLine(rubyText(command.parameters[0] ?? null) ?? "", { ...base, commandIndex, code: command.code });
      } else if (command.code === 111 && command.parameters[0] === 12) {
        scriptConditions += 1;
      } else if (command.code === 209) {
        const routeValue = command.parameters[1] ?? null;
        if (typeof routeValue === "object" && routeValue !== null && !Array.isArray(routeValue) && routeValue.kind === "object") {
          const routeList = routeValue.ivars["@list"];
          if (Array.isArray(routeList)) for (const [stepIndex, step] of routeList.entries()) {
            if (moveCommandCode(step, `mouvement ${stepIndex}`) === 45) movementScripts += 1;
          }
        }
      }
    });
  };

  for (const fileName of files.filter((file) => /^Map\d{3}\.rxdata$/u.test(file)).sort()) {
    const mapId = Number.parseInt(fileName.slice(3, 6), 10);
    const map = objectOfClass(readRubyMarshal(await readFile(path.join(dataDirectory, fileName))), "RPG::Map", fileName);
    const events = map.ivars["@events"];
    if (typeof events !== "object" || events === null || Array.isArray(events) || events.kind !== "hash") throw new TypeError(`${fileName}: evenements invalides.`);
    for (const [eventKey, eventValue] of events.entries) {
      const event = objectOfClass(eventValue, "RPG::Event", `${fileName}: evenement`);
      const eventId = typeof eventKey === "number" ? eventKey : numberIvar(event, "@id", fileName);
      const pages = event.ivars["@pages"];
      if (!Array.isArray(pages)) throw new TypeError(`${fileName}: pages invalides.`);
      pages.forEach((pageValue, pageIndex) => {
        const page = objectOfClass(pageValue, "RPG::Event::Page", `${fileName}: page`);
        const list = page.ivars["@list"];
        if (!Array.isArray(list)) throw new TypeError(`${fileName}: commandes invalides.`);
        inspectCommands(list, { source: "map", mapId, eventId, pageIndex });
        const autonomousRoute = page.ivars["@move_route"];
        if (typeof autonomousRoute === "object" && autonomousRoute !== null && !Array.isArray(autonomousRoute) && autonomousRoute.kind === "object") {
          const routeList = autonomousRoute.ivars["@list"];
          if (Array.isArray(routeList)) for (const [stepIndex, step] of routeList.entries()) {
            if (moveCommandCode(step, `${fileName}: mouvement autonome ${stepIndex}`) === 45) movementScripts += 1;
          }
        }
      });
    }
  }

  const common = readRubyMarshal(await readFile(path.join(dataDirectory, "CommonEvents.rxdata")));
  if (!Array.isArray(common)) throw new TypeError("CommonEvents.rxdata doit contenir un tableau.");
  for (const [index, value] of common.entries()) {
    if (value === null) continue;
    const event = objectOfClass(value, "RPG::CommonEvent", `evenement commun ${index}`);
    const list = event.ivars["@list"];
    if (!Array.isArray(list)) throw new TypeError(`evenement commun ${index}: commandes invalides.`);
    inspectCommands(list, { source: "common-event", commonEventId: numberIvar(event, "@id", `evenement commun ${index}`) });
  }

  const signatureRecords = [...signatures.values()].map((entry) => ({
    source: entry.source, normalized: entry.normalized, family: entry.family, policy: SCRIPT_FAMILY_POLICIES[entry.family].policy,
    handler: portTargetRubyLine(entry.source)?.kind ?? null, occurrences: entry.count, mapOccurrences: entry.mapCount,
    commonEventOccurrences: entry.commonCount, maps: [...entry.maps].sort((a, b) => a - b), locationSamples: entry.locations,
  })).sort((left, right) => right.occurrences - left.occurrences || left.source.localeCompare(right.source));
  const groupRecords = [...groups.values()].map((entry) => ({
    normalized: entry.normalized, family: entry.family, policy: SCRIPT_FAMILY_POLICIES[entry.family].policy,
    handler: portTargetRubyLine([...entry.variants][0] ?? "")?.kind ?? null, occurrences: entry.count,
    mapOccurrences: entry.mapCount, commonEventOccurrences: entry.commonCount, exactVariants: [...entry.variants].sort(), maps: [...entry.maps].sort((a, b) => a - b),
  })).sort((left, right) => right.occurrences - left.occurrences || left.normalized.localeCompare(right.normalized));
  const familyStats = Object.keys(SCRIPT_FAMILY_POLICIES).map((family) => ({
    family, policy: SCRIPT_FAMILY_POLICIES[family as ScriptHookFamily].policy,
    rationale: SCRIPT_FAMILY_POLICIES[family as ScriptHookFamily].rationale,
    occurrences: groupRecords.filter((entry) => entry.family === family).reduce((sum, entry) => sum + entry.occurrences, 0),
    groups: groupRecords.filter((entry) => entry.family === family).length,
  }));
  const distinctMapSignatures = signatureRecords.filter((entry) => entry.mapOccurrences > 0).length;
  const targetPorted = targetHooks.filter((entry) => entry.action !== null).length;
  const sortedTargetHooks = [...targetHooks].sort((left, right) =>
    (left.mapId ?? 0) - (right.mapId ?? 0)
    || (left.eventId ?? 0) - (right.eventId ?? 0)
    || (left.pageIndex ?? 0) - (right.pageIndex ?? 0)
    || left.commandIndex - right.commandIndex);
  await Promise.all([
    writeJsonAtomically(paths.output, "script-hook-catalog.json", { schemaVersion: "1.0.0", exactSignatures: signatureRecords, normalizedGroups: groupRecords }),
    writeJsonAtomically(paths.output, "script-hook-policies.json", { schemaVersion: "1.0.0", families: familyStats }),
    writeJsonAtomically(paths.output, "ported-script-hooks.json", {
      schemaVersion: "1.0.0", targetMaps: [...TARGET_MAP_IDS].map((mapId) => ({ mapId, mapName: mapNames.get(mapId) ?? "" })),
      executionPolicy: "declarative-actions-only", occurrences: sortedTargetHooks,
    }),
    writeJsonAtomically(paths.output, "script-hook-report.json", {
      schemaVersion: "1.0.0",
      summary: {
        mapScriptLines, commonScriptLines, distinctMapSignatures, exactSignatures: signatureRecords.length,
        normalizedGroups: groupRecords.length, scriptConditions, movementScripts,
        targetMaps: TARGET_MAP_IDS.size, targetOccurrences: targetHooks.length, targetPorted,
      },
      targetCoverage: [...TARGET_MAP_IDS].map((mapId) => ({ mapId, mapName: mapNames.get(mapId) ?? "", occurrences: targetHooks.filter((entry) => entry.mapId === mapId).length, ported: targetHooks.filter((entry) => entry.mapId === mapId && entry.action !== null).length })),
      safety: { rubyExecution: false, unknownHooks: "reference-only", defaultCoopPolicy: "HOST_ONLY" },
    }),
  ]);
  return { outputDirectory: paths.output, mapScriptLines, distinctMapSignatures, normalizedGroups: groupRecords.length, targetOccurrences: targetHooks.length, targetPorted };
}
