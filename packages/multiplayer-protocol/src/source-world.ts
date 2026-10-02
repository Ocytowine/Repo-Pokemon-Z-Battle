import type { BattleSide } from "@pokemon-z-battle/battle-engine";
import type { Direction, GridPoint } from "@pokemon-z-battle/overworld-engine";

export interface SourceAvatarSnapshot extends GridPoint {
  readonly direction: Direction;
  readonly mode?: SourceMovementMode;
  readonly action?: SourceMovementAction;
}

export type SourceMovementMode = "walk" | "run" | "mount" | "surf" | "dive";
export type SourceMovementAction = "idle" | "step" | "ledge-jump" | "surf-transition" | "ice-slide"
  | "waterfall" | "climb";

export interface SourceMovementIntent {
  readonly direction: Direction;
  readonly mode?: SourceMovementMode;
  readonly waterfall?: boolean;
}

export interface SourceMovementResult {
  readonly avatar: SourceAvatarSnapshot;
  readonly moved: boolean;
}

export interface SourceFollowerSnapshot extends SourceAvatarSnapshot {
  readonly species: string;
}

export type SourcePlayerPresence = "shared" | "away";

export interface SourceStorySnapshot {
  readonly switches: Readonly<Record<string, boolean>>;
  readonly variables: Readonly<Record<string, number>>;
  readonly selfSwitches: Readonly<Record<string, boolean>>;
}

export interface SourceWorldHostState {
  readonly mapId: number;
  readonly width: number;
  readonly height: number;
  /** Un chiffre hexadecimal par case, reprenant le masque directionnel RPG Maker. */
  readonly passages: string;
  /** Un chiffre base 36 par case pour le terrain source (eau, glace, corniche...). */
  readonly terrain?: string;
  readonly blockedPoints: readonly GridPoint[];
  readonly host: SourceAvatarSnapshot;
  readonly follower: SourceFollowerSnapshot | null;
  readonly story: SourceStorySnapshot;
}

export interface SourceWorldSnapshot extends Omit<SourceWorldHostState, "host" | "follower"> {
  readonly avatars: Readonly<Record<BattleSide, SourceAvatarSnapshot>>;
  readonly followers: Readonly<Partial<Record<BattleSide, SourceFollowerSnapshot>>>;
  /** Un joueur `away` poursuit sa partie locale et ne collisionne plus avec la carte partagee. */
  readonly presence: Readonly<Record<BattleSide, SourcePlayerPresence>>;
}

const DIRECTIONS = new Set<Direction>(["up", "down", "left", "right"]);
const MOVEMENT_MODES = new Set<SourceMovementMode>(["walk", "run", "mount", "surf", "dive"]);
const MOVEMENT_ACTIONS = new Set<SourceMovementAction>([
  "idle", "step", "ledge-jump", "surf-transition", "ice-slide", "waterfall", "climb",
]);
const MAX_MAP_DIMENSION = 512;
const MAX_MAP_CELLS = 262_144;
const MAX_BLOCKED_POINTS = 8_192;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function integer(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function parsePoint(value: unknown, width: number, height: number): GridPoint {
  if (!isRecord(value) || !exactKeys(value, ["x", "y"])
    || !integer(value.x, 0, width - 1) || !integer(value.y, 0, height - 1)) {
    throw new Error("Point de carte source invalide.");
  }
  return { x: value.x, y: value.y };
}

function parseAvatar(value: unknown, width: number, height: number): SourceAvatarSnapshot {
  if (!isRecord(value) || !["x", "y", "direction"].every((key) => key in value)
    || Object.keys(value).some((key) => !["x", "y", "direction", "mode", "action"].includes(key))
    || !integer(value.x, 0, width - 1) || !integer(value.y, 0, height - 1)
    || typeof value.direction !== "string" || !DIRECTIONS.has(value.direction as Direction)
    || value.mode !== undefined && (typeof value.mode !== "string" || !MOVEMENT_MODES.has(value.mode as SourceMovementMode))
    || value.action !== undefined && (typeof value.action !== "string" || !MOVEMENT_ACTIONS.has(value.action as SourceMovementAction))) {
    throw new Error("Avatar de carte source invalide.");
  }
  return { x: value.x, y: value.y, direction: value.direction as Direction,
    ...(value.mode === undefined ? {} : { mode: value.mode as SourceMovementMode }),
    ...(value.action === undefined ? {} : { action: value.action as SourceMovementAction }) };
}

function parseFollower(value: unknown, width: number, height: number): SourceFollowerSnapshot | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || !exactKeys(value, ["x", "y", "direction", "species"])
    || !integer(value.x, 0, width - 1) || !integer(value.y, 0, height - 1)
    || typeof value.direction !== "string" || !DIRECTIONS.has(value.direction as Direction)
    || typeof value.species !== "string" || !/^[A-Z0-9_]{1,64}$/u.test(value.species)) {
    throw new Error("Pokemon suiveur de carte source invalide.");
  }
  return { x: value.x, y: value.y, direction: value.direction as Direction, species: value.species };
}

function parseBooleanRecord(value: unknown): Readonly<Record<string, boolean>> {
  if (!isRecord(value) || Object.keys(value).length > 16_384
    || Object.entries(value).some(([key, entry]) => !/^\d+(?::\d+:[A-D])?$/u.test(key) || typeof entry !== "boolean")) {
    throw new Error("Interrupteurs de carte source invalides.");
  }
  return value as Readonly<Record<string, boolean>>;
}

function parseNumberRecord(value: unknown): Readonly<Record<string, number>> {
  if (!isRecord(value) || Object.keys(value).length > 16_384
    || Object.entries(value).some(([key, entry]) => !/^\d+$/u.test(key) || !Number.isSafeInteger(entry))) {
    throw new Error("Variables de carte source invalides.");
  }
  return value as Readonly<Record<string, number>>;
}

function parseStory(value: unknown): SourceStorySnapshot {
  if (!isRecord(value) || !exactKeys(value, ["switches", "variables", "selfSwitches"])) {
    throw new Error("État narratif visible invalide.");
  }
  return { switches: parseBooleanRecord(value.switches), variables: parseNumberRecord(value.variables),
    selfSwitches: parseBooleanRecord(value.selfSwitches) };
}

export function parseSourceWorldHostState(value: unknown): SourceWorldHostState {
  if (!isRecord(value) || !["mapId", "width", "height", "passages", "blockedPoints", "host", "story"]
    .every((key) => key in value) || Object.keys(value).some((key) => ![
      "mapId", "width", "height", "passages", "terrain", "blockedPoints", "host", "follower", "story",
    ].includes(key))
    || !integer(value.mapId, 1, 999_999) || !integer(value.width, 1, MAX_MAP_DIMENSION)
    || !integer(value.height, 1, MAX_MAP_DIMENSION)) throw new Error("Monde source invalide.");
  const cellCount = value.width * value.height;
  if (cellCount > MAX_MAP_CELLS || typeof value.passages !== "string"
    || value.passages.length !== cellCount || !/^[0-9a-f]+$/u.test(value.passages)) {
    throw new Error("Passages de carte source invalides.");
  }
  if (value.terrain !== undefined && (typeof value.terrain !== "string"
    || value.terrain.length !== cellCount || !/^[0-9a-z]+$/u.test(value.terrain))) {
    throw new Error("Terrains de carte source invalides.");
  }
  if (!Array.isArray(value.blockedPoints) || value.blockedPoints.length > MAX_BLOCKED_POINTS) {
    throw new Error("Obstacles de carte source invalides.");
  }
  return { mapId: value.mapId, width: value.width, height: value.height, passages: value.passages,
    ...(value.terrain === undefined ? {} : { terrain: value.terrain }),
    blockedPoints: value.blockedPoints.map((point) => parsePoint(point, value.width as number, value.height as number)),
    host: parseAvatar(value.host, value.width, value.height),
    follower: parseFollower(value.follower, value.width, value.height), story: parseStory(value.story) };
}

export function sourceWorldSnapshot(hostState: SourceWorldHostState,
  opponent?: SourceAvatarSnapshot): SourceWorldSnapshot {
  return { mapId: hostState.mapId, width: hostState.width, height: hostState.height,
    passages: hostState.passages, ...(hostState.terrain === undefined ? {} : { terrain: hostState.terrain }),
    blockedPoints: hostState.blockedPoints, story: hostState.story,
    avatars: { player: hostState.host, opponent: opponent ?? hostState.host },
    followers: hostState.follower === null ? {} : { player: hostState.follower },
    presence: { player: "shared", opponent: "shared" } };
}

const SOURCE_DIRECTION_BITS: Readonly<Record<Direction, number>> = { down: 1, left: 2, right: 4, up: 8 };
const SOURCE_OPPOSITE: Readonly<Record<Direction, Direction>> = { down: "up", left: "right", right: "left", up: "down" };
const SOURCE_DELTAS: Readonly<Record<Direction, GridPoint>> = {
  down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 },
};
const SURFABLE_TERRAIN = new Set([5, 7, 8, 9, 17]);

function avatarMode(avatar: SourceAvatarSnapshot): SourceMovementMode {
  return avatar.mode ?? "walk";
}

function terrainAt(world: Pick<SourceWorldHostState, "width" | "terrain">, x: number, y: number): number {
  return Number.parseInt(world.terrain?.[y * world.width + x] ?? "0", 36);
}

function occupiedAt(points: readonly GridPoint[], x: number, y: number): boolean {
  return points.some((point) => point.x === x && point.y === y);
}

function passageAllows(world: Pick<SourceWorldHostState, "width" | "height" | "passages">,
  from: GridPoint, to: GridPoint, direction: Direction): boolean {
  if (to.x < 0 || to.y < 0 || to.x >= world.width || to.y >= world.height) return false;
  const sourceMask = Number.parseInt(world.passages[from.y * world.width + from.x] ?? "0", 16);
  const targetMask = Number.parseInt(world.passages[to.y * world.width + to.x] ?? "0", 16);
  return (sourceMask & SOURCE_DIRECTION_BITS[direction]) !== 0
    && (targetMask & SOURCE_DIRECTION_BITS[SOURCE_OPPOSITE[direction]]) !== 0;
}

/** Noyau autoritaire partagé par le solo, l'hôte et l'invité. */
export function resolveSourceMovement(world: Pick<SourceWorldHostState,
  "width" | "height" | "passages" | "terrain" | "blockedPoints">,
avatar: SourceAvatarSnapshot, intent: SourceMovementIntent, occupied: readonly GridPoint[] = []): SourceMovementResult {
  const delta = SOURCE_DELTAS[intent.direction];
  const adjacent = { x: avatar.x + delta.x, y: avatar.y + delta.y };
  const currentMode = avatarMode(avatar);
  const requestedMode = intent.mode ?? currentMode;
  const currentTerrain = terrainAt(world, avatar.x, avatar.y);
  const adjacentTerrain = adjacent.x < 0 || adjacent.y < 0 || adjacent.x >= world.width || adjacent.y >= world.height
    ? 0 : terrainAt(world, adjacent.x, adjacent.y);
  const blocked = (point: GridPoint): boolean => occupiedAt(world.blockedPoints, point.x, point.y)
    || occupiedAt(occupied, point.x, point.y);

  if (adjacentTerrain === 1 && currentMode !== "surf" && currentMode !== "dive") {
    const landing = { x: adjacent.x + delta.x, y: adjacent.y + delta.y };
    if (landing.x >= 0 && landing.y >= 0 && landing.x < world.width && landing.y < world.height
      && !blocked(adjacent) && !blocked(landing)
      && passageAllows(world, avatar, adjacent, intent.direction)
      && passageAllows(world, adjacent, landing, intent.direction)) {
      return { moved: true, avatar: { ...landing, direction: intent.direction,
        mode: requestedMode === "run" ? "run" : currentMode, action: "ledge-jump" } };
    }
  }

  const wantsWaterfall = currentMode === "surf" && intent.waterfall === true
    && adjacentTerrain === 8 && (intent.direction === "up" || intent.direction === "down");
  const enteringWater = requestedMode === "surf" && SURFABLE_TERRAIN.has(adjacentTerrain);
  const leavingWater = currentMode === "surf" && SURFABLE_TERRAIN.has(currentTerrain)
    && !SURFABLE_TERRAIN.has(adjacentTerrain);
  const waterPassage = wantsWaterfall || enteringWater || currentMode === "surf" && SURFABLE_TERRAIN.has(adjacentTerrain);
  const passable = !blocked(adjacent) && (waterPassage || passageAllows(world, avatar, adjacent, intent.direction));
  const mountForbidden = requestedMode === "mount" && (adjacentTerrain === 10 || adjacentTerrain === 12);
  if (!passable || mountForbidden || requestedMode !== "surf" && currentMode !== "surf" && SURFABLE_TERRAIN.has(adjacentTerrain)) {
    return { moved: false, avatar: { ...avatar, direction: intent.direction, action: "idle" } };
  }

  const mode: SourceMovementMode = leavingWater ? "walk" : enteringWater ? "surf" : requestedMode;
  const action: SourceMovementAction = wantsWaterfall ? "waterfall"
    : adjacentTerrain === 12 ? "ice-slide"
      : enteringWater || leavingWater ? "surf-transition" : "step";
  return { moved: true, avatar: { ...adjacent, direction: intent.direction, mode, action } };
}
