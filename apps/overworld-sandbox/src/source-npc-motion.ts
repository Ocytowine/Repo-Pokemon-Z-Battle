import type { Direction, GridPoint } from "@pokemon-z-battle/overworld-engine";
import { moveImportedAvatar, selectEventPage, type ImportedEventPose, type ImportedMap,
  type ImportedMapEvent } from "./imported-map.js";
import { selectActiveEventPage, type SourceEventState } from "./source-event-state.js";
import { createSourceGridMotion, sampleSourceGridMotion, type SourceGridMotion } from "./source-grid-motion.js";
import { executeSourceMoveRouteStep, type SourceRouteActor } from "./source-move-route.js";
import type { SourceSceneActorSnapshot } from "@pokemon-z-battle/multiplayer-protocol";

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
  routeIndex: number;
  noticeCooldownUntil: number;
}

export interface SourceNpcEventContact {
  readonly event: ImportedMapEvent;
  readonly page: NonNullable<ReturnType<typeof selectActiveEventPage>>["page"];
  readonly pageIndex: number;
}

const DIRECTIONS: readonly Direction[] = ["down", "left", "right", "up"];
const DIRECTION_DELTAS: Readonly<Record<Direction, GridPoint>> = {
  down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 },
};

export function sourceTrainerSightRange(eventName: string): number | null {
  const match = /^Trainer\((\d+)\)$/u.exec(eventName.trim());
  if (match === null) return null;
  const range = Number(match[1]);
  return Number.isSafeInteger(range) && range > 0 ? range : null;
}

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
      routeIndex: 0,
      noticeCooldownUntil: 0,
    }));
  }

  public update(now: number, map: ImportedMap, events: readonly ImportedMapEvent[], state: SourceEventState,
    player: GridPoint): SourceNpcEventContact | null {
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
        runtime.routeIndex = 0;
      }
      if (runtime.motion !== null) {
        if (sampleSourceGridMotion(runtime.motion, now).complete) {
          runtime.motion = null;
          runtime.nextMoveAt = now + sourceNpcMoveDelay(page.settings.moveFrequency);
        }
        continue;
      }
      const sightRange = page.settings.trigger === 2 ? sourceTrainerSightRange(event.name) : null;
      if (sightRange !== null && now >= runtime.noticeCooldownUntil
        && this.trainerSeesPlayer(runtime, event, sightRange, player, map, events, state)) {
        runtime.noticeCooldownUntil = now + 1_000;
        return { event, page, pageIndex: selection.pageIndex };
      }
      if ((page.settings.moveType !== 1 && page.settings.moveType !== 3) || now < runtime.nextMoveAt) continue;
      const actor = this.runtimeActor(runtime, page);
      const route = page.settings.moveType === 3 ? page.settings.moveRoute ?? null : null;
      const step = route?.steps[runtime.routeIndex] ?? null;
      const result = step === null ? null : executeSourceMoveRouteStep(actor, step,
        { player, randomDirection: DIRECTIONS[nextRandom(runtime) % DIRECTIONS.length] ?? "down" });
      if (route !== null && result !== null) {
        runtime.direction = result.actor.direction;
        runtime.characterName = result.actor.characterName;
        runtime.opacity = result.actor.opacity;
        runtime.pattern = result.actor.pattern;
        runtime.routeIndex = result.complete ? route.repeat ? 0 : route.steps.length
          : Math.min(runtime.routeIndex + 1, route.steps.length);
        if (!result.supported) {
          runtime.nextMoveAt = now + sourceNpcMoveDelay(page.settings.moveFrequency);
          continue;
        }
        if (result.waitMs > 0 || result.destination === null) {
          runtime.nextMoveAt = now + Math.max(result.waitMs, result.complete ? sourceNpcMoveDelay(page.settings.moveFrequency) : 0);
          continue;
        }
      }
      if (route !== null && (result === null || result.destination === null)) continue;
      const direction = result === null
        ? DIRECTIONS[nextRandom(runtime) % DIRECTIONS.length] ?? "down"
        : this.directionTo(actor, result.destination!);
      if (direction === null) {
        runtime.nextMoveAt = now + sourceNpcMoveDelay(page.settings.moveFrequency);
        continue;
      }
      if (!page.settings.directionFix) runtime.direction = direction;
      const destination = { x: runtime.x + (direction === "left" ? -1 : direction === "right" ? 1 : 0),
        y: runtime.y + (direction === "up" ? -1 : direction === "down" ? 1 : 0) };
      if (page.settings.trigger === 2 && destination.x === player.x && destination.y === player.y) {
        runtime.nextMoveAt = now + sourceNpcMoveDelay(page.settings.moveFrequency);
        return { event, page, pageIndex: selection.pageIndex };
      }
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
    return null;
  }

  private runtimeActor(runtime: NpcRuntime, page: NonNullable<ReturnType<typeof selectActiveEventPage>>["page"]): SourceRouteActor {
    return { x: runtime.x, y: runtime.y, direction: runtime.direction,
      moveSpeed: page.settings.moveSpeed, moveFrequency: page.settings.moveFrequency,
      walkAnimation: page.settings.walkAnimation, stepAnimation: page.settings.stepAnimation,
      directionFix: page.settings.directionFix, through: page.settings.through,
      alwaysOnTop: page.settings.alwaysOnTop, opacity: runtime.opacity ?? page.graphic.opacity,
      characterName: runtime.characterName ?? page.graphic.characterName, characterHue: 0,
      pattern: runtime.pattern ?? page.graphic.pattern };
  }

  private directionTo(actor: GridPoint, destination: GridPoint): Direction | null {
    if (destination.x === actor.x - 1 && destination.y === actor.y) return "left";
    if (destination.x === actor.x + 1 && destination.y === actor.y) return "right";
    if (destination.x === actor.x && destination.y === actor.y - 1) return "up";
    if (destination.x === actor.x && destination.y === actor.y + 1) return "down";
    return null;
  }

  private trainerSeesPlayer(runtime: NpcRuntime, event: ImportedMapEvent, range: number, player: GridPoint,
    map: ImportedMap, events: readonly ImportedMapEvent[], state: SourceEventState): boolean {
    const delta = DIRECTION_DELTAS[runtime.direction];
    const offsetX = player.x - runtime.x;
    const offsetY = player.y - runtime.y;
    const distance = delta.x === 0 ? offsetY * delta.y : offsetX * delta.x;
    if (distance < 1 || distance > range || delta.x === 0 && offsetX !== 0 || delta.y === 0 && offsetY !== 0) {
      return false;
    }
    const occupied = events.flatMap((candidate) => {
      if (candidate.id === event.id) return [];
      const page = selectEventPage(candidate, map.id, state);
      const other = this.runtimes.get(candidate.id);
      return page === null || page.settings.through || other === undefined ? [] : [{ x: other.x, y: other.y }];
    });
    let probe = { x: runtime.x, y: runtime.y, direction: runtime.direction };
    for (let step = 0; step < distance; step += 1) {
      const next = moveImportedAvatar(map, probe, runtime.direction, occupied);
      if (next.x === probe.x && next.y === probe.y) return false;
      probe = next;
    }
    return probe.x === player.x && probe.y === player.y;
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

  public applyNetworkActors(actors: readonly SourceSceneActorSnapshot[], now: number): void {
    for (const actor of actors) {
      const runtime = this.runtimes.get(actor.eventId);
      if (runtime === undefined) continue;
      const before = { x: runtime.x, y: runtime.y, direction: runtime.direction };
      const moved = before.x !== actor.x || before.y !== actor.y;
      runtime.x = actor.x;
      runtime.y = actor.y;
      runtime.direction = actor.direction;
      if (actor.characterName === undefined) delete runtime.characterName;
      else runtime.characterName = actor.characterName;
      if (actor.opacity === undefined) delete runtime.opacity;
      else runtime.opacity = actor.opacity;
      if (actor.pattern === undefined) delete runtime.pattern;
      else runtime.pattern = actor.pattern;
      runtime.motion = moved ? createSourceGridMotion(before, actor, actor.direction, now,
        { duration: sourceNpcStepDuration(3), walkingPattern: runtime.walkingPattern }) : null;
      if (moved) runtime.walkingPattern = runtime.walkingPattern === 1 ? 3 : 1;
    }
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
