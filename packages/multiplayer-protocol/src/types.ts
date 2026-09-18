import type { BattleSide, TeamBattleAction, TeamBattleEvent, TeamBattleState } from "@pokemon-z-battle/battle-engine";
import type { Direction, OverworldEvent, OverworldState } from "@pokemon-z-battle/overworld-engine";

export const PROTOCOL_VERSION = 6 as const;
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
  readonly battle: { readonly id: string; readonly state: TeamBattleState } | null;
  readonly world: OverworldState;
  readonly movementSequences: Readonly<Record<BattleSide, number>>;
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
      readonly action: TeamBattleAction;
    })
  | (RequestedMessage & {
      readonly type: "submitReplacement";
      readonly battleId: string;
      readonly turn: number;
      readonly teamIndex: number;
    })
  | (RequestedMessage & { readonly type: "requestSnapshot" })
  | (RequestedMessage & { readonly type: "moveAvatar"; readonly direction: Direction; readonly sequence: number })
  | (RequestedMessage & { readonly type: "interact" })
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
  | "REPLACEMENT_ALREADY_SUBMITTED"
  | "STALE_MOVEMENT"
  | "INTERACTION_UNAVAILABLE"
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
      readonly state: TeamBattleState;
      readonly events: readonly TeamBattleEvent[];
    })
  | (VersionedMessage & {
      readonly type: "replacementResolved";
      readonly battleId: string;
      readonly state: TeamBattleState;
      readonly events: readonly TeamBattleEvent[];
    })
  | (VersionedMessage & {
      readonly type: "worldUpdated";
      readonly side: BattleSide;
      readonly sequence: number;
      readonly revision: number;
      readonly state: OverworldState;
      readonly events: readonly OverworldEvent[];
    })
  | (VersionedMessage & {
      readonly type: "interactionUpdated";
      readonly side: BattleSide;
      readonly revision: number;
      readonly state: OverworldState;
      readonly events: readonly OverworldEvent[];
    })
  | (VersionedMessage & {
      readonly type: "error";
      readonly requestId: string | null;
      readonly code: ProtocolErrorCode;
      readonly message: string;
    })
  | (VersionedMessage & { readonly type: "pong"; readonly nonce: string });
