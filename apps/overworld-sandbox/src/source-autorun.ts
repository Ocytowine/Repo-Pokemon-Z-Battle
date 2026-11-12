import type { GridPoint } from "@pokemon-z-battle/overworld-engine";
import type { ImportedEventPage, ImportedMapEvent, ImportedTransfer } from "./imported-map.js";
import { selectActiveEventPage, type SourceEventState } from "./source-event-state.js";

export interface ActiveSourceAutorun {
  readonly event: ImportedMapEvent;
  readonly page: ImportedEventPage;
  readonly pageIndex: number;
}

export interface SourceMapEntryResumeResult {
  readonly pendingMapId: number | null;
  readonly started: boolean;
}

/** Keep an entry request while the foreground is busy; consume it only after an attempt. */
export function resumeSourceMapEntryAutorun(pendingMapId: number | null, currentMapId: number,
  ready: boolean, select: () => ActiveSourceAutorun | null,
  start: (autorun: ActiveSourceAutorun) => boolean): SourceMapEntryResumeResult {
  if (pendingMapId !== currentMapId || !ready) return { pendingMapId, started: false };
  const autorun = select();
  return { pendingMapId: null, started: autorun !== null && start(autorun) };
}

export function findSourceMapEntryAutorun(events: readonly ImportedMapEvent[], mapId: number,
  state: SourceEventState): ActiveSourceAutorun | null {
  for (const event of [...events].sort((left, right) => left.id - right.id)) {
    const active = selectActiveEventPage(event, mapId, state);
    if (active?.page.settings.trigger === 3) return { event, ...active };
  }
  return null;
}

export function findActiveSourceParallelEvents(events: readonly ImportedMapEvent[], mapId: number,
  state: SourceEventState): readonly ActiveSourceAutorun[] {
  return [...events]
    .sort((left, right) => left.id - right.id)
    .flatMap((event) => {
      const active = selectActiveEventPage(event, mapId, state);
      return active?.page.settings.trigger === 4 ? [{ event, ...active }] : [];
    });
}

/** Ambient one-shot autoruns are safe to reconstruct locally for a Coop guest. */
export function sourceMapEntryAmbientVisuals(events: readonly ImportedMapEvent[], mapId: number,
  state: SourceEventState): readonly ImportedEventPage["commands"][number][] {
  const ambientKinds = new Set(["change-map-settings", "weather", "screen-tone", "screen-flash",
    "erase-picture", "erase-event", "end"]);
  return events.flatMap((event) => {
    const active = selectActiveEventPage(event, mapId, state)?.page;
    if (active?.settings.trigger !== 3 || !active.commands.some((command) => command.kind === "erase-event")
      || !active.commands.every((command) => ambientKinds.has(command.kind))) return [];
    return active.commands.filter((command) => command.kind === "change-map-settings");
  });
}

export function findNewlyActivatedSourceAutorun(events: readonly ImportedMapEvent[], mapId: number,
  previousState: SourceEventState, nextState: SourceEventState): ActiveSourceAutorun | null {
  for (const event of events) {
    const previous = selectActiveEventPage(event, mapId, previousState);
    const next = selectActiveEventPage(event, mapId, nextState);
    if (next?.page.settings.trigger !== 3) continue;
    if (previous?.page.settings.trigger === 3 && previous.pageIndex === next.pageIndex) continue;
    return { event, ...next };
  }
  return null;
}

export function finalDirectSourceTransfer(commands: ImportedEventPage["commands"], eventId: number,
  pageIndex: number, origin: GridPoint): ImportedTransfer | null {
  for (let index = commands.length - 1; index >= 0; index -= 1) {
    const command = commands[index];
    if (command?.kind !== "transfer-player" || command.data.addressing !== "direct") continue;
    const targetMapId = command.data.map;
    const targetX = command.data.x;
    const targetY = command.data.y;
    const direction = command.data.direction;
    if (!Number.isInteger(targetMapId) || !Number.isInteger(targetX) || !Number.isInteger(targetY) || !Number.isInteger(direction)) return null;
    return { eventId, pageIndex, eventX: origin.x, eventY: origin.y,
      targetMapId: targetMapId as number, targetX: targetX as number, targetY: targetY as number,
      direction: direction as number,
      ...(typeof command.data.fade === "number" ? { fade: command.data.fade } : {}) };
  }
  return null;
}
