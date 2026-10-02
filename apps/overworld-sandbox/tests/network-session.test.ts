import { afterEach, describe, expect, it, vi } from "vitest";
import { OverworldNetworkSession, type NetworkSessionCallbacks } from "../src/network-session.js";
import { createDefaultNetworkPlayerProfile } from "@pokemon-z-battle/multiplayer-protocol";

const ticket = {
  protocolVersion: 8,
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

  public constructor(public readonly url: string) {}

  public addEventListener(): void {}
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
    onSourceSceneState: vi.fn(),
    onRender: vi.fn(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("overworld network session", () => {
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

    session.sendMovement("player", "up");
    expect(JSON.parse(sockets[0]?.sent[0] ?? "{}")).toMatchObject({ type: "moveAvatar", direction: "up", sequence: 1 });
    session.publishSourceScene({ mapId: 3, sequenceActive: true,
      dialogue: { label: "Crisanto", text: "Attention !", choices: [] }, actors: [], presentation: null });
    expect(JSON.parse(sockets[0]?.sent[1] ?? "{}")).toMatchObject({ type: "setSourceScene",
      scene: { mapId: 3, sequenceActive: true } });

    session.disconnect();
    expect(session.active).toBe(false);
    expect(storage.getItem("test-session")).toBeNull();
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
});
