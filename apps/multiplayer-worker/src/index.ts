import { DurableObject } from "cloudflare:workers";
import { SeededRandom } from "@pokemon-z-battle/battle-engine";
import { PROTOCOL_VERSION, ProtocolValidationError, parseClientMessage, type ServerMessage } from "@pokemon-z-battle/multiplayer-protocol";
import { AuthoritativeBattleRoom, type PersistedRoomState, type RoomDispatch } from "@pokemon-z-battle/room-server-core";
import { createDemoBattle } from "./demo-battle.js";
import { generateRoomCode, roomCodeFromPath } from "./routing.js";

interface Env {
  readonly BATTLE_ROOMS: DurableObjectNamespace<BattleRoom>;
  readonly ALLOWED_ORIGIN?: string;
}

interface Identity {
  readonly playerId: string;
  readonly tokenHash: string;
}

interface PersistedRoomBundle {
  readonly roomCode: string;
  readonly room: PersistedRoomState;
  readonly identities: readonly Identity[];
}

interface SocketAttachment {
  readonly playerId: string;
}

function json(value: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function socketAttachment(socket: WebSocket): SocketAttachment | null {
  const value: unknown = socket.deserializeAttachment();
  if (typeof value !== "object" || value === null || !("playerId" in value) || typeof value.playerId !== "string") return null;
  return { playerId: value.playerId };
}

export class BattleRoom extends DurableObject<Env> {
  #room: AuthoritativeBattleRoom | null = null;
  #roomCode: string | null = null;
  #identities = new Map<string, string>();
  readonly #initialized: Promise<void>;

  public constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.#initialized = ctx.blockConcurrencyWhile(async () => {
      const bundle = await ctx.storage.get<PersistedRoomBundle>("room");
      if (bundle === undefined) return;
      if (bundle.room.version !== PROTOCOL_VERSION) return;
      this.#roomCode = bundle.roomCode;
      this.#identities = new Map(bundle.identities.map((entry) => [entry.playerId, entry.tokenHash]));
      this.#room = new AuthoritativeBattleRoom(bundle.roomCode, createDemoBattle, new SeededRandom(bundle.room.rngState), bundle.room);
    });
  }

  public override async fetch(request: Request): Promise<Response> {
    await this.#initialized;
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/create") return this.createRoom(await request.json());
    if (request.method === "POST" && url.pathname === "/join") return this.joinRoom();
    if (request.method === "GET" && url.pathname === "/socket") return this.openSocket(request, url);
    return json({ error: "Route Durable Object inconnue." }, 404);
  }

  public override async webSocketMessage(socket: WebSocket, payload: ArrayBuffer | string): Promise<void> {
    await this.#initialized;
    const attachment = socketAttachment(socket);
    if (attachment === null || this.#room === null) {
      socket.close(1011, "Session absente");
      return;
    }
    try {
      if (typeof payload !== "string") throw new ProtocolValidationError("Les messages binaires ne sont pas acceptés.");
      const dispatches = this.#room.receive(attachment.playerId, parseClientMessage(payload));
      await this.persist();
      this.dispatch(dispatches);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Message invalide.";
      this.send(socket, { type: "error", version: PROTOCOL_VERSION, requestId: null, code: "INVALID_MESSAGE", message });
    }
  }

  public override async webSocketClose(socket: WebSocket): Promise<void> {
    await this.disconnectSocket(socket);
  }

  public override async webSocketError(socket: WebSocket): Promise<void> {
    await this.disconnectSocket(socket);
  }

  private async createRoom(body: unknown): Promise<Response> {
    if (this.#room !== null) return json({ error: "ROOM_EXISTS" }, 409);
    if (typeof body !== "object" || body === null || !("roomCode" in body) || typeof body.roomCode !== "string") {
      return json({ error: "INVALID_ROOM" }, 400);
    }
    this.#roomCode = body.roomCode;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
    this.#room = new AuthoritativeBattleRoom(body.roomCode, createDemoBattle, new SeededRandom(seed));
    const ticket = await this.issueTicket();
    await this.persist();
    return json(ticket, 201);
  }

  private async joinRoom(): Promise<Response> {
    if (this.#room === null) return json({ error: "ROOM_NOT_FOUND" }, 404);
    try {
      const ticket = await this.issueTicket();
      await this.persist();
      return json(ticket, 201);
    } catch (error) {
      if (error instanceof Error && error.message === "ROOM_FULL") return json({ error: "ROOM_FULL" }, 409);
      throw error;
    }
  }

  private async issueTicket(): Promise<object> {
    if (this.#room === null || this.#roomCode === null) throw new Error("ROOM_NOT_FOUND");
    const playerId = crypto.randomUUID();
    const reconnectToken = randomToken();
    const connection = this.#room.reserve(playerId);
    this.#identities.set(playerId, await sha256(reconnectToken));
    return {
      protocolVersion: PROTOCOL_VERSION,
      roomCode: this.#roomCode,
      playerId,
      side: connection.side,
      reconnectToken,
      websocketPath: `/api/rooms/${this.#roomCode}/socket`,
    };
  }

  private async openSocket(request: Request, url: URL): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ error: "WEBSOCKET_UPGRADE_REQUIRED" }, 426);
    if (this.#room === null || this.#roomCode === null) return json({ error: "ROOM_NOT_FOUND" }, 404);
    const playerId = url.searchParams.get("playerId");
    const reconnectToken = url.searchParams.get("token");
    if (playerId === null || reconnectToken === null || this.#identities.get(playerId) !== await sha256(reconnectToken)) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    for (const previous of this.ctx.getWebSockets(`player:${playerId}`)) previous.close(4001, "Connexion remplacée");
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.serializeAttachment({ playerId } satisfies SocketAttachment);
    this.ctx.acceptWebSocket(server, [`player:${playerId}`]);
    const connection = this.#room.connect(playerId);
    await this.persist();
    this.send(server, {
      type: "welcome",
      version: PROTOCOL_VERSION,
      playerId,
      side: connection.side,
      reconnectToken,
      snapshot: connection.snapshot,
    });
    this.broadcast({ type: "snapshot", version: PROTOCOL_VERSION, snapshot: connection.snapshot });
    return new Response(null, { status: 101, webSocket: client });
  }

  private async disconnectSocket(socket: WebSocket): Promise<void> {
    await this.#initialized;
    const attachment = socketAttachment(socket);
    if (attachment === null || this.#room === null) return;
    const stillConnected = this.ctx.getWebSockets(`player:${attachment.playerId}`)
      .some((candidate) => candidate !== socket && candidate.readyState === WebSocket.OPEN);
    if (stillConnected) return;
    const snapshot = this.#room.disconnect(attachment.playerId);
    await this.persist();
    this.broadcast({ type: "snapshot", version: PROTOCOL_VERSION, snapshot });
  }

  private dispatch(dispatches: readonly RoomDispatch[]): void {
    for (const dispatch of dispatches) {
      if (dispatch.audience === "all") this.broadcast(dispatch.message);
      else for (const socket of this.ctx.getWebSockets(`player:${dispatch.audience.playerId}`)) this.send(socket, dispatch.message);
    }
  }

  private broadcast(message: ServerMessage): void {
    for (const socket of this.ctx.getWebSockets()) this.send(socket, message);
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify(message));
    } catch {
      // La fermeture sera traitée par webSocketClose/webSocketError.
    }
  }

  private async persist(): Promise<void> {
    if (this.#room === null || this.#roomCode === null) return;
    const identities = [...this.#identities].map(([playerId, tokenHash]) => ({ playerId, tokenHash }));
    await this.ctx.storage.put("room", { roomCode: this.#roomCode, room: this.#room.exportState(), identities } satisfies PersistedRoomBundle);
  }
}

async function proxyTicket(stub: DurableObjectStub<BattleRoom>, operation: "create" | "join", roomCode?: string): Promise<Response> {
  return stub.fetch(`https://room.internal/${operation}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(operation === "create" ? { roomCode } : {}),
  });
}

function withCors(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = env.ALLOWED_ORIGIN ?? "*";
    if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }), origin);

    if (request.method === "POST" && url.pathname === "/api/rooms") {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const roomCode = generateRoomCode(crypto.getRandomValues(new Uint8Array(6)));
        const response = await proxyTicket(env.BATTLE_ROOMS.getByName(roomCode), "create", roomCode);
        if (response.status !== 409) return withCors(response, origin);
      }
      return withCors(json({ error: "ROOM_CODE_EXHAUSTED" }, 503), origin);
    }

    const joinCode = roomCodeFromPath(url.pathname, "join");
    if (request.method === "POST" && joinCode !== null) {
      return withCors(await proxyTicket(env.BATTLE_ROOMS.getByName(joinCode), "join"), origin);
    }

    const socketCode = roomCodeFromPath(url.pathname, "socket");
    if (request.method === "GET" && socketCode !== null) {
      const target = new URL("https://room.internal/socket");
      target.search = url.search;
      return env.BATTLE_ROOMS.getByName(socketCode).fetch(new Request(target, request));
    }

    if (request.method === "GET" && url.pathname === "/health") return json({ ok: true, protocolVersion: PROTOCOL_VERSION });
    return withCors(json({ error: "NOT_FOUND" }, 404), origin);
  },
} satisfies ExportedHandler<Env>;
