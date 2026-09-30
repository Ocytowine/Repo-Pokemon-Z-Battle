import type { Direction, GridPoint } from "@pokemon-z-battle/overworld-engine";
import { moveImportedAvatar, selectEventPage, type ImportedEventPose, type ImportedMap,
  type ImportedMapEvent } from "./imported-map.js";
import { selectActiveEventPage, type SourceEventState } from "./source-event-state.js";
import { createSourceGridMotion, sampleSourceGridMotion, type SourceGridMotion } from "./source-grid-motion.js";
import type { SourceRouteActor } from "./source-move-route.js";

interface NpcRuntime {
  x: number;
  y: number;
  direction: Direction;
  motion: SourceGridMotion | null;
  nextMoveAt: number;
  randomState: number;
  walkingPattern: 1 | 3;
  characterName?: string;
  opacity?: number;
  pattern?: number;
  pageIndex: number | null;
}

const DIRECTIONS: readonly Direction[] = ["down", "left", "right", "up"];

function directionName(direction: number): Direction {
  if (direction === 4) return "left";
  if (direction === 6) return "right";
  if (direction === 8) return "up";
  return "down";
}

function directionNumber(direction: Direction): number {
  if (direction === "left") return 4;
  if (direction === "right") return 6;
  if (direction === "up") return 8;
  return 2;
}

function nextRandom(runtime: NpcRuntime): number {
  let value = runtime.randomState || 0x6d2b_79f5;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  runtime.randomState = value >>> 0;
  return runtime.randomState;
}

export function sourceNpcStepDuration(moveSpeed: number): number {
  return Math.max(80, Math.min(500, 250 * 2 ** (3 - moveSpeed)));
}

export function sourceNpcMoveDelay(moveFrequency: number): number {
  return [2_500, 1_800, 1_200, 700, 350, 150][Math.max(0, Math.min(5, moveFrequency))] ?? 1_200;
}

export class SourceNpcMotionController {
  private mapId: number | null = null;
  private readonly runtimes = new Map<number, NpcRuntime>();

  public reset(mapId: number, events: readonly ImportedMapEvent[], now: number): void {
    this.mapId = mapId;
    this.runtimes.clear();
    events.forEach((event) => this.runtimes.set(event.id, {
      x: event.x,
      y: event.y,
      direction: directionName(event.pages[0]?.graphic.direction ?? 2),
      motion: null,
      nextMoveAt: now + sourceNpcMoveDelay(event.pages[0]?.settings.moveFrequency ?? 3),
      randomState: (Math.imul(mapId, 0x9e37_79b1) ^ Math.imul(event.id, 0x85eb_ca6b)) >>> 0,
      walkingPattern: 1,
      pageIndex: null,
    }));
  }

  public update(now: number, map: ImportedMap, events: readonly ImportedMapEvent[], state: SourceEventState,
    player: GridPoint): void {
    if (this.mapId !== map.id) this.reset(map.id, events, now);
    for (const event of events) {
      const runtime = this.runtimes.get(event.id);
      const selection = selectActiveEventPage(event, map.id, state);
      const page = selection?.page ?? null;
      if (runtime === undefined || page === null || selection === null) continue;
      if (runtime.pageIndex !== selection.pageIndex) {
        runtime.pageIndex = selection.pageIndex;
        runtime.direction = directionName(page.graphic.direction);
        delete runtime.characterName;
        delete runtime.opacity;
        delete runtime.pattern;
      }
      if (runtime.motion !== null) {
        if (sampleSourceGridMotion(runtime.motion, now).complete) {
          runtime.motion = null;
          runtime.nextMoveAt = now + sourceNpcMoveDelay(page.settings.moveFrequency);
        }
        continue;
      }
      if (page.settings.moveType !== 1 || now < runtime.nextMoveAt) continue;
      const direction = DIRECTIONS[nextRandom(runtime) % DIRECTIONS.length] ?? "down";
      if (!page.settings.directionFix) runtime.direction = direction;
      const occupied = [{ ...player }, ...events.flatMap((candidate) => {
        if (candidate.id === event.id) return [];
        const otherPage = selectEventPage(candidate, map.id, state);
        const other = this.runtimes.get(candidate.id);
        return otherPage === null || otherPage.settings.through || other === undefined ? [] : [{ x: other.x, y: other.y }];
      })];
      const before = { x: runtime.x, y: runtime.y, direction: runtime.direction };
      const next = moveImportedAvatar(map, before, direction, page.settings.through ? [] : occupied);
      runtime.x = next.x;
      runtime.y = next.y;
      if (next.x !== before.x || next.y !== before.y) {
        runtime.motion = createSourceGridMotion(before, next, runtime.direction, now,
          { duration: sourceNpcStepDuration(page.settings.moveSpeed), walkingPattern: runtime.walkingPattern });
        runtime.walkingPattern = runtime.walkingPattern === 1 ? 3 : 1;
      } else runtime.nextMoveAt = now + sourceNpcMoveDelay(page.settings.moveFrequency);
    }
  }

  public logicalEvents(events: readonly ImportedMapEvent[]): readonly ImportedMapEvent[] {
    return events.map((event) => {
      const runtime = this.runtimes.get(event.id);
      return runtime === undefined ? event : { ...event, x: runtime.x, y: runtime.y };
    });
  }

  public scriptedActor(eventId: number, mapId: number, events: readonly ImportedMapEvent[], state: SourceEventState,
    now: number): SourceRouteActor | null {
    if (this.mapId !== mapId) this.reset(mapId, events, now);
    const event = events.find((candidate) => candidate.id === eventId);
    const selection = event === undefined ? null : selectActiveEventPage(event, mapId, state);
    const page = selection?.page ?? null;
    const runtime = this.runtimes.get(eventId);
    if (event === undefined || page === null || selection === null || runtime === undefined) return null;
    if (runtime.pageIndex !== selection.pageIndex) {
      runtime.pageIndex = selection.pageIndex;
      runtime.direction = directionName(page.graphic.direction);
      delete runtime.characterName;
      delete runtime.opacity;
      delete runtime.pattern;
    }
    return {
      x: runtime.x, y: runtime.y, direction: runtime.direction,
      moveSpeed: page.settings.moveSpeed, moveFrequency: page.settings.moveFrequency,
      walkAnimation: page.settings.walkAnimation, stepAnimation: page.settings.stepAnimation,
      directionFix: page.settings.directionFix, through: page.settings.through,
      alwaysOnTop: page.settings.alwaysOnTop, opacity: runtime.opacity ?? page.graphic.opacity,
      characterName: runtime.characterName ?? page.graphic.characterName, characterHue: 0,
      pattern: runtime.pattern ?? page.graphic.pattern,
    };
  }

  public applyScriptedActor(eventId: number, actor: SourceRouteActor, destination: GridPoint | null, now: number): number {
    const runtime = this.runtimes.get(eventId);
    if (runtime === undefined) return 0;
    const before = { x: runtime.x, y: runtime.y, direction: runtime.direction };
    runtime.direction = actor.direction;
    runtime.characterName = actor.characterName;
    runtime.opacity = actor.opacity;
    runtime.pattern = actor.pattern;
    if (destination === null) return 0;
    runtime.x = destination.x;
    runtime.y = destination.y;
    const duration = sourceNpcStepDuration(actor.moveSpeed);
    runtime.motion = createSourceGridMotion(before, destination, actor.direction, now,
      { duration, walkingPattern: runtime.walkingPattern });
    runtime.walkingPattern = runtime.walkingPattern === 1 ? 3 : 1;
    return duration;
  }

  public poses(now: number): ReadonlyMap<number, ImportedEventPose> {
    const result = new Map<number, ImportedEventPose>();
    for (const [eventId, runtime] of this.runtimes) {
      const sampled = runtime.motion === null ? null : sampleSourceGridMotion(runtime.motion, now);
      const pose: ImportedEventPose = {
        x: sampled?.x ?? runtime.x,
        y: sampled?.y ?? runtime.y,
        direction: directionNumber(runtime.direction),
        ...(runtime.pageIndex === null ? {} : { pageIndex: runtime.pageIndex }),
        ...(sampled === null ? runtime.pattern === undefined ? {} : { pattern: runtime.pattern }
          : { pattern: sampled.pattern }),
        ...(runtime.characterName === undefined ? {} : { characterName: runtime.characterName }),
        ...(runtime.opacity === undefined ? {} : { opacity: runtime.opacity }),
      };
      result.set(eventId, pose);
    }
    return result;
  }
}
