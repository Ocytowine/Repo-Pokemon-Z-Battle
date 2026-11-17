import type { ClientMessage } from "@pokemon-z-battle/multiplayer-protocol";

export type RoomPersistenceMode = "immediate" | "checkpoint" | "none";
export const ROOM_CHECKPOINT_IDLE_MS = 1_500;
export const ROOM_CHECKPOINT_MAX_MS = 30_000;

/**
 * Realtime presentation must not turn every WebSocket packet into durable storage I/O.
 * Critical gameplay mutations remain write-through; recoverable positions are checkpointed.
 */
export function roomPersistenceMode(message: ClientMessage): RoomPersistenceMode {
  if (message.type === "ping" || message.type === "requestSnapshot" || message.type === "emitSourceSound"
    || message.type === "sendSocialInvite" || message.type === "sendSocialText"
    || message.type === "sendSocialEmoji" || message.type === "sendSocialTeam") {
    return "none";
  }
  if (message.type === "moveAvatar" || message.type === "setSourceActors"
    || message.type === "setSocialVisibility") return "checkpoint";
  return "immediate";
}

export function roomCheckpointDelay(startedAt: number, now: number): number {
  const remaining = Math.max(0, ROOM_CHECKPOINT_MAX_MS - Math.max(0, now - startedAt));
  return Math.min(ROOM_CHECKPOINT_IDLE_MS, remaining);
}
