import { afterEach, describe, expect, it, vi } from "vitest";
import { OverworldNetworkSession, roomSnapshotForPlayer, type NetworkSessionCallbacks } from "../src/network-session.js";
import { createDefaultNetworkPlayerProfile, type RoomSnapshot } from "@pokemon-z-battle/multiplayer-protocol";

const ticket = {
  protocolVersion: 12,
  roomCode: "ABC234",
  playerId: "player-1",
  side: "player",
  reconnectToken: "a".repeat(64),
  websocketPath: "/api/rooms/ABC234/socket",
} as const;

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  public get length(): number { return this.values.size; }
  public clear(): void { this.values.clear(); }
  public getItem(key: string): string | null { return this.values.get(key) ?? null; }
  public key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  public removeItem(key: string): void { this.values.delete(key); }
  public setItem(key: string, value: string): void { this.values.set(key, value); }
}

class FakeWebSocket {
  public static readonly OPEN = 1;
  public readonly sent: string[] = [];
  public readonly closed: Array<{ code?: number; reason?: string }> = [];
  public readyState = FakeWebSocket.OPEN;
  private readonly listeners = new Map<string, Array<(event: { readonly data: string }) => void>>();

  public constructor(public readonly url: string) {}

  public addEventListener(type: string, listener: (event: { readonly data: string }) => void): void {
    const entries = this.listeners.get(type) ?? [];
    entries.push(listener);
    this.listeners.set(type, entries);
  }
  public emitMessage(message: unknown): void {
    for (const listener of this.listeners.get("message") ?? []) listener({ data: JSON.stringify(message) });
  }
  public send(payload: string): void { this.sent.push(payload); }
  public close(code?: number, reason?: string): void { this.closed.push({ code, reason }); }
}

function callbacks(): NetworkSessionCallbacks {
  return {
    onStatus: vi.fn(),
    onWorldState: vi.fn(),
    onEvents: vi.fn(),
    onMapChanged: vi.fn(),
    onConnectionFormChanged: vi.fn(),
    onPlayersChanged: vi.fn(),
    onSourceWorldState: vi.fn(),
    onSourceActorsState: vi.fn(),
    onSourceSceneState: vi.fn(),
    onBattleStarted: vi.fn(),
    onBattleTurnResolved: vi.fn(),
    onBattleReplacementResolved: vi.fn(),
    onBattleEscaped: vi.fn(),
    onBattleRestoredFinished: vi.fn(),
    onBattleSettlement: vi.fn(() => true),
    onBattleClosed: vi.fn(),
    onRender: vi.fn(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("overworld network session", () => {
  it("keeps a guest excursion isolated from a source battle on the host map", () => {
    const snapshot = { phase: "battle", sourceWorld: { presence: { player: "shared", opponent: "away" } },
      battle: { sourceContext: {}, participation: { camps: {
        player: { trainerIds: ["host"] }, opponent: { trainerIds: [] },
      } } } } as unknown as RoomSnapshot;
    expect(roomSnapshotForPlayer(snapshot, "guest", "opponent")).toMatchObject({ phase: "waiting", battle: null });
    expect(roomSnapshotForPlayer(snapshot, "host", "player").battle).toBe(snapshot.battle);
  });

  it("creates, stores, uses and disconnects a room session", async () => {
    const storage = new MemoryStorage();
    const sockets: FakeWebSocket[] = [];
    vi.stubGlobal("sessionStorage", storage);
    vi.stubGlobal("performance", { now: () => 1_000 });
    vi.stubGlobal("crypto", { randomUUID: () => "request-1" });
    vi.stubGlobal("WebSocket", class extends FakeWebSocket {
      public static override readonly OPEN = 1;
      public constructor(url: string) { super(url); sockets.push(this); }
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(ticket), { status: 200 })));
    const handlers = callbacks();
    const session = new OverworldNetworkSession("test-session", handlers);

    await session.createOrJoin("create", "http://127.0.0.1:8787/", "", createDefaultNetworkPlayerProfile());

    expect(session.active).toBe(true);
    expect(session.current?.ticket).toEqual(ticket);
    expect(storage.getItem("test-session")).toContain("ABC234");
    expect(handlers.onConnectionFormChanged).toHaveBeenCalledWith("http://127.0.0.1:8787", "ABC234");
    expect(sockets[0]?.url).toContain("ws://127.0.0.1:8787/api/rooms/ABC234/socket");

    expect(session.sendMovement("player", "up")).toBe(true);
    expect(session.sendMovement("player", "right")).toBe(false);
    expect(JSON.parse(sockets[0]?.sent[0] ?? "{}")).toMatchObject({ type: "moveAvatar", direction: "up", sequence: 1 });
    const sourceWorld = { mapId: 3, width: 3, height: 3, passages: "fffffffff", blockedPoints: [],
      actors: [], actorRevision: 0,
      story: { switches: {}, variables: {}, selfSwitches: {} }, followers: {},
      avatars: { player: { x: 1, y: 1, direction: "up" }, opponent: { x: 1, y: 2, direction: "left" } } } as const;
    sockets[0]?.emitMessage({ type: "sourceWorldUpdated", version: 12, side: "opponent", sequence: 1,
      revision: 1, state: sourceWorld });
    expect(handlers.onSourceWorldState).toHaveBeenLastCalledWith(sourceWorld, true, false);
    expect(session.sendMovement("player", "right")).toBe(false);
    sockets[0]?.emitMessage({ type: "sourceWorldUpdated", version: 12, side: "player", sequence: 1,
      revision: 2, state: sourceWorld });
    expect(handlers.onSourceWorldState).toHaveBeenLastCalledWith(sourceWorld, true, true);
    expect(session.publishSourceScene({ mapId: 4, sequenceActive: false,
      dialogue: null, actors: [], presentation: null })).toBe(false);
    expect(session.publishSourceScene({ mapId: 3, sequenceActive: true,
      dialogue: { label: "Crisanto", text: "Attention !", choices: [] },
      actors: [], presentation: null })).toBe(true);
    expect(JSON.parse(sockets[0]?.sent[1] ?? "{}")).toMatchObject({ type: "setSourceScene",
      scene: { mapId: 3, sequenceActive: true } });
    const actors = [{ eventId: 7, x: 2, y: 1, direction: "left" as const, blocking: true,
      moveSpeed: 3, action: "step" as const }];
    session.publishSourceActors(3, actors);
    session.publishSourceActors(3, actors);
    expect(JSON.parse(sockets[0]?.sent[2] ?? "{}")).toMatchObject({ type: "setSourceActors", mapId: 3, actors });
    sockets[0]?.emitMessage({ type: "sourceActorsUpdated", version: 12, mapId: 3, actorRevision: 1,
      revision: 3, actors });
    expect(handlers.onSourceActorsState).toHaveBeenLastCalledWith(3, 1, actors);
    const followerAppearance = { form: 1, shiny: true, gender: "female" as const };
    session.publishSourceFollower("FENNEKIN", followerAppearance);
    session.publishSourceFollower("FENNEKIN", followerAppearance);
    expect(JSON.parse(sockets[0]?.sent[3] ?? "{}")).toMatchObject({ type: "setSourceFollower", species: "FENNEKIN",
      appearance: followerAppearance });
    session.publishSourceFollower("FENNEKIN", { ...followerAppearance, shiny: false });
    expect(JSON.parse(sockets[0]?.sent[4] ?? "{}")).toMatchObject({ appearance: { shiny: false } });
    const duelTeam = { activeIndex: 0, members: [{ id: "fennekin", species: "FENNEKIN", level: 5,
      maxHp: 20, hp: 20, attack: 10, defense: 10, specialAttack: 10, specialDefense: 10, speed: 10,
      types: ["FIRE"], majorStatus: null, ability: null, heldItem: null,
      moves: [{ id: "SCRATCH", name: "Griffe", type: "NORMAL", category: "physical",
        power: 40, accuracy: 100, priority: 0, pp: 35 }] }] } as const;
    session.challengePlayer(duelTeam);
    session.respondPlayerChallenge(false, null);
    expect(JSON.parse(sockets[0]?.sent[5] ?? "{}")).toMatchObject({ type: "challengePlayer", team: duelTeam });
    expect(JSON.parse(sockets[0]?.sent[6] ?? "{}")).toMatchObject({ type: "respondPlayerChallenge", accept: false });
    expect(sockets[0]?.sent).toHaveLength(7);

    session.disconnect();
    expect(session.active).toBe(false);
    expect(storage.getItem("test-session")).toBeNull();
    expect(JSON.parse(sockets[0]?.sent[7] ?? "{}")).toMatchObject({ type: "leaveRoom" });
    expect(sockets[0]?.closed).toEqual([{ code: 1000, reason: "Retour au mode local" }]);
  });

  it("removes a corrupted stored session", () => {
    const storage = new MemoryStorage();
    storage.setItem("test-session", "not-json");
    vi.stubGlobal("sessionStorage", storage);
    const handlers = callbacks();
    const session = new OverworldNetworkSession("test-session", handlers);

    session.restore(createDefaultNetworkPlayerProfile());

    expect(storage.getItem("test-session")).toBeNull();
    expect(handlers.onStatus).toHaveBeenCalledWith("Local", "La session mémorisée était invalide et a été supprimée.", false);
  });

  it("rejects an invalid source map before contacting the Worker", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const handlers = callbacks();
    const session = new OverworldNetworkSession("test-session", handlers);
    const invalidWorld = { mapId: 3, width: 2, height: 2, passages: "fff", blockedPoints: [],
      host: { x: 0, y: 0, direction: "down" }, follower: null,
      story: { switches: {}, variables: {}, selfSwitches: {} } } as never;

    await session.createOrJoin("create", "http://127.0.0.1:8787", "",
      createDefaultNetworkPlayerProfile(), invalidWorld);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(handlers.onStatus).toHaveBeenCalledWith("Erreur", "Passages de carte source invalides.", false);
  });
});
