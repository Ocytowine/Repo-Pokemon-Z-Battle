import { readFile } from "node:fs/promises";
import path from "node:path";
import { readRubyMarshal } from "../ruby-marshal/reader.js";
import { rubyText } from "../ruby-marshal/values.js";

export interface MapInfoEntry {
  readonly id: number;
  readonly name: string;
  readonly parentId: number;
  readonly order: number;
  readonly expanded: boolean;
  readonly scrollX: number;
  readonly scrollY: number;
}

export async function extractMapInfos(sourceDirectory: string): Promise<readonly MapInfoEntry[]> {
  const value = readRubyMarshal(await readFile(path.join(sourceDirectory, "Data", "MapInfos.rxdata")));
  if (typeof value !== "object" || value === null || Array.isArray(value) || value.kind !== "hash") {
    throw new TypeError("Data/MapInfos.rxdata ne contient pas un Hash Ruby.");
  }
  const entries = value.entries.map(([key, mapInfo]): MapInfoEntry => {
    if (typeof key !== "number" || typeof mapInfo !== "object" || mapInfo === null
      || Array.isArray(mapInfo) || mapInfo.kind !== "object" || mapInfo.className !== "RPG::MapInfo") {
      throw new TypeError("Entree RPG::MapInfo invalide.");
    }
    const number = (name: string): number => {
      const entry = mapInfo.ivars[name];
      if (typeof entry !== "number") throw new TypeError(`${name} invalide pour la carte ${key}.`);
      return entry;
    };
    const name = rubyText(mapInfo.ivars["@name"] ?? null);
    if (name === null) throw new TypeError(`Nom absent pour la carte ${key}.`);
    return {
      id: key,
      name,
      parentId: number("@parent_id"),
      order: number("@order"),
      expanded: mapInfo.ivars["@expanded"] === true,
      scrollX: number("@scroll_x"),
      scrollY: number("@scroll_y"),
    };
  });
  return entries.sort((left, right) => left.id - right.id);
}
