import { replaceFaintedPokemon, resolveTeamTurn, type BattleSide, type StatefulRandomSource, type TeamBattleAction, type TeamBattleState, type TeamTurnActions } from "@pokemon-z-battle/battle-engine";
import { createDefaultNetworkPlayerProfile, PROTOCOL_VERSION, type ClientMessage, type NetworkPlayerProfile,
  type ProtocolErrorCode, type RoomPlayerSnapshot, type RoomSnapshot, type ServerMessage } from "@pokemon-z-battle/multiplayer-protocol";
import { resolveInteraction, resolveMovement, type EncounterKind, type OverworldCatalog, type OverworldState } from "@pokemon-z-battle/overworld-engine";

interface RoomPlayer {
  readonly playerId: string;
  readonly side: BattleSide;
  ready: boolean;
  connected: boolean;
  profile: NetworkPlayerProfile;
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
  readonly version: 7;
  readonly revision: number;
  readonly battleSequence: number;
  readonly battleId: string | null;
  readonly battleState: TeamBattleState | null;
  readonly rngState: number;
  readonly players: readonly {
    readonly playerId: string;
    readonly side: BattleSide;
    readonly ready: boolean;
    readonly connected: boolean;
    readonly profile: NetworkPlayerProfile;
    readonly acknowledged: readonly (readonly [string, ServerMessage])[];
  }[];
  readonly pendingActions: readonly (readonly [BattleSide, TeamBattleAction])[];
  readonly pendingReplacements: readonly (readonly [BattleSide, number])[];
  readonly worldState: OverworldState;
  readonly movementSequences: readonly (readonly [BattleSide, number])[];
  readonly activeEncounter?: ActiveEncounter | null;
}

export interface EncounterContext {
  readonly encounterId: string;
  readonly kind: EncounterKind;
}

interface ActiveEncounter extends EncounterContext {
  readonly ownerSide: BattleSide;
}

export interface RoomWorldDefinition {
  readonly catalog: OverworldCatalog;
  readonly initialState: OverworldState;
}

export class AuthoritativeBattleRoom {
  readonly #players = new Map<string, RoomPlayer>();
  readonly #pendingActions = new Map<BattleSide, TeamBattleAction>();
  readonly #pendingReplacements = new Map<BattleSide, number>();
  readonly #createBattle: (encounter?: EncounterContext) => TeamBattleState;
  readonly #rng: StatefulRandomSource;
  readonly #roomCode: string;
  readonly #worldCatalog: OverworldCatalog;
  readonly #movementSequences = new Map<BattleSide, number>();
  #revision = 0;
  #battleSequence = 0;
  #battleId: string | null = null;
  #battleState: TeamBattleState | null = null;
  #worldState: OverworldState;
  #activeEncounter: ActiveEncounter | null = null;

  public constructor(roomCode: string, createBattle: (encounter?: EncounterContext) => TeamBattleState, rng: StatefulRandomSource, world: RoomWorldDefinition, persisted?: PersistedRoomState) {
    this.#roomCode = roomCode;
    this.#createBattle = createBattle;
    this.#rng = rng;
    this.#worldCatalog = world.catalog;
    this.#worldState = world.initialState;
    if (persisted !== undefined) {
      this.#revision = persisted.revision;
      this.#battleSequence = persisted.battleSequence;
      this.#battleId = persisted.battleId;
      this.#battleState = persisted.battleState;
      this.#activeEncounter = persisted.activeEncounter ?? null;
      this.#worldState = persisted.worldState;
      for (const entry of persisted.players) {
        this.#players.set(entry.playerId, { ...entry, acknowledged: new Map(entry.acknowledged) });
      }
      for (const [side, action] of persisted.pendingActions) this.#pendingActions.set(side, action);
      for (const [side, teamIndex] of persisted.pendingReplacements) this.#pendingReplacements.set(side, teamIndex);
      for (const [side, sequence] of persisted.movementSequences) this.#movementSequences.set(side, sequence);
    }
  }

  public reserve(playerId: string, profile: NetworkPlayerProfile = createDefaultNetworkPlayerProfile()): RoomConnection {
    const existing = this.#players.get(playerId);
    if (existing !== undefined) return { side: existing.side, snapshot: this.snapshot(), reconnected: true };
    const usedSides = new Set([...this.#players.values()].map((player) => player.side));
    const side: BattleSide | undefined = usedSides.has("player") ? (usedSides.has("opponent") ? undefined : "opponent") : "player";
    if (side === undefined) throw new Error("ROOM_FULL");
    this.#players.set(playerId, { playerId, side, ready: false, connected: false, profile, acknowledged: new Map() });
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
      .map(({ playerId, side, ready, connected, profile }) => ({ playerId, side, ready, connected, profile }));
    const phase = this.#battleState === null ? "waiting" : this.#battleState.status === "finished" ? "finished" : "battle";
    const battle = this.#battleState === null || this.#battleId === null ? null : { id: this.#battleId, state: this.#battleState };
    return {
      revision: this.#revision,
      roomCode: this.#roomCode,
      phase,
      players,
      battle,
      world: this.#worldState,
      movementSequences: {
        player: this.#movementSequences.get("player") ?? 0,
        opponent: this.#movementSequences.get("opponent") ?? 0,
      },
    };
  }

  public exportState(): PersistedRoomState {
    return {
      version: 7,
      revision: this.#revision,
      battleSequence: this.#battleSequence,
      battleId: this.#battleId,
      battleState: this.#battleState,
      rngState: this.#rng.snapshot(),
      players: [...this.#players.values()].map(({ playerId, side, ready, connected, profile, acknowledged }) => ({
        playerId, side, ready, connected, profile, acknowledged: [...acknowledged.entries()].slice(-128),
      })),
      pendingActions: [...this.#pendingActions.entries()],
      pendingReplacements: [...this.#pendingReplacements.entries()],
      worldState: this.#worldState,
      movementSequences: [...this.#movementSequences.entries()],
      activeEncounter: this.#activeEncounter,
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
    if (message.type === "setProfile") return this.setProfile(player, message.requestId, message.profile);
    if (message.type === "moveAvatar") return this.moveAvatar(player, message);
    if (message.type === "interact") return this.interact(player, message.requestId);
    if (message.type === "submitReplacement") return this.submitReplacement(player, message);
    return this.submitAction(player, message);
  }

  private setProfile(player: RoomPlayer, requestId: string, profile: NetworkPlayerProfile): readonly RoomDispatch[] {
    player.profile = profile;
    this.#revision += 1;
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, requestId) },
      { audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
    ];
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
    if (this.#activeEncounter !== null) return this.submitEncounterAction(player, message);
    if (this.#battleState === null || this.#battleId === null || this.#battleState.status !== "active") {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Aucun combat actif.")];
    }
    if (this.#battleState.replacementRequired.length > 0) {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Un remplacement est requis avant le prochain tour.")];
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
    const actions: TeamTurnActions = { player: playerAction, opponent: opponentAction };
    const result = resolveTeamTurn(this.#battleState, actions, this.#rng);
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

  private submitEncounterAction(player: RoomPlayer, message: Extract<ClientMessage, { readonly type: "submitAction" }>): readonly RoomDispatch[] {
    const encounter = this.#activeEncounter;
    if (encounter === null || this.#battleState === null || this.#battleId === null || this.#battleState.status !== "active") {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Aucune rencontre active.")];
    }
    if (encounter.ownerSide !== "player" || player.side !== encounter.ownerSide) {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Seul le meneur de la rencontre choisit l'action.")];
    }
    if (message.battleId !== this.#battleId) return [this.error(player.playerId, message.requestId, "STALE_BATTLE", "Identifiant de combat périmé.")];
    if (message.turn !== this.#battleState.turn) return [this.error(player.playerId, message.requestId, "STALE_TURN", "Numéro de tour périmé.")];

    const battleId = this.#battleId;
    const resolvedTurn = this.#battleState.turn;
    const result = resolveTeamTurn(this.#battleState, { player: message.action, opponent: { kind: "move", moveIndex: 0 } }, this.#rng);
    this.#battleState = result.state;
    this.#revision += 1;
    const output: RoomDispatch[] = [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, message.requestId) },
      { audience: "all", message: { type: "turnResolved", version: PROTOCOL_VERSION, battleId, turn: resolvedTurn, state: result.state, events: result.events } },
    ];

    if (result.state.status === "finished" && result.state.winner !== null) {
      this.#worldState = {
        ...this.#worldState,
        session: {
          ...this.#worldState.session,
          battleResults: [...this.#worldState.session.battleResults, {
            encounterId: encounter.encounterId,
            kind: encounter.kind,
            winner: result.state.winner,
          }],
        },
      };
      this.#activeEncounter = null;
      this.#battleState = null;
      this.#battleId = null;
      for (const roomPlayer of this.#players.values()) roomPlayer.ready = false;
      this.#revision += 1;
    }
    output.push({ audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } });
    return output;
  }

  private moveAvatar(player: RoomPlayer, message: Extract<ClientMessage, { readonly type: "moveAvatar" }>): readonly RoomDispatch[] {
    if (this.#activeEncounter !== null && this.#battleState?.status === "active") {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Les déplacements sont verrouillés pendant la rencontre.")];
    }
    const previousSequence = this.#movementSequences.get(player.side) ?? 0;
    if (message.sequence <= previousSequence) {
      return [this.error(player.playerId, message.requestId, "STALE_MOVEMENT", "Intention de mouvement périmée.")];
    }
    const result = resolveMovement(this.#worldCatalog, this.#worldState, { playerId: player.side, direction: message.direction });
    this.#worldState = result.state;
    this.#movementSequences.set(player.side, message.sequence);
    this.#revision += 1;
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, message.requestId) },
      {
        audience: "all",
        message: {
          type: "worldUpdated", version: PROTOCOL_VERSION, side: player.side,
          sequence: message.sequence, revision: this.#revision, state: result.state, events: result.events,
        },
      },
    ];
  }

  private interact(player: RoomPlayer, requestId: string): readonly RoomDispatch[] {
    if (this.#battleState !== null) {
      return [this.error(player.playerId, requestId, "INVALID_PHASE", "Une interaction est impossible pendant un combat.")];
    }
    const result = resolveInteraction(this.#worldCatalog, this.#worldState, { playerId: player.side, hostPlayerId: "player" });
    this.#worldState = result.state;
    const encounter = result.events.find((event) => event.type === "encounterRequested");
    if (encounter !== undefined) {
      this.#battleState = this.#createBattle({ encounterId: encounter.encounterId, kind: encounter.kind });
      this.#battleSequence += 1;
      this.#battleId = `${this.#roomCode}-${this.#battleSequence}`;
      this.#activeEncounter = { encounterId: encounter.encounterId, kind: encounter.kind, ownerSide: player.side };
    }
    this.#revision += 1;
    const output: RoomDispatch[] = [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, requestId) },
      {
        audience: "all",
        message: { type: "interactionUpdated", version: PROTOCOL_VERSION, side: player.side, revision: this.#revision, state: result.state, events: result.events },
      },
    ];
    if (encounter !== undefined) output.push({ audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } });
    return output;
  }

  private submitReplacement(player: RoomPlayer, message: Extract<ClientMessage, { readonly type: "submitReplacement" }>): readonly RoomDispatch[] {
    if (this.#battleState === null || this.#battleId === null || this.#battleState.status !== "active") {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Aucun combat actif.")];
    }
    if (message.battleId !== this.#battleId) return [this.error(player.playerId, message.requestId, "STALE_BATTLE", "Identifiant de combat périmé.")];
    if (message.turn !== this.#battleState.turn) return [this.error(player.playerId, message.requestId, "STALE_TURN", "Numéro de tour périmé.")];
    if (!this.#battleState.replacementRequired.includes(player.side)) {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Aucun remplacement requis pour ce camp.")];
    }
    if (this.#pendingReplacements.has(player.side)) {
      return [this.error(player.playerId, message.requestId, "REPLACEMENT_ALREADY_SUBMITTED", "Un remplacement est déjà enregistré.")];
    }
    this.#pendingReplacements.set(player.side, message.teamIndex);
    this.#revision += 1;
    const output: RoomDispatch[] = [{ audience: { playerId: player.playerId }, message: this.acknowledge(player, message.requestId) }];
    if (!this.#battleState.replacementRequired.every((side) => this.#pendingReplacements.has(side))) return output;

    const replacements = Object.fromEntries(this.#pendingReplacements) as Partial<Record<BattleSide, number>>;
    const result = replaceFaintedPokemon(this.#battleState, replacements);
    this.#battleState = result.state;
    this.#pendingReplacements.clear();
    this.#revision += 1;
    output.push({ audience: "all", message: { type: "replacementResolved", version: PROTOCOL_VERSION, battleId: this.#battleId, state: result.state, events: result.events } });
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
