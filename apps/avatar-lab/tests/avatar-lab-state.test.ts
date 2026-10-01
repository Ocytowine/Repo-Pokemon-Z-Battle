import { describe, expect, it, vi } from "vitest";
import { ACTIVE_AVATAR_STORAGE_KEY, AVATAR_LAB_STORAGE_KEY, applyAvatarLabState, createAvatarLabState,
  loadActiveAvatarState, loadAvatarLabState, parseAvatarLabState, persistAvatarLabState } from "../src/avatar-lab-state.js";

describe("avatar lab state", () => {
  it("persists separately from every story save", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key) };
    const state = createAvatarLabState();
    persistAvatarLabState(storage, state);
    expect([...values.keys()]).toEqual([AVATAR_LAB_STORAGE_KEY]);
    expect(loadAvatarLabState(storage)).toEqual(state);
  });

  it("discards malformed local data", () => {
    const removeItem = vi.fn();
    expect(loadAvatarLabState({ getItem: () => "{}", removeItem })).toEqual(createAvatarLabState());
    expect(removeItem).toHaveBeenCalledWith(AVATAR_LAB_STORAGE_KEY);
    expect(() => parseAvatarLabState({ ...createAvatarLabState(), avatarId: "../../asset" })).toThrow("laboratoire");
  });

  it("only changes the active profile when Apply is requested", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key) };
    const draft = { ...createAvatarLabState(), avatarId: "legacy-3" };
    persistAvatarLabState(storage, draft);
    expect(values.has(ACTIVE_AVATAR_STORAGE_KEY)).toBe(false);
    applyAvatarLabState(storage, draft);
    expect(loadActiveAvatarState(storage)).toEqual(draft);
    expect([...values.keys()]).toEqual([AVATAR_LAB_STORAGE_KEY, ACTIVE_AVATAR_STORAGE_KEY]);
  });
});
