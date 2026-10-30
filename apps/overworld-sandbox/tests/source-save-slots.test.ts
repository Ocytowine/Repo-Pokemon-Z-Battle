import { describe, expect, it } from "vitest";
import { PLAYER_AVATAR_ACTIVE_STORAGE_KEY, PLAYER_AVATAR_SESSION_ACTIVE_STORAGE_KEY,
  createDefaultPlayerAvatarSelection } from "@pokemon-z-battle/player-state";
import { createSourceEventState } from "../src/source-event-state.js";
import { SOURCE_EVENT_STATE_STORAGE_KEY, SOURCE_NEW_GAME_STORAGE_KEY } from "../src/source-new-game.js";
import { SOURCE_WORLD_SAVE_KEY, createSourceGuestProgressSave, createSourceWorldSave }
  from "../src/source-world-save.js";
import { activateSourceSaveSlot, activeSourceSaveSlot, createSourceSaveSlotSnapshot, importSourceSaveSlot,
  initializeSourceSaveSlots, loadSourceSaveSlot, persistSourceSaveSlot, sourceAutoSaveNeedsRecovery,
  sourceImportBackupExists, sourceImportCloudHoldKey, restoreSourceImportBackup,
  sourceSaveSlotSummaries } from "../src/source-save-slots.js";

function storage(values = new Map<string, string>()) {
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } };
}

describe("local save slots", () => {
  it("backs up both branches before an import and restores them without touching the other slot", () => {
    const local = storage();
    const original = (money: number, savedAt: number) => ({ schemaVersion: 1 as const, savedAt,
      worldSave: null, eventState: { ...createSourceEventState(), money }, player: null,
      newGame: null, fieldShortcuts: null });
    persistSourceSaveSlot(local, 1, "manual", original(100, 1000));
    persistSourceSaveSlot(local, 1, "auto", original(200, 2000));
    persistSourceSaveSlot(local, 2, "manual", original(400, 4000));
    importSourceSaveSlot(local, 1, original(300, 3000));
    expect(loadSourceSaveSlot(local, 1, "manual")?.eventState.money).toBe(300);
    expect(loadSourceSaveSlot(local, 1, "auto")).toBeNull();
    expect(sourceImportBackupExists(local, 1)).toBe(true);
    expect(local.getItem(sourceImportCloudHoldKey(1))).toBe("1");
    restoreSourceImportBackup(local, 1);
    expect(loadSourceSaveSlot(local, 1, "manual")?.eventState.money).toBe(100);
    expect(loadSourceSaveSlot(local, 1, "auto")?.eventState.money).toBe(200);
    expect(loadSourceSaveSlot(local, 2, "manual")?.eventState.money).toBe(400);
    expect(local.getItem(sourceImportCloudHoldKey(1))).toBe("1");
  });
  it("rolls back the backup and slot when storage refuses an imported save", () => {
    const local = storage();
    const original = { schemaVersion: 1 as const, savedAt: 1000, worldSave: null,
      eventState: createSourceEventState(), player: null, newGame: null, fieldShortcuts: null };
    persistSourceSaveSlot(local, 1, "manual", original);
    const failing = { ...local, setItem: (key: string, value: string) => {
      if (key.endsWith(".1.manual")) throw new Error("quota");
      local.setItem(key, value);
    } };
    expect(() => importSourceSaveSlot(failing, 1, { ...original, savedAt: 2000 })).toThrow("quota");
    expect(loadSourceSaveSlot(local, 1, "manual")?.savedAt).toBe(1000);
    expect(sourceImportBackupExists(local, 1)).toBe(false);
    expect(local.getItem(sourceImportCloudHoldKey(1))).toBeNull();
  });
  it("migrates the existing manual save and keeps newer working progress as recovery", () => {
    const manualState = { ...createSourceEventState(), money: 100 };
    const workingState = { ...createSourceEventState(), money: 200 };
    const oldSave = createSourceWorldSave(7, 4, 8, "left", 1_000, "walk", manualState);
    const player = createDefaultPlayerAvatarSelection();
    const local = storage(new Map([
      [SOURCE_WORLD_SAVE_KEY, JSON.stringify(oldSave)],
      [SOURCE_EVENT_STATE_STORAGE_KEY, JSON.stringify(workingState)],
      [PLAYER_AVATAR_ACTIVE_STORAGE_KEY, JSON.stringify(player)],
    ]));
    expect(initializeSourceSaveSlots(local)).toBe(1);
    expect(loadSourceSaveSlot(local, 1, "manual")?.worldSave).toEqual(oldSave);
    expect(loadSourceSaveSlot(local, 1, "manual")?.eventState.money).toBe(100);
    expect(loadSourceSaveSlot(local, 1, "auto")?.eventState.money).toBe(200);
    expect(loadSourceSaveSlot(local, 1, "auto")?.worldSave?.eventState?.money).toBe(200);
    expect(loadSourceSaveSlot(local, 1, "auto")?.player).toEqual(player);
    expect(sourceAutoSaveNeedsRecovery(local, 1)).toBe(true);
    expect(local.getItem(SOURCE_EVENT_STATE_STORAGE_KEY)).toBe(JSON.stringify(workingState));
    initializeSourceSaveSlots(local);
    expect(loadSourceSaveSlot(local, 1, "manual")?.eventState.money).toBe(100);
  });

  it("switches between independent campaigns and clears session identity", () => {
    const local = storage(); const session = storage();
    const first = createSourceEventState();
    const firstSave = createSourceWorldSave(3, 1, 2, "up", 1_000, "walk", first);
    const firstPlayer = createDefaultPlayerAvatarSelection();
    local.setItem(PLAYER_AVATAR_ACTIVE_STORAGE_KEY, JSON.stringify(firstPlayer));
    persistSourceSaveSlot(local, 1, "manual", createSourceSaveSlotSnapshot(local, firstSave, first, 1_000));
    const second = { ...createSourceEventState(), money: 999 };
    const secondSave = createSourceWorldSave(9, 7, 6, "down", 2_000, "surf", second);
    const secondPlayer = { ...createDefaultPlayerAvatarSelection(), avatarId: "legacy-1" };
    local.setItem(PLAYER_AVATAR_ACTIVE_STORAGE_KEY, JSON.stringify(secondPlayer));
    persistSourceSaveSlot(local, 2, "manual", createSourceSaveSlotSnapshot(local, secondSave, second, 2_000));
    session.setItem(PLAYER_AVATAR_SESSION_ACTIVE_STORAGE_KEY, JSON.stringify(firstPlayer));
    activateSourceSaveSlot(local, session, 1);
    expect(activeSourceSaveSlot(local)).toBe(1);
    expect(JSON.parse(local.getItem(SOURCE_WORLD_SAVE_KEY)!)).toEqual(firstSave);
    expect(JSON.parse(local.getItem(PLAYER_AVATAR_ACTIVE_STORAGE_KEY)!)).toEqual(firstPlayer);
    expect(session.getItem(PLAYER_AVATAR_SESSION_ACTIVE_STORAGE_KEY)).toBeNull();
    activateSourceSaveSlot(local, session, 2);
    expect(activeSourceSaveSlot(local)).toBe(2);
    expect(JSON.parse(local.getItem(SOURCE_EVENT_STATE_STORAGE_KEY)!).money).toBe(999);
    expect(JSON.parse(local.getItem(PLAYER_AVATAR_ACTIVE_STORAGE_KEY)!).avatarId).toBe("legacy-1");
  });

  it("starts an empty second campaign without erasing the first", () => {
    const local = storage(); const session = storage();
    const first = createSourceEventState();
    persistSourceSaveSlot(local, 1, "manual", createSourceSaveSlotSnapshot(local,
      createSourceWorldSave(3, 1, 2, "up", 1_000, "walk", first), first, 1_000));
    local.setItem(SOURCE_EVENT_STATE_STORAGE_KEY, JSON.stringify(first));
    local.setItem(SOURCE_NEW_GAME_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, completed: true,
      difficulty: "classic", adventureMode: "normal", starterRegion: "kalos" }));
    activateSourceSaveSlot(local, session, 2);
    expect(local.getItem(SOURCE_EVENT_STATE_STORAGE_KEY)).toBeNull();
    expect(local.getItem(SOURCE_NEW_GAME_STORAGE_KEY)).toBeNull();
    expect(sourceSaveSlotSummaries(local)[0]?.manual?.worldSave?.mapId).toBe(3);
  });

  it("preserves an invited player's solo position in the automatic snapshot", () => {
    const local = storage();
    const prior = createSourceWorldSave(7, 4, 8, "left", 1_000, "walk", createSourceEventState());
    const current = { ...createSourceEventState(), money: 500 };
    const guestSave = createSourceGuestProgressSave(prior, current, 2_000);
    persistSourceSaveSlot(local, 1, "auto", createSourceSaveSlotSnapshot(local, guestSave, current, 2_000));
    expect(loadSourceSaveSlot(local, 1, "auto")?.worldSave).toMatchObject({ mapId: 7, x: 4, y: 8 });
    expect(loadSourceSaveSlot(local, 1, "auto")?.eventState.money).toBe(500);
  });

  it("does not erase malformed slot data during inspection or switching", () => {
    const local = storage(new Map([["pokemon-z-battle.source-save-slot.v1.2.manual", "broken"]]));
    expect(loadSourceSaveSlot(local, 2, "manual")).toBeNull();
    expect(() => activateSourceSaveSlot(local, storage(), 2)).toThrow("Sauvegarde illisible");
    expect(local.getItem("pokemon-z-battle.source-save-slot.v1.2.manual")).toBe("broken");
  });

  it("keeps the manual branch available after resuming an automatic save", () => {
    const local = storage(); const session = storage();
    const manual = { ...createSourceEventState(), money: 100 };
    const automatic = { ...createSourceEventState(), money: 200 };
    const position = createSourceWorldSave(3, 5, 8, "up", 1_000, "walk", manual);
    persistSourceSaveSlot(local, 1, "manual", createSourceSaveSlotSnapshot(local, position, manual, 1_000));
    persistSourceSaveSlot(local, 1, "auto", createSourceSaveSlotSnapshot(local, position, automatic, 2_000));
    expect(sourceAutoSaveNeedsRecovery(local, 1)).toBe(true);
    activateSourceSaveSlot(local, session, 1, "auto");
    expect(sourceAutoSaveNeedsRecovery(local, 1)).toBe(false);
    expect(JSON.parse(local.getItem(SOURCE_WORLD_SAVE_KEY)!).eventState.money).toBe(200);
    activateSourceSaveSlot(local, session, 1, "manual");
    expect(JSON.parse(local.getItem(SOURCE_WORLD_SAVE_KEY)!).eventState.money).toBe(100);
    expect(loadSourceSaveSlot(local, 1, "auto")?.eventState.money).toBe(200);
    expect(sourceAutoSaveNeedsRecovery(local, 1)).toBe(false);
    persistSourceSaveSlot(local, 1, "auto", createSourceSaveSlotSnapshot(local, position,
      { ...automatic, money: 300 }, 3_000));
    expect(sourceAutoSaveNeedsRecovery(local, 1)).toBe(true);
  });
});
