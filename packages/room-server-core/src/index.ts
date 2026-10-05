import { activateSharedBattleSession, activeBattleController, applyBattleJoin, approveBattleJoin,
  closeSharedBattleSession, createSharedBattleLedger, createSharedBattleSession, createTeamBattleState,
  proposeBattleJoin, recordSharedBattleTurn, replaceFaintedPokemon, resolveTeamTurn, settleSharedBattleSession,
  type BattleJoinProposal,
  restoreSharedBattleLedger,
  type BattleSide, type BattleTeam, type BattlerState, type SharedBattleCamp, type SharedBattleLedger,
  type SharedBattleParticipation, type SharedBattleSession, type StatefulRandomSource, type TeamBattleAction,
  type TeamBattleState, type TeamTurnActions } from "@pokemon-z-battle/battle-engine";
import { createDefaultNetworkPlayerProfile, PROTOCOL_VERSION, resolveSourceMovement, sourceWorldSnapshot, type ClientMessage, type NetworkPlayerProfile,
  type ProtocolErrorCode, type RoomPlayerSnapshot, type RoomSnapshot, type ServerMessage, type SourceAvatarSnapshot,
  type SourceBattleContext, type SourceFollowerSnapshot, type SourceSceneSnapshot, type SourceWorldHostState,
  type SourceWorldSnapshot } from "@pokemon-z-battle/multiplayer-protocol";
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
  readonly version: 9 | 10 | 11;
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
  readonly sourceWorldState: SourceWorldSnapshot | null;
  readonly sourceSceneState: SourceSceneSnapshot | null;
  readonly movementSequences: readonly (readonly [BattleSide, number])[];
  readonly activeEncounter?: ActiveEncounter | null;
  readonly duelChallenge?: PersistedDuelChallenge | null;
  readonly activeDuel?: boolean;
  readonly battleParticipation?: SharedBattleParticipation | null;
  readonly battleJoinProposal?: BattleJoinProposal | null;
  readonly battleJoinRefusal?: { readonly playerId: string; readonly reason: string } | null;
  readonly battleObserverIds?: readonly string[];
  readonly battleLedger?: SharedBattleLedger | null;
  readonly battleSession?: SharedBattleSession | null;
  readonly sourceBattleContext?: SourceBattleContext | null;
}

export interface EncounterContext {
  readonly encounterId: string;
  readonly kind: EncounterKind;
}

interface ActiveEncounter extends EncounterContext {
  readonly ownerSide: BattleSide;
}

interface PersistedDuelChallenge {
  readonly challenger: BattleSide;
  readonly challenged: BattleSide;
  readonly team: BattleTeam;
}

export interface RoomWorldDefinition {
  readonly catalog: OverworldCatalog;
  readonly initialState: OverworldState;
  readonly sourceWorld?: SourceWorldHostState | null;
}

const SOURCE_OPPOSITE = { down: "up", left: "right", right: "left", up: "down" } as const;
const SOURCE_DELTAS = { down: { x: 0, y: 1 }, left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }, up: { x: 0, y: -1 } } as const;

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
  #sourceWorldState: SourceWorldSnapshot | null;
  #sourceSceneState: SourceSceneSnapshot | null = null;
  #activeEncounter: ActiveEncounter | null = null;
  #duelChallenge: PersistedDuelChallenge | null = null;
  #activeDuel = false;
  #battleParticipation: SharedBattleParticipation | null = null;
  #battleJoinProposal: BattleJoinProposal | null = null;
  #battleJoinRefusal: { readonly playerId: string; readonly reason: string } | null = null;
  #battleObserverIds: readonly string[] = [];
  #battleLedger: SharedBattleLedger | null = null;
  #battleSession: SharedBattleSession | null = null;
  #sourceBattleContext: SourceBattleContext | null = null;

  public constructor(roomCode: string, createBattle: (encounter?: EncounterContext) => TeamBattleState, rng: StatefulRandomSource, world: RoomWorldDefinition, persisted?: PersistedRoomState) {
    this.#roomCode = roomCode;
    this.#createBattle = createBattle;
    this.#rng = rng;
    this.#worldCatalog = world.catalog;
    this.#worldState = world.initialState;
    this.#sourceWorldState = world.sourceWorld === null || world.sourceWorld === undefined
      ? null : sourceWorldSnapshot(world.sourceWorld);
    if (persisted !== undefined) {
      this.#revision = persisted.revision;
      this.#battleSequence = persisted.battleSequence;
      this.#battleId = persisted.battleId;
      this.#battleState = persisted.battleState;
      this.#activeEncounter = persisted.activeEncounter ?? null;
      this.#duelChallenge = persisted.duelChallenge ?? null;
      this.#activeDuel = persisted.activeDuel ?? false;
      this.#battleParticipation = persisted.battleParticipation ?? null;
      this.#battleJoinProposal = persisted.battleJoinProposal ?? null;
      this.#battleJoinRefusal = persisted.battleJoinRefusal ?? null;
      this.#battleObserverIds = persisted.battleObserverIds ?? [];
      this.#battleLedger = persisted.battleLedger === null || persisted.battleLedger === undefined
        || persisted.battleState === null ? null : restoreSharedBattleLedger(persisted.battleLedger, persisted.battleState);
      this.#sourceBattleContext = persisted.sourceBattleContext ?? null;
      if (persisted.battleSession !== undefined && persisted.battleSession !== null) {
        this.#battleSession = persisted.battleSession;
      } else if (persisted.battleId !== null && persisted.battleState !== null) {
        const owner = persisted.battleParticipation?.battleOwnerId
          ?? persisted.players.find((candidate) => candidate.side === "player")?.playerId ?? "player";
        let session = createSharedBattleSession({ battleId: persisted.battleId,
          origin: persisted.activeDuel === true ? "player-duel" : "room-encounter",
          narrativeOwnerId: owner, allowJoin: persisted.activeEncounter !== null && persisted.battleState.turn === 1 });
        if (persisted.battleState.status === "finished") {
          if (session.lifecycle === "join-window") session = activateSharedBattleSession(session);
          session = settleSharedBattleSession(session, persisted.battleState);
        }
        this.#battleSession = session;
      }
      this.#worldState = persisted.worldState;
      this.#sourceWorldState = persisted.sourceWorldState === null ? null
        : { ...persisted.sourceWorldState, followers: persisted.sourceWorldState.followers ?? {},
          presence: persisted.sourceWorldState.presence ?? { player: "shared", opponent: "shared" } };
      this.#sourceSceneState = persisted.sourceSceneState ?? null;
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
    if (side === "opponent" && this.#sourceWorldState !== null) {
      const current = this.#sourceWorldState;
      const hostState: SourceWorldHostState = { mapId: current.mapId, width: current.width, height: current.height,
        passages: current.passages, blockedPoints: current.blockedPoints, host: current.avatars.player,
        follower: current.followers.player ?? null, story: current.story };
      this.#sourceWorldState = { ...current,
        avatars: { ...current.avatars, opponent: this.sourceSpawn(hostState) } };
    }
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
      if (this.#duelChallenge?.challenger === player.side || this.#duelChallenge?.challenged === player.side) {
        this.#duelChallenge = null;
      }
      if (this.#battleJoinProposal?.requiredApprovals.includes(player.playerId)) this.#battleJoinProposal = null;
      this.#revision += 1;
    }
    return this.snapshot();
  }

  public snapshot(): RoomSnapshot {
    const players: RoomPlayerSnapshot[] = [...this.#players.values()]
      .sort((left, right) => left.side === "player" ? -1 : right.side === "player" ? 1 : 0)
      .map(({ playerId, side, ready, connected, profile }) => ({ playerId, side, ready, connected, profile }));
    const phase = this.#battleState === null ? "waiting" : this.#battleState.status === "finished" ? "finished" : "battle";
    const battle = this.#battleState === null || this.#battleId === null ? null
      : { id: this.#battleId, state: this.#battleState, duel: this.#activeDuel,
        participation: this.#battleParticipation, joinProposal: this.#battleJoinProposal,
        joinRefusal: this.#battleJoinRefusal,
        observerIds: this.#battleObserverIds, ledger: this.#battleLedger,
        session: this.#battleSession!, sourceContext: this.#sourceBattleContext };
    return {
      revision: this.#revision,
      roomCode: this.#roomCode,
      phase,
      players,
      battle,
      duelChallenge: this.#duelChallenge === null ? null : {
        challenger: this.#duelChallenge.challenger, challenged: this.#duelChallenge.challenged,
      },
      world: this.#worldState,
      sourceWorld: this.#sourceWorldState,
      sourceScene: this.#sourceSceneState,
      movementSequences: {
        player: this.#movementSequences.get("player") ?? 0,
        opponent: this.#movementSequences.get("opponent") ?? 0,
      },
    };
  }

  public exportState(): PersistedRoomState {
    return {
      version: 11,
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
      sourceWorldState: this.#sourceWorldState,
      sourceSceneState: this.#sourceSceneState,
      movementSequences: [...this.#movementSequences.entries()],
      activeEncounter: this.#activeEncounter,
      duelChallenge: this.#duelChallenge,
      activeDuel: this.#activeDuel,
      battleParticipation: this.#battleParticipation,
      battleJoinProposal: this.#battleJoinProposal,
      battleJoinRefusal: this.#battleJoinRefusal,
      battleObserverIds: this.#battleObserverIds,
      battleLedger: this.#battleLedger,
      battleSession: this.#battleSession,
      sourceBattleContext: this.#sourceBattleContext,
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
    if (message.type === "setSourceWorld") return this.setSourceWorld(player, message.requestId, message.world);
    if (message.type === "setSourcePresence") return this.setSourcePresence(player, message.requestId,
      message.attached, message.avatar);
    if (message.type === "setSourceFollower") {
      return this.setSourceFollower(player, message.requestId, message.species, message.appearance);
    }
    if (message.type === "setSourceScene") return this.setSourceScene(player, message.requestId, message.scene);
    if (message.type === "openSourceBattle") return this.openSourceBattle(player, message);
    if (message.type === "moveAvatar") return this.moveAvatar(player, message);
    if (message.type === "interact") return this.interact(player, message.requestId);
    if (message.type === "challengePlayer") return this.challengePlayer(player, message.requestId, message.team);
    if (message.type === "respondPlayerChallenge") {
      return this.respondPlayerChallenge(player, message.requestId, message.accept, message.team);
    }
    if (message.type === "proposeBattleJoin") return this.proposeBattleJoin(player, message);
    if (message.type === "respondBattleJoin") {
      return this.respondBattleJoin(player, message.requestId, message.battleId, message.accept);
    }
    if (message.type === "observeBattle") return this.observeBattle(player, message.requestId, message.battleId);
    if (message.type === "closeBattleJoinWindow") {
      return this.closeBattleJoinWindow(player, message.requestId, message.battleId);
    }
    if (message.type === "leaveBattle") return this.leaveBattle(player, message.requestId, message.battleId);
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

  private setSourceWorld(player: RoomPlayer, requestId: string, world: SourceWorldHostState): readonly RoomDispatch[] {
    if (player.side !== "player") {
      return [this.error(player.playerId, requestId, "HOST_ONLY", "Seul l'hôte peut publier la carte narrative.")];
    }
    const sameMap = this.#sourceWorldState?.mapId === world.mapId;
    const previousGuest = sameMap ? this.#sourceWorldState?.avatars.opponent : undefined;
    const nextWorld = sourceWorldSnapshot(world, this.sourceSpawn(world, previousGuest));
    const previousGuestFollower = this.#sourceWorldState?.followers.opponent;
    // Un changement de carte de l'hote ne deplace jamais l'invite. Celui-ci reste
    // sur sa carte locale jusqu'a ce que les deux mapId coincident de nouveau.
    const guestPresence = sameMap ? this.#sourceWorldState?.presence.opponent ?? "shared" : "away";
    const withPresence = { ...nextWorld, presence: { ...nextWorld.presence, opponent: guestPresence } };
    this.#sourceWorldState = previousGuestFollower === undefined ? withPresence : { ...withPresence,
      followers: { ...withPresence.followers, opponent: sameMap ? previousGuestFollower
        : { ...this.sourceFollowerSpawn(withPresence, "opponent", previousGuestFollower.species),
          ...(previousGuestFollower.appearance === undefined ? {} : { appearance: previousGuestFollower.appearance }) } } };
    if (!sameMap) this.#sourceSceneState = null;
    this.#revision += 1;
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, requestId) },
      { audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
    ];
  }

  private setSourcePresence(player: RoomPlayer, requestId: string, attached: boolean,
    avatar: SourceAvatarSnapshot | null): readonly RoomDispatch[] {
    const world = this.#sourceWorldState;
    if (player.side !== "opponent") {
      return [this.error(player.playerId, requestId, "HOST_ONLY", "L'hote reste toujours sur sa carte partagee.")];
    }
    if (world === null) {
      return [this.error(player.playerId, requestId, "INVALID_PHASE", "Aucune carte narrative partagee.")];
    }
    const joinAvatar = attached && avatar !== null ? this.sourceJoinPoint(world, avatar) : null;
    if (attached && joinAvatar === null) {
      return [this.error(player.playerId, requestId, "INTERACTION_UNAVAILABLE", "Point de retour sur la carte partagee invalide.")];
    }
    const nextAvatar = attached ? joinAvatar! : world.avatars.opponent;
    const guestFollower = world.followers.opponent;
    this.#sourceWorldState = { ...world,
      avatars: { ...world.avatars, opponent: nextAvatar },
      followers: guestFollower === undefined ? world.followers : { ...world.followers,
        opponent: { ...this.sourceFollowerSpawn({ ...world, avatars: { ...world.avatars, opponent: nextAvatar } },
          "opponent", guestFollower.species),
        ...(guestFollower.appearance === undefined ? {} : { appearance: guestFollower.appearance }) } },
      presence: { ...world.presence, opponent: attached ? "shared" : "away" } };
    this.#revision += 1;
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, requestId) },
      { audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
    ];
  }

  private setSourceFollower(player: RoomPlayer, requestId: string, species: string | null,
    appearance?: SourceFollowerSnapshot["appearance"]): readonly RoomDispatch[] {
    const world = this.#sourceWorldState;
    if (world === null) {
      return [this.error(player.playerId, requestId, "INVALID_PHASE", "Aucune carte narrative partagee.")];
    }
    const followers: Partial<Record<BattleSide, SourceFollowerSnapshot>> = { ...world.followers };
    if (species === null) delete followers[player.side];
    else followers[player.side] = { ...this.sourceFollowerSpawn(world, player.side, species),
      ...(appearance === undefined ? {} : { appearance }) };
    this.#sourceWorldState = { ...world, followers };
    this.#revision += 1;
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, requestId) },
      { audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
    ];
  }

  private setSourceScene(player: RoomPlayer, requestId: string, scene: SourceSceneSnapshot): readonly RoomDispatch[] {
    if (player.side !== "player") {
      return [this.error(player.playerId, requestId, "HOST_ONLY", "Seul l'hote peut publier la cinematique narrative.")];
    }
    if (this.#sourceWorldState === null || scene.mapId !== this.#sourceWorldState.mapId) {
      return [this.error(player.playerId, requestId, "INVALID_PHASE", "La cinematique ne correspond pas a la carte partagee.")];
    }
    this.#sourceSceneState = scene;
    this.#revision += 1;
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, requestId) },
      { audience: "all", message: { type: "sourceSceneUpdated", version: PROTOCOL_VERSION,
        revision: this.#revision, state: scene } },
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
      const owner = [...this.#players.values()].find((candidate) => candidate.side === "player")?.playerId ?? player.playerId;
      this.#battleSession = createSharedBattleSession({ battleId: this.#battleId,
        origin: "room-encounter", narrativeOwnerId: owner, allowJoin: false });
      this.#battleObserverIds = [];
      this.#battleJoinRefusal = null;
      this.#sourceBattleContext = null;
      this.#revision += 1;
    }
    output.push({ audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } });
    return output;
  }

  private submitAction(player: RoomPlayer, message: Extract<ClientMessage, { readonly type: "submitAction" }>): readonly RoomDispatch[] {
    if (this.#activeEncounter !== null || this.#sourceBattleContext !== null) return this.submitEncounterAction(player, message);
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
    if (result.state.status === "finished" && this.#battleSession !== null) {
      this.#battleSession = settleSharedBattleSession(this.#battleSession, result.state);
    }
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
    const source = this.#sourceBattleContext;
    if (encounter === null && source === null || this.#battleState === null || this.#battleId === null
      || this.#battleState.status !== "active") {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Aucune rencontre active.")];
    }
    if (message.battleId !== this.#battleId) return [this.error(player.playerId, message.requestId, "STALE_BATTLE", "Identifiant de combat périmé.")];
    if (message.turn !== this.#battleState.turn) return [this.error(player.playerId, message.requestId, "STALE_TURN", "Numéro de tour périmé.")];
    if (this.#battleJoinProposal !== null) {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "La proposition de participation doit d'abord être traitée.")];
    }
    const controlledSide = (["player", "opponent"] as const).find((side) => this.#battleParticipation === null
      ? encounter !== null && side === encounter.ownerSide && player.side === encounter.ownerSide
      : activeBattleController(this.#battleParticipation, side) === player.playerId);
    if (controlledSide === undefined) {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Le Pokémon actif appartient à l'autre Dresseur.")];
    }
    if (this.#battleSession?.lifecycle === "join-window") {
      this.#battleSession = activateSharedBattleSession(this.#battleSession);
    }
    if (this.#pendingActions.has(controlledSide)) {
      return [this.error(player.playerId, message.requestId, "ACTION_ALREADY_SUBMITTED", "Une action est déjà enregistrée pour ce camp.")];
    }

    const battleId = this.#battleId;
    this.#pendingActions.set(controlledSide, message.action);
    for (const side of ["player", "opponent"] as const) {
      if (this.#pendingActions.has(side)) continue;
      if (this.#battleParticipation === null || activeBattleController(this.#battleParticipation, side) === null) {
        this.#pendingActions.set(side, { kind: "move", moveIndex: 0 });
      }
    }
    this.#revision += 1;
    const output: RoomDispatch[] = [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, message.requestId) },
    ];
    const playerAction = this.#pendingActions.get("player");
    const opponentAction = this.#pendingActions.get("opponent");
    if (playerAction === undefined || opponentAction === undefined) return output;
    const resolvedTurn = this.#battleState.turn;
    const beforeState = this.#battleState;
    const result = resolveTeamTurn(this.#battleState, { player: playerAction, opponent: opponentAction }, this.#rng);
    this.#battleState = result.state;
    if (this.#battleLedger !== null) {
      this.#battleLedger = recordSharedBattleTurn(this.#battleLedger, beforeState, result.state, result.events);
    }
    this.synchronizeBattleParticipation();
    this.#pendingActions.clear();
    this.#revision += 1;
    output.push({ audience: "all", message: { type: "turnResolved", version: PROTOCOL_VERSION,
      battleId, turn: resolvedTurn, state: result.state, events: result.events } });

    if (result.state.status === "finished" && result.state.winner !== null && source !== null) {
      if (this.#battleSession === null) throw new Error("Session de combat source absente.");
      this.#battleSession = settleSharedBattleSession(this.#battleSession, result.state);
      this.#revision += 1;
    } else if (result.state.status === "finished" && result.state.winner !== null && encounter !== null) {
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
      this.#battleParticipation = null;
      this.#battleJoinProposal = null;
      this.#battleObserverIds = [];
      this.#battleJoinRefusal = null;
      this.#battleLedger = null;
      this.#battleSession = null;
      this.#sourceBattleContext = null;
      this.#battleState = null;
      this.#battleId = null;
      for (const roomPlayer of this.#players.values()) roomPlayer.ready = false;
      this.#revision += 1;
    }
    output.push({ audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } });
    return output;
  }

  private moveAvatar(player: RoomPlayer, message: Extract<ClientMessage, { readonly type: "moveAvatar" }>): readonly RoomDispatch[] {
    if (this.#activeDuel || this.#duelChallenge !== null
      || (this.#activeEncounter !== null || this.#sourceBattleContext !== null) && this.#battleState?.status === "active") {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Les déplacements sont verrouillés pendant la rencontre.")];
    }
    const previousSequence = this.#movementSequences.get(player.side) ?? 0;
    if (message.sequence <= previousSequence) {
      return [this.error(player.playerId, message.requestId, "STALE_MOVEMENT", "Intention de mouvement périmée.")];
    }
    if (this.#sourceWorldState !== null) return this.moveSourceAvatar(player, message);
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

  private moveSourceAvatar(player: RoomPlayer,
    message: Extract<ClientMessage, { readonly type: "moveAvatar" }>): readonly RoomDispatch[] {
    const world = this.#sourceWorldState;
    if (world === null) return [];
    if (world.presence[player.side] === "away") {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Le joueur est en excursion personnelle.")];
    }
    const avatar = world.avatars[player.side];
    const otherSide: BattleSide = player.side === "player" ? "opponent" : "player";
    const other = world.presence[otherSide] === "shared" ? world.avatars[otherSide] : undefined;
    const otherFollower = world.presence[otherSide] === "shared" ? world.followers[otherSide] : undefined;
    const resolution = resolveSourceMovement(world, avatar, { direction: message.direction,
      ...(message.mode === undefined ? {} : { mode: message.mode }),
      ...(message.waterfall === undefined ? {} : { waterfall: message.waterfall }) },
    [...(other === undefined ? [] : [other]), ...(otherFollower === undefined ? [] : [otherFollower])]);
    const next: SourceAvatarSnapshot = resolution.avatar;
    const currentFollower = world.followers[player.side];
    let nextFollower: SourceFollowerSnapshot | undefined = currentFollower;
    if (resolution.moved && currentFollower !== undefined) {
      const followerDirection = avatar.x < currentFollower.x ? "left" : avatar.x > currentFollower.x ? "right"
        : avatar.y < currentFollower.y ? "up" : avatar.y > currentFollower.y ? "down" : message.direction;
      nextFollower = { ...currentFollower, x: avatar.x, y: avatar.y, direction: followerDirection };
    }
    this.#sourceWorldState = { ...world, avatars: { ...world.avatars, [player.side]: next },
      followers: nextFollower === undefined ? world.followers : { ...world.followers, [player.side]: nextFollower } };
    this.#movementSequences.set(player.side, message.sequence);
    this.#revision += 1;
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, message.requestId) },
      { audience: "all", message: { type: "sourceWorldUpdated", version: PROTOCOL_VERSION,
        side: player.side, sequence: message.sequence, revision: this.#revision, state: this.#sourceWorldState } },
    ];
  }

  private sourceSpawn(world: SourceWorldHostState, preferred?: SourceAvatarSnapshot): SourceAvatarSnapshot {
    const candidates = preferred === undefined ? [] : [preferred];
    candidates.push(...(["down", "left", "right", "up"] as const).map((direction) => ({
      x: world.host.x + SOURCE_DELTAS[direction].x, y: world.host.y + SOURCE_DELTAS[direction].y,
      direction: SOURCE_OPPOSITE[direction],
    })));
    for (const candidate of candidates) {
      if (candidate.x < 0 || candidate.y < 0 || candidate.x >= world.width || candidate.y >= world.height) continue;
      if (world.blockedPoints.some((point) => point.x === candidate.x && point.y === candidate.y)) continue;
      const mask = Number.parseInt(world.passages[candidate.y * world.width + candidate.x] ?? "0", 16);
      if (mask !== 0 && (candidate.x !== world.host.x || candidate.y !== world.host.y)) return candidate;
    }
    return world.host;
  }

  private sourceJoinAvailable(world: SourceWorldSnapshot, avatar: SourceAvatarSnapshot): boolean {
    if (avatar.x < 0 || avatar.y < 0 || avatar.x >= world.width || avatar.y >= world.height) return false;
    if (world.blockedPoints.some((point) => point.x === avatar.x && point.y === avatar.y)) return false;
    const mask = Number.parseInt(world.passages[avatar.y * world.width + avatar.x] ?? "0", 16);
    if (mask === 0) return false;
    const host = world.avatars.player;
    const hostFollower = world.followers.player;
    return (host.x !== avatar.x || host.y !== avatar.y)
      && (hostFollower === undefined || hostFollower.x !== avatar.x || hostFollower.y !== avatar.y);
  }

  private sourceJoinPoint(world: SourceWorldSnapshot, preferred: SourceAvatarSnapshot): SourceAvatarSnapshot | null {
    const candidates = [preferred, ...(["down", "left", "right", "up"] as const).map((direction) => ({
      x: world.avatars.player.x + SOURCE_DELTAS[direction].x,
      y: world.avatars.player.y + SOURCE_DELTAS[direction].y,
      direction: SOURCE_OPPOSITE[direction],
    }))];
    return candidates.find((candidate) => this.sourceJoinAvailable(world, candidate)) ?? null;
  }

  private sourceFollowerSpawn(world: SourceWorldSnapshot, side: BattleSide, species: string): SourceFollowerSnapshot {
    const avatar = world.avatars[side];
    const preferredDirection = SOURCE_OPPOSITE[avatar.direction];
    const directions = [preferredDirection, "left", "right", "up", "down"] as const;
    for (const direction of directions) {
      const delta = SOURCE_DELTAS[direction];
      const x = avatar.x + delta.x;
      const y = avatar.y + delta.y;
      if (x < 0 || y < 0 || x >= world.width || y >= world.height) continue;
      const mask = Number.parseInt(world.passages[y * world.width + x] ?? "0", 16);
      if (mask !== 0) return { species, x, y, direction: avatar.direction };
    }
    return { species, ...avatar };
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
      this.#battleParticipation = {
        battleOwnerId: player.playerId,
        format: "single",
        camps: {
          player: { trainerIds: [player.playerId], members: this.#battleState.teams.player.members.map((battler) => ({
            ownerId: player.playerId, battler })),
          activeMemberId: this.#battleState.teams.player.members[this.#battleState.teams.player.activeIndex]!.id },
          opponent: { trainerIds: [], members: this.#battleState.teams.opponent.members.map((battler) => ({
            ownerId: null, battler })),
          activeMemberId: this.#battleState.teams.opponent.members[this.#battleState.teams.opponent.activeIndex]!.id },
        },
      };
      this.#battleJoinProposal = null;
      this.#battleObserverIds = [];
      this.#battleJoinRefusal = null;
      this.#battleLedger = createSharedBattleLedger(this.#battleState);
      const guestAvailable = [...this.#players.values()].some((candidate) => candidate.playerId !== player.playerId
        && candidate.connected);
      this.#battleSession = createSharedBattleSession({ battleId: this.#battleId,
        origin: "room-encounter", narrativeOwnerId: player.playerId, allowJoin: guestAvailable });
      this.#sourceBattleContext = null;
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

  private challengePlayer(player: RoomPlayer, requestId: string, team: BattleTeam): readonly RoomDispatch[] {
    if (this.#battleState !== null || this.#duelChallenge !== null) {
      return [this.error(player.playerId, requestId, "INVALID_PHASE", "Un combat ou un défi est déjà en cours.")];
    }
    const otherSide: BattleSide = player.side === "player" ? "opponent" : "player";
    const other = [...this.#players.values()].find((candidate) => candidate.side === otherSide);
    const world = this.#sourceWorldState;
    if (other === undefined || !other.connected || world === null
      || world.presence[player.side] !== "shared" || world.presence[otherSide] !== "shared") {
      return [this.error(player.playerId, requestId, "INTERACTION_UNAVAILABLE", "L'autre joueur n'est pas disponible sur cette carte.")];
    }
    const avatar = world.avatars[player.side];
    const target = world.avatars[otherSide];
    const delta = SOURCE_DELTAS[avatar.direction];
    if (avatar.x + delta.x !== target.x || avatar.y + delta.y !== target.y) {
      return [this.error(player.playerId, requestId, "INTERACTION_UNAVAILABLE", "Placez-vous face à l'autre joueur pour le défier.")];
    }
    this.#duelChallenge = { challenger: player.side, challenged: otherSide, team };
    this.#revision += 1;
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, requestId) },
      { audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
    ];
  }

  private proposeBattleJoin(player: RoomPlayer,
    message: Extract<ClientMessage, { readonly type: "proposeBattleJoin" }>): readonly RoomDispatch[] {
    if (this.#battleId !== message.battleId || this.#battleState === null
      || this.#activeEncounter === null && this.#sourceBattleContext === null
      || this.#battleParticipation === null || this.#battleState.status !== "active" || this.#battleState.turn !== 1
      || this.#battleJoinProposal !== null
      || this.#activeDuel || this.#pendingActions.size > 0 || this.#battleSession?.lifecycle !== "join-window") {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Ce combat n'accepte plus de participant.")];
    }
    if (player.playerId === this.#battleParticipation.battleOwnerId) {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Le meneur participe déjà à ce combat.")];
    }
    if (this.#battleObserverIds.includes(player.playerId)) {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Ce joueur a choisi d'observer ce combat.")];
    }
    if (!player.connected || this.#sourceBattleContext !== null && (this.#sourceWorldState === null
      || this.#sourceWorldState.mapId !== this.#sourceBattleContext.mapId
      || this.#sourceWorldState.presence[player.side] !== "shared")) {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE",
        "L'invite doit etre present sur la carte partagee pour rejoindre le combat.")];
    }
    try {
      this.#battleJoinProposal = proposeBattleJoin(this.#battleParticipation, {
        joinerId: player.playerId,
        side: message.side,
        members: message.team.members,
        finalMemberIds: message.finalMemberIds,
      });
      this.#battleJoinRefusal = null;
    } catch (error) {
      return [this.error(player.playerId, message.requestId, "INVALID_MESSAGE",
        error instanceof Error ? error.message : "Proposition de composition invalide.")];
    }
    this.#revision += 1;
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, message.requestId) },
      { audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
    ];
  }

  private openSourceBattle(player: RoomPlayer,
    message: Extract<ClientMessage, { readonly type: "openSourceBattle" }>): readonly RoomDispatch[] {
    const world = this.#sourceWorldState;
    if (player.side !== "player") {
      return [this.error(player.playerId, message.requestId, "HOST_ONLY", "Seul l'hote peut ouvrir un combat narratif.")];
    }
    if (world === null || world.mapId !== message.context.mapId || world.presence.player !== "shared") {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Le combat ne correspond pas au monde partage.")];
    }
    if (this.#battleState !== null || this.#duelChallenge !== null || message.context.narrativeOwnerId !== player.playerId) {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Un combat ou un defi est deja en cours.")];
    }
    if (message.context.format !== "single") {
      return [this.error(player.playerId, message.requestId, "INVALID_MESSAGE", "Les combats source doubles ne sont pas encore pris en charge.")];
    }
    const rewardById = new Map(message.context.rewards.opponents.map((opponent) => [opponent.memberId, opponent]));
    if (rewardById.size !== message.opponentTeam.members.length
      || message.opponentTeam.members.some((member) => {
        const reward = rewardById.get(member.id);
        return reward === undefined || reward.species !== member.species || reward.level !== member.level;
      })) {
      return [this.error(player.playerId, message.requestId, "INVALID_MESSAGE", "Le manifeste de recompense ne correspond pas aux adversaires.")];
    }
    try {
      this.#battleState = createTeamBattleState({ player: message.playerTeam.members,
        opponent: message.opponentTeam.members }, { player: message.playerTeam.activeIndex,
        opponent: message.opponentTeam.activeIndex });
      this.#battleSequence += 1;
      this.#battleId = `${this.#roomCode}-${this.#battleSequence}`;
      this.#battleParticipation = { battleOwnerId: player.playerId, format: message.context.format, camps: {
        player: { trainerIds: [player.playerId], members: this.#battleState.teams.player.members.map((battler) => ({
          ownerId: player.playerId, battler })), activeMemberId: this.#battleState.teams.player.members[this.#battleState.teams.player.activeIndex]!.id },
        opponent: { trainerIds: [], members: this.#battleState.teams.opponent.members.map((battler) => ({
          ownerId: null, battler })), activeMemberId: this.#battleState.teams.opponent.members[this.#battleState.teams.opponent.activeIndex]!.id },
      } };
      this.#battleLedger = createSharedBattleLedger(this.#battleState);
      this.#battleJoinProposal = null;
      this.#battleObserverIds = [];
      this.#battleJoinRefusal = null;
      this.#sourceBattleContext = message.context;
      const guestAvailable = [...this.#players.values()].some((candidate) => candidate.side === "opponent"
        && candidate.connected && world.presence.opponent === "shared");
      this.#battleSession = createSharedBattleSession({ battleId: this.#battleId,
        origin: message.context.origin, narrativeOwnerId: player.playerId, allowJoin: guestAvailable });
      this.#activeEncounter = null;
      this.#activeDuel = false;
      this.#pendingActions.clear();
      this.#pendingReplacements.clear();
    } catch (error) {
      this.#battleState = null;
      this.#battleId = null;
      this.#battleParticipation = null;
      this.#battleObserverIds = [];
      this.#battleJoinRefusal = null;
      this.#battleLedger = null;
      this.#battleSession = null;
      this.#sourceBattleContext = null;
      return [this.error(player.playerId, message.requestId, "INVALID_MESSAGE",
        error instanceof Error ? error.message : "Combat source invalide.")];
    }
    this.#revision += 1;
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, message.requestId) },
      { audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
    ];
  }

  private respondBattleJoin(player: RoomPlayer, requestId: string, battleId: string,
    accept: boolean): readonly RoomDispatch[] {
    if (this.#battleId !== battleId || this.#battleState === null || this.#battleParticipation === null
      || this.#battleSession?.lifecycle !== "join-window"
      || this.#battleJoinProposal === null) {
      return [this.error(player.playerId, requestId, "INVALID_PHASE", "Aucune proposition de participation active.")];
    }
    if (!this.#battleJoinProposal.requiredApprovals.includes(player.playerId)
      || this.#battleJoinProposal.joinerId === player.playerId) {
      return [this.error(player.playerId, requestId, "UNAUTHORIZED", "Ce joueur ne peut pas répondre à cette proposition.")];
    }
    if (!accept) {
      this.#battleJoinRefusal = { playerId: this.#battleJoinProposal.joinerId,
        reason: "La composition a ete refusee par l'hote." };
      this.#battleJoinProposal = null;
    } else {
      try {
        const approved = approveBattleJoin(this.#battleJoinProposal, player.playerId);
        const participation = applyBattleJoin(this.#battleParticipation, approved);
        const teams: Record<BattleSide, readonly BattlerState[]> = {
          player: participation.camps.player.members.map((member) => member.battler),
          opponent: participation.camps.opponent.members.map((member) => member.battler),
        };
        const activeIndices: Record<BattleSide, number> = {
          player: Math.max(0, participation.camps.player.members.findIndex((member) => member.battler.id
            === participation.camps.player.activeMemberId)),
          opponent: Math.max(0, participation.camps.opponent.members.findIndex((member) => member.battler.id
            === participation.camps.opponent.activeMemberId)),
        };
        this.#battleParticipation = participation;
        this.#battleState = createTeamBattleState(teams, activeIndices);
        this.#battleLedger = createSharedBattleLedger(this.#battleState);
        this.#battleJoinProposal = null;
        this.#battleJoinRefusal = null;
      } catch (error) {
        return [this.error(player.playerId, requestId, "INVALID_MESSAGE",
          error instanceof Error ? error.message : "Accord de participation invalide.")];
      }
    }
    this.#revision += 1;
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, requestId) },
      { audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
    ];
  }

  private observeBattle(player: RoomPlayer, requestId: string, battleId: string): readonly RoomDispatch[] {
    if (this.#battleId !== battleId || this.#battleState === null || this.#battleParticipation === null
      || this.#battleSession?.lifecycle !== "join-window") {
      return [this.error(player.playerId, requestId, "INVALID_PHASE", "La fenetre de participation est fermee.")];
    }
    if (this.#battleParticipation.camps.player.trainerIds.includes(player.playerId)
      || this.#battleParticipation.camps.opponent.trainerIds.includes(player.playerId)) {
      return [this.error(player.playerId, requestId, "INVALID_PHASE", "Ce joueur participe deja au combat.")];
    }
    if (this.#battleJoinProposal?.joinerId === player.playerId) {
      return [this.error(player.playerId, requestId, "INVALID_PHASE",
        "La proposition de participation doit d'abord etre traitee.")];
    }
    if (this.#sourceBattleContext !== null && (this.#sourceWorldState === null
      || this.#sourceWorldState.mapId !== this.#sourceBattleContext.mapId
      || this.#sourceWorldState.presence[player.side] !== "shared")) {
      return [this.error(player.playerId, requestId, "INVALID_PHASE",
        "L'invite doit etre present sur la carte partagee pour observer ce combat.")];
    }
    if (!this.#battleObserverIds.includes(player.playerId)) {
      this.#battleObserverIds = [...this.#battleObserverIds, player.playerId];
      this.#battleJoinRefusal = null;
      this.#revision += 1;
    }
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, requestId) },
      { audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
    ];
  }

  private closeBattleJoinWindow(player: RoomPlayer, requestId: string,
    battleId: string): readonly RoomDispatch[] {
    if (this.#battleId !== battleId || this.#battleSession?.lifecycle !== "join-window") {
      return [this.error(player.playerId, requestId, "INVALID_PHASE", "La fenetre de participation est deja fermee.")];
    }
    if (this.#battleSession.narrativeOwnerId !== player.playerId) {
      return [this.error(player.playerId, requestId, "HOST_ONLY", "Seul l'hote peut fermer cette fenetre.")];
    }
    if (this.#battleJoinProposal !== null) {
      return [this.error(player.playerId, requestId, "INVALID_PHASE",
        "La proposition de participation doit d'abord etre acceptee ou refusee.")];
    }
    this.#battleSession = activateSharedBattleSession(this.#battleSession);
    this.#revision += 1;
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, requestId) },
      { audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
    ];
  }

  private respondPlayerChallenge(player: RoomPlayer, requestId: string, accept: boolean,
    team: BattleTeam | null): readonly RoomDispatch[] {
    const challenge = this.#duelChallenge;
    const mayRespond = challenge !== null && (player.side === challenge.challenged
      || !accept && player.side === challenge.challenger);
    if (challenge === null || !mayRespond) {
      return [this.error(player.playerId, requestId, "INVALID_PHASE", "Ce défi n'est plus disponible.")];
    }
    if (accept && team === null) {
      return [this.error(player.playerId, requestId, "INVALID_MESSAGE", "Une équipe est requise pour accepter le défi.")];
    }
    this.#duelChallenge = null;
    if (accept && team !== null) {
      const teams: Record<BattleSide, readonly BattlerState[]> = challenge.challenger === "player"
        ? { player: challenge.team.members, opponent: team.members }
        : { player: team.members, opponent: challenge.team.members };
      const activeIndices = challenge.challenger === "player"
        ? { player: challenge.team.activeIndex, opponent: team.activeIndex }
        : { player: team.activeIndex, opponent: challenge.team.activeIndex };
      this.#battleState = createTeamBattleState(teams, activeIndices);
      this.#activeDuel = true;
      this.#battleParticipation = null;
      this.#battleJoinProposal = null;
      this.#battleObserverIds = [];
      this.#battleJoinRefusal = null;
      this.#battleSequence += 1;
      this.#battleId = `${this.#roomCode}-${this.#battleSequence}`;
      const owner = [...this.#players.values()].find((candidate) => candidate.side === challenge.challenger)?.playerId
        ?? player.playerId;
      this.#battleSession = createSharedBattleSession({ battleId: this.#battleId,
        origin: "player-duel", narrativeOwnerId: owner, allowJoin: false });
      this.#sourceBattleContext = null;
      this.#pendingActions.clear();
      this.#pendingReplacements.clear();
      for (const roomPlayer of this.#players.values()) roomPlayer.ready = false;
    }
    this.#revision += 1;
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, requestId) },
      { audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
    ];
  }

  private leaveBattle(player: RoomPlayer, requestId: string, battleId: string): readonly RoomDispatch[] {
    if (this.#battleId !== battleId || this.#battleState?.status !== "finished" || !this.#activeDuel) {
      return [this.error(player.playerId, requestId, "INVALID_PHASE", "Ce combat ne peut pas être quitté.")];
    }
    if (this.#battleSession !== null) this.#battleSession = closeSharedBattleSession(this.#battleSession);
    this.#battleState = null;
    this.#battleId = null;
    this.#activeDuel = false;
    this.#battleParticipation = null;
    this.#battleJoinProposal = null;
    this.#battleObserverIds = [];
    this.#battleJoinRefusal = null;
    this.#battleLedger = null;
    this.#battleSession = null;
    this.#sourceBattleContext = null;
    this.#pendingActions.clear();
    this.#pendingReplacements.clear();
    this.#revision += 1;
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, requestId) },
      { audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
    ];
  }

  private submitReplacement(player: RoomPlayer, message: Extract<ClientMessage, { readonly type: "submitReplacement" }>): readonly RoomDispatch[] {
    if (this.#battleState === null || this.#battleId === null || this.#battleState.status !== "active") {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Aucun combat actif.")];
    }
    if (message.battleId !== this.#battleId) return [this.error(player.playerId, message.requestId, "STALE_BATTLE", "Identifiant de combat périmé.")];
    if (message.turn !== this.#battleState.turn) return [this.error(player.playerId, message.requestId, "STALE_TURN", "Numéro de tour périmé.")];
    const battleSide = this.#battleParticipation === null ? player.side
      : (["player", "opponent"] as const).find((side) => this.#battleParticipation!.camps[side].trainerIds.includes(player.playerId));
    if (battleSide === undefined || !this.#battleState.replacementRequired.includes(battleSide)) {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Aucun remplacement requis pour ce camp.")];
    }
    const replacementOwner = this.#battleParticipation?.camps[battleSide].members[message.teamIndex]?.ownerId;
    if (this.#battleParticipation !== null && replacementOwner !== player.playerId) {
      return [this.error(player.playerId, message.requestId, "UNAUTHORIZED", "Ce Pokémon appartient à l'autre Dresseur.")];
    }
    if (this.#pendingReplacements.has(battleSide)) {
      return [this.error(player.playerId, message.requestId, "REPLACEMENT_ALREADY_SUBMITTED", "Un remplacement est déjà enregistré.")];
    }
    this.#pendingReplacements.set(battleSide, message.teamIndex);
    this.#revision += 1;
    const output: RoomDispatch[] = [{ audience: { playerId: player.playerId }, message: this.acknowledge(player, message.requestId) }];
    if (!this.#battleState.replacementRequired.every((side) => this.#pendingReplacements.has(side))) return output;

    const replacements = Object.fromEntries(this.#pendingReplacements) as Partial<Record<BattleSide, number>>;
    const beforeState = this.#battleState;
    const result = replaceFaintedPokemon(beforeState, replacements);
    this.#battleState = result.state;
    if (this.#battleLedger !== null) {
      this.#battleLedger = recordSharedBattleTurn(this.#battleLedger, beforeState, result.state, result.events);
    }
    this.synchronizeBattleParticipation();
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

  private synchronizeBattleParticipation(): void {
    if (this.#battleParticipation === null || this.#battleState === null) return;
    const synchronizeCamp = (side: BattleSide): SharedBattleCamp => {
      const team = this.#battleState!.teams[side];
      const camp = this.#battleParticipation!.camps[side];
      return { ...camp, members: team.members.map((battler) => ({
        ownerId: camp.members.find((member) => member.battler.id === battler.id)?.ownerId ?? null,
        battler,
      })), activeMemberId: team.members[team.activeIndex]!.id };
    };
    this.#battleParticipation = { ...this.#battleParticipation,
      camps: { player: synchronizeCamp("player"), opponent: synchronizeCamp("opponent") } };
  }

  private error(playerId: string, requestId: string | null, code: ProtocolErrorCode, message: string): RoomDispatch {
    return { audience: { playerId }, message: { type: "error", version: PROTOCOL_VERSION, requestId, code, message } };
  }
}
