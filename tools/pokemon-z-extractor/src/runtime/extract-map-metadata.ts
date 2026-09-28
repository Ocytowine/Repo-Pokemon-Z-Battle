import { readFile } from "node:fs/promises";
import path from "node:path";

export interface MapBattleMetadata {
  readonly mapId: number;
  readonly battleback: string | null;
  readonly wildBattleBgm: string | null;
  readonly wildVictoryMe: string | null;
}

export function parseMapBattleMetadata(text: string): readonly MapBattleMetadata[] {
  const records: MapBattleMetadata[] = [];
  let current: { mapId: number; values: Record<string, string> } | null = null;
  const flush = (): void => {
    if (current === null) return;
    records.push({ mapId: current.mapId, battleback: current.values.BattleBack ?? null,
      wildBattleBgm: current.values.WildBattleBGM ?? null, wildVictoryMe: current.values.WildVictoryME ?? null });
  };
  for (const rawLine of text.replace(/^\uFEFF/u, "").split(/\r?\n/u)) {
    const line = rawLine.trim();
    const section = /^\[(\d+)\]$/u.exec(line);
    if (section !== null) {
      flush();
      current = { mapId: Number(section[1]), values: {} };
      continue;
    }
    if (current === null || line === "" || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator > 0) current.values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  flush();
  return records;
}

export async function extractMapBattleMetadata(sourceDirectory: string): Promise<readonly MapBattleMetadata[]> {
  return parseMapBattleMetadata(await readFile(path.join(sourceDirectory, "PBS", "metadata.txt"), "utf8"));
}
