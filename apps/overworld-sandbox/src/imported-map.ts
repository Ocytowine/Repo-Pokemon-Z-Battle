import type { Direction, GridPoint } from "@pokemon-z-battle/overworld-engine";
import { EMPTY_SOURCE_EVENT_STATE, selectActiveEventPage, type SourceEventState } from "./source-event-state.js";
import type { PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import type { SourceShopItem } from "./source-economy.js";
import { parseSourceMoveRoute, type SourceMoveRoute } from "./source-move-route.js";

export const SOURCE_MAP_ID = "source-003";
export const SOURCE_TILE_SIZE = 32;

const DIRECTION_BITS: Readonly<Record<Direction, number>> = { down: 1, left: 2, right: 4, up: 8 };
const OPPOSITE: Readonly<Record<Direction, Direction>> = { down: "up", left: "right", right: "left", up: "down" };
const DELTAS: Readonly<Record<Direction, GridPoint>> = {
  down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 },
};

// Table RPG Maker XP : quatre quarts de 16 px pour chacun des 48 motifs d'autotile.
export const AUTOTILE_PARTS: readonly (readonly [number, number, number, number])[] = [
  [27, 28, 33, 34], [5, 28, 33, 34], [27, 6, 33, 34], [5, 6, 33, 34],
  [27, 28, 33, 12], [5, 28, 33, 12], [27, 6, 33, 12], [5, 6, 33, 12],
  [27, 28, 11, 34], [5, 28, 11, 34], [27, 6, 11, 34], [5, 6, 11, 34],
  [27, 28, 11, 12], [5, 28, 11, 12], [27, 6, 11, 12], [5, 6, 11, 12],
  [25, 26, 31, 32], [25, 6, 31, 32], [25, 26, 31, 12], [25, 6, 31, 12],
  [15, 16, 21, 22], [15, 16, 21, 12], [15, 16, 11, 22], [15, 16, 11, 12],
  [29, 30, 35, 36], [29, 30, 11, 36], [5, 30, 35, 36], [5, 30, 11, 36],
  [39, 40, 45, 46], [5, 40, 45, 46], [39, 6, 45, 46], [5, 6, 45, 46],
  [25, 30, 31, 36], [15, 16, 45, 46], [13, 14, 19, 20], [13, 14, 19, 12],
  [17, 18, 23, 24], [17, 18, 11, 24], [41, 42, 47, 48], [5, 42, 47, 48],
  [37, 38, 43, 44], [37, 6, 43, 44], [13, 18, 19, 24], [13, 14, 43, 44],
  [37, 42, 43, 48], [17, 18, 47, 48], [13, 18, 43, 48], [1, 2, 7, 8],
] as const;

export interface ImportedMap {
  readonly id: number;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly tilesetId: number;
  readonly layers: { readonly lower: readonly number[]; readonly middle: readonly number[]; readonly upper: readonly number[] };
  readonly collision: { readonly masks: readonly number[] };
  readonly transfers: readonly ImportedTransfer[];
}

export interface ImportedTransfer {
  readonly eventId: number;
  readonly pageIndex: number;
  readonly eventX: number;
  readonly eventY: number;
  readonly targetMapId: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly direction: number;
}

export interface ImportedTileset {
  readonly id: number;
  readonly tilesetName: string;
  readonly autotileNames: readonly string[];
  readonly priorities: readonly number[];
  readonly terrainTags: readonly number[];
  readonly passages: readonly number[];
}

interface TilesetFile { readonly records: readonly ImportedTileset[] }

export interface ImportedEventPage {
  readonly condition: { readonly switch1Id: number | null; readonly switch2Id: number | null; readonly variable: { readonly id: number; readonly minimum: number } | null; readonly selfSwitch: string | null };
  readonly graphic: { readonly tileId: number; readonly characterName: string; readonly direction: number; readonly pattern: number; readonly opacity: number };
  readonly settings: { readonly moveType: number; readonly moveSpeed: number; readonly moveFrequency: number;
    readonly moveRoute?: SourceMoveRoute | null;
    readonly walkAnimation: boolean; readonly stepAnimation: boolean; readonly directionFix: boolean;
    readonly through: boolean; readonly alwaysOnTop: boolean; readonly trigger: number };
  readonly commands: readonly { readonly kind: string; readonly text: string | null; readonly indent: number; readonly data: Readonly<Record<string, unknown>> }[];
}

export interface ImportedMapEvent extends GridPoint {
  readonly id: number;
  readonly name: string;
  readonly pages: readonly ImportedEventPage[];
}

export interface ImportedEventPose extends GridPoint {
  readonly direction: number;
  readonly pageIndex?: number;
  readonly pattern?: number;
  readonly characterName?: string;
  readonly opacity?: number;
}

export interface ImportedMapAssets {
  readonly map: ImportedMap;
  readonly tileset: ImportedTileset;
  readonly tilesetImage: HTMLImageElement;
  readonly autotileImages: readonly (HTMLImageElement | null)[];
  readonly events: readonly ImportedMapEvent[];
  readonly characterImages: ReadonlyMap<string, HTMLImageElement>;
  readonly playerImage: HTMLImageElement;
  readonly playerPickupImage: HTMLImageElement;
  readonly mapTranslations: ReadonlyMap<string, string>;
  readonly itemNames: ReadonlyMap<string, string>;
  readonly items: ReadonlyMap<string, SourceShopItem>;
  readonly pokemonOverworldPaths: ReadonlyMap<string, string>;
  readonly battleCatalog: PlayerCreationCatalog;
  readonly trainers: readonly ImportedTrainer[];
  readonly trainerTypes: readonly ImportedTrainerType[];
  readonly encounter: ImportedEncounterTable | null;
  readonly battleback: string | null;
  readonly wildBattleBgm: string | null;
  readonly wildVictoryMe: string | null;
  readonly mapMetadata: ImportedMapMetadata;
}

export interface ImportedMapMetadata {
  readonly outdoor: boolean | null;
  readonly bicycle: boolean | null;
  readonly bicycleAlways: boolean;
  readonly diveMap: number | null;
  readonly surfaceMap: number | null;
}

export interface ImportedEncounterSlot {
  readonly species: string; readonly minimumLevel: number; readonly maximumLevel: number; readonly weight: number;
}
export interface ImportedEncounterTable {
  readonly mapId: number; readonly landRate: number; readonly land: readonly ImportedEncounterSlot[];
}

export interface ImportedTrainerPokemon {
  readonly species: string;
  readonly level: number;
  readonly moves: readonly (string | null)[];
}

export interface ImportedTrainer {
  readonly trainerType: string;
  readonly name: string;
  readonly version: number;
  readonly pokemon: readonly ImportedTrainerPokemon[];
}

export interface ImportedTrainerType {
  readonly id: number;
  readonly internalName: string;
  readonly baseMoney: number;
  readonly battleBgm: string | null;
  readonly victoryMe: string | null;
}

export interface ImportedAvatar extends GridPoint { readonly direction: Direction }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function routeCharacterNames(events: readonly ImportedMapEvent[]): readonly string[] {
  const names: string[] = [];
  for (const event of events) for (const page of event.pages) for (const command of page.commands) {
    if (command.kind !== "move-route" || !isRecord(command.data.route) || !Array.isArray(command.data.route.steps)) continue;
    for (const step of command.data.route.steps) {
      if (!isRecord(step) || step.kind !== "change-graphic" || !Array.isArray(step.parameters)) continue;
      const name = step.parameters[0];
      if (typeof name === "string" && name !== "") names.push(name);
    }
  }
  return names;
}

function isNumberArray(value: unknown, length: number): value is number[] {
  return Array.isArray(value) && value.length === length && value.every((entry) => Number.isInteger(entry) && entry >= 0);
}

export function parseImportedMap(value: unknown): ImportedMap {
  if (!isRecord(value) || !Number.isInteger(value.id) || typeof value.name !== "string"
    || !Number.isInteger(value.width) || !Number.isInteger(value.height) || !Number.isInteger(value.tilesetId)
    || !isRecord(value.layers) || !isRecord(value.collision) || !Array.isArray(value.transfers)) {
    throw new Error("Le fichier de carte importee est invalide.");
  }
  const width = value.width as number;
  const height = value.height as number;
  const cells = width * height;
  if (width < 1 || height < 1 || !isNumberArray(value.layers.lower, cells)
    || !isNumberArray(value.layers.middle, cells) || !isNumberArray(value.layers.upper, cells)
    || !isNumberArray(value.collision.masks, cells)) {
    throw new Error("Les couches ou collisions de la carte importee sont invalides.");
  }
  const transfers = value.transfers.map((entry) => {
    if (!isRecord(entry) || !Number.isInteger(entry.eventId) || !Number.isInteger(entry.pageIndex)
      || !Number.isInteger(entry.eventX) || !Number.isInteger(entry.eventY) || !Number.isInteger(entry.targetMapId)
      || !Number.isInteger(entry.targetX) || !Number.isInteger(entry.targetY) || !Number.isInteger(entry.direction)) {
      throw new Error("Un transfert de la carte importee est invalide.");
    }
    return { eventId: entry.eventId as number, pageIndex: entry.pageIndex as number,
      eventX: entry.eventX as number, eventY: entry.eventY as number, targetMapId: entry.targetMapId as number,
      targetX: entry.targetX as number, targetY: entry.targetY as number, direction: entry.direction as number };
  });
  return {
    id: value.id as number, name: value.name, width, height, tilesetId: value.tilesetId as number,
    layers: { lower: value.layers.lower, middle: value.layers.middle, upper: value.layers.upper },
    collision: { masks: value.collision.masks }, transfers,
  };
}

function parseTilesets(value: unknown): TilesetFile {
  if (!isRecord(value) || !Array.isArray(value.records)) throw new Error("Le catalogue de tilesets est invalide.");
  const records = value.records.map((entry) => {
    if (!isRecord(entry) || !Number.isInteger(entry.id) || typeof entry.tilesetName !== "string"
      || !Array.isArray(entry.autotileNames) || !entry.autotileNames.every((name) => typeof name === "string")
      || !Array.isArray(entry.passages) || !entry.passages.every((passage) => Number.isInteger(passage) && (passage as number) >= 0)
      || !Array.isArray(entry.priorities) || !entry.priorities.every((priority) => Number.isInteger(priority) && (priority as number) >= 0)
      || !Array.isArray(entry.terrainTags) || !entry.terrainTags.every((tag) => Number.isInteger(tag) && (tag as number) >= 0)) {
      throw new Error("Une configuration de tileset est invalide.");
    }
    return { id: entry.id as number, tilesetName: entry.tilesetName, autotileNames: entry.autotileNames as string[],
      priorities: entry.priorities as number[], terrainTags: entry.terrainTags as number[], passages: entry.passages as number[] };
  });
  return { records };
}

function parseEncounter(value: unknown, mapId: number): ImportedEncounterTable | null {
  if (!isRecord(value) || !Array.isArray(value.records)) throw new Error("Le catalogue de rencontres est invalide.");
  const entry = value.records.find((candidate) => isRecord(candidate) && candidate.mapId === mapId);
  if (!isRecord(entry) || !isRecord(entry.encounterRates) || !Number.isInteger(entry.encounterRates.land)
    || !Array.isArray(entry.methods)) return null;
  const method = entry.methods.find((candidate) => isRecord(candidate) && candidate.method === "Land");
  if (!isRecord(method) || !Array.isArray(method.slots)) return null;
  const land = method.slots.map((slot) => {
    if (!isRecord(slot) || typeof slot.species !== "string" || !Number.isInteger(slot.minimumLevel)
      || !Number.isInteger(slot.maximumLevel) || !Number.isInteger(slot.weight)
      || (slot.minimumLevel as number) < 1 || (slot.maximumLevel as number) < (slot.minimumLevel as number)
      || (slot.weight as number) < 1) throw new Error("Une rencontre terrestre est invalide.");
    return { species: slot.species, minimumLevel: slot.minimumLevel as number,
      maximumLevel: slot.maximumLevel as number, weight: slot.weight as number };
  });
  return { mapId, landRate: entry.encounterRates.land as number, land };
}

export function parseImportedTrainers(value: unknown): readonly ImportedTrainer[] {
  if (!isRecord(value) || !Array.isArray(value.records)) throw new Error("Le catalogue de Dresseurs est invalide.");
  return value.records.map((entry) => {
    if (!isRecord(entry) || typeof entry.trainerType !== "string" || typeof entry.name !== "string"
      || !Number.isInteger(entry.version) || !Array.isArray(entry.pokemon)) throw new Error("Un Dresseur est invalide.");
    const pokemon = entry.pokemon.map((member) => {
      if (!isRecord(member) || typeof member.species !== "string" || !Number.isInteger(member.level)
        || (member.level as number) < 1 || !Array.isArray(member.moves)
        || !member.moves.every((move) => move === null || typeof move === "string")) {
        throw new Error("Une équipe de Dresseur est invalide.");
      }
      return { species: member.species, level: member.level as number, moves: member.moves as (string | null)[] };
    });
    if (pokemon.length < 1 || pokemon.length > 6) throw new Error("Une équipe de Dresseur doit contenir entre un et six Pokémon.");
    return { trainerType: entry.trainerType, name: entry.name, version: entry.version as number, pokemon };
  });
}

export function parseImportedTrainerTypes(value: unknown): readonly ImportedTrainerType[] {
  if (!isRecord(value) || !Array.isArray(value.records)) throw new Error("Le catalogue de classes de Dresseur est invalide.");
  return value.records.map((entry) => {
    if (!isRecord(entry) || !Number.isInteger(entry.id) || (entry.id as number) < 0
      || typeof entry.internalName !== "string" || !Number.isInteger(entry.baseMoney)
      || (entry.baseMoney as number) < 0
      || (entry.battleBgm !== null && typeof entry.battleBgm !== "string")
      || (entry.victoryMe !== null && typeof entry.victoryMe !== "string")) {
      throw new Error("Une classe de Dresseur est invalide.");
    }
    return { id: entry.id as number, internalName: entry.internalName, baseMoney: entry.baseMoney as number, battleBgm: entry.battleBgm as string | null,
      victoryMe: entry.victoryMe as string | null };
  });
}

function parseBattlePresentation(value: unknown, mapId: number): { readonly battleback: string | null;
  readonly wildBattleBgm: string | null; readonly wildVictoryMe: string | null;
  readonly mapMetadata: ImportedMapMetadata } {
  if (!isRecord(value) || !Array.isArray(value.records)) throw new Error("Les métadonnées de combat sont invalides.");
  const entry = value.records.find((candidate) => isRecord(candidate) && candidate.mapId === mapId);
  const surface = value.records.find((candidate) => isRecord(candidate) && candidate.diveMap === mapId);
  return { battleback: isRecord(entry) && typeof entry.battleback === "string" ? entry.battleback : null,
    wildBattleBgm: isRecord(entry) && typeof entry.wildBattleBgm === "string" ? entry.wildBattleBgm : null,
    wildVictoryMe: isRecord(entry) && typeof entry.wildVictoryMe === "string" ? entry.wildVictoryMe : null,
    mapMetadata: {
      outdoor: isRecord(entry) && typeof entry.outdoor === "boolean" ? entry.outdoor : null,
      bicycle: isRecord(entry) && typeof entry.bicycle === "boolean" ? entry.bicycle : null,
      bicycleAlways: isRecord(entry) && entry.bicycleAlways === true,
      diveMap: isRecord(entry) && Number.isSafeInteger(entry.diveMap) ? entry.diveMap as number : null,
      surfaceMap: isRecord(surface) && Number.isSafeInteger(surface.mapId) ? surface.mapId as number : null,
    } };
}

export function selectDefaultEventPage(event: ImportedMapEvent): ImportedEventPage | null {
  return selectDefaultEventPageWithIndex(event)?.page ?? null;
}

export function selectDefaultEventPageWithIndex(event: ImportedMapEvent): { readonly page: ImportedEventPage; readonly pageIndex: number } | null {
  return selectActiveEventPage(event, 0, EMPTY_SOURCE_EVENT_STATE);
}

export function selectEventPage(event: ImportedMapEvent, mapId: number, state: SourceEventState): ImportedEventPage | null {
  return selectActiveEventPage(event, mapId, state)?.page ?? null;
}

export function eventFootprint(event: ImportedMapEvent): GridPoint[] {
  const match = /size\((\d+),(\d+)\)/iu.exec(event.name);
  const width = match === null ? 1 : Number(match[1]);
  const height = match === null ? 1 : Number(match[2]);
  const points: GridPoint[] = [];
  for (let y = event.y - height + 1; y <= event.y; y += 1) {
    for (let x = event.x; x < event.x + width; x += 1) points.push({ x, y });
  }
  return points;
}

export function blockingDefaultEventPoints(events: readonly ImportedMapEvent[], mapId = 0, state: SourceEventState = EMPTY_SOURCE_EVENT_STATE): GridPoint[] {
  return events.flatMap((event) => {
    const page = selectEventPage(event, mapId, state);
    const visible = page !== null && (page.graphic.characterName !== "" || page.graphic.tileId > 0);
    return visible && !page.settings.through ? eventFootprint(event) : [];
  });
}

export interface ActiveMapEvent { readonly event: ImportedMapEvent; readonly page: ImportedEventPage; readonly pageIndex: number }

export function activeEventAt(events: readonly ImportedMapEvent[], x: number, y: number, mapId = 0, state: SourceEventState = EMPTY_SOURCE_EVENT_STATE): ActiveMapEvent | null {
  const event = events.find((candidate) => eventFootprint(candidate).some((point) => point.x === x && point.y === y));
  if (event === undefined) return null;
  const selection = selectActiveEventPage(event, mapId, state);
  return selection === null ? null : { event, ...selection };
}

export function eventInFront(events: readonly ImportedMapEvent[], avatar: ImportedAvatar, mapId = 0, state: SourceEventState = EMPTY_SOURCE_EVENT_STATE): ActiveMapEvent | null {
  const delta = DELTAS[avatar.direction];
  return activeEventAt(events, avatar.x + delta.x, avatar.y + delta.y, mapId, state);
}

export function eventInInteractionRange(events: readonly ImportedMapEvent[], avatar: ImportedAvatar,
  map: ImportedMap, tileset: ImportedTileset, mapId = 0,
  state: SourceEventState = EMPTY_SOURCE_EVENT_STATE): ActiveMapEvent | null {
  const adjacent = eventInFront(events, avatar, mapId, state);
  if (adjacent !== null) return adjacent;
  const delta = DELTAS[avatar.direction];
  const counterX = avatar.x + delta.x;
  const counterY = avatar.y + delta.y;
  if (counterX < 0 || counterY < 0 || counterX >= map.width || counterY >= map.height) return null;
  const index = counterY * map.width + counterX;
  const counter = [map.layers.upper[index], map.layers.middle[index], map.layers.lower[index]]
    .some((tileId) => tileId !== undefined && ((tileset.passages[tileId] ?? 0) & 0x80) !== 0);
  return counter ? activeEventAt(events, counterX + delta.x, counterY + delta.y, mapId, state) : null;
}

export function playerTouchEventInDirection(events: readonly ImportedMapEvent[], avatar: ImportedAvatar,
  direction: Direction, mapId = 0, state: SourceEventState = EMPTY_SOURCE_EVENT_STATE): ActiveMapEvent | null {
  const active = eventInFront(events, { ...avatar, direction }, mapId, state);
  return active?.page.settings.trigger === 1 ? active : null;
}

export function transferForEvent(map: ImportedMap, activeEvent: ActiveMapEvent): ImportedTransfer | null {
  return map.transfers.find((transfer) => transfer.eventId === activeEvent.event.id && transfer.pageIndex === activeEvent.pageIndex) ?? null;
}

export interface SourceDialogueVariables {
  readonly playerName: string;
}

const DEFAULT_DIALOGUE_VARIABLES: SourceDialogueVariables = { playerName: "Joueur" };

function readableDialogueText(text: string, variables: SourceDialogueVariables): string {
  return text.replaceAll(/\\c\[\d+\]/gu, "").replaceAll(/<br\s*\/?>/giu, "\n")
    .replaceAll(/<[^>]+>/gu, "").replaceAll(/\\PN/giu, () => variables.playerName).trim();
}

function dialogueKey(text: string): string {
  return text.replaceAll(/\s+/gu, " ").trim();
}

export function localizedDialogueText(text: string, translations: ReadonlyMap<string, string> = new Map(),
  variables: SourceDialogueVariables = DEFAULT_DIALOGUE_VARIABLES): string {
  return readableDialogueText(translations.get(dialogueKey(text)) ?? text, variables);
}

export function dialogueLines(page: ImportedEventPage, translations: ReadonlyMap<string, string> = new Map(),
  variables: SourceDialogueVariables = DEFAULT_DIALOGUE_VARIABLES): string[] {
  const lines: string[] = [];
  for (let index = 0; index < page.commands.length;) {
    const command = page.commands[index];
    if (command === undefined || (command.kind !== "show-text" && command.kind !== "text-continuation") || command.text === null) {
      index += 1;
      continue;
    }
    const candidates: string[] = [];
    let cursor = index;
    while (cursor < page.commands.length) {
      const next = page.commands[cursor];
      if (next === undefined || (next.kind !== "show-text" && next.kind !== "text-continuation") || next.text === null) break;
      candidates.push(next.text);
      cursor += 1;
    }
    let consumed = 1;
    let value = translations.get(dialogueKey(command.text)) ?? command.text;
    for (let length = candidates.length; length > 1; length -= 1) {
      const combined = dialogueKey(candidates.slice(0, length).join(" "));
      const translated = translations.get(combined);
      if (translated !== undefined) { value = translated; consumed = length; break; }
    }
    const readable = readableDialogueText(value, variables);
    if (readable !== "") lines.push(readable);
    index += consumed;
  }
  return lines;
}

function parseMapEvents(value: unknown): ImportedMapEvent[] {
  if (!isRecord(value) || !Array.isArray(value.events)) throw new Error("Le fichier d'evenements de la carte est invalide.");
  return value.events.map((entry) => {
    if (!isRecord(entry) || !Number.isInteger(entry.id) || typeof entry.name !== "string"
      || !Number.isInteger(entry.x) || !Number.isInteger(entry.y) || !Array.isArray(entry.pages)) {
      throw new Error("Un evenement de la carte est invalide.");
    }
    const pages = entry.pages.map((page) => {
      if (!isRecord(page) || !isRecord(page.condition) || !isRecord(page.graphic) || !isRecord(page.settings) || !Array.isArray(page.commands)
        || typeof page.graphic.characterName !== "string" || !Number.isInteger(page.graphic.tileId)
        || !Number.isInteger(page.graphic.direction) || !Number.isInteger(page.graphic.pattern)
        || !Number.isInteger(page.graphic.opacity) || !Number.isInteger(page.settings.moveType)
        || !Number.isInteger(page.settings.moveSpeed) || !Number.isInteger(page.settings.moveFrequency)
        || typeof page.settings.walkAnimation !== "boolean"
        || typeof page.settings.stepAnimation !== "boolean" || typeof page.settings.directionFix !== "boolean"
        || typeof page.settings.through !== "boolean"
        || typeof page.settings.alwaysOnTop !== "boolean" || !Number.isInteger(page.settings.trigger)) throw new Error("Une page d'evenement est invalide.");
      const nullableNumber = (candidate: unknown): number | null => candidate === null ? null
        : Number.isInteger(candidate) ? candidate as number : (() => { throw new Error("Une condition d'evenement est invalide."); })();
      if (page.condition.variable !== null && (!isRecord(page.condition.variable) || !Number.isInteger(page.condition.variable.id)
        || !Number.isInteger(page.condition.variable.minimum))) throw new Error("Une variable d'evenement est invalide.");
      if (page.condition.selfSwitch !== null && typeof page.condition.selfSwitch !== "string") throw new Error("Un self switch est invalide.");
      const moveRoute = page.settings.moveRoute === undefined ? null : parseSourceMoveRoute(page.settings.moveRoute);
      if (page.settings.moveType === 3 && moveRoute === null) throw new Error("Une route autonome d'evenement est invalide.");
      return {
        condition: { switch1Id: nullableNumber(page.condition.switch1Id), switch2Id: nullableNumber(page.condition.switch2Id),
          variable: page.condition.variable as { readonly id: number; readonly minimum: number } | null, selfSwitch: page.condition.selfSwitch },
        graphic: { tileId: page.graphic.tileId as number, characterName: page.graphic.characterName,
          direction: page.graphic.direction as number, pattern: page.graphic.pattern as number, opacity: page.graphic.opacity as number },
        settings: { moveType: page.settings.moveType as number, moveSpeed: page.settings.moveSpeed as number,
          moveFrequency: page.settings.moveFrequency as number,
          moveRoute,
          walkAnimation: page.settings.walkAnimation, stepAnimation: page.settings.stepAnimation,
          directionFix: page.settings.directionFix, through: page.settings.through,
          alwaysOnTop: page.settings.alwaysOnTop, trigger: page.settings.trigger as number },
        commands: page.commands.map((command) => {
          if (!isRecord(command) || typeof command.kind !== "string" || !Number.isInteger(command.indent) || !isRecord(command.data)) {
            throw new Error("Une commande d'evenement est invalide.");
          }
          return { kind: command.kind, text: typeof command.data.text === "string" ? command.data.text : null,
            indent: command.indent as number, data: { ...command.data } };
        }),
      };
    });
    return { id: entry.id as number, name: entry.name, x: entry.x as number, y: entry.y as number, pages };
  });
}

export function parseMapTranslations(value: unknown, mapId: number): ReadonlyMap<string, string> {
  if (!isRecord(value) || !isRecord(value.categories) || !Array.isArray(value.categories.mapDialogues)) {
    throw new Error("Le catalogue de traduction est invalide.");
  }
  const translations = new Map<string, string>();
  for (const entry of value.categories.mapDialogues) {
    if (!isRecord(entry) || typeof entry.key !== "string" || typeof entry.value !== "string" || typeof entry.context !== "string") {
      throw new Error("Une traduction de dialogue est invalide.");
    }
    if (entry.context === String(mapId)) translations.set(dialogueKey(entry.key), entry.value);
  }
  return translations;
}

export function parseImportedItems(itemsValue: unknown, localizationValue: unknown): ReadonlyMap<string, SourceShopItem> {
  if (!isRecord(itemsValue) || !Array.isArray(itemsValue.records) || !isRecord(localizationValue)
    || !isRecord(localizationValue.categories) || !Array.isArray(localizationValue.categories.itemNames)) {
    throw new Error("Le catalogue de noms d'objets est invalide.");
  }
  const translatedById = new Map<number, string>();
  for (const entry of localizationValue.categories.itemNames) {
    if (!isRecord(entry) || typeof entry.key !== "string" || typeof entry.value !== "string") continue;
    const id = Number(entry.key);
    if (Number.isInteger(id) && id >= 0 && entry.value !== "") translatedById.set(id, entry.value);
  }
  const translatedDescriptions = localizedNames(localizationValue, "itemDescriptions");
  const result = new Map<string, SourceShopItem>();
  for (const entry of itemsValue.records) {
    if (!isRecord(entry) || !Number.isInteger(entry.id) || typeof entry.internalName !== "string" || typeof entry.name !== "string"
      || typeof entry.description !== "string" || !Number.isInteger(entry.pocket) || !Number.isInteger(entry.price)
      || (entry.price as number) < 0) continue;
    result.set(entry.internalName, { id: entry.id as number, internalName: entry.internalName,
      name: translatedById.get(entry.id as number) ?? entry.name,
      description: translatedDescriptions.get(entry.id as number) ?? entry.description,
      pocket: entry.pocket as number, price: entry.price as number });
  }
  return result;
}

function localizedNames(localizationValue: unknown, category: string): ReadonlyMap<number, string> {
  if (!isRecord(localizationValue) || !isRecord(localizationValue.categories)) return new Map();
  const entries = localizationValue.categories[category];
  if (!Array.isArray(entries)) return new Map();
  const names = new Map<number, string>();
  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.key !== "string" || typeof entry.value !== "string") continue;
    const id = Number(entry.key);
    if (Number.isInteger(id) && entry.value !== "") names.set(id, entry.value);
  }
  return names;
}

function parseBattleCatalog(pokemonValue: unknown, movesValue: unknown, localizationValue: unknown): PlayerCreationCatalog {
  if (!isRecord(pokemonValue) || !Array.isArray(pokemonValue.records) || !isRecord(movesValue) || !Array.isArray(movesValue.records)) {
    throw new Error("Les catalogues Pokémon et capacités sont invalides.");
  }
  const pokemonNames = localizedNames(localizationValue, "pokemonNames");
  const moveNames = localizedNames(localizationValue, "moveNames");
  const pokemon = pokemonValue.records.map((entry) => {
    if (!isRecord(entry) || !Number.isInteger(entry.id) || typeof entry.internalName !== "string" || typeof entry.name !== "string" || !Array.isArray(entry.types)
      || !entry.types.every((type) => typeof type === "string") || !isRecord(entry.baseStats) || !Array.isArray(entry.abilities)
      || typeof entry.growthRate !== "string" || !Number.isInteger(entry.baseExperience) || (entry.baseExperience as number) < 1
      || !entry.abilities.every((ability) => typeof ability === "string") || !Array.isArray(entry.levelUpMoves)) {
      throw new Error("Une définition de Pokémon est invalide.");
    }
    const baseStats = entry.baseStats;
    const stat = (name: string): number => {
      const value = baseStats[name];
      if (!Number.isInteger(value) || (value as number) < 1) throw new Error("Une statistique de base est invalide.");
      return value as number;
    };
    const levelUpMoves = entry.levelUpMoves.map((move) => {
      if (!isRecord(move) || !Number.isInteger(move.level) || typeof move.move !== "string") throw new Error("Une capacité de niveau est invalide.");
      return { level: move.level as number, move: move.move };
    });
    return { internalName: entry.internalName, name: pokemonNames.get(entry.id as number) ?? entry.name, types: entry.types as string[],
      baseStats: { hp: stat("hp"), attack: stat("attack"), defense: stat("defense"), speed: stat("speed"),
        specialAttack: stat("specialAttack"), specialDefense: stat("specialDefense") },
      abilities: entry.abilities as string[], levelUpMoves, growthRate: entry.growthRate, baseExperience: entry.baseExperience as number };
  });
  const moves = movesValue.records.map((entry) => {
    if (!isRecord(entry) || !Number.isInteger(entry.id) || typeof entry.internalName !== "string" || typeof entry.name !== "string"
      || typeof entry.functionCode !== "string" || !Number.isInteger(entry.power) || typeof entry.type !== "string"
      || !["Physical", "Special", "Status"].includes(String(entry.category)) || !Number.isInteger(entry.accuracy)
      || !Number.isInteger(entry.pp) || !Number.isInteger(entry.priority) || !Number.isInteger(entry.effectChance) || typeof entry.flags !== "string") {
      throw new Error("Une définition de capacité est invalide.");
    }
    return { id: entry.id as number, internalName: entry.internalName, name: moveNames.get(entry.id as number) ?? entry.name, functionCode: entry.functionCode,
      power: entry.power as number, type: entry.type, category: entry.category as "Physical" | "Special" | "Status",
      accuracy: entry.accuracy as number, pp: entry.pp as number, priority: entry.priority as number,
      effectChance: entry.effectChance as number, flags: entry.flags };
  });
  return { pokemon, moves };
}

const jsonCache = new Map<string, Promise<unknown>>();
const imageCache = new Map<string, Promise<HTMLImageElement>>();

function fetchJson(url: string): Promise<unknown> {
  const cached = jsonCache.get(url);
  if (cached !== undefined) return cached;
  const pending = fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${url} : HTTP ${response.status}`);
    return response.json() as Promise<unknown>;
  });
  jsonCache.set(url, pending);
  return pending;
}

function sourceImageUrl(folder: "Tilesets" | "Autotiles" | "Characters", name: string): string {
  return `/__pokemon-z/source/Graphics/${folder}/${encodeURIComponent(name)}.png`;
}

export interface ImportedFollowerRender {
  readonly image: HTMLImageElement;
  readonly pose: ImportedAvatar & { readonly pattern: number };
}

export interface ImportedRemotePlayerRender {
  readonly image: HTMLImageElement;
  readonly pose: ImportedAvatar;
  readonly pattern: number;
  readonly renderOffsetY?: number;
}

function sourceAssetUrl(path: string): string {
  return `/__pokemon-z/source/${path.replaceAll("\\", "/").split("/").map(encodeURIComponent).join("/")}`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached !== undefined) return cached;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error(`Image locale introuvable : ${url}`)), { once: true });
    image.src = url;
  });
  imageCache.set(url, pending);
  return pending;
}

export function loadSourceAssetImage(path: string): Promise<HTMLImageElement> {
  const normalized = path.replaceAll("\\", "/");
  if (!normalized.startsWith("Graphics/Characters/") || normalized.includes("..")) {
    return Promise.reject(new Error(`Asset de personnage invalide : ${path}`));
  }
  return loadImage(sourceAssetUrl(normalized));
}

function parsePokemonOverworldPaths(value: unknown): ReadonlyMap<string, string> {
  if (!isRecord(value) || !Array.isArray(value.records)) throw new Error("Le manifeste des sprites Pokémon est invalide.");
  const paths = new Map<string, string>();
  for (const record of value.records) {
    if (!isRecord(record) || typeof record.internalName !== "string" || !isRecord(record.assets)
      || !Array.isArray(record.assets.overworld)) continue;
    const candidates = record.assets.overworld.filter((entry) => isRecord(entry) && typeof entry.path === "string");
    const selected = candidates.find((entry) => entry.form === null && entry.shiny === false) ?? candidates[0];
    if (selected !== undefined && typeof selected.path === "string") paths.set(record.internalName, selected.path);
  }
  return paths;
}

export async function loadImportedMap(mapId: number): Promise<ImportedMapAssets> {
  if (!Number.isInteger(mapId) || mapId < 1 || mapId > 999) throw new RangeError(`Identifiant de carte invalide : ${mapId}.`);
  const mapFile = `Map${String(mapId).padStart(3, "0")}.json`;
  const [mapValue, tilesetValue, eventValue, localizationValue, itemsValue, pokemonValue, pokemonAssetsValue, movesValue, encountersValue,
    battleMetadataValue, trainersValue, trainerTypesValue] = await Promise.all([
    fetchJson(`/__pokemon-z/data/maps/${mapFile}`), fetchJson("/__pokemon-z/data/tilesets.json"), fetchJson(`/__pokemon-z/data/events/${mapFile}`),
    fetchJson("/__pokemon-z/data/localization.json"), fetchJson("/__pokemon-z/data/items.json"),
    fetchJson("/__pokemon-z/data/pokemon.json"), fetchJson("/__pokemon-z/data/pokemon-assets.json"),
    fetchJson("/__pokemon-z/data/moves.json"),
    fetchJson("/__pokemon-z/data/encounters.json"),
    fetchJson("/__pokemon-z/data/map-battle-metadata.json"),
    fetchJson("/__pokemon-z/data/trainers.json"), fetchJson("/__pokemon-z/data/trainer-types.json"),
  ]);
  const map = parseImportedMap(mapValue);
  const tilesets = parseTilesets(tilesetValue);
  const events = parseMapEvents(eventValue);
  const mapTranslations = parseMapTranslations(localizationValue, map.id);
  const items = parseImportedItems(itemsValue, localizationValue);
  const itemNames = new Map([...items].map(([id, item]) => [id, item.name]));
  const battleCatalog = parseBattleCatalog(pokemonValue, movesValue, localizationValue);
  const pokemonOverworldPaths = parsePokemonOverworldPaths(pokemonAssetsValue);
  const trainers = parseImportedTrainers(trainersValue);
  const trainerTypes = parseImportedTrainerTypes(trainerTypesValue);
  const battlePresentation = parseBattlePresentation(battleMetadataValue, mapId);
  const tileset = tilesets.records.find((entry) => entry.id === map.tilesetId);
  if (tileset === undefined) throw new Error(`Tileset ${map.tilesetId} introuvable.`);
  const characterNames = [...new Set([
    ...events.flatMap((event) => event.pages.map((page) => page.graphic.characterName)).filter((name) => name !== ""),
    ...routeCharacterNames(events),
  ])];
  const [tilesetImage, playerImage, playerPickupImage, autotileImages, characters] = await Promise.all([
    loadImage(sourceImageUrl("Tilesets", tileset.tilesetName)), loadImage(sourceImageUrl("Characters", "trchar000")),
    loadImage(sourceImageUrl("Characters", "trchar000_2")),
    Promise.all(tileset.autotileNames.map((name) => name === "" ? Promise.resolve(null) : loadImage(sourceImageUrl("Autotiles", name)))),
    Promise.all(characterNames.map((name) => loadImage(sourceImageUrl("Characters", name)))),
  ]);
  return { map, tileset, tilesetImage, autotileImages, events,
    characterImages: new Map(characterNames.map((name, index) => [name, characters[index]!])), playerImage, playerPickupImage,
    mapTranslations, itemNames, items, pokemonOverworldPaths, battleCatalog,
    trainers, trainerTypes,
    encounter: parseEncounter(encountersValue, mapId), ...battlePresentation };
}

export function loadImportedMap003(): Promise<ImportedMapAssets> {
  return loadImportedMap(3);
}

export function moveImportedAvatar(map: ImportedMap, avatar: ImportedAvatar, direction: Direction, occupied: readonly GridPoint[] = []): ImportedAvatar {
  const delta = DELTAS[direction];
  const target = { x: avatar.x + delta.x, y: avatar.y + delta.y };
  if (target.x < 0 || target.y < 0 || target.x >= map.width || target.y >= map.height) return { ...avatar, direction };
  const sourceMask = map.collision.masks[avatar.y * map.width + avatar.x] ?? 0;
  const targetMask = map.collision.masks[target.y * map.width + target.x] ?? 0;
  if ((sourceMask & DIRECTION_BITS[direction]) === 0 || (targetMask & DIRECTION_BITS[OPPOSITE[direction]]) === 0) {
    return { ...avatar, direction };
  }
  if (occupied.some((point) => point.x === target.x && point.y === target.y)) return { ...avatar, direction };
  return { ...target, direction };
}

function drawTile(context: CanvasRenderingContext2D, assets: ImportedMapAssets, tileId: number, x: number, y: number, frame: number): void {
  if (tileId === 0) return;
  if (tileId >= 384) {
    const index = tileId - 384;
    context.drawImage(assets.tilesetImage, (index % 8) * 32, Math.floor(index / 8) * 32, 32, 32, x, y, 32, 32);
    return;
  }
  if (tileId < 48) return;
  const slot = Math.floor(tileId / 48) - 1;
  const image = assets.autotileImages[slot];
  if (image === null || image === undefined) return;
  if (image.height === 32) {
    const frames = Math.max(1, Math.floor(image.width / 32));
    context.drawImage(image, (frame % frames) * 32, 0, 32, 32, x, y, 32, 32);
    return;
  }
  const parts = AUTOTILE_PARTS[tileId % 48];
  if (parts === undefined || image.height < 128) return;
  const frames = Math.max(1, Math.floor(image.width / 96));
  const frameX = (frame % frames) * 96;
  parts.forEach((part, quarter) => {
    const index = part - 1;
    context.drawImage(image, frameX + (index % 6) * 16, Math.floor(index / 6) * 16, 16, 16,
      x + (quarter % 2) * 16, y + Math.floor(quarter / 2) * 16, 16, 16);
  });
}

function directionRow(direction: number): number {
  switch (direction) {
    case 4: return 1;
    case 6: return 2;
    case 8: return 3;
    default: return 0;
  }
}

function directionNumber(direction: Direction): number {
  switch (direction) {
    case "down": return 2;
    case "left": return 4;
    case "right": return 6;
    case "up": return 8;
  }
}

export function eventGraphicPattern(page: ImportedEventPage, now: number): number {
  return page.settings.stepAnimation ? Math.floor(Math.max(0, now) / 180) % 4 : page.graphic.pattern;
}

export interface ImportedCameraOffset { readonly x: number; readonly y: number }

export function importedCameraPosition(canvas: Pick<HTMLCanvasElement, "width" | "height">,
  map: Pick<ImportedMap, "width" | "height">, avatar: Pick<ImportedAvatar, "x" | "y">,
  offset: ImportedCameraOffset = { x: 0, y: 0 }): ImportedCameraOffset {
  return {
    x: Math.round(Math.max(0, Math.min(map.width * 32 - canvas.width,
      avatar.x * 32 + 16 - canvas.width / 2 + offset.x))),
    y: Math.round(Math.max(0, Math.min(map.height * 32 - canvas.height,
      avatar.y * 32 + 16 - canvas.height / 2 + offset.y))),
  };
}

function drawCharacter(context: CanvasRenderingContext2D, image: HTMLImageElement, direction: number, pattern: number,
  opacity: number, tileX: number, tileY: number, cameraX: number, cameraY: number, shadow = true,
  renderOffsetY = 0): void {
  const frameWidth = image.naturalWidth / 4;
  const frameHeight = image.naturalHeight / 4;
  const destinationX = tileX * 32 + 16 - frameWidth / 2 - cameraX;
  const destinationY = tileY * 32 + 32 - frameHeight - cameraY + renderOffsetY;
  context.save();
  context.globalAlpha = Math.max(0, Math.min(1, opacity / 255));
  if (shadow && opacity > 0) {
    context.fillStyle = "rgba(8, 14, 12, 0.32)";
    context.beginPath();
    context.ellipse(tileX * 32 + 16 - cameraX, tileY * 32 + 29 - cameraY,
      Math.max(6, Math.min(12, frameWidth * 0.28)), 4, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.drawImage(image, (pattern % 4) * frameWidth, directionRow(direction) * frameHeight, frameWidth, frameHeight,
    destinationX, destinationY, frameWidth, frameHeight);
  context.restore();
}

export function sourcePriorityTileZ(tileY: number, priority: number): number {
  return tileY * 32 + priority * 32 + 32;
}

export function sourceCharacterZ(tileY: number, frameHeight: number): number {
  return tileY * 32 + 32 + (frameHeight > 32 ? 31 : 0);
}

export function sourceEventHasShadow(eventName: string): boolean {
  return !/\/noShadow\//iu.test(eventName);
}

export function eventPoseForActivePage(pose: ImportedEventPose | undefined, page: ImportedEventPage,
  pageIndex: number): ImportedEventPose | undefined {
  if (pose === undefined || pose.pageIndex === undefined || pose.pageIndex === pageIndex) return pose;
  return { x: pose.x, y: pose.y, direction: page.graphic.direction, pageIndex };
}

export function drawImportedMap(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, assets: ImportedMapAssets,
  avatar: ImportedAvatar, playerPattern: number, now: number, state: SourceEventState = EMPTY_SOURCE_EVENT_STATE,
  eventPoses: ReadonlyMap<number, ImportedEventPose> = new Map(), cameraOffset: ImportedCameraOffset = { x: 0, y: 0 },
  playerImage: HTMLImageElement = assets.playerImage, playerOffsetY = 0,
  follower: ImportedFollowerRender | null = null,
  remotePlayers: readonly ImportedRemotePlayerRender[] = []): void {
  const map = assets.map;
  const camera = importedCameraPosition(canvas, map, avatar, cameraOffset);
  const cameraX = camera.x;
  const cameraY = camera.y;
  const startX = Math.max(0, Math.floor(cameraX / 32));
  const startY = Math.max(0, Math.floor(cameraY / 32));
  const endX = Math.min(map.width, Math.ceil((cameraX + canvas.width) / 32));
  const endY = Math.min(map.height, Math.ceil((cameraY + canvas.height) / 32));
  const frame = Math.floor(now / 180);
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  const mapLayers = [map.layers.lower, map.layers.middle, map.layers.upper] as const;
  for (const layer of mapLayers) {
    for (let y = startY; y < endY; y += 1) for (let x = startX; x < endX; x += 1) {
      const tileId = layer[y * map.width + x] ?? 0;
      if ((assets.tileset.priorities[tileId] ?? 0) === 0) {
        drawTile(context, assets, tileId, x * 32 - cameraX, y * 32 - cameraY, frame);
      }
    }
  }
  const drawnTransferEvents = new Set<number>();
  for (const transfer of map.transfers) {
    if (drawnTransferEvents.has(transfer.eventId)) continue;
    const event = assets.events.find((candidate) => candidate.id === transfer.eventId);
    const selection = event === undefined ? null : selectActiveEventPage(event, map.id, state);
    if (event === undefined || selection === null || selection.pageIndex !== transfer.pageIndex) continue;
    drawnTransferEvents.add(transfer.eventId);
    for (const point of eventFootprint(event)) {
      const x = point.x * 32 - cameraX;
      const y = point.y * 32 - cameraY;
      if (x > -32 && y > -32 && x < canvas.width && y < canvas.height) {
        context.fillStyle = "#ffe27822"; context.fillRect(x + 3, y + 3, 26, 26);
        context.strokeStyle = "#ffe278"; context.lineWidth = 2; context.strokeRect(x + 4, y + 4, 24, 24);
      }
    }
  }
  const eventEntries = assets.events.flatMap((event) => {
    const selection = selectActiveEventPage(event, map.id, state);
    if (selection === null) return [];
    const page = selection.page;
    const pose = eventPoseForActivePage(eventPoses.get(event.id), page, selection.pageIndex);
    const characterName = pose?.characterName ?? page?.graphic.characterName ?? "";
    return characterName === "" && page.graphic.tileId === 0 ? [] : [{ event, page, pose }];
  });
  const normalEntries = eventEntries.filter(({ page }) => !page.settings.alwaysOnTop);
  const topEntries = eventEntries.filter(({ page }) => page.settings.alwaysOnTop);
  const drawEvent = ({ event, page, pose }: typeof normalEntries[number]): void => {
    const eventX = pose?.x ?? event.x;
    const eventY = pose?.y ?? event.y;
    const destinationX = eventX * 32 - cameraX;
    const destinationY = eventY * 32 - cameraY;
    if (page.graphic.tileId > 0) drawTile(context, assets, page.graphic.tileId, destinationX, destinationY, frame);
    else {
      const image = assets.characterImages.get(pose?.characterName ?? page.graphic.characterName);
      if (image !== undefined) drawCharacter(context, image, pose?.direction ?? page.graphic.direction,
        pose?.pattern ?? eventGraphicPattern(page, now), pose?.opacity ?? page.graphic.opacity,
        eventX, eventY, cameraX, cameraY, sourceEventHasShadow(event.name));
    }
  };
  type Renderable = { readonly z: number; readonly order: number; readonly draw: () => void };
  const renderables: Renderable[] = [];
  let order = 0;
  for (const layer of mapLayers) for (let y = startY; y < endY; y += 1) for (let x = startX; x < endX; x += 1) {
    const tileId = layer[y * map.width + x] ?? 0;
    const priority = assets.tileset.priorities[tileId] ?? 0;
    if (tileId !== 0 && priority > 0) renderables.push({ z: sourcePriorityTileZ(y, priority), order: order++,
      draw: () => drawTile(context, assets, tileId, x * 32 - cameraX, y * 32 - cameraY, frame) });
  }
  for (const entry of normalEntries) {
    const eventY = entry.pose?.y ?? entry.event.y;
    const tileId = entry.page.graphic.tileId;
    const image = tileId > 0 ? undefined : assets.characterImages.get(entry.pose?.characterName ?? entry.page.graphic.characterName);
    const z = tileId > 0 ? sourcePriorityTileZ(eventY, assets.tileset.priorities[tileId] ?? 0)
      : sourceCharacterZ(eventY, image === undefined ? 32 : image.naturalHeight / 4);
    renderables.push({ z, order: order++, draw: () => drawEvent(entry) });
  }
  if (follower !== null) {
    const pose = follower.pose;
    renderables.push({ z: sourceCharacterZ(pose.y, follower.image.naturalHeight / 4), order: order++, draw: () => {
      drawCharacter(context, follower.image, directionNumber(pose.direction), pose.pattern, 255,
        pose.x, pose.y, cameraX, cameraY, true);
    } });
  }
  for (const remote of remotePlayers) {
    renderables.push({ z: sourceCharacterZ(remote.pose.y, remote.image.naturalHeight / 4), order: order++, draw: () => {
      drawCharacter(context, remote.image, directionNumber(remote.pose.direction), remote.pattern, 255,
        remote.pose.x, remote.pose.y, cameraX, cameraY, true, remote.renderOffsetY ?? 0);
    } });
  }
  renderables.push({ z: sourceCharacterZ(avatar.y, playerImage.naturalHeight / 4), order: order++, draw: () => {
    drawCharacter(context, playerImage, directionNumber(avatar.direction), playerPattern, 255,
      avatar.x, avatar.y, cameraX, cameraY, true, playerOffsetY);
  } });
  renderables.sort((left, right) => left.z - right.z || left.order - right.order).forEach((renderable) => {
    renderable.draw();
  });
  topEntries.forEach(drawEvent);
}
