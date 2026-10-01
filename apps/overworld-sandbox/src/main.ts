import { DEMO_WORLD_CATALOG, createDemoWorldState, resolveInteraction, resolveMovement, type Direction, type OverworldEvent, type OverworldState } from "@pokemon-z-battle/overworld-engine";
import { SOURCE_MAP_ID, activeEventAt, blockingDefaultEventPoints, drawImportedMap, eventInInteractionRange, importedCameraPosition, moveImportedAvatar, playerTouchEventInDirection, selectEventPage, transferForEvent, type ImportedAvatar, type ImportedEventPage, type ImportedMapAssets, type ImportedTransfer } from "./imported-map.js";
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
import { finalDirectSourceTransfer, findActiveSourceParallelEvents, findNewlyActivatedSourceAutorun,
  findSourceMapEntryAutorun, isSourceParallelInitialization, type ActiveSourceAutorun } from "./source-autorun.js";
import { resolveEventFlow, type PendingEventChoice } from "./source-event-flow.js";
import { executeSourceMoveRouteStep, parseSourceMoveRoute, type SourceRouteActor } from "./source-move-route.js";
import { isSourceStateCommand } from "./source-command-registry.js";
import { compileSourceScene, formatSourceSceneAudit, type SourceScenePlan } from "./source-scene-plan.js";
import { SourceSequenceRunner } from "./source-sequence-runner.js";
import { SourceSceneCoordinator, type SourceMenuTab, type SourceSceneActivity } from "./source-scene-coordinator.js";
import { SourceScenePresentation } from "./source-scene-presentation.js";
import { SourceMenuView, SourceShopView, sourceMenuVolume } from "./source-menu-view.js";
import { DemoOverworldView, type DemoAvatarId } from "./demo-overworld-view.js";
import { mountOverworldApp, requiredAppElement } from "./overworld-app-shell.js";
import { SourceOverworldHud } from "./source-overworld-hud.js";
import { SourceDialogueView } from "./source-dialogue-view.js";
import { SourceBattleOverlay } from "./source-battle-overlay.js";
import { loadInitialSourceWorld, loadSourceCheckpoint, loadSourceTransfer, loadSourceWorldAt,
  sourceDirection, type LoadedSourceWorld } from "./source-world-navigation.js";
import { sourceItemGainMessage, sourceItemGains, sourceItemPickupOffset,
  type SourceItemGain } from "./source-item-presentation.js";
import { clearSourceWorldSave, createSourceWorldSave, loadSourceWorldSave, persistSourceWorldSave,
  type SourceWorldSave } from "./source-world-save.js";
import { purchaseSourceItem, type SourceShopItem } from "./source-economy.js";
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
let sourceParallelAuditNotice: string | null = null;
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
  plan: SourceScenePlan;
  readonly translations: ReadonlyMap<string, string>;
  readonly sourcePage?: ImportedEventPage;
  selections: number[];
  pendingChoice: PendingEventChoice | null;
  cursor: number;
  advancing: boolean;
  autorunBaseline?: SourceEventState;
  readonly runner: SourceSequenceRunner;
  readonly onComplete?: () => void;
}
let sourceSequence: SourceSequenceSession | null = null;
let sourcePickupPose = false;
let sourcePickupStartedAt: number | null = null;
let sourcePickupDialogueSequence: SourceSequenceSession | null = null;
let sourceSequenceChoicePrompt: SourceSequenceSession | null = null;
interface SourceShopSession { readonly sequence: SourceSequenceSession; readonly stock: readonly SourceShopItem[]; notice: string | null }
let sourceShop: SourceShopSession | null = null;
let pendingSourceMapEntryAutorun: number | null = null;
let sourceTransitionInProgress = false;
type AvatarId = DemoAvatarId;

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

async function refreshSourceParallelPresentation(assets: ImportedMapAssets): Promise<void> {
  const parallels = findActiveSourceParallelEvents(sourceMapEvents(), assets.map.id, sourceEventState);
  sourceParallelAuditNotice = null;
  for (const parallel of parallels) {
    const flow = resolveEventFlow(parallel.page, [], sourceEventState, assets.map.id, parallel.event.id,
      { playerDirection: sourceDirectionNumber(importedAvatar.direction) });
    if (!flow.complete) {
      sourceParallelAuditNotice = `EV${parallel.event.id} bloqué : ${flow.blockedReason ?? "séquence incomplète"}`;
      console.warn(`[source-parallel] ${sourceParallelAuditNotice}`);
      continue;
    }
    const plan = compileSourceScene(flow.page, sourceMapEvents(), new Set(assets.characterImages.keys()));
    sourceParallelAuditNotice = `EV${parallel.event.id} · ${formatSourceSceneAudit(plan.audit)}`;
    if (!plan.audit.complete) {
      console.warn(`[source-parallel] ${sourceParallelAuditNotice}`, plan.audit);
      continue;
    }
    if (!isSourceParallelInitialization(flow.page)) {
      sourceParallelAuditNotice = `EV${parallel.event.id} ignoré : boucle parallèle non prise en charge`;
      console.warn(`[source-parallel] ${sourceParallelAuditNotice}`);
      continue;
    }
    for (const step of plan.steps) {
      if (importedAssets !== assets) return;
      await sourcePresentation.execute(step.command, async (milliseconds) =>
        new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds)));
    }
  }
  if (importedAssets === assets) renderImportedView();
}

function beginSourceSequence(active: ActiveSourceAutorun, label: string): boolean {
  if (importedAssets === null || !sourceScenes.allows("start-sequence", sourceSceneActivity())) return false;
  const flow = resolveEventFlow(active.page, [], sourceEventState, importedAssets.map.id, active.event.id,
    { playerDirection: sourceDirectionNumber(importedAvatar.direction) });
  if (!flow.complete && flow.pendingChoice === null) {
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
    translations: importedAssets.mapTranslations, sourcePage: active.page, selections: [], pendingChoice: flow.pendingChoice,
    cursor: 0, advancing: false, runner: new SourceSequenceRunner() };
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

function beginSourceSequenceChoice(sequence: SourceSequenceSession, choice: PendingEventChoice): void {
  const commands: ImportedEventPage["commands"] = [
    { kind: "show-choices", text: null, indent: 0,
      data: { choices: choice.choices, cancelType: choice.cancelType } },
    ...choice.choices.flatMap((label, index) => [
      { kind: "choice-branch", text: label, indent: 0, data: { choiceIndex: index, text: label } },
      { kind: "end", text: null, indent: 1, data: {} },
    ]),
    { kind: "choice-end", text: null, indent: 0, data: {} },
  ];
  sourceSequenceChoicePrompt = sequence;
  beginSourceEvent({ ...sequence.plan.page, commands }, sequence.mapId, sequence.eventId,
    sequence.label, sequence.translations);
  renderImportedView();
}

function continueSourceSequenceChoice(sequence: SourceSequenceSession, selected: number): boolean {
  if (sequence.sourcePage === undefined) return false;
  const selections = [...sequence.selections, selected];
  const flow = resolveEventFlow(sequence.sourcePage, selections, sourceEventState, sequence.mapId, sequence.eventId,
    { playerDirection: sourceDirectionNumber(importedAvatar.direction) });
  if (!flow.complete && flow.pendingChoice === null) {
    importedNotice = `Séquence interrompue : ${flow.blockedReason ?? "branche incomplète"}.`;
    sourceSequence = null;
    return false;
  }
  const nextPlan = compileAndReportSourceScene(flow.page, sequence.label);
  if (!nextPlan.audit.complete || nextPlan.steps.length < sequence.cursor) {
    importedNotice = "Séquence interrompue : branche de choix incohérente.";
    sourceSequence = null;
    return false;
  }
  sequence.selections = selections;
  sequence.pendingChoice = flow.pendingChoice;
  sequence.plan = nextPlan;
  return true;
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
        const previousInventory = sourceEventState.inventory;
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
        const itemGains = importedAssets === null ? []
          : sourceItemGains(previousInventory, result.state.inventory, importedAssets.itemNames);
        if (itemGains.length > 0) {
          beginSequenceItemPresentation(sequence, itemGains);
          return;
        }
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
          baseMoney: trainerType.baseMoney,
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
      if (command.kind === "open-shop") {
        const stockIds = command.data.stock;
        if (importedAssets === null || !Array.isArray(stockIds) || !stockIds.every((id) => typeof id === "string")) {
          throw new Error("stock de boutique invalide");
        }
        const stock = stockIds.map((id) => importedAssets?.items.get(id)).filter((item): item is SourceShopItem => item !== undefined);
        if (stock.length === 0) throw new Error("aucun objet du stock n'est disponible");
        sourceShop = { sequence, stock, notice: null };
        renderImportedView();
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
            direction: sourceDirection(transfer.direction, importedAvatar.direction) };
          importedPlayerMotion = null;
          heldMovementKeys.clear();
          sourcePresentation.resetMapPresentation();
          sourceNpcMotions.reset(importedAssets.map.id, importedAssets.events, performance.now());
          void refreshSourceParallelPresentation(importedAssets);
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
    if (sourceSequence === sequence && sequence.pendingChoice !== null) {
      const choice = sequence.pendingChoice;
      sequence.pendingChoice = null;
      beginSourceSequenceChoice(sequence, choice);
      return;
    }
    if (sourceSequence === sequence) {
      await sequence.runner.waitForMovement();
      const autorunBaseline = sequence.autorunBaseline;
      sourceSequence = null;
      if (sourceSequenceChoicePrompt === sequence) sourceSequenceChoicePrompt = null;
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
      if (sourceSequenceChoicePrompt === sequence) sourceSequenceChoicePrompt = null;
      if (sourcePickupDialogueSequence === sequence) sourcePickupDialogueSequence = null;
      sourcePickupPose = false;
      sourcePickupStartedAt = null;
      importedNotice = `Séquence interrompue sur ${currentCommand} : ${error instanceof Error ? error.message : "erreur inattendue"}.`;
      renderImportedView();
    }
  } finally {
    sequence.advancing = false;
  }
}

const canvasElement = mountOverworldApp();
const drawingContext = canvasElement.getContext("2d");
if (drawingContext === null) throw new Error("Canvas 2D is unavailable.");
const canvas: HTMLCanvasElement = canvasElement;
const context: CanvasRenderingContext2D = drawingContext;
const demoOverworldView = new DemoOverworldView(canvas, context, catalog, TILE_SIZE);
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
  panorama: requiredAppElement("source-panorama-layer"), fog: requiredAppElement("source-fog-layer"),
  weather: requiredAppElement("source-weather-layer"),
  pictures: requiredAppElement("source-picture-layer"), tone: requiredAppElement("source-tone-layer"),
  flash: requiredAppElement("source-flash-layer"), animations: requiredAppElement("source-map-animation-layer"),
  dialogue: requiredAppElement("source-dialogue"),
}, sourceMenuVolume(localStorage) / 100, { resolveAnimationTarget: resolveSourceAnimationTarget });
const sourceMenuView = new SourceMenuView(localStorage, {
  onSave: saveCurrentSourceWorld,
  onDeleteSave: deleteSourceWorldSave,
  onVolumeChange: (volume) => { sourcePresentation.setMasterVolume(volume / 100); },
});
const sourceShopView = new SourceShopView({ onBuy: buySourceShopItem, onClose: closeSourceShop });
const sourceOverworldHud = new SourceOverworldHud(startPendingSourceEncounter);
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
const sourceDialogueView = new SourceDialogueView(chooseSourceOption);
const sourceBattleOverlay = new SourceBattleOverlay({
  onRenderLocalVisuals: () => { sourceBattles.renderVisuals(); },
  onMove: (moveIndex, local) => {
    if (local) void sourceBattles.submitAction(moveIndex);
    else submitEncounterAction(moveIndex);
  },
  onEscape: () => { void sourceBattles.escape(); },
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
    sourcePresentation.currentCameraOffset(), sourcePickupPose ? importedAssets.playerPickupImage : importedAssets.playerImage,
    sourcePickupStartedAt === null ? 0 : sourceItemPickupOffset(now - sourcePickupStartedAt));
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
  if (importedAssets === null) return;
  sourceMenuView.render({ open: sourceScenes.menuOpen, tab: sourceScenes.menuTab, assets: importedAssets,
    eventState: sourceEventState, avatar: importedAvatar, worldSave: sourceWorldSave });
}

function closeSourceShop(): void {
  const shop = sourceShop;
  if (shop === null) return;
  sourceShop = null;
  importedNotice = "Boutique fermée.";
  renderImportedView();
  if (sourceSequence === shop.sequence) void advanceSourceSequence();
}

function buySourceShopItem(itemId: string): void {
  const shop = sourceShop;
  const item = shop?.stock.find((candidate) => candidate.internalName === itemId);
  if (shop === null || item === undefined) return;
  const result = purchaseSourceItem(sourceEventState, item, 1);
  if (!result.ok) {
    shop.notice = result.reason === "insufficient-funds" ? "Vous n'avez pas assez d'argent."
      : result.reason === "bag-full" ? "Le sac ne peut pas contenir davantage de cet objet." : "Achat impossible.";
  } else {
    sourceEventState = result.state;
    persistSourceEventState();
    shop.notice = `${item.name} acheté pour ${result.cost.toLocaleString("fr-FR")} ₽.`;
    importedNotice = shop.notice;
  }
  renderSourceShop();
}

function renderSourceShop(): void {
  sourceShopView.render(sourceShop, sourceEventState);
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
  if (importedAnimationFrame === null) importedAnimationFrame = requestAnimationFrame(animateImportedMap);
  const sequenceStatus = sourceSequence === null ? "aucune"
    : `${sourceSequence.label} · étape ${sourceSequence.cursor}/${sourceSequence.plan.steps.length}`
      + ` · ${sourceSequence.plan.steps[sourceSequence.cursor]?.command.kind ?? "finalisation"}`
      + ` · ${sourceSequence.runner.pendingRoutes} route(s)`;
  sourceOverworldHud.render({ assets: importedAssets, avatar: importedAvatar, eventState: sourceEventState,
    battleActive: sourceBattle !== null, sequenceStatus, notice: importedNotice,
    parallelAuditNotice: sourceParallelAuditNotice, sceneAuditNotice: sourceSceneAuditNotice,
    canChangeScene: sourceScenes.allows("scene-change", sourceSceneActivity()) });
  renderSourceDialogue();
  renderEncounter();
  renderSourceMenu();
  renderSourceShop();
}

function renderSourceDialogue(): void {
  sourceDialogueView.render(sourceDialogues.current, viewedMapId === SOURCE_MAP_ID);
}

function finishAppliedSourceEvent(completed: SourceDialogueSession, encounterQueued: boolean): void {
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

function beginSourceItemPresentation(completed: SourceDialogueSession, gains: readonly SourceItemGain[],
  onComplete: () => void): void {
  const commands: ImportedEventPage["commands"] = [
    { kind: "play-sound", text: null, indent: 0,
      data: { audio: { name: "ItemGet", volume: 100, pitch: 100 } } },
    ...gains.map((gain) => ({ kind: "show-text", text: sourceItemGainMessage(gain), indent: 0,
      data: { text: sourceItemGainMessage(gain) } })),
    { kind: "end", text: null, indent: 0, data: {} },
  ];
  const page = { ...completed.flow.page, commands };
  sourcePickupPose = true;
  sourcePickupStartedAt = performance.now();
  sourceSequence = { label: "Objet obtenu", mapId: completed.mapId, eventId: completed.eventId,
    plan: compileAndReportSourceScene(page, "Obtention d'objet"), translations: new Map(), cursor: 0,
    selections: [], pendingChoice: null,
    advancing: false, runner: new SourceSequenceRunner(), onComplete: () => {
      sourcePickupPose = false;
      sourcePickupStartedAt = null;
      onComplete();
      renderImportedView();
    } };
  importedNotice = gains.map(sourceItemGainMessage).join(" ");
  void advanceSourceSequence();
}

function beginSequenceItemPresentation(sequence: SourceSequenceSession, gains: readonly SourceItemGain[]): void {
  const commands: ImportedEventPage["commands"] = gains.map((gain) => ({
    kind: "show-text", text: sourceItemGainMessage(gain), indent: 0,
    data: { text: sourceItemGainMessage(gain) },
  }));
  sourcePickupPose = true;
  sourcePickupStartedAt = performance.now();
  sourcePickupDialogueSequence = sequence;
  importedNotice = gains.map(sourceItemGainMessage).join(" ");
  void sourcePresentation.execute({ kind: "play-sound",
    data: { audio: { name: "ItemGet", volume: 100, pitch: 100 } } }, async () => undefined);
  beginSourceEvent({ ...sequence.plan.page, commands }, sequence.mapId, sequence.eventId,
    "Objet obtenu", sequence.translations);
  renderImportedView();
}

function applyCompletedSourceEvent(completed: SourceDialogueSession): void {
  const previousInventory = sourceEventState.inventory;
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
  const itemGains = importedAssets === null ? []
    : sourceItemGains(previousInventory, result.state.inventory, importedAssets.itemNames);
  if (itemGains.length > 0) {
    beginSourceItemPresentation(completed, itemGains, () => finishAppliedSourceEvent(completed, encounterQueued));
    return;
  }
  finishAppliedSourceEvent(completed, encounterQueued);
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
    translations: completed.translations, selections: [], pendingChoice: null, cursor: 0, advancing: false, runner: new SourceSequenceRunner(),
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
      sourceSequenceChoicePrompt = null;
      return;
    }
    if (sourceSequenceChoicePrompt === sourceSequence) {
      sourceSequenceChoicePrompt = null;
      const selected = completed.selections[0];
      if (selected === undefined || !continueSourceSequenceChoice(sourceSequence, selected)) {
        renderImportedView();
        return;
      }
    }
    if (sourcePickupDialogueSequence === sourceSequence) {
      sourcePickupDialogueSequence = null;
      sourcePickupPose = false;
      sourcePickupStartedAt = null;
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

function sourceDirectionNumber(direction: Direction): number {
  switch (direction) {
    case "down": return 2;
    case "left": return 4;
    case "right": return 6;
    case "up": return 8;
  }
}

function activateSourceWorld(world: LoadedSourceWorld): void {
  importedAssets = world.assets;
  importedAvatar = world.avatar;
  importedPlayerMotion = null;
  heldMovementKeys.clear();
  sourcePresentation.resetMapPresentation();
  sourceNpcMotions.reset(world.assets.map.id, world.assets.events, performance.now());
  void refreshSourceParallelPresentation(world.assets);
}

async function followSourceTransfer(transfer: ImportedTransfer): Promise<void> {
  if (!sourceScenes.allows("source-transfer", sourceSceneActivity())) return;
  sourceTransitionInProgress = true;
  sourceDialogues.cancel();
  importedNotice = `Chargement de Map${String(transfer.targetMapId).padStart(3, "0")}…`;
  renderImportedView();
  try {
    const next = await loadSourceTransfer(importedAssets, importedAvatar, transfer);
    activateSourceWorld(next);
    if (next.changedMap) pendingSourceMapEntryAutorun = next.assets.map.id;
    importedNotice = `Arrivée dans ${next.assets.map.name}, en ${transfer.targetX},${transfer.targetY}. Graphismes, événements et français chargés à la demande.`;
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
    const world = await loadSourceCheckpoint(checkpoint);
    activateSourceWorld(world);
    importedNotice = checkpoint === null ? "Position de test restaurée en 28,15, face à un événement dialogué."
      : `Point de reprise restauré dans ${world.assets.map.name}, en ${world.avatar.x},${world.avatar.y}.`;
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
    const world = await loadSourceWorldAt(2, { x: 52, y: 22, direction: "up" });
    activateSourceWorld(world);
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
  demoOverworldView.render({ mapId: viewedMapId, state, positions: renderPositions, events,
    networkSide: network?.ticket.side ?? null });
  renderSourceDialogue();
  renderEncounter();
}

function renderEncounter(): void {
  const network = multiplayer.current;
  const sourceBattle = sourceBattles.current;
  const networkBattle = network?.snapshot?.battle ?? null;
  const battleState = viewedMapId === SOURCE_MAP_ID && sourceBattle !== null ? sourceBattle : networkBattle?.state ?? null;
  const localSourceBattle = battleState !== null && battleState === sourceBattle;
  sourceBattleOverlay.render({ state: battleState, local: localSourceBattle, animating: sourceBattles.animating,
    networkSide: network?.ticket.side ?? null, networkSubmittedTurn: network?.submittedTurn ?? null,
    escapable: localSourceBattle && sourceEventState.pendingEncounter?.escapable === true });
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
    const target = eventInInteractionRange(sourceMapEvents(), importedAvatar, importedAssets.map,
      importedAssets.tileset, importedAssets.map.id, sourceEventState);
    const targetTransfer = target === null ? null : transferForEvent(importedAssets.map, target);
    if (target !== null && targetTransfer !== null && target.page.settings.trigger === 1) {
      void followSourceTransfer(targetTransfer);
      return;
    }
    if (target !== null && target.page.settings.trigger === 0) {
      const label = `Événement ${target.event.id} · ${target.event.name}`;
      beginSourceSequence(target, label);
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
    if (sourceShop !== null) { event.preventDefault(); closeSourceShop(); return; }
    if (sourceScenes.menuOpen) { event.preventDefault(); toggleSourceMenu(); return; }
    if (sourceSequence !== null && sourceDialogues.current !== null) { event.preventDefault(); return; }
    if (sourceDialogues.cancel()) { event.preventDefault(); renderImportedView(); return; }
    if (viewedMapId === SOURCE_MAP_ID) { event.preventDefault(); toggleSourceMenu(); return; }
  }
  if (event.code === "KeyM" && viewedMapId === SOURCE_MAP_ID) { event.preventDefault(); toggleSourceMenu(); return; }
  if (sourceScenes.menuOpen || sourceShop !== null) { event.preventDefault(); return; }
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
    const world = await loadInitialSourceWorld(requestedSave);
    if (world.saveStatus === "discarded") {
      clearSourceWorldSave(localStorage);
      sourceWorldSave = null;
      importedNotice = "Sauvegarde de position ignorée car elle était inaccessible ; retour à Bourg Canvas.";
    }
    activateSourceWorld(world);
    if (world.saveStatus === "restored") {
      importedNotice = `Partie reprise dans ${world.assets.map.name}, en ${world.avatar.x},${world.avatar.y}.`;
    } else if (world.saveStatus === "default") {
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
