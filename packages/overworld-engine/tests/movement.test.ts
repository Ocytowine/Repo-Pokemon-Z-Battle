import { describe, expect, it } from "vitest";
import { createOverworldState, resolveMovement, validateCatalog, type OverworldCatalog } from "../src/index.js";

const catalog: OverworldCatalog = {
  maps: {
    meadow: { id: "meadow", name: "Prairie", width: 4, height: 3, blocked: [{ x: 1, y: 0 }], transitions: [{ at: { x: 3, y: 1 }, targetMapId: "grove", target: { x: 0, y: 1 } }] },
    grove: { id: "grove", name: "Bosquet", width: 3, height: 3, blocked: [], transitions: [{ at: { x: 0, y: 1 }, targetMapId: "meadow", target: { x: 2, y: 1 } }] },
  },
};

function initial() {
  return createOverworldState(catalog, [
    { id: "p1", name: "Joueur 1", mapId: "meadow", x: 1, y: 1, direction: "down" },
    { id: "p2", name: "Joueur 2", mapId: "meadow", x: 2, y: 2, direction: "up" },
  ]);
}

describe("overworld grid movement", () => {
  it("moves one tile without mutating its input", () => {
    const state = initial();
    const snapshot = structuredClone(state);
    const result = resolveMovement(catalog, state, { playerId: "p1", direction: "right" });
    expect(result.state.avatars.p1).toMatchObject({ x: 2, y: 1, direction: "right" });
    expect(result.events).toContainEqual({ type: "avatarMoved", playerId: "p1", mapId: "meadow", from: { x: 1, y: 1 }, to: { x: 2, y: 1 } });
    expect(state).toEqual(snapshot);
  });

  it("turns toward walls and occupied tiles without crossing them", () => {
    const wall = resolveMovement(catalog, initial(), { playerId: "p1", direction: "up" });
    expect(wall.state.avatars.p1).toMatchObject({ x: 1, y: 1, direction: "up" });
    expect(wall.events).toContainEqual(expect.objectContaining({ type: "movementBlocked", reason: "collision" }));

    const occupiedState = createOverworldState(catalog, [
      { id: "p1", name: "Joueur 1", mapId: "meadow", x: 1, y: 1, direction: "down" },
      { id: "p2", name: "Joueur 2", mapId: "meadow", x: 2, y: 1, direction: "left" },
    ]);
    const occupied = resolveMovement(catalog, occupiedState, { playerId: "p2", direction: "left" });
    expect(occupied.state.avatars.p2).toMatchObject({ x: 2, y: 1 });
    expect(occupied.events).toContainEqual(expect.objectContaining({ type: "movementBlocked", reason: "occupied" }));
  });

  it("changes map when entering a transition tile", () => {
    const state = createOverworldState(catalog, [{ id: "p1", name: "Joueur 1", mapId: "meadow", x: 2, y: 1, direction: "right" }]);
    const result = resolveMovement(catalog, state, { playerId: "p1", direction: "right" });
    expect(result.state.avatars.p1).toMatchObject({ mapId: "grove", x: 0, y: 1 });
    expect(result.events.at(-1)).toEqual({ type: "mapChanged", playerId: "p1", fromMapId: "meadow", toMapId: "grove", position: { x: 0, y: 1 } });
  });

  it("rejects invalid transition targets", () => {
    expect(() => validateCatalog({ maps: { broken: { id: "broken", name: "Broken", width: 1, height: 1, blocked: [], transitions: [{ at: { x: 0, y: 0 }, targetMapId: "missing", target: { x: 0, y: 0 } }] } } })).toThrow("Unknown overworld map");
  });
});
