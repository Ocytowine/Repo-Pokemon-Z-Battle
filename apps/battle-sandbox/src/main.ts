import type { BattleEvent, BattleSide, BattleTrace, BattlerState, TurnResult } from "@pokemon-z-battle/battle-engine";
import { POKEMON_PRESETS, findPreset } from "./presets.js";
import { SCENARIO_VERSION, parseScenario, replayScenario, type BattleScenario, type ScenarioTurn } from "./scenario.js";
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
        <label>Votre Pokémon<select id="player-pokemon"></select></label>
        <label>Adversaire<select id="opponent-pokemon"></select></label>
        <label>Seed RNG<input id="seed" type="number" step="1" value="24301"></label>
        <button id="restart" class="primary" type="button">Démarrer / réinitialiser</button>
      </div>
      <div class="file-actions">
        <button id="export" type="button">Exporter le scénario</button>
        <label class="file-button">Importer un scénario<input id="import" type="file" accept="application/json,.json"></label>
        <span id="notice" role="status"></span>
      </div>
    </section>

    <section class="arena" aria-label="Combat">
      <article id="player-card" class="fighter player"></article>
      <div class="versus"><span>VS</span><small id="turn-label">Tour 1</small></div>
      <article id="opponent-card" class="fighter opponent"></article>
    </section>

    <section class="command panel" aria-labelledby="command-title">
      <div class="section-title"><div><p class="kicker">Actions</p><h2 id="command-title">Résoudre le prochain tour</h2></div></div>
      <div class="command-grid">
        <label>Action joueur<select id="player-move"></select></label>
        <label>Action adversaire<select id="opponent-move"></select></label>
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
  playerPokemon: element<HTMLSelectElement>("player-pokemon"),
  opponentPokemon: element<HTMLSelectElement>("opponent-pokemon"),
  seed: element<HTMLInputElement>("seed"),
  restart: element<HTMLButtonElement>("restart"),
  exportButton: element<HTMLButtonElement>("export"),
  importInput: element<HTMLInputElement>("import"),
  resolve: element<HTMLButtonElement>("resolve"),
  playerMove: element<HTMLSelectElement>("player-move"),
  opponentMove: element<HTMLSelectElement>("opponent-move"),
  notice: element<HTMLSpanElement>("notice"),
  scenarioState: element<HTMLSpanElement>("scenario-state"),
};

let scenario: BattleScenario = { version: SCENARIO_VERSION, seed: 24301, player: "BULBASAUR", opponent: "SQUIRTLE", turns: [] };
let replay = replayScenario(scenario);

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

function fighterMarkup(battler: BattlerState, side: BattleSide): string {
  const percent = Math.max(0, (battler.hp / battler.stats.maxHp) * 100);
  const initial = battler.name.slice(0, 1).toUpperCase();
  return `<div class="fighter-top"><div class="avatar" aria-hidden="true">${initial}</div><div><p class="side-label">${side === "player" ? "JOUEUR" : "ADVERSAIRE"}</p><h2>${battler.name}</h2><div class="types">${battler.types.map(typeBadge).join("")}</div></div><span class="level">N. ${battler.level}</span></div>
    <div class="health"><div class="health-label"><strong>PV</strong><span>${battler.hp} / ${battler.stats.maxHp}</span></div><div class="health-track"><span style="width:${percent}%"></span></div></div>
    <dl class="stats"><div><dt>ATQ</dt><dd>${battler.stats.attack}</dd></div><div><dt>DEF</dt><dd>${battler.stats.defense}</dd></div><div><dt>ATQ.SP</dt><dd>${battler.stats.specialAttack}</dd></div><div><dt>DEF.SP</dt><dd>${battler.stats.specialDefense}</dd></div><div><dt>VIT</dt><dd>${battler.stats.speed}</dd></div></dl>`;
}

function populateMoves(side: BattleSide): void {
  const select = side === "player" ? ui.playerMove : ui.opponentMove;
  const battler = replay.state.battlers[side];
  const previous = select.value;
  select.replaceChildren(...battler.moves.map((slot, index) => option(String(index), `${slot.move.name} · ${slot.move.type} · ${slot.pp}/${slot.move.pp} PP`)));
  if ([...select.options].some((entry) => entry.value === previous)) select.value = previous;
}

function describeEvent(event: BattleEvent): string {
  switch (event.type) {
    case "turnStarted": return `Début du tour ${event.turn}`;
    case "actionOrdered": return `Ordre : ${event.order.join(" → ")}`;
    case "moveUsed": return `${event.side} utilise ${event.move}`;
    case "ppChanged": return `${event.move} : ${event.pp} PP restants`;
    case "moveMissed": return `${event.move} échoue`;
    case "damageApplied": return `${event.amount} dégâts sur ${event.target} · ${event.hp} PV`;
    case "fainted": return `${event.side} est K.O.`;
    case "actionSkipped": return `Action de ${event.side} ignorée (${event.reason})`;
    case "battleEnded": return `Victoire : ${event.winner}`;
    case "turnEnded": return `Fin du tour ${event.turn}`;
  }
}

function describeTrace(trace: BattleTrace): string {
  switch (trace.type) {
    case "order": return `${trace.side} · priorité ${trace.priority} · vitesse ${trace.speed}`;
    case "rng": return `${trace.purpose} · nextInt(${trace.maxExclusive}) = ${trace.value}`;
    case "accuracy": return `${trace.side} · seuil ${Number.isFinite(trace.threshold) ? trace.threshold.toFixed(2) : "immanquable"} · ${trace.hit ? "touché" : "raté"}`;
    case "damage": return `${trace.move} · base ${trace.baseDamage} · ${trace.critical ? "critique · " : ""}variance ${trace.variance} · STAB ×${trace.stab} · type ×${trace.effectiveness} = ${trace.result}`;
  }
}

function logMarkup(results: readonly TurnResult[], key: "events" | "trace"): string {
  return [...results].reverse().map((result) => {
    const entries = key === "events" ? result.events.map(describeEvent) : result.trace.map(describeTrace);
    return `<section class="turn-log"><h3>Tour ${result.state.turn - 1}</h3>${entries.map((entry) => `<p>${entry}</p>`).join("")}</section>`;
  }).join("");
}

function render(): void {
  const { state, results } = replay;
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
  traceLog.innerHTML = traces.length === 0 ? "Les tirages RNG apparaîtront ici." : logMarkup(results, "trace");
  element("event-count").textContent = String(events.length);
  element("trace-count").textContent = String(traces.length);
  ui.resolve.disabled = state.status === "finished";
  ui.scenarioState.textContent = state.status === "finished" ? `Victoire ${state.winner ?? "—"}` : `${scenario.turns.length} tour${scenario.turns.length > 1 ? "s" : ""}`;
}

function resetFromControls(): void {
  const seed = Number(ui.seed.value);
  if (!Number.isSafeInteger(seed)) {
    ui.notice.textContent = "La seed doit être un entier sûr.";
    return;
  }
  scenario = { version: SCENARIO_VERSION, seed, player: ui.playerPokemon.value, opponent: ui.opponentPokemon.value, turns: [] };
  replay = replayScenario(scenario);
  ui.notice.textContent = "Combat réinitialisé.";
  render();
}

function applyScenario(imported: BattleScenario): void {
  scenario = imported;
  replay = replayScenario(scenario);
  ui.seed.value = String(scenario.seed);
  ui.playerPokemon.value = scenario.player;
  ui.opponentPokemon.value = scenario.opponent;
  ui.notice.textContent = `Scénario importé : ${scenario.turns.length} tour(s) rejoué(s).`;
  render();
}

ui.restart.addEventListener("click", resetFromControls);
ui.resolve.addEventListener("click", () => {
  const turn: ScenarioTurn = { playerMove: Number(ui.playerMove.value), opponentMove: Number(ui.opponentMove.value) };
  scenario = { ...scenario, turns: [...scenario.turns, turn] };
  replay = replayScenario(scenario);
  ui.notice.textContent = `Tour ${scenario.turns.length} résolu avec la seed ${scenario.seed}.`;
  render();
});

ui.exportButton.addEventListener("click", () => {
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
if (findPreset(scenario.player) === undefined) throw new Error("Default player preset is missing.");
render();
