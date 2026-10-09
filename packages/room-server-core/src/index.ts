import { activateSharedBattleSession, activeBattleController, activeBattleControllerAt, activeBattlePositions,
  activeTeamIndices, applyBattleJoin, approveBattleJoin,
  applyPokemonItemEffect,
  battleMemberIndicesOwnedBy,
  canCaptureSharedBattleTarget, canEscapeSourceBattle, chooseSourceBattleAction, chooseSourceBattleReplacement,
  closeSharedBattleSession, createDoubleTeamBattleState, createSharedBattleLedger, createSharedBattleSession,
  createTeamBattleState, openSharedBattleJoinWindow,
  pokemonItemTargetMode, proposeBattleJoin, recordSharedBattleTurn, replacementBattleController, replaceFaintedDoublePokemon, replaceFaintedPokemon,
  resolveDoubleTeamTurn, resolveTeamTurn,
  settleEscapedSharedBattleSession, settleSharedBattleSession,
  sharedBattleOwnerEscapeSettlement, sharedBattleOwnerSettlement,
  type BattleJoinProposal,
  restoreSharedBattleLedger,
  type BattleSide, type BattleTeam, type BattlerState, type PositionedTeamBattleAction,
  type SharedBattleCamp, type SharedBattleLedger,
  type SharedBattleParticipation, type SharedBattleSession, type StatefulRandomSource, type TeamBattleAction,
  type TeamBattleState, type TeamTurnActions } from "@pokemon-z-battle/battle-engine";
import { createDefaultNetworkPlayerProfile, PROTOCOL_VERSION, resolveSourceMovement, sourceWorldSnapshot, type ClientMessage, type NetworkPlayerProfile,
  type ProtocolErrorCode, type RoomPlayerSnapshot, type RoomSnapshot, type ServerMessage, type SourceAvatarSnapshot,
  type SourceBattleContext, type SourceFollowerSnapshot, type SourceSceneSnapshot, type SourceWorldHostState,
  type SourceBattleInventory, type SourceBattleSettlement, type SourceWorldActorSnapshot,
  type SourceWorldSnapshot } from "@pokemon-z-battle/multiplayer-protocol";
import { resolveInteraction, resolveMovement, type EncounterKind, type OverworldCatalog, type OverworldState } from "@pokemon-z-battle/overworld-engine";

interface RoomPlayer {
  readonly playerId: string;
  readonly side: BattleSide;
  ready: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  departed: boolean;
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
  readonly settlement: SourceBattleSettlement | null;
  readonly battleInventory: SourceBattleInventory | null;
  readonly replacedPlayerId?: string;
}

export interface PersistedRoomState {
  readonly version: 9 | 10 | 11 | 12 | 13 | 14 | 15;
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
    readonly disconnectedAt?: number | null;
    readonly departed?: boolean;
    readonly profile: NetworkPlayerProfile;
    readonly acknowledged: readonly (readonly [string, ServerMessage])[];
  }[];
  readonly pendingActions: readonly (readonly [BattleSide, TeamBattleAction])[];
  readonly pendingDoubleActions?: readonly (readonly [string, PositionedTeamBattleAction])[];
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
  readonly battleEscaped?: boolean;
  readonly escapeAttempts?: number;
  readonly escapeConfirmations?: readonly string[];
  readonly pendingBattleSettlements?: readonly SourceBattleSettlement[];
  readonly acknowledgedBattleSettlements?: readonly (readonly [string, string])[];
  readonly battleInventories?: readonly (readonly [string, SourceBattleInventory])[];
  readonly battleConsumedItems?: readonly (readonly [string, SourceBattleInventory])[];
  readonly battleJoinInventory?: readonly [string, SourceBattleInventory] | null;
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
export const PLAYER_RECONNECT_GRACE_MS = 15_000;

function sourceActorObstacles(world: Pick<SourceWorldHostState, "actors">): readonly SourceWorldActorSnapshot[] {
  return (world.actors ?? []).filter((actor) => actor.blocking);
}

function sourcePointBlocked(world: Pick<SourceWorldHostState, "blockedPoints" | "actors">,
  point: { readonly x: number; readonly y: number }): boolean {
  return world.blockedPoints.some((blocked) => blocked.x === point.x && blocked.y === point.y)
    || sourceActorObstacles(world).some((actor) => actor.x === point.x && actor.y === point.y);
}

export class AuthoritativeBattleRoom {
  readonly #players = new Map<string, RoomPlayer>();
  readonly #pendingActions = new Map<BattleSide, TeamBattleAction>();
  readonly #pendingDoubleActions = new Map<string, PositionedTeamBattleAction>();
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
  #battleEscaped = false;
  #escapeAttempts = 0;
  readonly #escapeConfirmations = new Set<string>();
  readonly #pendingBattleSettlements = new Map<string, SourceBattleSettlement>();
  readonly #acknowledgedBattleSettlements = new Map<string, string>();
  readonly #battleInventories = new Map<string, SourceBattleInventory>();
  readonly #battleConsumedItems = new Map<string, SourceBattleInventory>();
  #battleJoinInventory: readonly [string, SourceBattleInventory] | null = null;
  readonly #now: () => number;

  public constructor(roomCode: string, createBattle: (encounter?: EncounterContext) => TeamBattleState,
    rng: StatefulRandomSource, world: RoomWorldDefinition, persisted?: PersistedRoomState,
    now: () => number = Date.now) {
    this.#roomCode = roomCode;
    this.#createBattle = createBattle;
    this.#rng = rng;
    this.#worldCatalog = world.catalog;
    this.#now = now;
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
      this.#battleEscaped = persisted.battleEscaped ?? false;
      this.#escapeAttempts = persisted.escapeAttempts ?? 0;
      for (const playerId of persisted.escapeConfirmations ?? []) this.#escapeConfirmations.add(playerId);
      for (const settlement of persisted.pendingBattleSettlements ?? []) {
        this.#pendingBattleSettlements.set(settlement.settlementId, settlement);
      }
      for (const [settlementId, ownerId] of persisted.acknowledgedBattleSettlements ?? []) {
        this.#acknowledgedBattleSettlements.set(settlementId, ownerId);
      }
      for (const [ownerId, inventory] of persisted.battleInventories ?? []) {
        this.#battleInventories.set(ownerId, inventory);
      }
      for (const [ownerId, inventory] of persisted.battleConsumedItems ?? []) {
        this.#battleConsumedItems.set(ownerId, inventory);
      }
      this.#battleJoinInventory = persisted.battleJoinInventory ?? null;
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
          actors: persisted.sourceWorldState.actors ?? [],
          actorRevision: persisted.sourceWorldState.actorRevision ?? 0,
          presence: persisted.sourceWorldState.presence ?? { player: "shared", opponent: "shared" } };
      this.#sourceSceneState = persisted.sourceSceneState ?? null;
      for (const entry of persisted.players) {
        this.#players.set(entry.playerId, { ...entry, disconnectedAt: entry.disconnectedAt ?? null,
          departed: entry.departed ?? false, acknowledged: new Map(entry.acknowledged) });
      }
      for (const [side, action] of persisted.pendingActions) this.#pendingActions.set(side, action);
      for (const [key, action] of persisted.pendingDoubleActions ?? []) this.#pendingDoubleActions.set(key, action);
      for (const [side, teamIndex] of persisted.pendingReplacements) this.#pendingReplacements.set(side, teamIndex);
      for (const [side, sequence] of persisted.movementSequences) this.#movementSequences.set(side, sequence);
    }
  }

  public reserve(playerId: string, profile: NetworkPlayerProfile = createDefaultNetworkPlayerProfile()): RoomConnection {
    const existing = this.#players.get(playerId);
    if (existing !== undefined) return { side: existing.side, snapshot: this.snapshot(), reconnected: true,
      settlement: this.pendingBattleSettlement(existing.playerId),
      battleInventory: this.#battleInventories.get(existing.playerId) ?? null };
    // A participant marked as definitively gone no longer owns the guest seat.
    // Keep an active battle or an unapplied personal settlement attached to its
    // original identity, but otherwise let a manual join reuse the invitation.
    const replaceableGuest = this.#battleState === null
      ? [...this.#players.values()].find((player) => player.side === "opponent" && player.departed
        && this.pendingBattleSettlement(player.playerId) === null)
      : undefined;
    if (replaceableGuest !== undefined) this.#players.delete(replaceableGuest.playerId);
    const usedSides = new Set([...this.#players.values()].map((player) => player.side));
    const side: BattleSide | undefined = usedSides.has("player") ? (usedSides.has("opponent") ? undefined : "opponent") : "player";
    if (side === undefined) throw new Error("ROOM_FULL");
    this.#players.set(playerId, { playerId, side, ready: false, connected: false,
      disconnectedAt: null, departed: false, profile, acknowledged: new Map() });
    if (side === "opponent" && this.#sourceWorldState !== null) {
      const current = this.#sourceWorldState;
      const hostState: SourceWorldHostState = { mapId: current.mapId, width: current.width, height: current.height,
        passages: current.passages, blockedPoints: current.blockedPoints, actors: current.actors,
        host: current.avatars.player,
        follower: current.followers.player ?? null, story: current.story };
      this.#sourceWorldState = { ...current,
        avatars: { ...current.avatars, opponent: this.sourceSpawn(hostState) } };
    }
    this.#revision += 1;
    return { side, snapshot: this.snapshot(), reconnected: false, settlement: null, battleInventory: null,
      ...(replaceableGuest === undefined ? {} : { replacedPlayerId: replaceableGuest.playerId }) };
  }

  public connect(playerId: string): RoomConnection {
    const existing = this.#players.get(playerId);
    if (existing !== undefined) {
      if (!existing.connected) {
        this.restoreSourceAvatar(existing);
        existing.connected = true;
        existing.disconnectedAt = null;
        existing.departed = false;
        this.#revision += 1;
      }
      return { side: existing.side, snapshot: this.snapshot(), reconnected: true,
        settlement: this.pendingBattleSettlement(existing.playerId),
        battleInventory: this.#battleInventories.get(existing.playerId) ?? null };
    }
    this.reserve(playerId);
    return this.connect(playerId);
  }

  public disconnect(playerId: string): RoomSnapshot {
    const player = this.#players.get(playerId);
    if (player !== undefined && player.connected) {
      this.markPlayerDisconnected(player, false);
    }
    return this.snapshot();
  }

  public nextReconnectExpiry(): number | null {
    const expiries = [...this.#players.values()].flatMap((player) => !player.connected && !player.departed
      && player.disconnectedAt !== null ? [player.disconnectedAt + PLAYER_RECONNECT_GRACE_MS] : []);
    return expiries.length === 0 ? null : Math.min(...expiries);
  }

  public expireDisconnectedPlayers(): RoomSnapshot | null {
    const now = this.#now();
    let changed = false;
    for (const player of this.#players.values()) {
      if (!player.connected && !player.departed && player.disconnectedAt !== null
        && now >= player.disconnectedAt + PLAYER_RECONNECT_GRACE_MS) {
        player.departed = true;
        player.disconnectedAt = null;
        changed = true;
      }
    }
    if (!changed) return null;
    this.#revision += 1;
    return this.snapshot();
  }

  public snapshot(): RoomSnapshot {
    const players: RoomPlayerSnapshot[] = [...this.#players.values()]
      .sort((left, right) => left.side === "player" ? -1 : right.side === "player" ? 1 : 0)
      .map(({ playerId, side, ready, connected, disconnectedAt, departed, profile }) => ({
        playerId, side, ready, connected,
        connectionState: connected ? "connected" as const : departed ? "left" as const : "reconnecting" as const,
        reconnectUntil: !connected && !departed && disconnectedAt !== null
          ? disconnectedAt + PLAYER_RECONNECT_GRACE_MS : null,
        profile,
      }));
    const phase = this.#battleState === null ? "waiting"
      : this.#battleState.status === "finished" || this.#battleEscaped ? "finished" : "battle";
    const battle = this.#battleState === null || this.#battleId === null ? null
      : { id: this.#battleId, state: this.#battleState, duel: this.#activeDuel,
        participation: this.#battleParticipation, joinProposal: this.#battleJoinProposal,
        joinRefusal: this.#battleJoinRefusal,
        observerIds: this.#battleObserverIds, ledger: this.#battleLedger,
        session: this.#battleSession!, sourceContext: this.#sourceBattleContext,
        escaped: this.#battleEscaped, escapeAttempts: this.#escapeAttempts,
        escapeConfirmations: [...this.#escapeConfirmations] };
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
      version: 15,
      revision: this.#revision,
      battleSequence: this.#battleSequence,
      battleId: this.#battleId,
      battleState: this.#battleState,
      rngState: this.#rng.snapshot(),
      players: [...this.#players.values()].map(({ playerId, side, ready, connected, disconnectedAt, departed,
        profile, acknowledged }) => ({
        playerId, side, ready, connected, disconnectedAt, departed, profile,
        acknowledged: [...acknowledged.entries()].slice(-128),
      })),
      pendingActions: [...this.#pendingActions.entries()],
      pendingDoubleActions: [...this.#pendingDoubleActions.entries()],
      pendingReplacements: [...this.#pendingReplacements.entries()],
      battleInventories: [...this.#battleInventories.entries()],
      battleConsumedItems: [...this.#battleConsumedItems.entries()],
      battleJoinInventory: this.#battleJoinInventory,
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
      battleEscaped: this.#battleEscaped,
      escapeAttempts: this.#escapeAttempts,
      escapeConfirmations: [...this.#escapeConfirmations],
      pendingBattleSettlements: [...this.#pendingBattleSettlements.values()],
      acknowledgedBattleSettlements: [...this.#acknowledgedBattleSettlements.entries()].slice(-128),
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
    if (message.type === "leaveRoom") {
      const acknowledgement = this.acknowledge(player, message.requestId);
      this.markPlayerDisconnected(player, true);
      return [
        { audience: { playerId }, message: acknowledgement },
        { audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
      ];
    }
    if (message.type === "requestSnapshot") {
      const acknowledgement = this.acknowledge(player, message.requestId);
      return [
        { audience: { playerId }, message: acknowledgement },
        { audience: { playerId }, message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
      ];
    }
    if (message.type === "setReady") return this.setReady(player, message.requestId, message.ready);
    if (message.type === "setProfile") return this.setProfile(player, message.requestId, message.profile);
    if (message.type === "setSourceWorld") {
      return this.setSourceWorld(player, message.requestId, message.world, message.relocateHost ?? false);
    }
    if (message.type === "setSourceActors") {
      return this.setSourceActors(player, message.requestId, message.mapId, message.actors);
    }
    if (message.type === "setSourcePresence") return this.setSourcePresence(player, message.requestId,
      message.attached, message.avatar);
    if (message.type === "setSourceFollower") {
      return this.setSourceFollower(player, message.requestId, message.species, message.appearance);
    }
    if (!player.connected) {
      return [this.error(playerId, "requestId" in message ? message.requestId : null, "UNAUTHORIZED",
        "Ce joueur doit être reconnecté avant d'envoyer une intention.")];
    }
    if (message.type === "setSourceScene") return this.setSourceScene(player, message.requestId, message.scene);
    if (message.type === "openSourceBattle") return this.openSourceBattle(player, message);
    if (message.type === "ackBattleSettlement") {
      return this.ackBattleSettlement(player, message.requestId, message.settlementId);
    }
    if (message.type === "closeSourceBattle") {
      return this.closeSourceBattle(player, message.requestId, message.battleId);
    }
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
    if (message.type === "requestBattleJoinWindow") {
      return this.requestBattleJoinWindow(player, message.requestId, message.battleId);
    }
    if (message.type === "closeBattleJoinWindow") {
      return this.closeBattleJoinWindow(player, message.requestId, message.battleId);
    }
    if (message.type === "leaveBattle") return this.leaveBattle(player, message.requestId, message.battleId);
    if (message.type === "attemptBattleEscape") return this.attemptBattleEscape(player, message);
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

  private setSourceWorld(player: RoomPlayer, requestId: string, world: SourceWorldHostState,
    relocateHost: boolean): readonly RoomDispatch[] {
    if (player.side !== "player") {
      return [this.error(player.playerId, requestId, "HOST_ONLY", "Seul l'hôte peut publier la carte narrative.")];
    }
    const sameMap = this.#sourceWorldState?.mapId === world.mapId;
    const previousHost = sameMap ? this.#sourceWorldState?.avatars.player : undefined;
    const previousGuest = sameMap ? this.#sourceWorldState?.avatars.opponent : undefined;
    // Une publication narrative ou visuelle ne doit jamais pouvoir remettre l'hôte
    // à une ancienne position. Seuls un changement de carte ou un déplacement
    // scénarisé explicitement déclaré peuvent remplacer la position autoritaire.
    const publishedHost = previousHost === undefined || relocateHost ? world.host : {
      ...world.host, x: previousHost.x, y: previousHost.y, direction: previousHost.direction,
    };
    const publishedWorld = publishedHost === world.host ? world : { ...world, host: publishedHost };
    const nextWorld = sourceWorldSnapshot(publishedWorld, this.sourceSpawn(publishedWorld, previousGuest));
    const previousGuestFollower = this.#sourceWorldState?.followers.opponent;
    // Un changement de carte de l'hote ne deplace jamais l'invite. Celui-ci reste
    // sur sa carte locale jusqu'a ce que les deux mapId coincident de nouveau.
    const guestPresence = sameMap ? this.#sourceWorldState?.presence.opponent ?? "shared" : "away";
    const withPresence = { ...nextWorld,
      ...(sameMap && this.#sourceWorldState !== null ? {
        actors: this.#sourceWorldState.actors,
        actorRevision: this.#sourceWorldState.actorRevision,
      } : {}),
      presence: { ...nextWorld.presence, opponent: guestPresence } };
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
    const attachableSourceBattle = this.#sourceBattleContext !== null
      && this.#sourceBattleContext.mapId === world.mapId && this.#battleState?.status === "active";
    if (attached && this.#battleState !== null && !attachableSourceBattle) {
      return [this.error(player.playerId, requestId, "INVALID_PHASE",
        "Le retour sur la carte partagee attend la fin du combat de l'hote.")];
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
      this.#battleEscaped = false;
      this.#escapeAttempts = 0;
      this.#escapeConfirmations.clear();
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
    this.#pendingDoubleActions.clear();
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
    if (this.#battleState.replacementRequired.length > 0) {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE",
        "Un remplacement est requis avant le prochain tour.")];
    }
    if (message.battleId !== this.#battleId) return [this.error(player.playerId, message.requestId, "STALE_BATTLE", "Identifiant de combat périmé.")];
    if (message.turn !== this.#battleState.turn) return [this.error(player.playerId, message.requestId, "STALE_TURN", "Numéro de tour périmé.")];
    if (this.#battleJoinProposal !== null) {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "La proposition de participation doit d'abord être traitée.")];
    }
    if (source?.origin === "source-trainer"
      && (this.#battleSession?.lifecycle === "invite-choice" || this.#battleSession?.lifecycle === "join-window")) {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE",
        "Le combat attend le choix de participation de l'autre Dresseur.")];
    }
    if (this.#battleState.format === "double") return this.submitDoubleEncounterAction(player, message);
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

    if (message.action.kind === "switch" && this.#battleParticipation !== null) {
      const owner = this.#battleParticipation.camps[controlledSide].members[message.action.teamIndex]?.ownerId;
      if (owner !== player.playerId) {
        return [this.error(player.playerId, message.requestId, "UNAUTHORIZED",
          "Un Dresseur ne peut envoyer que l'un de ses propres Pokémon.")];
      }
    }

    if (message.action.kind === "item" || message.action.kind === "capture") {
      const itemError = this.reserveBattleItem(player, controlledSide, message.action);
      if (itemError !== null) return [this.error(player.playerId, message.requestId, "INVALID_MESSAGE", itemError)];
    }
    const cancelledEscape = this.#escapeConfirmations.size > 0;
    this.#escapeConfirmations.clear();
    this.#pendingActions.set(controlledSide, message.action);
    for (const side of ["player", "opponent"] as const) {
      if (this.#pendingActions.has(side)) continue;
      if (this.#battleParticipation !== null && activeBattleController(this.#battleParticipation, side) === null) {
        this.#pendingActions.set(side, chooseSourceBattleAction(this.#battleState, side, this.#rng));
      }
    }
    this.#revision += 1;
    const output: RoomDispatch[] = [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, message.requestId) },
    ];
    if (message.action.kind === "item" || message.action.kind === "capture") output.push(this.battleInventoryDispatch(player.playerId));
    this.resolveQueuedEncounterTurn(output);
    if (cancelledEscape || output.some((entry) => entry.message.type === "turnResolved")) {
      output.push({ audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } });
    }
    return output;
  }

  private submitDoubleEncounterAction(player: RoomPlayer,
    message: Extract<ClientMessage, { readonly type: "submitAction" }>): readonly RoomDispatch[] {
    const state = this.#battleState;
    const participation = this.#battleParticipation;
    if (state === null || participation === null || this.#battleId === null || state.format !== "double") {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Aucun combat double actif.")];
    }
    const controlled = activeBattlePositions(state).filter((position) =>
      activeBattleControllerAt(participation, position) === player.playerId
      && (state.teams[position.side].members[activeTeamIndices(state.teams[position.side])[position.slot]!]!.hp > 0));
    const position = message.activeSlot === undefined
      ? controlled.find((candidate) => !this.#pendingDoubleActions.has(`${candidate.side}:${candidate.slot}`))
      : controlled.find((candidate) => candidate.slot === message.activeSlot);
    if (position === undefined) {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE",
        "Ce Dresseur ne controle aucun Pokemon actif disponible a cet emplacement.")];
    }
    const actionKey = `${position.side}:${position.slot}`;
    if (this.#pendingDoubleActions.has(actionKey)) {
      return [this.error(player.playerId, message.requestId, "ACTION_ALREADY_SUBMITTED",
        "Une action est deja enregistree pour ce Pokemon.")];
    }
    if (message.action.kind === "switch") {
      const owner = participation.camps[position.side].members[message.action.teamIndex]?.ownerId;
      if (owner !== player.playerId) {
        return [this.error(player.playerId, message.requestId, "UNAUTHORIZED",
          "Un Dresseur ne peut envoyer que l'un de ses propres Pokemon.")];
      }
    }
    if (message.action.kind === "item" || message.action.kind === "capture") {
      const itemError = this.reserveBattleItem(player, position.side, message.action);
      if (itemError !== null) return [this.error(player.playerId, message.requestId, "INVALID_MESSAGE", itemError)];
    }
    const cancelledEscape = this.#escapeConfirmations.size > 0;
    this.#escapeConfirmations.clear();
    this.#pendingDoubleActions.set(actionKey, { actor: position, action: message.action });
    for (const candidate of activeBattlePositions(state)) {
      const key = `${candidate.side}:${candidate.slot}`;
      if (this.#pendingDoubleActions.has(key) || activeBattleControllerAt(participation, candidate) !== null) continue;
      const battler = state.teams[candidate.side].members[activeTeamIndices(state.teams[candidate.side])[candidate.slot]!]!;
      const moves = battler.moves.map((slot, moveIndex) => ({ slot, moveIndex })).filter(({ slot }) => slot.pp > 0);
      const selected = moves[this.#rng.nextInt(moves.length)];
      if (selected === undefined) throw new Error("Le Pokemon source n'a aucune capacite disponible.");
      this.#pendingDoubleActions.set(key, { actor: candidate, action: { kind: "move", moveIndex: selected.moveIndex } });
    }
    if (this.#battleSession?.lifecycle === "join-window") this.#battleSession = activateSharedBattleSession(this.#battleSession);
    this.#revision += 1;
    const output: RoomDispatch[] = [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, message.requestId) },
    ];
    if (message.action.kind === "item" || message.action.kind === "capture") output.push(this.battleInventoryDispatch(player.playerId));
    this.resolveQueuedEncounterTurn(output);
    if (cancelledEscape || output.some((entry) => entry.message.type === "turnResolved")) {
      output.push({ audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } });
    }
    return output;
  }

  private resolveQueuedEncounterTurn(output: RoomDispatch[]): void {
    if (this.#battleState === null || this.#battleId === null) return;
    const double = this.#battleState.format === "double";
    const playerAction = this.#pendingActions.get("player");
    const opponentAction = this.#pendingActions.get("opponent");
    if (!double && (playerAction === undefined || opponentAction === undefined)) return;
    if (double && activeBattlePositions(this.#battleState).some((position) =>
      (this.#battleState!.teams[position.side].members[activeTeamIndices(this.#battleState!.teams[position.side])[position.slot]!]!.hp > 0)
      && !this.#pendingDoubleActions.has(`${position.side}:${position.slot}`))) return;
    const battleId = this.#battleId;
    const encounter = this.#activeEncounter;
    const source = this.#sourceBattleContext;
    const resolvedTurn = this.#battleState.turn;
    const beforeState = this.#battleState;
    const itemPolicy = { context: "battle" as const, revivalAllowed: true,
      battleHealingAllowed: source?.healingItemsAllowed ?? true };
    const result = double
      ? resolveDoubleTeamTurn(this.#battleState, [...this.#pendingDoubleActions.values()], this.#rng, itemPolicy)
      : resolveTeamTurn(this.#battleState, { player: playerAction!, opponent: opponentAction! }, this.#rng, itemPolicy);
    this.#battleState = result.state;
    const captureEvent = result.events.flatMap((event) => event.type === "positionedActionResolved"
      ? [...event.events] : event.type === "captureAttempted" ? [event] : [])
      .find((event) => event.type === "captureAttempted" && event.success);
    let captured: { readonly ownerId: string; readonly ballId: string; readonly battler: BattlerState } | null = null;
    if (captureEvent?.type === "captureAttempted" && this.#battleParticipation !== null) {
      const single = [...this.#pendingActions.entries()].find(([, action]) =>
        action.kind === "capture" && action.ballId === captureEvent.ballId);
      const positioned = [...this.#pendingDoubleActions.values()].find((entry) =>
        entry.action.kind === "capture" && entry.action.ballId === captureEvent.ballId);
      const ownerId = single === undefined
        ? positioned === undefined ? null : activeBattleControllerAt(this.#battleParticipation, positioned.actor)
        : activeBattleController(this.#battleParticipation, single[0]);
      const battler = Object.values(beforeState.teams).flatMap((team) => team.members)
        .find((member) => member.id === captureEvent.target);
      if (ownerId === null || battler === undefined) throw new Error("Propriétaire de la capture introuvable.");
      captured = { ownerId, ballId: captureEvent.ballId, battler };
    }
    if (this.#battleLedger !== null) {
      this.#battleLedger = recordSharedBattleTurn(this.#battleLedger, beforeState, result.state, result.events);
    }
    this.synchronizeBattleParticipation();
    this.#pendingActions.clear();
    this.#pendingDoubleActions.clear();
    this.#revision += 1;
    output.push({ audience: "all", message: { type: "turnResolved", version: PROTOCOL_VERSION,
      battleId, turn: resolvedTurn, state: result.state, events: result.events } });

    if (result.state.status === "active" && (result.state.replacementRequired.length > 0
      || (result.state.slotReplacements?.length ?? 0) > 0)) {
      if (result.state.format === "double") this.resolveAutomaticDoubleReplacements(output);
      else this.resolveAutomaticReplacements(output);
    }

    if (this.#battleState.status === "finished" && this.#battleState.winner !== null && source !== null) {
      if (this.#battleSession === null) throw new Error("Session de combat source absente.");
      this.#battleSession = settleSharedBattleSession(this.#battleSession, this.#battleState);
      this.createSourceBattleSettlements(false, output, captured);
      this.#revision += 1;
    } else if (this.#battleState.status === "finished" && this.#battleState.winner !== null && encounter !== null) {
      this.#worldState = {
        ...this.#worldState,
        session: {
          ...this.#worldState.session,
          battleResults: [...this.#worldState.session.battleResults, {
            encounterId: encounter.encounterId,
            kind: encounter.kind,
            winner: this.#battleState.winner,
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
  }

  private attemptBattleEscape(player: RoomPlayer,
    message: Extract<ClientMessage, { readonly type: "attemptBattleEscape" }>): readonly RoomDispatch[] {
    const state = this.#battleState;
    const context = this.#sourceBattleContext;
    const session = this.#battleSession;
    if (state === null || context === null || session === null || this.#battleId === null || this.#battleEscaped
      || state.status !== "active" || !context.escapable || context.origin !== "source-wild") {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "La fuite n'est pas disponible.")];
    }
    if (message.battleId !== this.#battleId) {
      return [this.error(player.playerId, message.requestId, "STALE_BATTLE", "Identifiant de combat périmé.")];
    }
    if (message.turn !== state.turn) {
      return [this.error(player.playerId, message.requestId, "STALE_TURN", "Numéro de tour périmé.")];
    }
    const participants = this.#battleParticipation === null ? [session.narrativeOwnerId]
      : [...new Set([...this.#battleParticipation.camps.player.trainerIds,
        ...this.#battleParticipation.camps.opponent.trainerIds])];
    if (!participants.includes(player.playerId)) {
      return [this.error(player.playerId, message.requestId, "UNAUTHORIZED",
        "Seuls les Dresseurs engages peuvent confirmer la fuite.")];
    }
    if (this.#battleJoinProposal !== null || state.replacementRequired.length > 0) {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE",
        "La fuite attend la fin de la décision de combat en cours.")];
    }
    if (this.#pendingActions.size > 0 || this.#pendingDoubleActions.size > 0) {
      return [this.error(player.playerId, message.requestId, "ACTION_ALREADY_SUBMITTED",
        "Une action est deja enregistree pour ce tour.")];
    }
    if (this.#escapeConfirmations.has(player.playerId)) {
      return [this.error(player.playerId, message.requestId, "ACTION_ALREADY_SUBMITTED",
        "Vous avez deja confirme la fuite pour ce tour.")];
    }
    this.#escapeConfirmations.add(player.playerId);
    this.#revision += 1;
    const output: RoomDispatch[] = [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, message.requestId) },
    ];
    if (!participants.every((playerId) => this.#escapeConfirmations.has(playerId))) {
      output.push({ audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } });
      return output;
    }
    this.#escapeConfirmations.clear();
    let activeSession = session;
    if (activeSession.lifecycle === "join-window") activeSession = activateSharedBattleSession(activeSession);
    this.#battleSession = activeSession;
    const escaped = canEscapeSourceBattle(state, this.#escapeAttempts, this.#rng);
    this.#escapeAttempts += 1;
    this.#revision += 1;
    if (escaped) {
      this.#battleEscaped = true;
      this.#pendingActions.clear();
      this.#pendingDoubleActions.clear();
      this.#battleSession = settleEscapedSharedBattleSession(activeSession);
      this.createSourceBattleSettlements(true, output);
      this.#revision += 1;
      output.push({ audience: "all", message: { type: "battleEscaped", version: PROTOCOL_VERSION,
        battleId: this.#battleId, turn: state.turn } });
      output.push({ audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } });
      return output;
    }
    if (state.format === "double" && this.#battleParticipation !== null) {
      for (const position of activeBattlePositions(state)) {
        const key = `${position.side}:${position.slot}`;
        if (activeBattleControllerAt(this.#battleParticipation, position) !== null) {
          this.#pendingDoubleActions.set(key, { actor: position, action: { kind: "wait" } });
          continue;
        }
        const battler = state.teams[position.side].members[activeTeamIndices(state.teams[position.side])[position.slot]!]!;
        const moves = battler.moves.map((slot, moveIndex) => ({ slot, moveIndex })).filter(({ slot }) => slot.pp > 0);
        const selected = moves[this.#rng.nextInt(moves.length)];
        this.#pendingDoubleActions.set(key, { actor: position,
          action: selected === undefined ? { kind: "wait" } : { kind: "move", moveIndex: selected.moveIndex } });
      }
    } else {
      this.#pendingActions.set("player", { kind: "wait" });
      if (this.#battleParticipation !== null && activeBattleController(this.#battleParticipation, "opponent") === null) {
        this.#pendingActions.set("opponent", chooseSourceBattleAction(state, "opponent", this.#rng));
      }
    }
    this.resolveQueuedEncounterTurn(output);
    if (output.some((entry) => entry.message.type === "turnResolved")) {
      output.push({ audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } });
    }
    return output;
  }

  private moveAvatar(player: RoomPlayer, message: Extract<ClientMessage, { readonly type: "moveAvatar" }>): readonly RoomDispatch[] {
    const sourceParticipant = this.#battleParticipation !== null
      && Object.values(this.#battleParticipation.camps).some((camp) => camp.trainerIds.includes(player.playerId));
    const sourceObserver = this.#battleObserverIds.includes(player.playerId);
    if (this.#activeDuel || this.#duelChallenge !== null || this.#activeEncounter !== null && this.#battleState?.status === "active"
      || this.#sourceBattleContext !== null && this.#battleState?.status === "active"
        && (sourceParticipant || sourceObserver)) {
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
    const otherConnected = [...this.#players.values()].some((candidate) => candidate.side === otherSide
      && candidate.connected);
    const other = otherConnected && world.presence[otherSide] === "shared" ? world.avatars[otherSide] : undefined;
    const otherFollower = otherConnected && world.presence[otherSide] === "shared"
      ? world.followers[otherSide] : undefined;
    const resolution = resolveSourceMovement(world, avatar, { direction: message.direction,
      ...(message.mode === undefined ? {} : { mode: message.mode }),
      ...(message.waterfall === undefined ? {} : { waterfall: message.waterfall }) },
    [...sourceActorObstacles(world), ...(other === undefined ? [] : [other]),
      ...(otherFollower === undefined ? [] : [otherFollower])]);
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
      if (sourcePointBlocked(world, candidate)) continue;
      const mask = Number.parseInt(world.passages[candidate.y * world.width + candidate.x] ?? "0", 16);
      if (mask !== 0 && (candidate.x !== world.host.x || candidate.y !== world.host.y)) return candidate;
    }
    return world.host;
  }

  private markPlayerDisconnected(player: RoomPlayer, departed: boolean): void {
    player.connected = false;
    player.disconnectedAt = departed ? null : this.#now();
    player.departed = departed;
    if (this.#duelChallenge?.challenger === player.side || this.#duelChallenge?.challenged === player.side) {
      this.#duelChallenge = null;
    }
    if (this.#battleJoinProposal?.requiredApprovals.includes(player.playerId)) this.#battleJoinProposal = null;
    if (this.#battleState !== null) {
      if (this.#battleParticipation !== null && this.#battleState.format === "double") {
        for (const [key, entry] of this.#pendingDoubleActions) {
          if (activeBattleControllerAt(this.#battleParticipation, entry.actor) === player.playerId) {
            this.#pendingDoubleActions.delete(key);
          }
        }
      }
      for (const side of ["player", "opponent"] as const) {
        const controller = this.#battleParticipation === null
          ? ([...this.#players.values()].find((candidate) => candidate.side === side)?.playerId ?? null)
          : this.#battleState.replacementRequired.includes(side)
            ? replacementBattleController(this.#battleParticipation, this.#battleState, side)
            : activeBattleController(this.#battleParticipation, side);
        if (controller === player.playerId) {
          this.#pendingActions.delete(side);
          this.#pendingReplacements.delete(side);
        }
      }
    }
    this.#revision += 1;
  }

  private restoreSourceAvatar(player: RoomPlayer): void {
    const world = this.#sourceWorldState;
    if (world === null || world.presence[player.side] !== "shared") return;
    const otherSide: BattleSide = player.side === "player" ? "opponent" : "player";
    const otherPlayer = [...this.#players.values()].find((candidate) => candidate.side === otherSide);
    if (otherPlayer?.connected !== true || world.presence[otherSide] !== "shared") return;
    const preferred = world.avatars[player.side];
    const occupied = [world.avatars[otherSide], ...(world.followers[otherSide] === undefined
      ? [] : [world.followers[otherSide]])];
    const available = (candidate: SourceAvatarSnapshot): boolean => candidate.x >= 0 && candidate.y >= 0
      && candidate.x < world.width && candidate.y < world.height
      && !sourcePointBlocked(world, candidate)
      && Number.parseInt(world.passages[candidate.y * world.width + candidate.x] ?? "0", 16) !== 0
      && !occupied.some((point) => point.x === candidate.x && point.y === candidate.y);
    const candidates = [preferred, ...(["down", "left", "right", "up"] as const).map((direction) => ({
      ...preferred, x: preferred.x + SOURCE_DELTAS[direction].x,
      y: preferred.y + SOURCE_DELTAS[direction].y,
    }))];
    const avatar = candidates.find(available) ?? preferred;
    const follower = world.followers[player.side];
    this.#sourceWorldState = { ...world, avatars: { ...world.avatars, [player.side]: avatar },
      followers: follower === undefined ? world.followers : { ...world.followers,
        [player.side]: { ...this.sourceFollowerSpawn(world, player.side, follower.species, [...occupied, avatar]),
          ...(follower.appearance === undefined ? {} : { appearance: follower.appearance }) } } };
  }

  private sourceJoinAvailable(world: SourceWorldSnapshot, avatar: SourceAvatarSnapshot): boolean {
    if (avatar.x < 0 || avatar.y < 0 || avatar.x >= world.width || avatar.y >= world.height) return false;
    if (sourcePointBlocked(world, avatar)) return false;
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

  private sourceFollowerSpawn(world: SourceWorldSnapshot, side: BattleSide, species: string,
    occupied: readonly SourceAvatarSnapshot[] = []): SourceFollowerSnapshot {
    const avatar = world.avatars[side];
    const preferredDirection = SOURCE_OPPOSITE[avatar.direction];
    const directions = [preferredDirection, "left", "right", "up", "down"] as const;
    for (const direction of directions) {
      const delta = SOURCE_DELTAS[direction];
      const x = avatar.x + delta.x;
      const y = avatar.y + delta.y;
      if (x < 0 || y < 0 || x >= world.width || y >= world.height) continue;
      const mask = Number.parseInt(world.passages[y * world.width + x] ?? "0", 16);
      if (mask !== 0 && !sourcePointBlocked(world, { x, y })
        && !occupied.some((point) => point.x === x && point.y === y)) {
        return { species, x, y, direction: avatar.direction };
      }
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
      this.#battleEscaped = false;
      this.#escapeAttempts = 0;
      this.#escapeConfirmations.clear();
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
    const joinableLifecycle = this.#activeEncounter !== null
      ? this.#battleState?.turn === 1 && this.#battleSession?.lifecycle === "join-window"
      : this.#sourceBattleContext?.origin === "source-wild"
        ? this.#battleSession?.lifecycle === "join-window" || this.#battleSession?.lifecycle === "active"
        : this.#battleSession?.lifecycle === "join-window";
    if (this.#battleId !== message.battleId || this.#battleState === null
      || this.#activeEncounter === null && this.#sourceBattleContext === null
      || this.#battleParticipation === null || this.#battleState.status !== "active"
      || this.#battleJoinProposal !== null
      || this.#activeDuel || this.#pendingActions.size > 0 || !joinableLifecycle) {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Ce combat n'accepte plus de participant.")];
    }
    if (this.#sourceBattleContext?.origin === "source-wild" && message.side !== "player") {
      return [this.error(player.playerId, message.requestId, "INVALID_MESSAGE",
        "Un combat sauvage ne peut etre rejoint que pour aider le Dresseur.")];
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
    if (this.#sourceBattleContext !== null && this.#sourceWorldState !== null) {
      const owner = [...this.#players.values()].find((candidate) =>
        candidate.playerId === this.#battleParticipation?.battleOwnerId);
      const avatar = this.#sourceWorldState.avatars[player.side];
      const target = owner === undefined ? undefined : this.#sourceWorldState.avatars[owner.side];
      if (target === undefined || Math.abs(avatar.x - target.x) + Math.abs(avatar.y - target.y) !== 1) {
        return [this.error(player.playerId, message.requestId, "INTERACTION_UNAVAILABLE",
          "Placez-vous a cote du meneur du combat pour le rejoindre.")];
      }
    }
    try {
      this.#battleJoinProposal = proposeBattleJoin(this.#battleParticipation, {
        joinerId: player.playerId,
        side: message.side,
        members: message.team.members,
        finalMemberIds: message.finalMemberIds,
      });
      this.#battleJoinInventory = [player.playerId, { ...(message.battleItems ?? {}) }];
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

  private setSourceActors(player: RoomPlayer, requestId: string, mapId: number,
    actors: readonly SourceWorldActorSnapshot[]): readonly RoomDispatch[] {
    const world = this.#sourceWorldState;
    if (player.side !== "player") {
      return [this.error(player.playerId, requestId, "HOST_ONLY", "Seul l'hote peut publier les PNJ du monde.")];
    }
    if (world === null || world.mapId !== mapId) {
      return [this.error(player.playerId, requestId, "INVALID_PHASE", "Les PNJ ne correspondent pas a la carte partagee.")];
    }
    if (actors.some((actor) => actor.x < 0 || actor.y < 0 || actor.x >= world.width || actor.y >= world.height)
      || new Set(actors.map((actor) => actor.eventId)).size !== actors.length) {
      return [this.error(player.playerId, requestId, "INVALID_MESSAGE", "Positions de PNJ invalides.")];
    }
    const actorRevision = world.actorRevision + 1;
    this.#sourceWorldState = { ...world, actors, actorRevision };
    this.#revision += 1;
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, requestId) },
      { audience: "all", message: { type: "sourceActorsUpdated", version: PROTOCOL_VERSION,
        mapId, actorRevision, revision: this.#revision, actors } },
    ];
  }

  private openSourceBattle(player: RoomPlayer,
    message: Extract<ClientMessage, { readonly type: "openSourceBattle" }>): readonly RoomDispatch[] {
    const world = this.#sourceWorldState;
    if (player.side !== "player" && message.context.origin !== "source-wild") {
      return [this.error(player.playerId, message.requestId, "HOST_ONLY",
        "Seul l'hote peut ouvrir un combat narratif de Dresseur.")];
    }
    const guestAwayWild = player.side === "opponent" && message.context.origin === "source-wild"
      && world?.presence.opponent === "away";
    if (world === null || !guestAwayWild
      && (world.mapId !== message.context.mapId || world.presence[player.side] !== "shared")) {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Le combat ne correspond pas au monde partage.")];
    }
    if (this.#battleState !== null || this.#duelChallenge !== null || message.context.narrativeOwnerId !== player.playerId) {
      return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Un combat ou un defi est deja en cours.")];
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
      this.#battleState = message.context.format === "double"
        ? createDoubleTeamBattleState({ player: message.playerTeam.members, opponent: message.opponentTeam.members })
        : createTeamBattleState({ player: message.playerTeam.members,
          opponent: message.opponentTeam.members }, { player: message.playerTeam.activeIndex,
          opponent: message.opponentTeam.activeIndex });
      this.#battleEscaped = false;
      this.#escapeAttempts = 0;
      this.#escapeConfirmations.clear();
      this.#battleSequence += 1;
      this.#battleId = `${this.#roomCode}-${this.#battleSequence}`;
      this.#battleParticipation = { battleOwnerId: player.playerId, format: message.context.format, camps: {
        player: { trainerIds: [player.playerId], members: this.#battleState.teams.player.members.map((battler) => ({
          ownerId: player.playerId, battler })), activeMemberId: this.#battleState.teams.player.members[this.#battleState.teams.player.activeIndex]!.id,
          ...(this.#battleState.teams.player.activeIndices === undefined ? {} : { activeMemberIds: this.#battleState.teams.player.activeIndices
            .map((index) => this.#battleState!.teams.player.members[index]!.id) }) },
        opponent: { trainerIds: [], members: this.#battleState.teams.opponent.members.map((battler) => ({
          ownerId: null, battler })), activeMemberId: this.#battleState.teams.opponent.members[this.#battleState.teams.opponent.activeIndex]!.id,
          ...(this.#battleState.teams.opponent.activeIndices === undefined ? {} : { activeMemberIds: this.#battleState.teams.opponent.activeIndices
            .map((index) => this.#battleState!.teams.opponent.members[index]!.id) }) },
      } };
      this.#battleInventories.clear();
      this.#battleConsumedItems.clear();
      this.#battleInventories.set(player.playerId, { ...(message.battleItems ?? {}) });
      this.#battleConsumedItems.set(player.playerId, {});
      this.#battleJoinInventory = null;
      this.#battleLedger = createSharedBattleLedger(this.#battleState);
      this.#battleJoinProposal = null;
      this.#battleObserverIds = [];
      this.#battleJoinRefusal = null;
      this.#sourceBattleContext = message.context;
      const guestAvailable = [...this.#players.values()].some((candidate) => candidate.playerId !== player.playerId
        && candidate.connected && (message.context.origin === "source-trainer"
          || world.presence[candidate.side] === "shared"));
      this.#battleSession = createSharedBattleSession({ battleId: this.#battleId,
        origin: message.context.origin, narrativeOwnerId: player.playerId, allowJoin: guestAvailable,
        requireInviteChoice: message.context.origin === "source-trainer" });
      this.#activeEncounter = null;
      this.#activeDuel = false;
      this.#pendingActions.clear();
      this.#pendingDoubleActions.clear();
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
      this.#battleInventories.clear();
      this.#battleConsumedItems.clear();
      this.#battleJoinInventory = null;
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
    const joinableLifecycle = this.#activeEncounter !== null
      ? this.#battleState?.turn === 1 && this.#battleSession?.lifecycle === "join-window"
      : this.#sourceBattleContext?.origin === "source-wild"
        ? this.#battleSession?.lifecycle === "join-window" || this.#battleSession?.lifecycle === "active"
        : this.#battleSession?.lifecycle === "join-window";
    if (this.#battleId !== battleId || this.#battleState === null || this.#battleParticipation === null
      || !joinableLifecycle
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
      this.#battleJoinInventory = null;
    } else {
      try {
        const approved = approveBattleJoin(this.#battleJoinProposal, player.playerId);
        let participation = applyBattleJoin(this.#battleParticipation, approved);
        const teams: Record<BattleSide, readonly BattlerState[]> = {
          player: participation.camps.player.members.map((member) => member.battler),
          opponent: participation.camps.opponent.members.map((member) => member.battler),
        };
        const activeIndices = Object.fromEntries((["player", "opponent"] as const).map((side) => {
          const camp = participation.camps[side];
          const ids = [...(camp.activeMemberIds ?? [camp.activeMemberId])];
          if (this.#sourceBattleContext?.origin === "source-trainer") {
            const second = camp.members.find((member) => member.battler.hp > 0 && !ids.includes(member.battler.id));
            if (second !== undefined) ids.push(second.battler.id);
          }
          return [side, ids.slice(0, 2).map((id) => Math.max(0,
            camp.members.findIndex((member) => member.battler.id === id)))];
        })) as unknown as Record<BattleSide, readonly number[]>;
        const previousState = this.#battleState;
        this.#battleParticipation = participation;
        if (this.#battleJoinInventory?.[0] === approved.joinerId) {
          this.#battleInventories.set(approved.joinerId, this.#battleJoinInventory[1]);
          this.#battleConsumedItems.set(approved.joinerId, {});
        }
        this.#battleJoinInventory = null;
        if (this.#sourceBattleContext !== null) this.#sourceBattleContext = { ...this.#sourceBattleContext, format: "double" };
        this.#battleState = { ...createDoubleTeamBattleState(teams, activeIndices), turn: previousState.turn };
        this.synchronizeBattleParticipation();
        if (this.#activeEncounter !== null) this.#battleLedger = createSharedBattleLedger(this.#battleState);
        this.#battleJoinProposal = null;
        this.#battleJoinRefusal = null;
        if (this.#sourceBattleContext?.origin === "source-trainer"
          && this.#battleSession?.lifecycle === "join-window") {
          this.#battleSession = activateSharedBattleSession(this.#battleSession);
        }
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
    const joinableLifecycle = this.#activeEncounter !== null
      ? this.#battleState?.turn === 1 && this.#battleSession?.lifecycle === "join-window"
      : this.#sourceBattleContext?.origin === "source-wild"
        ? this.#battleSession?.lifecycle === "join-window" || this.#battleSession?.lifecycle === "active"
        : this.#battleSession?.lifecycle === "join-window";
    if (this.#battleId !== battleId || this.#battleState === null || this.#battleParticipation === null
      || !joinableLifecycle) {
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
      if (this.#sourceBattleContext?.origin === "source-trainer"
        && this.#battleSession?.lifecycle === "join-window") {
        this.#battleSession = activateSharedBattleSession(this.#battleSession);
      }
      this.#revision += 1;
    }
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, requestId) },
      { audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
    ];
  }

  private requestBattleJoinWindow(player: RoomPlayer, requestId: string,
    battleId: string): readonly RoomDispatch[] {
    if (this.#battleId !== battleId || this.#battleSession?.lifecycle !== "invite-choice") {
      return [this.error(player.playerId, requestId, "INVALID_PHASE", "Le choix d'appel est deja traite.")];
    }
    if (this.#battleSession.narrativeOwnerId !== player.playerId) {
      return [this.error(player.playerId, requestId, "HOST_ONLY", "Seul le meneur peut appeler l'autre joueur.")];
    }
    this.#battleSession = openSharedBattleJoinWindow(this.#battleSession);
    this.#revision += 1;
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, requestId) },
      { audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
    ];
  }

  private closeBattleJoinWindow(player: RoomPlayer, requestId: string,
    battleId: string): readonly RoomDispatch[] {
    if (this.#battleId !== battleId || this.#battleSession === null
      || !["invite-choice", "join-window"].includes(this.#battleSession.lifecycle)) {
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
      this.#battleEscaped = false;
      this.#escapeAttempts = 0;
      this.#escapeConfirmations.clear();
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
      this.#pendingDoubleActions.clear();
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
    this.#battleEscaped = false;
    this.#escapeAttempts = 0;
    this.#escapeConfirmations.clear();
    this.#battleId = null;
    this.#activeDuel = false;
    this.#battleParticipation = null;
    this.#battleJoinProposal = null;
    this.#battleObserverIds = [];
    this.#battleJoinRefusal = null;
    this.#battleLedger = null;
    this.#battleSession = null;
    this.#sourceBattleContext = null;
    this.#battleInventories.clear();
    this.#battleConsumedItems.clear();
    this.#battleJoinInventory = null;
    this.#pendingActions.clear();
    this.#pendingDoubleActions.clear();
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
    if (this.#battleState.format === "double") {
      const participation = this.#battleParticipation;
      if (participation === null) return [this.error(player.playerId, message.requestId, "INVALID_PHASE", "Participation double absente.")];
      const required = this.#battleState.slotReplacements ?? [];
      const position = required.find((candidate) => (message.activeSlot === undefined || candidate.slot === message.activeSlot)
        && activeBattleControllerAt(participation, candidate) === player.playerId);
      if (position === undefined) return [this.error(player.playerId, message.requestId, "INVALID_PHASE",
        "Aucun remplacement requis pour ce Pokemon.")];
      if (participation.camps[position.side].members[message.teamIndex]?.ownerId !== player.playerId) {
        return [this.error(player.playerId, message.requestId, "UNAUTHORIZED", "Ce Pokemon appartient a l'autre Dresseur.")];
      }
      const before = this.#battleState;
      const fromIndex = activeTeamIndices(before.teams[position.side])[position.slot]!;
      try { this.#battleState = replaceFaintedDoublePokemon(before, position, message.teamIndex); }
      catch (error) { return [this.error(player.playerId, message.requestId, "INVALID_MESSAGE",
        error instanceof Error ? error.message : "Remplacement double invalide.")]; }
      this.synchronizeBattleParticipation();
      this.#revision += 1;
      const event = { type: "pokemonSwitched" as const, side: position.side, fromIndex, toIndex: message.teamIndex,
        from: before.teams[position.side].members[fromIndex]!.id,
        to: before.teams[position.side].members[message.teamIndex]!.id, reason: "replacement" as const };
      return [
        { audience: { playerId: player.playerId }, message: this.acknowledge(player, message.requestId) },
        { audience: "all", message: { type: "replacementResolved", version: PROTOCOL_VERSION,
          battleId: this.#battleId, state: this.#battleState, events: [event] } },
        { audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
      ];
    }
    const battleSide = this.#battleParticipation === null ? player.side
      : (["player", "opponent"] as const).find((side) => this.#battleState!.replacementRequired.includes(side)
        && replacementBattleController(this.#battleParticipation!, this.#battleState!, side) === player.playerId);
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
    this.resolveAutomaticReplacements(output);
    if (output.some((entry) => entry.message.type === "replacementResolved")) {
      output.push({ audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } });
    }
    return output;
  }

  private resolveAutomaticReplacements(output: RoomDispatch[]): void {
    if (this.#battleState === null || this.#battleId === null || this.#battleState.replacementRequired.length === 0) return;
    for (const side of this.#battleState.replacementRequired) {
      if (this.#pendingReplacements.has(side) || this.#battleParticipation === null) continue;
      const controller = replacementBattleController(this.#battleParticipation, this.#battleState, side);
      if (controller !== null) continue;
      const eligible = battleMemberIndicesOwnedBy(this.#battleParticipation, this.#battleState, side, null);
      this.#pendingReplacements.set(side, chooseSourceBattleReplacement(this.#battleState, side, eligible));
    }
    if (!this.#battleState.replacementRequired.every((side) => this.#pendingReplacements.has(side))) return;
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
    output.push({ audience: "all", message: { type: "replacementResolved", version: PROTOCOL_VERSION,
      battleId: this.#battleId, state: result.state, events: result.events } });
  }

  private resolveAutomaticDoubleReplacements(output: RoomDispatch[]): void {
    if (this.#battleState === null || this.#battleId === null || this.#battleParticipation === null) return;
    let state = this.#battleState;
    const events: { type: "pokemonSwitched"; side: BattleSide; fromIndex: number; toIndex: number;
      from: string; to: string; reason: "replacement" }[] = [];
    for (const position of [...(state.slotReplacements ?? [])]) {
      if (activeBattleControllerAt(this.#battleParticipation, position) !== null) continue;
      const team = state.teams[position.side];
      const active = activeTeamIndices(team);
      const eligible = team.members.findIndex((member, index) => member.hp > 0 && !active.includes(index)
        && this.#battleParticipation!.camps[position.side].members[index]?.ownerId === null);
      if (eligible < 0) continue;
      const fromIndex = active[position.slot]!;
      events.push({ type: "pokemonSwitched", side: position.side, fromIndex, toIndex: eligible,
        from: team.members[fromIndex]!.id, to: team.members[eligible]!.id, reason: "replacement" });
      state = replaceFaintedDoublePokemon(state, position, eligible);
    }
    if (events.length === 0) return;
    this.#battleState = state;
    this.synchronizeBattleParticipation();
    this.#revision += 1;
    output.push({ audience: "all", message: { type: "replacementResolved", version: PROTOCOL_VERSION,
      battleId: this.#battleId, state, events } });
  }

  private createSourceBattleSettlements(escaped: boolean, output: RoomDispatch[],
    captured: { readonly ownerId: string; readonly ballId: string; readonly battler: BattlerState } | null = null): void {
    const battleId = this.#battleId;
    const state = this.#battleState;
    const participation = this.#battleParticipation;
    const ledger = this.#battleLedger;
    const context = this.#sourceBattleContext;
    if (battleId === null || state === null || participation === null || ledger === null || context === null) return;
    const owners = [...new Set([...participation.camps.player.trainerIds,
      ...participation.camps.opponent.trainerIds])];
    const narrativeSide = (["player", "opponent"] as const).find((side) =>
      participation.camps[side].trainerIds.includes(context.narrativeOwnerId));
    const trainerReward = context.origin !== "source-trainer" || context.rewards.trainerBaseMoney === null ? 0
      : Math.max(0, ...context.rewards.opponents.map((opponent) => opponent.level))
        * context.rewards.trainerBaseMoney;
    for (const ownerId of owners) {
      const tactical = escaped
        ? sharedBattleOwnerEscapeSettlement(participation, state, ledger, ownerId)
        : sharedBattleOwnerSettlement(participation, state, ledger, ownerId);
      const ownerIsNarrative = ownerId === context.narrativeOwnerId;
      const narrativeWon = !escaped && narrativeSide !== undefined && state.winner === narrativeSide;
      const money = !ownerIsNarrative || escaped ? { kind: "none" as const }
        : narrativeWon && trainerReward > 0 ? { kind: "fixed" as const, amount: trainerReward }
          : !narrativeWon ? { kind: "source-defeat" as const } : { kind: "none" as const };
      const settlement: SourceBattleSettlement = {
        settlementId: `${battleId}-${ownerId}`,
        battleId,
        ownerId,
        narrativeOwnerId: context.narrativeOwnerId,
        outcome: captured !== null ? "captured" : escaped ? "escaped" : tactical.won ? "won" : "lost",
        tactical,
        participation,
        state,
        experience: { ...context.rewards.experience, trainerBattle: context.origin === "source-trainer" },
        money,
        items: [],
        consumedItems: Object.entries(this.#battleConsumedItems.get(ownerId) ?? {})
          .map(([itemId, quantity]) => ({ itemId, quantity })),
        ...(captured?.ownerId === ownerId ? { capturedPokemon: { ballId: captured.ballId, battler: captured.battler } } : {}),
        healParty: ownerIsNarrative && !escaped && !narrativeWon,
      };
      this.#pendingBattleSettlements.set(settlement.settlementId, settlement);
      output.push({ audience: { playerId: ownerId },
        message: { type: "battleSettlement", version: PROTOCOL_VERSION, settlement } });
    }
  }

  private ackBattleSettlement(player: RoomPlayer, requestId: string,
    settlementId: string): readonly RoomDispatch[] {
    const pending = this.#pendingBattleSettlements.get(settlementId);
    if (pending === undefined) {
      const acknowledgedOwnerId = this.#acknowledgedBattleSettlements.get(settlementId);
      if (acknowledgedOwnerId === undefined) {
        return [this.error(player.playerId, requestId, "INVALID_PHASE", "Aucun règlement personnel en attente.")];
      }
      if (acknowledgedOwnerId !== player.playerId) {
        return [this.error(player.playerId, requestId, "UNAUTHORIZED", "Ce règlement appartient à un autre joueur.")];
      }
    } else {
      if (pending.settlementId !== settlementId || pending.ownerId !== player.playerId) {
        return [this.error(player.playerId, requestId, "UNAUTHORIZED", "Ce règlement appartient à un autre joueur.")];
      }
      this.#pendingBattleSettlements.delete(settlementId);
      this.#acknowledgedBattleSettlements.set(settlementId, player.playerId);
      while (this.#acknowledgedBattleSettlements.size > 128) {
        const oldest = this.#acknowledgedBattleSettlements.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        this.#acknowledgedBattleSettlements.delete(oldest);
      }
      this.#revision += 1;
    }
    const output: RoomDispatch[] = [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, requestId) },
    ];
    const next = this.pendingBattleSettlement(player.playerId);
    if (next !== null) output.push({ audience: { playerId: player.playerId },
      message: { type: "battleSettlement", version: PROTOCOL_VERSION, settlement: next } });
    return output;
  }

  private pendingBattleSettlement(playerId: string): SourceBattleSettlement | null {
    return [...this.#pendingBattleSettlements.values()]
      .find((settlement) => settlement.ownerId === playerId) ?? null;
  }

  private reserveBattleItem(player: RoomPlayer, side: BattleSide,
    action: Extract<TeamBattleAction, { readonly kind: "item" | "capture" }>): string | null {
    const state = this.#battleState;
    const participation = this.#battleParticipation;
    if (state === null || participation === null || this.#sourceBattleContext === null) {
      return "Les objets personnels ne sont disponibles que dans un combat source partage.";
    }
    const alreadySubmitted = [...this.#pendingActions.entries()].some(([pendingSide, pending]) =>
      (pending.kind === "item" || pending.kind === "capture")
        && activeBattleController(participation, pendingSide) === player.playerId)
      || [...this.#pendingDoubleActions.values()].some((pending) =>
        (pending.action.kind === "item" || pending.action.kind === "capture")
        && activeBattleControllerAt(participation, pending.actor) === player.playerId);
    if (alreadySubmitted) return "Un Dresseur ne peut utiliser qu'un objet par tour.";
    if (action.kind === "capture" && ([...this.#pendingActions.values()].some((pending) => pending.kind === "capture")
      || [...this.#pendingDoubleActions.values()].some((pending) => pending.action.kind === "capture"))) {
      return "Une tentative de capture est deja enregistree pour ce tour.";
    }
    if (action.kind === "capture" && !canCaptureSharedBattleTarget(participation, state, this.#sourceBattleContext.origin)) {
      return "La cible active ne peut pas etre capturee.";
    }
    if (action.kind === "capture" && action.target !== undefined && action.target.side === side) {
      return "Une Ball doit viser le camp adverse.";
    }
    const target = action.kind === "item" ? state.teams[side].members[action.targetTeamIndex] : null;
    const owner = action.kind === "item" ? participation.camps[side].members[action.targetTeamIndex]?.ownerId : null;
    if (action.kind === "item" && (target === undefined || owner !== player.playerId)) {
      return "Un Dresseur ne peut utiliser un objet que sur l'un de ses propres Pokemon.";
    }
    if (action.kind === "item" && pokemonItemTargetMode(action.itemId) === "active"
      && !activeTeamIndices(state.teams[side]).includes(action.targetTeamIndex)) {
      return "Cet objet de combat doit viser un Pokemon actif.";
    }
    const itemId = action.kind === "item" ? action.itemId : action.ballId;
    const inventory = this.#battleInventories.get(player.playerId);
    const quantity = inventory?.[itemId] ?? 0;
    if (quantity <= 0) return "Cet objet n'est pas disponible dans le sac de ce Dresseur.";
    if (action.kind === "item") {
      const applied = applyPokemonItemEffect(target!, itemId, { context: "battle", revivalAllowed: true,
        battleHealingAllowed: this.#sourceBattleContext.healingItemsAllowed }, action.targetMoveIndex);
      if (typeof applied === "string") return `Cet objet ne peut pas etre utilise (${applied}).`;
    }
    const next = { ...inventory };
    if (quantity === 1) delete next[itemId]; else next[itemId] = quantity - 1;
    this.#battleInventories.set(player.playerId, next);
    const consumed = { ...(this.#battleConsumedItems.get(player.playerId) ?? {}) };
    consumed[itemId] = (consumed[itemId] ?? 0) + 1;
    this.#battleConsumedItems.set(player.playerId, consumed);
    return null;
  }

  private battleInventoryDispatch(playerId: string): RoomDispatch {
    if (this.#battleId === null) throw new Error("Combat absent pour la mise a jour du sac.");
    return { audience: { playerId }, message: { type: "battleInventoryUpdated", version: PROTOCOL_VERSION,
      battleId: this.#battleId, inventory: this.#battleInventories.get(playerId) ?? {} } };
  }

  private closeSourceBattle(player: RoomPlayer, requestId: string,
    battleId: string): readonly RoomDispatch[] {
    if (this.#battleId !== battleId || this.#sourceBattleContext === null
      || this.#battleSession?.lifecycle !== "settling") {
      return [this.error(player.playerId, requestId, "INVALID_PHASE", "Ce combat source n'attend pas sa fermeture.")];
    }
    if (this.#battleSession.narrativeOwnerId !== player.playerId) {
      return [this.error(player.playerId, requestId, "HOST_ONLY", "Seul le propriétaire narratif peut fermer ce combat.")];
    }
    if (this.pendingBattleSettlement(player.playerId) !== null) {
      return [this.error(player.playerId, requestId, "INVALID_PHASE",
        "Le règlement personnel de l'hôte doit être enregistré avant la fermeture.")];
    }
    this.#battleSession = closeSharedBattleSession(this.#battleSession);
    this.#battleState = null;
    this.#battleId = null;
    this.#battleEscaped = false;
    this.#escapeAttempts = 0;
    this.#escapeConfirmations.clear();
    this.#activeEncounter = null;
    this.#activeDuel = false;
    this.#battleParticipation = null;
    this.#battleJoinProposal = null;
    this.#battleObserverIds = [];
    this.#battleJoinRefusal = null;
    this.#battleLedger = null;
    this.#battleSession = null;
    this.#sourceBattleContext = null;
    this.#battleInventories.clear();
    this.#battleConsumedItems.clear();
    this.#battleJoinInventory = null;
    this.#pendingActions.clear();
    this.#pendingDoubleActions.clear();
    this.#pendingReplacements.clear();
    this.#revision += 1;
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, requestId) },
      { audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
    ];
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
      })), activeMemberId: team.members[team.activeIndex]!.id,
      ...(team.activeIndices === undefined ? {} : { activeMemberIds: team.activeIndices.map((index) => team.members[index]!.id) }) };
    };
    this.#battleParticipation = { ...this.#battleParticipation,
      camps: { player: synchronizeCamp("player"), opponent: synchronizeCamp("opponent") } };
  }

  private error(playerId: string, requestId: string | null, code: ProtocolErrorCode, message: string): RoomDispatch {
    return { audience: { playerId }, message: { type: "error", version: PROTOCOL_VERSION, requestId, code, message } };
  }
}
