import { DEMO_WORLD_CATALOG, createDemoWorldState, resolveInteraction, resolveMovement, type Direction, type GridPoint, type OverworldEvent, type OverworldState, type WorldMap } from "@pokemon-z-battle/overworld-engine";
import { PROTOCOL_VERSION, normalizeRoomCode, type RoomSnapshot } from "@pokemon-z-battle/multiplayer-protocol";
import { buildWebSocketUrl, normalizeServerUrl, parseServerMessage, parseStoredSession, parseTicket, reconnectDelay, type MultiplayerTicket, type StoredOverworldSession } from "./multiplayer-client.js";
import "./style.css";

const TILE_SIZE = 48;
const STORED_SESSION_KEY = "pokemon-z-battle.overworld-session.v6";

const catalog = DEMO_WORLD_CATALOG;

let state: OverworldState = initialState();
let viewedMapId = "meadow";
let events: OverworldEvent[] = [];
type AvatarId = "player" | "opponent";

interface NetworkSession {
  readonly serverUrl: string;
  readonly ticket: MultiplayerTicket;
  socket: WebSocket | null;
  sequence: number;
  revision: number;
  lastSentAt: number;
  reconnectAttempt: number;
  reconnectTimer: number | null;
  userDisconnected: boolean;
  snapshot: RoomSnapshot | null;
  submittedTurn: number | null;
}

let network: NetworkSession | null = null;

function initialState(): OverworldState {
  return createDemoWorldState();
}

const root = document.querySelector<HTMLDivElement>("#app");
if (root === null) throw new Error("Application root is missing.");
root.innerHTML = `
  <header><div><p class="eyebrow">Phase 8.3 · parcours coop</p><h1>Overworld <span>Sandbox</span></h1></div><p>Interactions concurrentes, synchronisation, reconnexion et combats réunis dans un même monde autoritaire.</p></header>
  <main>
    <section class="world-panel">
      <div class="map-heading"><div><p class="eyebrow">Carte observée</p><h2 id="map-name"></h2></div><div class="map-tabs"><button data-map="meadow">Prairie</button><button data-map="grove">Bosquet</button></div></div>
      <canvas id="world" width="576" height="432" aria-label="Carte de test overworld"></canvas>
      <p class="legend"><span class="ground"></span>Sol <span class="wall"></span>Collision <span class="door"></span>Transition <span class="interaction"></span>Interaction</p>
    </section>
    <aside>
      <section class="panel"><div class="log-heading"><div><p class="eyebrow">Phases 7–8</p><h2>Monde en ligne</h2></div><span id="network-state">Local</span></div>
        <label class="field">Serveur<input id="server-url" value="http://127.0.0.1:8787"></label>
        <div class="network-row"><button id="create-room">Créer</button><input id="room-code" maxlength="6" placeholder="CODE"><button id="join-room">Rejoindre</button></div>
        <button id="disconnect" class="reset" disabled>Revenir au test local</button><p id="network-notice" class="network-notice">Lance le Worker pour synchroniser deux navigateurs.</p>
      </section>
      <section class="panel"><p class="eyebrow">Commandes</p><h2>Déplacements</h2><div class="players">
        <article data-controller="player"><strong>Joueur 1</strong><small>Flèches/ZQSD · Espace</small><div class="pad" data-player="player"><button data-direction="up">↑</button><button data-direction="left">←</button><button data-direction="down">↓</button><button data-direction="right">→</button></div><button class="interact-button" data-interact="player">Interagir</button></article>
        <article data-controller="opponent"><strong>Joueur 2</strong><small>I J K L · O</small><div class="pad" data-player="opponent"><button data-direction="up">↑</button><button data-direction="left">←</button><button data-direction="down">↓</button><button data-direction="right">→</button></div><button class="interact-button" data-interact="opponent">Interagir</button></article>
      </div><button id="reset" class="reset">Réinitialiser le monde</button></section>
      <section class="panel"><p class="eyebrow">Phase 8.3</p><h2>Parcours coop</h2><div id="coop-guide" class="coop-guide"></div></section>
      <section id="encounter-panel" class="panel encounter-panel" hidden><div class="log-heading"><div><p class="eyebrow">Rencontre autoritaire</p><h2 id="encounter-title">Combat</h2></div><span id="encounter-turn">Tour 1</span></div><p id="encounter-summary" class="network-notice"></p><div id="encounter-actions" class="encounter-actions"></div></section>
      <section class="panel"><div class="log-heading"><div><p class="eyebrow">Moteur</p><h2>Événements</h2></div><span id="tick">Tick 0</span></div><div id="progress" class="progress"></div><div id="events" class="events">Déplace un avatar pour commencer.</div></section>
    </aside>
  </main>`;

const canvasElement = document.querySelector<HTMLCanvasElement>("#world");
if (canvasElement === null) throw new Error("Canvas is unavailable.");
const drawingContext = canvasElement.getContext("2d");
if (drawingContext === null) throw new Error("Canvas 2D is unavailable.");
const canvas: HTMLCanvasElement = canvasElement;
const context: CanvasRenderingContext2D = drawingContext;
const renderPositions: Record<AvatarId, { mapId: string; x: number; y: number }> = {
  player: { ...state.avatars.player! },
  opponent: { ...state.avatars.opponent! },
};
let animationFrame: number | null = null;

function setAuthoritativeState(next: OverworldState, animate: boolean): void {
  const starts = {
    player: { ...renderPositions.player },
    opponent: { ...renderPositions.opponent },
  };
  state = next;
  if (animationFrame !== null) cancelAnimationFrame(animationFrame);
  const startedAt = performance.now();
  const frame = (now: number): void => {
    const progress = animate ? Math.min(1, (now - startedAt) / 110) : 1;
    for (const id of ["player", "opponent"] as const) {
      const target = state.avatars[id];
      if (target === undefined) continue;
      const start = starts[id];
      renderPositions[id] = start.mapId === target.mapId
        ? { mapId: target.mapId, x: start.x + (target.x - start.x) * progress, y: start.y + (target.y - start.y) * progress }
        : { mapId: target.mapId, x: target.x, y: target.y };
    }
    render();
    if (progress < 1) animationFrame = requestAnimationFrame(frame);
    else animationFrame = null;
  };
  animationFrame = requestAnimationFrame(frame);
}

function eventText(event: OverworldEvent): string {
  switch (event.type) {
    case "directionChanged": return `${event.playerId} regarde vers ${event.direction}`;
    case "movementBlocked": return `${event.playerId} bloqué (${event.reason}) en ${event.at.x},${event.at.y}`;
    case "avatarMoved": return `${event.playerId} avance vers ${event.to.x},${event.to.y}`;
    case "mapChanged": return `${event.playerId} passe de ${event.fromMapId} à ${event.toMapId}`;
    case "interactionUnavailable": return `${event.playerId} : interaction indisponible (${event.reason})`;
    case "interactionPending": return `${event.playerId} attend son partenaire (${event.participants.join(", ")})`;
    case "dialogueShown": return `${event.playerId} · ${event.text}`;
    case "itemGranted": return `${event.playerId} reçoit ${event.quantity} × ${event.itemId}`;
    case "flagSet": return `${event.playerId} active ${event.flag}`;
    case "encounterRequested": return `${event.playerId} déclenche ${event.kind} · ${event.encounterId}`;
    case "interactionCompleted": return `${event.interactionId} terminé [${event.policy}]`;
  }
}

function drawMap(map: WorldMap): void {
  context.clearRect(0, 0, canvas.width, canvas.height);
  const blocked = new Set(map.blocked.map((point) => `${point.x},${point.y}`));
  const transitions = new Set(map.transitions.map((entry) => `${entry.at.x},${entry.at.y}`));
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const key = `${x},${y}`;
      context.fillStyle = blocked.has(key) ? "#18392e" : transitions.has(key) ? "#e4b953" : (x + y) % 2 === 0 ? "#5b9d69" : "#559463";
      context.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      context.strokeStyle = "#0a211722";
      context.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      if (blocked.has(key)) {
        context.fillStyle = "#2d694b";
        context.beginPath(); context.arc(x * TILE_SIZE + 24, y * TILE_SIZE + 21, 15, 0, Math.PI * 2); context.fill();
        context.fillStyle = "#815f3a"; context.fillRect(x * TILE_SIZE + 20, y * TILE_SIZE + 28, 8, 14);
      }
      if (transitions.has(key)) {
        context.fillStyle = "#fff1ad"; context.fillRect(x * TILE_SIZE + 18, y * TILE_SIZE + 10, 12, 28);
      }
    }
  }
}

function drawInteractions(map: WorldMap): void {
  for (const interaction of catalog.interactions ?? []) {
    if (interaction.mapId !== map.id || state.session.completedInteractions.includes(interaction.id)) continue;
    const centerX = interaction.at.x * TILE_SIZE + TILE_SIZE / 2;
    const centerY = interaction.at.y * TILE_SIZE + TILE_SIZE / 2;
    context.fillStyle = interaction.kind === "npc" ? "#ffd166" : interaction.kind === "item" ? "#8be9fd" : "#c792ea";
    context.beginPath(); context.arc(centerX, centerY, interaction.kind === "npc" ? 12 : 8, 0, Math.PI * 2); context.fill();
    context.fillStyle = "#07110d"; context.font = "900 10px system-ui"; context.textAlign = "center"; context.fillText("!", centerX, centerY + 4);
  }
}

function drawAvatar(id: AvatarId, color: string): void {
  const avatar = state.avatars[id];
  const position = renderPositions[id];
  if (avatar === undefined || position.mapId !== viewedMapId) return;
  const centerX = position.x * TILE_SIZE + TILE_SIZE / 2;
  const centerY = position.y * TILE_SIZE + TILE_SIZE / 2;
  context.fillStyle = "#06130f99"; context.beginPath(); context.ellipse(centerX, centerY + 16, 15, 6, 0, 0, Math.PI * 2); context.fill();
  context.fillStyle = color; context.beginPath(); context.arc(centerX, centerY - 2, 15, 0, Math.PI * 2); context.fill();
  const offsets: Record<Direction, GridPoint> = { up: { x: 0, y: -8 }, down: { x: 0, y: 8 }, left: { x: -8, y: 0 }, right: { x: 8, y: 0 } };
  const eye = offsets[avatar.direction];
  context.fillStyle = "#07130e"; context.beginPath(); context.arc(centerX + eye.x, centerY - 2 + eye.y, 3, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#f7fff9"; context.font = "700 10px system-ui"; context.textAlign = "center"; context.fillText(avatar.name, centerX, centerY - 23);
}

function render(): void {
  const map = catalog.maps[viewedMapId];
  if (map === undefined) throw new Error(`Missing map ${viewedMapId}.`);
  drawMap(map); drawInteractions(map); drawAvatar("player", "#76e6bb"); drawAvatar("opponent", "#ff7c98");
  const name = document.querySelector<HTMLElement>("#map-name"); if (name !== null) name.textContent = map.name;
  const tick = document.querySelector<HTMLElement>("#tick"); if (tick !== null) tick.textContent = `Tick ${state.tick}`;
  const progress = document.querySelector<HTMLElement>("#progress");
  if (progress !== null) {
    const inventory = (id: AvatarId): string => Object.entries(state.players[id]?.inventory ?? {}).map(([item, quantity]) => `${item} ×${quantity}`).join(", ") || "vide";
    const result = state.session.battleResults.at(-1);
    progress.innerHTML = `<p><strong>J1</strong> ${inventory("player")}</p><p><strong>J2</strong> ${inventory("opponent")}</p><p><strong>Session</strong> ${state.session.flags.join(", ") || "aucun drapeau"}</p><p><strong>Combat</strong> ${result === undefined ? "aucun résultat" : `${result.kind} · ${result.winner} gagne`}</p>`;
  }
  const log = document.querySelector<HTMLElement>("#events");
  if (log !== null) log.innerHTML = events.length === 0 ? "Déplace un avatar pour commencer." : events.slice(-12).reverse().map((event) => `<p>${eventText(event)}</p>`).join("");
  document.querySelectorAll<HTMLButtonElement>("[data-map]").forEach((button) => button.classList.toggle("active", button.dataset.map === viewedMapId));
  document.querySelectorAll<HTMLElement>("[data-controller]").forEach((controller) => {
    const disabled = network !== null && controller.dataset.controller !== network.ticket.side;
    controller.classList.toggle("disabled", disabled);
  });
  const reset = document.querySelector<HTMLButtonElement>("#reset"); if (reset !== null) reset.disabled = network !== null;
  const create = document.querySelector<HTMLButtonElement>("#create-room"); if (create !== null) create.disabled = network !== null;
  const join = document.querySelector<HTMLButtonElement>("#join-room"); if (join !== null) join.disabled = network !== null;
  const guide = document.querySelector<HTMLElement>("#coop-guide");
  if (guide !== null) guide.innerHTML = (catalog.interactions ?? []).map((interaction) => {
    const personalDone = Object.values(state.players).filter((player) => player.completedInteractions.includes(interaction.id)).length;
    const sharedDone = state.session.completedInteractions.includes(interaction.id);
    const waiting = state.session.syncedParticipants[interaction.id]?.length ?? 0;
    const status = interaction.policy === "PERSONAL" ? `${personalDone}/2` : sharedDone ? "terminé" : waiting > 0 ? `${waiting}/2 en attente` : "disponible";
    return `<article><span>${interaction.policy}</span><strong>${interaction.label}</strong><small>${interaction.mapId} · ${status}</small></article>`;
  }).join("");
  renderEncounter();
}

function renderEncounter(): void {
  const panel = document.querySelector<HTMLElement>("#encounter-panel");
  const battle = network?.snapshot?.battle ?? null;
  if (panel === null) return;
  panel.hidden = battle === null;
  if (battle === null) return;
  const battleState = battle.state;
  const playerTeam = battleState.teams.player;
  const opponentTeam = battleState.teams.opponent;
  const player = playerTeam.members[playerTeam.activeIndex];
  const opponent = opponentTeam.members[opponentTeam.activeIndex];
  if (player === undefined || opponent === undefined) return;
  const title = document.querySelector<HTMLElement>("#encounter-title"); if (title !== null) title.textContent = `${player.name} contre ${opponent.name}`;
  const turn = document.querySelector<HTMLElement>("#encounter-turn"); if (turn !== null) turn.textContent = `Tour ${battleState.turn}`;
  const summary = document.querySelector<HTMLElement>("#encounter-summary");
  if (summary !== null) summary.textContent = `${player.hp}/${player.stats.maxHp} PV · ${opponent.hp}/${opponent.stats.maxHp} PV${network?.ticket.side === "opponent" ? " · observation" : ""}`;
  const actions = document.querySelector<HTMLElement>("#encounter-actions");
  if (actions !== null) {
    actions.innerHTML = player.moves.map((slot, index) => `<button data-encounter-move="${index}" ${network?.ticket.side !== "player" || network.submittedTurn === battleState.turn ? "disabled" : ""}>${slot.move.name}<small>${slot.pp} PP</small></button>`).join("");
    actions.querySelectorAll<HTMLButtonElement>("[data-encounter-move]").forEach((button) => button.addEventListener("click", () => {
      const moveIndex = Number(button.dataset.encounterMove);
      if (Number.isInteger(moveIndex)) submitEncounterAction(moveIndex);
    }));
  }
}

function move(playerId: string, direction: Direction): void {
  if (network !== null) {
    if (network.snapshot?.battle !== null && network.snapshot !== null) return;
    const socket = network.socket;
    if (playerId !== network.ticket.side || socket === null || socket.readyState !== WebSocket.OPEN) return;
    const now = performance.now();
    if (now - network.lastSentAt < 120) return;
    network.lastSentAt = now;
    network.sequence += 1;
    socket.send(JSON.stringify({ type: "moveAvatar", version: PROTOCOL_VERSION, requestId: crypto.randomUUID(), direction, sequence: network.sequence }));
    return;
  }
  const result = resolveMovement(catalog, state, { playerId, direction });
  events.push(...result.events);
  const avatar = result.state.avatars[playerId]; if (avatar !== undefined) viewedMapId = avatar.mapId;
  setAuthoritativeState(result.state, true);
}

function interact(playerId: AvatarId): void {
  if (network !== null) {
    if (network.snapshot?.battle !== null && network.snapshot !== null) return;
    const socket = network.socket;
    if (playerId !== network.ticket.side || socket === null || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "interact", version: PROTOCOL_VERSION, requestId: crypto.randomUUID() }));
    return;
  }
  const result = resolveInteraction(catalog, state, { playerId, hostPlayerId: "player" });
  events.push(...result.events);
  setAuthoritativeState(result.state, false);
}

function submitEncounterAction(moveIndex: number): void {
  const session = network;
  const battle = session?.snapshot?.battle;
  const socket = session?.socket;
  if (session === null || battle === null || battle === undefined || socket === null || socket === undefined || socket.readyState !== WebSocket.OPEN || session.ticket.side !== "player") return;
  session.submittedTurn = battle.state.turn;
  socket.send(JSON.stringify({ type: "submitAction", version: PROTOCOL_VERSION, requestId: crypto.randomUUID(), battleId: battle.id, turn: battle.state.turn, action: { kind: "move", moveIndex } }));
  render();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function setNetworkText(stateText: string, notice: string): void {
  const stateElement = document.querySelector<HTMLElement>("#network-state"); if (stateElement !== null) stateElement.textContent = stateText;
  const noticeElement = document.querySelector<HTMLElement>("#network-notice"); if (noticeElement !== null) noticeElement.textContent = notice;
  const disconnect = document.querySelector<HTMLButtonElement>("#disconnect"); if (disconnect !== null) disconnect.disabled = network === null;
}

function applySnapshot(snapshot: RoomSnapshot, animate: boolean): void {
  if (network !== null && snapshot.revision < network.revision) return;
  if (network !== null) {
    network.revision = snapshot.revision;
    network.sequence = Math.max(network.sequence, snapshot.movementSequences[network.ticket.side]);
    network.snapshot = snapshot;
    if (snapshot.battle === null || snapshot.battle.state.turn !== network.submittedTurn) network.submittedTurn = null;
  }
  const own = network === null ? undefined : snapshot.world.avatars[network.ticket.side];
  if (own !== undefined) viewedMapId = own.mapId;
  setAuthoritativeState(snapshot.world, animate);
}

function scheduleReconnect(session: NetworkSession): void {
  if (network !== session || session.userDisconnected || session.reconnectTimer !== null) return;
  const delay = reconnectDelay(session.reconnectAttempt);
  session.reconnectAttempt += 1;
  setNetworkText("Reconnexion…", `Room ${session.ticket.roomCode} · nouvelle tentative dans ${delay / 1_000} s.`);
  session.reconnectTimer = window.setTimeout(() => {
    session.reconnectTimer = null;
    if (network === session && !session.userDisconnected) openNetworkSocket(session);
  }, delay);
}

function openNetworkSocket(session: NetworkSession): void {
  if (network !== session || session.userDisconnected) return;
  const socket = new WebSocket(buildWebSocketUrl(session.serverUrl, session.ticket));
  session.socket = socket;
  setNetworkText("Connexion…", `Room ${session.ticket.roomCode} · ouverture du WebSocket.`);
  socket.addEventListener("open", () => {
    if (network !== session || session.socket !== socket) return;
    setNetworkText("Synchronisation…", `Room ${session.ticket.roomCode} · récupération de l'état autoritaire.`);
  });
  socket.addEventListener("message", (event) => {
    try {
      if (network !== session || session.socket !== socket) return;
      if (typeof event.data !== "string") throw new Error("Message binaire inattendu.");
      const message = parseServerMessage(event.data);
      if (message.type === "welcome") {
        if (message.playerId !== session.ticket.playerId || message.side !== session.ticket.side) {
          session.userDisconnected = true;
          socket.close(4003, "Ticket incohérent");
          throw new Error("Le serveur a renvoyé une place différente du ticket.");
        }
        session.reconnectAttempt = 0;
        applySnapshot(message.snapshot, false);
        setNetworkText(session.ticket.side === "player" ? "Joueur 1" : "Joueur 2", `Room ${session.ticket.roomCode} restaurée. Le serveur contrôle les déplacements.`);
      } else if (message.type === "snapshot") {
        applySnapshot(message.snapshot, false);
      } else if (message.type === "worldUpdated") {
        if (message.revision < session.revision) return;
        session.revision = message.revision;
        if (message.side === session.ticket.side) session.sequence = Math.max(session.sequence, message.sequence);
        events.push(...message.events);
        const own = message.state.avatars[session.ticket.side]; if (own !== undefined) viewedMapId = own.mapId;
        setAuthoritativeState(message.state, true);
      } else if (message.type === "interactionUpdated") {
        if (message.revision < session.revision) return;
        session.revision = message.revision;
        events.push(...message.events);
        setAuthoritativeState(message.state, false);
      } else if (message.type === "turnResolved") {
        const snapshot = session.snapshot;
        if (snapshot?.battle?.id !== message.battleId) return;
        session.snapshot = { ...snapshot, phase: message.state.status === "finished" ? "finished" : "battle", battle: { id: message.battleId, state: message.state } };
        session.submittedTurn = null;
        setNetworkText(message.state.status === "finished" ? "Combat terminé" : "Combat", message.state.status === "finished" ? `Victoire : ${message.state.winner}. Retour dans le monde…` : `Tour ${message.state.turn} prêt.`);
        render();
      } else if (message.type === "error") {
        session.submittedTurn = null;
        setNetworkText("Erreur", `${message.code} · ${message.message}`);
      }
    } catch (error) {
      setNetworkText("Erreur", error instanceof Error ? error.message : "Message réseau invalide.");
    }
  });
  socket.addEventListener("close", (event) => {
    if (network !== session || session.socket !== socket) return;
    session.socket = null;
    if (event.code === 4001) {
      session.userDisconnected = true;
      setNetworkText("Remplacé", "Ce ticket a été ouvert dans une autre page.");
    } else {
      scheduleReconnect(session);
    }
    render();
  });
  socket.addEventListener("error", () => {
    if (network === session && session.socket === socket) setNetworkText("Erreur réseau", "Le Worker est indisponible ; reconnexion automatique en attente.");
  });
  render();
}

function connect(serverUrl: string, ticket: MultiplayerTicket): void {
  const previous = network;
  if (previous !== null) {
    previous.userDisconnected = true;
    if (previous.reconnectTimer !== null) window.clearTimeout(previous.reconnectTimer);
    previous.socket?.close(1000, "Nouvelle session");
  }
  const normalizedServerUrl = normalizeServerUrl(serverUrl);
  const session: NetworkSession = {
    serverUrl: normalizedServerUrl,
    ticket,
    socket: null,
    sequence: 0,
    revision: 0,
    lastSentAt: 0,
    reconnectAttempt: 0,
    reconnectTimer: null,
    userDisconnected: false,
    snapshot: null,
    submittedTurn: null,
  };
  network = session;
  sessionStorage.setItem(STORED_SESSION_KEY, JSON.stringify({ serverUrl: normalizedServerUrl, ticket } satisfies StoredOverworldSession));
  const serverInput = document.querySelector<HTMLInputElement>("#server-url"); if (serverInput !== null) serverInput.value = normalizedServerUrl;
  const codeInput = document.querySelector<HTMLInputElement>("#room-code"); if (codeInput !== null) codeInput.value = ticket.roomCode;
  openNetworkSocket(session);
}

async function createOrJoin(kind: "create" | "join"): Promise<void> {
  try {
    const input = document.querySelector<HTMLInputElement>("#server-url");
    const codeInput = document.querySelector<HTMLInputElement>("#room-code");
    if (input === null || codeInput === null) return;
    const serverUrl = normalizeServerUrl(input.value);
    const path = kind === "create" ? "/api/rooms" : `/api/rooms/${normalizeRoomCode(codeInput.value)}/join`;
    const response = await fetch(`${serverUrl}${path}`, { method: "POST" });
    const value: unknown = await response.json();
    if (!response.ok) throw new Error(isRecord(value) && typeof value.error === "string" ? value.error : `HTTP ${response.status}`);
    const ticket = parseTicket(value);
    codeInput.value = ticket.roomCode;
    connect(serverUrl, ticket);
  } catch (error) {
    setNetworkText("Erreur", error instanceof Error ? error.message : "Connexion impossible.");
  }
}

const keys: Readonly<Record<string, readonly [string, Direction]>> = {
  ArrowUp: ["player", "up"], ArrowDown: ["player", "down"], ArrowLeft: ["player", "left"], ArrowRight: ["player", "right"],
  KeyW: ["player", "up"], KeyZ: ["player", "up"], KeyS: ["player", "down"], KeyA: ["player", "left"], KeyQ: ["player", "left"], KeyD: ["player", "right"],
  KeyI: ["opponent", "up"], KeyK: ["opponent", "down"], KeyJ: ["opponent", "left"], KeyL: ["opponent", "right"],
};
window.addEventListener("keydown", (event) => {
  if (event.code === "Space") { event.preventDefault(); interact("player"); return; }
  if (event.code === "KeyO") { event.preventDefault(); interact("opponent"); return; }
  const command = keys[event.code]; if (command === undefined) return; event.preventDefault(); move(...command);
});
document.querySelectorAll<HTMLButtonElement>(".pad button").forEach((button) => button.addEventListener("click", () => {
  const playerId = button.closest<HTMLElement>("[data-player]")?.dataset.player;
  const direction = button.dataset.direction as Direction | undefined;
  if (playerId !== undefined && direction !== undefined) move(playerId, direction);
}));
document.querySelectorAll<HTMLButtonElement>("[data-interact]").forEach((button) => button.addEventListener("click", () => {
  const playerId = button.dataset.interact;
  if (playerId === "player" || playerId === "opponent") interact(playerId);
}));
document.querySelectorAll<HTMLButtonElement>("[data-map]").forEach((button) => button.addEventListener("click", () => { if (button.dataset.map !== undefined) viewedMapId = button.dataset.map; render(); }));
document.querySelector<HTMLInputElement>("#room-code")?.addEventListener("input", (event) => {
  const input = event.currentTarget as HTMLInputElement;
  input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/gu, "");
});
document.querySelector<HTMLButtonElement>("#create-room")?.addEventListener("click", () => { void createOrJoin("create"); });
document.querySelector<HTMLButtonElement>("#join-room")?.addEventListener("click", () => { void createOrJoin("join"); });
document.querySelector<HTMLButtonElement>("#disconnect")?.addEventListener("click", () => {
  const session = network;
  network = null;
  if (session !== null) {
    session.userDisconnected = true;
    if (session.reconnectTimer !== null) window.clearTimeout(session.reconnectTimer);
    session.socket?.close(1000, "Retour au mode local");
  }
  sessionStorage.removeItem(STORED_SESSION_KEY);
  viewedMapId = "meadow";
  events = [];
  setNetworkText("Local", "Lance le Worker pour synchroniser deux navigateurs.");
  setAuthoritativeState(initialState(), false);
});
document.querySelector<HTMLButtonElement>("#reset")?.addEventListener("click", () => {
  if (network !== null) return;
  viewedMapId = "meadow";
  events = [];
  setAuthoritativeState(initialState(), false);
});
render();

const storedPayload = sessionStorage.getItem(STORED_SESSION_KEY);
if (storedPayload !== null) {
  try {
    const stored = parseStoredSession(storedPayload);
    connect(stored.serverUrl, stored.ticket);
  } catch {
    sessionStorage.removeItem(STORED_SESSION_KEY);
    setNetworkText("Local", "La session mémorisée était invalide et a été supprimée.");
  }
}
