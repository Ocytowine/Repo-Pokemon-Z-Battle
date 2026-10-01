import { createDefaultNetworkPlayerProfile, PROTOCOL_VERSION, type NetworkPlayerProfile, type ServerMessage }
  from "@pokemon-z-battle/multiplayer-protocol";

export interface MultiplayerTicket {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly roomCode: string;
  readonly playerId: string;
  readonly side: "player" | "opponent";
  readonly reconnectToken: string;
  readonly websocketPath: string;
}

export interface StoredMultiplayerSession {
  readonly serverUrl: string;
  readonly ticket: MultiplayerTicket;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeServerUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Le serveur doit utiliser HTTP ou HTTPS.");
  url.pathname = url.pathname.replace(/\/+$/u, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/u, "");
}

export function parseMultiplayerTicket(value: unknown): MultiplayerTicket {
  if (!isRecord(value)
    || value.protocolVersion !== PROTOCOL_VERSION
    || typeof value.roomCode !== "string" || !/^[A-Z2-9]{6}$/u.test(value.roomCode)
    || typeof value.playerId !== "string" || value.playerId.length === 0
    || (value.side !== "player" && value.side !== "opponent")
    || typeof value.reconnectToken !== "string" || !/^[a-f0-9]{64}$/u.test(value.reconnectToken)
    || typeof value.websocketPath !== "string" || !value.websocketPath.startsWith("/api/rooms/")) {
    throw new Error("Ticket multijoueur invalide.");
  }
  return value as unknown as MultiplayerTicket;
}

export function buildWebSocketUrl(serverUrl: string, ticket: MultiplayerTicket): string {
  const url = new URL(ticket.websocketPath, `${normalizeServerUrl(serverUrl)}/`);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("playerId", ticket.playerId);
  url.searchParams.set("token", ticket.reconnectToken);
  return url.toString();
}

export function parseServerMessage(payload: string): ServerMessage {
  let value: unknown;
  try {
    value = JSON.parse(payload) as unknown;
  } catch {
    throw new Error("Message serveur illisible.");
  }
  if (!isRecord(value) || value.version !== PROTOCOL_VERSION || typeof value.type !== "string") throw new Error("Message serveur incompatible.");
  const valid = (() => {
    switch (value.type) {
      case "welcome": return typeof value.playerId === "string" && (value.side === "player" || value.side === "opponent") && typeof value.reconnectToken === "string" && isRecord(value.snapshot);
      case "snapshot": return isRecord(value.snapshot);
      case "ack": return typeof value.requestId === "string" && Number.isSafeInteger(value.revision);
      case "turnResolved": return typeof value.battleId === "string" && Number.isSafeInteger(value.turn) && isRecord(value.state) && Array.isArray(value.events);
      case "replacementResolved": return typeof value.battleId === "string" && isRecord(value.state) && Array.isArray(value.events);
      case "worldUpdated": return (value.side === "player" || value.side === "opponent") && Number.isSafeInteger(value.sequence) && Number.isSafeInteger(value.revision) && isRecord(value.state) && Array.isArray(value.events);
      case "interactionUpdated": return (value.side === "player" || value.side === "opponent") && Number.isSafeInteger(value.revision) && isRecord(value.state) && Array.isArray(value.events);
      case "error": return (value.requestId === null || typeof value.requestId === "string") && typeof value.code === "string" && typeof value.message === "string";
      case "pong": return typeof value.nonce === "string";
      default: return false;
    }
  })();
  if (!valid) throw new Error("Message serveur incompatible.");
  return value as unknown as ServerMessage;
}

export async function requestTicket(serverUrl: string, path: string,
  profile: NetworkPlayerProfile = createDefaultNetworkPlayerProfile()): Promise<MultiplayerTicket> {
  const response = await fetch(`${normalizeServerUrl(serverUrl)}${path}`, { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify({ profile }) });
  const value: unknown = await response.json();
  if (!response.ok) {
    const code = isRecord(value) && typeof value.error === "string" ? value.error : `HTTP_${response.status}`;
    throw new Error(`Serveur multijoueur : ${code}.`);
  }
  return parseMultiplayerTicket(value);
}
