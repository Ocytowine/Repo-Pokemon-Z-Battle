import { describe, expect, it, vi } from "vitest";
import { AVATAR_LAB_STORAGE_KEY, createAvatarLabState, loadAvatarLabState, parseAvatarLabState,
  persistAvatarLabState } from "../src/avatar-lab-state.js";

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
});
