import { describe, expect, it } from "vitest";
import { createOverworldState, resolveInteraction, type AvatarState, type OverworldCatalog } from "../src/index.js";

const catalog: OverworldCatalog = {
  maps: { test: { id: "test", name: "Test", width: 3, height: 5, blocked: [], transitions: [] } },
  interactions: [
    { id: "personal", label: "Baie", kind: "item", mapId: "test", at: { x: 1, y: 0 }, policy: "PERSONAL", effect: { type: "item", itemId: "BERRY", quantity: 1 } },
    { id: "shared", label: "Guide", kind: "npc", mapId: "test", at: { x: 1, y: 1 }, policy: "SHARED", effect: { type: "dialogue", text: "Bonjour !" } },
    { id: "host", label: "Levier", kind: "switch", mapId: "test", at: { x: 1, y: 2 }, policy: "HOST_ONLY", effect: { type: "flag", flag: "HOST_OPEN" } },
    { id: "synced", label: "Stèle", kind: "switch", mapId: "test", at: { x: 1, y: 3 }, policy: "SYNCED", effect: { type: "flag", flag: "SYNC_OPEN" } },
    { id: "wild", label: "Herbes", kind: "switch", mapId: "test", at: { x: 1, y: 4 }, policy: "HOST_ONLY", effect: { type: "encounter", encounterId: "wild-1", kind: "wild" } },
  ],
};

function stateAt(y: number) {
  const avatars: AvatarState[] = [
    { id: "player", name: "Joueur 1", mapId: "test", x: 0, y, direction: "right" },
    { id: "opponent", name: "Joueur 2", mapId: "test", x: 2, y, direction: "left" },
  ];
  return createOverworldState(catalog, avatars);
}

describe("cooperative overworld interactions", () => {
  it("keeps PERSONAL rewards independent", () => {
    const initial = stateAt(0);
    const snapshot = structuredClone(initial);
    const first = resolveInteraction(catalog, initial, { playerId: "player", hostPlayerId: "player" });
    const second = resolveInteraction(catalog, first.state, { playerId: "opponent", hostPlayerId: "player" });
    expect(second.state.players.player?.inventory.BERRY).toBe(1);
    expect(second.state.players.opponent?.inventory.BERRY).toBe(1);
    expect(second.state.session.completedInteractions).not.toContain("personal");
    expect(initial).toEqual(snapshot);
  });

  it("resolves simultaneous SHARED claims in server order", () => {
    const first = resolveInteraction(catalog, stateAt(1), { playerId: "player", hostPlayerId: "player" });
    const conflict = resolveInteraction(catalog, first.state, { playerId: "opponent", hostPlayerId: "player" });
    expect(first.events).toContainEqual(expect.objectContaining({ type: "interactionCompleted", interactionId: "shared" }));
    expect(conflict.events).toEqual([{ type: "interactionUnavailable", playerId: "opponent", interactionId: "shared", reason: "completed" }]);
  });

  it("restricts HOST_ONLY effects to the host", () => {
    const rejected = resolveInteraction(catalog, stateAt(2), { playerId: "opponent", hostPlayerId: "player" });
    expect(rejected.events[0]).toMatchObject({ type: "interactionUnavailable", reason: "host-only" });
    const accepted = resolveInteraction(catalog, rejected.state, { playerId: "player", hostPlayerId: "player" });
    expect(accepted.state.session.flags).toContain("HOST_OPEN");
  });

  it("waits for both players with SYNCED", () => {
    const first = resolveInteraction(catalog, stateAt(3), { playerId: "player", hostPlayerId: "player" });
    expect(first.events[0]).toMatchObject({ type: "interactionPending", participants: ["player"] });
    const second = resolveInteraction(catalog, first.state, { playerId: "opponent", hostPlayerId: "player" });
    expect(second.state.session.flags).toContain("SYNC_OPEN");
    expect(second.events).toContainEqual(expect.objectContaining({ type: "interactionCompleted", policy: "SYNCED" }));
  });

  it("requests an encounter without constructing a battle in the world engine", () => {
    const result = resolveInteraction(catalog, stateAt(4), { playerId: "player", hostPlayerId: "player" });
    expect(result.events).toContainEqual({ type: "encounterRequested", playerId: "player", interactionId: "wild", encounterId: "wild-1", kind: "wild" });
  });
});
