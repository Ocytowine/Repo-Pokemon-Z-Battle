import { MINIMAL_MOVE_CATALOG, SeededRandom, activeBattlers, replaceFaintedPokemon, resolveTeamTurn, type BattleAbility, type BattleSide, type BattleState, type BattleTrace, type BattlerState, type HeldItem, type MajorStatusState, type TeamBattleAction, type TeamBattleEvent, type TeamBattleState } from "@pokemon-z-battle/battle-engine";
import { loadLocalManifests } from "@pokemon-z-battle/local-assets";
import { PROTOCOL_VERSION, normalizeRoomCode, serializeMessage, type RoomSnapshot, type ServerMessage } from "@pokemon-z-battle/multiplayer-protocol";
import { buildWebSocketUrl, normalizeServerUrl, parseMultiplayerTicket, parseServerMessage, requestTicket, type MultiplayerTicket, type StoredMultiplayerSession } from "./multiplayer-client.js";
import { POKEMON_PRESETS, findPreset } from "./presets.js";
import { BattlePresenter } from "./move-presentations.js";
import { SANDBOX_ABILITIES, SANDBOX_ITEMS, SCENARIO_VERSION, createLocalTeamState, parseScenario, replayScenario, type BattleScenario, type ScenarioTurn } from "./scenario.js";
import { BattleVisuals, directoryPickerAvailable, pickLocalDirectory } from "./visual-assets.js";
import "./style.css";

const root = document.querySelector<HTMLDivElement>("#app");
if (root === null) throw new Error("Application root is missing.");

root.innerHTML = `
  <header class="hero">
    <div><p class="eyebrow">Phase 4 · laboratoire déterministe</p><h1>Battle <span>Sandbox</span></h1></div>
    <p class="intro">Composez un duel, choisissez les deux actions et inspectez chaque décision du moteur — de l'ordre d'attaque au dernier point de dégâts.</p>
  </header>
  <main>
    <section class="setup panel" aria-labelledby="setup-title">
      <div class="section-title"><div><p class="kicker">Configuration</p><h2 id="setup-title">Nouveau cas de test</h2></div><span id="scenario-state" class="status-pill">Prêt</span></div>
      <div class="setup-grid">
        <label>Mode local<select id="battle-mode"><option value="duel">Duel 1 contre 1</option><option value="team">Équipes 3 contre 3</option></select></label>
        <label>Votre Pokémon<select id="player-pokemon"></select></label>
        <label>Adversaire<select id="opponent-pokemon"></select></label>
        <label>Talent joueur<select id="player-ability"></select></label>
        <label>Objet joueur<select id="player-item"></select></label>
        <label>Talent adversaire<select id="opponent-ability"></select></label>
        <label>Objet adversaire<select id="opponent-item"></select></label>
        <label>Seed RNG<input id="seed" type="number" step="1" value="24301"></label>
        <button id="restart" class="primary" type="button">Démarrer / réinitialiser</button>
      </div>
      <div class="file-actions">
        <button id="export" type="button">Exporter le scénario</button>
        <label class="file-button">Importer un scénario<input id="import" type="file" accept="application/json,.json"></label>
        <span id="notice" role="status"></span>
      </div>
    </section>

    <section class="multiplayer panel" aria-labelledby="multiplayer-title">
      <div class="section-title"><div><p class="kicker">Phase 5</p><h2 id="multiplayer-title">Combat multijoueur</h2></div><span id="network-state" class="status-pill">Mode local</span></div>
      <div class="network-grid">
        <label>Serveur<input id="server-url" type="url" value="http://127.0.0.1:8787" spellcheck="false"></label>
        <button id="create-room" class="primary" type="button">Créer une room</button>
        <label>Code de room<input id="room-code" type="text" maxlength="6" placeholder="ABC234" autocomplete="off" spellcheck="false"></label>
        <button id="join-room" type="button">Rejoindre</button>
      </div>
      <div class="network-actions">
        <strong id="room-summary">Aucune room active.</strong>
        <button id="network-ready" type="button" disabled>Je suis prêt</button>
        <button id="network-reconnect" type="button" disabled>Reconnecter</button>
        <button id="network-disconnect" type="button" disabled>Mode local</button>
      </div>
      <p id="network-notice" class="asset-notice" role="status">Démarrez le Worker local, puis créez une room ou rejoignez son code depuis un second navigateur.</p>
    </section>

    <section class="assets panel" aria-labelledby="assets-title">
      <div class="section-title"><div><p class="kicker">Assets locaux</p><h2 id="assets-title">Présentation du combat</h2></div><span id="asset-state" class="status-pill">Fallback actif</span></div>
      <div class="asset-grid">
        <label>Manifestes JSON (2 ou 3)<input id="asset-manifests" type="file" accept="application/json,.json" multiple></label>
        <label>Dossier Pokémon Z<button id="asset-folder" type="button">Choisir le dossier source</button></label>
        <label>Scène de combat<select id="battle-scene" disabled><option value="">Fallback graphique</option></select></label>
      </div>
      <p id="asset-notice" class="asset-notice">Chargez asset-manifest.json, pokemon-assets.json et, si disponible, battle-animations.json, puis sélectionnez le dossier original. Aucun fichier ne quitte votre machine.</p>
    </section>

    <section id="battle-stage" class="battle-stage incomplete-scene" aria-label="Scène de combat">
      <img id="battle-background" class="battle-background" alt="" hidden>
      <div class="stage-wash"></div>
      <img id="enemy-base" class="battle-base enemy-base" alt="" hidden>
      <img id="player-base" class="battle-base player-base" alt="" hidden>
      <div id="source-effects-back" class="source-effects-back" aria-hidden="true"></div>
      <div id="opponent-sprite" class="battle-sprite opponent-sprite sprite-fallback">?</div>
      <div id="player-sprite" class="battle-sprite player-sprite sprite-fallback">?</div>
      <div id="move-effects" class="move-effects" aria-hidden="true"></div>
      <div id="battle-message" class="battle-message">Les assets locaux sont optionnels.</div>
      <div id="battle-result" class="battle-result" hidden><p class="kicker">Combat terminé</p><h2 id="result-title">Victoire</h2><p id="result-summary"></p><button id="result-restart" class="primary" type="button">Nouveau combat</button></div>
    </section>

    <section class="arena" aria-label="État du combat">
      <article id="player-card" class="fighter player"></article>
      <div class="versus"><span>VS</span><small id="turn-label">Tour 1</small></div>
      <article id="opponent-card" class="fighter opponent"></article>
    </section>

    <section class="command panel" aria-labelledby="command-title">
      <div class="section-title"><div><p class="kicker">Actions</p><h2 id="command-title">Résoudre le prochain tour</h2></div><label class="speed-control">Rythme<select id="presentation-speed"><option value="1">Normal</option><option value="0.45">Rapide</option></select></label></div>
      <div class="command-grid">
        <label><span id="player-action-label">Action joueur</span><select id="player-move"></select></label>
        <label><span id="opponent-action-label">Action adversaire</span><select id="opponent-move"></select></label>
        <button id="resolve" class="primary resolve" type="button">Résoudre le tour</button>
      </div>
    </section>

    <section class="inspectors">
      <article class="panel log-panel"><div class="section-title"><div><p class="kicker">Domaine</p><h2>Événements</h2></div><span id="event-count" class="counter">0</span></div><div id="events" class="log empty">Aucun tour joué.</div></article>
      <article class="panel log-panel"><div class="section-title"><div><p class="kicker">Moteur</p><h2>Trace de calcul</h2></div><span id="trace-count" class="counter">0</span></div><div id="traces" class="log empty">Les tirages RNG apparaîtront ici.</div></article>
    </section>
  </main>
  <footer>Pokemon Z-Battle · moteur local, données de test reproductibles</footer>`;

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`Missing element #${id}`);
  return found as T;
}

const ui = {
  battleMode: element<HTMLSelectElement>("battle-mode"),
  playerPokemon: element<HTMLSelectElement>("player-pokemon"),
  opponentPokemon: element<HTMLSelectElement>("opponent-pokemon"),
  playerAbility: element<HTMLSelectElement>("player-ability"),
  opponentAbility: element<HTMLSelectElement>("opponent-ability"),
  playerItem: element<HTMLSelectElement>("player-item"),
  opponentItem: element<HTMLSelectElement>("opponent-item"),
  seed: element<HTMLInputElement>("seed"),
  restart: element<HTMLButtonElement>("restart"),
  exportButton: element<HTMLButtonElement>("export"),
  importInput: element<HTMLInputElement>("import"),
  resolve: element<HTMLButtonElement>("resolve"),
  playerMove: element<HTMLSelectElement>("player-move"),
  opponentMove: element<HTMLSelectElement>("opponent-move"),
  notice: element<HTMLSpanElement>("notice"),
  scenarioState: element<HTMLSpanElement>("scenario-state"),
  serverUrl: element<HTMLInputElement>("server-url"),
  roomCode: element<HTMLInputElement>("room-code"),
  createRoom: element<HTMLButtonElement>("create-room"),
  joinRoom: element<HTMLButtonElement>("join-room"),
  networkReady: element<HTMLButtonElement>("network-ready"),
  networkReconnect: element<HTMLButtonElement>("network-reconnect"),
  networkDisconnect: element<HTMLButtonElement>("network-disconnect"),
  networkState: element<HTMLSpanElement>("network-state"),
  networkNotice: element<HTMLParagraphElement>("network-notice"),
  roomSummary: element<HTMLElement>("room-summary"),
  playerActionLabel: element<HTMLSpanElement>("player-action-label"),
  opponentActionLabel: element<HTMLSpanElement>("opponent-action-label"),
  assetManifests: element<HTMLInputElement>("asset-manifests"),
  assetFolder: element<HTMLButtonElement>("asset-folder"),
  battleScene: element<HTMLSelectElement>("battle-scene"),
  assetState: element<HTMLSpanElement>("asset-state"),
  assetNotice: element<HTMLParagraphElement>("asset-notice"),
  presentationSpeed: element<HTMLSelectElement>("presentation-speed"),
  battleResult: element<HTMLDivElement>("battle-result"),
  resultTitle: element<HTMLHeadingElement>("result-title"),
  resultSummary: element<HTMLParagraphElement>("result-summary"),
  resultRestart: element<HTMLButtonElement>("result-restart"),
};

let scenario: BattleScenario = {
  version: SCENARIO_VERSION, seed: 24301, player: "BULBASAUR", opponent: "SQUIRTLE",
  playerAbility: null, opponentAbility: null, playerItem: null, opponentItem: null, turns: [],
};
let replay = replayScenario(scenario);
let localTeamState: TeamBattleState | null = null;
let localTeamResults: DisplayTurnResult[] = [];
let localTeamRng = new SeededRandom(scenario.seed);
const visuals = new BattleVisuals();
const presenter = new BattlePresenter(element("battle-stage"), element("move-effects"), element("battle-message"));
let resolving = false;
const STORED_SESSION_KEY = "pokemon-z-battle.multiplayer-session.v1";

interface NetworkSession {
  readonly serverUrl: string;
  readonly ticket: MultiplayerTicket;
  readonly socket: WebSocket;
  snapshot: RoomSnapshot | null;
  connected: boolean;
  submittedTurn: number | null;
}

let networkSession: NetworkSession | null = null;
interface DisplayTurnResult {
  readonly state: BattleState;
  readonly events: readonly TeamBattleEvent[];
  readonly trace: readonly BattleTrace[];
}

let networkResults: DisplayTurnResult[] = [];
let networkMessageQueue = Promise.resolve();

function activeState(): BattleState {
  const teamState = currentTeamState();
  return teamState === undefined ? replay.state : displayBattleState(teamState);
}

function currentTeamState(): TeamBattleState | undefined {
  return networkSession?.snapshot?.battle?.state ?? localTeamState ?? undefined;
}

function displayBattleState(state: TeamBattleState): BattleState {
  return { turn: state.turn, status: state.status, winner: state.winner, battlers: activeBattlers(state) };
}

function activeResults(): readonly DisplayTurnResult[] {
  if (networkSession !== null) return networkResults;
  return localTeamState === null ? replay.results : localTeamResults;
}

function activeSpecies(): { readonly player: string; readonly opponent: string } {
  const teamState = currentTeamState();
  const battle = teamState === undefined ? undefined : activeBattlers(teamState);
  return battle === undefined
    ? { player: scenario.player, opponent: scenario.opponent }
    : { player: battle.player.species, opponent: battle.opponent.species };
}

function option(value: string, label: string): HTMLOptionElement {
  const result = document.createElement("option");
  result.value = value;
  result.textContent = label;
  return result;
}

for (const preset of POKEMON_PRESETS) {
  ui.playerPokemon.append(option(preset.species, `#${String(preset.id).padStart(3, "0")} · ${preset.name}`));
  ui.opponentPokemon.append(option(preset.species, `#${String(preset.id).padStart(3, "0")} · ${preset.name}`));
}

function typeBadge(type: string): string {
  return `<span class="type type-${type.toLowerCase()}">${type}</span>`;
}
for (const select of [ui.playerAbility, ui.opponentAbility]) {
  select.append(option("", "Aucun talent"), ...SANDBOX_ABILITIES.map((ability) => option(ability, ability)));
}
for (const select of [ui.playerItem, ui.opponentItem]) {
  select.append(option("", "Aucun objet"), ...SANDBOX_ITEMS.map((item) => option(item, item)));
}

function statusName(status: MajorStatusState["kind"]): string {
  return {
    sleep: "SOMMEIL",
    poison: "POISON",
    burn: "BRÛLURE",
    paralysis: "PARALYSIE",
    frozen: "GEL",
    caduco: "CADUCO",
    hemorrhage: "HÉMORRAGIE",
  }[status];
}

function fighterMarkup(battler: BattlerState, side: BattleSide): string {
  const percent = Math.max(0, (battler.hp / battler.stats.maxHp) * 100);
  const initial = battler.name.slice(0, 1).toUpperCase();
  const sideLabel = networkSession === null
    ? (side === "player" ? "JOUEUR" : "ADVERSAIRE")
    : (side === networkSession.ticket.side ? "VOUS" : "ADVERSAIRE");
  const team = currentTeamState()?.teams[side];
  const roster = team === undefined ? "" : `<div class="team-strip">${team.members.map((member, index) => `<span class="team-member${index === team.activeIndex ? " active" : ""}${member.hp === 0 ? " fainted" : ""}" title="${member.name} · ${member.hp}/${member.stats.maxHp} PV">${member.name.slice(0, 1)}<small>${member.hp}</small></span>`).join("")}</div>`;
  const status = battler.majorStatus === null ? "" : `<span class="major-status status-${battler.majorStatus.kind}">${statusName(battler.majorStatus.kind)}</span>`;
  return `<div class="fighter-top"><div class="avatar" aria-hidden="true">${initial}</div><div><p class="side-label">${sideLabel}</p><h2>${battler.name}</h2><div class="types">${battler.types.map(typeBadge).join("")}${status}</div></div><span class="level">N. ${battler.level}</span></div>
    <div class="health"><div class="health-label"><strong>PV</strong><span id="${side}-hp-text">${battler.hp} / ${battler.stats.maxHp}</span></div><div class="health-track"><span id="${side}-hp-bar" style="width:${percent}%"></span></div></div>
    <p class="combat-loadout">Talent : ${battler.ability ?? "—"} · Objet : ${battler.heldItem ?? "—"}</p>
    <dl class="stats"><div><dt>ATQ</dt><dd>${battler.stats.attack}</dd></div><div><dt>DEF</dt><dd>${battler.stats.defense}</dd></div><div><dt>ATQ.SP</dt><dd>${battler.stats.specialAttack}</dd></div><div><dt>DEF.SP</dt><dd>${battler.stats.specialDefense}</dd></div><div><dt>VIT</dt><dd>${battler.stats.speed}</dd></div></dl>${roster}`;
}

function populateMoves(side: BattleSide): void {
  const select = side === "player" ? ui.playerMove : ui.opponentMove;
  const battler = activeState().battlers[side];
  const previous = select.value;
  const teamState = currentTeamState();
  if (teamState === undefined) {
    select.replaceChildren(...battler.moves.map((slot, index) => option(String(index), `${slot.move.name} · ${slot.move.type} · ${slot.pp}/${slot.move.pp} PP`)));
  } else {
    const team = teamState.teams[side];
    const replacementOnly = teamState.replacementRequired.includes(side);
    const choices: HTMLOptionElement[] = replacementOnly ? [] : battler.moves.map((slot, index) => option(`move:${index}`, `${slot.move.name} · ${slot.move.type} · ${slot.pp}/${slot.move.pp} PP`));
    team.members.forEach((member, index) => {
      if (index !== team.activeIndex && member.hp > 0) choices.push(option(`switch:${index}`, `${replacementOnly ? "Remplacer par" : "Changer pour"} ${member.name} · ${member.hp}/${member.stats.maxHp} PV`));
    });
    select.replaceChildren(...choices);
  }
  if ([...select.options].some((entry) => entry.value === previous)) select.value = previous;
}

function moveDisplayName(internalName: string): string {
  return Object.values(MINIMAL_MOVE_CATALOG).find((move) => move.internalName === internalName)?.name ?? internalName;
}

function describeEvent(event: TeamBattleEvent): string {
  switch (event.type) {
    case "turnStarted": return `Début du tour ${event.turn}`;
    case "actionOrdered": return `Ordre : ${event.order.join(" → ")}`;
    case "moveUsed": return `${event.side} utilise ${moveDisplayName(event.move)}`;
    case "ppChanged": return `${moveDisplayName(event.move)} : ${event.pp} PP restants`;
    case "moveMissed": return `${moveDisplayName(event.move)} échoue`;
    case "damageApplied": return `${event.amount} dégâts sur ${event.target} · ${event.hp} PV${event.critical ? " · critique" : ""} · type ×${event.effectiveness}`;
    case "statusApplied": return `${event.target} subit : ${statusName(event.status)}`;
    case "statusApplicationFailed": return `${statusName(event.status)} sans effet sur ${event.target} (${event.reason})`;
    case "statusContinued": return `${event.side} subit encore : ${statusName(event.status)}`;
    case "statusCured": return `${event.side} est libéré de : ${statusName(event.status)}`;
    case "statusDamage": return `${event.side} perd ${event.amount} PV à cause de ${statusName(event.status)} · ${event.hp} PV`;
    case "itemActivated": return `${event.side} · ${event.item} · ${event.effect === "heal" ? "+" : "−"}${event.amount} PV · ${event.hp} PV`;
    case "statStageChanged": return `${event.target} · ${event.stat} ${event.delta > 0 ? "+" : ""}${event.delta} · niveau ${event.stage}`;
    case "statStageChangeFailed": return `${event.target} · ${event.stat} ne peut plus varier`;
    case "fainted": return `${event.side} est K.O.`;
    case "actionSkipped": return `Action de ${event.side} ignorée (${event.reason})`;
    case "battleEnded": return `Victoire : ${event.winner}`;
    case "turnEnded": return `Fin du tour ${event.turn}`;
    case "teamActionOrdered": return `Ordre d'équipe : ${event.order.map((entry) => `${entry.side} (${entry.kind})`).join(" → ")}`;
    case "pokemonSwitched": return `${event.side} remplace ${event.from} par ${event.to}`;
    case "replacementRequired": return `${event.side} doit choisir un remplaçant`;
  }
}

function describeTrace(trace: BattleTrace): string {
  switch (trace.type) {
    case "order": return `${trace.side} · priorité ${trace.priority} · vitesse ${trace.speed}`;
    case "rng": return `${trace.purpose} · nextInt(${trace.maxExclusive}) = ${trace.value}`;
    case "accuracy": return `${trace.side} · seuil ${Number.isFinite(trace.threshold) ? trace.threshold.toFixed(2) : "immanquable"} · ${trace.hit ? "touché" : "raté"}`;
    case "damage": return `${moveDisplayName(trace.move)} · base ${trace.baseDamage} · ${trace.critical ? "critique · " : ""}variance ${trace.variance} · STAB ×${trace.stab} · type ×${trace.effectiveness}${trace.statusModifier !== 1 ? ` · statut ×${trace.statusModifier}` : ""} = ${trace.result}`;
  }
}

function logMarkup(results: readonly DisplayTurnResult[], key: "events" | "trace"): string {
  return [...results].reverse().map((result) => {
    const entries = key === "events" ? result.events.map(describeEvent) : result.trace.map(describeTrace);
    return `<section class="turn-log"><h3>Tour ${result.state.turn - 1}</h3>${entries.map((entry) => `<p>${entry}</p>`).join("")}</section>`;
  }).join("");
}

function render(state = activeState()): void {
  const results = activeResults();
  element("player-card").innerHTML = fighterMarkup(state.battlers.player, "player");
  element("opponent-card").innerHTML = fighterMarkup(state.battlers.opponent, "opponent");
  element("turn-label").textContent = state.status === "finished" ? `Combat terminé` : `Tour ${state.turn}`;
  populateMoves("player");
  populateMoves("opponent");
  const events = results.flatMap((result) => result.events);
  const traces = results.flatMap((result) => result.trace);
  const eventLog = element("events");
  const traceLog = element("traces");
  eventLog.classList.toggle("empty", events.length === 0);
  traceLog.classList.toggle("empty", traces.length === 0);
  eventLog.innerHTML = events.length === 0 ? "Aucun tour joué." : logMarkup(results, "events");
  traceLog.innerHTML = traces.length === 0
    ? (networkSession === null ? "Les tirages RNG apparaîtront ici." : "Les calculs RNG restent privés sur le serveur autoritaire.")
    : logMarkup(results, "trace");
  element("event-count").textContent = String(events.length);
  element("trace-count").textContent = String(traces.length);
  const networkBattle = networkSession?.snapshot?.battle;
  const ownSide = networkSession?.ticket.side;
  const replacementRequired = ownSide === undefined ? false : networkBattle?.state.replacementRequired.includes(ownSide) === true;
  ui.playerMove.disabled = networkSession !== null && ownSide !== "player";
  ui.opponentMove.disabled = networkSession !== null && ownSide !== "opponent";
  ui.playerActionLabel.textContent = networkSession === null ? "Action joueur" : ownSide === "player" ? "Votre action" : "Action adverse";
  ui.opponentActionLabel.textContent = networkSession === null ? "Action adversaire" : ownSide === "opponent" ? "Votre action" : "Action adverse";
  ui.resolve.textContent = networkSession === null ? "Résoudre le tour" : networkSession.submittedTurn === state.turn ? "Action envoyée" : replacementRequired ? "Envoyer le remplaçant" : "Envoyer mon action";
  ui.resolve.disabled = resolving || state.status === "finished" || (networkSession !== null
    && (!networkSession.connected || networkBattle === null || networkBattle === undefined || networkSession.submittedTurn === state.turn));
  ui.restart.disabled = networkSession !== null;
  ui.battleMode.disabled = networkSession !== null;
  ui.playerPokemon.disabled = networkSession !== null;
  ui.opponentPokemon.disabled = networkSession !== null;
  ui.playerAbility.disabled = networkSession !== null;
  ui.opponentAbility.disabled = networkSession !== null;
  ui.playerItem.disabled = networkSession !== null;
  ui.opponentItem.disabled = networkSession !== null;
  ui.seed.disabled = networkSession !== null;
  ui.exportButton.disabled = networkSession !== null || localTeamState !== null;
  ui.importInput.disabled = networkSession !== null || localTeamState !== null;
  ui.resultRestart.disabled = networkSession !== null;
  ui.scenarioState.textContent = networkSession === null
    ? (state.status === "finished" ? `Victoire ${state.winner ?? "—"}` : localTeamState === null
      ? `${scenario.turns.length} tour${scenario.turns.length > 1 ? "s" : ""}`
      : `Équipes · tour ${state.turn}`)
    : networkSession.snapshot?.phase === "waiting" ? "En attente des joueurs" : state.status === "finished" ? `Victoire ${state.winner ?? "—"}` : `Tour réseau ${state.turn}`;
  renderNetworkControls();
}

async function refreshVisuals(playCries = false): Promise<void> {
  try {
    const species = activeSpecies();
    await visuals.render(species.player, species.opponent, ui.battleScene.value);
    if (visuals.ready) {
      ui.assetState.textContent = "Assets actifs";
      if (playCries) {
        await visuals.playCry(species.opponent);
        window.setTimeout(() => { void visuals.playCry(species.player); }, 240);
      }
    }
  } catch (error) {
    ui.assetNotice.textContent = error instanceof Error ? error.message : "Impossible d'afficher les assets locaux.";
  }
}

async function resetFromControls(): Promise<void> {
  presenter.cancel();
  resolving = false;
  const seed = Number(ui.seed.value);
  if (!Number.isSafeInteger(seed)) {
    ui.notice.textContent = "La seed doit être un entier sûr.";
    return;
  }
  scenario = {
    version: SCENARIO_VERSION,
    seed,
    player: ui.playerPokemon.value,
    opponent: ui.opponentPokemon.value,
    playerAbility: (ui.playerAbility.value || null) as BattleAbility | null,
    opponentAbility: (ui.opponentAbility.value || null) as BattleAbility | null,
    playerItem: (ui.playerItem.value || null) as HeldItem | null,
    opponentItem: (ui.opponentItem.value || null) as HeldItem | null,
    turns: [],
  };
  replay = replayScenario(scenario);
  localTeamState = ui.battleMode.value === "team" ? createLocalTeamState(scenario) : null;
  localTeamResults = [];
  localTeamRng = new SeededRandom(seed);
  ui.battleResult.hidden = true;
  ui.notice.textContent = "Combat réinitialisé.";
  render();
  document.getElementById("battle-stage")?.classList.add("entering");
  window.setTimeout(() => document.getElementById("battle-stage")?.classList.remove("entering"), 700);
  await refreshVisuals(true);
}

function applyScenario(imported: BattleScenario): void {
  presenter.cancel();
  resolving = false;
  scenario = imported;
  replay = replayScenario(scenario);
  localTeamState = null;
  localTeamResults = [];
  localTeamRng = new SeededRandom(scenario.seed);
  ui.battleResult.hidden = replay.state.status !== "finished";
  if (replay.state.winner !== null) showBattleResult(replay.state.winner);
  ui.seed.value = String(scenario.seed);
  ui.playerPokemon.value = scenario.player;
  ui.opponentPokemon.value = scenario.opponent;
  ui.playerAbility.value = scenario.playerAbility ?? "";
  ui.opponentAbility.value = scenario.opponentAbility ?? "";
  ui.playerItem.value = scenario.playerItem ?? "";
  ui.opponentItem.value = scenario.opponentItem ?? "";
  ui.battleMode.value = "duel";
  ui.notice.textContent = `Scénario importé : ${scenario.turns.length} tour(s) rejoué(s).`;
  render();
  void refreshVisuals();
}

function updateHealth(side: BattleSide, hp: number): void {
  const battler = activeState().battlers[side];
  const percent = Math.max(0, (hp / battler.stats.maxHp) * 100);
  const bar = document.getElementById(`${side}-hp-bar`);
  const text = document.getElementById(`${side}-hp-text`);
  if (bar instanceof HTMLElement) bar.style.width = `${percent}%`;
  if (text !== null) text.textContent = `${hp} / ${battler.stats.maxHp}`;
}

function showBattleResult(winnerSide: BattleSide): void {
  const winner = activeState().battlers[winnerSide].name;
  ui.resultTitle.textContent = `${winner} remporte le combat`;
  const completedTurns = activeState().turn - 1;
  ui.resultSummary.textContent = networkSession === null
    ? `${localTeamState === null ? scenario.turns.length : completedTurns} tour${completedTurns > 1 ? "s" : ""} · seed ${scenario.seed}`
    : `${completedTurns} tour${completedTurns > 1 ? "s" : ""} · room ${networkSession.ticket.roomCode}`;
  ui.battleResult.hidden = false;
}

async function playEvents(events: readonly TeamBattleEvent[]): Promise<void> {
  for (const event of events) {
    if (event.type === "moveUsed") {
      const battler = activeState().battlers[event.side];
      const move = battler.moves.find((slot) => slot.move.internalName === event.move)?.move;
      presenter.message(`${battler.name} utilise ${move?.name ?? event.move} !`);
      if (move !== undefined) await presenter.playMove(event.side, move);
    } else if (event.type === "moveMissed") {
      presenter.message("L'attaque échoue !");
      await presenter.pause(420);
    } else if (event.type === "damageApplied") {
      updateHealth(event.target, event.hp);
      await presenter.playImpact(event.target, event.critical);
      if (event.critical) {
        presenter.message("Coup critique !");
        await presenter.pause(520);
      }
      if (event.effectiveness === 0) presenter.message("Cela n'affecte pas la cible…");
      else if (event.effectiveness > 1) presenter.message("C'est super efficace !");
      else if (event.effectiveness < 1) presenter.message("Ce n'est pas très efficace…");
      if (event.effectiveness !== 1) await presenter.pause(560);
    } else if (event.type === "statusApplied") {
      presenter.message(`${activeState().battlers[event.target].name} subit : ${statusName(event.status)} !`);
      await presenter.pause(520);
    } else if (event.type === "statusApplicationFailed") {
      presenter.message(event.reason === "type-immune" ? "Cela n'affecte pas la cible…" : "La cible souffre déjà d'un statut.");
      await presenter.pause(420);
    } else if (event.type === "statusContinued") {
      presenter.message(`${activeState().battlers[event.side].name} subit encore : ${statusName(event.status)}.`);
      await presenter.pause(420);
    } else if (event.type === "statusCured") {
      presenter.message(`${activeState().battlers[event.side].name} n'est plus affecté par ${statusName(event.status)}.`);
      await presenter.pause(420);
    } else if (event.type === "statusDamage") {
      updateHealth(event.side, event.hp);
      await presenter.playImpact(event.side, false);
    } else if (event.type === "itemActivated") {
      updateHealth(event.side, event.hp);
      presenter.message(`${event.item} ${event.effect === "heal" ? "restaure" : "retire"} ${event.amount} PV.`);
      if (event.effect === "damage") await presenter.playImpact(event.side, false);
      else await presenter.pause(420);
    } else if (event.type === "statStageChanged") {
      presenter.message(`${activeState().battlers[event.target].name} : ${event.stat} ${event.delta > 0 ? "augmente" : "baisse"} !`);
      await presenter.pause(420);
    } else if (event.type === "statStageChangeFailed") {
      presenter.message(`La statistique ne peut plus varier.`);
      await presenter.pause(320);
    } else if (event.type === "fainted") {
      presenter.message(`${activeState().battlers[event.side].name} est K.O. !`);
      element<HTMLDivElement>(`${event.side}-sprite`).classList.add("fainted");
      await presenter.pause(720);
    } else if (event.type === "battleEnded") {
      const winner = activeState().battlers[event.winner].name;
      presenter.message(`Victoire : ${winner}`);
      showBattleResult(event.winner);
    } else if (event.type === "actionSkipped") {
      const skipped = {
        "no-pp": "Cette capacité n'a plus de PP !",
        fainted: "Le Pokémon K.O. ne peut pas agir.",
        sleep: "Le Pokémon dort profondément.",
        paralysis: "Le Pokémon est paralysé et ne peut pas agir !",
        "item-blocked": "La Veste de Combat empêche les capacités de statut.",
      } as const;
      presenter.message(skipped[event.reason]);
      await presenter.pause(380);
    } else if (event.type === "pokemonSwitched") {
      presenter.message(`${event.from} laisse sa place à ${event.to} !`);
      await refreshVisuals(true);
      await presenter.pause(420);
    } else if (event.type === "replacementRequired") {
      presenter.message(`${event.side} doit choisir un remplaçant.`);
      await presenter.pause(380);
    }
  }
  if (activeState().status === "active") presenter.message(`Tour ${activeState().turn} · choisissez les prochaines actions`);
}

function storedMultiplayerSession(): StoredMultiplayerSession | null {
  const raw = sessionStorage.getItem(STORED_SESSION_KEY);
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as { readonly serverUrl?: unknown; readonly ticket?: unknown };
    if (typeof value.serverUrl !== "string") return null;
    return { serverUrl: normalizeServerUrl(value.serverUrl), ticket: parseMultiplayerTicket(value.ticket) };
  } catch {
    sessionStorage.removeItem(STORED_SESSION_KEY);
    return null;
  }
}

function renderNetworkControls(): void {
  const session = networkSession;
  const stored = storedMultiplayerSession();
  const ownPlayer = session?.snapshot?.players.find((player) => player.playerId === session.ticket.playerId);
  ui.networkState.textContent = session === null ? "Mode local" : session.connected ? "Connecté" : "Déconnecté";
  ui.roomSummary.textContent = session === null
    ? (stored === null ? "Aucune room active." : `Room ${stored.ticket.roomCode} disponible pour reconnexion.`)
    : `Room ${session.ticket.roomCode} · ${session.ticket.side === "player" ? "joueur 1" : "joueur 2"}`;
  ui.networkReady.disabled = session === null || !session.connected || session.snapshot?.phase !== "waiting" || ownPlayer?.ready === true;
  ui.networkReady.textContent = ownPlayer?.ready === true ? "Prêt ✓" : "Je suis prêt";
  ui.networkReconnect.disabled = session?.connected === true || stored === null;
  ui.networkDisconnect.disabled = session === null;
  ui.createRoom.disabled = session !== null;
  ui.joinRoom.disabled = session !== null;
}

function sendNetwork(message: Parameters<typeof serializeMessage>[0]): void {
  const session = networkSession;
  if (session === null || !session.connected || session.socket.readyState !== WebSocket.OPEN) {
    throw new Error("La connexion multijoueur n'est pas ouverte.");
  }
  session.socket.send(serializeMessage(message));
}

async function handleNetworkMessage(socket: WebSocket, message: ServerMessage): Promise<void> {
  const session = networkSession;
  if (session === null || session.socket !== socket) return;
  if (message.type === "welcome") {
    if (message.playerId !== session.ticket.playerId || message.side !== session.ticket.side) {
      socket.close(4003, "Ticket incohérent");
      throw new Error("Le serveur a renvoyé une place différente du ticket.");
    }
    session.snapshot = message.snapshot;
    session.connected = true;
    ui.networkNotice.textContent = `Connecté à la room ${message.snapshot.roomCode}. Cliquez sur « Je suis prêt ».`;
    render();
    if (message.snapshot.battle !== null) await refreshVisuals();
    return;
  }
  if (message.type === "snapshot") {
    const battleStarted = session.snapshot?.battle === null && message.snapshot.battle !== null;
    session.snapshot = message.snapshot;
    if (session.submittedTurn !== null && !message.snapshot.battle?.state.replacementRequired.includes(session.ticket.side)) {
      session.submittedTurn = null;
    }
    render();
    if (battleStarted) {
      ui.battleResult.hidden = true;
      document.getElementById("battle-stage")?.classList.add("entering");
      window.setTimeout(() => document.getElementById("battle-stage")?.classList.remove("entering"), 700);
      presenter.message("Les deux joueurs sont prêts. Le combat commence !");
      await refreshVisuals(true);
    }
    return;
  }
  if (message.type === "turnResolved") {
    const previousState = activeState();
    const snapshot = session.snapshot;
    if (snapshot === null || snapshot.battle === null || snapshot.battle.id !== message.battleId) return;
    session.snapshot = {
      ...snapshot,
      phase: message.state.status === "finished" ? "finished" : "battle",
      battle: { id: message.battleId, state: message.state },
    };
    session.submittedTurn = null;
    networkResults.push({ state: displayBattleState(message.state), events: message.events, trace: [] });
    resolving = true;
    render(previousState);
    try {
      await playEvents(message.events);
    } finally {
      resolving = false;
      render();
    }
    return;
  }
  if (message.type === "replacementResolved") {
    const snapshot = session.snapshot;
    if (snapshot === null || snapshot.battle === null || snapshot.battle.id !== message.battleId) return;
    session.snapshot = { ...snapshot, battle: { id: message.battleId, state: message.state } };
    session.submittedTurn = null;
    networkResults.push({ state: displayBattleState(message.state), events: message.events, trace: [] });
    await playEvents(message.events);
    render();
    return;
  }
  if (message.type === "error") {
    session.submittedTurn = null;
    ui.networkNotice.textContent = `${message.code} · ${message.message}`;
    render();
  }
}

function connectMultiplayer(serverUrl: string, ticket: MultiplayerTicket): void {
  networkSession?.socket.close(1000, "Nouvelle connexion");
  presenter.cancel();
  resolving = false;
  networkResults = [];
  const normalizedServerUrl = normalizeServerUrl(serverUrl);
  const socket = new WebSocket(buildWebSocketUrl(normalizedServerUrl, ticket));
  networkSession = { serverUrl: normalizedServerUrl, ticket, socket, snapshot: null, connected: false, submittedTurn: null };
  sessionStorage.setItem(STORED_SESSION_KEY, JSON.stringify({ serverUrl: normalizedServerUrl, ticket } satisfies StoredMultiplayerSession));
  ui.serverUrl.value = normalizedServerUrl;
  ui.roomCode.value = ticket.roomCode;
  ui.networkNotice.textContent = `Connexion à la room ${ticket.roomCode}…`;
  render();

  socket.addEventListener("open", () => {
    if (networkSession?.socket !== socket) return;
    networkSession.connected = true;
    ui.networkNotice.textContent = "WebSocket ouvert, synchronisation en cours…";
    renderNetworkControls();
  });
  socket.addEventListener("message", (event) => {
    networkMessageQueue = networkMessageQueue.then(async () => {
      if (typeof event.data !== "string") throw new Error("Message serveur binaire inattendu.");
      await handleNetworkMessage(socket, parseServerMessage(event.data));
    }).catch((error: unknown) => {
      ui.networkNotice.textContent = error instanceof Error ? error.message : "Message réseau invalide.";
    });
  });
  socket.addEventListener("close", () => {
    if (networkSession?.socket !== socket) return;
    networkSession.connected = false;
    networkSession.submittedTurn = null;
    resolving = false;
    ui.networkNotice.textContent = "Connexion fermée. Le ticket permet de rejoindre de nouveau la même place.";
    render();
  });
  socket.addEventListener("error", () => {
    if (networkSession?.socket === socket) ui.networkNotice.textContent = "Impossible de joindre le serveur multijoueur.";
  });
}

async function createOrJoinRoom(kind: "create" | "join"): Promise<void> {
  ui.createRoom.disabled = true;
  ui.joinRoom.disabled = true;
  try {
    const serverUrl = normalizeServerUrl(ui.serverUrl.value);
    const path = kind === "create" ? "/api/rooms" : `/api/rooms/${normalizeRoomCode(ui.roomCode.value)}/join`;
    const ticket = await requestTicket(serverUrl, path);
    connectMultiplayer(serverUrl, ticket);
  } catch (error) {
    ui.networkNotice.textContent = error instanceof Error ? error.message : "Connexion multijoueur impossible.";
    renderNetworkControls();
  }
}

ui.restart.addEventListener("click", () => { void resetFromControls(); });
ui.resolve.addEventListener("click", async () => {
  if (resolving) return;
  if (networkSession !== null) {
    const battle = networkSession.snapshot?.battle;
    if (battle === null || battle === undefined) return;
    const side = networkSession.ticket.side;
    const rawAction = side === "player" ? ui.playerMove.value : ui.opponentMove.value;
    const [kind, rawIndex] = rawAction.split(":");
    const index = Number(rawIndex);
    try {
      const replacementRequired = battle.state.replacementRequired.includes(side);
      if (replacementRequired) {
        if (kind !== "switch") throw new Error("Choisissez un Pokémon de remplacement.");
        sendNetwork({ type: "submitReplacement", version: PROTOCOL_VERSION, requestId: crypto.randomUUID(), battleId: battle.id, turn: battle.state.turn, teamIndex: index });
      } else {
        const action: TeamBattleAction = kind === "switch" ? { kind: "switch", teamIndex: index } : { kind: "move", moveIndex: index };
        sendNetwork({ type: "submitAction", version: PROTOCOL_VERSION, requestId: crypto.randomUUID(), battleId: battle.id, turn: battle.state.turn, action });
      }
      networkSession.submittedTurn = battle.state.turn;
      ui.networkNotice.textContent = "Action enregistrée. En attente de l'autre joueur…";
      render();
    } catch (error) {
      ui.networkNotice.textContent = error instanceof Error ? error.message : "Envoi impossible.";
    }
    return;
  }
  if (localTeamState !== null) {
    resolving = true;
    const previousState = displayBattleState(localTeamState);
    try {
      const selected = { player: ui.playerMove.value, opponent: ui.opponentMove.value } as const;
      if (localTeamState.replacementRequired.length > 0) {
        const replacements: Partial<Record<BattleSide, number>> = {};
        for (const side of localTeamState.replacementRequired) {
          const [kind, rawIndex] = selected[side].split(":");
          if (kind !== "switch") throw new Error(`Choisissez un remplaçant pour ${side}.`);
          replacements[side] = Number(rawIndex);
        }
        const result = replaceFaintedPokemon(localTeamState, replacements);
        localTeamState = result.state;
        localTeamResults.push({ state: displayBattleState(result.state), events: result.events, trace: result.trace });
        render(previousState);
        await playEvents(result.events);
        ui.notice.textContent = "Remplacement local effectué.";
      } else {
        const action = (raw: string): TeamBattleAction => {
          const [kind, rawIndex] = raw.split(":");
          const index = Number(rawIndex);
          if (!Number.isInteger(index)) throw new Error("Action locale invalide.");
          return kind === "switch" ? { kind, teamIndex: index } : { kind: "move", moveIndex: index };
        };
        const result = resolveTeamTurn(localTeamState, {
          player: action(selected.player),
          opponent: action(selected.opponent),
        }, localTeamRng);
        localTeamState = result.state;
        localTeamResults.push({ state: displayBattleState(result.state), events: result.events, trace: result.trace });
        render(previousState);
        await playEvents(result.events);
        ui.notice.textContent = `Tour d'équipe ${result.state.turn - 1} résolu avec la seed ${scenario.seed}.`;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      ui.notice.textContent = error instanceof Error ? error.message : "Résolution locale impossible.";
    } finally {
      resolving = false;
      render();
      await refreshVisuals();
    }
    return;
  }
  resolving = true;
  const previousState = replay.state;
  const turn: ScenarioTurn = { playerMove: Number(ui.playerMove.value), opponentMove: Number(ui.opponentMove.value) };
  scenario = { ...scenario, turns: [...scenario.turns, turn] };
  replay = replayScenario(scenario);
  const result = replay.results.at(-1);
  render(previousState);
  ui.resolve.disabled = true;
  try {
    if (result !== undefined) await playEvents(result.events);
    ui.notice.textContent = `Tour ${scenario.turns.length} résolu avec la seed ${scenario.seed}.`;
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
  } finally {
    resolving = false;
    render();
  }
});

ui.presentationSpeed.addEventListener("change", () => { presenter.setSpeed(Number(ui.presentationSpeed.value)); });
ui.resultRestart.addEventListener("click", () => { void resetFromControls(); });
ui.createRoom.addEventListener("click", () => { void createOrJoinRoom("create"); });
ui.joinRoom.addEventListener("click", () => { void createOrJoinRoom("join"); });
ui.roomCode.addEventListener("input", () => { ui.roomCode.value = ui.roomCode.value.toUpperCase().replace(/[^A-Z2-9]/gu, "").slice(0, 6); });
ui.networkReady.addEventListener("click", () => {
  try {
    sendNetwork({ type: "setReady", version: PROTOCOL_VERSION, requestId: crypto.randomUUID(), ready: true });
    ui.networkReady.disabled = true;
    ui.networkNotice.textContent = "Prêt confirmé. En attente de l'autre joueur…";
  } catch (error) {
    ui.networkNotice.textContent = error instanceof Error ? error.message : "Envoi impossible.";
  }
});
ui.networkReconnect.addEventListener("click", () => {
  const stored = storedMultiplayerSession();
  if (stored !== null) connectMultiplayer(stored.serverUrl, stored.ticket);
});
ui.networkDisconnect.addEventListener("click", () => {
  const socket = networkSession?.socket;
  networkSession = null;
  networkResults = [];
  resolving = false;
  presenter.cancel();
  socket?.close(1000, "Retour au mode local");
  ui.networkNotice.textContent = "Mode local actif. Le ticket de reconnexion est conservé dans cet onglet.";
  ui.battleResult.hidden = replay.state.status !== "finished";
  render();
  void refreshVisuals();
});

ui.assetManifests.addEventListener("change", async () => {
  try {
    const manifests = await loadLocalManifests(ui.assetManifests.files ?? []);
    const scenes = visuals.setManifests(manifests);
    presenter.setSourceAnimations(manifests.animations ?? null, (path) => visuals.localUrl(path));
    ui.battleScene.replaceChildren(...scenes.map((scene) => option(scene.id, `${scene.name}${scene.complete ? "" : " · incomplet"}`)));
    ui.battleScene.disabled = scenes.length === 0;
    const animationStatus = manifests.animations === undefined ? " Effets génériques actifs." : ` ${manifests.animations.animations.length} animations source prêtes.`;
    ui.assetNotice.textContent = scenes.length === 0
      ? "Aucune scène Battleback reconnue ; les battlers restent toutefois disponibles."
      : `${scenes.length} scènes détectées, dont ${scenes.filter((scene) => scene.complete).length} triplets complets.${animationStatus}`;
    await refreshVisuals();
  } catch (error) {
    ui.assetState.textContent = "Manifestes invalides";
    ui.assetNotice.textContent = error instanceof Error ? error.message : "Chargement impossible.";
  }
});

ui.assetFolder.addEventListener("click", async () => {
  try {
    const directory = await pickLocalDirectory();
    visuals.setDirectory(directory);
    ui.assetFolder.textContent = directory.name;
    ui.assetNotice.textContent = "Dossier local prêt. Les fichiers sont lus directement par le navigateur.";
    await refreshVisuals(true);
  } catch (error) {
    ui.assetNotice.textContent = error instanceof Error ? error.message : "Sélection du dossier annulée.";
  }
});

ui.battleScene.addEventListener("change", () => { void refreshVisuals(); });

ui.exportButton.addEventListener("click", () => {
  if (localTeamState !== null) {
    ui.notice.textContent = "L'export d'équipe sera ajouté après validation du parcours local.";
    return;
  }
  const content = JSON.stringify(scenario, null, 2);
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `pokemon-z-battle-${scenario.seed}-${scenario.turns.length}t.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  ui.notice.textContent = "Scénario exporté.";
});

ui.importInput.addEventListener("change", async () => {
  const file = ui.importInput.files?.[0];
  if (file === undefined) return;
  try {
    applyScenario(parseScenario(JSON.parse(await file.text()) as unknown));
  } catch (error) {
    ui.notice.textContent = error instanceof Error ? error.message : "Import impossible.";
  } finally {
    ui.importInput.value = "";
  }
});

ui.playerPokemon.value = scenario.player;
ui.opponentPokemon.value = scenario.opponent;
ui.playerAbility.value = scenario.playerAbility ?? "";
ui.opponentAbility.value = scenario.opponentAbility ?? "";
ui.playerItem.value = scenario.playerItem ?? "";
ui.opponentItem.value = scenario.opponentItem ?? "";
const storedSession = storedMultiplayerSession();
if (storedSession !== null) {
  ui.serverUrl.value = storedSession.serverUrl;
  ui.roomCode.value = storedSession.ticket.roomCode;
}
if (findPreset(scenario.player) === undefined) throw new Error("Default player preset is missing.");
if (!directoryPickerAvailable()) ui.assetFolder.disabled = true;
render();
