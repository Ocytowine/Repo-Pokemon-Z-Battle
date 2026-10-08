export const SOURCE_DEV_SETTINGS_KEY = "pokemon-z-battle.dev-settings.v1";

export interface SourceDevSettings {
  readonly levelCapOverride: number | null;
}

export const DEFAULT_SOURCE_DEV_SETTINGS: SourceDevSettings = { levelCapOverride: null };

export function parseSourceDevSettings(value: unknown): SourceDevSettings {
  if (typeof value !== "object" || value === null) return DEFAULT_SOURCE_DEV_SETTINGS;
  const levelCapOverride = (value as { levelCapOverride?: unknown }).levelCapOverride;
  return { levelCapOverride: Number.isSafeInteger(levelCapOverride) && Number(levelCapOverride) >= 1
      && Number(levelCapOverride) <= 100 ? Number(levelCapOverride) : null };
}

export function loadSourceDevSettings(storage: Pick<Storage, "getItem">): SourceDevSettings {
  try {
    const stored = storage.getItem(SOURCE_DEV_SETTINGS_KEY);
    return stored === null ? DEFAULT_SOURCE_DEV_SETTINGS : parseSourceDevSettings(JSON.parse(stored) as unknown);
  } catch {
    return DEFAULT_SOURCE_DEV_SETTINGS;
  }
}

export function persistSourceDevSettings(storage: Pick<Storage, "setItem">, settings: SourceDevSettings): void {
  storage.setItem(SOURCE_DEV_SETTINGS_KEY, JSON.stringify(settings));
}

export function sourceDevLevelCap(storyLevelCap: number, settings: SourceDevSettings): number {
  return settings.levelCapOverride ?? storyLevelCap;
}
