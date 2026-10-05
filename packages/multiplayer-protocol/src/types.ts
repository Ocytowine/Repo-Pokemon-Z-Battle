import type { BattleJoinProposal, BattleSide, BattleTeam, SharedBattleLedger, SharedBattleParticipation,
  SharedBattleSession, TeamBattleAction, TeamBattleEvent, TeamBattleState } from "@pokemon-z-battle/battle-engine";
import type { Direction, OverworldEvent, OverworldState } from "@pokemon-z-battle/overworld-engine";
import type { NetworkPlayerProfile } from "./player-profile.js";
import type { SourceAvatarSnapshot, SourceFollowerSnapshot, SourceMovementMode, SourceWorldHostState,
  SourceWorldSnapshot } from "./source-world.js";
import type { SourceSceneSnapshot } from "./source-scene.js";
import type { SourceBattleContext } from "./source-battle.js";
import type { SourceBattleSettlement } from "./source-battle-settlement.js";

export const PROTOCOL_VERSION = 12 as const;
export const MAX_CLIENT_MESSAGE_BYTES = 524_288;

export type RoomPhase = "waiting" | "battle" | "finished";

export interface RoomPlayerSnapshot {
  readonly playerId: string;
  readonly side: BattleSide;
  readonly ready: boolean;
  readonly connected: boolean;
  readonly profile: NetworkPlayerProfile;
}

export interface PlayerDuelChallenge {
  readonly challenger: BattleSide;
  readonly challenged: BattleSide;
}

export interface RoomSnapshot {
  readonly revision: number;
  readonly roomCode: string;
  readonly phase: RoomPhase;
  readonly players: readonly RoomPlayerSnapshot[];
  readonly battle: { readonly id: string; readonly state: TeamBattleState; readonly duel: boolean;
    readonly participation: SharedBattleParticipation | null; readonly joinProposal: BattleJoinProposal | null;
    readonly joinRefusal: { readonly playerId: string; readonly reason: string } | null;
    readonly observerIds: readonly string[];
    readonly ledger: SharedBattleLedger | null; readonly session: SharedBattleSession;
    readonly sourceContext: SourceBattleContext | null; readonly escaped: boolean;
    readonly escapeAttempts: number } | null;
  readonly duelChallenge: PlayerDuelChallenge | null;
  readonly world: OverworldState;
  readonly sourceWorld: SourceWorldSnapshot | null;
  readonly sourceScene: SourceSceneSnapshot | null;
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
  | (RequestedMessage & { readonly type: "attemptBattleEscape"; readonly battleId: string; readonly turn: number })
  | (RequestedMessage & { readonly type: "requestSnapshot" })
  | (RequestedMessage & { readonly type: "moveAvatar"; readonly direction: Direction; readonly sequence: number;
      readonly mode?: SourceMovementMode; readonly waterfall?: boolean })
  | (RequestedMessage & { readonly type: "interact" })
  | (RequestedMessage & { readonly type: "challengePlayer"; readonly team: BattleTeam })
  | (RequestedMessage & { readonly type: "respondPlayerChallenge"; readonly accept: boolean;
      readonly team: BattleTeam | null })
  | (RequestedMessage & { readonly type: "proposeBattleJoin"; readonly battleId: string;
      readonly side: BattleSide; readonly team: BattleTeam; readonly finalMemberIds: readonly string[] })
  | (RequestedMessage & { readonly type: "respondBattleJoin"; readonly battleId: string; readonly accept: boolean })
  | (RequestedMessage & { readonly type: "observeBattle"; readonly battleId: string })
  | (RequestedMessage & { readonly type: "closeBattleJoinWindow"; readonly battleId: string })
  | (RequestedMessage & { readonly type: "leaveBattle"; readonly battleId: string })
  | (RequestedMessage & { readonly type: "setProfile"; readonly profile: NetworkPlayerProfile })
  | (RequestedMessage & { readonly type: "setSourceWorld"; readonly world: SourceWorldHostState })
  | (RequestedMessage & { readonly type: "setSourcePresence"; readonly attached: boolean;
      readonly avatar: SourceAvatarSnapshot | null })
  | (RequestedMessage & { readonly type: "setSourceFollower"; readonly species: string | null;
      readonly appearance?: SourceFollowerSnapshot["appearance"] })
  | (RequestedMessage & { readonly type: "setSourceScene"; readonly scene: SourceSceneSnapshot })
  | (RequestedMessage & { readonly type: "openSourceBattle"; readonly context: SourceBattleContext;
      readonly playerTeam: BattleTeam; readonly opponentTeam: BattleTeam })
  | (RequestedMessage & { readonly type: "ackBattleSettlement"; readonly settlementId: string })
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
  | "HOST_ONLY"
  | "INTERNAL_ERROR";

export type ServerMessage =
  | (VersionedMessage & {
      readonly type: "welcome";
      readonly playerId: string;
      readonly side: BattleSide;
      readonly reconnectToken: string;
      readonly snapshot: RoomSnapshot;
      readonly settlement: SourceBattleSettlement | null;
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
  | (VersionedMessage & { readonly type: "battleEscaped"; readonly battleId: string; readonly turn: number })
  | (VersionedMessage & { readonly type: "battleSettlement"; readonly settlement: SourceBattleSettlement })
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
  | (VersionedMessage & { readonly type: "sourceWorldUpdated"; readonly side: BattleSide;
      readonly sequence: number; readonly revision: number; readonly state: SourceWorldSnapshot })
  | (VersionedMessage & { readonly type: "sourceSceneUpdated"; readonly revision: number;
      readonly state: SourceSceneSnapshot })
  | (VersionedMessage & {
      readonly type: "error";
      readonly requestId: string | null;
      readonly code: ProtocolErrorCode;
      readonly message: string;
    })
  | (VersionedMessage & { readonly type: "pong"; readonly nonce: string });
