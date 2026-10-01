import { createDefaultPlayerProfile, parsePlayerProfile, type PlayerProfile } from "./profile.js";

export const PLAYER_AVATAR_SELECTION_SCHEMA_VERSION = 1 as const;
export const PLAYER_AVATAR_DRAFT_STORAGE_KEY = "pokemon-z-battle.avatar-lab-profile.v1";
export const PLAYER_AVATAR_ACTIVE_STORAGE_KEY = "pokemon-z-battle.active-player-profile.v1";

export interface PlayerAvatarSelection {
  readonly schemaVersion: typeof PLAYER_AVATAR_SELECTION_SCHEMA_VERSION;
  readonly avatarId: string;
  readonly profile: PlayerProfile;
}

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createDefaultPlayerAvatarSelection(): PlayerAvatarSelection {
  return { schemaVersion: PLAYER_AVATAR_SELECTION_SCHEMA_VERSION, avatarId: "legacy-0", profile: createDefaultPlayerProfile() };
}

export function parsePlayerAvatarSelection(value: unknown): PlayerAvatarSelection {
  if (!record(value) || value.schemaVersion !== PLAYER_AVATAR_SELECTION_SCHEMA_VERSION
    || typeof value.avatarId !== "string" || !/^legacy-\d+$/u.test(value.avatarId)) {
    throw new Error("Sélection d'avatar invalide.");
  }
  return { schemaVersion: PLAYER_AVATAR_SELECTION_SCHEMA_VERSION, avatarId: value.avatarId,
    profile: parsePlayerProfile(value.profile) };
}

export function loadPlayerAvatarSelection(storage: { getItem(key: string): string | null; removeItem(key: string): void }, key: string,
  fallback = createDefaultPlayerAvatarSelection()): PlayerAvatarSelection {
  const raw = storage.getItem(key); if (raw === null) return fallback;
  try { return parsePlayerAvatarSelection(JSON.parse(raw) as unknown); }
  catch { storage.removeItem(key); return fallback; }
}

export function persistPlayerAvatarSelection(storage: { setItem(key: string, value: string): void }, key: string,
  selection: PlayerAvatarSelection): void {
  storage.setItem(key, JSON.stringify(parsePlayerAvatarSelection(selection)));
}
