export const SOURCE_FIELD_SHORTCUTS_STORAGE_KEY = "pokemon-z-battle.field-shortcuts.v1";

export type SourceFieldShortcutId = "compass" | "truth-lens" | "fishing" | "mount";

export const SOURCE_FIELD_SHORTCUT_ORDER: readonly SourceFieldShortcutId[] = [
  "compass", "truth-lens", "fishing", "mount",
];

export interface SourceFieldShortcutPresentation {
  visible: boolean;
  enabled: boolean;
}

export function sourceFieldShortcutPresentation(id: SourceFieldShortcutId,
  options: { selected: boolean; unlocked: boolean; contextAvailable: boolean; blocked: boolean },
): SourceFieldShortcutPresentation {
  const persistent = id !== "fishing";
  const visible = options.selected && options.unlocked
    && (persistent || options.contextAvailable && !options.blocked);
  return { visible, enabled: visible && !options.blocked };
}

function isSourceFieldShortcutId(value: unknown): value is SourceFieldShortcutId {
  return typeof value === "string" && SOURCE_FIELD_SHORTCUT_ORDER.includes(value as SourceFieldShortcutId);
}

/** Préférence locale uniquement : aucune donnée de progression ou Coop n'est exposée. */
export function loadSourceFieldShortcuts(storage: Pick<Storage, "getItem">,
  legacyFishingShortcut = false): readonly SourceFieldShortcutId[] {
  const raw = storage.getItem(SOURCE_FIELD_SHORTCUTS_STORAGE_KEY);
  if (raw === null) return ["compass", ...(legacyFishingShortcut ? ["fishing" as const] : [])];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return ["compass"];
    const selected = new Set(parsed.filter(isSourceFieldShortcutId));
    return SOURCE_FIELD_SHORTCUT_ORDER.filter((id) => selected.has(id));
  } catch {
    return ["compass"];
  }
}

export function persistSourceFieldShortcuts(storage: Pick<Storage, "setItem">,
  shortcuts: readonly SourceFieldShortcutId[]): readonly SourceFieldShortcutId[] {
  const selected = new Set(shortcuts.filter(isSourceFieldShortcutId));
  const normalized = SOURCE_FIELD_SHORTCUT_ORDER.filter((id) => selected.has(id));
  storage.setItem(SOURCE_FIELD_SHORTCUTS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function toggleSourceFieldShortcut(shortcuts: readonly SourceFieldShortcutId[],
  id: SourceFieldShortcutId, selected: boolean): readonly SourceFieldShortcutId[] {
  const next = new Set(shortcuts);
  if (selected) next.add(id);
  else next.delete(id);
  return SOURCE_FIELD_SHORTCUT_ORDER.filter((candidate) => next.has(candidate));
}
