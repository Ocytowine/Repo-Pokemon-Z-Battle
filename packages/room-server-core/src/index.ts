import { replaceFaintedPokemon, resolveTeamTurn, type BattleSide, type StatefulRandomSource, type TeamBattleAction, type TeamBattleState, type TeamTurnActions } from "@pokemon-z-battle/battle-engine";
import { createDefaultNetworkPlayerProfile, PROTOCOL_VERSION, sourceWorldSnapshot, type ClientMessage, type NetworkPlayerProfile,
  type ProtocolErrorCode, type RoomPlayerSnapshot, type RoomSnapshot, type ServerMessage, type SourceAvatarSnapshot,
  type SourceFollowerSnapshot, type SourceSceneSnapshot, type SourceWorldHostState, type SourceWorldSnapshot } from "@pokemon-z-battle/multiplayer-protocol";
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
  readonly version: 8;
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
  readonly sourceWorld?: SourceWorldHostState | null;
}

const SOURCE_DIRECTION_BITS = { down: 1, left: 2, right: 4, up: 8 } as const;
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
      this.#worldState = persisted.worldState;
      this.#sourceWorldState = persisted.sourceWorldState === null ? null
        : { ...persisted.sourceWorldState, followers: persisted.sourceWorldState.followers ?? {} };
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
      version: 8,
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
    if (message.type === "setSourceFollower") return this.setSourceFollower(player, message.requestId, message.species);
    if (message.type === "setSourceScene") return this.setSourceScene(player, message.requestId, message.scene);
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

  private setSourceWorld(player: RoomPlayer, requestId: string, world: SourceWorldHostState): readonly RoomDispatch[] {
    if (player.side !== "player") {
      return [this.error(player.playerId, requestId, "HOST_ONLY", "Seul l'hôte peut publier la carte narrative.")];
    }
    const sameMap = this.#sourceWorldState?.mapId === world.mapId;
    const previousGuest = sameMap ? this.#sourceWorldState?.avatars.opponent : undefined;
    const nextWorld = sourceWorldSnapshot(world, this.sourceSpawn(world, previousGuest));
    const previousGuestFollower = this.#sourceWorldState?.followers.opponent;
    this.#sourceWorldState = previousGuestFollower === undefined ? nextWorld : { ...nextWorld,
      followers: { ...nextWorld.followers, opponent: sameMap ? previousGuestFollower
        : this.sourceFollowerSpawn(nextWorld, "opponent", previousGuestFollower.species) } };
    if (!sameMap) this.#sourceSceneState = null;
    this.#revision += 1;
    return [
      { audience: { playerId: player.playerId }, message: this.acknowledge(player, requestId) },
      { audience: "all", message: { type: "snapshot", version: PROTOCOL_VERSION, snapshot: this.snapshot() } },
    ];
  }

  private setSourceFollower(player: RoomPlayer, requestId: string, species: string | null): readonly RoomDispatch[] {
    const world = this.#sourceWorldState;
    if (world === null) {
      return [this.error(player.playerId, requestId, "INVALID_PHASE", "Aucune carte narrative partagee.")];
    }
    const followers: Partial<Record<BattleSide, SourceFollowerSnapshot>> = { ...world.followers };
    if (species === null) delete followers[player.side];
    else followers[player.side] = this.sourceFollowerSpawn(world, player.side, species);
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
    const avatar = world.avatars[player.side];
    const delta = SOURCE_DELTAS[message.direction];
    const target = { x: avatar.x + delta.x, y: avatar.y + delta.y };
    const otherSide: BattleSide = player.side === "player" ? "opponent" : "player";
    const other = world.avatars[otherSide];
    const otherFollower = world.followers[otherSide];
    const inBounds = target.x >= 0 && target.y >= 0 && target.x < world.width && target.y < world.height;
    const sourceMask = Number.parseInt(world.passages[avatar.y * world.width + avatar.x] ?? "0", 16);
    const targetMask = inBounds ? Number.parseInt(world.passages[target.y * world.width + target.x] ?? "0", 16) : 0;
    const passable = inBounds && (sourceMask & SOURCE_DIRECTION_BITS[message.direction]) !== 0
      && (targetMask & SOURCE_DIRECTION_BITS[SOURCE_OPPOSITE[message.direction]]) !== 0
      && !world.blockedPoints.some((point) => point.x === target.x && point.y === target.y)
      && (other.x !== target.x || other.y !== target.y)
      && (otherFollower === undefined || otherFollower.x !== target.x || otherFollower.y !== target.y);
    const next: SourceAvatarSnapshot = passable ? { ...target, direction: message.direction }
      : { ...avatar, direction: message.direction };
    const currentFollower = world.followers[player.side];
    let nextFollower: SourceFollowerSnapshot | undefined = currentFollower;
    if (passable && currentFollower !== undefined) {
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
