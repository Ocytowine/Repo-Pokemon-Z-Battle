import { type Direction, type OverworldEvent, type OverworldState } from "@pokemon-z-battle/overworld-engine";
import { PROTOCOL_VERSION, normalizeRoomCode, type NetworkPlayerProfile, type RoomPlayerSnapshot,
  type RoomSnapshot, type SourceAvatarSnapshot, type SourceWorldHostState, type SourceWorldSnapshot } from "@pokemon-z-battle/multiplayer-protocol";
import type { SourceSceneSnapshot } from "@pokemon-z-battle/multiplayer-protocol";
import type { BattleTeam, TeamBattleAction, TeamBattleEvent, TeamBattleState } from "@pokemon-z-battle/battle-engine";
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
  profile: NetworkPlayerProfile;
  sourceFollowerSpecies: string | null | undefined;
}

export interface NetworkSessionView {
  readonly ticket: MultiplayerTicket;
  readonly snapshot: RoomSnapshot | null;
  readonly submittedTurn: number | null;
}

export interface NetworkSessionCallbacks {
  readonly onStatus: (state: string, notice: string, active: boolean) => void;
  readonly onWorldState: (state: OverworldState, animate: boolean) => void;
  readonly onEvents: (events: readonly OverworldEvent[]) => void;
  readonly onMapChanged: (mapId: string) => void;
  readonly onConnectionFormChanged: (serverUrl: string, roomCode: string) => void;
  readonly onPlayersChanged: (players: readonly RoomPlayerSnapshot[]) => void;
  readonly onSourceWorldState: (state: SourceWorldSnapshot, animate: boolean, applyOwnAvatar: boolean) => void;
  readonly onSourceSceneState: (state: SourceSceneSnapshot) => void;
  readonly onBattleStarted: (battleId: string, state: TeamBattleState) => void;
  readonly onBattleTurnResolved: (battleId: string, before: TeamBattleState, state: TeamBattleState,
    events: readonly TeamBattleEvent[]) => void;
  readonly onBattleReplacementResolved: (battleId: string, before: TeamBattleState, state: TeamBattleState,
    events: readonly TeamBattleEvent[]) => void;
  readonly onBattleClosed: (battleId: string) => void;
  readonly onRender: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class OverworldNetworkSession {
  private activeSession: MutableNetworkSession | null = null;

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
    try {
      const serverUrl = normalizeServerUrl(rawServerUrl);
      const path = kind === "create" ? "/api/rooms" : `/api/rooms/${normalizeRoomCode(rawRoomCode)}/join`;
      const response = await fetch(`${serverUrl}${path}`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(kind === "create" ? { profile, sourceWorld } : { profile }) });
      const value: unknown = await response.json();
      if (!response.ok) throw new Error(isRecord(value) && typeof value.error === "string" ? value.error : `HTTP ${response.status}`);
      this.connect(serverUrl, parseTicket(value), profile);
    } catch (error) {
      this.setStatus("Erreur", error instanceof Error ? error.message : "Connexion impossible.");
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
      session.socket?.close(1000, "Retour au mode local");
    }
    sessionStorage.removeItem(this.storageKey);
    this.setStatus("Local", "Lance le Worker pour synchroniser deux navigateurs.");
  }

  public sendMovement(playerId: string, direction: Direction): boolean {
    const session = this.activeSession;
    if (session === null || session.snapshot?.battle !== null && session.snapshot !== null) return false;
    const socket = session.socket;
    if (playerId !== session.ticket.side || socket === null || socket.readyState !== WebSocket.OPEN
      || session.pendingMovementSequence !== null) return false;
    const now = performance.now();
    if (now - session.lastSentAt < 120) return false;
    session.lastSentAt = now;
    session.sequence += 1;
    session.pendingMovementSequence = session.sequence;
    socket.send(JSON.stringify({
      type: "moveAvatar",
      version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(),
      direction,
      sequence: session.sequence,
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

  public publishSourceWorld(world: SourceWorldHostState): void {
    const session = this.activeSession;
    const socket = session?.socket;
    if (session === null || session.ticket.side !== "player" || socket === null || socket === undefined
      || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "setSourceWorld", version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(), world }));
  }

  public setSourcePresence(attached: boolean, avatar: SourceAvatarSnapshot | null): void {
    const session = this.activeSession;
    const socket = session?.socket;
    if (session === null || session.ticket.side !== "opponent" || socket === null || socket === undefined
      || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "setSourcePresence", version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(), attached, avatar }));
  }

  public publishSourceScene(scene: SourceSceneSnapshot): void {
    const session = this.activeSession;
    const socket = session?.socket;
    if (session === null || session.ticket.side !== "player" || socket === null || socket === undefined
      || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "setSourceScene", version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(), scene }));
  }

  public publishSourceFollower(species: string | null): void {
    const session = this.activeSession;
    const socket = session?.socket;
    if (session === null || session.sourceFollowerSpecies === species || socket === null || socket === undefined
      || socket.readyState !== WebSocket.OPEN) return;
    session.sourceFollowerSpecies = species;
    socket.send(JSON.stringify({ type: "setSourceFollower", version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(), species }));
  }

  public challengePlayer(team: BattleTeam): void {
    this.sendRequest({ type: "challengePlayer", team });
  }

  public respondPlayerChallenge(accept: boolean, team: BattleTeam | null): void {
    this.sendRequest({ type: "respondPlayerChallenge", accept, team });
  }

  public leaveBattle(): void {
    const battleId = this.activeSession?.snapshot?.battle?.id;
    if (battleId !== undefined) this.sendRequest({ type: "leaveBattle", battleId });
  }

  public submitBattleAction(action: TeamBattleAction): void {
    const session = this.activeSession;
    const battle = session?.snapshot?.battle;
    const socket = session?.socket;
    if (session === null || battle === null || battle === undefined || socket === null || socket === undefined
      || socket.readyState !== WebSocket.OPEN) return;
    session.submittedTurn = battle.state.turn;
    socket.send(JSON.stringify({
      type: "submitAction",
      version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(),
      battleId: battle.id,
      turn: battle.state.turn,
      action,
    }));
    this.callbacks.onRender();
  }

  public submitBattleReplacement(teamIndex: number): void {
    const session = this.activeSession;
    const battle = session?.snapshot?.battle;
    const socket = session?.socket;
    if (session === null || battle === null || battle === undefined || socket === null || socket === undefined
      || socket.readyState !== WebSocket.OPEN) return;
    session.submittedTurn = battle.state.turn;
    socket.send(JSON.stringify({ type: "submitReplacement", version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(), battleId: battle.id, turn: battle.state.turn, teamIndex }));
    this.callbacks.onRender();
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
      profile,
      sourceFollowerSpecies: undefined,
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
      if (previousBattle === null && snapshot.battle?.duel === true) {
        this.callbacks.onBattleStarted(snapshot.battle.id, snapshot.battle.state);
      } else if (previousBattle?.duel === true && snapshot.battle === null) {
        this.callbacks.onBattleClosed(previousBattle.id);
      }
      if (snapshot.battle === null || snapshot.battle.state.turn !== session.submittedTurn) session.submittedTurn = null;
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
          if (message.side === session.ticket.side) {
            session.sequence = Math.max(session.sequence, message.sequence);
            if (session.pendingMovementSequence !== null && message.sequence >= session.pendingMovementSequence) {
              session.pendingMovementSequence = null;
            }
          }
          if (session.snapshot !== null) session.snapshot = { ...session.snapshot, sourceWorld: message.state,
            revision: message.revision };
          this.callbacks.onSourceWorldState(message.state, true, message.side === session.ticket.side);
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
            battle: { id: message.battleId, state: message.state, duel: snapshot.battle.duel },
          };
          session.submittedTurn = null;
          if (snapshot.battle.duel) {
            this.callbacks.onBattleTurnResolved(message.battleId, before, message.state, message.events);
          }
          this.setStatus(message.state.status === "finished" ? "Combat terminé" : "Combat", message.state.status === "finished"
            ? `Victoire : ${message.state.winner}. Retour dans le monde…`
            : `Tour ${message.state.turn} prêt.`);
          this.callbacks.onRender();
        } else if (message.type === "replacementResolved") {
          const snapshot = session.snapshot;
          if (snapshot?.battle?.id !== message.battleId) return;
          const before = snapshot.battle.state;
          session.snapshot = { ...snapshot,
            battle: { id: message.battleId, state: message.state, duel: snapshot.battle.duel } };
          session.submittedTurn = null;
          if (snapshot.battle.duel) {
            this.callbacks.onBattleReplacementResolved(message.battleId, before, message.state, message.events);
          }
          this.callbacks.onRender();
        } else if (message.type === "error") {
          session.submittedTurn = null;
          session.pendingMovementSequence = null;
          this.setStatus("Erreur", `${message.code} · ${message.message}`);
        }
      } catch (error) {
        this.setStatus("Erreur", error instanceof Error ? error.message : "Message réseau invalide.");
      }
    });
    socket.addEventListener("close", (event) => {
      if (this.activeSession !== session || session.socket !== socket) return;
      session.socket = null;
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
