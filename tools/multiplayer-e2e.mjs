import process from "node:process";

const baseUrl = new URL(process.argv[2] ?? "http://127.0.0.1:8787");
const timeoutMs = 8_000;
const protocolVersion = 11;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function profile(displayName, visualPreset) {
  return { version: 1, visualPreset, profile: { schemaVersion: 1, displayName, pronouns: "neutral",
    bodyModel: "legacy-masculine", skinTone: "classic", hairStyle: "legacy", hairColor: "legacy-classic",
    outfit: "kalos-default", colors: { primary: "navy", secondary: "gold", accent: "red" } } };
}

async function ticket(path, playerProfile, sourceWorld) {
  const response = await fetch(new URL(path, baseUrl), { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ profile: playerProfile, ...(sourceWorld === undefined ? {} : { sourceWorld }) }) });
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
    this.socket.send(JSON.stringify({ version: protocolVersion, ...message }));
  }

  #take(predicate) {
    const index = this.#messages.findIndex(predicate);
    if (index < 0) return undefined;
    return this.#messages.splice(index, 1)[0];
  }

  async next(predicate, label) {
    const existing = this.#take(predicate);
    if (existing !== undefined) return existing;
    return new Promise((resolve, reject) => {
      const check = () => {
        const match = this.#take(predicate);
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

const firstTicket = await ticket("/api/rooms", profile("Ariane", "legacy-0"));
const secondTicket = await ticket(`/api/rooms/${firstTicket.roomCode}/join`, profile("Bastien", "legacy-3"));
assert(firstTicket.side === "player", "Le créateur n'a pas reçu la place joueur 1.");
assert(secondTicket.side === "opponent", "Le second ticket n'a pas reçu la place joueur 2.");

const first = new SocketInbox(firstTicket);
const second = new SocketInbox(secondTicket);
await Promise.all([first.opened(), second.opened()]);
const [firstWelcome, secondWelcome] = await Promise.all([
  first.next((message) => message.type === "welcome", "welcome joueur 1"),
  second.next((message) => message.type === "welcome", "welcome joueur 2"),
]);
assert(firstWelcome.snapshot.players.some((player) => player.profile.profile.displayName === "Ariane"), "Profil hôte absent.");
assert(secondWelcome.snapshot.players.some((player) => player.profile.profile.displayName === "Bastien"), "Profil invité absent.");
first.send({ type: "setProfile", requestId: "e2e-profile-update", profile: profile("Ariane 2", "legacy-2") });
const [firstProfileUpdate, secondProfileUpdate] = await Promise.all([
  first.next((message) => message.type === "snapshot"
    && message.snapshot.players.some((player) => player.profile.profile.displayName === "Ariane 2"), "profil hôte actualisé"),
  second.next((message) => message.type === "snapshot"
    && message.snapshot.players.some((player) => player.profile.profile.displayName === "Ariane 2"), "profil hôte distant actualisé"),
]);
assert(firstProfileUpdate.snapshot.revision === secondProfileUpdate.snapshot.revision, "Les profils diffusés divergent.");

first.send({ type: "interact", requestId: "e2e-interact-personal" });
const [personalFirst, personalSecond] = await Promise.all([
  first.next((message) => message.type === "interactionUpdated" && message.events?.some((event) => event.interactionId === "meadow-berry"), "objet personnel joueur 1"),
  second.next((message) => message.type === "interactionUpdated" && message.events?.some((event) => event.interactionId === "meadow-berry"), "diffusion objet personnel"),
]);
assert(personalFirst.state.players.player.inventory.ORAN_BERRY === 1, "L'objet personnel n'a pas été attribué au joueur 1.");
assert(personalSecond.state.players.opponent.inventory.ORAN_BERRY === undefined, "L'objet personnel a contaminé l'inventaire du joueur 2.");

second.send({ type: "interact", requestId: "e2e-interact-shared" });
const sharedInteraction = await first.next(
  (message) => message.type === "interactionUpdated" && message.events?.some((event) => event.interactionId === "meadow-guide"),
  "interaction partagée du guide",
);
assert(sharedInteraction.state.session.completedInteractions.includes("meadow-guide"), "L'interaction partagée n'a pas été enregistrée.");

let transitionedWorld;
second.send({ type: "moveAvatar", requestId: "e2e-world-opponent-clear", direction: "up", sequence: 1 });
await Promise.all([
  first.next((message) => message.type === "worldUpdated" && message.side === "opponent" && message.sequence === 1, "libération du passage joueur 1"),
  second.next((message) => message.type === "worldUpdated" && message.side === "opponent" && message.sequence === 1, "déplacement overworld joueur 2"),
]);
for (let sequence = 1; sequence <= 9; sequence += 1) {
  first.send({ type: "moveAvatar", requestId: `e2e-world-${sequence}`, direction: "right", sequence });
  const [firstWorld, secondWorld] = await Promise.all([
    first.next((message) => message.type === "worldUpdated" && message.side === "player" && message.sequence === sequence, `déplacement overworld ${sequence} joueur 1`),
    second.next((message) => message.type === "worldUpdated" && message.side === "player" && message.sequence === sequence, `diffusion overworld ${sequence} joueur 2`),
  ]);
  assert(firstWorld.side === "player", "Le déplacement n'est pas attribué au joueur 1.");
  assert(JSON.stringify(firstWorld.state) === JSON.stringify(secondWorld.state), "Les clients ont reçu des mondes divergents.");
  transitionedWorld = firstWorld.state;
}
assert(transitionedWorld?.avatars.player.mapId === "grove", "Le joueur n'a pas franchi la transition vers le bosquet.");
assert(transitionedWorld.avatars.player.x === 1 && transitionedWorld.avatars.player.y === 4, "La destination de transition est incorrecte.");

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
assert(welcome.snapshot.world.avatars.player.mapId === "grove", "La reconnexion n'a pas restauré la zone du joueur.");
assert(welcome.snapshot.movementSequences.player === 9, "La reconnexion n'a pas restauré la séquence de mouvement.");
assert(welcome.snapshot.world.players.player.inventory.ORAN_BERRY === 1, "La reconnexion n'a pas restauré l'inventaire personnel.");
assert(welcome.snapshot.world.session.completedInteractions.includes("meadow-guide"), "La reconnexion n'a pas restauré l'interaction partagée.");

reconnected.send({ type: "moveAvatar", requestId: "e2e-world-after-reconnect", direction: "left", sequence: 10 });
const resumedWorld = await reconnected.next(
  (message) => message.type === "worldUpdated" && message.sequence === 10,
  "déplacement après reconnexion",
);
assert(resumedWorld.state.avatars.player.mapId === "meadow", "Le déplacement n'a pas repris après reconnexion.");

reconnected.send({ type: "requestSnapshot", requestId: "e2e-snapshot" });
await Promise.all([
  reconnected.next((message) => message.type === "ack" && message.requestId === "e2e-snapshot", "ack du snapshot"),
  reconnected.next((message) => message.type === "snapshot" && message.snapshot?.battle?.state.turn === 2, "snapshot restauré"),
]);

let statusTurn;
let statusAttemptTurn = 2;
for (let attempt = 0; attempt < 5; attempt += 1) {
  reconnected.send({ type: "submitAction", requestId: `e2e-status-p-${statusAttemptTurn}`, battleId, turn: statusAttemptTurn, action: { kind: "move", moveIndex: 2 } });
  second.send({ type: "submitAction", requestId: `e2e-status-o-${statusAttemptTurn}`, battleId, turn: statusAttemptTurn, action: { kind: "move", moveIndex: 0 } });
  statusTurn = await reconnected.next((message) => message.type === "turnResolved" && message.turn === statusAttemptTurn, `tour de statut ${statusAttemptTurn}`);
  if (statusTurn.state.teams.opponent.members[0]?.majorStatus?.kind === "poison") break;
  statusAttemptTurn = statusTurn.state.turn;
}
assert(statusTurn?.state.teams.opponent.members[0]?.majorStatus?.kind === "poison", "Le statut poison n'a pas été persisté dans l'état réseau.");

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

const encounterHostTicket = await ticket("/api/rooms", profile("Hôte", "legacy-1"));
const encounterObserverTicket = await ticket(`/api/rooms/${encounterHostTicket.roomCode}/join`, profile("Observateur", "legacy-4"));
const encounterHost = new SocketInbox(encounterHostTicket);
const encounterObserver = new SocketInbox(encounterObserverTicket);
await Promise.all([encounterHost.opened(), encounterObserver.opened()]);
await Promise.all([
  encounterHost.next((message) => message.type === "welcome", "welcome hôte rencontre"),
  encounterObserver.next((message) => message.type === "welcome", "welcome observateur rencontre"),
]);

encounterHost.send({ type: "moveAvatar", requestId: "e2e-encounter-position", direction: "left", sequence: 1 });
await encounterHost.next((message) => message.type === "worldUpdated" && message.side === "player" && message.sequence === 1, "position avant rencontre");
encounterHost.send({ type: "interact", requestId: "e2e-encounter-start" });
const encounterStarted = await encounterHost.next(
  (message) => message.type === "snapshot" && message.snapshot?.battle !== null && message.snapshot?.world.session.completedInteractions.includes("meadow-wild"),
  "démarrage rencontre sauvage",
);
const encounterBattleId = encounterStarted.snapshot.battle?.id;
assert(typeof encounterBattleId === "string", "La rencontre sauvage n'a pas créé de combat.");

encounterObserver.send({ type: "moveAvatar", requestId: "e2e-encounter-locked", direction: "up", sequence: 1 });
await encounterObserver.next(
  (message) => message.type === "error" && message.requestId === "e2e-encounter-locked" && message.code === "INVALID_PHASE",
  "verrouillage de l'overworld pendant le combat",
);

let encounterTurn = 1;
let encounterFinished = false;
for (let attempt = 0; attempt < 20 && !encounterFinished; attempt += 1) {
  encounterHost.send({ type: "submitAction", requestId: `e2e-encounter-turn-${encounterTurn}`, battleId: encounterBattleId, turn: encounterTurn, action: { kind: "move", moveIndex: 0 } });
  const resolved = await encounterHost.next(
    (message) => message.type === "turnResolved" && message.battleId === encounterBattleId && message.turn === encounterTurn,
    `tour de rencontre ${encounterTurn}`,
  );
  encounterFinished = resolved.state.status === "finished";
  encounterTurn = resolved.state.turn;
}
assert(encounterFinished, "La rencontre sauvage ne s'est pas terminée dans la limite prévue.");
const returnedWorld = await encounterHost.next(
  (message) => message.type === "snapshot" && message.snapshot?.battle === null
    && message.snapshot?.world.session.battleResults.some((result) => result.encounterId === "wild-meadow-1"),
  "retour dans l'overworld après combat",
);
assert(returnedWorld.snapshot.phase === "waiting", "La room n'est pas revenue en exploration.");
await Promise.all([encounterHost.close(), encounterObserver.close()]);

const coopHostTicket = await ticket("/api/rooms", profile("Hôte", "legacy-2"));
const coopPeerTicket = await ticket(`/api/rooms/${coopHostTicket.roomCode}/join`, profile("Partenaire", "legacy-5"));
let coopHost = new SocketInbox(coopHostTicket);
const coopPeer = new SocketInbox(coopPeerTicket);
await Promise.all([coopHost.opened(), coopPeer.opened()]);
await Promise.all([
  coopHost.next((message) => message.type === "welcome", "welcome hôte coop"),
  coopPeer.next((message) => message.type === "welcome", "welcome partenaire coop"),
]);

const moveCoop = async (client, side, direction, sequence, label) => {
  client.send({ type: "moveAvatar", requestId: `coop-${side}-${sequence}`, direction, sequence });
  return client.next((message) => message.type === "worldUpdated" && message.side === side && message.sequence === sequence, label);
};

coopHost.send({ type: "interact", requestId: "coop-personal" });
await coopHost.next(
  (message) => message.type === "interactionUpdated" && message.events?.some((event) => event.interactionId === "meadow-berry"),
  "objet personnel avant reconnexion",
);
await moveCoop(coopHost, "player", "left", 1, "placement partagé gauche");
await moveCoop(coopHost, "player", "right", 2, "placement partagé droite");

coopHost.send({ type: "interact", requestId: "coop-shared-host" });
coopPeer.send({ type: "interact", requestId: "coop-shared-peer" });
const sharedRace = await Promise.all([
  coopHost.next((message) => message.type === "interactionUpdated" && message.events?.some((event) => event.interactionId === "meadow-guide"), "première résolution partagée"),
  coopHost.next((message) => message.type === "interactionUpdated" && message.events?.some((event) => event.interactionId === "meadow-guide"), "conflit partagé"),
]);
const sharedEvents = sharedRace.flatMap((message) => message.events);
assert(sharedEvents.some((event) => event.type === "interactionCompleted"), "Aucun client n'a remporté l'interaction SHARED.");
assert(sharedEvents.some((event) => event.type === "interactionUnavailable" && event.reason === "completed"), "Le conflit SHARED n'a pas refusé le second client.");

for (let sequence = 1; sequence <= 7; sequence += 1) await moveCoop(coopPeer, "opponent", "right", sequence, `partenaire vers bosquet ${sequence}`);
for (let sequence = 8; sequence <= 13; sequence += 1) await moveCoop(coopPeer, "opponent", "right", sequence, `partenaire vers stèle ${sequence}`);
await moveCoop(coopPeer, "opponent", "left", 14, "partenaire face à la stèle");
for (let sequence = 3; sequence <= 11; sequence += 1) await moveCoop(coopHost, "player", "right", sequence, `hôte vers bosquet ${sequence}`);
for (let sequence = 12; sequence <= 14; sequence += 1) await moveCoop(coopHost, "player", "right", sequence, `hôte vers stèle ${sequence}`);

coopHost.send({ type: "interact", requestId: "coop-sync-host" });
const syncPending = await coopHost.next(
  (message) => message.type === "interactionUpdated" && message.events?.some((event) => event.type === "interactionPending" && event.interactionId === "grove-twin-switch"),
  "synchronisation en attente",
);
assert(syncPending.state.session.syncedParticipants["grove-twin-switch"]?.includes("player"), "Le participant SYNCED n'a pas été mémorisé.");
await coopHost.close();

coopHost = new SocketInbox(coopHostTicket);
await coopHost.opened();
const coopWelcome = await coopHost.next((message) => message.type === "welcome", "reconnexion pendant synchronisation");
assert(coopWelcome.snapshot.world.players.player.inventory.ORAN_BERRY === 1, "L'inventaire personnel coop n'a pas été restauré.");
assert(coopWelcome.snapshot.world.session.completedInteractions.includes("meadow-guide"), "L'interaction SHARED n'a pas été restaurée.");
assert(coopWelcome.snapshot.world.session.syncedParticipants["grove-twin-switch"]?.includes("player"), "L'attente SYNCED n'a pas été restaurée.");

coopPeer.send({ type: "interact", requestId: "coop-sync-peer" });
const syncCompleted = await coopHost.next(
  (message) => message.type === "interactionUpdated" && message.events?.some((event) => event.type === "interactionCompleted" && event.interactionId === "grove-twin-switch"),
  "synchronisation complétée",
);
assert(syncCompleted.state.session.flags.includes("TWIN_STONE_ACTIVE"), "L'effet SYNCED n'a pas été appliqué.");
await Promise.all([coopHost.close(), coopPeer.close()]);

const sourceWorld = {
  mapId: 3, width: 3, height: 3, passages: "fffffffff", blockedPoints: [],
  host: { x: 1, y: 1, direction: "down" }, follower: null,
  story: { switches: { "67": true }, variables: {}, selfSwitches: {} },
};
const sourceHostTicket = await ticket("/api/rooms", profile("Source Hote", "legacy-0"), sourceWorld);
const sourceGuestTicket = await ticket(`/api/rooms/${sourceHostTicket.roomCode}/join`,
  profile("Invite Z", "legacy-5"));
const sourceHost = new SocketInbox(sourceHostTicket);
const sourceGuest = new SocketInbox(sourceGuestTicket);
await Promise.all([sourceHost.opened(), sourceGuest.opened()]);
const [sourceHostWelcome, sourceGuestWelcome] = await Promise.all([
  sourceHost.next((message) => message.type === "welcome", "welcome hote monde source"),
  sourceGuest.next((message) => message.type === "welcome", "welcome invite monde source"),
]);
assert(sourceHostWelcome.snapshot.sourceWorld?.presence.opponent === "shared", "L'invite ne rejoint pas la carte source.");
assert(sourceGuestWelcome.snapshot.players.find((player) => player.side === "player")?.profile.profile.displayName
  === "Source Hote", "Le profil hote a ete remplace par celui de l'invite.");
assert(sourceGuestWelcome.snapshot.players.find((player) => player.side === "opponent")?.profile.profile.displayName
  === "Invite Z", "Le profil invite n'est pas distinct.");

sourceGuest.send({ type: "setSourcePresence", requestId: "source-away", attached: false, avatar: null });
const [sourceAwayHost, sourceAwayGuest] = await Promise.all([
  sourceHost.next((message) => message.type === "snapshot" && message.snapshot?.sourceWorld?.presence.opponent === "away",
    "invite absent chez l'hote"),
  sourceGuest.next((message) => message.type === "snapshot" && message.snapshot?.sourceWorld?.presence.opponent === "away",
    "excursion confirmee chez l'invite"),
]);
assert(sourceAwayHost.snapshot.revision === sourceAwayGuest.snapshot.revision, "La presence source diverge entre les clients.");

sourceHost.send({ type: "moveAvatar", requestId: "source-host-through-away", direction: "down", sequence: 1 });
const sourceHostMove = await sourceHost.next(
  (message) => message.type === "sourceWorldUpdated" && message.side === "player" && message.sequence === 1,
  "passage de l'hote sur l'ancienne case invite",
);
assert(sourceHostMove.state.avatars.player.x === 1 && sourceHostMove.state.avatars.player.y === 2,
  "L'invite absent bloque encore l'hote.");
sourceGuest.send({ type: "moveAvatar", requestId: "source-away-move", direction: "left", sequence: 1 });
await sourceGuest.next(
  (message) => message.type === "error" && message.requestId === "source-away-move" && message.code === "INVALID_PHASE",
  "refus d'un mouvement partage pendant l'excursion",
);

sourceGuest.send({ type: "setSourcePresence", requestId: "source-return", attached: true,
  avatar: { x: 0, y: 2, direction: "right" } });
const sourceReturn = await sourceHost.next(
  (message) => message.type === "snapshot"
    && message.snapshot.revision > sourceAwayHost.snapshot.revision
    && message.snapshot?.sourceWorld?.presence.opponent === "shared",
  "retour invite sur la carte source",
);
assert(sourceReturn.snapshot.sourceWorld.avatars.opponent.x === 0
  && sourceReturn.snapshot.sourceWorld.avatars.opponent.y === 2, "La position de retour invite est incorrecte.");
assert(sourceReturn.snapshot.players.find((player) => player.side === "player")?.profile.profile.displayName
  === "Source Hote", "Le retour de l'invite a modifie le profil hote.");
await Promise.all([sourceHost.close(), sourceGuest.close()]);

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
  worldMovementTested: true,
  zoneRestored: true,
  movementResumed: true,
  personalInteractionTested: true,
  sharedInteractionTested: true,
  encounterBattleTested: true,
  overworldLockTested: true,
  battleReturnTested: true,
  sharedConflictTested: true,
  syncedReconnectTested: true,
  coopStateRestored: true,
  sourceGuestExcursionTested: true,
  sourceGuestReturnTested: true,
  distinctSourceProfilesTested: true,
}, null, 2)}\n`);
