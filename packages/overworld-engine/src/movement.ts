import type { AvatarState, Direction, GridPoint, MoveIntent, OverworldCatalog, OverworldEvent, OverworldResult, OverworldState, WorldMap } from "./types.js";

function pointKey(point: GridPoint): string {
  return `${point.x},${point.y}`;
}

function mapFor(catalog: OverworldCatalog, mapId: string): WorldMap {
  const map = catalog.maps[mapId];
  if (map === undefined) throw new Error(`Unknown overworld map: ${mapId}.`);
  return map;
}

function assertPoint(map: WorldMap, point: GridPoint, label: string): void {
  if (!Number.isInteger(point.x) || !Number.isInteger(point.y)
    || point.x < 0 || point.y < 0 || point.x >= map.width || point.y >= map.height) {
    throw new RangeError(`${label} is outside map ${map.id}.`);
  }
}

export function validateCatalog(catalog: OverworldCatalog): void {
  const ids = Object.keys(catalog.maps);
  if (ids.length === 0) throw new Error("The overworld catalog requires at least one map.");
  for (const [id, map] of Object.entries(catalog.maps)) {
    if (map.id !== id) throw new Error(`Map key ${id} does not match its id ${map.id}.`);
    if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width < 1 || map.height < 1) {
      throw new RangeError(`Invalid dimensions for map ${id}.`);
    }
    const blocked = new Set<string>();
    for (const point of map.blocked) {
      assertPoint(map, point, "Blocked tile");
      const key = pointKey(point);
      if (blocked.has(key)) throw new Error(`Duplicate blocked tile ${key} on map ${id}.`);
      blocked.add(key);
    }
    const transitions = new Set<string>();
    for (const transition of map.transitions) {
      assertPoint(map, transition.at, "Transition tile");
      const target = mapFor(catalog, transition.targetMapId);
      assertPoint(target, transition.target, "Transition target");
      const key = pointKey(transition.at);
      if (transitions.has(key)) throw new Error(`Duplicate transition ${key} on map ${id}.`);
      if (blocked.has(key)) throw new Error(`Transition ${key} is blocked on map ${id}.`);
      transitions.add(key);
    }
  }
  const interactionIds = new Set<string>();
  for (const interaction of catalog.interactions ?? []) {
    if (interactionIds.has(interaction.id)) throw new Error(`Duplicate interaction: ${interaction.id}.`);
    interactionIds.add(interaction.id);
    const map = mapFor(catalog, interaction.mapId);
    assertPoint(map, interaction.at, `Interaction ${interaction.id}`);
    if (interaction.effect.type === "item" && (!Number.isSafeInteger(interaction.effect.quantity) || interaction.effect.quantity < 1)) {
      throw new RangeError(`Invalid item quantity for interaction ${interaction.id}.`);
    }
  }
}

export function createOverworldState(catalog: OverworldCatalog, avatars: readonly AvatarState[]): OverworldState {
  validateCatalog(catalog);
  if (avatars.length === 0) throw new Error("At least one avatar is required.");
  const records: Record<string, AvatarState> = {};
  const occupied = new Set<string>();
  for (const avatar of avatars) {
    if (records[avatar.id] !== undefined) throw new Error(`Duplicate avatar id: ${avatar.id}.`);
    const map = mapFor(catalog, avatar.mapId);
    assertPoint(map, avatar, `Avatar ${avatar.id}`);
    if (map.blocked.some((point) => point.x === avatar.x && point.y === avatar.y)) throw new Error(`Avatar ${avatar.id} starts on a blocked tile.`);
    const key = `${avatar.mapId}:${pointKey(avatar)}`;
    if (occupied.has(key)) throw new Error(`Multiple avatars occupy ${key}.`);
    occupied.add(key);
    records[avatar.id] = { ...avatar };
  }
  const players = Object.fromEntries(Object.keys(records).map((id) => [id, { inventory: {}, flags: [], completedInteractions: [] }]));
  return { tick: 0, avatars: records, players, session: { flags: [], completedInteractions: [], syncedParticipants: {}, battleResults: [] } };
}

function offset(direction: Direction): GridPoint {
  switch (direction) {
    case "up": return { x: 0, y: -1 };
    case "down": return { x: 0, y: 1 };
    case "left": return { x: -1, y: 0 };
    case "right": return { x: 1, y: 0 };
  }
}

function occupied(state: OverworldState, playerId: string, mapId: string, point: GridPoint): boolean {
  return Object.values(state.avatars).some((avatar) => avatar.id !== playerId
    && avatar.mapId === mapId && avatar.x === point.x && avatar.y === point.y);
}

export function resolveMovement(catalog: OverworldCatalog, state: OverworldState, intent: MoveIntent): OverworldResult {
  const avatar = state.avatars[intent.playerId];
  if (avatar === undefined) throw new Error(`Unknown avatar: ${intent.playerId}.`);
  const map = mapFor(catalog, avatar.mapId);
  const delta = offset(intent.direction);
  const target = { x: avatar.x + delta.x, y: avatar.y + delta.y };
  const events: OverworldEvent[] = [];
  if (avatar.direction !== intent.direction) events.push({ type: "directionChanged", playerId: avatar.id, direction: intent.direction });

  const finish = (nextAvatar: AvatarState, extraEvents: readonly OverworldEvent[]): OverworldResult => ({
    state: { ...state, tick: state.tick + 1, avatars: { ...state.avatars, [avatar.id]: nextAvatar } },
    events: [...events, ...extraEvents],
  });
  const facing = { ...avatar, direction: intent.direction };
  if (target.x < 0 || target.y < 0 || target.x >= map.width || target.y >= map.height) {
    return finish(facing, [{ type: "movementBlocked", playerId: avatar.id, mapId: map.id, at: target, reason: "bounds" }]);
  }
  if (map.blocked.some((point) => point.x === target.x && point.y === target.y)) {
    return finish(facing, [{ type: "movementBlocked", playerId: avatar.id, mapId: map.id, at: target, reason: "collision" }]);
  }
  if (occupied(state, avatar.id, map.id, target)) {
    return finish(facing, [{ type: "movementBlocked", playerId: avatar.id, mapId: map.id, at: target, reason: "occupied" }]);
  }

  const moved: AvatarState = { ...facing, ...target };
  const moveEvent: OverworldEvent = { type: "avatarMoved", playerId: avatar.id, mapId: map.id, from: { x: avatar.x, y: avatar.y }, to: target };
  const transition = map.transitions.find((entry) => entry.at.x === target.x && entry.at.y === target.y);
  if (transition === undefined) return finish(moved, [moveEvent]);
  if (occupied(state, avatar.id, transition.targetMapId, transition.target)) {
    return finish(facing, [{ type: "movementBlocked", playerId: avatar.id, mapId: map.id, at: target, reason: "occupied" }]);
  }
  const transitioned: AvatarState = { ...moved, mapId: transition.targetMapId, ...transition.target };
  return finish(transitioned, [
    moveEvent,
    { type: "mapChanged", playerId: avatar.id, fromMapId: map.id, toMapId: transition.targetMapId, position: transition.target },
  ]);
}
