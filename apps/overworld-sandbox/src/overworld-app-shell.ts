import { SOURCE_MAP_ID } from "./imported-map.js";

export function requiredAppElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Élément de l'application absent : ${id}.`);
  return element as T;
}

export function mountOverworldApp(): HTMLCanvasElement {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (root === null) throw new Error("Application root is missing.");
  root.innerHTML = `
    <header><div><p class="eyebrow">Phase 9.5 · état des événements</p><h1>Overworld <span>Sandbox</span></h1></div><p>Le prototype coop reste disponible ; les pages simples du monde source conservent maintenant leurs interrupteurs et variables.</p></header>
    <main>
      <section class="world-panel">
        <div class="map-heading"><div><p class="eyebrow">Carte observée</p><h2 id="map-name"></h2></div><div class="map-tabs"><button data-map="${SOURCE_MAP_ID}" disabled>Monde source</button><button id="starter-test">Tester les starters</button><button id="open-source-menu">Menu</button><button data-map="meadow">Prairie</button><button data-map="grove">Bosquet</button></div></div>
        <div class="canvas-shell"><div id="source-panorama-layer" class="source-panorama-layer" aria-hidden="true"></div><canvas id="world" width="576" height="432" aria-label="Carte de test overworld"></canvas><div id="source-fog-layer" class="source-fog-layer" aria-hidden="true"></div><div id="source-weather-layer" class="source-weather-layer" data-weather="none" aria-hidden="true"></div><div id="source-map-animation-layer" class="source-map-animation-layer" aria-hidden="true"></div><div id="source-picture-layer" class="source-picture-layer" aria-hidden="true"></div><div id="source-tone-layer" class="source-tone-layer" aria-hidden="true"></div><div id="source-flash-layer" class="source-flash-layer" aria-hidden="true"></div><div id="source-dialogue" class="source-dialogue" data-position="bottom" hidden><strong></strong><p></p><div class="source-choices"></div><small>Espace/Entrée pour continuer · Échap pour fermer</small></div>
          <section id="source-shop" class="source-shop" hidden aria-label="Boutique Pokémon"></section>
          <section id="source-menu" class="source-menu" hidden aria-label="Menu du jeu">
            <header class="source-menu-header"><div><small>MENU PRINCIPAL</small><strong id="source-menu-location">Pokémon Z</strong></div><button id="close-source-menu" aria-label="Fermer le menu">×</button></header>
            <div class="source-menu-layout"><nav class="source-menu-nav" aria-label="Rubriques">
              <button data-source-menu-tab="team"><img src="/__pokemon-z/source/Graphics/Pictures/partyBall.PNG" alt=""><span>Équipe</span></button>
              <button data-source-menu-tab="bag"><img src="/__pokemon-z/source/Graphics/Icons/bagPocket1.png" alt=""><span>Sac</span></button>
              <button data-source-menu-tab="save"><span class="source-menu-symbol">S</span><span>Sauvegarde</span></button>
              <button data-source-menu-tab="options"><span class="source-menu-symbol">⚙</span><span>Options</span></button>
            </nav><div id="source-menu-content" class="source-menu-content"></div></div>
            <footer class="source-menu-footer"><span><kbd>Échap</kbd> Fermer</span><span>Les données affichées viennent de la partie en cours</span></footer>
          </section>
          <section id="encounter-panel" class="encounter-panel source-battle-overlay" hidden aria-label="Combat en cours">
            <div id="source-battle-stage" class="source-battle-stage incomplete-scene" hidden>
              <img id="source-battle-background" class="source-battle-background" alt="" hidden><div class="source-stage-wash"></div>
              <img id="source-enemy-base" class="source-battle-base source-enemy-base" alt="" hidden><img id="source-player-base" class="source-battle-base source-player-base" alt="" hidden>
              <div id="source-effects-back" class="source-animation-layer source-effects-back" aria-hidden="true"></div>
              <div id="source-opponent-sprite" class="source-battle-sprite source-opponent-sprite sprite-fallback">?</div>
              <div id="source-player-sprite" class="source-battle-sprite source-player-sprite sprite-fallback">?</div>
              <div id="source-move-effects" class="source-animation-layer source-move-effects" aria-hidden="true"></div>
              <article class="source-battle-hud source-opponent-hud"><div><strong id="source-opponent-name">Adversaire</strong><span id="source-opponent-level"></span></div><div class="source-health-track"><span id="source-opponent-hp-bar"></span></div><small id="source-opponent-hp"></small></article>
              <article class="source-battle-hud source-player-hud"><div><strong id="source-player-name">Joueur</strong><span id="source-player-level"></span></div><div class="source-health-track"><span id="source-player-hp-bar"></span></div><small id="source-player-hp"></small></article>
              <div id="source-battle-message" class="source-battle-message">Un Pokémon sauvage apparaît !</div>
            </div>
            <div class="encounter-overlay-heading"><h2 id="encounter-title">Combat</h2><span id="encounter-turn">Tour 1</span></div>
            <p id="encounter-summary" class="network-notice"></p><div id="encounter-actions" class="encounter-actions"></div>
          </section>
        </div>
        <p id="map-legend" class="legend"><span class="ground"></span>Sol <span class="wall"></span>Collision <span class="door"></span>Transition <span class="interaction"></span>Interaction</p>
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
        <section class="panel"><p id="guide-phase" class="eyebrow">Phase 8.3</p><h2 id="guide-title">Parcours coop</h2><div id="coop-guide" class="coop-guide"></div></section>
        <section class="panel"><div class="log-heading"><div><p class="eyebrow">Moteur</p><h2>Événements</h2></div><span id="tick">Tick 0</span></div><div id="progress" class="progress"></div><div id="events" class="events">Déplace un avatar pour commencer.</div></section>
      </aside>
    </main>`;
  return requiredAppElement<HTMLCanvasElement>("world");
}
