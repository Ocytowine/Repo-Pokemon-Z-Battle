import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expandSourceCommonEvents } from "../src/source-common-events.ts";
import { parseSourceMoveRoute, sourceMoveRouteIsExecutable } from "../src/source-move-route.ts";
import { parseSourceAblePokemonCountCondition, parseSourceAchievementCondition,
  parseSourceInventoryQuantityCondition, parseSourcePokedexOwnedCondition,
  portSourceRubyCommand, portSourceRubyCondition,
  isSourceDayCareEggServicePage, isSourceDayCareServicePage } from "../src/source-script-ports.ts";
import { sourceCommandCapability } from "../src/source-command-registry.ts";
import type { ImportedEventPage } from "../src/imported-map.ts";

type Command = ImportedEventPage["commands"][number];
type RawMap = { mapId: number; mapName: string; events: Array<{
  id: number; name: string; x: number; y: number; pages: ImportedEventPage[] }> };
type Issue = { mapId: number; eventId: number; pageIndex: number; x: number; y: number;
  trigger: number; kind: string; sourceIndex: number; detail: string };
type MapRow = { mapId: number; mapName: string; events: number; pages: number;
  commands: number; dialoguePages: number; autoruns: number; parallels: number;
  dialogueCommands: number; stateCommands: number; movementCommands: number;
  audioCommands: number; visualCommands: number; gameplayCommands: number;
  transfers: number;
  commonCalls: number; rubyPorted: number; rubyUnported: number;
  unsupportedConditions: number; invalidRoutes: number; missingTargets: number;
  unknownCommands: number; priority: string };

const application = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repository = path.resolve(application, "../..");
const source = path.join(repository, ".pokemon-z", "data");
const eventsDirectory = path.join(source, "events");
const json = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, "utf8")) as T;
const csv = (value: unknown): string => `"${String(value).replaceAll('"', '""')}"`;
const flowOnly = new Set(["condition-end", "else", "choice-branch", "choice-cancel",
  "choice-end", "show-choices"]);

function rubyConditionSupported(command: Command): boolean {
  const script = command.data.script;
  if (typeof script !== "string") return false;
  const value = script.trim();
  return value === "unown_check" || parseSourceInventoryQuantityCondition(value) !== null
    || parseSourceAblePokemonCountCondition(value) !== null
    || parseSourceAchievementCondition(value) !== null
    || parseSourcePokedexOwnedCondition(value) !== null
    || portSourceRubyCondition(command) !== null;
}

function joinedRuby(commands: readonly Command[], index: number): { source: Command; consumed: number } {
  const first = commands[index]!;
  const lines = [String(first.data.source ?? "")];
  let consumed = 1;
  while (commands[index + consumed]?.kind === "ruby-script-continuation"
    && commands[index + consumed]?.indent === first.indent) {
    lines.push(String(commands[index + consumed]!.data.source ?? ""));
    consumed += 1;
  }
  return { source: { ...first, data: { ...first.data, source: lines.join("\n") } }, consumed };
}

function inspect(map: RawMap, commonEvents: ReadonlyMap<number, {
  id: number; name: string; commands: readonly Command[] }>): { row: MapRow; issues: Issue[] } {
  const row: MapRow = { mapId: map.mapId, mapName: map.mapName, events: map.events.length,
    pages: 0, commands: 0, dialoguePages: 0, autoruns: 0, parallels: 0,
    dialogueCommands: 0, stateCommands: 0, movementCommands: 0,
    audioCommands: 0, visualCommands: 0, gameplayCommands: 0, transfers: 0,
    commonCalls: 0, rubyPorted: 0, rubyUnported: 0, unsupportedConditions: 0,
    invalidRoutes: 0, missingTargets: 0, unknownCommands: 0, priority: "P2" };
  const issues: Issue[] = [];
  const eventIds = new Set(map.events.map((event) => event.id));
  for (const event of map.events) for (const [pageIndex, rawPage] of event.pages.entries()) {
    row.pages += 1;
    const trigger = rawPage.settings.trigger;
    if (trigger === 3) row.autoruns += 1;
    if (trigger === 4) row.parallels += 1;
    row.commonCalls += rawPage.commands.filter((command) => command.kind === "call-common-event").length;
    const page = expandSourceCommonEvents(rawPage, commonEvents);
    const commands = page.commands;
    row.commands += commands.length;
    for (const command of commands) {
      const family = (command as Command & { readonly family?: string }).family;
      if (family === "dialogue") row.dialogueCommands += 1;
      if (family === "state") row.stateCommands += 1;
      if (family === "movement") row.movementCommands += 1;
      if (family === "audio") row.audioCommands += 1;
      if (family === "visual") row.visualCommands += 1;
      if (family === "gameplay") row.gameplayCommands += 1;
    }
    const narrative = commands.some((command) => command.kind === "show-text" || command.kind === "show-choices");
    if (narrative) row.dialoguePages += 1;
    const service = isSourceDayCareServicePage(page) || isSourceDayCareEggServicePage(page);
    const issue = (command: Command, index: number, kind: string, detail: string): void => {
      issues.push({ mapId: map.mapId, eventId: event.id, pageIndex, x: event.x, y: event.y,
        trigger, kind, sourceIndex: index, detail });
    };
    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index]!;
      if (command.kind === "ruby-script") {
        const ruby = joinedRuby(commands, index);
        index += ruby.consumed - 1;
        if (service || portSourceRubyCommand(ruby.source) !== null) row.rubyPorted += 1;
        else { row.rubyUnported += 1; issue(command, index, "ruby-unported", String(ruby.source.data.source ?? "").slice(0, 200)); }
        continue;
      }
      if (command.kind === "condition" && command.data.kind === "ruby-script"
        && !service && !rubyConditionSupported(command)) {
        row.unsupportedConditions += 1;
        issue(command, index, "condition-unported", String(command.data.script ?? "").slice(0, 200));
      }
      if (command.kind === "move-route") {
        const route = parseSourceMoveRoute(command.data.route);
        if (route === null || !sourceMoveRouteIsExecutable(route)) {
          row.invalidRoutes += 1; issue(command, index, "route-invalid", "route non exécutable");
        }
        const target = command.data.target;
        if (typeof target === "number" && target > 0 && !eventIds.has(target)) {
          row.missingTargets += 1; issue(command, index, "target-missing", `EV${String(target).padStart(3, "0")}`);
        }
      }
      if (command.kind === "transfer-player") row.transfers += 1;
      if (command.kind === "call-common-event" && command.data.expansionError !== undefined) {
        row.unknownCommands += 1; issue(command, index, "common-event", String(command.data.expansionError));
      } else if (command.kind !== "condition" && command.kind !== "ruby-script-continuation"
        && command.kind !== "recover-all" && !flowOnly.has(command.kind)
        && sourceCommandCapability(command.kind) === null) {
        row.unknownCommands += 1; issue(command, index, "command-unknown", command.kind);
      }
    }
  }
  const narrativeIssue = issues.some((entry) => {
    const page = map.events.find((event) => event.id === entry.eventId)?.pages[entry.pageIndex];
    return page !== undefined && (page.settings.trigger === 3 || page.settings.trigger === 4
      || expandSourceCommonEvents(page, commonEvents).commands.some((command) =>
        command.kind === "show-text" || command.kind === "show-choices"));
  });
  row.priority = narrativeIssue ? "P0" : issues.length > 0 ? "P1" : "P2";
  return { row, issues };
}

const common = await json<{ records: Array<{ id: number; name: string; commands: Command[] }> }>(path.join(source, "common-events.json"));
const commonEvents = new Map(common.records.map((event) => [event.id, event]));
const files = (await readdir(eventsDirectory)).filter((file) => /^Map\d{3}\.json$/u.test(file)).sort();
const inspected = await Promise.all(files.map(async (file) => inspect(await json<RawMap>(path.join(eventsDirectory, file)), commonEvents)));
const rows = inspected.map((entry) => entry.row);
const issues = inspected.flatMap((entry) => entry.issues);
const headings = Object.keys(rows[0] ?? {});
const lines = [headings.map(csv).join(","), ...rows.map((row) => headings.map((key) => csv(row[key as keyof MapRow])).join(","))];
await writeFile(path.join(repository, "docs", "NARRATIVE_MAP_AUDIT.csv"), `${lines.join("\n")}\n`, "utf8");
await writeFile(path.join(source, "narrative-audit.json"), JSON.stringify({ schemaVersion: "1.0.0", maps: rows, issues }, null, 2), "utf8");
console.log(JSON.stringify({ maps: rows.length, events: rows.reduce((sum, row) => sum + row.events, 0),
  pages: rows.reduce((sum, row) => sum + row.pages, 0), issues: issues.length,
  byPriority: Object.fromEntries(["P0", "P1", "P2"].map((level) => [level, rows.filter((row) => row.priority === level).length])),
  byKind: Object.fromEntries([...new Set(issues.map((entry) => entry.kind))].map((kind) =>
    [kind, issues.filter((entry) => entry.kind === kind).length])) }, null, 2));
