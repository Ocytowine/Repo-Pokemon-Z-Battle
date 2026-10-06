import { type Direction, type OverworldEvent, type OverworldState } from "@pokemon-z-battle/overworld-engine";
import { PROTOCOL_VERSION, normalizeRoomCode, parseSourceWorldHostState, type NetworkPlayerProfile, type RoomPlayerSnapshot,
  type RoomSnapshot, type SourceAvatarSnapshot, type SourceMovementIntent, type SourceWorldHostState,
  type SourceBattleContext, type SourceBattleSettlement, type SourceFollowerSnapshot,
  type SourceWorldActorSnapshot, type SourceWorldSnapshot } from "@pokemon-z-battle/multiplayer-protocol";
import type { SourceSceneSnapshot } from "@pokemon-z-battle/multiplayer-protocol";
import type { BattleTeam, DoubleBattleEvent, TeamBattleAction, TeamBattleEvent, TeamBattleState } from "@pokemon-z-battle/battle-engine";
import {
  buildWebSocketUrl,
  normalizeServerUrl,
  parseServerMessage,
  parseStoredSession,
  parseTicket,
  reconnectDelay,
  type MultiplayerTicket,
  type StoredOverworldSession,
} from "./multiplayer-client.js";

interface MutableNetworkSession {
  readonly serverUrl: string;
  readonly ticket: MultiplayerTicket;
  socket: WebSocket | null;
  sequence: number;
  pendingMovementSequence: number | null;
  revision: number;
  lastSentAt: number;
  reconnectAttempt: number;
  reconnectTimer: number | null;
  userDisconnected: boolean;
  snapshot: RoomSnapshot | null;
  submittedTurn: number | null;
  submittedActiveSlots: number[];
  profile: NetworkPlayerProfile;
  sourceFollowerSignature: string | undefined;
  sourceActorSignature: string | undefined;
  confirmedSourceMapId: number | null;
  pendingSettlement: SourceBattleSettlement | null;
  closingBattleId: string | null;
  roomBattleActive: boolean;
  joinableBattle: RoomSnapshot["battle"];
}

export interface NetworkSessionView {
  readonly ticket: MultiplayerTicket;
  readonly snapshot: RoomSnapshot | null;
  readonly submittedTurn: number | null;
  readonly submittedActiveSlots: readonly number[];
  /** Etat brut de la room, y compris lorsqu'un combat est masque au joueur non engage. */
  readonly roomBattleActive: boolean;
  /** Combat source brut masque tant que l'invite n'a pas choisi son camp ou l'observation. */
  readonly joinableBattle: RoomSnapshot["battle"];
}

export interface SourceBattleNetworkDraft {
  readonly context: Omit<SourceBattleContext, "narrativeOwnerId">;
  readonly playerTeam: BattleTeam;
  readonly opponentTeam: BattleTeam;
}

export interface NetworkSessionCallbacks {
  readonly onStatus: (state: string, notice: string, active: boolean) => void;
  readonly onWorldState: (state: OverworldState, animate: boolean) => void;
  readonly onEvents: (events: readonly OverworldEvent[]) => void;
  readonly onMapChanged: (mapId: string) => void;
  readonly onConnectionFormChanged: (serverUrl: string, roomCode: string) => void;
  readonly onPlayersChanged: (players: readonly RoomPlayerSnapshot[]) => void;
  readonly onSourceWorldState: (state: SourceWorldSnapshot, animate: boolean, applyOwnAvatar: boolean) => void;
  readonly onSourceActorsState: (mapId: number, actorRevision: number,
    actors: readonly SourceWorldActorSnapshot[]) => void;
  readonly onSourceSceneState: (state: SourceSceneSnapshot) => void;
  readonly onBattleStarted: (battleId: string, state: TeamBattleState) => void;
  readonly onBattleExpanded: (battleId: string, before: TeamBattleState, state: TeamBattleState) => void;
  readonly onBattleTurnResolved: (battleId: string, before: TeamBattleState, state: TeamBattleState,
    events: readonly (TeamBattleEvent | DoubleBattleEvent)[]) => void;
  readonly onBattleReplacementResolved: (battleId: string, before: TeamBattleState, state: TeamBattleState,
    events: readonly TeamBattleEvent[]) => void;
  readonly onBattleEscaped: (battleId: string, state: TeamBattleState) => void;
  readonly onBattleRestoredFinished: (battleId: string, state: TeamBattleState, escaped: boolean) => void;
  readonly onBattleSettlement: (settlement: SourceBattleSettlement) => boolean;
  readonly onBattleClosed: (battleId: string) => void;
  readonly onRender: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Keeps any nonparticipant in the overworld until they explicitly join or observe a source battle. */
export function roomSnapshotForPlayer(snapshot: RoomSnapshot, playerId: string,
  _side: "player" | "opponent"): RoomSnapshot {
  const battle = snapshot.battle;
  if (battle?.sourceContext === null || battle?.sourceContext === undefined
    || battle.participation === null || (battle.observerIds ?? []).includes(playerId)
    || Object.values(battle.participation.camps).some((camp) => camp.trainerIds.includes(playerId))) {
    return snapshot;
  }
  return { ...snapshot, phase: "waiting", battle: null };
}

export class OverworldNetworkSession {
  private activeSession: MutableNetworkSession | null = null;
  private connectionPending = false;

  public constructor(
    private readonly storageKey: string,
    private readonly callbacks: NetworkSessionCallbacks,
  ) {}

  public get active(): boolean {
    return this.activeSession !== null;
  }

  public get current(): NetworkSessionView | null {
    return this.activeSession;
  }

  public async createOrJoin(kind: "create" | "join", rawServerUrl: string, rawRoomCode: string,
    profile: NetworkPlayerProfile, sourceWorld: SourceWorldHostState | null = null): Promise<void> {
    if (this.connectionPending) {
      this.setStatus("Connexion…", "Une demande de connexion est déjà en cours.");
      return;
    }
    this.connectionPending = true;
    try {
      const serverUrl = normalizeServerUrl(rawServerUrl);
      const path = kind === "create" ? "/api/rooms" : `/api/rooms/${normalizeRoomCode(rawRoomCode)}/join`;
      const validatedSourceWorld = sourceWorld === null ? null : parseSourceWorldHostState(sourceWorld);
      const response = await fetch(`${serverUrl}${path}`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(kind === "create" ? { profile, sourceWorld: validatedSourceWorld } : { profile }) });
      const value: unknown = await response.json();
      if (!response.ok) throw new Error(isRecord(value) && typeof value.error === "string" ? value.error : `HTTP ${response.status}`);
      this.connect(serverUrl, parseTicket(value), profile);
    } catch (error) {
      this.setStatus("Erreur", error instanceof Error ? error.message : "Connexion impossible.");
    } finally {
      this.connectionPending = false;
    }
  }

  public restore(profile: NetworkPlayerProfile): void {
    const storedPayload = sessionStorage.getItem(this.storageKey);
    if (storedPayload === null) return;
    try {
      const stored = parseStoredSession(storedPayload);
      this.connect(stored.serverUrl, stored.ticket, profile);
    } catch {
      sessionStorage.removeItem(this.storageKey);
      this.setStatus("Local", "La session mémorisée était invalide et a été supprimée.");
    }
  }

  public disconnect(): void {
    const session = this.activeSession;
    this.activeSession = null;
    if (session !== null) {
      session.userDisconnected = true;
      if (session.reconnectTimer !== null) window.clearTimeout(session.reconnectTimer);
      if (session.socket?.readyState === WebSocket.OPEN) {
        session.socket.send(JSON.stringify({ type: "leaveRoom", version: PROTOCOL_VERSION,
          requestId: crypto.randomUUID() }));
      }
      session.socket?.close(1000, "Retour au mode local");
    }
    sessionStorage.removeItem(this.storageKey);
    this.setStatus("Local", "Lance le Worker pour synchroniser deux navigateurs.");
  }

  public sendMovement(playerId: string, direction: Direction,
    intent: Omit<SourceMovementIntent, "direction"> = {}): boolean {
    const session = this.activeSession;
    if (session === null || session.snapshot?.battle !== null && session.snapshot !== null) return false;
    const socket = session.socket;
    if (playerId !== session.ticket.side || socket === null || socket.readyState !== WebSocket.OPEN
      || session.pendingMovementSequence !== null) return false;
    const now = performance.now();
    if (now - session.lastSentAt < 70) return false;
    session.lastSentAt = now;
    session.sequence += 1;
    session.pendingMovementSequence = session.sequence;
    socket.send(JSON.stringify({
      type: "moveAvatar",
      version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(),
      direction,
      sequence: session.sequence,
      ...intent,
    }));
    return true;
  }

  public sendInteraction(playerId: "player" | "opponent"): void {
    const session = this.activeSession;
    if (session === null || session.snapshot?.battle !== null && session.snapshot !== null) return;
    const socket = session.socket;
    if (playerId !== session.ticket.side || socket === null || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "interact", version: PROTOCOL_VERSION, requestId: crypto.randomUUID() }));
  }

  public updateProfile(profile: NetworkPlayerProfile): void {
    const session = this.activeSession;
    if (session === null) return;
    session.profile = profile;
    const socket = session.socket;
    if (socket === null || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "setProfile", version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(), profile }));
  }

  public publishSourceWorld(world: SourceWorldHostState, relocateHost = false): void {
    const session = this.activeSession;
    const socket = session?.socket;
    if (session === null || session.ticket.side !== "player" || socket === null || socket === undefined
      || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "setSourceWorld", version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(), world, relocateHost }));
  }

  public setSourcePresence(attached: boolean, avatar: SourceAvatarSnapshot | null): void {
    const session = this.activeSession;
    const socket = session?.socket;
    if (session === null || session.ticket.side !== "opponent" || socket === null || socket === undefined
      || socket.readyState !== WebSocket.OPEN) return;
    const publicAvatar = avatar === null ? null : { x: avatar.x, y: avatar.y, direction: avatar.direction,
      ...(avatar.mode === undefined ? {} : { mode: avatar.mode }),
      ...(avatar.action === undefined ? {} : { action: avatar.action }) };
    socket.send(JSON.stringify({ type: "setSourcePresence", version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(), attached, avatar: publicAvatar }));
  }

  public publishSourceScene(scene: SourceSceneSnapshot): boolean {
    const session = this.activeSession;
    const socket = session?.socket;
    if (session === null || session.ticket.side !== "player" || session.confirmedSourceMapId !== scene.mapId
      || socket === null || socket === undefined || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type: "setSourceScene", version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(), scene }));
    return true;
  }

  public publishSourceFollower(species: string | null, appearance?: SourceFollowerSnapshot["appearance"]): void {
    const session = this.activeSession;
    const socket = session?.socket;
    const signature = JSON.stringify({ species, appearance });
    if (session === null || session.sourceFollowerSignature === signature || socket === null || socket === undefined
      || socket.readyState !== WebSocket.OPEN) return;
    session.sourceFollowerSignature = signature;
    socket.send(JSON.stringify({ type: "setSourceFollower", version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(), species, ...(appearance === undefined ? {} : { appearance }) }));
  }

  public challengePlayer(team: BattleTeam): void {
    this.sendRequest({ type: "challengePlayer", team });
  }

  public respondPlayerChallenge(accept: boolean, team: BattleTeam | null): void {
    this.sendRequest({ type: "respondPlayerChallenge", accept, team });
  }

  public publishSourceActors(mapId: number, actors: readonly SourceWorldActorSnapshot[]): void {
    const session = this.activeSession;
    const socket = session?.socket;
    const signature = JSON.stringify({ mapId, actors });
    if (session === null || session.ticket.side !== "player" || session.confirmedSourceMapId !== mapId
      || session.sourceActorSignature === signature
      || socket === null || socket === undefined || socket.readyState !== WebSocket.OPEN) return;
    session.sourceActorSignature = signature;
    socket.send(JSON.stringify({ type: "setSourceActors", version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(), mapId, actors }));
  }

  public retryBattleSettlement(): void {
    const session = this.activeSession;
    if (session?.pendingSettlement !== null && session?.pendingSettlement !== undefined) {
      this.applyBattleSettlement(session, session.pendingSettlement);
    }
  }

  private applyBattleSettlement(session: MutableNetworkSession, settlement: SourceBattleSettlement): void {
    if (settlement.ownerId !== session.ticket.playerId) throw new Error("Règlement de combat destiné à un autre joueur.");
    session.pendingSettlement = settlement;
    if (!this.callbacks.onBattleSettlement(settlement)) {
      this.setStatus("Règlement en attente", "Les données Pokémon locales ne sont pas encore disponibles.");
      return;
    }
    session.pendingSettlement = null;
    const socket = session.socket;
    if (socket === null || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "ackBattleSettlement", version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(), settlementId: settlement.settlementId }));
  }

  /** Publishes host battles and shared-map guest wild encounters to the authoritative room. */
  public openSourceBattle(draft: SourceBattleNetworkDraft): boolean {
    const session = this.activeSession;
    const socket = session?.socket;
    const guestWild = session?.ticket.side === "opponent" && draft.context.origin === "source-wild";
    const sharedMap = session?.snapshot?.sourceWorld?.mapId === draft.context.mapId
      && session.snapshot.sourceWorld.presence[session.ticket.side] === "shared";
    const guestAwayWild = guestWild && session?.snapshot?.sourceWorld?.presence.opponent === "away";
    if (session === null || session.roomBattleActive || session.snapshot?.battle !== null
      || session.ticket.side !== "player" && !guestWild
      || !sharedMap && !guestAwayWild || socket === null || socket === undefined
      || socket.readyState !== WebSocket.OPEN) return false;
    const threeMemberTeam = (team: BattleTeam): BattleTeam => {
      const ordered = [team.members[team.activeIndex]!, ...team.members.filter((_, index) => index !== team.activeIndex)];
      return { activeIndex: 0, members: ordered.slice(0, 3) };
    };
    const playerTeam = threeMemberTeam(draft.playerTeam);
    const opponentTeam = threeMemberTeam(draft.opponentTeam);
    const opponentIds = new Set(opponentTeam.members.map((member) => member.id));
    const context = { ...draft.context, narrativeOwnerId: session.ticket.playerId,
      rewards: { ...draft.context.rewards,
        opponents: draft.context.rewards.opponents.filter((opponent) => opponentIds.has(opponent.memberId)) } };
    socket.send(JSON.stringify({ type: "openSourceBattle", version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(), context, playerTeam, opponentTeam }));
    return true;
  }

  public proposeBattleJoin(side: "player" | "opponent", team: BattleTeam,
    finalMemberIds: readonly string[]): void {
    const battleId = this.activeSession?.snapshot?.battle?.id ?? this.activeSession?.joinableBattle?.id;
    if (battleId !== undefined) this.sendRequest({ type: "proposeBattleJoin", battleId, side, team, finalMemberIds });
  }

  public respondBattleJoin(accept: boolean): void {
    const battleId = this.activeSession?.snapshot?.battle?.id;
    if (battleId !== undefined) this.sendRequest({ type: "respondBattleJoin", battleId, accept });
  }

  public observeBattle(): void {
    const battleId = this.activeSession?.snapshot?.battle?.id;
    if (battleId !== undefined) this.sendRequest({ type: "observeBattle", battleId });
  }

  public closeBattleJoinWindow(): void {
    const battleId = this.activeSession?.snapshot?.battle?.id;
    if (battleId !== undefined) this.sendRequest({ type: "closeBattleJoinWindow", battleId });
  }

  public leaveBattle(): void {
    const battleId = this.activeSession?.snapshot?.battle?.id;
    if (battleId !== undefined) this.sendRequest({ type: "leaveBattle", battleId });
  }

  public submitBattleAction(action: TeamBattleAction, activeSlot = 0): void {
    const session = this.activeSession;
    const battle = session?.snapshot?.battle;
    const socket = session?.socket;
    if (session === null || battle === null || battle === undefined || socket === null || socket === undefined
      || socket.readyState !== WebSocket.OPEN) return;
    session.submittedTurn = battle.state.turn;
    if (!session.submittedActiveSlots.includes(activeSlot)) session.submittedActiveSlots.push(activeSlot);
    socket.send(JSON.stringify({
      type: "submitAction",
      version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(),
      battleId: battle.id,
      turn: battle.state.turn,
      activeSlot,
      action,
    }));
    this.callbacks.onRender();
  }

  public submitBattleReplacement(teamIndex: number, activeSlot = 0): void {
    const session = this.activeSession;
    const battle = session?.snapshot?.battle;
    const socket = session?.socket;
    if (session === null || battle === null || battle === undefined || socket === null || socket === undefined
      || socket.readyState !== WebSocket.OPEN) return;
    session.submittedTurn = battle.state.turn;
    if (!session.submittedActiveSlots.includes(activeSlot)) session.submittedActiveSlots.push(activeSlot);
    socket.send(JSON.stringify({ type: "submitReplacement", version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(), battleId: battle.id, turn: battle.state.turn, teamIndex, activeSlot }));
    this.callbacks.onRender();
  }

  public attemptBattleEscape(): void {
    const session = this.activeSession;
    const battle = session?.snapshot?.battle;
    const socket = session?.socket;
    if (session === null || battle === null || battle === undefined || socket === null || socket === undefined
      || socket.readyState !== WebSocket.OPEN) return;
    session.submittedTurn = battle.state.turn;
    socket.send(JSON.stringify({ type: "attemptBattleEscape", version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(), battleId: battle.id, turn: battle.state.turn }));
    this.callbacks.onRender();
  }

  public closeSourceBattle(battleId: string): void {
    const session = this.activeSession;
    const battle = session?.snapshot?.battle;
    const socket = session?.socket;
    if (session === null || battle?.id !== battleId || battle.sourceContext === null
      || battle.session.lifecycle !== "settling" || session.ticket.playerId !== battle.session.narrativeOwnerId
      || session.closingBattleId === battleId || socket === null || socket === undefined
      || socket.readyState !== WebSocket.OPEN) return;
    session.closingBattleId = battleId;
    this.sendRequest({ type: "closeSourceBattle", battleId });
  }

  private sendRequest(message: Record<string, unknown>): void {
    const socket = this.activeSession?.socket;
    if (socket === null || socket === undefined || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ ...message, version: PROTOCOL_VERSION, requestId: crypto.randomUUID() }));
  }

  private connect(serverUrl: string, ticket: MultiplayerTicket, profile: NetworkPlayerProfile): void {
    const previous = this.activeSession;
    if (previous !== null) {
      previous.userDisconnected = true;
      if (previous.reconnectTimer !== null) window.clearTimeout(previous.reconnectTimer);
      previous.socket?.close(1000, "Nouvelle session");
    }
    const normalizedServerUrl = normalizeServerUrl(serverUrl);
    const session: MutableNetworkSession = {
      serverUrl: normalizedServerUrl,
      ticket,
      socket: null,
      sequence: 0,
      pendingMovementSequence: null,
      revision: 0,
      lastSentAt: 0,
      reconnectAttempt: 0,
      reconnectTimer: null,
      userDisconnected: false,
      snapshot: null,
      submittedTurn: null,
      submittedActiveSlots: [],
      profile,
      sourceFollowerSignature: undefined,
      sourceActorSignature: undefined,
      confirmedSourceMapId: null,
      pendingSettlement: null,
      closingBattleId: null,
      roomBattleActive: false,
      joinableBattle: null,
    };
    this.activeSession = session;
    sessionStorage.setItem(this.storageKey, JSON.stringify({ serverUrl: normalizedServerUrl, ticket } satisfies StoredOverworldSession));
    this.callbacks.onConnectionFormChanged(normalizedServerUrl, ticket.roomCode);
    this.openSocket(session);
  }

  private applySnapshot(snapshot: RoomSnapshot, animate: boolean): void {
    const session = this.activeSession;
    if (session !== null && snapshot.revision < session.revision) return;
    if (session !== null) {
      session.roomBattleActive = snapshot.battle !== null;
      const rawBattle = snapshot.battle;
      snapshot = roomSnapshotForPlayer(snapshot, session.ticket.playerId, session.ticket.side);
      session.joinableBattle = snapshot.battle === null && rawBattle?.state.status === "active"
        && !rawBattle.escaped ? rawBattle : null;
      const previousBattle = session.snapshot?.battle ?? null;
      const pendingMovementSequence = session.pendingMovementSequence;
      const ownMovementSequence = snapshot.movementSequences[session.ticket.side];
      const applyOwnAvatar = pendingMovementSequence === null || ownMovementSequence >= pendingMovementSequence;
      session.revision = snapshot.revision;
      session.sequence = Math.max(session.sequence, ownMovementSequence);
      if (session.pendingMovementSequence !== null
        && ownMovementSequence >= session.pendingMovementSequence) {
        session.pendingMovementSequence = null;
      }
      session.snapshot = snapshot;
      session.confirmedSourceMapId = snapshot.sourceWorld?.mapId ?? null;
      if (previousBattle === null && snapshot.battle !== null) {
        this.callbacks.onBattleStarted(snapshot.battle.id, snapshot.battle.state);
        if (snapshot.battle.state.status === "finished" || snapshot.battle.escaped) {
          this.callbacks.onBattleRestoredFinished(snapshot.battle.id, snapshot.battle.state,
            snapshot.battle.escaped);
        }
      } else if (previousBattle !== null && snapshot.battle === null) {
        session.closingBattleId = null;
        this.callbacks.onBattleClosed(previousBattle.id);
      } else if (previousBattle !== null && snapshot.battle !== null
        && previousBattle.id === snapshot.battle.id
        && previousBattle.sourceContext?.origin === "source-trainer"
        && previousBattle.session.lifecycle === "join-window"
        && snapshot.battle.session.lifecycle !== "join-window") {
        this.callbacks.onBattleStarted(snapshot.battle.id, snapshot.battle.state);
      } else if (previousBattle !== null && snapshot.battle !== null
        && previousBattle.id === snapshot.battle.id
        && previousBattle.state.format !== "double" && snapshot.battle.state.format === "double") {
        this.callbacks.onBattleExpanded(snapshot.battle.id, previousBattle.state, snapshot.battle.state);
      }
      if (snapshot.battle === null || snapshot.battle.state.turn !== session.submittedTurn) {
        session.submittedTurn = null;
        session.submittedActiveSlots = [];
      } else if (session.submittedActiveSlots.length === 0
        && snapshot.battle.escapeConfirmations?.includes(session.ticket.playerId) !== true) {
        session.submittedTurn = null;
      }
      const own = snapshot.world.avatars[session.ticket.side];
      if (snapshot.sourceWorld !== null) this.callbacks.onSourceWorldState(snapshot.sourceWorld, animate, applyOwnAvatar);
      else if (own !== undefined) this.callbacks.onMapChanged(own.mapId);
      if (snapshot.sourceScene !== null) this.callbacks.onSourceSceneState(snapshot.sourceScene);
    }
    this.callbacks.onPlayersChanged(snapshot.players);
    this.callbacks.onWorldState(snapshot.world, animate);
  }

  private scheduleReconnect(session: MutableNetworkSession): void {
    if (this.activeSession !== session || session.userDisconnected || session.reconnectTimer !== null) return;
    const delay = reconnectDelay(session.reconnectAttempt);
    session.reconnectAttempt += 1;
    this.setStatus("Reconnexion…", `Room ${session.ticket.roomCode} · nouvelle tentative dans ${delay / 1_000} s.`);
    session.reconnectTimer = window.setTimeout(() => {
      session.reconnectTimer = null;
      if (this.activeSession === session && !session.userDisconnected) this.openSocket(session);
    }, delay);
  }

  private openSocket(session: MutableNetworkSession): void {
    if (this.activeSession !== session || session.userDisconnected) return;
    const socket = new WebSocket(buildWebSocketUrl(session.serverUrl, session.ticket));
    session.socket = socket;
    this.setStatus("Connexion…", `Room ${session.ticket.roomCode} · ouverture du WebSocket.`);
    socket.addEventListener("open", () => {
      if (this.activeSession !== session || session.socket !== socket) return;
      this.setStatus("Synchronisation…", `Room ${session.ticket.roomCode} · récupération de l'état autoritaire.`);
    });
    socket.addEventListener("message", (event) => {
      try {
        if (this.activeSession !== session || session.socket !== socket) return;
        if (typeof event.data !== "string") throw new Error("Message binaire inattendu.");
        const message = parseServerMessage(event.data);
        if (message.type === "welcome") {
          if (message.playerId !== session.ticket.playerId || message.side !== session.ticket.side) {
            session.userDisconnected = true;
            socket.close(4003, "Ticket incohérent");
            throw new Error("Le serveur a renvoyé une place différente du ticket.");
          }
          session.reconnectAttempt = 0;
          this.applySnapshot(message.snapshot, false);
          if (message.settlement !== null) this.applyBattleSettlement(session, message.settlement);
          this.updateProfile(session.profile);
          this.setStatus(session.ticket.side === "player" ? "Joueur 1" : "Joueur 2", `Room ${session.ticket.roomCode} restaurée. Le serveur contrôle les déplacements.`);
        } else if (message.type === "snapshot") {
          this.applySnapshot(message.snapshot, false);
        } else if (message.type === "worldUpdated") {
          if (message.revision < session.revision) return;
          session.revision = message.revision;
          if (message.side === session.ticket.side) {
            session.sequence = Math.max(session.sequence, message.sequence);
            if (session.pendingMovementSequence !== null && message.sequence >= session.pendingMovementSequence) {
              session.pendingMovementSequence = null;
            }
          }
          this.callbacks.onEvents(message.events);
          const own = message.state.avatars[session.ticket.side];
          if (own !== undefined) this.callbacks.onMapChanged(own.mapId);
          this.callbacks.onWorldState(message.state, true);
        } else if (message.type === "interactionUpdated") {
          if (message.revision < session.revision) return;
          session.revision = message.revision;
          this.callbacks.onEvents(message.events);
          this.callbacks.onWorldState(message.state, false);
        } else if (message.type === "sourceWorldUpdated") {
          if (message.revision < session.revision) return;
          session.revision = message.revision;
          session.confirmedSourceMapId = message.state.mapId;
          if (message.side === session.ticket.side) {
            session.sequence = Math.max(session.sequence, message.sequence);
            if (session.pendingMovementSequence !== null && message.sequence >= session.pendingMovementSequence) {
              session.pendingMovementSequence = null;
            }
          }
          if (session.snapshot !== null) session.snapshot = { ...session.snapshot, sourceWorld: message.state,
            revision: message.revision };
          this.callbacks.onSourceWorldState(message.state, true, message.side === session.ticket.side);
        } else if (message.type === "sourceActorsUpdated") {
          if (message.revision < session.revision) return;
          session.revision = message.revision;
          const sourceWorld = session.snapshot?.sourceWorld;
          if (session.snapshot !== null && sourceWorld !== null && sourceWorld !== undefined
            && sourceWorld.mapId === message.mapId && message.actorRevision >= sourceWorld.actorRevision) {
            session.snapshot = { ...session.snapshot, revision: message.revision,
              sourceWorld: { ...sourceWorld, actors: message.actors, actorRevision: message.actorRevision } };
          }
          this.callbacks.onSourceActorsState(message.mapId, message.actorRevision, message.actors);
        } else if (message.type === "sourceSceneUpdated") {
          if (message.revision < session.revision) return;
          session.revision = message.revision;
          if (session.snapshot !== null) session.snapshot = { ...session.snapshot, sourceScene: message.state,
            revision: message.revision };
          this.callbacks.onSourceSceneState(message.state);
        } else if (message.type === "turnResolved") {
          const snapshot = session.snapshot;
          if (snapshot?.battle?.id !== message.battleId) return;
          const before = snapshot.battle.state;
          session.snapshot = {
            ...snapshot,
            phase: message.state.status === "finished" ? "finished" : "battle",
            battle: { ...snapshot.battle, state: message.state },
          };
          session.submittedTurn = null;
          session.submittedActiveSlots = [];
          this.callbacks.onBattleTurnResolved(message.battleId, before, message.state, message.events);
          this.setStatus(message.state.status === "finished" ? "Combat terminé" : "Combat", message.state.status === "finished"
            ? `Victoire : ${message.state.winner}. Retour dans le monde…`
            : `Tour ${message.state.turn} prêt.`);
          this.callbacks.onRender();
        } else if (message.type === "replacementResolved") {
          const snapshot = session.snapshot;
          if (snapshot?.battle?.id !== message.battleId) return;
          const before = snapshot.battle.state;
          session.snapshot = { ...snapshot,
            battle: { ...snapshot.battle, state: message.state } };
          session.submittedTurn = null;
          session.submittedActiveSlots = [];
          this.callbacks.onBattleReplacementResolved(message.battleId, before, message.state, message.events);
          this.callbacks.onRender();
        } else if (message.type === "battleEscaped") {
          const snapshot = session.snapshot;
          if (snapshot?.battle?.id !== message.battleId) return;
          session.snapshot = { ...snapshot, phase: "finished",
            battle: { ...snapshot.battle, escaped: true } };
          session.submittedTurn = null;
          session.submittedActiveSlots = [];
          this.callbacks.onBattleEscaped(message.battleId, snapshot.battle.state);
          this.setStatus("Fuite réussie", "Retour au monde de l'hôte en préparation.");
          this.callbacks.onRender();
        } else if (message.type === "battleSettlement") {
          this.applyBattleSettlement(session, message.settlement);
        } else if (message.type === "error") {
          session.submittedTurn = null;
          session.submittedActiveSlots = [];
          session.pendingMovementSequence = null;
          session.closingBattleId = null;
          this.setStatus("Erreur", `${message.code} · ${message.message}`);
        }
      } catch (error) {
        this.setStatus("Erreur", error instanceof Error ? error.message : "Message réseau invalide.");
      }
    });
    socket.addEventListener("close", (event) => {
      if (this.activeSession !== session || session.socket !== socket) return;
      session.socket = null;
      session.closingBattleId = null;
      if (event.code === 4001) {
        session.userDisconnected = true;
        this.setStatus("Remplacé", "Ce ticket a été ouvert dans une autre page.");
      } else {
        this.scheduleReconnect(session);
      }
      this.callbacks.onRender();
    });
    socket.addEventListener("error", () => {
      if (this.activeSession === session && session.socket === socket) {
        this.setStatus("Erreur réseau", "Le Worker est indisponible ; reconnexion automatique en attente.");
      }
    });
    this.callbacks.onRender();
  }

  private setStatus(state: string, notice: string): void {
    this.callbacks.onStatus(state, notice, this.active);
  }
}
