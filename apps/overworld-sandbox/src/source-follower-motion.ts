import type { Direction, GridPoint } from "@pokemon-z-battle/overworld-engine";
import { moveImportedAvatar, type ImportedAvatar, type ImportedMap } from "./imported-map.js";
import { createSourceGridMotion, sampleSourceGridMotion, type SourceGridMotion, type SourceGridPose }
  from "./source-grid-motion.js";

const OPPOSITE: Readonly<Record<Direction, Direction>> = {
  down: "up", left: "right", right: "left", up: "down",
};
const LEFT: Readonly<Record<Direction, Direction>> = {
  down: "right", right: "up", up: "left", left: "down",
};
const RIGHT: Readonly<Record<Direction, Direction>> = {
  down: "left", left: "up", up: "right", right: "down",
};

function directionBetween(from: GridPoint, to: GridPoint, fallback: Direction): Direction {
  if (to.x < from.x) return "left";
  if (to.x > from.x) return "right";
  if (to.y < from.y) return "up";
  if (to.y > from.y) return "down";
  return fallback;
}

function manhattan(from: GridPoint, to: GridPoint): number {
  return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
}

export class SourceFollowerMotionController {
  private mapId: number | null = null;
  private position: ImportedAvatar | null = null;
  private motion: SourceGridMotion | null = null;
  private walkingPattern: 1 | 3 = 1;

  public synchronize(enabled: boolean, map: ImportedMap, player: ImportedAvatar): void {
    if (!enabled) { this.clear(); return; }
    if (this.mapId !== map.id || this.position === null) this.reset(map, player);
  }

  public reset(map: ImportedMap, player: ImportedAvatar): void {
    this.mapId = map.id;
    this.motion = null;
    this.walkingPattern = 1;
    const directions = [OPPOSITE[player.direction], LEFT[player.direction], RIGHT[player.direction], player.direction];
    this.position = null;
    for (const direction of directions) {
      const candidate = moveImportedAvatar(map, { ...player, direction }, direction);
      if (candidate.x === player.x && candidate.y === player.y) continue;
      this.position = { ...candidate, direction: player.direction };
      break;
    }
  }

  public followPlayerStep(from: ImportedAvatar, to: ImportedAvatar, startedAt: number, duration = 125): void {
    if (from.x === to.x && from.y === to.y) return;
    if (this.position === null) {
      this.position = { ...from };
      this.motion = null;
      return;
    }
    const direction = directionBetween(this.position, from, this.position.direction);
    const before = this.position;
    this.position = { ...from, direction };
    if (manhattan(before, from) !== 1) {
      this.motion = null;
      return;
    }
    this.motion = createSourceGridMotion(before, from, direction, startedAt,
      { duration, walkingPattern: this.walkingPattern });
    this.walkingPattern = this.walkingPattern === 1 ? 3 : 1;
  }

  public pose(now: number): SourceGridPose | null {
    if (this.position === null) return null;
    if (this.motion === null) return { ...this.position, pattern: 0, complete: true };
    const sampled = sampleSourceGridMotion(this.motion, now);
    if (sampled.complete) this.motion = null;
    return sampled;
  }

  public clear(): void {
    this.mapId = null;
    this.position = null;
    this.motion = null;
  }
}
