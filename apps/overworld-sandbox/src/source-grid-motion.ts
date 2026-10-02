import type { Direction, GridPoint } from "@pokemon-z-battle/overworld-engine";
import type { SourceMovementAction } from "@pokemon-z-battle/multiplayer-protocol";

export interface SourceGridMotion {
  readonly from: GridPoint;
  readonly to: GridPoint;
  readonly direction: Direction;
  readonly startedAt: number;
  readonly duration: number;
  readonly walkingPattern: 1 | 3;
  readonly action: SourceMovementAction;
}

export interface SourceGridPose extends GridPoint {
  readonly direction: Direction;
  readonly pattern: number;
  readonly complete: boolean;
  readonly renderOffsetY: number;
}

export function createSourceGridMotion(from: GridPoint, to: GridPoint, direction: Direction,
  startedAt: number, options: { readonly duration?: number; readonly walkingPattern?: 1 | 3;
    readonly action?: SourceMovementAction } = {}): SourceGridMotion {
  const duration = options.duration ?? 125;
  const walkingPattern = options.walkingPattern ?? 1;
  if (!Number.isFinite(startedAt) || !Number.isFinite(duration) || duration <= 0 || (walkingPattern !== 1 && walkingPattern !== 3)) {
    throw new Error("Invalid source grid motion timing.");
  }
  return { from: { ...from }, to: { ...to }, direction, startedAt, duration, walkingPattern,
    action: options.action ?? "step" };
}

export function sampleSourceGridMotion(motion: SourceGridMotion, now: number): SourceGridPose {
  const progress = Math.max(0, Math.min(1, (now - motion.startedAt) / motion.duration));
  return {
    x: motion.from.x + (motion.to.x - motion.from.x) * progress,
    y: motion.from.y + (motion.to.y - motion.from.y) * progress,
    direction: motion.direction,
    pattern: progress >= 1 || progress < 0.5 ? 0 : motion.walkingPattern,
    complete: progress >= 1,
    renderOffsetY: progress >= 1 ? 0 : motion.action === "ledge-jump" || motion.action === "surf-transition"
      ? -Math.sin(progress * Math.PI) * 14 : 0,
  };
}
