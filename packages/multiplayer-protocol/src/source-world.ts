import type { BattleSide } from "@pokemon-z-battle/battle-engine";
import type { Direction, GridPoint } from "@pokemon-z-battle/overworld-engine";

export interface SourceAvatarSnapshot extends GridPoint {
  readonly direction: Direction;
}

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
  readonly blockedPoints: readonly GridPoint[];
  readonly host: SourceAvatarSnapshot;
  readonly story: SourceStorySnapshot;
}

export interface SourceWorldSnapshot extends Omit<SourceWorldHostState, "host"> {
  readonly avatars: Readonly<Record<BattleSide, SourceAvatarSnapshot>>;
}

const DIRECTIONS = new Set<Direction>(["up", "down", "left", "right"]);
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
  if (!isRecord(value) || !exactKeys(value, ["x", "y", "direction"])
    || !integer(value.x, 0, width - 1) || !integer(value.y, 0, height - 1)
    || typeof value.direction !== "string" || !DIRECTIONS.has(value.direction as Direction)) {
    throw new Error("Avatar de carte source invalide.");
  }
  return { x: value.x, y: value.y, direction: value.direction as Direction };
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
  if (!isRecord(value) || !exactKeys(value,
    ["mapId", "width", "height", "passages", "blockedPoints", "host", "story"])
    || !integer(value.mapId, 1, 999_999) || !integer(value.width, 1, MAX_MAP_DIMENSION)
    || !integer(value.height, 1, MAX_MAP_DIMENSION)) throw new Error("Monde source invalide.");
  const cellCount = value.width * value.height;
  if (cellCount > MAX_MAP_CELLS || typeof value.passages !== "string"
    || value.passages.length !== cellCount || !/^[0-9a-f]+$/u.test(value.passages)) {
    throw new Error("Passages de carte source invalides.");
  }
  if (!Array.isArray(value.blockedPoints) || value.blockedPoints.length > MAX_BLOCKED_POINTS) {
    throw new Error("Obstacles de carte source invalides.");
  }
  return { mapId: value.mapId, width: value.width, height: value.height, passages: value.passages,
    blockedPoints: value.blockedPoints.map((point) => parsePoint(point, value.width as number, value.height as number)),
    host: parseAvatar(value.host, value.width, value.height), story: parseStory(value.story) };
}

export function sourceWorldSnapshot(hostState: SourceWorldHostState,
  opponent?: SourceAvatarSnapshot): SourceWorldSnapshot {
  return { mapId: hostState.mapId, width: hostState.width, height: hostState.height,
    passages: hostState.passages, blockedPoints: hostState.blockedPoints, story: hostState.story,
    avatars: { player: hostState.host, opponent: opponent ?? hostState.host } };
}
