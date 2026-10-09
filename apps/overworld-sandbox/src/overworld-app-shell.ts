export function requiredAppElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Élément de l'application absent : ${id}.`);
  return element as T;
}

export function mountOverworldApp(): HTMLCanvasElement {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (root === null) throw new Error("Application root is missing.");
  root.innerHTML = `
    <main>
      <section class="world-panel">
        <section id="embedded-avatar-lab" class="embedded-avatar-lab" hidden></section>
        <div id="world-stage" class="canvas-shell"><div id="source-panorama-layer" class="source-panorama-layer" aria-hidden="true"></div><canvas id="world" width="576" height="432" aria-label="Carte de test overworld"></canvas><div id="source-fog-layer" class="source-fog-layer" aria-hidden="true"></div><div id="source-weather-layer" class="source-weather-layer" data-weather="none" aria-hidden="true"></div><div id="source-map-animation-layer" class="source-map-animation-layer" aria-hidden="true"></div><div id="source-picture-layer" class="source-picture-layer" aria-hidden="true"></div><div id="source-tone-layer" class="source-tone-layer" aria-hidden="true"></div><div id="source-flash-layer" class="source-flash-layer" aria-hidden="true"></div><div id="source-hud-notice" class="source-hud-notice" role="status" aria-live="polite" hidden></div><section id="source-new-game" class="source-new-game" hidden aria-label="Nouvelle partie"></section><div id="source-dialogue" class="source-dialogue" data-position="bottom" hidden><strong></strong><p></p><div class="source-choices"></div><small>Espace/Entrée pour continuer · Échap pour fermer</small></div>
          <section id="source-load-error" class="source-load-error" role="alert" hidden><div><p class="eyebrow">DONNÉES LOCALES</p><h1 id="source-load-error-title"></h1><p id="source-load-error-detail"></p><code id="source-load-error-command"></code><button id="source-load-error-retry" type="button">Réessayer</button></div></section>
          <section id="source-shop" class="source-shop" hidden aria-label="Boutique Pokémon"></section>
          <section id="source-ranch" class="source-ranch" hidden aria-label="Ranch Pokémon"></section>
          <section id="source-pokemon-summary" class="source-pokemon-summary" hidden aria-label="Résumé Pokémon"></section>
          <section id="player-duel-prompt" class="player-duel-prompt" hidden aria-label="Défi entre joueurs"></section>
          <section id="battle-join-prompt" class="battle-join-prompt" hidden aria-label="Rejoindre le combat"></section>
          <section id="source-menu" class="source-menu" hidden aria-label="Menu du jeu">
            <header class="source-menu-header"><div><small id="source-menu-context">MENU PRINCIPAL</small><strong id="source-menu-location">Pokémon Z</strong></div><span id="source-menu-meta" class="source-menu-header-meta"></span><button id="close-source-menu" aria-label="Fermer le menu">×</button></header>
            <div class="source-menu-layout"><nav class="source-menu-nav" aria-label="Rubriques">
              <button data-source-menu-tab="team"><img src="/__pokemon-z/source/Graphics/Pictures/partyBall.PNG" alt=""><span>Équipe</span></button>
              <button data-source-menu-tab="bag"><img src="/__pokemon-z/source/Graphics/Icons/bagPocket1.png" alt=""><span>Sac</span></button>
              <button data-source-menu-tab="movement"><span class="source-menu-symbol">DEV</span><span>Test dev</span></button>
              <button data-source-menu-tab="save"><span class="source-menu-symbol">S</span><span>Sauvegarde</span></button>
              <button data-source-menu-tab="coop"><span class="source-menu-symbol">2</span><span>Coop</span></button>
              <button data-source-menu-tab="options"><span class="source-menu-symbol">⚙</span><span>Options</span></button>
            </nav><div id="source-menu-content" class="source-menu-content"></div></div>
          </section>
          <section id="encounter-panel" class="encounter-panel source-battle-overlay" hidden aria-label="Combat en cours">
            <div id="source-battle-stage" class="source-battle-stage incomplete-scene" hidden>
              <img id="source-battle-background" class="source-battle-background" alt="" hidden><div class="source-stage-wash"></div>
              <img id="source-enemy-base" class="source-battle-base source-enemy-base" alt="" hidden><img id="source-player-base" class="source-battle-base source-player-base" alt="" hidden>
              <div id="source-effects-back" class="source-animation-layer source-effects-back" aria-hidden="true"></div>
              <div id="source-sendout-flash" class="source-sendout-flash" aria-hidden="true"></div>
              <img id="source-opponent-trainer" class="source-intro-trainer source-opponent-trainer" alt="" hidden>
              <div id="source-opponent-sprite" class="source-battle-sprite source-opponent-sprite sprite-fallback">?</div>
              <div id="source-opponent-sprite-2" class="source-battle-sprite source-opponent-sprite source-battle-slot-2 sprite-fallback" hidden>?</div>
              <img id="source-player-trainer" class="source-intro-trainer source-player-trainer" alt="" hidden>
              <div id="source-player-ball" class="source-player-ball" aria-hidden="true" hidden></div>
              <div id="source-player-sprite" class="source-battle-sprite source-player-sprite sprite-fallback">?</div>
              <div id="source-player-sprite-2" class="source-battle-sprite source-player-sprite source-battle-slot-2 sprite-fallback" hidden>?</div>
              <div id="source-move-effects" class="source-animation-layer source-move-effects" aria-hidden="true"></div>
              <article class="source-battle-hud source-opponent-hud"><div><strong id="source-opponent-name">Adversaire</strong><span id="source-opponent-level"></span></div><div class="source-battle-hud-meta"><span id="source-opponent-types" class="source-battle-types"></span><i id="source-opponent-status" class="source-battle-status" hidden></i></div><div class="source-health-track"><span id="source-opponent-hp-bar"></span></div><footer><span id="source-opponent-team" class="source-battle-team-dots"></span><small id="source-opponent-hp"></small></footer></article>
              <article class="source-battle-hud source-player-hud"><div><strong id="source-player-name">Joueur</strong><span id="source-player-level"></span></div><div class="source-battle-hud-meta"><span id="source-player-types" class="source-battle-types"></span><i id="source-player-status" class="source-battle-status" hidden></i></div><div class="source-health-track"><span id="source-player-hp-bar"></span></div><div id="source-player-exp-track" class="source-experience-track" aria-label="Expérience"><span id="source-player-exp-bar"></span></div><footer><span id="source-player-team" class="source-battle-team-dots"></span><small id="source-player-hp"></small></footer></article>
              <article id="source-opponent-hud-2" class="source-battle-hud source-opponent-hud source-battle-hud-2" hidden><div><strong id="source-opponent-name-2">Adversaire</strong><span id="source-opponent-level-2"></span></div><div class="source-battle-hud-meta"><span id="source-opponent-types-2" class="source-battle-types"></span><i id="source-opponent-status-2" class="source-battle-status" hidden></i></div><div class="source-health-track"><span id="source-opponent-hp-bar-2"></span></div><footer><small id="source-opponent-hp-2"></small></footer></article>
              <article id="source-player-hud-2" class="source-battle-hud source-player-hud source-battle-hud-2" hidden><div><strong id="source-player-name-2">Joueur</strong><span id="source-player-level-2"></span></div><div class="source-battle-hud-meta"><span id="source-player-types-2" class="source-battle-types"></span><i id="source-player-status-2" class="source-battle-status" hidden></i></div><div class="source-health-track"><span id="source-player-hp-bar-2"></span></div><footer><small id="source-player-hp-2"></small></footer></article>
              <div id="source-battle-message" class="source-battle-message" role="status" aria-live="polite" tabindex="0">Un Pokémon sauvage apparaît !</div>
              <div id="source-battle-curtain" class="source-battle-curtain" aria-hidden="true"></div>
            </div>
            <div class="encounter-overlay-heading"><h2 id="encounter-title">Combat</h2><span id="encounter-turn">Tour 1</span></div>
            <p id="encounter-summary" class="network-notice"></p><div id="encounter-actions" class="encounter-actions"></div>
          </section>
        </div>
      </section>
      <aside class="engine-diagnostics">
        <button id="toggle-engine-panel" class="engine-toggle" type="button" aria-controls="engine-panel" aria-expanded="true">Masquer le moteur</button>
        <section id="engine-panel" class="panel"><div class="log-heading"><div><p class="eyebrow">Moteur</p><h2>Événements</h2></div><span id="tick">0,0</span></div><div id="progress" class="progress"></div><div id="events" class="events">Chargement du monde…</div></section>
      </aside>
    </main>`;
  return requiredAppElement<HTMLCanvasElement>("world");
}
