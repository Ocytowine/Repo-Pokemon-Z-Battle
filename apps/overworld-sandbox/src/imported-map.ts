import type { Direction, GridPoint } from "@pokemon-z-battle/overworld-engine";

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

interface ImportedTileset {
  readonly id: number;
  readonly tilesetName: string;
  readonly autotileNames: readonly string[];
}

interface TilesetFile { readonly records: readonly ImportedTileset[] }

export interface ImportedEventPage {
  readonly condition: { readonly switch1Id: number | null; readonly switch2Id: number | null; readonly variable: unknown | null; readonly selfSwitch: string | null };
  readonly graphic: { readonly tileId: number; readonly characterName: string; readonly direction: number; readonly pattern: number; readonly opacity: number };
  readonly settings: { readonly through: boolean; readonly alwaysOnTop: boolean; readonly trigger: number };
  readonly commands: readonly { readonly kind: string; readonly text: string | null }[];
}

export interface ImportedMapEvent extends GridPoint {
  readonly id: number;
  readonly name: string;
  readonly pages: readonly ImportedEventPage[];
}

export interface ImportedMapAssets {
  readonly map: ImportedMap;
  readonly tileset: ImportedTileset;
  readonly tilesetImage: HTMLImageElement;
  readonly autotileImages: readonly (HTMLImageElement | null)[];
  readonly events: readonly ImportedMapEvent[];
  readonly characterImages: ReadonlyMap<string, HTMLImageElement>;
  readonly playerImage: HTMLImageElement;
  readonly mapTranslations: ReadonlyMap<string, string>;
}

export interface ImportedAvatar extends GridPoint { readonly direction: Direction }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
      || !Array.isArray(entry.autotileNames) || !entry.autotileNames.every((name) => typeof name === "string")) {
      throw new Error("Une configuration de tileset est invalide.");
    }
    return { id: entry.id as number, tilesetName: entry.tilesetName, autotileNames: entry.autotileNames as string[] };
  });
  return { records };
}

export function selectDefaultEventPage(event: ImportedMapEvent): ImportedEventPage | null {
  return selectDefaultEventPageWithIndex(event)?.page ?? null;
}

export function selectDefaultEventPageWithIndex(event: ImportedMapEvent): { readonly page: ImportedEventPage; readonly pageIndex: number } | null {
  for (let index = event.pages.length - 1; index >= 0; index -= 1) {
    const page = event.pages[index];
    if (page !== undefined && page.condition.switch1Id === null && page.condition.switch2Id === null
      && page.condition.variable === null && page.condition.selfSwitch === null) return { page, pageIndex: index };
  }
  return null;
}

export function blockingDefaultEventPoints(events: readonly ImportedMapEvent[]): GridPoint[] {
  return events.flatMap((event) => {
    const page = selectDefaultEventPage(event);
    const visible = page !== null && (page.graphic.characterName !== "" || page.graphic.tileId > 0);
    return visible && !page.settings.through ? [{ x: event.x, y: event.y }] : [];
  });
}

export interface ActiveMapEvent { readonly event: ImportedMapEvent; readonly page: ImportedEventPage; readonly pageIndex: number }

export function activeEventAt(events: readonly ImportedMapEvent[], x: number, y: number): ActiveMapEvent | null {
  const event = events.find((candidate) => candidate.x === x && candidate.y === y);
  if (event === undefined) return null;
  const selection = selectDefaultEventPageWithIndex(event);
  return selection === null ? null : { event, ...selection };
}

export function eventInFront(events: readonly ImportedMapEvent[], avatar: ImportedAvatar): ActiveMapEvent | null {
  const delta = DELTAS[avatar.direction];
  return activeEventAt(events, avatar.x + delta.x, avatar.y + delta.y);
}

export function transferForEvent(map: ImportedMap, activeEvent: ActiveMapEvent): ImportedTransfer | null {
  return map.transfers.find((transfer) => transfer.eventId === activeEvent.event.id && transfer.pageIndex === activeEvent.pageIndex) ?? null;
}

function readableDialogueText(text: string): string {
  return text.replaceAll(/\\c\[\d+\]/gu, "").replaceAll(/\\PN/gu, "Joueur")
    .replaceAll(/<br\s*\/?>/giu, "\n").replaceAll(/<[^>]+>/gu, "").trim();
}

function dialogueKey(text: string): string {
  return text.replaceAll(/\s+/gu, " ").trim();
}

export function dialogueLines(page: ImportedEventPage, translations: ReadonlyMap<string, string> = new Map()): string[] {
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
    const readable = readableDialogueText(value);
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
        || !Number.isInteger(page.graphic.opacity) || typeof page.settings.through !== "boolean"
        || typeof page.settings.alwaysOnTop !== "boolean" || !Number.isInteger(page.settings.trigger)) throw new Error("Une page d'evenement est invalide.");
      const nullableNumber = (candidate: unknown): number | null => candidate === null ? null
        : Number.isInteger(candidate) ? candidate as number : (() => { throw new Error("Une condition d'evenement est invalide."); })();
      if (page.condition.variable !== null && !isRecord(page.condition.variable)) throw new Error("Une variable d'evenement est invalide.");
      if (page.condition.selfSwitch !== null && typeof page.condition.selfSwitch !== "string") throw new Error("Un self switch est invalide.");
      return {
        condition: { switch1Id: nullableNumber(page.condition.switch1Id), switch2Id: nullableNumber(page.condition.switch2Id),
          variable: page.condition.variable, selfSwitch: page.condition.selfSwitch },
        graphic: { tileId: page.graphic.tileId as number, characterName: page.graphic.characterName,
          direction: page.graphic.direction as number, pattern: page.graphic.pattern as number, opacity: page.graphic.opacity as number },
        settings: { through: page.settings.through, alwaysOnTop: page.settings.alwaysOnTop, trigger: page.settings.trigger as number },
        commands: page.commands.map((command) => {
          if (!isRecord(command) || typeof command.kind !== "string" || !isRecord(command.data)) throw new Error("Une commande d'evenement est invalide.");
          return { kind: command.kind, text: typeof command.data.text === "string" ? command.data.text : null };
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

export async function loadImportedMap(mapId: number): Promise<ImportedMapAssets> {
  if (!Number.isInteger(mapId) || mapId < 1 || mapId > 999) throw new RangeError(`Identifiant de carte invalide : ${mapId}.`);
  const mapFile = `Map${String(mapId).padStart(3, "0")}.json`;
  const [mapValue, tilesetValue, eventValue, localizationValue] = await Promise.all([
    fetchJson(`/__pokemon-z/data/maps/${mapFile}`), fetchJson("/__pokemon-z/data/tilesets.json"), fetchJson(`/__pokemon-z/data/events/${mapFile}`),
    fetchJson("/__pokemon-z/data/localization.json"),
  ]);
  const map = parseImportedMap(mapValue);
  const tilesets = parseTilesets(tilesetValue);
  const events = parseMapEvents(eventValue);
  const mapTranslations = parseMapTranslations(localizationValue, map.id);
  const tileset = tilesets.records.find((entry) => entry.id === map.tilesetId);
  if (tileset === undefined) throw new Error(`Tileset ${map.tilesetId} introuvable.`);
  const characterNames = [...new Set(events.map(selectDefaultEventPage).map((page) => page?.graphic.characterName ?? "").filter((name) => name !== ""))];
  const [tilesetImage, playerImage, autotileImages, characters] = await Promise.all([
    loadImage(sourceImageUrl("Tilesets", tileset.tilesetName)), loadImage(sourceImageUrl("Characters", "trchar000")),
    Promise.all(tileset.autotileNames.map((name) => name === "" ? Promise.resolve(null) : loadImage(sourceImageUrl("Autotiles", name)))),
    Promise.all(characterNames.map((name) => loadImage(sourceImageUrl("Characters", name)))),
  ]);
  return { map, tileset, tilesetImage, autotileImages, events,
    characterImages: new Map(characterNames.map((name, index) => [name, characters[index]!])), playerImage, mapTranslations };
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

function drawCharacter(context: CanvasRenderingContext2D, image: HTMLImageElement, direction: number, pattern: number,
  opacity: number, tileX: number, tileY: number, cameraX: number, cameraY: number): void {
  const frameWidth = image.naturalWidth / 4;
  const frameHeight = image.naturalHeight / 4;
  const destinationX = tileX * 32 + 16 - frameWidth / 2 - cameraX;
  const destinationY = tileY * 32 + 32 - frameHeight - cameraY;
  context.save();
  context.globalAlpha = Math.max(0, Math.min(1, opacity / 255));
  context.drawImage(image, (pattern % 4) * frameWidth, directionRow(direction) * frameHeight, frameWidth, frameHeight,
    destinationX, destinationY, frameWidth, frameHeight);
  context.restore();
}

export function drawImportedMap(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, assets: ImportedMapAssets,
  avatar: ImportedAvatar, playerPattern: number, now: number): void {
  const map = assets.map;
  const cameraX = Math.max(0, Math.min(map.width * 32 - canvas.width, avatar.x * 32 + 16 - canvas.width / 2));
  const cameraY = Math.max(0, Math.min(map.height * 32 - canvas.height, avatar.y * 32 + 16 - canvas.height / 2));
  const startX = Math.max(0, Math.floor(cameraX / 32));
  const startY = Math.max(0, Math.floor(cameraY / 32));
  const endX = Math.min(map.width, Math.ceil((cameraX + canvas.width) / 32));
  const endY = Math.min(map.height, Math.ceil((cameraY + canvas.height) / 32));
  const frame = Math.floor(now / 180);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#07110d";
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (const layer of [map.layers.lower, map.layers.middle, map.layers.upper]) {
    for (let y = startY; y < endY; y += 1) for (let x = startX; x < endX; x += 1) {
      drawTile(context, assets, layer[y * map.width + x] ?? 0, x * 32 - cameraX, y * 32 - cameraY, frame);
    }
  }
  for (const transfer of map.transfers) {
    const x = transfer.eventX * 32 - cameraX;
    const y = transfer.eventY * 32 - cameraY;
    if (x > -32 && y > -32 && x < canvas.width && y < canvas.height) {
      context.strokeStyle = "#ffe278"; context.lineWidth = 2; context.strokeRect(x + 8, y + 8, 16, 16);
    }
  }
  const eventEntries = assets.events.flatMap((event) => {
    const page = selectDefaultEventPage(event);
    return page === null || (page.graphic.characterName === "" && page.graphic.tileId === 0) ? [] : [{ event, page }];
  });
  const normalEntries = eventEntries.filter(({ page }) => !page.settings.alwaysOnTop);
  const topEntries = eventEntries.filter(({ page }) => page.settings.alwaysOnTop);
  const renderables: ({ readonly kind: "event"; readonly y: number; readonly entry: typeof normalEntries[number] }
    | { readonly kind: "player"; readonly y: number })[] = [
      ...normalEntries.map((entry) => ({ kind: "event" as const, y: entry.event.y, entry })),
      { kind: "player", y: avatar.y },
    ];
  const drawEvent = ({ event, page }: typeof normalEntries[number]): void => {
    const destinationX = event.x * 32 - cameraX;
    const destinationY = event.y * 32 - cameraY;
    if (page.graphic.tileId > 0) drawTile(context, assets, page.graphic.tileId, destinationX, destinationY, frame);
    else {
      const image = assets.characterImages.get(page.graphic.characterName);
      if (image !== undefined) drawCharacter(context, image, page.graphic.direction, page.graphic.pattern,
        page.graphic.opacity, event.x, event.y, cameraX, cameraY);
    }
  };
  renderables.sort((left, right) => left.y - right.y).forEach((renderable) => {
    if (renderable.kind === "event") drawEvent(renderable.entry);
    else drawCharacter(context, assets.playerImage, directionNumber(avatar.direction), playerPattern, 255,
      avatar.x, avatar.y, cameraX, cameraY);
  });
  topEntries.forEach(drawEvent);
}
