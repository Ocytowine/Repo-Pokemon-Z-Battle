import process from "node:process";

const baseUrl = new URL(process.argv[2] ?? "http://127.0.0.1:8787");
const timeoutMs = 8_000;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function ticket(path) {
  const response = await fetch(new URL(path, baseUrl), { method: "POST" });
  const body = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status} sur ${path}: ${JSON.stringify(body)}`);
  assert(typeof body.roomCode === "string", "Ticket sans code de room.");
  assert(typeof body.playerId === "string", "Ticket sans identifiant joueur.");
  assert(typeof body.reconnectToken === "string", "Ticket sans jeton de reconnexion.");
  assert(typeof body.websocketPath === "string", "Ticket sans chemin WebSocket.");
  return body;
}

class SocketInbox {
  #messages = [];
  #waiters = new Set();

  constructor(playerTicket) {
    const url = new URL(playerTicket.websocketPath, baseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("playerId", playerTicket.playerId);
    url.searchParams.set("token", playerTicket.reconnectToken);
    this.socket = new WebSocket(url);
    this.socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      const message = JSON.parse(event.data);
      this.#messages.push(message);
      for (const waiter of [...this.#waiters]) waiter();
    });
  }

  async opened() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Ouverture WebSocket expirée.")), timeoutMs);
      this.socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Échec WebSocket.")); }, { once: true });
    });
  }

  send(message) {
    this.socket.send(JSON.stringify({ version: 4, ...message }));
  }

  async next(predicate, label) {
    const existing = this.#messages.find(predicate);
    if (existing !== undefined) return existing;
    return new Promise((resolve, reject) => {
      const check = () => {
        const match = this.#messages.find(predicate);
        if (match === undefined) return;
        clearTimeout(timer);
        this.#waiters.delete(check);
        resolve(match);
      };
      const timer = setTimeout(() => {
        this.#waiters.delete(check);
        reject(new Error(`Message attendu expiré : ${label}. Reçus : ${this.#messages.map((message) => message.type).join(", ")}`));
      }, timeoutMs);
      this.#waiters.add(check);
    });
  }

  async close() {
    if (this.socket.readyState === WebSocket.CLOSED) return;
    const closed = new Promise((resolve) => this.socket.addEventListener("close", resolve, { once: true }));
    this.socket.close(1000, "Test terminé");
    await closed;
  }
}

const health = await fetch(new URL("/health", baseUrl));
assert(health.ok, `Worker indisponible sur ${baseUrl.origin}.`);

const firstTicket = await ticket("/api/rooms");
const secondTicket = await ticket(`/api/rooms/${firstTicket.roomCode}/join`);
assert(firstTicket.side === "player", "Le créateur n'a pas reçu la place joueur 1.");
assert(secondTicket.side === "opponent", "Le second ticket n'a pas reçu la place joueur 2.");

const first = new SocketInbox(firstTicket);
const second = new SocketInbox(secondTicket);
await Promise.all([first.opened(), second.opened()]);
await Promise.all([
  first.next((message) => message.type === "welcome", "welcome joueur 1"),
  second.next((message) => message.type === "welcome", "welcome joueur 2"),
]);

first.send({ type: "setReady", requestId: "e2e-ready-1", ready: true });
second.send({ type: "setReady", requestId: "e2e-ready-2", ready: true });
const battleSnapshot = await first.next(
  (message) => message.type === "snapshot" && message.snapshot?.phase === "battle",
  "démarrage du combat",
);
const battleId = battleSnapshot.snapshot.battle?.id;
assert(typeof battleId === "string", "Snapshot de combat sans battleId.");

first.send({ type: "submitAction", requestId: "e2e-action-1", battleId, turn: 1, action: { kind: "switch", teamIndex: 1 } });
second.send({ type: "submitAction", requestId: "e2e-action-2", battleId, turn: 1, action: { kind: "move", moveIndex: 0 } });
const [firstTurn, secondTurn] = await Promise.all([
  first.next((message) => message.type === "turnResolved" && message.turn === 1, "tour résolu joueur 1"),
  second.next((message) => message.type === "turnResolved" && message.turn === 1, "tour résolu joueur 2"),
]);
assert(firstTurn.state.turn === 2 && secondTurn.state.turn === 2, "Le serveur n'a pas avancé au tour 2.");
assert(JSON.stringify(firstTurn.state) === JSON.stringify(secondTurn.state), "Les deux clients ont reçu des états divergents.");
assert(firstTurn.state.teams?.player?.activeIndex === 1, "Le changement volontaire du joueur 1 n'a pas été appliqué.");

await first.close();
await second.next(
  (message) => message.type === "snapshot" && message.snapshot?.players.some((player) => player.side === "player" && !player.connected),
  "déconnexion du joueur 1",
);

const reconnected = new SocketInbox(firstTicket);
await reconnected.opened();
const welcome = await reconnected.next((message) => message.type === "welcome", "welcome de reconnexion");
assert(welcome.side === "player" && welcome.snapshot.battle?.state.turn === 2, "La reconnexion n'a pas restauré le bon snapshot.");

reconnected.send({ type: "requestSnapshot", requestId: "e2e-snapshot" });
await Promise.all([
  reconnected.next((message) => message.type === "ack" && message.requestId === "e2e-snapshot", "ack du snapshot"),
  reconnected.next((message) => message.type === "snapshot" && message.snapshot?.battle?.state.turn === 2, "snapshot restauré"),
]);

reconnected.send({ type: "submitAction", requestId: "e2e-status-p-2", battleId, turn: 2, action: { kind: "move", moveIndex: 2 } });
second.send({ type: "submitAction", requestId: "e2e-status-o-2", battleId, turn: 2, action: { kind: "move", moveIndex: 0 } });
const statusTurn = await reconnected.next((message) => message.type === "turnResolved" && message.turn === 2, "tour de statut");
assert(statusTurn.state.teams.opponent.members[0]?.majorStatus?.kind === "poison", "Le statut poison n'a pas été persisté dans l'état réseau.");

let replacementTested = false;
let currentTurn = statusTurn.state.turn;
for (let attempt = 0; attempt < 12 && !replacementTested; attempt += 1) {
  reconnected.send({ type: "submitAction", requestId: `e2e-loop-p-${currentTurn}`, battleId, turn: currentTurn, action: { kind: "move", moveIndex: 0 } });
  second.send({ type: "submitAction", requestId: `e2e-loop-o-${currentTurn}`, battleId, turn: currentTurn, action: { kind: "move", moveIndex: 0 } });
  const resolved = await reconnected.next((message) => message.type === "turnResolved" && message.turn === currentTurn, `tour ${currentTurn}`);
  const requiredSide = resolved.state.replacementRequired?.[0];
  currentTurn = resolved.state.turn;
  if (requiredSide === undefined) continue;
  const team = resolved.state.teams[requiredSide];
  const teamIndex = team.members.findIndex((member, index) => index !== team.activeIndex && member.hp > 0);
  assert(teamIndex >= 0, "Aucun remplaçant conscient proposé après le KO.");
  const replacementSocket = requiredSide === "player" ? reconnected : second;
  replacementSocket.send({ type: "submitReplacement", requestId: `e2e-replace-${currentTurn}`, battleId, turn: currentTurn, teamIndex });
  const replacement = await reconnected.next((message) => message.type === "replacementResolved" && message.state.turn === currentTurn, "remplacement après KO");
  assert(replacement.state.replacementRequired.length === 0, "Le remplacement n'a pas levé l'attente.");
  assert(replacement.state.teams[requiredSide].activeIndex === teamIndex, "Le mauvais remplaçant est devenu actif.");
  replacementTested = true;
}
assert(replacementTested, "Aucun KO avec remplacement n'a été obtenu pendant la recette.");

await Promise.all([reconnected.close(), second.close()]);
process.stdout.write(`${JSON.stringify({
  ok: true,
  roomCode: firstTicket.roomCode,
  battleId,
  resolvedTurn: firstTurn.turn,
  nextTurn: firstTurn.state.turn,
  reconnected: true,
  switched: true,
  statusTested: true,
  replacementTested,
}, null, 2)}\n`);
