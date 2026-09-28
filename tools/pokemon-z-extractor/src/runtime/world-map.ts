import type { RpgTable, RubyHash, RubyMarshalValue, RubyObject, RubyUserDefined } from "../ruby-marshal/types.js";
import { decodeRpgTable } from "../ruby-marshal/table.js";
import { rubyText } from "../ruby-marshal/values.js";

export const DIRECTION_BITS = { down: 1, left: 2, right: 4, up: 8 } as const;

export interface NormalizedTileset {
  readonly id: number;
  readonly name: string;
  readonly tilesetName: string;
  readonly autotileNames: readonly string[];
  readonly battlebackName: string;
  readonly passages: readonly number[];
  readonly priorities: readonly number[];
  readonly terrainTags: readonly number[];
}

export interface SimpleMapTransfer {
  readonly eventId: number;
  readonly eventName: string;
  readonly eventX: number;
  readonly eventY: number;
  readonly pageIndex: number;
  readonly commandIndex: number;
  readonly targetMapId: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly direction: number;
  readonly fade: number;
}

export interface NormalizedWorldMap {
  readonly schemaVersion: "1.0.0";
  readonly id: number;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly tilesetId: number;
  readonly layers: {
    readonly lower: readonly number[];
    readonly middle: readonly number[];
    readonly upper: readonly number[];
  };
  readonly collision: {
    readonly encoding: "allowed-direction-mask-v1";
    readonly scope: "base-tiles-only";
    readonly directionBits: typeof DIRECTION_BITS;
    readonly masks: readonly number[];
    readonly fullyBlockedCells: number;
  };
  readonly transfers: readonly SimpleMapTransfer[];
  readonly source: { readonly file: string; readonly sha256: string };
}

function objectOfClass(value: RubyMarshalValue, className: string, context: string): RubyObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || value.kind !== "object" || value.className !== className) {
    throw new TypeError(`${context} doit etre un objet ${className}.`);
  }
  return value;
}

function numberIvar(value: RubyObject, name: string, context: string): number {
  const result = value.ivars[name];
  if (typeof result !== "number") throw new TypeError(`${context}.${name} doit etre un nombre.`);
  return result;
}

function textIvar(value: RubyObject, name: string): string {
  return rubyText(value.ivars[name] ?? null) ?? "";
}

function tableIvar(value: RubyObject, name: string, context: string): RpgTable {
  const table = value.ivars[name];
  if (typeof table !== "object" || table === null || Array.isArray(table)
    || table.kind !== "user-defined" || table.className !== "Table") {
    throw new TypeError(`${context}.${name} doit etre une Table.`);
  }
  return decodeRpgTable(table as RubyUserDefined);
}

export function normalizeTilesets(value: RubyMarshalValue): readonly NormalizedTileset[] {
  if (!Array.isArray(value)) throw new TypeError("Tilesets.rxdata doit contenir un Array Ruby.");
  return value.flatMap((entry, index): readonly NormalizedTileset[] => {
    if (entry === null) return [];
    const tileset = objectOfClass(entry, "RPG::Tileset", `tileset ${index}`);
    const id = numberIvar(tileset, "@id", `tileset ${index}`);
    const autotiles = tileset.ivars["@autotile_names"];
    if (!Array.isArray(autotiles)) throw new TypeError(`tileset ${id}.@autotile_names doit etre un tableau.`);
    return [{
      id,
      name: textIvar(tileset, "@name"),
      tilesetName: textIvar(tileset, "@tileset_name"),
      autotileNames: autotiles.map((name) => rubyText(name) ?? ""),
      battlebackName: textIvar(tileset, "@battleback_name"),
      passages: tableIvar(tileset, "@passages", `tileset ${id}`).values,
      priorities: tableIvar(tileset, "@priorities", `tileset ${id}`).values,
      terrainTags: tableIvar(tileset, "@terrain_tags", `tileset ${id}`).values,
    }];
  });
}

export function tileAllowsDirection(
  tileIdsTopToBottom: readonly number[],
  passages: readonly number[],
  priorities: readonly number[],
  directionBit: number,
): boolean {
  for (const tileId of tileIdsTopToBottom) {
    const flags = passages[tileId] ?? 0;
    if ((flags & directionBit) !== 0 || (flags & 0x0f) === 0x0f) return false;
    if ((priorities[tileId] ?? 0) === 0) return true;
  }
  return true;
}

export function buildCollisionMasks(
  table: RpgTable,
  passages: readonly number[],
  priorities: readonly number[],
): readonly number[] {
  const planeSize = table.xSize * table.ySize;
  if (table.zSize < 3 || table.values.length < planeSize * 3) {
    throw new TypeError("La carte doit fournir au moins trois couches completes.");
  }
  return Array.from({ length: planeSize }, (_, cell) => {
    const tileIds = [table.values[cell + planeSize * 2]!, table.values[cell + planeSize]!, table.values[cell]!];
    return Object.values(DIRECTION_BITS).reduce(
      (mask, direction) => mask | (tileAllowsDirection(tileIds, passages, priorities, direction) ? direction : 0),
      0,
    );
  });
}

export function extractSimpleTransfers(eventsValue: RubyMarshalValue): readonly SimpleMapTransfer[] {
  if (typeof eventsValue !== "object" || eventsValue === null || Array.isArray(eventsValue)
    || eventsValue.kind !== "hash") throw new TypeError("RPG::Map.@events doit etre un Hash Ruby.");
  const events = eventsValue as RubyHash;
  const transfers: SimpleMapTransfer[] = [];
  for (const [eventKey, eventValue] of events.entries) {
    const event = objectOfClass(eventValue, "RPG::Event", "evenement");
    const eventId = typeof eventKey === "number" ? eventKey : numberIvar(event, "@id", "evenement");
    const pages = event.ivars["@pages"];
    if (!Array.isArray(pages)) throw new TypeError(`evenement ${eventId}.@pages doit etre un tableau.`);
    pages.forEach((pageValue, pageIndex) => {
      const page = objectOfClass(pageValue, "RPG::Event::Page", `evenement ${eventId}, page ${pageIndex}`);
      const commands = page.ivars["@list"];
      if (!Array.isArray(commands)) return;
      commands.forEach((commandValue, commandIndex) => {
        const command = objectOfClass(commandValue, "RPG::EventCommand", `evenement ${eventId}, commande ${commandIndex}`);
        if (numberIvar(command, "@code", `evenement ${eventId}, commande ${commandIndex}`) !== 201) return;
        const parameters = command.ivars["@parameters"];
        if (!Array.isArray(parameters) || parameters.length < 6 || parameters.some((parameter) => typeof parameter !== "number")) return;
        const [mode, targetMapId, targetX, targetY, direction, fade] = parameters as number[];
        if (mode !== 0) return;
        transfers.push({
          eventId,
          eventName: textIvar(event, "@name"),
          eventX: numberIvar(event, "@x", `evenement ${eventId}`),
          eventY: numberIvar(event, "@y", `evenement ${eventId}`),
          pageIndex,
          commandIndex,
          targetMapId: targetMapId!,
          targetX: targetX!,
          targetY: targetY!,
          direction: direction!,
          fade: fade!,
        });
      });
    });
  }
  return transfers;
}

export function normalizeWorldMap(
  mapId: number,
  mapName: string,
  value: RubyMarshalValue,
  tileset: NormalizedTileset,
  source: { readonly file: string; readonly sha256: string },
): NormalizedWorldMap {
  const map = objectOfClass(value, "RPG::Map", source.file);
  const width = numberIvar(map, "@width", source.file);
  const height = numberIvar(map, "@height", source.file);
  const tilesetId = numberIvar(map, "@tileset_id", source.file);
  if (tilesetId !== tileset.id) throw new TypeError(`${source.file}: tileset ${tilesetId} inattendu.`);
  const table = tableIvar(map, "@data", source.file);
  if (table.xSize !== width || table.ySize !== height) throw new TypeError(`${source.file}: dimensions Table incoherentes.`);
  const planeSize = width * height;
  const masks = buildCollisionMasks(table, tileset.passages, tileset.priorities);
  return {
    schemaVersion: "1.0.0",
    id: mapId,
    name: mapName,
    width,
    height,
    tilesetId,
    layers: {
      lower: table.values.slice(0, planeSize),
      middle: table.values.slice(planeSize, planeSize * 2),
      upper: table.values.slice(planeSize * 2, planeSize * 3),
    },
    collision: {
      encoding: "allowed-direction-mask-v1",
      scope: "base-tiles-only",
      directionBits: DIRECTION_BITS,
      masks,
      fullyBlockedCells: masks.filter((mask) => mask === 0).length,
    },
    transfers: extractSimpleTransfers(map.ivars["@events"] ?? null),
    source,
  };
}

function pathForCells(cells: readonly number[], width: number): string {
  return cells.map((cell) => `M${cell % width} ${Math.floor(cell / width)}h1v1h-1z`).join("");
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function renderMapPreview(map: NormalizedWorldMap): string {
  const buckets = Array.from({ length: 12 }, (): number[] => []);
  for (let cell = 0; cell < map.width * map.height; cell += 1) {
    const tile = map.layers.upper[cell] || map.layers.middle[cell] || map.layers.lower[cell] || 0;
    buckets[tile % buckets.length]!.push(cell);
  }
  const blocked = map.collision.masks.flatMap((mask, cell) => mask === 0 ? [cell] : []);
  const palette = ["#23364d", "#274d46", "#3a5a40", "#4f5d2f", "#675d3b", "#76544c", "#634f66", "#435b73", "#536878", "#536b4f", "#69613f", "#594a58"];
  const terrain = buckets.map((cells, index) => `<path fill="${palette[index]}" d="${pathForCells(cells, map.width)}"/>`).join("");
  const transfers = map.transfers.map((transfer) => `<rect x="${transfer.eventX + 0.15}" y="${transfer.eventY + 0.15}" width="0.7" height="0.7" fill="#ffb000"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${map.width} ${map.height}" shape-rendering="crispEdges" role="img" aria-label="${escapeXml(map.name)}">${terrain}<path fill="#10151c" fill-opacity="0.78" d="${pathForCells(blocked, map.width)}"/>${transfers}</svg>\n`;
}
