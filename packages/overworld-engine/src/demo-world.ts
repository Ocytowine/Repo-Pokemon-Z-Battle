import { createOverworldState } from "./movement.js";
import type { GridPoint, OverworldCatalog, OverworldState, WorldMap } from "./types.js";

function border(width: number, height: number, openings: readonly GridPoint[]): GridPoint[] {
  const open = new Set(openings.map((point) => `${point.x},${point.y}`));
  const points: GridPoint[] = [];
  for (let x = 0; x < width; x += 1) {
    for (const y of [0, height - 1]) if (!open.has(`${x},${y}`)) points.push({ x, y });
  }
  for (let y = 1; y < height - 1; y += 1) {
    for (const x of [0, width - 1]) if (!open.has(`${x},${y}`)) points.push({ x, y });
  }
  return points;
}

const meadow: WorldMap = {
  id: "meadow", name: "Prairie des Deux", width: 12, height: 9,
  blocked: [...border(12, 9, [{ x: 11, y: 4 }]), { x: 5, y: 2 }, { x: 5, y: 3 }, { x: 7, y: 5 }, { x: 8, y: 5 }, { x: 3, y: 6 }],
  transitions: [{ at: { x: 11, y: 4 }, targetMapId: "grove", target: { x: 1, y: 4 } }],
};

const grove: WorldMap = {
  id: "grove", name: "Bosquet Azur", width: 12, height: 9,
  blocked: [...border(12, 9, [{ x: 0, y: 4 }]), { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 }, { x: 5, y: 6 }],
  transitions: [{ at: { x: 0, y: 4 }, targetMapId: "meadow", target: { x: 10, y: 4 } }],
};

export const DEMO_WORLD_CATALOG: OverworldCatalog = {
  maps: { meadow, grove },
  interactions: [
    { id: "meadow-berry", label: "Baie luisante", kind: "item", mapId: "meadow", at: { x: 2, y: 5 }, policy: "PERSONAL", effect: { type: "item", itemId: "ORAN_BERRY", quantity: 1 } },
    { id: "meadow-guide", label: "Guide du pré", kind: "npc", mapId: "meadow", at: { x: 3, y: 4 }, policy: "SHARED", effect: { type: "dialogue", text: "À deux, le chemin vers le bosquet est plus sûr." } },
    { id: "meadow-host-switch", label: "Levier du meneur", kind: "switch", mapId: "meadow", at: { x: 2, y: 6 }, policy: "HOST_ONLY", effect: { type: "flag", flag: "HOST_GATE_OPEN" } },
    { id: "meadow-wild", label: "Herbes frémissantes", kind: "switch", mapId: "meadow", at: { x: 0, y: 4 }, policy: "HOST_ONLY", effect: { type: "encounter", encounterId: "wild-meadow-1", kind: "wild" } },
    { id: "grove-twin-switch", label: "Stèle jumelle", kind: "switch", mapId: "grove", at: { x: 5, y: 4 }, policy: "SYNCED", effect: { type: "flag", flag: "TWIN_STONE_ACTIVE" } },
    { id: "grove-trainer", label: "Dresseuse du bosquet", kind: "npc", mapId: "grove", at: { x: 6, y: 2 }, policy: "HOST_ONLY", effect: { type: "encounter", encounterId: "trainer-grove-1", kind: "trainer" } },
  ],
};

export function createDemoWorldState(): OverworldState {
  return createOverworldState(DEMO_WORLD_CATALOG, [
    { id: "player", name: "Joueur 1", mapId: "meadow", x: 2, y: 4, direction: "down" },
    { id: "opponent", name: "Joueur 2", mapId: "meadow", x: 4, y: 4, direction: "left" },
  ]);
}
