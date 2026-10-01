import { createDefaultPlayerProfile, parsePlayerProfile, type PlayerProfile } from "@pokemon-z-battle/player-state";

export const AVATAR_LAB_STORAGE_KEY = "pokemon-z-battle.avatar-lab-profile.v1";
export const AVATAR_LAB_STATE_VERSION = 1 as const;

export interface AvatarLabState {
  readonly schemaVersion: typeof AVATAR_LAB_STATE_VERSION;
  readonly avatarId: string;
  readonly profile: PlayerProfile;
}

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createAvatarLabState(): AvatarLabState {
  return { schemaVersion: AVATAR_LAB_STATE_VERSION, avatarId: "legacy-0", profile: createDefaultPlayerProfile() };
}

export function parseAvatarLabState(value: unknown): AvatarLabState {
  if (!record(value) || value.schemaVersion !== AVATAR_LAB_STATE_VERSION
    || typeof value.avatarId !== "string" || !/^legacy-\d+$/u.test(value.avatarId)) {
    throw new Error("État du laboratoire d'avatar invalide.");
  }
  return { schemaVersion: AVATAR_LAB_STATE_VERSION, avatarId: value.avatarId,
    profile: parsePlayerProfile(value.profile) };
}

export function loadAvatarLabState(storage: Pick<Storage, "getItem" | "removeItem">): AvatarLabState {
  const raw = storage.getItem(AVATAR_LAB_STORAGE_KEY);
  if (raw === null) return createAvatarLabState();
  try { return parseAvatarLabState(JSON.parse(raw) as unknown); }
  catch { storage.removeItem(AVATAR_LAB_STORAGE_KEY); return createAvatarLabState(); }
}

export function persistAvatarLabState(storage: Pick<Storage, "setItem">, state: AvatarLabState): void {
  storage.setItem(AVATAR_LAB_STORAGE_KEY, JSON.stringify(parseAvatarLabState(state)));
}
