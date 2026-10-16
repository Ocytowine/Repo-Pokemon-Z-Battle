import type { GridPoint } from "@pokemon-z-battle/overworld-engine";
import type { SourceTruthEventSnapshot } from "@pokemon-z-battle/multiplayer-protocol";
import type { ImportedMapEvent } from "./imported-map.js";

export const SOURCE_TRUTH_LENS_ITEM = "LENSOFTRUTH";
export const SOURCE_TRUTH_LENS_DURATION_MS = 10_000;
export const SOURCE_TRUTH_LENS_RANGE = 3;

export interface SourceTruthEventTag {
  readonly mode: "hide" | "show";
  readonly opacity: number;
}

/** Pokemon Z encodes this mechanic in event names: `#EOT HIDE|SHOW [opacity]`. */
export function parseSourceTruthEventTag(name: string): SourceTruthEventTag | null {
  const match = /(?:^|\s)#EOT\s+(HIDE|SHOW)(?:\s+(\d{1,3}))?(?:\s|$)/iu.exec(name);
  if (match === null) return null;
  const mode = match[1]?.toLocaleLowerCase("en") as "hide" | "show";
  const fallback = mode === "hide" ? 0 : 255;
  const parsed = match[2] === undefined ? fallback : Number(match[2]);
  return { mode, opacity: Math.max(0, Math.min(255, parsed)) };
}

export function sourceTruthInRange(player: GridPoint, point: GridPoint): boolean {
  return Math.hypot(point.x - player.x, point.y - player.y) <= SOURCE_TRUTH_LENS_RANGE;
}

export function sourceTruthEventRevealed(event: Pick<ImportedMapEvent, "name" | "x" | "y">,
  player: GridPoint, active: boolean): boolean {
  const tag = parseSourceTruthEventTag(event.name);
  return tag !== null && active && sourceTruthInRange(player, event);
}

export function sourceTruthEventInteractive(event: Pick<ImportedMapEvent, "name" | "x" | "y">,
  player: GridPoint, active: boolean): boolean {
  const tag = parseSourceTruthEventTag(event.name);
  if (tag === null) return true;
  const revealed = active && sourceTruthInRange(player, event);
  return tag.mode === "show" ? revealed : !revealed;
}

export function sourceTruthEventOpacity(event: Pick<ImportedMapEvent, "name" | "x" | "y">,
  player: GridPoint, active: boolean, baseOpacity: number): number {
  const tag = parseSourceTruthEventTag(event.name);
  if (tag === null) return baseOpacity;
  const revealed = active && sourceTruthInRange(player, event);
  if (tag.mode === "hide") return revealed ? tag.opacity : baseOpacity;
  return revealed ? tag.opacity : 0;
}

export function sourceTruthEventSnapshots(events: readonly ImportedMapEvent[],
  footprint: (event: ImportedMapEvent) => readonly GridPoint[]): readonly SourceTruthEventSnapshot[] {
  return events.flatMap((event) => {
    const tag = parseSourceTruthEventTag(event.name);
    return tag === null ? [] : [{ eventId: event.id, mode: tag.mode, points: footprint(event) }];
  });
}
