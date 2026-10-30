import { parsePlayerAvatarSelection, PLAYER_AVATAR_ACTIVE_STORAGE_KEY,
  PLAYER_AVATAR_SESSION_ACTIVE_STORAGE_KEY, type PlayerAvatarSelection } from "@pokemon-z-battle/player-state";
import { createSourceEventState, parseSourceEventState, type SourceEventState } from "./source-event-state.js";
import { SOURCE_EVENT_STATE_STORAGE_KEY, SOURCE_NEW_GAME_STORAGE_KEY,
  parseSourceNewGameSetup, type SourceNewGameSetup } from "./source-new-game.js";
import { SOURCE_FIELD_SHORTCUTS_STORAGE_KEY } from "./source-field-shortcuts.js";
import { createSourceWorldSave, parseSourceWorldSave, SOURCE_WORLD_SAVE_KEY, type SourceWorldSave } from "./source-world-save.js";

export type SourceSaveSlotId = 1 | 2;
export type SourceSaveKind = "manual" | "auto";

export interface SourceSaveSlotSnapshot {
  readonly schemaVersion: 1;
  readonly savedAt: number;
  readonly worldSave: SourceWorldSave | null;
  readonly eventState: SourceEventState;
  readonly player: PlayerAvatarSelection | null;
  readonly newGame: SourceNewGameSetup | null;
  readonly fieldShortcuts: string | null;
}

export interface SourceSaveSlotSummary {
  readonly id: SourceSaveSlotId;
  readonly manual: SourceSaveSlotSnapshot | null;
  readonly auto: SourceSaveSlotSnapshot | null;
}

const ACTIVE_SLOT_KEY = "pokemon-z-battle.source-save-active-slot.v1";
const AUTO_RESUME_KEY = "pokemon-z-battle.source-save-auto-resume.v1";
const AUTO_IGNORED_PREFIX = "pokemon-z-battle.source-save-auto-ignored.v1";
const SLOT_PREFIX = "pokemon-z-battle.source-save-slot.v1";
const IMPORT_BACKUP_PREFIX = "pokemon-z-battle.rxdata-import-backup.v1";
const IMPORT_CLOUD_HOLD_PREFIX = "pokemon-z-battle.rxdata-cloud-hold.v1";
const SLOT_IDS = [1, 2] as const;

export function sourceSaveSlotKey(id: SourceSaveSlotId, kind: SourceSaveKind): string {
  return `${SLOT_PREFIX}.${id}.${kind}`;
}

function importBackupKey(id: SourceSaveSlotId): string { return `${IMPORT_BACKUP_PREFIX}.${id}`; }
export function sourceImportCloudHoldKey(id: SourceSaveSlotId): string { return `${IMPORT_CLOUD_HOLD_PREFIX}.${id}`; }
export function sourceImportBackupExists(storage: Pick<Storage, "getItem">, id: SourceSaveSlotId): boolean {
  return storage.getItem(importBackupKey(id)) !== null;
}

/** A preview is mandatory before this call. Existing manual and auto branches are backed up together. */
export function importSourceSaveSlot(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  id: SourceSaveSlotId, snapshot: SourceSaveSlotSnapshot): void {
  const validated = parseSourceSaveSlotSnapshot(snapshot);
  const manualKey = sourceSaveSlotKey(id, "manual");
  const autoKey = sourceSaveSlotKey(id, "auto");
  const backupKey = importBackupKey(id);
  const holdKey = sourceImportCloudHoldKey(id);
  const keys = [manualKey, autoKey, backupKey, holdKey, ignoredAutoKey(id), AUTO_RESUME_KEY];
  const before = keys.map((key) => [key, storage.getItem(key)] as const);
  try {
    if (storage.getItem(backupKey) === null && (before[0]![1] !== null || before[1]![1] !== null)) {
      storage.setItem(backupKey, JSON.stringify({ manual: before[0]![1], auto: before[1]![1] }));
    }
    storage.setItem(manualKey, JSON.stringify(validated));
    storage.removeItem(autoKey);
    storage.removeItem(ignoredAutoKey(id));
    storage.removeItem(AUTO_RESUME_KEY);
    storage.setItem(holdKey, "1");
  } catch (error) {
    for (const [key, value] of before) {
      try { setOrRemove(storage, key, value); } catch { /* Keep the original failure. */ }
    }
    throw error;
  }
}

export function restoreSourceImportBackup(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  id: SourceSaveSlotId): void {
  const backupKey = importBackupKey(id);
  const raw = storage.getItem(backupKey);
  if (raw === null) throw new Error("Aucune sauvegarde antérieure à restaurer.");
  const value: unknown = JSON.parse(raw);
  if (!record(value) || !(value.manual === null || typeof value.manual === "string")
    || !(value.auto === null || typeof value.auto === "string")) throw new Error("Copie de secours invalide.");
  const manualKey = sourceSaveSlotKey(id, "manual");
  const autoKey = sourceSaveSlotKey(id, "auto");
  const holdKey = sourceImportCloudHoldKey(id);
  const keys = [manualKey, autoKey, backupKey, holdKey];
  const before = keys.map((key) => [key, storage.getItem(key)] as const);
  try {
    setOrRemove(storage, manualKey, value.manual);
    setOrRemove(storage, autoKey, value.auto);
    storage.removeItem(backupKey);
    storage.setItem(holdKey, "1");
  } catch (error) {
    for (const [key, previous] of before) {
      try { setOrRemove(storage, key, previous); } catch { /* Keep the original failure. */ }
    }
    throw error;
  }
}

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalJson<T>(raw: string | null, parse: (value: unknown) => T): T | null {
  if (raw === null) return null;
  try { return parse(JSON.parse(raw) as unknown); } catch { return null; }
}

export function parseSourceSaveSlotSnapshot(value: unknown): SourceSaveSlotSnapshot {
  if (!record(value) || value.schemaVersion !== 1 || !Number.isSafeInteger(value.savedAt)
    || (value.savedAt as number) < 1 || typeof value.fieldShortcuts !== "string" && value.fieldShortcuts !== null) {
    throw new Error("Emplacement de sauvegarde invalide.");
  }
  const worldSave = value.worldSave === null ? null : parseSourceWorldSave(value.worldSave);
  const eventState = parseSourceEventState(value.eventState);
  const player = value.player === null ? null : parsePlayerAvatarSelection(value.player);
  const newGame = value.newGame === null ? null : parseSourceNewGameSetup(value.newGame);
  return { schemaVersion: 1, savedAt: value.savedAt as number, worldSave, eventState, player, newGame,
    fieldShortcuts: value.fieldShortcuts as string | null };
}

export function loadSourceSaveSlot(storage: Pick<Storage, "getItem">, id: SourceSaveSlotId,
  kind: SourceSaveKind): SourceSaveSlotSnapshot | null {
  return optionalJson(storage.getItem(sourceSaveSlotKey(id, kind)), parseSourceSaveSlotSnapshot);
}

export function sourceSaveSlotSummaries(storage: Pick<Storage, "getItem">): readonly SourceSaveSlotSummary[] {
  return SLOT_IDS.map((id) => ({ id, manual: loadSourceSaveSlot(storage, id, "manual"),
    auto: loadSourceSaveSlot(storage, id, "auto") }));
}

export function activeSourceSaveSlot(storage: Pick<Storage, "getItem">): SourceSaveSlotId {
  return storage.getItem(ACTIVE_SLOT_KEY) === "2" ? 2 : 1;
}

export function sourceAutoResumeSelected(storage: Pick<Storage, "getItem">, id: SourceSaveSlotId): boolean {
  return storage.getItem(AUTO_RESUME_KEY) === String(id);
}

function ignoredAutoKey(id: SourceSaveSlotId): string { return `${AUTO_IGNORED_PREFIX}.${id}`; }

/** An explicit choice of the manual save must not be undone by the startup recovery prompt. */
export function ignoreSourceAutoSave(storage: Pick<Storage, "getItem" | "setItem">,
  id: SourceSaveSlotId): void {
  const auto = loadSourceSaveSlot(storage, id, "auto");
  if (auto !== null) storage.setItem(ignoredAutoKey(id), String(auto.savedAt));
}

export function createSourceSaveSlotSnapshot(storage: Pick<Storage, "getItem">, worldSave: SourceWorldSave | null,
  eventState: SourceEventState, savedAt = Date.now()): SourceSaveSlotSnapshot {
  const coherentWorld = worldSave === null ? null : createSourceWorldSave(worldSave.mapId, worldSave.x,
    worldSave.y, worldSave.direction, savedAt, worldSave.movementMode, eventState);
  return parseSourceSaveSlotSnapshot({ schemaVersion: 1, savedAt, worldSave: coherentWorld, eventState,
    player: optionalJson(storage.getItem(PLAYER_AVATAR_ACTIVE_STORAGE_KEY), parsePlayerAvatarSelection),
    newGame: optionalJson(storage.getItem(SOURCE_NEW_GAME_STORAGE_KEY), parseSourceNewGameSetup),
    fieldShortcuts: storage.getItem(SOURCE_FIELD_SHORTCUTS_STORAGE_KEY) });
}

export function persistSourceSaveSlot(storage: Pick<Storage, "setItem">, id: SourceSaveSlotId,
  kind: SourceSaveKind, snapshot: SourceSaveSlotSnapshot): void {
  storage.setItem(sourceSaveSlotKey(id, kind), JSON.stringify(parseSourceSaveSlotSnapshot(snapshot)));
}

/** Copies legacy keys once; they remain the active working copy for the current client. */
export function initializeSourceSaveSlots(storage: Pick<Storage, "getItem" | "setItem">): SourceSaveSlotId {
  if (storage.getItem(ACTIVE_SLOT_KEY) !== null) return activeSourceSaveSlot(storage);
  const manual = optionalJson(storage.getItem(SOURCE_WORLD_SAVE_KEY), parseSourceWorldSave);
  const working = optionalJson(storage.getItem(SOURCE_EVENT_STATE_STORAGE_KEY), parseSourceEventState);
  if (manual !== null && loadSourceSaveSlot(storage, 1, "manual") === null) {
    persistSourceSaveSlot(storage, 1, "manual", createSourceSaveSlotSnapshot(storage, manual,
      manual.eventState ?? working ?? createSourceEventState(), manual.savedAt));
  }
  if (working !== null && (manual === null || JSON.stringify(working) !== JSON.stringify(manual.eventState))
    && loadSourceSaveSlot(storage, 1, "auto") === null) {
    persistSourceSaveSlot(storage, 1, "auto", createSourceSaveSlotSnapshot(storage, manual, working));
  }
  storage.setItem(ACTIVE_SLOT_KEY, "1");
  return 1;
}

function setOrRemove(storage: Pick<Storage, "setItem" | "removeItem">, key: string, value: string | null): void {
  if (value === null) storage.removeItem(key);
  else storage.setItem(key, value);
}

function installWorkingCopy(storage: Pick<Storage, "setItem" | "removeItem">,
  snapshot: SourceSaveSlotSnapshot | null): void {
  setOrRemove(storage, SOURCE_WORLD_SAVE_KEY, snapshot?.worldSave === null || snapshot === null
    ? null : JSON.stringify(snapshot.worldSave));
  setOrRemove(storage, SOURCE_EVENT_STATE_STORAGE_KEY, snapshot === null ? null : JSON.stringify(snapshot.eventState));
  setOrRemove(storage, PLAYER_AVATAR_ACTIVE_STORAGE_KEY, snapshot?.player === null || snapshot === null
    ? null : JSON.stringify(snapshot.player));
  setOrRemove(storage, SOURCE_NEW_GAME_STORAGE_KEY, snapshot?.newGame === null || snapshot === null
    ? null : JSON.stringify(snapshot.newGame));
  setOrRemove(storage, SOURCE_FIELD_SHORTCUTS_STORAGE_KEY, snapshot?.fieldShortcuts ?? null);
}

/** The app keeps its legacy active keys; switching installs a complete snapshot before reload. */
export function activateSourceSaveSlot(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  session: Pick<Storage, "removeItem">, id: SourceSaveSlotId, kind: SourceSaveKind = "manual"): void {
  const snapshot = loadSourceSaveSlot(storage, id, kind);
  if (snapshot === null && storage.getItem(sourceSaveSlotKey(id, kind)) !== null) {
    throw new Error("Sauvegarde illisible : aucun fichier n'a été modifié.");
  }
  const keys = [SOURCE_WORLD_SAVE_KEY, SOURCE_EVENT_STATE_STORAGE_KEY, PLAYER_AVATAR_ACTIVE_STORAGE_KEY,
    SOURCE_NEW_GAME_STORAGE_KEY, SOURCE_FIELD_SHORTCUTS_STORAGE_KEY, ACTIVE_SLOT_KEY, AUTO_RESUME_KEY,
    ignoredAutoKey(id)];
  const before = keys.map((key) => [key, storage.getItem(key)] as const);
  try {
    installWorkingCopy(storage, snapshot);
    storage.setItem(ACTIVE_SLOT_KEY, String(id));
    if (kind === "auto" && snapshot !== null) storage.setItem(AUTO_RESUME_KEY, String(id));
    else {
      storage.removeItem(AUTO_RESUME_KEY);
      ignoreSourceAutoSave(storage, id);
    }
  } catch (error) {
    for (const [key, value] of before) {
      try { setOrRemove(storage, key, value); } catch { /* Preserve the original storage failure. */ }
    }
    throw error;
  }
  session.removeItem(PLAYER_AVATAR_SESSION_ACTIVE_STORAGE_KEY);
  session.removeItem("pokemon-z-battle.overworld-session.v9");
  session.removeItem("pokemon-z-battle.active-coop-battle.v1");
}

/** On a cold launch of an auto branch, keep the newest auto as its active checkpoint. */
export function restoreSelectedSourceAutoSave(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  session: Pick<Storage, "removeItem">, id: SourceSaveSlotId): void {
  if (!sourceAutoResumeSelected(storage, id)) return;
  const snapshot = loadSourceSaveSlot(storage, id, "auto");
  if (snapshot !== null) {
    installWorkingCopy(storage, snapshot);
    session.removeItem(PLAYER_AVATAR_SESSION_ACTIVE_STORAGE_KEY);
  }
}

export function markSourceManualSave(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(AUTO_RESUME_KEY);
}

export function sourceAutoSaveNeedsRecovery(storage: Pick<Storage, "getItem">,
  id: SourceSaveSlotId): boolean {
  const auto = loadSourceSaveSlot(storage, id, "auto");
  const manual = loadSourceSaveSlot(storage, id, "manual");
  return auto !== null && !sourceAutoResumeSelected(storage, id)
    && auto.savedAt > Number(storage.getItem(ignoredAutoKey(id)) ?? 0)
    && (manual === null || auto.savedAt > manual.savedAt
      && JSON.stringify({ ...auto, savedAt: 0,
        worldSave: auto.worldSave === null ? null : { ...auto.worldSave, savedAt: 0 } })
      !== JSON.stringify({ ...manual, savedAt: 0,
        worldSave: manual.worldSave === null ? null : { ...manual.worldSave, savedAt: 0 } }));
}
