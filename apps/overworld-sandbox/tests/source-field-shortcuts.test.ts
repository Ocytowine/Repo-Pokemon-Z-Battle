import { describe, expect, it } from "vitest";
import { loadSourceFieldShortcuts, persistSourceFieldShortcuts, SOURCE_FIELD_SHORTCUTS_STORAGE_KEY,
  sourceFieldShortcutPresentation, toggleSourceFieldShortcut } from "../src/source-field-shortcuts.js";

function storage(initial: string | null = null): Storage {
  const values = new Map<string, string>();
  if (initial !== null) values.set(SOURCE_FIELD_SHORTCUTS_STORAGE_KEY, initial);
  return { get length() { return values.size; }, clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); } };
}

describe("raccourcis de terrain", () => {
  it("préserve la boussole et migre une ancienne canne favorite", () => {
    expect(loadSourceFieldShortcuts(storage(), false)).toEqual(["compass"]);
    expect(loadSourceFieldShortcuts(storage(), true)).toEqual(["compass", "fishing"]);
  });

  it("normalise l'ordre et ignore les entrées inconnues", () => {
    const target = storage('["mount","inconnu","truth-lens","mount"]');
    expect(loadSourceFieldShortcuts(target)).toEqual(["truth-lens", "mount"]);
    expect(persistSourceFieldShortcuts(target, ["mount", "compass", "mount"]))
      .toEqual(["compass", "mount"]);
  });

  it("ajoute et retire un raccourci sans modifier les autres", () => {
    expect(toggleSourceFieldShortcut(["compass"], "truth-lens", true))
      .toEqual(["compass", "truth-lens"]);
    expect(toggleSourceFieldShortcut(["compass", "truth-lens"], "compass", false))
      .toEqual(["truth-lens"]);
  });

  it("garde les actions permanentes visibles quand la marche bloque une action contextuelle", () => {
    const persistentWhileWalking = { selected: true, unlocked: true, contextAvailable: true, blocked: false };
    const contextualWhileWalking = { ...persistentWhileWalking, blocked: true };

    expect(sourceFieldShortcutPresentation("truth-lens", persistentWhileWalking))
      .toEqual({ visible: true, enabled: true });
    expect(sourceFieldShortcutPresentation("mount", persistentWhileWalking))
      .toEqual({ visible: true, enabled: true });
    expect(sourceFieldShortcutPresentation("fishing", contextualWhileWalking))
      .toEqual({ visible: false, enabled: false });
  });
});
