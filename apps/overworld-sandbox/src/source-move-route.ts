import type { Direction, GridPoint } from "@pokemon-z-battle/overworld-engine";

export interface SourceMoveRouteStep {
  readonly kind: string;
  readonly parameters: readonly unknown[];
}

export interface SourceMoveRoute {
  readonly repeat: boolean;
  readonly skippable: boolean;
  readonly steps: readonly SourceMoveRouteStep[];
}

export interface SourceRouteActor extends GridPoint {
  readonly direction: Direction;
  readonly moveSpeed: number;
  readonly moveFrequency: number;
  readonly walkAnimation: boolean;
  readonly stepAnimation: boolean;
  readonly directionFix: boolean;
  readonly through: boolean;
  readonly alwaysOnTop: boolean;
  readonly opacity: number;
  readonly characterName: string;
  readonly characterHue: number;
  readonly pattern: number;
}

export interface SourceRouteStepContext {
  readonly player: GridPoint;
  readonly randomDirection?: Direction;
}

export interface SourceRouteStepResult {
  readonly actor: SourceRouteActor;
  readonly destination: GridPoint | null;
  readonly waitMs: number;
  readonly complete: boolean;
  readonly switchChange: { readonly id: number; readonly value: boolean } | null;
  readonly sound: { readonly name: string; readonly volume: number; readonly pitch: number } | null;
  readonly supported: boolean;
  readonly reason: string | null;
}

const DELTAS: Readonly<Record<Direction, GridPoint>> = {
  down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 },
};
const RIGHT_TURN: Readonly<Record<Direction, Direction>> = { down: "left", left: "up", up: "right", right: "down" };
const LEFT_TURN: Readonly<Record<Direction, Direction>> = { down: "right", right: "up", up: "left", left: "down" };
const OPPOSITE: Readonly<Record<Direction, Direction>> = { down: "up", up: "down", left: "right", right: "left" };

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(value: unknown): value is number {
  return Number.isInteger(value);
}

function directionNumber(value: unknown): Direction | null {
  if (value === 2) return "down";
  if (value === 4) return "left";
  if (value === 6) return "right";
  if (value === 8) return "up";
  return null;
}

export function parseSourceMoveRoute(value: unknown): SourceMoveRoute | null {
  if (!record(value) || typeof value.repeat !== "boolean" || typeof value.skippable !== "boolean" || !Array.isArray(value.steps)) return null;
  const steps: SourceMoveRouteStep[] = [];
  for (const step of value.steps) {
    if (!record(step) || typeof step.kind !== "string" || !Array.isArray(step.parameters)) return null;
    steps.push({ kind: step.kind, parameters: [...step.parameters] });
  }
  return { repeat: value.repeat, skippable: value.skippable, steps };
}

function toward(actor: SourceRouteActor, player: GridPoint, away: boolean): Direction {
  const horizontal = player.x - actor.x;
  const vertical = player.y - actor.y;
  const direction = Math.abs(horizontal) > Math.abs(vertical)
    ? horizontal < 0 ? "left" : "right"
    : vertical < 0 ? "up" : "down";
  return away ? OPPOSITE[direction] : direction;
}

function movement(actor: SourceRouteActor, direction: Direction, preserveDirection = false): SourceRouteStepResult {
  const delta = DELTAS[direction];
  return success(preserveDirection || actor.directionFix ? actor : { ...actor, direction },
    { x: actor.x + delta.x, y: actor.y + delta.y });
}

function success(actor: SourceRouteActor, destination: GridPoint | null = null, waitMs = 0,
  extra: Partial<Pick<SourceRouteStepResult, "complete" | "switchChange" | "sound">> = {}): SourceRouteStepResult {
  return { actor, destination, waitMs, complete: extra.complete ?? false, switchChange: extra.switchChange ?? null,
    sound: extra.sound ?? null, supported: true, reason: null };
}

function unsupported(actor: SourceRouteActor, kind: string): SourceRouteStepResult {
  return { actor, destination: null, waitMs: 0, complete: false, switchChange: null,
    sound: null, supported: false, reason: `mouvement ${kind} non pris en charge` };
}

export function executeSourceMoveRouteStep(actor: SourceRouteActor, step: SourceMoveRouteStep,
  context: SourceRouteStepContext): SourceRouteStepResult {
  const direct: Readonly<Record<string, Direction>> = {
    "step-down": "down", "step-left": "left", "step-right": "right", "step-up": "up",
  };
  const diagonal: Readonly<Record<string, GridPoint>> = {
    "step-lower-left": { x: -1, y: 1 }, "step-lower-right": { x: 1, y: 1 },
    "step-upper-left": { x: -1, y: -1 }, "step-upper-right": { x: 1, y: -1 },
  };
  const faces: Readonly<Record<string, Direction>> = {
    "face-down": "down", "face-left": "left", "face-right": "right", "face-up": "up",
  };
  const direction = direct[step.kind];
  if (direction !== undefined) return movement(actor, direction);
  const diagonalDelta = diagonal[step.kind];
  if (diagonalDelta !== undefined) return success(actor, { x: actor.x + diagonalDelta.x, y: actor.y + diagonalDelta.y });
  if (step.kind === "step-forward") return movement(actor, actor.direction, true);
  if (step.kind === "step-backward") return movement(actor, OPPOSITE[actor.direction], true);
  if (step.kind === "step-random") return movement(actor, context.randomDirection ?? "down");
  if (step.kind === "step-toward-player") return movement(actor, toward(actor, context.player, false));
  if (step.kind === "step-away-from-player") return movement(actor, toward(actor, context.player, true));
  if (step.kind === "jump") {
    const [x, y] = step.parameters;
    return integer(x) && integer(y) ? success(actor, { x: actor.x + x, y: actor.y + y }) : unsupported(actor, step.kind);
  }
  if (step.kind === "wait") {
    const [frames] = step.parameters;
    return integer(frames) && frames >= 0 ? success(actor, null, frames * 25) : unsupported(actor, step.kind);
  }
  const face = faces[step.kind];
  if (face !== undefined) return success(actor.directionFix ? actor : { ...actor, direction: face });
  if (step.kind === "turn-right") return success(actor.directionFix ? actor : { ...actor, direction: RIGHT_TURN[actor.direction] });
  if (step.kind === "turn-left") return success(actor.directionFix ? actor : { ...actor, direction: LEFT_TURN[actor.direction] });
  if (step.kind === "turn-around") return success(actor.directionFix ? actor : { ...actor, direction: OPPOSITE[actor.direction] });
  if (step.kind === "turn-random") return success(actor.directionFix ? actor : { ...actor, direction: context.randomDirection ?? "down" });
  if (step.kind === "face-player" || step.kind === "face-away-from-player") {
    const next = toward(actor, context.player, step.kind === "face-away-from-player");
    return success(actor.directionFix ? actor : { ...actor, direction: next });
  }
  if (step.kind === "change-speed" || step.kind === "change-frequency") {
    const [value] = step.parameters;
    if (!integer(value)) return unsupported(actor, step.kind);
    return success(step.kind === "change-speed" ? { ...actor, moveSpeed: value } : { ...actor, moveFrequency: value });
  }
  if (["walk-animation-on", "walk-animation-off", "step-animation-on", "step-animation-off", "direction-fix-on",
    "direction-fix-off", "through-on", "through-off", "always-on-top-on", "always-on-top-off"].includes(step.kind)) {
    const [property, value] = step.kind.split("-").at(-1) === "on"
      ? [step.kind.replace(/-(?:on|off)$/u, ""), true] : [step.kind.replace(/-(?:on|off)$/u, ""), false];
    const keys = { "walk-animation": "walkAnimation", "step-animation": "stepAnimation", "direction-fix": "directionFix",
      through: "through", "always-on-top": "alwaysOnTop" } as const;
    const key = keys[property as keyof typeof keys];
    return key === undefined ? unsupported(actor, step.kind) : success({ ...actor, [key]: value });
  }
  if (step.kind === "change-graphic") {
    const [characterName, characterHue, rawDirection, pattern] = step.parameters;
    const nextDirection = directionNumber(rawDirection);
    return typeof characterName === "string" && integer(characterHue) && nextDirection !== null && integer(pattern)
      ? success({ ...actor, characterName, characterHue, direction: nextDirection, pattern }) : unsupported(actor, step.kind);
  }
  if (step.kind === "change-opacity") {
    const [opacity] = step.parameters;
    return integer(opacity) && opacity >= 0 && opacity <= 255 ? success({ ...actor, opacity }) : unsupported(actor, step.kind);
  }
  if (step.kind === "play-sound") {
    const [rawAudio] = step.parameters;
    const ivars = record(rawAudio) && record(rawAudio.ivars) ? rawAudio.ivars : null;
    const name = ivars?.["@name"];
    const volume = ivars?.["@volume"];
    const pitch = ivars?.["@pitch"];
    return typeof name === "string" && integer(volume) && volume >= 0 && volume <= 100
      && integer(pitch) && pitch > 0
      ? success(actor, null, 0, { sound: { name, volume, pitch } }) : unsupported(actor, step.kind);
  }
  if (step.kind === "switch-on" || step.kind === "switch-off") {
    const [id] = step.parameters;
    return integer(id) && id > 0 ? success(actor, null, 0, { switchChange: { id, value: step.kind === "switch-on" } })
      : unsupported(actor, step.kind);
  }
  if (step.kind === "end") return success(actor, null, 0, { complete: true });
  return unsupported(actor, step.kind);
}

export function sourceMoveRouteIsExecutable(route: SourceMoveRoute): boolean {
  let actor: SourceRouteActor = { x: 0, y: 0, direction: "down", moveSpeed: 3, moveFrequency: 3,
    walkAnimation: true, stepAnimation: false, directionFix: false, through: false, alwaysOnTop: false,
    opacity: 255, characterName: "", characterHue: 0, pattern: 0 };
  for (const step of route.steps) {
    const result = executeSourceMoveRouteStep(actor, step, { player: { x: 1, y: 1 }, randomDirection: "right" });
    if (!result.supported) return false;
    actor = result.destination === null ? result.actor : { ...result.actor, ...result.destination };
  }
  return true;
}
