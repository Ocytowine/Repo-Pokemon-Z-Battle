import { DEMO_WORLD_CATALOG, createDemoWorldState, resolveInteraction, resolveMovement, type Direction, type OverworldEvent, type OverworldState } from "@pokemon-z-battle/overworld-engine";
import { SOURCE_MAP_ID, activeEventAt, blockingDefaultEventPoints, drawImportedMap, eventInInteractionRange, importedCameraPosition, loadSourceAssetImage, localizedDialogueText, playerTouchEventInDirection, selectEventPage, transferForEvent, type ImportedAvatar, type ImportedEventPage, type ImportedMapAssets, type ImportedTransfer } from "./imported-map.js";
import { OverworldNetworkSession } from "./network-session.js";
import { SourceDialogueController, type SourceDialogueSession, type SourceDialogueUpdate } from "./source-dialogue-controller.js";
import { applySafeStateCommands, createSourceEventState, parseSourceEventState, type SourceEventState } from "./source-event-state.js";
import { createPersistentPokemon, loadSessionPlayerAvatarSelection, persistSessionPlayerAvatarSelection,
  playerPartyToBattleTeam, storeBattleTeam, type PlayerAvatarSelection } from "@pokemon-z-battle/player-state";
import { createNetworkPlayerProfile, resolveSourceMovement, type NetworkPlayerProfile, type RoomPlayerSnapshot }
  from "@pokemon-z-battle/multiplayer-protocol";
import type { SourceMovementAction, SourceMovementMode, SourceWorldHostState, SourceWorldSnapshot }
  from "@pokemon-z-battle/multiplayer-protocol";
import type { SourceSceneActorSnapshot, SourceScenePresentationCue, SourceSceneSnapshot }
  from "@pokemon-z-battle/multiplayer-protocol";
import { SeededRandom, type BattleTeam, type TeamBattleEvent, type TeamBattleState } from "@pokemon-z-battle/battle-engine";
import { SourceBattleController } from "./source-battle-controller.js";
import { SourceBattleVisuals } from "./source-battle-visuals.js";
import { rollLandEncounter, terrainTagAt } from "./source-wild-encounter.js";
import { createSourceGridMotion, sampleSourceGridMotion, type SourceGridMotion } from "./source-grid-motion.js";
import { SourceNpcMotionController, sourceNpcStepDuration } from "./source-npc-motion.js";
import { finalDirectSourceTransfer, findActiveSourceParallelEvents, findNewlyActivatedSourceAutorun,
  findSourceMapEntryAutorun, type ActiveSourceAutorun } from "./source-autorun.js";
import { resolveEventFlow, type PendingEventChoice } from "./source-event-flow.js";
import { executeSourceMoveRouteStep, parseSourceMoveRoute, type SourceRouteActor } from "./source-move-route.js";
import { compileSourceScene, formatSourceSceneAudit, type SourceScenePlan } from "./source-scene-plan.js";
import { SourceSequenceController, type SourceSequenceCommandResult, type SourceSequenceSession }
  from "./source-sequence-controller.js";
import { SourceSequenceEffects } from "./source-sequence-effects.js";
import { SourceSequenceRunner } from "./source-sequence-runner.js";
import { SourceParallelController, type SourceParallelTask } from "./source-parallel-controller.js";
import { SourceFollowerMotionController } from "./source-follower-motion.js";
import { AVATAR_LAB_MAP_ID, AvatarLabView } from "./avatar-lab-view.js";
import { isSourceStateCommand, sourceCommandCapability } from "./source-command-registry.js";
import { SourceSceneCoordinator, type SourceMenuTab, type SourceSceneActivity } from "./source-scene-coordinator.js";
import { SourceScenePresentation, type SourcePresentationCommand } from "./source-scene-presentation.js";
import { SourceMenuView, SourceShopView, sourceMenuVolume } from "./source-menu-view.js";
import { DemoOverworldView, type DemoAvatarId } from "./demo-overworld-view.js";
import { mountOverworldApp, requiredAppElement } from "./overworld-app-shell.js";
import { SourceOverworldHud } from "./source-overworld-hud.js";
import { SourceDialogueView } from "./source-dialogue-view.js";
import { SourceBattleOverlay } from "./source-battle-overlay.js";
import { SourcePlayerDuelView } from "./source-player-duel-view.js";
import { networkBattleEventsForViewer, networkBattleForViewer, oppositeBattleSide }
  from "./network-battle-presentation.js";
import { loadInitialSourceWorld, loadSourceCheckpoint, loadSourceTransfer, loadSourceWorldAt,
  sourceDirection, type LoadedSourceWorld } from "./source-world-navigation.js";
import { sourceItemGainMessage, sourceItemGains, sourceItemPickupOffset,
  type SourceItemGain } from "./source-item-presentation.js";
import { clearSourceWorldSave, createSourceWorldSave, loadSourceWorldSave, persistSourceWorldSave,
  type SourceWorldSave } from "./source-world-save.js";
import { loadSourcePlayerVisuals, sourcePlayerImageFor, sourcePlayerImageForMovement,
  type SourcePlayerVisuals } from "./source-player-profile.js";
import { purchaseSourceItem, type SourceShopItem } from "./source-economy.js";
import { guestSourceEventAccess, shouldRejoinSharedSourceMap, sourceInteractionTarget, sourceStateWithHostStory }
  from "./source-coop-policy.js";
import { isSourceSurfableTerrain, loadSourceMovementTestOverride, persistSourceMovementTestOverride,
  sourceFacingPoint, sourceModeForInput, sourceMovementDuration, sourceMovementModeAllowed,
  sourceMovementUnlocks, sourceTerrainAt, SOURCE_TERRAIN } from "./source-player-movement.js";
import "./style.css";

const TILE_SIZE = 48;
const STORED_SESSION_KEY = "pokemon-z-battle.overworld-session.v8";
const SOURCE_EVENT_STATE_KEY = "pokemon-z-battle.source-event-state.v1";

const catalog = DEMO_WORLD_CATALOG;

let state: OverworldState = initialState();
let viewedMapId = "meadow";
let avatarLabReturnMapId = viewedMapId;
let events: OverworldEvent[] = [];
let importedAssets: ImportedMapAssets | null = null;
let importedAvatar: ImportedAvatar = { x: 28, y: 15, direction: "up" };
let sourceMovementMode: SourceMovementMode = "walk";
let sourceMovementAction: SourceMovementAction = "idle";
let sourceMovementTestOverride = loadSourceMovementTestOverride(localStorage);
let pendingTransferMovementMode: SourceMovementMode | null = null;
let importedPlayerMotion: SourceGridMotion | null = null;
let importedWalkingPattern: 1 | 3 = 1;
const heldMovementKeys = new Set<string>();
let sourceSprintHeld = false;
let importedNotice = "Chargement automatique de Bourg Canvas…";
let sourceSceneAuditNotice: string | null = null;
let sourceParallelAuditNotice: string | null = null;
let importedAnimationFrame: number | null = null;
let sourceEventState = loadSourceEventState();
let storedPlayerDuelBattleId: string | null = null;
let sourceWorldSave: SourceWorldSave | null = loadSourceWorldSave(localStorage);
const sourceDialogues = new SourceDialogueController();
const sourceNpcMotions = new SourceNpcMotionController();
const sourceFollowerMotion = new SourceFollowerMotionController();
const sourceScenes = new SourceSceneCoordinator();
const sourceParallelEvents = new SourceParallelController(runSourceParallelCycle, (program, error) => {
  sourceParallelAuditNotice = `EV${program.eventId} interrompu : ${error instanceof Error ? error.message : "erreur inattendue"}`;
  console.warn(`[source-parallel] ${sourceParallelAuditNotice}`, error);
});
const sourceSequences = new SourceSequenceController({
  dialogueActive: () => sourceDialogues.current !== null,
  onText: showSourceSequenceText,
  onChoice: beginSourceSequenceChoice,
  executeCommand: executeSourceSequenceCommand,
  onComplete: completeSourceSequence,
  onError: failSourceSequence,
});
let sourceSequenceEffects: SourceSequenceEffects;
let sourcePickupPose = false;
let sourcePickupStartedAt: number | null = null;
let sourcePickupDialogueSequence: SourceSequenceSession | null = null;
let sourceSequenceChoicePrompt: SourceSequenceSession | null = null;
interface SourceShopSession { readonly sequence: SourceSequenceSession; readonly stock: readonly SourceShopItem[]; notice: string | null }
let sourceShop: SourceShopSession | null = null;
let pendingSourceMapEntryAutorun: number | null = null;
let sourceTransitionInProgress = false;
let sourceFollowerImage: HTMLImageElement | null = null;
let sourceFollowerAssetPath: string | null = null;
let activePlayerSelection = loadSessionPlayerAvatarSelection(sessionStorage, localStorage);
let sourcePlayerVisuals: SourcePlayerVisuals | null = null;
let sourcePlayerCharacterName = "player";
let playerProfileApplication = 0;
let networkPlayerProfiles: Partial<Record<DemoAvatarId, NetworkPlayerProfile>> = {};
let networkAvatarImages: Partial<Record<DemoAvatarId, HTMLImageElement>> = {};
let networkPlayerVisuals: Partial<Record<DemoAvatarId, SourcePlayerVisuals>> = {};
let networkProfileSignatures: Partial<Record<DemoAvatarId, string>> = {};
let networkProfileApplications: Partial<Record<DemoAvatarId, number>> = {};
let networkStateText = "Local";
let networkNotice = "Lancez le serveur multijoueur, puis créez ou rejoignez une partie.";
let networkServerUrl = "http://127.0.0.1:8787";
let networkRoomCode = "";
let networkPresentedBattle: { readonly id: string; readonly state: TeamBattleState } | null = null;
let networkBattleAnimating = false;
let networkBattlePresentation = Promise.resolve();
let networkSourceWorld: SourceWorldSnapshot | null = null;
let guestSourceExcursion = false;
let networkRemoteSourceMotion: SourceGridMotion | null = null;
let networkRemoteWalkingPattern: 1 | 3 = 1;
let networkRemoteFollowerMotion: SourceGridMotion | null = null;
let networkRemoteFollowerWalkingPattern: 1 | 3 = 1;
let networkRemoteFollowerImage: HTMLImageElement | null = null;
let networkRemoteFollowerAssetPath: string | null = null;
let networkSourceWorldApplication = 0;
let sourcePresentationCue: SourceScenePresentationCue | null = null;
let sourcePresentationCueId = 0;
let lastPublishedSourceScene = "";
type AvatarId = DemoAvatarId;

function activeNetworkPlayerProfile(): NetworkPlayerProfile {
  return createNetworkPlayerProfile(activePlayerSelection.avatarId, activePlayerSelection.profile);
}

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
  const assets = importedAssets;
  if (assets !== null) queueMicrotask(() => { if (importedAssets === assets) refreshSourceParallelPresentation(assets); });
  queueMicrotask(publishCurrentSourceWorld);
  queueMicrotask(() => multiplayer.publishSourceFollower(activeSourceFollowerSpecies()));
}

function activeSourceFollowerSpecies(): string | null {
  const activeIndex = sourceEventState.party.activeIndex;
  const member = activeIndex === null ? null : sourceEventState.party.members[activeIndex] ?? null;
  return sourceEventState.followerEnabled ? member?.species ?? null : null;
}

function sourceWorldHostState(): SourceWorldHostState | null {
  if (importedAssets === null) return null;
  const map = importedAssets.map;
  const activeIndex = sourceEventState.party.activeIndex;
  const member = activeIndex === null ? null : sourceEventState.party.members[activeIndex] ?? null;
  const followerPosition = sourceFollowerMotion.positionSnapshot();
  return { mapId: map.id, width: map.width, height: map.height,
    passages: map.collision.masks.map((mask) => Math.max(0, Math.min(15, mask)).toString(16)).join(""),
    terrain: Array.from({ length: map.width * map.height }, (_, index) => sourceTerrainAt(map,
      importedAssets!.tileset, index % map.width, Math.floor(index / map.width)).toString(36)).join(""),
    blockedPoints: blockingDefaultEventPoints(sourceMapEvents(), map.id, sourceEventState),
    host: { ...importedAvatar, mode: sourceMovementMode, action: sourceMovementAction },
    follower: !sourceEventState.followerEnabled || member === null || followerPosition === null ? null
      : { ...followerPosition, species: member.species },
    story: { switches: sourceEventState.switches, variables: sourceEventState.variables,
      selfSwitches: sourceEventState.selfSwitches } };
}

function publishCurrentSourceWorld(): void {
  const world = sourceWorldHostState();
  if (world !== null) multiplayer.publishSourceWorld(world);
}

function sourceActorDirection(direction: number): Direction {
  if (direction === 4) return "left";
  if (direction === 6) return "right";
  if (direction === 8) return "up";
  return "down";
}

function currentSourceScene(): SourceSceneSnapshot | null {
  if (importedAssets === null) return null;
  const dialogue = sourceDialogues.current;
  const pendingChoice = dialogue?.choosing ? dialogue.flow.pendingChoice : null;
  const poses = sourceNpcMotions.poses(performance.now());
  const actors: SourceSceneActorSnapshot[] = sourceMapEvents().flatMap((event) => {
    const pose = poses.get(event.id);
    if (pose === undefined) return [];
    return [{ eventId: event.id, x: event.x, y: event.y, direction: sourceActorDirection(pose.direction),
      ...(pose.pattern === undefined ? {} : { pattern: pose.pattern }),
      ...(pose.characterName === undefined ? {} : { characterName: pose.characterName }),
      ...(pose.opacity === undefined ? {} : { opacity: pose.opacity }) }];
  });
  return { mapId: importedAssets.map.id, sequenceActive: sourceSequences.current !== null,
    dialogue: dialogue === null ? null : { label: dialogue.label,
      text: dialogue.choosing ? null : dialogue.lines[dialogue.index] ?? "",
      choices: pendingChoice === null ? [] : pendingChoice.choices.map((choice) =>
        localizedDialogueText(choice, dialogue.translations, dialogue.variables)) },
    actors, presentation: sourcePresentationCue };
}

function publishCurrentSourceScene(): void {
  if (multiplayer.current?.ticket.side !== "player") return;
  const scene = currentSourceScene();
  if (scene === null) return;
  const signature = JSON.stringify(scene);
  if (signature === lastPublishedSourceScene) return;
  lastPublishedSourceScene = signature;
  multiplayer.publishSourceScene(scene);
}

function renderedSourceEventState(): SourceEventState {
  return sourceStateWithHostStory(sourceEventState, networkSourceWorld?.story ?? null,
    multiplayer.current?.ticket.side === "opponent");
}

function isNetworkGuest(): boolean {
  return multiplayer.current?.ticket.side === "opponent";
}

function guestUsesSharedSourceWorld(): boolean {
  return multiplayer.current?.ticket.side === "opponent" && !guestSourceExcursion
    && networkSourceWorld?.presence.opponent !== "away";
}

function sourceInteractionState(): SourceEventState {
  return isNetworkGuest() ? renderedSourceEventState() : sourceEventState;
}

function guestCanRunSourceEvent(active: ActiveSourceAutorun): boolean {
  return !isNetworkGuest() || guestSourceEventAccess(active.page) !== "blocked";
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
  const sharedGuest = guestUsesSharedSourceWorld();
  if (isNetworkGuest()) {
    const sharedEvent = activeEventAt(sourceMapEvents(), importedAvatar.x, importedAvatar.y,
      importedAssets.map.id, sourceInteractionState());
    if (sharedEvent !== null && (sharedEvent.page.settings.trigger === 1 || sharedEvent.page.settings.trigger === 2)
      && guestCanRunSourceEvent(sharedEvent)) {
      beginSourceSequence(sharedEvent, `Événement personnel ${sharedEvent.event.id} · ${sharedEvent.event.name}`);
      return;
    }
    importedNotice = `DÃ©placement vers ${importedAvatar.x},${importedAvatar.y}.`;
    if (!sharedGuest && checkSourceWildEncounter()) return;
    renderImportedView();
    continueSourceMovement();
    return;
  }
  const entered = activeEventAt(sourceMapEvents(), importedAvatar.x, importedAvatar.y, importedAssets.map.id, sourceEventState);
  if (entered !== null && (entered.page.settings.trigger === 1 || entered.page.settings.trigger === 2)) {
    beginSourceSequence(entered, `Événement de contact ${entered.event.id} · ${entered.event.name}`);
    return;
  }
  if (checkSourceWildEncounter()) return;
  importedNotice = `Déplacement vers ${importedAvatar.x},${importedAvatar.y}.`;
  renderImportedView();
  continueSourceMovement();
}

function continueSourceMovement(): void {
  if (sourceMovementAction === "ice-slide" || sourceMovementAction === "waterfall") {
    move("player", importedAvatar.direction);
    return;
  }
  sourceMovementAction = "idle";
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

function refreshSourceParallelPresentation(assets: ImportedMapAssets): void {
  if (importedAssets !== assets) return;
  if (isNetworkGuest()) {
    sourceParallelEvents.synchronize([]);
    sourceParallelAuditNotice = null;
    return;
  }
  const parallels = findActiveSourceParallelEvents(sourceMapEvents(), assets.map.id, sourceEventState);
  sourceParallelEvents.synchronize(parallels.map(({ event, pageIndex }) => ({ mapId: assets.map.id,
    eventId: event.id, pageIndex })));
  sourceParallelAuditNotice = parallels.length === 0 ? null : `${parallels.length} boucle(s) parallèle(s) active(s)`;
}

async function runSourceParallelCycle(task: SourceParallelTask): Promise<"repeat" | "stop"> {
  const assets = importedAssets;
  if (assets === null || assets.map.id !== task.mapId || !task.active() || isNetworkGuest()) return "stop";
  const active = findActiveSourceParallelEvents(sourceMapEvents(), task.mapId, sourceEventState)
    .find(({ event, pageIndex }) => event.id === task.eventId && pageIndex === task.pageIndex);
  if (active === undefined) return "stop";
  const flow = resolveEventFlow(active.page, [], sourceEventState, task.mapId, task.eventId,
    { playerDirection: sourceDirectionNumber(importedAvatar.direction), movementTestUnlocks: sourceMovementTestOverride });
  if (!flow.complete && flow.pendingChoice === null) {
    sourceParallelAuditNotice = `EV${task.eventId} bloqué : ${flow.blockedReason ?? "choix interactif en parallèle"}`;
    return "stop";
  }
  const plan = compileSourceScene(flow.page, sourceMapEvents(), new Set(assets.characterImages.keys()));
  sourceParallelAuditNotice = `EV${task.eventId} · ${formatSourceSceneAudit(plan.audit)}`;
  if (!plan.audit.complete) return "stop";
  const foreground = flow.pendingChoice !== null || plan.steps.some(({ command }) => ["show-text", "grant-item",
    "request-encounter", "request-trainer-battle", "open-shop", "transfer-player"].includes(command.kind));
  if (foreground) {
    if (!sourceScenes.allows("start-sequence", sourceSceneActivity())) return "repeat";
    beginSourceSequence(active, `Événement parallèle ${task.eventId} · ${active.event.name}`);
    return "stop";
  }
  const runner = new SourceSequenceRunner();
  const session: SourceSequenceSession = { label: `Parallèle EV${task.eventId}`, mapId: task.mapId,
    eventId: task.eventId, plan, translations: assets.mapTranslations, sourcePage: active.page,
    selections: [], pendingChoice: null, cursor: 0, advancing: true, runner };
  let routeError: unknown = null;
  for (const { command } of plan.steps) {
    if (!task.active() || importedAssets !== assets) return "stop";
    if (isSourceStateCommand(command.kind)) {
      const result = applySafeStateCommands(sourceEventState, { ...plan.page, commands: [command] }, task.mapId,
        task.eventId, { checkpoint: { mapId: task.mapId, x: importedAvatar.x, y: importedAvatar.y,
          direction: importedAvatar.direction }, createPokemon: (species, level) =>
          createPersistentPokemon(crypto.randomUUID(), species, level, assets.battleCatalog) });
      if (!result.safe) throw new Error(result.reason ?? `commande ${command.kind} invalide`);
      sourceEventState = result.state;
      persistSourceEventState();
      if (result.state.pendingEncounter !== null) { startPendingSourceEncounter(); return "stop"; }
      continue;
    }
    if (command.kind === "move-route" && typeof command.data.target === "number") {
      const target = command.data.target;
      runner.startRoute(target, () => runSourceMoveRoute(session, target, command.data.route, task.active),
        (error) => { routeError = error; });
      continue;
    }
    if (command.kind === "wait-for-movement") {
      await runner.waitForMovement();
      if (routeError !== null) throw routeError;
      continue;
    }
    if (command.kind === "set-movement-mode") {
      const mode = command.data.mode;
      if (mode !== "walk" && mode !== "mount") throw new Error("mode de déplacement invalide");
      applySourceSequenceMovementMode(mode);
      continue;
    }
    if (command.kind === "erase-event") return "stop";
    const presentationCommand = command.kind === "show-animation" && Array.isArray(command.data.parameters)
      && command.data.parameters[0] === 0
      ? { ...command, data: { ...command.data, parameters: [task.eventId, ...command.data.parameters.slice(1)] } }
      : command;
    if (await presentSourceCommand(presentationCommand, (milliseconds) => runner.delay(milliseconds))) continue;
    if (command.kind === "wait" && typeof command.data.frames === "number" && command.data.frames > 0) {
      await runner.delay(command.data.frames * 25);
      continue;
    }
    const capability = sourceCommandCapability(command.kind);
    if (capability === null || capability.support === "accepted") {
      throw new Error(`commande ${command.kind} non exécutable en parallèle`);
    }
  }
  await runner.waitForMovement();
  if (routeError !== null) throw routeError;
  if (importedAssets === assets) {
    refreshSourceParallelPresentation(assets);
  }
  return task.active() ? "repeat" : "stop";
}

function beginSourceSequence(active: ActiveSourceAutorun, label: string): boolean {
  if (importedAssets === null || !sourceScenes.allows("start-sequence", sourceSceneActivity())) return false;
  const flow = resolveEventFlow(active.page, [], sourceInteractionState(), importedAssets.map.id, active.event.id,
    { playerDirection: sourceDirectionNumber(importedAvatar.direction), movementTestUnlocks: sourceMovementTestOverride });
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
  importedNotice = `${label} démarré.`;
  sourceSequences.start({ label, mapId: importedAssets.map.id, eventId: active.event.id, plan,
    translations: importedAssets.mapTranslations, sourcePage: active.page, selections: [], pendingChoice: flow.pendingChoice,
  });
  return true;
}

function beginSourceAutorun(autorun: ActiveSourceAutorun): boolean {
  return beginSourceSequence(autorun, `Événement automatique ${autorun.event.id} · ${autorun.event.name}`);
}

function beginNewlyActivatedSourceAutorun(previousState: SourceEventState, nextState: SourceEventState): boolean {
  if (importedAssets === null || isNetworkGuest()) return false;
  const autorun = findNewlyActivatedSourceAutorun(
    sourceMapEvents(), importedAssets.map.id, previousState, nextState,
  );
  return autorun !== null && beginSourceAutorun(autorun);
}

function beginPendingSourceMapEntryAutorun(): boolean {
  if (importedAssets === null || pendingSourceMapEntryAutorun !== importedAssets.map.id
    || isNetworkGuest() || !sourceScenes.allows("start-sequence", sourceSceneActivity())) return false;
  pendingSourceMapEntryAutorun = null;
  const autorun = findSourceMapEntryAutorun(sourceMapEvents(), importedAssets.map.id, sourceEventState);
  return autorun !== null && beginSourceAutorun(autorun);
}

function sourcePlayerRouteActor(): SourceRouteActor {
  return { ...importedAvatar, moveSpeed: 4, moveFrequency: 3, walkAnimation: true, stepAnimation: false,
    directionFix: false, through: false, alwaysOnTop: false, opacity: 255,
    characterName: sourcePlayerCharacterName, characterHue: 0, pattern: 0 };
}

async function runSourceMoveRoute(sequence: SourceSequenceSession, target: number, rawRoute: unknown,
  isActive: () => boolean = () => sourceSequences.isActive(sequence)): Promise<void> {
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
    if (!isActive()) return;
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
      await presentSourceCommand({ kind: "play-sound", data: { audio: result.sound } }, async () => undefined);
    }
    let duration = result.waitMs;
    if (playerTarget) {
      sourcePlayerCharacterName = actor.characterName;
      const playerBefore = importedAvatar;
      importedAvatar = { x: actor.x, y: actor.y, direction: actor.direction };
      if (result.destination !== null) {
        duration = sourceNpcStepDuration(actor.moveSpeed);
        const startedAt = performance.now();
        importedPlayerMotion = createSourceGridMotion(result.actor, result.destination, actor.direction,
          startedAt, { duration, walkingPattern: importedWalkingPattern });
        sourceFollowerMotion.followPlayerStep(playerBefore, importedAvatar, startedAt, duration);
        importedWalkingPattern = importedWalkingPattern === 1 ? 3 : 1;
      }
    } else duration = Math.max(duration,
      sourceNpcMotions.applyScriptedActor(eventId, result.actor, result.destination, performance.now()));
    renderImportedView();
    if (playerTarget) publishCurrentSourceWorld();
    if (duration > 0) await sequence.runner.delay(duration);
    if (result.complete) return;
  }
}

function startSourceMoveRoute(sequence: SourceSequenceSession, target: number, rawRoute: unknown): void {
  sequence.runner.startRoute(target, () => runSourceMoveRoute(sequence, target, rawRoute), (error: unknown) => {
    if (!sourceSequences.isActive(sequence)) return;
    importedNotice = `Séquence interrompue : ${error instanceof Error ? error.message : "route de mouvement invalide"}.`;
    sourceSequences.clear(sequence);
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
  const flow = resolveEventFlow(sequence.sourcePage, selections, sourceInteractionState(), sequence.mapId, sequence.eventId,
    { playerDirection: sourceDirectionNumber(importedAvatar.direction), movementTestUnlocks: sourceMovementTestOverride });
  if (!flow.complete && flow.pendingChoice === null) {
    importedNotice = `Séquence interrompue : ${flow.blockedReason ?? "branche incomplète"}.`;
    sourceSequences.clear(sequence);
    return false;
  }
  const nextPlan = compileAndReportSourceScene(flow.page, sequence.label);
  if (!nextPlan.audit.complete || nextPlan.steps.length < sequence.cursor) {
    importedNotice = "Séquence interrompue : branche de choix incohérente.";
    sourceSequences.clear(sequence);
    return false;
  }
  sequence.selections = selections;
  sequence.pendingChoice = flow.pendingChoice;
  sequence.plan = nextPlan;
  return true;
}

function showSourceSequenceText(sequence: SourceSequenceSession, page: ImportedEventPage): void {
  beginSourceEvent(page, sequence.mapId, sequence.eventId, sequence.label, sequence.translations);
  renderImportedView();
}

async function executeSourceSequenceCommand(sequence: SourceSequenceSession,
  command: ImportedEventPage["commands"][number]): Promise<SourceSequenceCommandResult> {
  return sourceSequenceEffects.execute(sequence, command);
}

function completeSourceSequence(sequence: SourceSequenceSession): void {
      const autorunBaseline = sequence.autorunBaseline;
      if (sourceSequenceChoicePrompt === sequence) sourceSequenceChoicePrompt = null;
      importedNotice = "Séquence automatique terminée.";
      renderImportedView();
      sequence.onComplete?.();
      if (importedAssets?.map.id === sequence.mapId) refreshSourceParallelPresentation(importedAssets);
      const activated = !isNetworkGuest() && autorunBaseline !== undefined
        && importedAssets?.map.id === sequence.mapId
        && beginNewlyActivatedSourceAutorun(autorunBaseline, sourceEventState);
      if (!activated) queueMicrotask(beginPendingSourceMapEntryAutorun);
}

function failSourceSequence(sequence: SourceSequenceSession, currentCommand: string, error: unknown): void {
      if (sourceSequenceChoicePrompt === sequence) sourceSequenceChoicePrompt = null;
      if (sourcePickupDialogueSequence === sequence) sourcePickupDialogueSequence = null;
      sourcePickupPose = false;
      sourcePickupStartedAt = null;
      importedNotice = `Séquence interrompue sur ${currentCommand} : ${error instanceof Error ? error.message : "erreur inattendue"}.`;
      renderImportedView();
}

function advanceSourceSequence(): Promise<void> {
  return sourceSequences.advance();
}

const canvasElement = mountOverworldApp();
const avatarLabView = new AvatarLabView(requiredAppElement("embedded-avatar-lab"), applyActivePlayerProfile,
  closePlayerCustomization);
void avatarLabView.load().then(() => { if (viewedMapId === AVATAR_LAB_MAP_ID) render(); }).catch((error: unknown) => {
  console.warn(`[avatar-lab] ${error instanceof Error ? error.message : "catalogue indisponible"}`);
  if (viewedMapId === AVATAR_LAB_MAP_ID) render();
});
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
  if (target === -1) { const image = activeSourcePlayerImage(); return { x: playerPose.x * 32 + 16 - camera.x,
    bottom: playerPose.y * 32 + 32 - camera.y, height: image.naturalHeight / 4 }; }
  if (target === -2) {
    const remote = networkSourceWorld?.avatars.player;
    const image = networkAvatarImages.player;
    if (remote === undefined || image === undefined) return null;
    return { x: remote.x * 32 + 16 - camera.x, bottom: remote.y * 32 + 32 - camera.y,
      height: image.naturalHeight / 4 };
  }
  const eventId = target === 0 ? sourceSequences.current?.eventId : target;
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

async function presentSourceCommand(command: SourcePresentationCommand,
  delay: (milliseconds: number) => Promise<void>): Promise<boolean> {
  const capability = sourceCommandCapability(command.kind);
  if (capability?.support === "rendered"
    && (capability.family === "audiovisual" || command.kind === "text-options")) {
    sourcePresentationCueId += 1;
    const parameters = command.kind === "show-animation" && Array.isArray(command.data.parameters)
      ? command.data.parameters : null;
    const target = parameters?.[0];
    const networkData = parameters === null ? command.data : { ...command.data,
      parameters: [target === 0 ? sourceSequences.current?.eventId ?? 0 : target === -1 ? -2 : target,
        ...parameters.slice(1)] };
    sourcePresentationCue = { id: sourcePresentationCueId, kind: command.kind, data: networkData };
    publishCurrentSourceScene();
  }
  return sourcePresentation.execute(command, delay);
}
const sourceMenuView = new SourceMenuView(localStorage, {
  onSave: saveCurrentSourceWorld,
  onDeleteSave: deleteSourceWorldSave,
  onVolumeChange: (volume) => { sourcePresentation.setMasterVolume(volume / 100); },
  onCreateRoom: (serverUrl) => { void createOrJoin("create", serverUrl, ""); },
  onJoinRoom: (serverUrl, roomCode) => { void createOrJoin("join", serverUrl, roomCode); },
  onDisconnectRoom: disconnectMultiplayer,
  onEditProfile: openPlayerCustomization,
  onMovementMode: selectSourceMovementMode,
  onMovementTestOverride: setSourceMovementTestOverride,
  onDive: requestSourceDive,
});
const sourceShopView = new SourceShopView({ onBuy: buySourceShopItem, onClose: closeSourceShop });
const sourceOverworldHud = new SourceOverworldHud(startPendingSourceEncounter);
const sourceBattleVisuals = new SourceBattleVisuals();
void applyActivePlayerProfile(activePlayerSelection).catch((error: unknown) => {
  console.warn(`[player-profile] ${error instanceof Error ? error.message : "profil indisponible"}`);
});
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
sourceSequenceEffects = new SourceSequenceEffects({
  getEventState: () => sourceEventState,
  updateEventState: (nextState) => {
    sourceEventState = nextState;
    persistSourceEventState();
    renderImportedView();
  },
  getAssets: () => importedAssets,
  getAvatar: () => importedAvatar,
  abort: (sequence, notice) => {
    importedNotice = notice;
    sourceSequences.clear(sequence);
    renderImportedView();
  },
  beginItemPresentation: beginSequenceItemPresentation,
  startPendingEncounter: (onComplete) => sourceBattles.startPendingEncounter(onComplete),
  startTrainerBattle: (trainer, audio, onComplete) => sourceBattles.startTrainerBattle(trainer, audio, onComplete),
  openShop: (sequence, stock) => {
    sourceShop = { sequence, stock, notice: null };
    renderImportedView();
  },
  transferPlayer: executeSourceSequenceTransfer,
  startMoveRoute: startSourceMoveRoute,
  setMovementMode: applySourceSequenceMovementMode,
  present: presentSourceCommand,
  isActive: (sequence) => sourceSequences.isActive(sequence),
  resume: () => { void advanceSourceSequence(); },
});
const sourceDialogueView = new SourceDialogueView(chooseSourceOption);
const sourceBattleOverlay = new SourceBattleOverlay({
  onRenderVisuals: (battle, local) => {
    if (local) sourceBattles.renderVisuals();
    else if (!networkBattleAnimating) void sourceBattleVisuals.render(battle, importedAssets?.battleback ?? "snow");
  },
  onMove: (moveIndex, local) => {
    if (local) void sourceBattles.submitAction(moveIndex);
    else multiplayer.submitBattleAction({ kind: "move", moveIndex });
  },
  onSwitch: (teamIndex) => { multiplayer.submitBattleAction({ kind: "switch", teamIndex }); },
  onReplacement: (teamIndex) => { multiplayer.submitBattleReplacement(teamIndex); },
  onLeave: () => { multiplayer.leaveBattle(); },
  onEscape: () => { void sourceBattles.escape(); },
});
const sourcePlayerDuelView = new SourcePlayerDuelView({
  onAccept: () => {
    const team = currentPlayerDuelTeam();
    if (team !== null) multiplayer.respondPlayerChallenge(true, team);
  },
  onRefuse: () => { multiplayer.respondPlayerChallenge(false, null); },
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
    networkServerUrl = serverUrl;
    networkRoomCode = roomCode;
    if (sourceScenes.menuOpen) renderSourceMenu();
  },
  onPlayersChanged: synchronizeNetworkPlayerProfiles,
  onSourceWorldState: (world, animate, applyOwnAvatar) => {
    void applyNetworkSourceWorld(world, animate, applyOwnAvatar);
  },
  onSourceSceneState: () => undefined,
  onBattleStarted: beginNetworkBattlePresentation,
  onBattleTurnResolved: presentNetworkBattleTurn,
  onBattleReplacementResolved: presentNetworkBattleTurn,
  onBattleClosed: closeNetworkBattlePresentation,
  onRender: render,
});

function beginNetworkBattlePresentation(battleId: string, state: TeamBattleState): void {
  const side = multiplayer.current?.ticket.side ?? "player";
  networkPresentedBattle = { id: battleId, state };
  networkBattleAnimating = true;
  render();
  networkBattlePresentation = networkBattlePresentation.then(async () => {
    if (networkPresentedBattle?.id !== battleId) return;
    const ownVisuals = networkPlayerVisuals[side] ?? sourcePlayerVisuals;
    const opponentSide = oppositeBattleSide(side);
    sourceBattleVisuals.setPlayerTrainerImage(ownVisuals?.battleBack ?? null);
    sourceBattleVisuals.setOpponentTrainerImage(networkPlayerVisuals[opponentSide]?.battleFront ?? null);
    const opponentName = networkPlayerProfiles[opponentSide]?.profile.displayName ?? "L'autre Dresseur";
    await sourceBattleVisuals.startBattle(networkBattleForViewer(state, side), {
      battleback: importedAssets?.battleback ?? "snow",
      battleMusic: importedAssets?.wildBattleBgm ?? null,
      victoryMusic: importedAssets?.wildVictoryMe ?? null,
      opponentTrainer: { id: 0, name: opponentName },
    });
    if (networkPresentedBattle?.id === battleId) {
      networkBattleAnimating = false;
      render();
    }
  }).catch((error: unknown) => {
    console.warn(`[network-battle] ${error instanceof Error ? error.message : "présentation impossible"}`);
    networkBattleAnimating = false;
    render();
  });
}

function presentNetworkBattleTurn(battleId: string, before: TeamBattleState, state: TeamBattleState,
  events: readonly TeamBattleEvent[]): void {
  const side = multiplayer.current?.ticket.side ?? "player";
  networkBattleAnimating = true;
  render();
  networkBattlePresentation = networkBattlePresentation.then(async () => {
    if (networkPresentedBattle?.id !== battleId) return;
    await sourceBattleVisuals.playTurn(networkBattleForViewer(before, side),
      networkBattleEventsForViewer(events, side));
    if (networkPresentedBattle?.id !== battleId) return;
    networkPresentedBattle = { id: battleId, state };
    const presented = networkBattleForViewer(state, side);
    await sourceBattleVisuals.render(presented, importedAssets?.battleback ?? "snow");
    if (state.status === "finished") await sourceBattleVisuals.endBattle(presented.winner);
    if (networkPresentedBattle?.id === battleId) {
      networkBattleAnimating = false;
      render();
    }
  }).catch((error: unknown) => {
    console.warn(`[network-battle] ${error instanceof Error ? error.message : "animation impossible"}`);
    networkPresentedBattle = { id: battleId, state };
    networkBattleAnimating = false;
    render();
  });
}

function closeNetworkBattlePresentation(battleId: string): void {
  if (networkPresentedBattle?.id !== battleId) return;
  networkPresentedBattle = null;
  networkBattleAnimating = false;
  sourceBattleVisuals.setOpponentTrainerImage(null);
  sourceBattleVisuals.setPlayerTrainerImage(sourcePlayerVisuals?.battleBack ?? null);
  void sourceBattleVisuals.endBattle(null);
  render();
}

async function applyNetworkSourceWorld(world: SourceWorldSnapshot, animate: boolean, applyOwnAvatar: boolean): Promise<void> {
  const previousWorld = networkSourceWorld;
  const now = performance.now();
  const session = multiplayer.current;
  if (session === null) return;
  if (session.ticket.side === "opponent" && world.presence.opponent === "away") {
    guestSourceExcursion = true;
    networkSourceWorld = world;
    multiplayer.publishSourceFollower(activeSourceFollowerSpecies());
    if (shouldRejoinSharedSourceMap(true, world.presence.opponent, importedAssets?.map.id ?? null, world.mapId)) {
      multiplayer.setSourcePresence(true, importedAvatar);
      importedNotice = "L'hôte a rejoint votre carte : rattachement à l'instance partagée…";
    } else {
      importedNotice = "Carte différente de celle de l'hôte · progression narrative de l'hôte conservée.";
    }
    renderImportedView();
    return;
  }
  if (session.ticket.side === "opponent") guestSourceExcursion = false;
  const mapChanged = previousWorld !== null && previousWorld.mapId !== world.mapId;
  const synchronizeOwnAvatar = applyOwnAvatar || mapChanged;
  networkSourceWorld = synchronizeOwnAvatar ? world : { ...world,
    avatars: { ...world.avatars, [session.ticket.side]: importedAvatar } };
  multiplayer.publishSourceFollower(activeSourceFollowerSpecies());
  const own = synchronizeOwnAvatar ? world.avatars[session.ticket.side] : importedAvatar;
  if (synchronizeOwnAvatar) {
    sourceMovementMode = world.avatars[session.ticket.side].mode ?? sourceMovementMode;
    sourceMovementAction = world.avatars[session.ticket.side].action ?? "idle";
  }
  const remoteSide: AvatarId = session.ticket.side === "player" ? "opponent" : "player";
  const previousRemote = previousWorld?.mapId === world.mapId ? previousWorld.avatars[remoteSide] : undefined;
  const remote = world.avatars[remoteSide];
  const displayedRemote = networkRemoteSourceMotion === null ? previousRemote
    : sampleSourceGridMotion(networkRemoteSourceMotion, now);
  if (previousRemote !== undefined && (previousRemote.x !== remote.x || previousRemote.y !== remote.y)) {
    networkRemoteSourceMotion = createSourceGridMotion(displayedRemote ?? previousRemote, remote, remote.direction, now,
      { duration: sourceMovementDuration(remote.mode ?? "walk", remote.action ?? "step"),
        walkingPattern: networkRemoteWalkingPattern, action: remote.action ?? "step" });
    networkRemoteWalkingPattern = networkRemoteWalkingPattern === 1 ? 3 : 1;
  }
  const previousFollower = previousWorld?.mapId === world.mapId ? previousWorld.followers?.[remoteSide] : undefined;
  const remoteFollower = world.followers?.[remoteSide];
  const displayedFollower = networkRemoteFollowerMotion === null ? previousFollower
    : sampleSourceGridMotion(networkRemoteFollowerMotion, now);
  if (previousFollower !== undefined && remoteFollower !== undefined
    && (previousFollower.x !== remoteFollower.x || previousFollower.y !== remoteFollower.y)) {
    networkRemoteFollowerMotion = createSourceGridMotion(displayedFollower ?? previousFollower, remoteFollower,
      remoteFollower.direction, now, { walkingPattern: networkRemoteFollowerWalkingPattern });
    networkRemoteFollowerWalkingPattern = networkRemoteFollowerWalkingPattern === 1 ? 3 : 1;
  }
  const application = ++networkSourceWorldApplication;
  if (importedAssets?.map.id !== world.mapId) {
    try {
      const loaded = await loadSourceWorldAt(world.mapId, own);
      if (application !== networkSourceWorldApplication || multiplayer.current !== session) return;
      activateSourceWorld(loaded);
    } catch (error) {
      importedNotice = error instanceof Error ? `Carte de l'hôte inaccessible : ${error.message}` : "Carte de l'hôte inaccessible.";
      render();
      return;
    }
  } else {
    const before = importedAvatar;
    const displayedOwn = importedPlayerMotion === null ? before : sampleSourceGridMotion(importedPlayerMotion, now);
    importedAvatar = own;
    if (animate && (before.x !== own.x || before.y !== own.y)) {
      importedPlayerMotion = createSourceGridMotion(displayedOwn, own, own.direction, now,
        { duration: sourceMovementDuration(sourceMovementMode, sourceMovementAction),
          walkingPattern: importedWalkingPattern, action: world.avatars[session.ticket.side].action ?? "step" });
      importedWalkingPattern = importedWalkingPattern === 1 ? 3 : 1;
    }
  }
  synchronizeNetworkRemoteFollowerAsset(world, remoteSide);
  viewedMapId = SOURCE_MAP_ID;
  importedNotice = session.ticket.side === "player"
    ? "Session Coop active : votre monde narratif est partagé."
    : `Monde de l'hôte rejoint · Map${String(world.mapId).padStart(3, "0")}.`;
  renderImportedView();
}

function synchronizeNetworkRemoteFollowerAsset(world: SourceWorldSnapshot, remoteSide: AvatarId): void {
  const follower = world.followers?.[remoteSide];
  const path = follower === undefined ? null : importedAssets?.pokemonOverworldPaths.get(follower.species) ?? null;
  if (path === networkRemoteFollowerAssetPath) return;
  networkRemoteFollowerAssetPath = path;
  networkRemoteFollowerImage = null;
  if (path === null) return;
  void loadSourceAssetImage(path).then((image) => {
    if (networkRemoteFollowerAssetPath !== path) return;
    networkRemoteFollowerImage = image;
    renderImportedView();
  }).catch((error: unknown) => {
    if (networkRemoteFollowerAssetPath === path) {
      console.warn(`[network-follower] ${error instanceof Error ? error.message : "asset introuvable"}`);
    }
  });
}

function synchronizeNetworkPlayerProfiles(players: readonly RoomPlayerSnapshot[]): void {
  networkPlayerProfiles = Object.fromEntries(players.map((player) => [player.side, player.profile]));
  const presentSides = new Set(players.map((player) => player.side));
  for (const side of ["player", "opponent"] as const) {
    if (presentSides.has(side)) continue;
    delete networkProfileSignatures[side];
    delete networkProfileApplications[side];
    delete networkAvatarImages[side];
    delete networkPlayerVisuals[side];
  }
  render();
  for (const player of players) {
    const signature = JSON.stringify(player.profile);
    if (networkProfileSignatures[player.side] === signature) continue;
    networkProfileSignatures[player.side] = signature;
    const application = (networkProfileApplications[player.side] ?? 0) + 1;
    networkProfileApplications[player.side] = application;
    void loadSourcePlayerVisuals({ schemaVersion: 1, avatarId: player.profile.visualPreset,
      profile: player.profile.profile }).then((visuals) => {
      if (networkProfileApplications[player.side] !== application
        || networkProfileSignatures[player.side] !== signature) return;
      networkAvatarImages = { ...networkAvatarImages, [player.side]: visuals.overworld };
      networkPlayerVisuals = { ...networkPlayerVisuals, [player.side]: visuals };
      render();
    }).catch((error: unknown) => {
      console.warn(`[network-profile] ${error instanceof Error ? error.message : "avatar distant indisponible"}`);
    });
  }
}

function animateImportedMap(now: number): void {
  if (viewedMapId !== SOURCE_MAP_ID || importedAssets === null) {
    importedAnimationFrame = null;
    return;
  }
  const pose = importedPlayerMotion === null
    ? { ...importedAvatar, pattern: 0, complete: true }
    : sampleSourceGridMotion(importedPlayerMotion, now);
  if (sourceScenes.allows("ambient-motion", sourceSceneActivity())
    && !isNetworkGuest()) {
    const contact = sourceNpcMotions.update(now, importedAssets.map, importedAssets.events, sourceEventState, importedAvatar);
    if (contact !== null) {
      beginSourceSequence(contact, `Contact événement ${contact.event.id} · ${contact.event.name}`);
    }
  }
  synchronizeSourceFollower();
  const followerPose = sourceFollowerMotion.pose(now);
  const remoteSide: AvatarId | null = multiplayer.current?.ticket.side === "player" ? "opponent"
    : multiplayer.current?.ticket.side === "opponent" ? "player" : null;
  const remotePresent = !guestSourceExcursion
    && (remoteSide === null || networkSourceWorld?.presence[remoteSide] !== "away");
  const remoteMotion = networkRemoteSourceMotion;
  const sampledRemotePose = remoteMotion === null ? null : sampleSourceGridMotion(remoteMotion, now);
  const remotePose = remoteSide === null || !remotePresent ? null : sampledRemotePose === null
    ? networkSourceWorld?.avatars[remoteSide] ?? null
    : { ...sampledRemotePose, pattern: sampledRemotePose.complete ? 0 : remoteMotion?.walkingPattern ?? 0 };
  const remoteMode = remoteSide === null ? "walk" : networkSourceWorld?.avatars[remoteSide].mode ?? "walk";
  const remoteImage = remoteSide === null ? null
    : sourcePlayerImageForMovement(networkPlayerVisuals[remoteSide] ?? null, remoteMode)
      ?? networkAvatarImages[remoteSide] ?? null;
  const remoteFollower = remoteSide === null || !remotePresent ? null : networkSourceWorld?.followers?.[remoteSide] ?? null;
  const remoteFollowerPose = remoteFollower === null ? null : networkRemoteFollowerMotion === null
    ? remoteFollower : sampleSourceGridMotion(networkRemoteFollowerMotion, now);
  const remoteCharacters = [
    ...(remoteFollowerPose === null || networkRemoteFollowerImage === null ? []
      : [{ image: networkRemoteFollowerImage, pose: remoteFollowerPose,
        pattern: "pattern" in remoteFollowerPose ? remoteFollowerPose.pattern : 0 }]),
    ...(remotePose === null || remoteImage === null ? []
      : [{ image: remoteImage, pose: remotePose, pattern: "pattern" in remotePose ? remotePose.pattern : 0,
        renderOffsetY: "renderOffsetY" in remotePose ? remotePose.renderOffsetY : 0 }]),
  ];
  drawImportedMap(context, canvas, importedAssets, pose, pose.pattern, now, renderedSourceEventState(), sourceNpcMotions.poses(now),
    sourcePresentation.currentCameraOffset(), activeSourcePlayerImage(),
    (sourcePickupStartedAt === null ? 0 : sourceItemPickupOffset(now - sourcePickupStartedAt))
      + ("renderOffsetY" in pose ? pose.renderOffsetY : 0),
    sourceFollowerImage === null || followerPose === null ? null : { image: sourceFollowerImage, pose: followerPose },
    remoteCharacters);
  if (importedPlayerMotion !== null && pose.complete) {
    importedPlayerMotion = null;
    if (sourceSequences.current === null) finishImportedStep();
  }
  if (networkRemoteSourceMotion !== null && sampleSourceGridMotion(networkRemoteSourceMotion, now).complete) {
    networkRemoteSourceMotion = null;
  }
  if (networkRemoteFollowerMotion !== null && sampleSourceGridMotion(networkRemoteFollowerMotion, now).complete) {
    networkRemoteFollowerMotion = null;
  }
  importedAnimationFrame = requestAnimationFrame(animateImportedMap);
}

function sourceSceneActivity(): SourceSceneActivity {
  return { dialogue: sourceDialogues.current !== null,
    battle: sourceBattles.active || (multiplayer.current?.snapshot?.battle ?? null) !== null
      || (multiplayer.current?.snapshot?.duelChallenge ?? null) !== null,
    transition: sourceTransitionInProgress, sequence: sourceSequences.current !== null,
    movement: importedPlayerMotion !== null };
}

function saveCurrentSourceWorld(): void {
  if (importedAssets === null) return;
  sourceWorldSave = createSourceWorldSave(importedAssets.map.id, importedAvatar.x, importedAvatar.y,
    importedAvatar.direction, Date.now(), sourceMovementMode === "run" ? "walk" : sourceMovementMode);
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

function sourceMapAllowsMount(): boolean {
  const metadata = importedAssets?.mapMetadata;
  return metadata !== undefined && (metadata.bicycleAlways || metadata.bicycle === true
    || metadata.bicycle === null && metadata.outdoor === true);
}

function sourceMovementMenuModel(): import("./source-menu-view.js").SourceMenuMovementModel {
  const unlocks = sourceMovementUnlocks(sourceEventState, sourceMovementTestOverride);
  const terrain = importedAssets === null ? 0
    : sourceTerrainAt(importedAssets.map, importedAssets.tileset, importedAvatar.x, importedAvatar.y);
  return { mode: sourceMovementMode, unlocks,
    canDiveHere: sourceMovementMode === "surf" && terrain === SOURCE_TERRAIN.deepWater
      && importedAssets?.mapMetadata.diveMap !== null && unlocks.dive,
    canSurfaceHere: sourceMovementMode === "dive"
      && importedAssets?.mapMetadata.surfaceMap !== null && unlocks.dive };
}

function selectSourceMovementMode(mode: "walk" | "mount"): void {
  if (importedAssets === null) return;
  const unlocks = sourceMovementUnlocks(sourceEventState, sourceMovementTestOverride);
  if (!sourceMovementModeAllowed(mode, unlocks)) {
    importedNotice = "Ce déplacement n'est pas encore débloqué dans cette sauvegarde.";
    renderImportedView();
    return;
  }
  const terrain = sourceTerrainAt(importedAssets.map, importedAssets.tileset, importedAvatar.x, importedAvatar.y);
  if (mode === "mount" && !sourceMapAllowsMount()) {
    importedNotice = "Chevroum ne peut pas être utilisé sur cette carte.";
    renderImportedView();
    return;
  }
  if (mode === "walk" && (sourceMovementMode === "surf" || sourceMovementMode === "dive")
    && isSourceSurfableTerrain(terrain)) {
    importedNotice = "Rejoignez la rive ou remontez à la surface avant de revenir à pied.";
    renderImportedView();
    return;
  }
  sourceMovementMode = mode;
  sourceMovementAction = "idle";
  importedNotice = mode === "mount" ? "Chevroum est prêt." : "Déplacement à pied activé.";
  publishCurrentSourceWorld();
  renderImportedView();
}

function setSourceMovementTestOverride(enabled: boolean): void {
  sourceMovementTestOverride = enabled;
  persistSourceMovementTestOverride(localStorage, enabled);
  const unlocks = sourceMovementUnlocks(sourceEventState, enabled);
  if (!sourceMovementModeAllowed(sourceMovementMode, unlocks)) {
    sourceMovementMode = "walk";
    sourceMovementAction = "idle";
  }
  importedNotice = enabled
    ? "Mode test : tous les déplacements sont utilisables sans modifier la progression."
    : "Mode test désactivé : les conditions normales de l'histoire s'appliquent.";
  publishCurrentSourceWorld();
  renderImportedView();
}

function requestSourceDive(): void {
  sourceScenes.closeMenu();
  if (!trySourceTraversalInteraction()) {
    importedNotice = "La plongée n'est pas possible à cet endroit.";
    renderImportedView();
  }
}

function applySourceSequenceMovementMode(mode: SourceMovementMode): void {
  sourceMovementMode = mode;
  sourceMovementAction = mode === "mount" ? "climb" : "idle";
  publishCurrentSourceWorld();
  renderImportedView();
}

function renderSourceMenu(): void {
  if (importedAssets === null) return;
  const network = multiplayer.current;
  sourceMenuView.render({ open: sourceScenes.menuOpen, tab: sourceScenes.menuTab, assets: importedAssets,
    eventState: sourceEventState, avatar: importedAvatar, worldSave: sourceWorldSave,
    movement: sourceMovementMenuModel(),
    coop: { active: multiplayer.active, state: networkStateText, notice: networkNotice,
      serverUrl: networkServerUrl, roomCode: networkRoomCode,
      profileName: activePlayerSelection.profile.displayName,
      players: (network?.snapshot?.players ?? []).map((player) => ({ side: player.side,
        name: player.profile.profile.displayName, connected: player.connected })) } });
}

function closeSourceShop(): void {
  const shop = sourceShop;
  if (shop === null) return;
  sourceShop = null;
  importedNotice = "Boutique fermée.";
  renderImportedView();
  if (sourceSequences.isActive(shop.sequence)) void advanceSourceSequence();
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
  const activeSequence = sourceSequences.current;
  const sequenceStatus = activeSequence === null ? "aucune"
    : `${activeSequence.label} · étape ${activeSequence.cursor}/${activeSequence.plan.steps.length}`
      + ` · ${activeSequence.plan.steps[activeSequence.cursor]?.command.kind ?? "finalisation"}`
      + ` · ${activeSequence.runner.pendingRoutes} route(s)`;
  sourceOverworldHud.render({ assets: importedAssets, avatar: importedAvatar, eventState: sourceEventState,
    battleActive: sourceBattle !== null, sequenceStatus, notice: importedNotice,
    parallelAuditNotice: sourceParallelAuditNotice, sceneAuditNotice: sourceSceneAuditNotice,
    canChangeScene: sourceScenes.allows("scene-change", sourceSceneActivity()) });
  renderSourceDialogue();
  renderEncounter();
  renderSourceMenu();
  renderSourceShop();
  publishCurrentSourceScene();
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
  importedNotice = gains.map(sourceItemGainMessage).join(" ");
  sourceSequences.start({ label: "Objet obtenu", mapId: completed.mapId, eventId: completed.eventId,
    plan: compileAndReportSourceScene(page, "Obtention d'objet"), translations: new Map(), onComplete: () => {
      sourcePickupPose = false;
      sourcePickupStartedAt = null;
      onComplete();
      renderImportedView();
    } });
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
  void presentSourceCommand({ kind: "play-sound",
    data: { audio: { name: "ItemGet", volume: 100, pitch: 100 } } }, async () => undefined);
  beginSourceEvent({ ...sequence.plan.page, commands }, sequence.mapId, sequence.eventId,
    "Objet obtenu", sequence.translations);
  renderImportedView();
}

function applyCompletedSourceEvent(completed: SourceDialogueSession): void {
  const previousInventory = sourceEventState.inventory;
  const result = applySafeStateCommands(sourceInteractionState(), completed.flow.page, completed.mapId, completed.eventId,
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
  importedNotice = "Cinématique avant le combat…";
  sourceSequences.start({ label: `${completed.label} · cinématique`, mapId: completed.mapId,
    eventId: completed.eventId,
    plan: compileAndReportSourceScene({ ...completed.flow.page, commands: presentationCommands },
      `${completed.label} · avant-combat`),
    translations: completed.translations, onComplete: () => applyCompletedSourceEvent(completed) });
  return true;
}

function finishSourceEvent(completed: SourceDialogueSession): void {
  const activeSequence = sourceSequences.current;
  if (activeSequence !== null && completed.eventId === activeSequence.eventId) {
    if (!completed.flow.complete) {
      importedNotice = `Séquence interrompue : ${completed.flow.blockedReason ?? "dialogue incomplet"}.`;
      sourceSequences.clear(activeSequence);
      sourceSequenceChoicePrompt = null;
      return;
    }
    if (sourceSequenceChoicePrompt === activeSequence) {
      sourceSequenceChoicePrompt = null;
      const selected = completed.selections[0];
      if (selected === undefined || !continueSourceSequenceChoice(activeSequence, selected)) {
        renderImportedView();
        return;
      }
    }
    if (sourcePickupDialogueSequence === activeSequence) {
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
  const update = sourceDialogues.choose(index, sourceInteractionState(), sourceDirectionNumber(importedAvatar.direction),
    sourceMovementTestOverride);
  applySourceDialogueUpdate(update);
  if (update.changed) renderImportedView();
}

function beginSourceEvent(page: ImportedEventPage, mapId: number, eventId: number, label: string,
  translations: ReadonlyMap<string, string>): void {
  applySourceDialogueUpdate(sourceDialogues.begin(page, mapId, eventId, label, translations, sourceInteractionState(),
    sourceDirectionNumber(importedAvatar.direction), { playerName: activePlayerSelection.profile.displayName },
    sourceMovementTestOverride));
}

function sourceDirectionNumber(direction: Direction): number {
  switch (direction) {
    case "down": return 2;
    case "left": return 4;
    case "right": return 6;
    case "up": return 8;
  }
}

function activeSourcePlayerImage(): HTMLImageElement {
  if (importedAssets === null) throw new Error("Carte source absente.");
  if (sourcePickupPose) return sourcePlayerVisuals?.pickup ?? importedAssets.playerPickupImage;
  if (sourcePlayerCharacterName === "player") {
    return sourcePlayerImageForMovement(sourcePlayerVisuals, sourceMovementMode) ?? importedAssets.playerImage;
  }
  return sourcePlayerImageFor(sourcePlayerVisuals, sourcePlayerCharacterName)
    ?? sourcePlayerVisuals?.overworld ?? importedAssets.playerImage;
}

async function applyActivePlayerProfile(selection: PlayerAvatarSelection): Promise<void> {
  const application = ++playerProfileApplication;
  const visuals = await loadSourcePlayerVisuals(selection);
  if (application !== playerProfileApplication) return;
  activePlayerSelection = selection;
  persistSessionPlayerAvatarSelection(sessionStorage, localStorage, selection);
  sourcePlayerVisuals = visuals;
  sourceBattleVisuals.setPlayerTrainerImage(visuals.battleBack);
  multiplayer.updateProfile(activeNetworkPlayerProfile());
  importedNotice = `Profil de ${selection.profile.displayName} appliqué au monde et aux combats.`;
  render();
}

function synchronizeSourceFollower(): void {
  if (importedAssets === null) return;
  const activeIndex = sourceEventState.party.activeIndex;
  const member = activeIndex === null ? null : sourceEventState.party.members[activeIndex] ?? null;
  const enabled = sourceEventState.followerEnabled && member !== null;
  sourceFollowerMotion.synchronize(enabled, importedAssets.map, importedAvatar);
  const path = enabled ? importedAssets.pokemonOverworldPaths.get(member.species) ?? null : null;
  if (path === sourceFollowerAssetPath) return;
  sourceFollowerAssetPath = path;
  sourceFollowerImage = null;
  if (path === null) return;
  void loadSourceAssetImage(path).then((image) => {
    if (sourceFollowerAssetPath !== path) return;
    sourceFollowerImage = image;
    renderImportedView();
  }).catch((error: unknown) => {
    if (sourceFollowerAssetPath === path) console.warn(`[source-follower] ${error instanceof Error ? error.message : "asset introuvable"}`);
  });
}

function activateSourceWorld(world: LoadedSourceWorld): void {
  importedAssets = world.assets;
  importedAvatar = world.avatar;
  importedPlayerMotion = null;
  heldMovementKeys.clear();
  sourcePresentation.resetMapPresentation();
  sourceNpcMotions.reset(world.assets.map.id, world.assets.events, performance.now());
  sourceFollowerMotion.reset(world.assets.map, world.avatar);
  void refreshSourceParallelPresentation(world.assets);
  queueMicrotask(publishCurrentSourceWorld);
}

async function executeSourceSequenceTransfer(transfer: ImportedTransfer): Promise<void> {
  if (importedAssets?.map.id !== transfer.targetMapId) {
    await followSourceTransfer(transfer);
    return;
  }
  importedAvatar = { x: transfer.targetX, y: transfer.targetY,
    direction: sourceDirection(transfer.direction, importedAvatar.direction) };
  importedPlayerMotion = null;
  heldMovementKeys.clear();
  sourcePresentation.resetMapPresentation();
  sourceNpcMotions.reset(importedAssets.map.id, importedAssets.events, performance.now());
  sourceFollowerMotion.reset(importedAssets.map, importedAvatar);
  void refreshSourceParallelPresentation(importedAssets);
  renderImportedView();
  if (multiplayer.current?.ticket.side === "opponent" && networkSourceWorld?.mapId === transfer.targetMapId) {
    guestSourceExcursion = false;
    multiplayer.setSourcePresence(true, importedAvatar);
  }
  publishCurrentSourceWorld();
}

async function followSourceTransfer(transfer: ImportedTransfer): Promise<void> {
  if (!sourceScenes.allows("source-transfer", sourceSceneActivity())) return;
  const guestSession = multiplayer.current?.ticket.side === "opponent";
  const hostMapId = networkSourceWorld?.mapId;
  const leavingSharedWorld = guestSession && !guestSourceExcursion && hostMapId !== undefined
    && transfer.targetMapId !== hostMapId;
  if (leavingSharedWorld) {
    guestSourceExcursion = true;
    multiplayer.setSourcePresence(false, null);
  }
  sourceTransitionInProgress = true;
  sourceDialogues.cancel();
  importedNotice = `Chargement de Map${String(transfer.targetMapId).padStart(3, "0")}…`;
  renderImportedView();
  try {
    const next = await loadSourceTransfer(importedAssets, importedAvatar, transfer);
    const requestedTransferMode = pendingTransferMovementMode;
    pendingTransferMovementMode = null;
    activateSourceWorld(next);
    const metadata = next.assets.mapMetadata;
    const mountAllowed = metadata.bicycleAlways || metadata.bicycle === true
      || metadata.bicycle === null && metadata.outdoor === true;
    sourceMovementMode = requestedTransferMode
      ?? (sourceMovementMode === "mount" && mountAllowed ? "mount" : "walk");
    sourceMovementAction = "idle";
    const returningToSharedWorld = guestSession && hostMapId === next.assets.map.id;
    if (returningToSharedWorld) {
      guestSourceExcursion = false;
      multiplayer.setSourcePresence(true, importedAvatar);
    } else if (next.changedMap) pendingSourceMapEntryAutorun = next.assets.map.id;
    importedNotice = `Arrivée dans ${next.assets.map.name}, en ${transfer.targetX},${transfer.targetY}. Graphismes, événements et français chargés à la demande.`;
  } catch (error) {
    pendingTransferMovementMode = null;
    if (leavingSharedWorld) {
      guestSourceExcursion = false;
      multiplayer.setSourcePresence(true, importedAvatar);
    }
    importedNotice = error instanceof Error ? `Changement de carte impossible : ${error.message}` : "Changement de carte impossible.";
  } finally {
    sourceTransitionInProgress = false;
    renderImportedView();
  }
  if (sourceSequences.current === null) queueMicrotask(beginPendingSourceMapEntryAutorun);
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
    sourceMovementMode = "walk";
    sourceMovementAction = "idle";
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
    sourceMovementMode = "walk";
    sourceMovementAction = "idle";
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
  const avatarLabVisible = viewedMapId === AVATAR_LAB_MAP_ID;
  requiredAppElement("world-stage").hidden = avatarLabVisible;
  requiredAppElement("map-legend").hidden = avatarLabVisible;
  document.querySelectorAll<HTMLButtonElement>("[data-map]").forEach((button) =>
    button.classList.toggle("active", button.dataset.map === viewedMapId));
  if (avatarLabVisible) {
    if (importedAnimationFrame !== null) { cancelAnimationFrame(importedAnimationFrame); importedAnimationFrame = null; }
    const title = document.querySelector<HTMLElement>("#map-name"); if (title !== null) title.textContent = "Personnage de test";
    avatarLabView.show();
    return;
  }
  avatarLabView.hide();
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
    networkSide: network?.ticket.side ?? null, profiles: networkPlayerProfiles, avatarImages: networkAvatarImages });
  renderSourceDialogue();
  renderEncounter();
  renderSourceMenu();
}

function renderEncounter(): void {
  const network = multiplayer.current;
  const sourceBattle = sourceBattles.current;
  const networkBattle = network?.snapshot?.battle ?? null;
  const canonicalNetworkState = networkBattle !== null && networkPresentedBattle?.id === networkBattle.id
    ? networkPresentedBattle.state : networkBattle?.state ?? null;
  const presentedNetworkState = canonicalNetworkState !== null && networkBattle?.duel === true && network !== null
    ? networkBattleForViewer(canonicalNetworkState, network.ticket.side) : canonicalNetworkState;
  const battleState = viewedMapId === SOURCE_MAP_ID && sourceBattle !== null ? sourceBattle : presentedNetworkState;
  const localSourceBattle = battleState !== null && battleState === sourceBattle;
  sourceBattleOverlay.render({ state: battleState, local: localSourceBattle,
    animating: localSourceBattle ? sourceBattles.animating : networkBattleAnimating,
    networkSide: networkBattle?.duel === true ? "player" : network?.ticket.side ?? null,
    networkSubmittedTurn: network?.submittedTurn ?? null,
    escapable: localSourceBattle && sourceEventState.pendingEncounter?.escapable === true });
  const side = network?.ticket.side ?? null;
  const duel = network?.snapshot?.duelChallenge ?? null;
  sourcePlayerDuelView.render({ challenge: duel, side, players: network?.snapshot?.players ?? [],
    canAccept: currentPlayerDuelTeam() !== null });
  if (networkBattle?.duel === true && networkBattle.state.status === "finished"
    && side !== null && storedPlayerDuelBattleId !== networkBattle.id) {
    sourceEventState = { ...sourceEventState,
      party: storeBattleTeam(sourceEventState.party, networkBattle.state.teams[side]) };
    storedPlayerDuelBattleId = networkBattle.id;
    persistSourceEventState();
  }
}

function currentPlayerDuelTeam(): BattleTeam | null {
  if (importedAssets === null || sourceEventState.party.members.every((member) => member.hp <= 0)) return null;
  try {
    const team = playerPartyToBattleTeam(sourceEventState.party, importedAssets.battleCatalog);
    if ((team.members[team.activeIndex]?.hp ?? 0) > 0) return team;
    const activeIndex = team.members.findIndex((member) => member.hp > 0);
    return activeIndex < 0 ? null : { ...team, activeIndex };
  } catch {
    return null;
  }
}

function remotePlayerAhead(): boolean {
  const session = multiplayer.current;
  const world = networkSourceWorld;
  if (session === null || world === null || world.presence.player !== "shared" || world.presence.opponent !== "shared") return false;
  const otherSide: AvatarId = session.ticket.side === "player" ? "opponent" : "player";
  const remote = world.avatars[otherSide];
  const delta = importedAvatar.direction === "up" ? { x: 0, y: -1 } : importedAvatar.direction === "down"
    ? { x: 0, y: 1 } : importedAvatar.direction === "left" ? { x: -1, y: 0 } : { x: 1, y: 0 };
  return importedAvatar.x + delta.x === remote.x && importedAvatar.y + delta.y === remote.y;
}

function move(playerId: string, direction: Direction): void {
  if (viewedMapId === AVATAR_LAB_MAP_ID) return;
  if (viewedMapId === SOURCE_MAP_ID && importedAssets !== null) {
    if (playerId !== "player") return;
    if (!sourceScenes.allows("world-input", sourceSceneActivity())) return;
    if (sourceMovementAction === "ice-slide" || sourceMovementAction === "waterfall") direction = importedAvatar.direction;
    const networkSide = multiplayer.active && !guestSourceExcursion ? multiplayer.current?.ticket.side ?? null : null;
    const events = sourceMapEvents();
    const facingAvatar = { ...importedAvatar, direction };
    const eventAhead = playerTouchEventInDirection(events, importedAvatar, direction, importedAssets.map.id,
      sourceInteractionState());
    if (eventAhead !== null && (!isNetworkGuest() || guestCanRunSourceEvent(eventAhead))) {
      importedAvatar = facingAvatar;
      publishCurrentSourceWorld();
      beginSourceSequence(eventAhead, `Événement de contact ${eventAhead.event.id} · ${eventAhead.event.name}`);
      return;
    }
    const before = importedAvatar;
    const unlocks = sourceMovementUnlocks(sourceEventState, sourceMovementTestOverride);
    const requestedMode = sourceModeForInput(sourceMovementMode, sourceSprintHeld, unlocks);
    const facing = sourceFacingPoint(importedAvatar.x, importedAvatar.y, direction);
    const facingTerrain = sourceTerrainAt(importedAssets.map, importedAssets.tileset, facing.x, facing.y);
    const waterfall = sourceMovementMode === "surf" && unlocks.waterfall
      && facingTerrain === SOURCE_TERRAIN.waterfall && (direction === "up" || direction === "down");
    if (networkSide !== null && !multiplayer.sendMovement(networkSide, direction,
      { mode: requestedMode, waterfall })) return;
    const remoteSide: AvatarId | null = networkSide === null ? null
      : networkSide === "player" ? "opponent" : "player";
    const remote = remoteSide === null ? undefined : networkSourceWorld?.avatars[remoteSide];
    const remoteFollower = remoteSide === null ? undefined : networkSourceWorld?.followers?.[remoteSide];
    const occupied = [...blockingDefaultEventPoints(events, importedAssets.map.id, renderedSourceEventState()),
      ...(remote === undefined ? [] : [remote]), ...(remoteFollower === undefined ? [] : [remoteFollower])];
    const world = networkSide === null ? sourceWorldHostState() : networkSourceWorld;
    if (world === null) return;
    const resolution = resolveSourceMovement(world,
      { ...importedAvatar, mode: sourceMovementMode, action: sourceMovementAction },
      { direction, mode: requestedMode, waterfall }, occupied);
    const next = resolution.avatar;
    importedAvatar = next;
    sourceMovementMode = next.mode ?? sourceMovementMode;
    sourceMovementAction = next.action ?? "idle";
    if (before.x !== next.x || before.y !== next.y) {
      const startedAt = performance.now();
      importedPlayerMotion = createSourceGridMotion(before, next, direction, startedAt,
        { duration: sourceMovementDuration(sourceMovementMode, sourceMovementAction),
          walkingPattern: importedWalkingPattern, action: next.action ?? "step" });
      sourceFollowerMotion.followPlayerStep(before, next, startedAt);
      importedWalkingPattern = importedWalkingPattern === 1 ? 3 : 1;
      importedNotice = `Déplacement vers ${next.x},${next.y}…`;
    } else {
      importedNotice = `Passage bloqué vers ${direction}. La collision directionnelle source est respectée.`;
    }
    renderImportedView();
    if (networkSide === null) publishCurrentSourceWorld();
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
  if (viewedMapId === AVATAR_LAB_MAP_ID) return;
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
      importedAssets.tileset, importedAssets.map.id, sourceInteractionState());
    if (target === null && trySourceTraversalInteraction()) return;
    const interactionTarget = sourceInteractionTarget(target !== null,
      multiplayer.active && !guestSourceExcursion && remotePlayerAhead());
    if (interactionTarget === "player") {
      const team = currentPlayerDuelTeam();
      if (team === null) importedNotice = "Aucun Pokémon en état de combattre.";
      else multiplayer.challengePlayer(team);
      renderImportedView();
      return;
    }
    if (target !== null && !guestCanRunSourceEvent(target)) {
      importedNotice = "Cet événement narratif reste contrôlé par l'hôte.";
      renderImportedView();
      return;
    }
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

function trySourceTraversalInteraction(): boolean {
  if (importedAssets === null) return false;
  const unlocks = sourceMovementUnlocks(sourceEventState, sourceMovementTestOverride);
  const terrain = sourceTerrainAt(importedAssets.map, importedAssets.tileset, importedAvatar.x, importedAvatar.y);
  if (sourceMovementMode === "dive") {
    const surfaceMap = importedAssets.mapMetadata.surfaceMap;
    if (!unlocks.dive || surfaceMap === null) return false;
    pendingTransferMovementMode = "surf";
    void followSourceTransfer({ eventId: 0, pageIndex: 0, eventX: importedAvatar.x, eventY: importedAvatar.y,
      targetMapId: surfaceMap, targetX: importedAvatar.x, targetY: importedAvatar.y,
      direction: sourceDirectionNumber(importedAvatar.direction) });
    return true;
  }
  if (terrain === SOURCE_TERRAIN.deepWater && sourceMovementMode === "surf") {
    const diveMap = importedAssets.mapMetadata.diveMap;
    if (!unlocks.dive || diveMap === null) return false;
    pendingTransferMovementMode = "dive";
    void followSourceTransfer({ eventId: 0, pageIndex: 0, eventX: importedAvatar.x, eventY: importedAvatar.y,
      targetMapId: diveMap, targetX: importedAvatar.x, targetY: importedAvatar.y,
      direction: sourceDirectionNumber(importedAvatar.direction) });
    return true;
  }
  const facing = sourceFacingPoint(importedAvatar.x, importedAvatar.y, importedAvatar.direction);
  const facingTerrain = sourceTerrainAt(importedAssets.map, importedAssets.tileset, facing.x, facing.y);
  if (sourceMovementMode !== "surf" && unlocks.surf && isSourceSurfableTerrain(facingTerrain)) {
    sourceMovementMode = "surf";
    sourceMovementAction = "surf-transition";
    move("player", importedAvatar.direction);
    return true;
  }
  return false;
}

function setNetworkText(stateText: string, notice: string, _active: boolean): void {
  networkStateText = stateText;
  networkNotice = notice;
  if (sourceScenes.menuOpen) renderSourceMenu();
}

async function createOrJoin(kind: "create" | "join", serverUrl: string, roomCode: string): Promise<void> {
  if (sourceBattles.active) return;
  lastPublishedSourceScene = "";
  networkServerUrl = serverUrl;
  networkRoomCode = roomCode.trim().toUpperCase();
  await multiplayer.createOrJoin(kind, networkServerUrl, networkRoomCode, activeNetworkPlayerProfile(),
    kind === "create" ? sourceWorldHostState() : null);
}

function openPlayerCustomization(): void {
  avatarLabReturnMapId = viewedMapId;
  sourceScenes.closeMenu();
  viewedMapId = AVATAR_LAB_MAP_ID;
  render();
}

function closePlayerCustomization(): void {
  viewedMapId = avatarLabReturnMapId;
  sourceScenes.openMenu(sourceSceneActivity());
  sourceScenes.selectMenuTab("coop");
  render();
}

function disconnectMultiplayer(): void {
  multiplayer.disconnect();
  networkRoomCode = "";
  networkPlayerProfiles = {};
  networkAvatarImages = {};
  networkPlayerVisuals = {};
  networkPresentedBattle = null;
  networkBattleAnimating = false;
  networkProfileSignatures = {};
  networkProfileApplications = {};
  networkSourceWorld = null;
  guestSourceExcursion = false;
  networkRemoteSourceMotion = null;
  networkRemoteFollowerMotion = null;
  networkRemoteFollowerImage = null;
  networkRemoteFollowerAssetPath = null;
  lastPublishedSourceScene = "";
  events = [];
  setAuthoritativeState(initialState(), false);
  viewedMapId = importedAssets === null ? "meadow" : SOURCE_MAP_ID;
  sourceScenes.closeMenu();
  render();
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
  if (event.code === "ShiftLeft" || event.code === "ShiftRight") sourceSprintHeld = true;
  if (event.code === "Escape") {
    if (sourceShop !== null) { event.preventDefault(); closeSourceShop(); return; }
    if (sourceScenes.menuOpen) { event.preventDefault(); toggleSourceMenu(); return; }
    if (sourceSequences.current !== null && sourceDialogues.current !== null) { event.preventDefault(); return; }
    if (sourceDialogues.cancel()) { event.preventDefault(); renderImportedView(); return; }
    if (viewedMapId !== AVATAR_LAB_MAP_ID && importedAssets !== null) { event.preventDefault(); toggleSourceMenu(); return; }
  }
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement || target instanceof HTMLElement && target.isContentEditable) return;
  if (event.code === "KeyM" && viewedMapId !== AVATAR_LAB_MAP_ID && importedAssets !== null) {
    event.preventDefault(); toggleSourceMenu(); return;
  }
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
window.addEventListener("keyup", (event) => {
  heldMovementKeys.delete(event.code);
  if (event.code === "ShiftLeft" || event.code === "ShiftRight") sourceSprintHeld = false;
});
window.addEventListener("blur", () => { heldMovementKeys.clear(); sourceSprintHeld = false; });
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
  if (tab === undefined || !["team", "bag", "movement", "save", "coop", "options"].includes(tab)) return;
  sourceScenes.selectMenuTab(tab);
  renderSourceMenu();
}));
document.querySelector<HTMLButtonElement>("#starter-test")?.addEventListener("click", () => { void openStarterTest(); });
document.querySelector<HTMLButtonElement>("#reset")?.addEventListener("click", () => {
  if (multiplayer.active) return;
  if (viewedMapId === AVATAR_LAB_MAP_ID) return;
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
      sourceMovementMode = requestedSave?.movementMode === "run" ? "walk" : requestedSave?.movementMode ?? "walk";
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

multiplayer.restore(activeNetworkPlayerProfile());
