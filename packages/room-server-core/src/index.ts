import { resolveTurn, type BattleAction, type BattleSide, type BattleState, type StatefulRandomSource, type TurnActions } from "@pokemon-z-battle/battle-engine";
import { PROTOCOL_VERSION, type ClientMessage, type ProtocolErrorCode, type RoomPlayerSnapshot, type RoomSnapshot, type ServerMessage } from "@pokemon-z-battle/multiplayer-protocol";

interface RoomPlayer {
  readonly playerId: string;
  readonly side: BattleSide;
  ready: boolean;
  connected: boolean;
  readonly acknowledged: Map<string, ServerMessage>;
}

export interface RoomDispatch {
  readonly audience: "all" | { readonly playerId: string };
  readonly message: ServerMessage;
}

export interface RoomConnection {
  readonly side: BattleSide;
  readonly snapshot: RoomSnapshot;
  readonly reconnected: boolean;
}

export interface PersistedRoomState {
  readonly version: 1;
  readonly revision: number;
  readonly battleSequence: number;
  readonly battleId: string | null;
  readonly battleState: BattleState | null;
  readonly rngState: number;
  readonly players: readonly {
    readonly playerId: string;
    readonly side: BattleSide;
    readonly ready: boolean;
    readonly connected: boolean;
    readonly acknowledged: readonly (readonly [string, ServerMessage])[];
  }[];
  readonly pendingActions: readonly (readonly [BattleSide, BattleAction])[];
}

export class AuthoritativeBattleRoom {
  readonly #players = new Map<string, RoomPlayer>();
  readonly #pendingActions = new Map<BattleSide, BattleAction>();
  readonly #createBattle: () => BattleState;
  readonly #rng: StatefulRandomSource;
  readonly #roomCode: string;
  #revision = 0;
  #battleSequence = 0;
  #battleId: string | null = null;
  #battleState: BattleState | null = null;

  public constructor(roomCode: string, createBattle: () => BattleState, rng: StatefulRandomSource, persisted?: PersistedRoomState) {
    this.#roomCode = roomCode;
    this.#createBattle = createBattle;
    this.#rng = rng;
    if (persisted !== undefined) {
      this.#revision = persisted.revision;
      this.#battleSequence = persisted.battleSequence;
      this.#battleId = persisted.battleId;
      this.#battleState = persisted.battleState;
      for (const entry of persisted.players) {
        this.#players.set(entry.playerId, { ...entry, acknowledged: new Map(entry.acknowledged) });
      }
      for (const [side, action] of persisted.pendingActions) this.#pendingActions.set(side, action);
    }
  }

  public reserve(playerId: string): RoomConnection {
    const existing = this.#players.get(playerId);
    if (existing !== undefined) return { side: existing.side, snapshot: this.snapshot(), reconnected: true };
    const usedSides = new Set([...this.#players.values()].map((player) => player.side));
    const side: BattleSide | undefined = usedSides.has("player") ? (usedSides.has("opponent") ? undefined : "opponent") : "player";
    if (side === undefined) throw new Error("ROOM_FULL");
    this.#players.set(playerId, { playerId, side, ready: false, connected: false, acknowledged: new Map() });
    this.#revision += 1;
    return { side, snapshot: this.snapshot(), reconnected: false };
  }

  public connect(playerId: string): RoomConnection {
    const existing = this.#players.get(playerId);
    if (existing !== undefined) {
      if (!existing.connected) {
        existing.connected = true;
        this.#revision += 1;
      }
      return { side: existing.side, snapshot: this.snapshot(), reconnected: true };
    }
    this.reserve(playerId);
    return this.connect(playerId);
  }

  public disconnect(playerId: string): RoomSnapshot {
    const player = this.#players.get(playerId);
    if (player !== undefined && player.connected) {
      player.connected = false;
      this.#revision += 1;
    }
    return this.snapshot();
  }

  public snapshot(): RoomSnapshot {
    const players: RoomPlayerSnapshot[] = [...this.#players.values()]
      .sort((left, right) => left.side === "player" ? -1 : right.side === "player" ? 1 : 0)
      .map(({ playerId, side, ready, connected }) => ({ playerId, side, ready, connected }));
    const phase = this.#battleState === null ? "waiting" : this.#battleState.status === "finished" ? "finished" : "battle";
    const battle = this.#battleState === null || this.#battleId === null ? null : { id: this.#battleId, state: this.#battleState };
    return { revision: this.#revision, roomCode: this.#roomCode, phase, players, battle };
  }

  public exportState(): PersistedRoomState {
    return {
      version: 1,
      revision: this.#revision,
      battleSequence: this.#battleSequence,
      battleId: this.#battleId,
      battleState: this.#battleState,
      rngState: this.#rng.snapshot(),
      players: [...this.#players.values()].map(({ playerId, side, ready, connected, acknowledged }) => ({
        playerId, side, ready, connected, acknowledged: [...acknowledged.entries()].slice(-128),
      })),
      pendingActions: [...this.#pendingActions.entries()],
    };
  }

  public receive(playerId: string, message: ClientMessage): readonly RoomDispatch[] {
    const player = this.#players.get(playerId);
    if (player === undefined) return [this.error(playerId, null, "UNAUTHORIZED", "Joueur inconnu dans cette room.")];
    if (message.type === "ping") {
      return [{ audience: { playerId }, message: { type: "pong", version: PROTOCOL_VERSION, nonce: message.nonce } }];
    }
    const previous = player.acknowledged.get(message.requestId);
    if (previous !== undefined) return [{ audience: { playerId }, message: previous }];
    if (message.type === "requestSnapshot") {
      const acknowledgement = this.acknowledge(player, message.requestId);
      return [
        { audience: { playerId }, message: acknowledgement },
        { audience: { playerId }, message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
      ];
    }
    if (message.type === "setReady") return this.setReady(player, message.requestId, message.ready);
    return this.submitAction(player, message);
  }

  private setReady(player: RoomPlayer, requestId: string, ready: boolean): readonly RoomDispatch[] {
    if (this.#battleState !== null) return [this.error(player.playerId, requestId, "INVALID_PHASE", "Le combat a déjà commencé.")];
    player.ready = ready;
    this.#revision += 1;
    const output: RoomDispatch[] = [{ audience: { playerId: player.playerId }, message: this.acknowledge(player, requestId) }];
    if (this.#players.size === 2 && [...this.#players.values()].every((candidate) => candidate.ready)) {
      this.#battleState = this.#createBattle();
      this.#battleSequence += 1;
      this.#battleId = `${this.#roomCode}-${this.#battleSequence}`;
      this.#revision += 1;
    }
    output.push({ audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } });
    return output;
  }

  private submitAction(player: RoomPlayer, message: Extract<ClientMessage, { readonly type: "submitAction" }>): readonly RoomDispatch[] {
    if (this.#battleState === null || this.#battleId === null || this.#battleState.status !== "active") {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Aucun combat actif.")];
    }
    if (message.battleId !== this.#battleId) return [this.error(player.playerId, message.requestId, "STALE_BATTLE", "Identifiant de combat périmé.")];
    if (message.turn !== this.#battleState.turn) return [this.error(player.playerId, message.requestId, "STALE_TURN", "Numéro de tour périmé.")];
    if (this.#pendingActions.has(player.side)) {
      return [this.error(player.playerId, message.requestId, "ACTION_ALREADY_SUBMITTED", "Une action est déjà enregistrée pour ce tour.")];
    }
    this.#pendingActions.set(player.side, message.action);
    this.#revision += 1;
    const output: RoomDispatch[] = [{ audience: { playerId: player.playerId }, message: this.acknowledge(player, message.requestId) }];
    const playerAction = this.#pendingActions.get("player");
    const opponentAction = this.#pendingActions.get("opponent");
    if (playerAction === undefined || opponentAction === undefined) return output;

    const resolvedTurn = this.#battleState.turn;
    const actions: TurnActions = { player: playerAction, opponent: opponentAction };
    const result = resolveTurn(this.#battleState, actions, this.#rng);
    this.#battleState = result.state;
    this.#pendingActions.clear();
    this.#revision += 1;
    output.push({
      audience: "all",
      message: {
        type: "turnResolved",
        version: PROTOCOL_VERSION,
        battleId: this.#battleId,
        turn: resolvedTurn,
        state: result.state,
        events: result.events,
      },
    });
    output.push({ audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } });
    return output;
  }

  private acknowledge(player: RoomPlayer, requestId: string): ServerMessage {
    const message: ServerMessage = { type: "ack", version: PROTOCOL_VERSION, requestId, revision: this.#revision };
    player.acknowledged.set(requestId, message);
    if (player.acknowledged.size > 128) {
      const oldest = player.acknowledged.keys().next().value as string | undefined;
      if (oldest !== undefined) player.acknowledged.delete(oldest);
    }
    return message;
  }

  private error(playerId: string, requestId: string | null, code: ProtocolErrorCode, message: string): RoomDispatch {
    return { audience: { playerId }, message: { type: "error", version: PROTOCOL_VERSION, requestId, code, message } };
  }
}
