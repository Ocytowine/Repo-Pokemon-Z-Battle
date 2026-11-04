export const SOURCE_FIELD_SHORTCUTS_STORAGE_KEY = "pokemon-z-battle.field-shortcuts.v1";

export type SourceFieldShortcutId = "compass" | "truth-lens" | "fishing" | "mount"
  | "incubator" | "shiny-charm" | "black-flute" | "white-flute"
  | "blue-flute" | "poke-flute" | "red-flute" | "yellow-flute";

export const SOURCE_EXTRA_SHORTCUT_ITEMS = {
  incubator: "INCUBADORA", "shiny-charm": "SHINYCHARM",
  "black-flute": "BLACKFLUTE", "white-flute": "WHITEFLUTE",
  "blue-flute": "BLUEFLUTE", "poke-flute": "POKEFLUTE",
  "red-flute": "REDFLUTE", "yellow-flute": "YELLOWFLUTE",
} as const satisfies Partial<Record<SourceFieldShortcutId, string>>;

export const SOURCE_EXTRA_SHORTCUT_ORDER = ["incubator", "shiny-charm", "black-flute",
  "white-flute", "blue-flute", "poke-flute", "red-flute", "yellow-flute"] as const;

/** Source Bag entries that can configure a terrain button. Mount items unlock a movement action. */
export function sourceItemFieldShortcut(itemId: string): SourceFieldShortcutId | null {
  if (itemId === "DEXNAV") return "compass";
  if (itemId === "LENSOFTRUTH") return "truth-lens";
  if (itemId === "OLDROD" || itemId === "GOODROD" || itemId === "SUPERROD") return "fishing";
  if (/^BICYCLE(?:[1-7])?$/u.test(itemId)) return "mount";
  for (const id of SOURCE_EXTRA_SHORTCUT_ORDER) {
    if (SOURCE_EXTRA_SHORTCUT_ITEMS[id] === itemId) return id;
  }
  return null;
}

export const SOURCE_FIELD_SHORTCUT_ORDER: readonly SourceFieldShortcutId[] = [
  "compass", "truth-lens", "fishing", "mount", ...SOURCE_EXTRA_SHORTCUT_ORDER,
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
