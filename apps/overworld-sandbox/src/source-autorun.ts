import type { GridPoint } from "@pokemon-z-battle/overworld-engine";
import type { ImportedEventPage, ImportedMapEvent, ImportedTransfer } from "./imported-map.js";
import { selectActiveEventPage, type SourceEventState } from "./source-event-state.js";

export interface ActiveSourceAutorun {
  readonly event: ImportedMapEvent;
  readonly page: ImportedEventPage;
  readonly pageIndex: number;
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
      targetMapId: targetMapId as number, targetX: targetX as number, targetY: targetY as number, direction: direction as number };
  }
  return null;
}
