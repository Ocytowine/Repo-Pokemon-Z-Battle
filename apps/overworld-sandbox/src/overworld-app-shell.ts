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
        <div id="world-stage" class="canvas-shell"><div id="source-panorama-layer" class="source-panorama-layer" aria-hidden="true"></div><canvas id="world" width="576" height="432" aria-label="Carte de test overworld"></canvas><div id="source-fog-layer" class="source-fog-layer" aria-hidden="true"></div><div id="source-weather-layer" class="source-weather-layer" data-weather="none" aria-hidden="true"></div><div id="source-map-animation-layer" class="source-map-animation-layer" aria-hidden="true"></div><div id="source-picture-layer" class="source-picture-layer" aria-hidden="true"></div><div id="source-tone-layer" class="source-tone-layer" aria-hidden="true"></div><div id="source-flash-layer" class="source-flash-layer" aria-hidden="true"></div><div id="source-fly-transition" class="source-fly-transition" aria-hidden="true" hidden></div><button id="source-fishing-shortcut" class="source-fishing-shortcut" type="button" title="Pêcher" hidden><img alt=""><span>Pêcher</span></button><button id="source-compass-toggle" class="source-compass-toggle" type="button" aria-controls="source-compass" aria-expanded="false" title="Boussole" hidden><img src="/__pokemon-z/source/Graphics/Pictures/DP%20Pause%20Menu/radar.png" alt=""><span>Boussole</span></button><section id="source-compass" class="source-compass" aria-label="Pokémon sauvages de la zone" hidden></section><div id="source-hud-notice" class="source-hud-notice" role="status" aria-live="polite" hidden></div><section id="source-new-game" class="source-new-game" hidden aria-label="Nouvelle partie"></section><div id="source-dialogue" class="source-dialogue" data-position="bottom" hidden><strong></strong><p></p><div class="source-choices"></div><small>Espace/Entrée pour continuer · Échap pour fermer</small></div>
          <nav id="source-touch-controls" class="source-touch-controls" aria-label="Commandes tactiles de l'overworld">
            <div id="source-touch-joystick" class="source-touch-joystick" role="group" aria-label="Joystick directionnel"><i id="source-touch-joystick-knob"></i></div>
            <div class="source-touch-actions">
              <button id="source-touch-menu" class="source-touch-small source-touch-menu" type="button" aria-label="Ouvrir le menu">Menu</button>
              <button id="source-touch-sprint" class="source-touch-small source-touch-sprint" type="button" aria-label="Maintenir pour sprinter">Sprint</button>
              <button id="source-touch-cancel" class="source-touch-action source-touch-cancel" type="button" aria-label="Retour ou annulation">B</button>
              <button id="source-touch-interact" class="source-touch-action source-touch-interact" type="button" aria-label="Interagir ou valider">A</button>
            </div>
          </nav>
          <section id="source-orientation-blocker" class="source-orientation-blocker" aria-label="Orientation non prise en charge"><div aria-hidden="true">↻</div><strong>Tournez votre téléphone</strong><span>Touchez l’écran puis passez en paysage.</span></section>
          <section id="source-load-error" class="source-load-error" role="alert" hidden><div><p class="eyebrow">DONNÉES LOCALES</p><h1 id="source-load-error-title"></h1><p id="source-load-error-detail"></p><code id="source-load-error-command"></code><button id="source-load-error-retry" type="button">Réessayer</button></div></section>
          <section id="source-shop" class="source-shop" hidden aria-label="Boutique Pokémon"></section>
          <section id="source-ranch" class="source-ranch" hidden aria-label="Ranch Pokémon"></section>
          <section id="source-day-care" class="source-ranch source-day-care" hidden aria-label="Pension Pokémon"></section>
          <section id="source-day-care-eggs" class="source-day-care-eggs" hidden aria-label="Gardien des Œufs"></section>
          <section id="source-incubator" class="source-incubator" hidden aria-label="Incubateur Pokémon"></section>
          <section id="source-pokemon-summary" class="source-pokemon-summary" hidden aria-label="Résumé Pokémon"></section>
          <section id="player-duel-prompt" class="player-duel-prompt" hidden aria-label="Défi entre joueurs"></section>
          <section id="battle-join-prompt" class="battle-join-prompt" hidden aria-label="Rejoindre le combat"></section>
          <section id="source-menu" class="source-menu" hidden aria-label="Menu du jeu">
            <header class="source-menu-header"><div><small id="source-menu-context">MENU PRINCIPAL</small><strong id="source-menu-location">Pokémon Z</strong></div><div class="source-menu-header-actions"><button id="source-poke-vial" class="source-poke-vial-button" type="button" title="Soigner toute l'équipe" hidden><img src="/__pokemon-z/source/Graphics/Pictures/DP%20Pause%20Menu/vial.png" alt=""><span><strong>Pokévial</strong><small id="source-poke-vial-charges"></small></span></button><span id="source-menu-meta" class="source-menu-header-meta"></span></div><button id="close-source-menu" aria-label="Fermer le menu">×</button></header>
            <div class="source-menu-layout"><nav class="source-menu-nav" aria-label="Rubriques">
              <button data-source-menu-tab="team"><img data-source-menu-icon data-icon-inactive="pokemonA" data-icon-active="pokemonB" src="/__pokemon-z/source/Graphics/Pictures/DP%20Pause%20Menu/pokemonA.png" alt=""><span>Équipe</span></button>
              <button data-source-menu-tab="pokedex"><img data-source-menu-icon data-icon-inactive="pokedexA" data-icon-active="pokedexB" src="/__pokemon-z/source/Graphics/Pictures/DP%20Pause%20Menu/pokedexA.png" alt=""><span>Pokédex</span></button>
              <button data-source-menu-tab="bag"><img data-source-menu-icon data-icon-inactive="bagA" data-icon-active-masculine="bagBm" data-icon-active-feminine="bagBf" src="/__pokemon-z/source/Graphics/Pictures/DP%20Pause%20Menu/bagA.png" alt=""><span>Sac</span></button>
              <button data-source-menu-tab="map"><img data-source-menu-icon data-icon-inactive="rider" data-icon-active="rider" src="/__pokemon-z/source/Graphics/Pictures/DP%20Pause%20Menu/rider.png" alt=""><span>Carte</span></button>
              <button data-source-menu-tab="alchemy"><img data-source-menu-icon data-icon-inactive="crafteoA" data-icon-active="crafteoB" src="/__pokemon-z/source/Graphics/Pictures/DP%20Pause%20Menu/crafteoA.png" alt=""><span>Alchimie</span></button>
              <button data-source-menu-tab="save"><img data-source-menu-icon data-icon-inactive="saveA" data-icon-active-masculine="saveBm" data-icon-active-feminine="saveBf" src="/__pokemon-z/source/Graphics/Pictures/DP%20Pause%20Menu/saveA.png" alt=""><span>Sauvegarde</span></button>
              <button data-source-menu-tab="coop"><img data-source-menu-icon data-icon-inactive="trainercardA" data-icon-active="trainercardB" src="/__pokemon-z/source/Graphics/Pictures/DP%20Pause%20Menu/trainercardA.png" alt=""><span>Coop</span></button>
              <button data-source-menu-tab="options"><img data-source-menu-icon data-icon-inactive="optionsA" data-icon-active="optionsB" src="/__pokemon-z/source/Graphics/Pictures/DP%20Pause%20Menu/optionsA.png" alt=""><span>Options</span></button>
            </nav><div id="source-menu-content" class="source-menu-content"></div></div>
          </section>
          <section id="encounter-panel" class="encounter-panel source-battle-overlay battle-ui-unified" hidden aria-label="Combat en cours">
            <div id="source-battle-stage" class="source-battle-stage incomplete-scene" hidden>
              <img id="source-battle-background" class="source-battle-background" alt="" hidden><div id="source-stage-wash" class="source-stage-wash"></div>
              <img id="source-enemy-base" class="source-battle-base source-enemy-base" alt="" hidden><img id="source-player-base" class="source-battle-base source-player-base" alt="" hidden>
              <div id="source-effects-back" class="source-animation-layer source-effects-back" aria-hidden="true"></div>
              <img id="source-opponent-trainer" class="source-intro-trainer source-opponent-trainer" alt="" hidden>
              <img id="source-opponent-trainer-2" class="source-intro-trainer source-opponent-trainer source-intro-trainer-2" alt="" hidden>
              <div id="source-opponent-sprite" class="source-battle-sprite source-opponent-sprite sprite-fallback">?</div>
              <div id="source-opponent-sprite-2" class="source-battle-sprite source-opponent-sprite source-battle-slot-2 sprite-fallback" hidden>?</div>
              <img id="source-player-trainer" class="source-intro-trainer source-player-trainer" alt="" hidden>
              <img id="source-player-trainer-2" class="source-intro-trainer source-player-trainer source-intro-trainer-2" alt="" hidden>
              <div id="source-player-ball" class="source-player-ball" aria-hidden="true" hidden></div>
              <div id="source-player-sprite" class="source-battle-sprite source-player-sprite sprite-fallback">?</div>
              <div id="source-player-sprite-2" class="source-battle-sprite source-player-sprite source-battle-slot-2 sprite-fallback" hidden>?</div>
              <div id="source-move-effects" class="source-animation-layer source-move-effects" aria-hidden="true"></div>
              <article class="source-battle-hud source-opponent-hud"><div><strong class="source-battle-name"><span id="source-opponent-name">Adversaire</span><i id="source-opponent-gender" class="source-battle-gender" hidden></i></strong><span id="source-opponent-level"></span></div><div class="source-battle-hud-meta"><span id="source-opponent-types" class="source-battle-types"></span><i id="source-opponent-status" class="source-battle-status" hidden></i></div><div class="source-health-track"><span id="source-opponent-hp-bar"></span></div><footer><span id="source-opponent-team" class="source-battle-team-dots"></span><small id="source-opponent-hp"></small></footer></article>
              <article class="source-battle-hud source-player-hud"><div><strong class="source-battle-name"><span id="source-player-name">Joueur</span><i id="source-player-gender" class="source-battle-gender" hidden></i></strong><span id="source-player-level"></span></div><div class="source-battle-hud-meta"><span id="source-player-types" class="source-battle-types"></span><i id="source-player-status" class="source-battle-status" hidden></i></div><div class="source-health-track"><span id="source-player-hp-bar"></span></div><div id="source-player-exp-track" class="source-experience-track" aria-label="Expérience"><span id="source-player-exp-bar"></span></div><footer><span id="source-player-team" class="source-battle-team-dots"></span><small id="source-player-hp"></small></footer></article>
              <article id="source-opponent-hud-2" class="source-battle-hud source-opponent-hud source-battle-hud-2" hidden><div><strong class="source-battle-name"><span id="source-opponent-name-2">Adversaire</span><i id="source-opponent-gender-2" class="source-battle-gender" hidden></i></strong><span id="source-opponent-level-2"></span></div><div class="source-battle-hud-meta"><span id="source-opponent-types-2" class="source-battle-types"></span><i id="source-opponent-status-2" class="source-battle-status" hidden></i></div><div class="source-health-track"><span id="source-opponent-hp-bar-2"></span></div><footer><small id="source-opponent-hp-2"></small></footer></article>
              <article id="source-player-hud-2" class="source-battle-hud source-player-hud source-battle-hud-2" hidden><div><strong class="source-battle-name"><span id="source-player-name-2">Joueur</span><i id="source-player-gender-2" class="source-battle-gender" hidden></i></strong><span id="source-player-level-2"></span></div><div class="source-battle-hud-meta"><span id="source-player-types-2" class="source-battle-types"></span><i id="source-player-status-2" class="source-battle-status" hidden></i></div><div class="source-health-track"><span id="source-player-hp-bar-2"></span></div><footer><small id="source-player-hp-2"></small></footer></article>
              <div id="source-battle-message" class="source-battle-message" role="status" aria-live="polite" tabindex="0">Un Pokémon sauvage apparaît !</div>
              <div id="source-battle-curtain" class="source-battle-curtain" aria-hidden="true"></div>
            </div>
            <div id="encounter-actions" class="encounter-actions"></div>
          </section>
        </div>
      </section>
      <aside class="engine-diagnostics">
        <button id="toggle-engine-panel" class="engine-toggle" type="button" aria-controls="engine-panel" aria-expanded="true">Masquer le moteur</button>
        <section id="engine-panel" class="panel"><div class="log-heading"><div><p class="eyebrow">Moteur</p><h2>Événements</h2></div><span id="tick">0,0</span></div><div id="progress" class="progress"></div><div id="events" class="events">Chargement du monde…</div></section>
      </aside>
    </main>`;
  const battleOverlay = requiredAppElement<HTMLElement>("encounter-panel");
  const battleStage = requiredAppElement<HTMLElement>("source-battle-stage");
  for (const id of ["source-battle-background", "source-stage-wash", "source-opponent-hud-2", "source-player-hud-2",
    "source-battle-message", "source-battle-curtain"]) battleOverlay.insertBefore(requiredAppElement(id), battleStage);
  const sendOutFlash = document.createElement("div");
  sendOutFlash.id = "source-sendout-flash";
  sendOutFlash.className = "source-sendout-flash";
  sendOutFlash.setAttribute("aria-hidden", "true");
  battleOverlay.insertBefore(sendOutFlash, battleStage);
  for (const selector of [".source-opponent-hud:not(.source-battle-hud-2)",
    ".source-player-hud:not(.source-battle-hud-2)"]) {
    const hud = battleStage.querySelector<HTMLElement>(selector);
    if (hud !== null) battleOverlay.insertBefore(hud, battleStage);
  }
  const shortcutBar = document.createElement("nav");
  shortcutBar.id = "source-field-shortcuts";
  shortcutBar.className = "source-field-shortcuts";
  shortcutBar.setAttribute("aria-label", "Raccourcis de terrain");
  const compassShortcut = requiredAppElement<HTMLButtonElement>("source-compass-toggle");
  const truthShortcut = document.createElement("button");
  truthShortcut.id = "source-truth-lens-shortcut";
  truthShortcut.className = "source-field-shortcut source-truth-lens-shortcut";
  truthShortcut.type = "button";
  truthShortcut.hidden = true;
  truthShortcut.innerHTML = '<img alt=""><span>Miroir de la Vérité</span>';
  const fishingShortcut = requiredAppElement<HTMLButtonElement>("source-fishing-shortcut");
  const mountShortcut = document.createElement("button");
  mountShortcut.id = "source-mount-shortcut";
  mountShortcut.className = "source-field-shortcut source-mount-shortcut";
  mountShortcut.type = "button";
  mountShortcut.hidden = true;
  mountShortcut.innerHTML = '<img src="/__pokemon-z/source/Graphics/Icons/icon673.png" alt=""><span>Chevroum</span>';
  shortcutBar.append(compassShortcut, truthShortcut, fishingShortcut, mountShortcut);
  requiredAppElement("world-stage").append(shortcutBar);
  const touchControls = requiredAppElement<HTMLElement>("source-touch-controls");
  requiredAppElement("world-stage").parentElement?.append(touchControls);
  const titleScreen = document.createElement("section");
  titleScreen.id = "source-title-screen";
  titleScreen.className = "source-title-screen";
  titleScreen.setAttribute("aria-label", "Écran titre Pokémon Z");
  titleScreen.hidden = true;
  root.append(titleScreen);
  const launchScreen = document.createElement("section");
  launchScreen.id = "source-launch-screen";
  launchScreen.className = "source-launch-screen";
  launchScreen.setAttribute("aria-label", "Choix de partie et services");
  launchScreen.hidden = true;
  root.append(launchScreen);
  root.append(requiredAppElement("source-new-game"));
  root.append(requiredAppElement("embedded-avatar-lab"));
  const truthLensEffect = document.createElement("div");
  truthLensEffect.id = "source-truth-lens-effect";
  truthLensEffect.className = "source-truth-lens-effect";
  truthLensEffect.hidden = true;
  truthLensEffect.setAttribute("aria-hidden", "true");
  requiredAppElement("world-stage").append(truthLensEffect);
  return requiredAppElement<HTMLCanvasElement>("world");
}
