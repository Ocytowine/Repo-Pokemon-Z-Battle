import { MAX_CLIENT_MESSAGE_BYTES, PROTOCOL_VERSION, type ClientMessage } from "./types.js";

const IDENTIFIER = /^[A-Za-z0-9_-]{1,64}$/u;
const ROOM_CODE = /^[A-Z2-9]{6}$/u;

export class ProtocolValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProtocolValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function isSafePositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isMoveAction(value: unknown): value is { readonly kind: "move"; readonly moveIndex: number } {
  return isRecord(value)
    && hasExactKeys(value, ["kind", "moveIndex"])
    && value.kind === "move"
    && Number.isInteger(value.moveIndex)
    && Number(value.moveIndex) >= 0
    && Number(value.moveIndex) <= 3;
}

function invalid(reason: string): never {
  throw new ProtocolValidationError(`Message client invalide : ${reason}.`);
}

export function normalizeRoomCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!ROOM_CODE.test(normalized)) {
    throw new ProtocolValidationError("Code de room invalide : 6 caractères parmi A-Z et 2-9 attendus.");
  }
  return normalized;
}

export function parseClientMessage(payload: string): ClientMessage {
  if (new TextEncoder().encode(payload).byteLength > MAX_CLIENT_MESSAGE_BYTES) invalid("taille maximale dépassée");
  let value: unknown;
  try {
    value = JSON.parse(payload) as unknown;
  } catch {
    return invalid("JSON illisible");
  }
  if (!isRecord(value) || typeof value.type !== "string") return invalid("objet typé attendu");
  if (value.version !== PROTOCOL_VERSION) return invalid("version de protocole non supportée");

  switch (value.type) {
    case "setReady":
      if (!hasExactKeys(value, ["type", "version", "requestId", "ready"]) || !isIdentifier(value.requestId) || typeof value.ready !== "boolean") {
        return invalid("setReady mal formé");
      }
      return value as unknown as ClientMessage;
    case "submitAction":
      if (!hasExactKeys(value, ["type", "version", "requestId", "battleId", "turn", "action"])
        || !isIdentifier(value.requestId) || !isIdentifier(value.battleId)
        || !isSafePositiveInteger(value.turn) || !isMoveAction(value.action)) {
        return invalid("submitAction mal formé");
      }
      return value as unknown as ClientMessage;
    case "requestSnapshot":
      if (!hasExactKeys(value, ["type", "version", "requestId"]) || !isIdentifier(value.requestId)) {
        return invalid("requestSnapshot mal formé");
      }
      return value as unknown as ClientMessage;
    case "ping":
      if (!hasExactKeys(value, ["type", "version", "nonce"]) || !isIdentifier(value.nonce)) return invalid("ping mal formé");
      return value as unknown as ClientMessage;
    default:
      return invalid(`type inconnu ${value.type}`);
  }
}

export function serializeMessage(message: ClientMessage): string {
  return JSON.stringify(message);
}
