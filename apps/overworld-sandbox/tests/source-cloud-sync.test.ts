import { describe, expect, it } from "vitest";
import { createDefaultPlayerAvatarSelection, createPersistentPokemonMetadata } from "@pokemon-z-battle/player-state";
import { createSourceEventState } from "../src/source-event-state.js";
import { createSourceWorldSave } from "../src/source-world-save.js";
import { cloudAutomaticUploadDelay, CloudSaveConflict, keepLocalCloudSave, linkCloudAccount, recoverCloudSave,
  syncCloudSaves, type CloudSaveApi, type CloudSaveHead } from "../src/source-cloud-sync.js";
import { importSourceSaveSlot, loadSourceSaveSlot, persistSourceSaveSlot, sourceImportCloudHoldKey,
  type SourceSaveKind, type SourceSaveSlotId,
  type SourceSaveSlotSnapshot } from "../src/source-save-slots.js";

function storage() {
  const entries = new Map<string, string>();
  return { getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); } };
}

function snapshot(savedAt: number, money: number): SourceSaveSlotSnapshot {
  return { schemaVersion: 1, savedAt, worldSave: null,
    eventState: { ...createSourceEventState(), money }, player: null, newGame: null, fieldShortcuts: null };
}

function fakeApi(): CloudSaveApi {
  const saves = new Map<string, { head: CloudSaveHead; snapshot: SourceSaveSlotSnapshot }>();
  let sequence = 0;
  const key = (slot: SourceSaveSlotId, kind: SourceSaveKind) => `${slot}.${kind}`;
  return {
    async list() { return Array.from(saves.values(), (value) => value.head); },
    async get(slot, kind) {
      const value = saves.get(key(slot, kind));
      if (!value) throw new Error("missing");
      return value;
    },
    async put(slot, kind, expectedRevisionId, value) {
      const current = saves.get(key(slot, kind));
      if ((current?.head.revisionId ?? null) !== expectedRevisionId) throw new CloudSaveConflict();
      const head: CloudSaveHead = { slotId: slot, kind, revisionId: `revision-${++sequence}`, savedAt: value.savedAt };
      saves.set(key(slot, kind), { head, snapshot: structuredClone(value) });
      return head;
    },
  };
}

describe("cloud save synchronization", () => {
  it("holds an imported slot locally until the player explicitly synchronizes", async () => {
    const local = storage(); const api = fakeApi();
    linkCloudAccount(local, "tester@example.org");
    importSourceSaveSlot(local, 1, snapshot(1000, 777));
    expect((await syncCloudSaves(local, "tester@example.org", api))
      .find((item) => item.slot === 1 && item.kind === "manual")?.state).toBe("pending");
    expect(await api.list()).toHaveLength(0);
    await syncCloudSaves(local, "tester@example.org", api, true, true);
    expect(await api.list()).toHaveLength(1);
    expect(local.getItem(sourceImportCloudHoldKey(1))).toBeNull();
  });
  it("restores a complete personal snapshot with inventory, progression and Pokemon collections", async () => {
    const local = storage(); const restored = storage(); const api = fakeApi();
    const pokemon = (id: string) => ({ id, species: "PIKACHU", nickname: null, level: 12, experience: 900,
      stats: { maxHp: 35, attack: 20, defense: 16, specialAttack: 19, specialDefense: 18, speed: 28 },
      hp: 20, majorStatus: null, ability: "STATIC", heldItem: null,
      moves: [{ internalName: "TACKLE", pp: 30, maxPp: 35 }],
      metadata: createPersistentPokemonMetadata(id, "PIKACHU", 12) });
    const eventState = { ...createSourceEventState(), switches: { "42": true }, variables: { "99": 2 },
      selfSwitches: { "3:8:A": true }, inventory: { POKERIDER: 1, POTION: 8 }, money: 4321,
      party: { schemaVersion: 1 as const, activeIndex: 0, members: [pokemon("team-1")] },
      ranch: { schemaVersion: 1 as const, members: [pokemon("box-1")] },
      fieldItemEffects: { ...createSourceEventState().fieldItemEffects, repelSteps: 20 } };
    const original: SourceSaveSlotSnapshot = { schemaVersion: 1, savedAt: 1_000,
      worldSave: createSourceWorldSave(3, 10, 11, "down", 1_000, "walk", eventState),
      eventState, player: createDefaultPlayerAvatarSelection(), newGame: null,
      fieldShortcuts: '["mount"]' };
    linkCloudAccount(local, "tester@example.org");
    linkCloudAccount(restored, "tester@example.org");
    persistSourceSaveSlot(local, 1, "manual", original);
    const expected = loadSourceSaveSlot(local, 1, "manual");
    expect((await syncCloudSaves(local, "tester@example.org", api))
      .find((item) => item.slot === 1 && item.kind === "manual")?.state).toBe("uploaded");
    await recoverCloudSave(restored, "tester@example.org", api, 1, "manual");
    expect(loadSourceSaveSlot(restored, 1, "manual")).toEqual(expected);
  });

  it("delays automatic uploads for ten minutes while leaving manual uploads immediate", async () => {
    expect(cloudAutomaticUploadDelay(100_000, 101_000)).toBe(599_000);
    expect(cloudAutomaticUploadDelay(100_000, 700_000)).toBe(4_000);
    expect(cloudAutomaticUploadDelay(0, 101_000)).toBe(4_000);
    const local = storage(); const api = fakeApi();
    linkCloudAccount(local, "tester@example.org");
    persistSourceSaveSlot(local, 1, "manual", snapshot(1000, 10));
    persistSourceSaveSlot(local, 1, "auto", snapshot(2000, 20));
    const first = await syncCloudSaves(local, "tester@example.org", api, false);
    expect(first.find((item) => item.kind === "manual")?.state).toBe("uploaded");
    expect(first.find((item) => item.kind === "auto")?.state).toBe("pending");
    expect((await api.list()).map((head) => head.kind)).toEqual(["manual"]);
    await syncCloudSaves(local, "tester@example.org", api, true);
    persistSourceSaveSlot(local, 1, "auto", snapshot(3000, 30));
    expect((await syncCloudSaves(local, "tester@example.org", api, false))
      .find((item) => item.kind === "auto")?.state).toBe("pending");
    expect((await api.get(1, "auto")).snapshot.eventState.money).toBe(20);
    await syncCloudSaves(local, "tester@example.org", api, true);
    expect((await api.get(1, "auto")).snapshot.eventState.money).toBe(30);
  });

  it("uploads each slot independently and rejects a different linked account", async () => {
    const local = storage(); const api = fakeApi();
    linkCloudAccount(local, "first@example.org");
    persistSourceSaveSlot(local, 1, "manual", snapshot(1000, 10));
    persistSourceSaveSlot(local, 2, "auto", snapshot(2000, 20));
    const first = await syncCloudSaves(local, "first@example.org", api);
    expect(first.filter((item) => item.state === "uploaded")).toHaveLength(2);
    expect((await syncCloudSaves(local, "first@example.org", api)).filter((item) => item.state === "saved")).toHaveLength(2);
    expect(() => linkCloudAccount(local, "second@example.org")).toThrow();
  });

  it("preserves both versions when another device advances the cloud", async () => {
    const first = storage(); const second = storage(); const api = fakeApi();
    linkCloudAccount(first, "tester@example.org");
    linkCloudAccount(second, "tester@example.org");
    persistSourceSaveSlot(first, 1, "manual", snapshot(1000, 10));
    await syncCloudSaves(first, "tester@example.org", api);
    await recoverCloudSave(second, "tester@example.org", api, 1, "manual");
    persistSourceSaveSlot(first, 1, "manual", snapshot(2000, 20));
    await syncCloudSaves(first, "tester@example.org", api);
    persistSourceSaveSlot(second, 1, "manual", snapshot(3000, 30));
    const result = await syncCloudSaves(second, "tester@example.org", api);
    expect(result.find((item) => item.slot === 1 && item.kind === "manual")?.state).toBe("conflict");
    expect(loadSourceSaveSlot(second, 1, "manual")?.eventState.money).toBe(30);
    expect((await api.get(1, "manual")).snapshot.eventState.money).toBe(20);
    await keepLocalCloudSave(second, "tester@example.org", api, 1, "manual");
    expect((await api.get(1, "manual")).snapshot.eventState.money).toBe(30);
  });

  it("shows a cloud-only save without replacing an empty local slot", async () => {
    const local = storage(); const api = fakeApi();
    linkCloudAccount(local, "tester@example.org");
    await api.put(2, "auto", null, snapshot(3000, 50));
    const result = await syncCloudSaves(local, "tester@example.org", api);
    expect(result.find((item) => item.slot === 2 && item.kind === "auto")?.state).toBe("cloud-only");
    expect(loadSourceSaveSlot(local, 2, "auto")).toBeNull();
    await recoverCloudSave(local, "tester@example.org", api, 2, "auto");
    expect(loadSourceSaveSlot(local, 2, "auto")?.eventState.money).toBe(50);
  });
});
