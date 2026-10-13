import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseCsvLine } from "../pbs/csv.js";

export interface RegionMapPoint {
  readonly x: number;
  readonly y: number;
  readonly name: string;
  readonly description: string;
  readonly destination: { readonly mapId: number; readonly x: number; readonly y: number } | null;
  readonly hiddenSwitchId: number | null;
}

export interface RegionMapDefinition {
  readonly id: number;
  readonly name: string;
  readonly filename: string;
  readonly points: readonly RegionMapPoint[];
}

function positiveInteger(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function nonNegativeInteger(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function parseRegionMaps(text: string, file = "PBS/townmap.txt"): readonly RegionMapDefinition[] {
  const regions: RegionMapDefinition[] = [];
  let current: { id: number; name: string; filename: string; points: RegionMapPoint[] } | null = null;
  const flush = (): void => {
    if (current === null) return;
    if (current.name === "" || current.filename === "") {
      throw new Error(`${file} : region ${current.id} sans nom ou image.`);
    }
    regions.push({ ...current });
  };
  for (const [index, rawLine] of text.replace(/^\uFEFF/u, "").split(/\r?\n/u).entries()) {
    const line = rawLine.trim();
    const section = /^\[(\d+)\]$/u.exec(line);
    if (section !== null) {
      flush();
      current = { id: Number(section[1]), name: "", filename: "", points: [] };
      continue;
    }
    if (current === null || line === "" || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    if (key === "Name" || key === "Filename") {
      const [value = ""] = parseCsvLine(rawValue, file, index + 1);
      if (key === "Name") current.name = value;
      else current.filename = value;
      continue;
    }
    if (key !== "Point") continue;
    const fields = parseCsvLine(rawValue, file, index + 1);
    const x = Number(fields[0]);
    const y = Number(fields[1]);
    if (!Number.isSafeInteger(x) || x < 0 || !Number.isSafeInteger(y) || y < 0) {
      throw new Error(`${file}:${index + 1} : coordonnees regionales invalides.`);
    }
    const destinationMapId = positiveInteger(fields[4]);
    const destinationX = nonNegativeInteger(fields[5]);
    const destinationY = nonNegativeInteger(fields[6]);
    const destination = destinationMapId !== null && destinationX !== null && destinationY !== null
      ? { mapId: destinationMapId, x: destinationX, y: destinationY } : null;
    current.points.push({ x, y, name: fields[2] ?? "", description: fields[3] ?? "", destination,
      hiddenSwitchId: positiveInteger(fields[7]) });
  }
  flush();
  return regions;
}

export async function extractRegionMaps(sourceDirectory: string): Promise<readonly RegionMapDefinition[]> {
  return parseRegionMaps(await readFile(path.join(sourceDirectory, "PBS", "townmap.txt"), "utf8"));
}
