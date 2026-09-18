import type { BattleAction, BattleEvent, BattleSide, BattleState } from "@pokemon-z-battle/battle-engine";

export const PROTOCOL_VERSION = 1 as const;
export const MAX_CLIENT_MESSAGE_BYTES = 4_096;

export type RoomPhase = "waiting" | "battle" | "finished";

export interface RoomPlayerSnapshot {
  readonly playerId: string;
  readonly side: BattleSide;
  readonly ready: boolean;
  readonly connected: boolean;
}

export interface RoomSnapshot {
  readonly revision: number;
  readonly roomCode: string;
  readonly phase: RoomPhase;
  readonly players: readonly RoomPlayerSnapshot[];
  readonly battle: { readonly id: string; readonly state: BattleState } | null;
}

interface VersionedMessage {
  readonly version: typeof PROTOCOL_VERSION;
}

interface RequestedMessage extends VersionedMessage {
  readonly requestId: string;
}

export type ClientMessage =
  | (RequestedMessage & { readonly type: "setReady"; readonly ready: boolean })
  | (RequestedMessage & {
      readonly type: "submitAction";
      readonly battleId: string;
      readonly turn: number;
      readonly action: BattleAction;
    })
  | (RequestedMessage & { readonly type: "requestSnapshot" })
  | (VersionedMessage & { readonly type: "ping"; readonly nonce: string });

export type ProtocolErrorCode =
  | "INVALID_MESSAGE"
  | "UNSUPPORTED_VERSION"
  | "UNAUTHORIZED"
  | "ROOM_FULL"
  | "INVALID_PHASE"
  | "STALE_BATTLE"
  | "STALE_TURN"
  | "ACTION_ALREADY_SUBMITTED"
  | "INTERNAL_ERROR";

export type ServerMessage =
  | (VersionedMessage & {
      readonly type: "welcome";
      readonly playerId: string;
      readonly side: BattleSide;
      readonly reconnectToken: string;
      readonly snapshot: RoomSnapshot;
    })
  | (VersionedMessage & { readonly type: "snapshot"; readonly snapshot: RoomSnapshot })
  | (VersionedMessage & { readonly type: "ack"; readonly requestId: string; readonly revision: number })
  | (VersionedMessage & {
      readonly type: "turnResolved";
      readonly battleId: string;
      readonly turn: number;
      readonly state: BattleState;
      readonly events: readonly BattleEvent[];
    })
  | (VersionedMessage & {
      readonly type: "error";
      readonly requestId: string | null;
      readonly code: ProtocolErrorCode;
      readonly message: string;
    })
  | (VersionedMessage & { readonly type: "pong"; readonly nonce: string });
