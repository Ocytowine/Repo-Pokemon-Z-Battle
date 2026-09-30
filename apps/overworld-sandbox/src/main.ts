import { DEMO_WORLD_CATALOG, createDemoWorldState, resolveInteraction, resolveMovement, type Direction, type GridPoint, type OverworldEvent, type OverworldState, type WorldMap } from "@pokemon-z-battle/overworld-engine";
import { SOURCE_MAP_ID, activeEventAt, blockingDefaultEventPoints, drawImportedMap, eventInFront, importedCameraPosition, loadImportedMap, loadImportedMap003, localizedDialogueText, moveImportedAvatar, playerTouchEventInDirection, selectEventPage, transferForEvent, type ImportedAvatar, type ImportedEventPage, type ImportedMapAssets, type ImportedTransfer } from "./imported-map.js";
import { OverworldNetworkSession } from "./network-session.js";
import { SourceDialogueController, type SourceDialogueSession, type SourceDialogueUpdate } from "./source-dialogue-controller.js";
import { applySafeStateCommands, createSourceEventState, parseSourceEventState, type SourceEventState } from "./source-event-state.js";
import { createPersistentPokemon } from "@pokemon-z-battle/player-state";
import { SeededRandom } from "@pokemon-z-battle/battle-engine";
import { SourceBattleController } from "./source-battle-controller.js";
import { SourceBattleVisuals } from "./source-battle-visuals.js";
import { rollLandEncounter, terrainTagAt } from "./source-wild-encounter.js";
import { createSourceGridMotion, sampleSourceGridMotion, type SourceGridMotion } from "./source-grid-motion.js";
import { SourceNpcMotionController, sourceNpcStepDuration } from "./source-npc-motion.js";
import { finalDirectSourceTransfer, findNewlyActivatedSourceAutorun, findSourceMapEntryAutorun,
  type ActiveSourceAutorun } from "./source-autorun.js";
import { resolveEventFlow } from "./source-event-flow.js";
import { executeSourceMoveRouteStep, parseSourceMoveRoute, type SourceRouteActor } from "./source-move-route.js";
import { isSourceStateCommand } from "./source-command-registry.js";
import { compileSourceScene, formatSourceSceneAudit, type SourceScenePlan } from "./source-scene-plan.js";
import { SourceSequenceRunner } from "./source-sequence-runner.js";
import { SourceSceneCoordinator, type SourceMenuTab, type SourceSceneActivity } from "./source-scene-coordinator.js";
import { SourceScenePresentation } from "./source-scene-presentation.js";
import { clearSourceWorldSave, createSourceWorldSave, loadSourceWorldSave, persistSourceWorldSave,
  type SourceWorldSave } from "./source-world-save.js";
import "./style.css";

const TILE_SIZE = 48;
const STORED_SESSION_KEY = "pokemon-z-battle.overworld-session.v6";
const SOURCE_EVENT_STATE_KEY = "pokemon-z-battle.source-event-state.v1";

const catalog = DEMO_WORLD_CATALOG;

let state: OverworldState = initialState();
let viewedMapId = "meadow";
let events: OverworldEvent[] = [];
let importedAssets: ImportedMapAssets | null = null;
let importedAvatar: ImportedAvatar = { x: 28, y: 15, direction: "up" };
let importedPlayerMotion: SourceGridMotion | null = null;
let importedWalkingPattern: 1 | 3 = 1;
const heldMovementKeys = new Set<string>();
let importedNotice = "Chargement automatique de Bourg Canvas…";
let sourceSceneAuditNotice: string | null = null;
let importedAnimationFrame: number | null = null;
let sourceEventState = loadSourceEventState();
let sourceWorldSave: SourceWorldSave | null = loadSourceWorldSave(localStorage);
const sourceDialogues = new SourceDialogueController();
const sourceNpcMotions = new SourceNpcMotionController();
const sourceScenes = new SourceSceneCoordinator();
interface SourceSequenceSession {
  readonly label: string;
  readonly mapId: number;
  readonly eventId: number;
  readonly plan: SourceScenePlan;
  readonly translations: ReadonlyMap<string, string>;
  cursor: number;
  advancing: boolean;
  autorunBaseline?: SourceEventState;
  readonly runner: SourceSequenceRunner;
  readonly onComplete?: () => void;
}
let sourceSequence: SourceSequenceSession | null = null;
let pendingSourceMapEntryAutorun: number | null = null;
let sourceTransitionInProgress = false;
type AvatarId = "player" | "opponent";

function initialState(): OverworldState {
  return createDemoWorldState();
}

function loadSourceEventState(): SourceEventState {
  try {
    const stored = localStorage.getItem(SOURCE_EVENT_STATE_KEY);
    return stored === null ? createSourceEventState() : parseSourceEventState(JSON.parse(stored) as unknown);
  } catch {
    localStorage.removeItem(SOURCE_EVENT_STATE_KEY);
    return createSourceEventState();
  }
}

function persistSourceEventState(): void {
  localStorage.setItem(SOURCE_EVENT_STATE_KEY, JSON.stringify(sourceEventState));
}

function startPendingSourceEncounter(): void {
  sourceBattles.startPendingEncounter();
}

function checkSourceWildEncounter(): boolean {
  if (importedAssets === null || sourceEventState.party.members.length === 0 || sourceEventState.pendingEncounter !== null) return false;
  const rng = new SeededRandom(sourceEventState.wildEncounterRngState);
  const terrain = terrainTagAt(importedAssets.map, importedAssets.tileset, importedAvatar.x, importedAvatar.y);
  const roll = rollLandEncounter(importedAssets.encounter, terrain, sourceEventState.wildEncounterSteps, rng);
  sourceEventState = { ...sourceEventState, wildEncounterSteps: roll.steps, wildEncounterRngState: rng.snapshot(),
    pendingEncounter: roll.encounter === null ? null : { ...roll.encounter, victorySwitches: {}, escapable: true } };
  persistSourceEventState();
  if (roll.encounter === null) return false;
  const definition = importedAssets.battleCatalog.pokemon.find((candidate) => candidate.internalName === roll.encounter?.species);
  importedNotice = `Rencontre sauvage : ${definition?.name ?? roll.encounter.species} niveau ${roll.encounter.level}.`;
  startPendingSourceEncounter();
  return true;
}

function finishImportedStep(): void {
  if (importedAssets === null) return;
  const entered = activeEventAt(sourceMapEvents(), importedAvatar.x, importedAvatar.y, importedAssets.map.id, sourceEventState);
  if (entered !== null && (entered.page.settings.trigger === 1 || entered.page.settings.trigger === 2)) {
    beginSourceSequence(entered, `Événement de contact ${entered.event.id} · ${entered.event.name}`);
    return;
  }
  if (checkSourceWildEncounter()) return;
  importedNotice = `Déplacement vers ${importedAvatar.x},${importedAvatar.y}.`;
  renderImportedView();
  continueHeldSourceMovement();
}

function sourceMapEvents(): readonly ImportedMapAssets["events"][number][] {
  return importedAssets === null ? [] : sourceNpcMotions.logicalEvents(importedAssets.events);
}

function compileAndReportSourceScene(page: ImportedEventPage, label: string): SourceScenePlan {
  const plan = compileSourceScene(page, sourceMapEvents(),
    importedAssets === null ? undefined : new Set(importedAssets.characterImages.keys()));
  sourceSceneAuditNotice = `${label} · ${formatSourceSceneAudit(plan.audit)}`;
  console.info(`[source-scene] ${sourceSceneAuditNotice}`, plan.audit);
  return plan;
}

function beginSourceSequence(active: ActiveSourceAutorun, label: string): boolean {
  if (importedAssets === null || !sourceScenes.allows("start-sequence", sourceSceneActivity())) return false;
  const flow = resolveEventFlow(active.page, [], sourceEventState, importedAssets.map.id, active.event.id,
    { playerDirection: sourceDirectionNumber(importedAvatar.direction) });
  if (!flow.complete) {
    importedNotice = `${label} bloqué : ${flow.blockedReason ?? "séquence incomplète"}.`;
    return false;
  }
  const plan = compileAndReportSourceScene(flow.page, active.event.name);
  if (!plan.audit.complete) {
    importedNotice = `${label} bloqué par l'audit de scène.`;
    renderImportedView();
    return false;
  }
  sourceSequence = { label, mapId: importedAssets.map.id, eventId: active.event.id, plan,
    translations: importedAssets.mapTranslations, cursor: 0, advancing: false, runner: new SourceSequenceRunner() };
  importedNotice = `${label} démarré.`;
  void advanceSourceSequence();
  return true;
}

function beginSourceAutorun(autorun: ActiveSourceAutorun): boolean {
  return beginSourceSequence(autorun, `Événement automatique ${autorun.event.id} · ${autorun.event.name}`);
}

function beginNewlyActivatedSourceAutorun(previousState: SourceEventState, nextState: SourceEventState): boolean {
  if (importedAssets === null) return false;
  const autorun = findNewlyActivatedSourceAutorun(
    sourceMapEvents(), importedAssets.map.id, previousState, nextState,
  );
  return autorun !== null && beginSourceAutorun(autorun);
}

function beginPendingSourceMapEntryAutorun(): boolean {
  if (importedAssets === null || pendingSourceMapEntryAutorun !== importedAssets.map.id
    || !sourceScenes.allows("start-sequence", sourceSceneActivity())) return false;
  pendingSourceMapEntryAutorun = null;
  const autorun = findSourceMapEntryAutorun(sourceMapEvents(), importedAssets.map.id, sourceEventState);
  return autorun !== null && beginSourceAutorun(autorun);
}

function sourcePlayerRouteActor(): SourceRouteActor {
  return { ...importedAvatar, moveSpeed: 4, moveFrequency: 3, walkAnimation: true, stepAnimation: false,
    directionFix: false, through: false, alwaysOnTop: false, opacity: 255,
    characterName: "player", characterHue: 0, pattern: 0 };
}

async function runSourceMoveRoute(sequence: SourceSequenceSession, target: number, rawRoute: unknown): Promise<void> {
  const route = parseSourceMoveRoute(rawRoute);
  const assets = importedAssets;
  if (route === null || assets === null || assets.map.id !== sequence.mapId) return;
  const playerTarget = target === -1;
  let actor = playerTarget ? sourcePlayerRouteActor()
    : sourceNpcMotions.scriptedActor(target === 0 ? sequence.eventId : target, sequence.mapId,
      assets.events, sourceEventState, performance.now());
  if (actor === null) return;
  const eventId = target === 0 ? sequence.eventId : target;
  for (const step of route.steps) {
    if (sourceSequence !== sequence) return;
    const result = executeSourceMoveRouteStep(actor, step, { player: importedAvatar });
    if (!result.supported) {
      if (route.skippable) continue;
      throw new Error(result.reason ?? `mouvement ${step.kind} invalide`);
    }
    actor = result.destination === null ? result.actor : { ...result.actor, ...result.destination };
    if (result.switchChange !== null) {
      sourceEventState = { ...sourceEventState,
        switches: { ...sourceEventState.switches, [result.switchChange.id]: result.switchChange.value } };
      persistSourceEventState();
    }
    if (result.sound !== null) {
      await sourcePresentation.execute({ kind: "play-sound", data: { audio: result.sound } }, async () => undefined);
    }
    let duration = result.waitMs;
    if (playerTarget) {
      importedAvatar = { x: actor.x, y: actor.y, direction: actor.direction };
      if (result.destination !== null) {
        duration = sourceNpcStepDuration(actor.moveSpeed);
        importedPlayerMotion = createSourceGridMotion(result.actor, result.destination, actor.direction,
          performance.now(), { duration, walkingPattern: importedWalkingPattern });
        importedWalkingPattern = importedWalkingPattern === 1 ? 3 : 1;
      }
    } else duration = Math.max(duration,
      sourceNpcMotions.applyScriptedActor(eventId, result.actor, result.destination, performance.now()));
    renderImportedView();
    if (duration > 0) await sequence.runner.delay(duration);
    if (result.complete) return;
  }
}

function startSourceMoveRoute(sequence: SourceSequenceSession, target: number, rawRoute: unknown): void {
  sequence.runner.startRoute(target, () => runSourceMoveRoute(sequence, target, rawRoute), (error: unknown) => {
    if (sourceSequence !== sequence) return;
    importedNotice = `Séquence interrompue : ${error instanceof Error ? error.message : "route de mouvement invalide"}.`;
    sourceSequence = null;
    renderImportedView();
  });
}

async function advanceSourceSequence(): Promise<void> {
  const sequence = sourceSequence;
  if (sequence === null || sequence.advancing || sourceDialogues.current !== null) return;
  sequence.advancing = true;
  let currentCommand = "initialisation";
  try {
    while (sourceSequence === sequence && sequence.cursor < sequence.plan.steps.length) {
      const command = sequence.plan.steps[sequence.cursor]?.command;
      if (command === undefined) break;
      currentCommand = command.kind;
      if (command.kind === "show-text") {
        const dialogueCommands: ImportedEventPage["commands"][number][] = [command];
        sequence.cursor += 1;
        while (sequence.cursor < sequence.plan.steps.length) {
          const continuation = sequence.plan.steps[sequence.cursor]?.command;
          if (continuation === undefined || continuation.kind !== "text-continuation") break;
          dialogueCommands.push(continuation);
          sequence.cursor += 1;
        }
        const segment = { ...sequence.plan.page, commands: dialogueCommands };
        beginSourceEvent(segment, sequence.mapId, sequence.eventId, sequence.label, sequence.translations);
        renderImportedView();
        return;
      }
      sequence.cursor += 1;
      if (isSourceStateCommand(command.kind)) {
        const previousState = sourceEventState;
        const result = applySafeStateCommands(sourceEventState, { ...sequence.plan.page, commands: [command] }, sequence.mapId,
          sequence.eventId, { checkpoint: { mapId: sequence.mapId, x: importedAvatar.x, y: importedAvatar.y,
            direction: importedAvatar.direction }, createPokemon: (species, level) => {
              if (importedAssets === null) throw new Error("Catalogue Pokémon indisponible.");
              return createPersistentPokemon(crypto.randomUUID(), species, level, importedAssets.battleCatalog);
            } });
        if (!result.safe) {
          importedNotice = `Séquence interrompue : ${result.reason ?? "commande d'état invalide"}.`;
          sourceSequence = null;
          renderImportedView();
          return;
        }
        sequence.autorunBaseline ??= previousState;
        sourceEventState = result.state;
        persistSourceEventState();
        renderImportedView();
        if (sourceEventState.pendingEncounter !== null) {
          startPendingSourceEncounter();
          return;
        }
        continue;
      }
      if (command.kind === "request-trainer-battle") {
        if (importedAssets === null || typeof command.data.trainerType !== "string"
          || typeof command.data.trainerName !== "string" || !Number.isInteger(command.data.version)) {
          importedNotice = "Séquence interrompue : combat de Dresseur invalide.";
          sourceSequence = null;
          renderImportedView();
          return;
        }
        const trainer = importedAssets.trainers.find((candidate) => candidate.trainerType === command.data.trainerType
          && candidate.name === command.data.trainerName && candidate.version === command.data.version);
        const trainerType = importedAssets.trainerTypes.find((candidate) => candidate.internalName === command.data.trainerType);
        if (trainer === undefined || trainerType === undefined) {
          importedNotice = "Séquence interrompue : équipe ou classe de Dresseur introuvable.";
          sourceSequence = null;
          renderImportedView();
          return;
        }
        const started = sourceBattles.startTrainerBattle(trainer, {
          battleMusic: trainerType.battleBgm ?? importedAssets.wildBattleBgm,
          victoryMusic: trainerType.victoryMe ?? "VictoriaEntrenador.ogg",
        }, (won) => {
          if (sourceSequence !== sequence) return;
          if (!won) sequence.cursor = sequence.plan.steps.length;
          void advanceSourceSequence();
        });
        if (!started) {
          importedNotice = "Séquence interrompue : le combat de Dresseur n'a pas pu démarrer.";
          sourceSequence = null;
          renderImportedView();
        }
        return;
      }
      if (command.kind === "transfer-player") {
        const transfer = finalDirectSourceTransfer([command], sequence.eventId, 0, importedAvatar);
        if (transfer === null) {
          importedNotice = "Séquence interrompue : transfert invalide.";
          sourceSequence = null;
          renderImportedView();
          return;
        }
        if (importedAssets?.map.id === transfer.targetMapId) {
          importedAvatar = { x: transfer.targetX, y: transfer.targetY,
            direction: importedDirection(transfer.direction, importedAvatar.direction) };
          importedPlayerMotion = null;
          heldMovementKeys.clear();
          sourcePresentation.resetMapPresentation();
          sourceNpcMotions.reset(importedAssets.map.id, importedAssets.events, performance.now());
          renderImportedView();
          continue;
        }
        await followSourceTransfer(transfer);
        continue;
      }
      if (command.kind === "move-route" && typeof command.data.target === "number") {
        startSourceMoveRoute(sequence, command.data.target, command.data.route);
        continue;
      }
      if (command.kind === "wait-for-movement") {
        await sequence.runner.waitForMovement();
        continue;
      }
      if (await sourcePresentation.execute(command, (milliseconds) => sequence.runner.delay(milliseconds))) continue;
      if (command.kind === "wait" && typeof command.data.frames === "number" && command.data.frames > 0) {
        await sequence.runner.delay(command.data.frames * 25);
      }
    }
    if (sourceSequence === sequence) {
      await sequence.runner.waitForMovement();
      const autorunBaseline = sequence.autorunBaseline;
      sourceSequence = null;
      importedNotice = "Séquence automatique terminée.";
      renderImportedView();
      sequence.onComplete?.();
      const activated = autorunBaseline !== undefined && importedAssets?.map.id === sequence.mapId
        && beginNewlyActivatedSourceAutorun(autorunBaseline, sourceEventState);
      if (!activated) queueMicrotask(beginPendingSourceMapEntryAutorun);
    }
  } catch (error) {
    if (sourceSequence === sequence) {
      sourceSequence = null;
      importedNotice = `Séquence interrompue sur ${currentCommand} : ${error instanceof Error ? error.message : "erreur inattendue"}.`;
      renderImportedView();
    }
  } finally {
    sequence.advancing = false;
  }
}

const root = document.querySelector<HTMLDivElement>("#app");
if (root === null) throw new Error("Application root is missing.");
root.innerHTML = `
  <header><div><p class="eyebrow">Phase 9.5 · état des événements</p><h1>Overworld <span>Sandbox</span></h1></div><p>Le prototype coop reste disponible ; les pages simples du monde source conservent maintenant leurs interrupteurs et variables.</p></header>
  <main>
    <section class="world-panel">
      <div class="map-heading"><div><p class="eyebrow">Carte observée</p><h2 id="map-name"></h2></div><div class="map-tabs"><button data-map="${SOURCE_MAP_ID}" disabled>Monde source</button><button id="starter-test">Tester les starters</button><button id="open-source-menu">Menu</button><button data-map="meadow">Prairie</button><button data-map="grove">Bosquet</button></div></div>
      <div class="canvas-shell"><div id="source-panorama-layer" class="source-panorama-layer" aria-hidden="true"></div><canvas id="world" width="576" height="432" aria-label="Carte de test overworld"></canvas><div id="source-fog-layer" class="source-fog-layer" aria-hidden="true"></div><div id="source-map-animation-layer" class="source-map-animation-layer" aria-hidden="true"></div><div id="source-picture-layer" class="source-picture-layer" aria-hidden="true"></div><div id="source-tone-layer" class="source-tone-layer" aria-hidden="true"></div><div id="source-flash-layer" class="source-flash-layer" aria-hidden="true"></div><div id="source-dialogue" class="source-dialogue" data-position="bottom" hidden><strong></strong><p></p><div class="source-choices"></div><small>Espace/Entrée pour continuer · Échap pour fermer</small></div>
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

const canvasElement = document.querySelector<HTMLCanvasElement>("#world");
if (canvasElement === null) throw new Error("Canvas is unavailable.");
const drawingContext = canvasElement.getContext("2d");
if (drawingContext === null) throw new Error("Canvas 2D is unavailable.");
const canvas: HTMLCanvasElement = canvasElement;
const context: CanvasRenderingContext2D = drawingContext;
const presentationElement = (id: string): HTMLElement => {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Élément de présentation absent : ${id}.`);
  return element;
};
function resolveSourceAnimationTarget(target: number): { x: number; bottom: number; height: number } | null {
  if (importedAssets === null) return null;
  const now = performance.now();
  const playerPose = importedPlayerMotion === null ? importedAvatar : sampleSourceGridMotion(importedPlayerMotion, now);
  const camera = importedCameraPosition(canvas, importedAssets.map, playerPose, sourcePresentation.currentCameraOffset());
  if (target === -1) return { x: playerPose.x * 32 + 16 - camera.x, bottom: playerPose.y * 32 + 32 - camera.y,
    height: importedAssets.playerImage.naturalHeight / 4 };
  const eventId = target === 0 ? sourceSequence?.eventId : target;
  if (eventId === undefined) return null;
  const event = importedAssets.events.find((candidate) => candidate.id === eventId);
  if (event === undefined) return null;
  const page = selectEventPage(event, importedAssets.map.id, sourceEventState);
  if (page === null) return null;
  const pose = sourceNpcMotions.poses(now).get(eventId);
  const x = pose?.x ?? event.x;
  const y = pose?.y ?? event.y;
  const image = importedAssets.characterImages.get(pose?.characterName ?? page.graphic.characterName);
  return { x: x * 32 + 16 - camera.x, bottom: y * 32 + 32 - camera.y,
    height: image === undefined ? 32 : image.naturalHeight / 4 };
}
const sourcePresentation = new SourceScenePresentation({
  panorama: presentationElement("source-panorama-layer"), fog: presentationElement("source-fog-layer"),
  pictures: presentationElement("source-picture-layer"), tone: presentationElement("source-tone-layer"),
  flash: presentationElement("source-flash-layer"), animations: presentationElement("source-map-animation-layer"),
  dialogue: presentationElement("source-dialogue"),
}, sourceMenuVolume() / 100, { resolveAnimationTarget: resolveSourceAnimationTarget });
const sourceBattleVisuals = new SourceBattleVisuals();
const sourceBattles = new SourceBattleController(sourceBattleVisuals, {
  getEventState: () => sourceEventState,
  updateEventState: (nextState) => {
    const previousState = sourceEventState;
    sourceEventState = nextState;
    persistSourceEventState();
    queueMicrotask(() => { beginNewlyActivatedSourceAutorun(previousState, nextState); });
  },
  getResources: () => importedAssets === null ? null : {
    catalog: importedAssets.battleCatalog,
    battleback: importedAssets.battleback ?? "snow",
    battleMusic: importedAssets.wildBattleBgm,
    victoryMusic: importedAssets.wildVictoryMe,
  },
  setNotice: (notice) => { importedNotice = notice; },
  render,
});
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

const multiplayer = new OverworldNetworkSession(STORED_SESSION_KEY, {
  onStatus: setNetworkText,
  onWorldState: setAuthoritativeState,
  onEvents: (receivedEvents) => { events.push(...receivedEvents); },
  onMapChanged: (mapId) => { viewedMapId = mapId; },
  onConnectionFormChanged: (serverUrl, roomCode) => {
    const serverInput = document.querySelector<HTMLInputElement>("#server-url");
    if (serverInput !== null) serverInput.value = serverUrl;
    const codeInput = document.querySelector<HTMLInputElement>("#room-code");
    if (codeInput !== null) codeInput.value = roomCode;
  },
  onRender: render,
});

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

function animateImportedMap(now: number): void {
  if (viewedMapId !== SOURCE_MAP_ID || importedAssets === null) {
    importedAnimationFrame = null;
    return;
  }
  const pose = importedPlayerMotion === null
    ? { ...importedAvatar, pattern: 0, complete: true }
    : sampleSourceGridMotion(importedPlayerMotion, now);
  if (sourceScenes.allows("ambient-motion", sourceSceneActivity())) {
    sourceNpcMotions.update(now, importedAssets.map, importedAssets.events, sourceEventState, importedAvatar);
  }
  drawImportedMap(context, canvas, importedAssets, pose, pose.pattern, now, sourceEventState, sourceNpcMotions.poses(now),
    sourcePresentation.currentCameraOffset());
  if (importedPlayerMotion !== null && pose.complete) {
    importedPlayerMotion = null;
    if (sourceSequence === null) finishImportedStep();
  }
  importedAnimationFrame = requestAnimationFrame(animateImportedMap);
}

function sourceSceneActivity(): SourceSceneActivity {
  return { dialogue: sourceDialogues.current !== null, battle: sourceBattles.active,
    transition: sourceTransitionInProgress, sequence: sourceSequence !== null,
    movement: importedPlayerMotion !== null };
}

function escapeMenuText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function sourceMenuVolume(): number {
  const stored = Number(localStorage.getItem("pokemon-z-battle.options.volume.v1") ?? 80);
  return Number.isFinite(stored) ? Math.max(0, Math.min(100, stored)) : 80;
}

function saveCurrentSourceWorld(): void {
  if (importedAssets === null) return;
  sourceWorldSave = createSourceWorldSave(importedAssets.map.id, importedAvatar.x, importedAvatar.y,
    importedAvatar.direction);
  persistSourceWorldSave(localStorage, sourceWorldSave);
  persistSourceEventState();
  importedNotice = `Partie sauvegardée dans ${importedAssets.map.name}, en ${importedAvatar.x},${importedAvatar.y}.`;
  renderImportedView();
}

function deleteSourceWorldSave(): void {
  clearSourceWorldSave(localStorage);
  sourceWorldSave = null;
  importedNotice = "Position sauvegardée supprimée ; la progression narrative reste conservée.";
  renderImportedView();
}

function renderSourceMenu(): void {
  const menu = document.querySelector<HTMLElement>("#source-menu");
  const content = document.querySelector<HTMLElement>("#source-menu-content");
  if (menu === null || content === null || importedAssets === null) return;
  menu.hidden = !sourceScenes.menuOpen;
  if (!sourceScenes.menuOpen) return;
  const location = document.querySelector<HTMLElement>("#source-menu-location");
  if (location !== null) location.textContent = importedAssets.map.name;
  document.querySelectorAll<HTMLButtonElement>("[data-source-menu-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.sourceMenuTab === sourceScenes.menuTab);
  });
  const speciesName = (species: string): string => importedAssets?.battleCatalog.pokemon
    .find((entry) => entry.internalName === species)?.name ?? species;
  const moveName = (move: string): string => importedAssets?.battleCatalog.moves
    .find((entry) => entry.internalName === move)?.name ?? move;
  if (sourceScenes.menuTab === "team") {
    const members = sourceEventState.party.members;
    content.innerHTML = `<div class="source-menu-title"><div><small>COMPAGNONS</small><h3>Équipe Pokémon</h3></div><span>${members.length}/6</span></div><div class="source-team-grid">${members.length === 0
      ? '<div class="source-menu-empty"><img src="/__pokemon-z/source/Graphics/Pictures/partyBall.PNG" alt=""><strong>Équipe vide</strong><small>Choisissez votre premier Pokémon pour commencer.</small></div>'
      : members.map((member, index) => {
        const name = escapeMenuText(member.nickname ?? speciesName(member.species));
        const hp = Math.round(member.hp / member.stats.maxHp * 100);
        const moves = member.moves.map((move) => escapeMenuText(moveName(move.internalName))).join(" · ");
        return `<article class="source-team-card${index === sourceEventState.party.activeIndex ? " active" : ""}"><img src="/__pokemon-z/source/Graphics/Pictures/partyBall.PNG" alt=""><div><small>${index === sourceEventState.party.activeIndex ? "EN TÊTE" : escapeMenuText(member.species)}</small><strong>${name} <span>N.${member.level}</span></strong><div class="source-menu-hp"><i style="width:${hp}%"></i></div><em>${member.hp}/${member.stats.maxHp} PV</em><p>${moves}</p></div></article>`;
      }).join("")}</div>`;
  } else if (sourceScenes.menuTab === "bag") {
    const entries = Object.entries(sourceEventState.inventory);
    content.innerHTML = `<div class="source-menu-title"><div><small>INVENTAIRE</small><h3>Sac</h3></div><span>${entries.length} type${entries.length > 1 ? "s" : ""}</span></div><div class="source-bag-list">${entries.length === 0
      ? '<div class="source-menu-empty"><img src="/__pokemon-z/source/Graphics/Icons/bagPocket1.png" alt=""><strong>Le sac est vide</strong><small>Les objets ramassés apparaîtront ici.</small></div>'
      : entries.map(([itemId, quantity], index) => `<article><img src="/__pokemon-z/source/Graphics/Icons/bagPocket${index % 8 + 1}.png" alt=""><strong>${escapeMenuText(importedAssets?.itemNames.get(itemId) ?? itemId)}</strong><span>×${quantity}</span></article>`).join("")}</div>`;
  } else if (sourceScenes.menuTab === "save") {
    const savedLabel = sourceWorldSave === null ? "Aucune position enregistrée"
      : `Map${String(sourceWorldSave.mapId).padStart(3, "0")} · ${sourceWorldSave.x},${sourceWorldSave.y} · ${new Date(sourceWorldSave.savedAt).toLocaleString("fr-FR")}`;
    content.innerHTML = `<div class="source-menu-title"><div><small>PROGRESSION</small><h3>Sauvegarde</h3></div><span>${sourceWorldSave === null ? "VIDE" : "MANUELLE"}</span></div><div class="source-save-card"><div class="source-save-location"><small>POSITION ACTUELLE</small><strong>${escapeMenuText(importedAssets.map.name)}</strong><span>${importedAvatar.x}, ${importedAvatar.y} · direction ${importedAvatar.direction}</span></div><div class="source-save-status"><i></i><div><strong>${escapeMenuText(savedLabel)}</strong><small>La position rejoint l'équipe, l'inventaire, les interrupteurs et les variables déjà persistés.</small></div></div><div class="source-save-actions"><button id="save-source-world">Sauvegarder ici</button>${sourceWorldSave === null ? "" : '<button id="delete-source-world" class="danger">Effacer la position</button>'}</div></div>`;
    content.querySelector<HTMLButtonElement>("#save-source-world")?.addEventListener("click", saveCurrentSourceWorld);
    content.querySelector<HTMLButtonElement>("#delete-source-world")?.addEventListener("click", deleteSourceWorldSave);
  } else {
    const volume = sourceMenuVolume();
    content.innerHTML = `<div class="source-menu-title"><div><small>PRÉFÉRENCES</small><h3>Options</h3></div><span>LOCAL</span></div><div class="source-options-list"><label><span><strong>Volume général</strong><small>Contrôle les musiques et effets des cinématiques.</small></span><output id="source-volume-value">${volume}%</output><input id="source-volume" type="range" min="0" max="100" value="${volume}"></label><article><strong>Commandes</strong><small>Flèches ou ZQSD : déplacement · Espace/Entrée : interaction · Échap/M : menu</small></article></div>`;
    content.querySelector<HTMLInputElement>("#source-volume")?.addEventListener("input", (event) => {
      const input = event.currentTarget as HTMLInputElement;
      localStorage.setItem("pokemon-z-battle.options.volume.v1", input.value);
      sourcePresentation.setMasterVolume(Number(input.value) / 100);
      const output = content.querySelector<HTMLOutputElement>("#source-volume-value");
      if (output !== null) output.value = `${input.value}%`;
    });
  }
}

function toggleSourceMenu(): void {
  if (sourceScenes.menuOpen) sourceScenes.closeMenu();
  else if (!sourceScenes.openMenu(sourceSceneActivity())) return;
  heldMovementKeys.clear();
  renderImportedView();
}

function renderImportedView(): void {
  const sourceBattle = sourceBattles.current;
  if (importedAssets === null) return;
  renderStarterTestButton();
  const assets = importedAssets;
  if (importedAnimationFrame === null) importedAnimationFrame = requestAnimationFrame(animateImportedMap);
  const name = document.querySelector<HTMLElement>("#map-name"); if (name !== null) name.textContent = `${importedAssets.map.name} · Map${String(importedAssets.map.id).padStart(3, "0")}`;
  const tick = document.querySelector<HTMLElement>("#tick"); if (tick !== null) tick.textContent = `${importedAvatar.x},${importedAvatar.y}`;
  const progress = document.querySelector<HTMLElement>("#progress");
  const visibleEvents = assets.events.filter((event) => {
    const page = selectEventPage(event, assets.map.id, sourceEventState);
    return page !== null && (page.graphic.characterName !== "" || page.graphic.tileId > 0);
  }).length;
  const inventory = Object.entries(sourceEventState.inventory).map(([itemId, quantity]) => `${assets.itemNames.get(itemId) ?? itemId} ×${quantity}`).join(", ") || "vide";
  const checkpoint = sourceEventState.checkpoint;
  const checkpointLabel = checkpoint === null ? "Bourg Canvas · 28,15" : `Map${String(checkpoint.mapId).padStart(3, "0")} · ${checkpoint.x},${checkpoint.y}`;
  const speciesName = (species: string): string => assets.battleCatalog.pokemon.find((entry) => entry.internalName === species)?.name ?? species;
  const party = sourceEventState.party.members.length === 0 ? "vide (starter non choisi)"
    : sourceEventState.party.members.map((member) => `${member.nickname ?? speciesName(member.species)} N.${member.level} · ${member.hp}/${member.stats.maxHp} PV · ${member.experience} EXP`).join(", ");
  const pendingEncounter = sourceEventState.pendingEncounter;
  if (progress !== null) {
    const encounterLabel = pendingEncounter === null ? "aucune" : sourceBattle === null
      ? `${speciesName(pendingEncounter.species)} N.${pendingEncounter.level} en attente <button id="start-source-encounter">Lancer</button>`
      : `${speciesName(pendingEncounter.species)} N.${pendingEncounter.level} en cours`;
    const sequenceStatus = sourceSequence === null ? "aucune" : `${sourceSequence.label} · étape ${sourceSequence.cursor}/${sourceSequence.plan.steps.length}`
      + ` · ${sourceSequence.plan.steps[sourceSequence.cursor]?.command.kind ?? "finalisation"}`
      + ` · ${sourceSequence.runner.pendingRoutes} route(s)`;
    progress.innerHTML = `<p><strong>Source</strong> tileset ${importedAssets.tileset.tilesetName}</p><p><strong>Carte</strong> ${importedAssets.map.width} × ${importedAssets.map.height} · ${visibleEvents} événements visibles</p><p><strong>Équipe</strong> ${party}</p><p><strong>Rencontre</strong> ${encounterLabel}</p><p><strong>Inventaire</strong> ${inventory}</p><p><strong>Reprise</strong> ${checkpointLabel}</p><p><strong>Séquence</strong> ${escapeMenuText(sequenceStatus)}</p>${sourceSceneAuditNotice === null ? "" : `<p><strong>Audit scène</strong> ${sourceSceneAuditNotice}</p>`}`;
    progress.querySelector<HTMLButtonElement>("#start-source-encounter")?.addEventListener("click", startPendingSourceEncounter);
  }
  const log = document.querySelector<HTMLElement>("#events"); if (log !== null) log.textContent = importedNotice;
  const legend = document.querySelector<HTMLElement>("#map-legend"); if (legend !== null) legend.innerHTML = `<span class="source"></span>Graphismes locaux originaux <span class="door"></span>Origine d'un transfert`;
  document.querySelectorAll<HTMLButtonElement>("[data-map]").forEach((button) => button.classList.toggle("active", button.dataset.map === viewedMapId));
  document.querySelectorAll<HTMLElement>("[data-controller]").forEach((controller) => controller.classList.toggle("disabled", controller.dataset.controller === "opponent"));
  const reset = document.querySelector<HTMLButtonElement>("#reset"); if (reset !== null) {
    reset.disabled = !sourceScenes.allows("scene-change", sourceSceneActivity());
    reset.textContent = sourceEventState.checkpoint === null ? "Réinitialiser la position" : "Revenir au point de reprise";
  }
  const create = document.querySelector<HTMLButtonElement>("#create-room"); if (create !== null) create.disabled = true;
  const join = document.querySelector<HTMLButtonElement>("#join-room"); if (join !== null) join.disabled = true;
  const guide = document.querySelector<HTMLElement>("#coop-guide"); if (guide !== null) guide.innerHTML = `<article><span>9.5</span><strong>Choix et conditions</strong><small>Les branches imbriquées suivent la réponse et l'état courant.</small></article><article><span>REPRISE</span><strong>Point de soin</strong><small>L'infirmière mémorise la carte et la position de retour.</small></article><article><span>COMBAT</span><strong>Rencontre source</strong><small>L'équipe persistante affronte le Pokémon sauvage puis récupère ses PV, statuts et PP.</small></article>`;
  const guidePhase = document.querySelector<HTMLElement>("#guide-phase"); if (guidePhase !== null) guidePhase.textContent = "Phase 9.5";
  const guideTitle = document.querySelector<HTMLElement>("#guide-title"); if (guideTitle !== null) guideTitle.textContent = "État des événements";
  renderSourceDialogue();
  renderEncounter();
  renderSourceMenu();
}

function renderSourceDialogue(): void {
  const sourceDialogue = sourceDialogues.current;
  const panel = document.querySelector<HTMLElement>("#source-dialogue");
  if (panel === null) return;
  panel.hidden = sourceDialogue === null || viewedMapId !== SOURCE_MAP_ID;
  if (sourceDialogue === null || viewedMapId !== SOURCE_MAP_ID) return;
  const label = panel.querySelector<HTMLElement>("strong"); if (label !== null) label.textContent = sourceDialogue.label;
  const text = panel.querySelector<HTMLElement>("p"); if (text !== null) {
    text.hidden = sourceDialogue.choosing;
    text.textContent = sourceDialogue.lines[sourceDialogue.index] ?? "";
  }
  const choices = panel.querySelector<HTMLElement>(".source-choices");
  const pending = sourceDialogue.flow.pendingChoice;
  if (choices !== null) {
    choices.hidden = !sourceDialogue.choosing || pending === null;
    choices.innerHTML = !sourceDialogue.choosing || pending === null ? "" : pending.choices.map((choice, index) =>
      `<button type="button" data-source-choice="${index}"><span>${index + 1}</span>${localizedDialogueText(choice, sourceDialogue?.translations)}</button>`).join("");
    choices.querySelectorAll<HTMLButtonElement>("[data-source-choice]").forEach((button) => button.addEventListener("click", () => {
      const index = Number(button.dataset.sourceChoice);
      if (Number.isInteger(index)) chooseSourceOption(index);
    }));
  }
  const hint = panel.querySelector<HTMLElement>("small"); if (hint !== null) hint.textContent = sourceDialogue.choosing
    ? "Choisissez une réponse · Échap pour annuler"
    : sourceDialogue.index + 1 < sourceDialogue.lines.length
      ? `Espace/Entrée · ${sourceDialogue.index + 1}/${sourceDialogue.lines.length}` : "Espace/Entrée pour continuer";
}

function applyCompletedSourceEvent(completed: SourceDialogueSession): void {
  const result = applySafeStateCommands(sourceEventState, completed.flow.page, completed.mapId, completed.eventId,
    { checkpoint: { mapId: completed.mapId, x: importedAvatar.x, y: importedAvatar.y, direction: importedAvatar.direction },
      createPokemon: (species, level) => {
        if (importedAssets === null) throw new Error("Catalogue Pokémon indisponible.");
        return createPersistentPokemon(crypto.randomUUID(), species, level, importedAssets.battleCatalog);
      } });
  if (!result.safe) {
    importedNotice = `Dialogue terminé ; état inchangé (${result.reason ?? "commande non prise en charge"}).`;
    return;
  }
  const encounterQueued = sourceEventState.pendingEncounter === null && result.state.pendingEncounter !== null;
  sourceEventState = result.state;
  if (result.appliedCommands > 0) {
    persistSourceEventState();
    importedNotice = `Dialogue terminé ; ${result.appliedCommands} commande(s) d'état appliquée(s) et mémorisée(s).`;
  } else importedNotice = "Dialogue terminé.";
  if (encounterQueued) {
    startPendingSourceEncounter();
    return;
  }
  const menuButton = document.querySelector<HTMLButtonElement>("#open-source-menu"); if (menuButton !== null) {
    menuButton.disabled = !sourceScenes.menuOpen && !sourceScenes.allows("scene-change", sourceSceneActivity());
    menuButton.textContent = sourceScenes.menuOpen ? "Fermer le menu" : "Menu";
  }
  const transfer = finalDirectSourceTransfer(completed.flow.page.commands, completed.eventId, 0, importedAvatar);
  if (transfer !== null) void followSourceTransfer(transfer);
}

const PRE_ENCOUNTER_PRESENTATION = new Set(["move-route", "move-route-continuation", "wait-for-movement", "wait"]);

function beginPreEncounterMovement(completed: SourceDialogueSession): boolean {
  const commands = completed.flow.page.commands;
  const encounterIndex = commands.findIndex((command) => command.kind === "request-encounter");
  const firstRoute = commands.findIndex((command, index) => index < encounterIndex && command.kind === "move-route");
  if (encounterIndex < 0 || firstRoute < 0) return false;
  const presentationCommands = commands.slice(firstRoute, encounterIndex)
    .filter((command) => PRE_ENCOUNTER_PRESENTATION.has(command.kind));
  sourceSequence = { label: `${completed.label} · cinématique`, mapId: completed.mapId,
    eventId: completed.eventId,
    plan: compileAndReportSourceScene({ ...completed.flow.page, commands: presentationCommands },
      `${completed.label} · avant-combat`),
    translations: completed.translations, cursor: 0, advancing: false, runner: new SourceSequenceRunner(),
    onComplete: () => applyCompletedSourceEvent(completed) };
  importedNotice = "Cinématique avant le combat…";
  void advanceSourceSequence();
  return true;
}

function finishSourceEvent(completed: SourceDialogueSession): void {
  if (sourceSequence !== null && completed.eventId === sourceSequence.eventId) {
    if (!completed.flow.complete) {
      importedNotice = `Séquence interrompue : ${completed.flow.blockedReason ?? "dialogue incomplet"}.`;
      sourceSequence = null;
      return;
    }
    void advanceSourceSequence();
    return;
  }
  if (!completed.flow.complete) {
    importedNotice = `Événement interrompu ; état inchangé (${completed.flow.blockedReason ?? "branche incomplète"}).`;
    return;
  }
  if (!beginPreEncounterMovement(completed)) applyCompletedSourceEvent(completed);
}

function applySourceDialogueUpdate(update: SourceDialogueUpdate): void {
  if (update.completed !== null) finishSourceEvent(update.completed);
}

function chooseSourceOption(index: number): void {
  const update = sourceDialogues.choose(index, sourceEventState, sourceDirectionNumber(importedAvatar.direction));
  applySourceDialogueUpdate(update);
  if (update.changed) renderImportedView();
}

function beginSourceEvent(page: ImportedEventPage, mapId: number, eventId: number, label: string,
  translations: ReadonlyMap<string, string>): void {
  applySourceDialogueUpdate(sourceDialogues.begin(page, mapId, eventId, label, translations, sourceEventState,
    sourceDirectionNumber(importedAvatar.direction)));
}

function importedDirection(direction: number, fallback: Direction): Direction {
  switch (direction) {
    case 2: return "down";
    case 4: return "left";
    case 6: return "right";
    case 8: return "up";
    default: return fallback;
  }
}

function sourceDirectionNumber(direction: Direction): number {
  switch (direction) {
    case "down": return 2;
    case "left": return 4;
    case "right": return 6;
    case "up": return 8;
  }
}

async function followSourceTransfer(transfer: ImportedTransfer): Promise<void> {
  if (!sourceScenes.allows("source-transfer", sourceSceneActivity())) return;
  sourceTransitionInProgress = true;
  sourceDialogues.cancel();
  importedNotice = `Chargement de Map${String(transfer.targetMapId).padStart(3, "0")}…`;
  renderImportedView();
  try {
    const current = importedAssets;
    const changesMap = current === null || current.map.id !== transfer.targetMapId;
    const next = changesMap ? await loadImportedMap(transfer.targetMapId) : current;
    importedAssets = next;
    if (changesMap) pendingSourceMapEntryAutorun = next.map.id;
    sourcePresentation.resetMapPresentation();
    sourceNpcMotions.reset(next.map.id, next.events, performance.now());
    importedAvatar = { x: transfer.targetX, y: transfer.targetY, direction: importedDirection(transfer.direction, importedAvatar.direction) };
    importedPlayerMotion = null;
    heldMovementKeys.clear();
    importedNotice = `Arrivée dans ${next.map.name}, en ${transfer.targetX},${transfer.targetY}. Graphismes, événements et français chargés à la demande.`;
  } catch (error) {
    importedNotice = error instanceof Error ? `Changement de carte impossible : ${error.message}` : "Changement de carte impossible.";
  } finally {
    sourceTransitionInProgress = false;
    renderImportedView();
  }
  if (sourceSequence === null) queueMicrotask(beginPendingSourceMapEntryAutorun);
}

async function resetSourceWorld(): Promise<void> {
  if (!sourceScenes.allows("scene-change", sourceSceneActivity())) return;
  sourceTransitionInProgress = true;
  sourceDialogues.cancel();
  const checkpoint = sourceEventState.checkpoint;
  importedNotice = checkpoint === null ? "Retour à Bourg Canvas…" : `Retour au point de reprise Map${String(checkpoint.mapId).padStart(3, "0")}…`;
  renderImportedView();
  try {
    importedAssets = checkpoint === null ? await loadImportedMap003() : await loadImportedMap(checkpoint.mapId);
    sourcePresentation.resetMapPresentation();
    sourceNpcMotions.reset(importedAssets.map.id, importedAssets.events, performance.now());
    importedAvatar = checkpoint === null ? { x: 28, y: 15, direction: "up" }
      : { x: checkpoint.x, y: checkpoint.y, direction: checkpoint.direction };
    importedPlayerMotion = null;
    heldMovementKeys.clear();
    importedNotice = checkpoint === null ? "Position de test restaurée en 28,15, face à un événement dialogué."
      : `Point de reprise restauré dans ${importedAssets.map.name}, en ${importedAvatar.x},${importedAvatar.y}.`;
  } catch (error) {
    importedNotice = error instanceof Error ? error.message : "Réinitialisation impossible.";
  } finally {
    sourceTransitionInProgress = false;
    renderImportedView();
  }
}

async function openStarterTest(): Promise<void> {
  if (!sourceScenes.allows("scene-change", sourceSceneActivity()) || multiplayer.active) return;
  if (sourceEventState.party.members.length > 0) {
    importedNotice = "Un starter a déjà été choisi : les autres socles restent verrouillés.";
    render();
    return;
  }
  sourceTransitionInProgress = true;
  sourceDialogues.cancel();
  importedNotice = "Chargement de la salle de sélection des starters…";
  try {
    sourceEventState = { ...sourceEventState, switches: { ...sourceEventState.switches, 238: true } };
    persistSourceEventState();
    importedAssets = await loadImportedMap(2);
    sourcePresentation.resetMapPresentation();
    sourceNpcMotions.reset(importedAssets.map.id, importedAssets.events, performance.now());
    importedAvatar = { x: 52, y: 22, direction: "up" };
    importedPlayerMotion = null;
    heldMovementKeys.clear();
    viewedMapId = SOURCE_MAP_ID;
    importedNotice = "Test starter Kalos prêt : Chespin se trouve juste devant vous ; Feunnec et Grenousse sont sur les socles voisins.";
  } catch (error) {
    importedNotice = error instanceof Error ? `Salle des starters inaccessible : ${error.message}` : "Salle des starters inaccessible.";
  } finally {
    sourceTransitionInProgress = false;
    render();
  }
}

function renderStarterTestButton(): void {
  const button = document.querySelector<HTMLButtonElement>("#starter-test");
  if (button === null) return;
  const starterChosen = sourceEventState.party.members.length > 0;
  button.disabled = starterChosen;
  button.title = starterChosen ? "Un starter a déjà été choisi dans cette sauvegarde." : "";
}

function render(): void {
  renderStarterTestButton();
  const network = multiplayer.current;
  if (viewedMapId === SOURCE_MAP_ID && importedAssets !== null) {
    renderImportedView();
    return;
  }
  if (importedAnimationFrame !== null) {
    cancelAnimationFrame(importedAnimationFrame);
    importedAnimationFrame = null;
  }
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
  const legend = document.querySelector<HTMLElement>("#map-legend"); if (legend !== null) legend.innerHTML = `<span class="ground"></span>Sol <span class="wall"></span>Collision <span class="door"></span>Transition <span class="interaction"></span>Interaction`;
  document.querySelectorAll<HTMLElement>("[data-controller]").forEach((controller) => {
    const disabled = network !== null && controller.dataset.controller !== network.ticket.side;
    controller.classList.toggle("disabled", disabled);
  });
  const reset = document.querySelector<HTMLButtonElement>("#reset"); if (reset !== null) {
    reset.disabled = network !== null;
    reset.textContent = "Réinitialiser le monde";
  }
  const create = document.querySelector<HTMLButtonElement>("#create-room"); if (create !== null) create.disabled = network !== null;
  const join = document.querySelector<HTMLButtonElement>("#join-room"); if (join !== null) join.disabled = network !== null;
  const guide = document.querySelector<HTMLElement>("#coop-guide");
  const guidePhase = document.querySelector<HTMLElement>("#guide-phase"); if (guidePhase !== null) guidePhase.textContent = "Phase 8.3";
  const guideTitle = document.querySelector<HTMLElement>("#guide-title"); if (guideTitle !== null) guideTitle.textContent = "Parcours coop";
  if (guide !== null) guide.innerHTML = (catalog.interactions ?? []).map((interaction) => {
    const personalDone = Object.values(state.players).filter((player) => player.completedInteractions.includes(interaction.id)).length;
    const sharedDone = state.session.completedInteractions.includes(interaction.id);
    const waiting = state.session.syncedParticipants[interaction.id]?.length ?? 0;
    const status = interaction.policy === "PERSONAL" ? `${personalDone}/2` : sharedDone ? "terminé" : waiting > 0 ? `${waiting}/2 en attente` : "disponible";
    return `<article><span>${interaction.policy}</span><strong>${interaction.label}</strong><small>${interaction.mapId} · ${status}</small></article>`;
  }).join("");
  renderSourceDialogue();
  renderEncounter();
}

function renderEncounter(): void {
  const network = multiplayer.current;
  const sourceBattle = sourceBattles.current;
  const sourceBattleAnimating = sourceBattles.animating;
  const panel = document.querySelector<HTMLElement>("#encounter-panel");
  const networkBattle = network?.snapshot?.battle ?? null;
  const battleState = viewedMapId === SOURCE_MAP_ID && sourceBattle !== null ? sourceBattle : networkBattle?.state ?? null;
  if (panel === null) return;
  panel.hidden = battleState === null;
  if (battleState === null) return;
  const localSourceBattle = battleState === sourceBattle;
  const visualStage = document.querySelector<HTMLElement>("#source-battle-stage");
  if (visualStage !== null) visualStage.hidden = !localSourceBattle;
  if (localSourceBattle) sourceBattles.renderVisuals();
  const playerTeam = battleState.teams.player;
  const opponentTeam = battleState.teams.opponent;
  const player = playerTeam.members[playerTeam.activeIndex];
  const opponent = opponentTeam.members[opponentTeam.activeIndex];
  if (player === undefined || opponent === undefined) return;
  const title = document.querySelector<HTMLElement>("#encounter-title"); if (title !== null) title.textContent = `${player.name} contre ${opponent.name}`;
  const turn = document.querySelector<HTMLElement>("#encounter-turn"); if (turn !== null) turn.textContent = `Tour ${battleState.turn}`;
  const summary = document.querySelector<HTMLElement>("#encounter-summary");
  if (summary !== null) summary.textContent = `${player.hp}/${player.stats.maxHp} PV · ${opponent.hp}/${opponent.stats.maxHp} PV${!localSourceBattle && network?.ticket.side === "opponent" ? " · observation" : ""}`;
  const actions = document.querySelector<HTMLElement>("#encounter-actions");
  if (actions !== null) {
    actions.innerHTML = player.moves.map((slot, index) => {
      const disabled = slot.pp <= 0 || (localSourceBattle && sourceBattleAnimating)
        || (!localSourceBattle && (network?.ticket.side !== "player" || network.submittedTurn === battleState.turn));
      return `<button data-encounter-move="${index}" ${disabled ? "disabled" : ""}>${slot.move.name}<small>${slot.pp} PP</small></button>`;
    }).join("") + (localSourceBattle && sourceEventState.pendingEncounter?.escapable === true
      ? `<button id="escape-source-encounter" ${sourceBattleAnimating ? "disabled" : ""}>Fuir<small>Quitter le combat sauvage</small></button>` : "");
    actions.querySelectorAll<HTMLButtonElement>("[data-encounter-move]").forEach((button) => button.addEventListener("click", () => {
      const moveIndex = Number(button.dataset.encounterMove);
      if (Number.isInteger(moveIndex)) {
        if (localSourceBattle) void sourceBattles.submitAction(moveIndex);
        else submitEncounterAction(moveIndex);
      }
    }));
    actions.querySelector<HTMLButtonElement>("#escape-source-encounter")?.addEventListener("click", () => { void sourceBattles.escape(); });
  }
}

function move(playerId: string, direction: Direction): void {
  if (viewedMapId === SOURCE_MAP_ID && importedAssets !== null) {
    if (playerId !== "player") return;
    if (!sourceScenes.allows("world-input", sourceSceneActivity())) return;
    const events = sourceMapEvents();
    const facingAvatar = { ...importedAvatar, direction };
    const eventAhead = playerTouchEventInDirection(events, importedAvatar, direction, importedAssets.map.id, sourceEventState);
    if (eventAhead !== null) {
      importedAvatar = facingAvatar;
      beginSourceSequence(eventAhead, `Événement de contact ${eventAhead.event.id} · ${eventAhead.event.name}`);
      return;
    }
    const before = importedAvatar;
    const next = moveImportedAvatar(importedAssets.map, importedAvatar, direction,
      blockingDefaultEventPoints(events, importedAssets.map.id, sourceEventState));
    importedAvatar = next;
    if (before.x !== next.x || before.y !== next.y) {
      importedPlayerMotion = createSourceGridMotion(before, next, direction, performance.now(),
        { walkingPattern: importedWalkingPattern });
      importedWalkingPattern = importedWalkingPattern === 1 ? 3 : 1;
      importedNotice = `Déplacement vers ${next.x},${next.y}…`;
    } else {
      importedNotice = `Passage bloqué vers ${direction}. La collision directionnelle source est respectée.`;
    }
    renderImportedView();
    return;
  }
  if (multiplayer.active) {
    multiplayer.sendMovement(playerId, direction);
    return;
  }
  const result = resolveMovement(catalog, state, { playerId, direction });
  events.push(...result.events);
  const avatar = result.state.avatars[playerId]; if (avatar !== undefined) viewedMapId = avatar.mapId;
  setAuthoritativeState(result.state, true);
}

function interact(playerId: AvatarId): void {
  if (viewedMapId === SOURCE_MAP_ID) {
    const activity = sourceSceneActivity();
    if (sourceScenes.allows("dialogue-input", activity)) {
      const update = sourceDialogues.advance();
      applySourceDialogueUpdate(update);
      if (update.changed) renderImportedView();
      return;
    }
    if (!sourceScenes.allows("world-input", activity)) return;
    if (importedAssets === null || playerId !== "player") return;
    const target = eventInFront(sourceMapEvents(), importedAvatar, importedAssets.map.id, sourceEventState);
    const targetTransfer = target === null ? null : transferForEvent(importedAssets.map, target);
    if (target !== null && targetTransfer !== null && target.page.settings.trigger === 1) {
      void followSourceTransfer(targetTransfer);
      return;
    }
    if (target !== null && target.page.settings.trigger === 0) {
      beginSourceEvent(target.page, importedAssets.map.id, target.event.id,
        `Événement ${target.event.id} · ${target.event.name}`, importedAssets.mapTranslations);
      if (sourceDialogues.current !== null) importedNotice = "Événement source démarré ; les choix déterminent maintenant la branche exécutée.";
    } else importedNotice = target === null ? "Aucun événement interactif devant le joueur." : "Cet événement n'est pas déclenché par interaction.";
    renderImportedView();
    return;
  }
  if (multiplayer.active) {
    multiplayer.sendInteraction(playerId);
    return;
  }
  const result = resolveInteraction(catalog, state, { playerId, hostPlayerId: "player" });
  events.push(...result.events);
  setAuthoritativeState(result.state, false);
}

function submitEncounterAction(moveIndex: number): void {
  multiplayer.submitEncounterAction(moveIndex);
}

function setNetworkText(stateText: string, notice: string, active: boolean): void {
  const stateElement = document.querySelector<HTMLElement>("#network-state");
  if (stateElement !== null) stateElement.textContent = stateText;
  const noticeElement = document.querySelector<HTMLElement>("#network-notice");
  if (noticeElement !== null) noticeElement.textContent = notice;
  const disconnect = document.querySelector<HTMLButtonElement>("#disconnect");
  if (disconnect !== null) disconnect.disabled = !active;
}

async function createOrJoin(kind: "create" | "join"): Promise<void> {
  if (sourceBattles.active) return;
  const serverInput = document.querySelector<HTMLInputElement>("#server-url");
  const codeInput = document.querySelector<HTMLInputElement>("#room-code");
  if (serverInput === null || codeInput === null) return;
  await multiplayer.createOrJoin(kind, serverInput.value, codeInput.value);
}

const keys: Readonly<Record<string, readonly [string, Direction]>> = {
  ArrowUp: ["player", "up"], ArrowDown: ["player", "down"], ArrowLeft: ["player", "left"], ArrowRight: ["player", "right"],
  KeyW: ["player", "up"], KeyZ: ["player", "up"], KeyS: ["player", "down"], KeyA: ["player", "left"], KeyQ: ["player", "left"], KeyD: ["player", "right"],
  KeyI: ["opponent", "up"], KeyK: ["opponent", "down"], KeyJ: ["opponent", "left"], KeyL: ["opponent", "right"],
};

function continueHeldSourceMovement(): void {
  const code = [...heldMovementKeys].at(-1);
  const command = code === undefined ? undefined : keys[code];
  if (command?.[0] === "player") move(...command);
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Escape") {
    if (sourceScenes.menuOpen) { event.preventDefault(); toggleSourceMenu(); return; }
    if (sourceDialogues.cancel()) { event.preventDefault(); renderImportedView(); return; }
    if (viewedMapId === SOURCE_MAP_ID) { event.preventDefault(); toggleSourceMenu(); return; }
  }
  if (event.code === "KeyM" && viewedMapId === SOURCE_MAP_ID) { event.preventDefault(); toggleSourceMenu(); return; }
  if (sourceScenes.menuOpen) { event.preventDefault(); return; }
  if (/^Digit[1-9]$/u.test(event.code) && sourceDialogues.current?.choosing === true) {
    event.preventDefault(); chooseSourceOption(Number(event.code.slice(5)) - 1); return;
  }
  if (event.code === "Enter" && viewedMapId === SOURCE_MAP_ID) { event.preventDefault(); interact("player"); return; }
  if (event.code === "Space") { event.preventDefault(); interact("player"); return; }
  if (event.code === "KeyO") { event.preventDefault(); interact("opponent"); return; }
  const command = keys[event.code];
  if (command === undefined) return;
  event.preventDefault();
  if (viewedMapId === SOURCE_MAP_ID && command[0] === "player") {
    if (event.repeat) return;
    heldMovementKeys.add(event.code);
  }
  move(...command);
});
window.addEventListener("keyup", (event) => { heldMovementKeys.delete(event.code); });
window.addEventListener("blur", () => { heldMovementKeys.clear(); });
document.querySelectorAll<HTMLButtonElement>(".pad button").forEach((button) => button.addEventListener("click", () => {
  const playerId = button.closest<HTMLElement>("[data-player]")?.dataset.player;
  const direction = button.dataset.direction as Direction | undefined;
  if (playerId !== undefined && direction !== undefined) move(playerId, direction);
}));
document.querySelectorAll<HTMLButtonElement>("[data-interact]").forEach((button) => button.addEventListener("click", () => {
  const playerId = button.dataset.interact;
  if (playerId === "player" || playerId === "opponent") interact(playerId);
}));
document.querySelectorAll<HTMLButtonElement>("[data-map]").forEach((button) => button.addEventListener("click", () => {
  const mapId = button.dataset.map;
  if (mapId === undefined || !sourceScenes.allows("scene-change", sourceSceneActivity())
    || (mapId === SOURCE_MAP_ID && (importedAssets === null || multiplayer.active))) return;
  viewedMapId = mapId;
  render();
}));
document.querySelector<HTMLButtonElement>("#open-source-menu")?.addEventListener("click", toggleSourceMenu);
document.querySelector<HTMLButtonElement>("#close-source-menu")?.addEventListener("click", toggleSourceMenu);
document.querySelectorAll<HTMLButtonElement>("[data-source-menu-tab]").forEach((button) => button.addEventListener("click", () => {
  const tab = button.dataset.sourceMenuTab as SourceMenuTab | undefined;
  if (tab === undefined || !["team", "bag", "save", "options"].includes(tab)) return;
  sourceScenes.selectMenuTab(tab);
  renderSourceMenu();
}));
document.querySelector<HTMLButtonElement>("#starter-test")?.addEventListener("click", () => { void openStarterTest(); });
document.querySelector<HTMLInputElement>("#room-code")?.addEventListener("input", (event) => {
  const input = event.currentTarget as HTMLInputElement;
  input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/gu, "");
});
document.querySelector<HTMLButtonElement>("#create-room")?.addEventListener("click", () => { void createOrJoin("create"); });
document.querySelector<HTMLButtonElement>("#join-room")?.addEventListener("click", () => { void createOrJoin("join"); });
document.querySelector<HTMLButtonElement>("#disconnect")?.addEventListener("click", () => {
  multiplayer.disconnect();
  viewedMapId = "meadow";
  events = [];
  setAuthoritativeState(initialState(), false);
});
document.querySelector<HTMLButtonElement>("#reset")?.addEventListener("click", () => {
  if (multiplayer.active) return;
  if (viewedMapId === SOURCE_MAP_ID) {
    void resetSourceWorld();
    return;
  }
  viewedMapId = "meadow";
  events = [];
  setAuthoritativeState(initialState(), false);
});
render();

async function initializeSourceWorld(): Promise<void> {
  const requestedSave = sourceWorldSave;
  try {
    let assets: ImportedMapAssets;
    try {
      assets = requestedSave === null ? await loadImportedMap003() : await loadImportedMap(requestedSave.mapId);
      if (requestedSave !== null && (requestedSave.x >= assets.map.width || requestedSave.y >= assets.map.height)) {
        throw new Error("La position sauvegardée se trouve hors de la carte.");
      }
    } catch (savedError) {
      if (requestedSave === null) throw savedError;
      clearSourceWorldSave(localStorage);
      sourceWorldSave = null;
      assets = await loadImportedMap003();
      importedNotice = "Sauvegarde de position ignorée car elle était inaccessible ; retour à Bourg Canvas.";
    }
    importedAssets = assets;
    sourcePresentation.resetMapPresentation();
    sourceNpcMotions.reset(assets.map.id, assets.events, performance.now());
    if (sourceWorldSave !== null) {
      importedAvatar = { x: sourceWorldSave.x, y: sourceWorldSave.y, direction: sourceWorldSave.direction };
      importedNotice = `Partie reprise dans ${assets.map.name}, en ${sourceWorldSave.x},${sourceWorldSave.y}.`;
    } else if (requestedSave === null) {
      importedNotice = "Bourg Canvas chargée avec ses personnages source. Appuyez sur Espace pour parler au personnage juste devant vous.";
    }
    const sourceButton = document.querySelector<HTMLButtonElement>(`[data-map="${SOURCE_MAP_ID}"]`);
    if (sourceButton !== null) sourceButton.disabled = false;
    if (!multiplayer.active) {
      viewedMapId = SOURCE_MAP_ID;
      render();
    }
  } catch (error) {
    importedNotice = error instanceof Error ? error.message : "Impossible de charger la carte locale.";
    const sourceButton = document.querySelector<HTMLButtonElement>(`[data-map="${SOURCE_MAP_ID}"]`);
    if (sourceButton !== null) sourceButton.title = `${importedNotice} Relancez pnpm prepare:local.`;
    setNetworkText("Données absentes", `${importedNotice} Relancez pnpm prepare:local.`, multiplayer.active);
  }
}

void initializeSourceWorld();

multiplayer.restore();
