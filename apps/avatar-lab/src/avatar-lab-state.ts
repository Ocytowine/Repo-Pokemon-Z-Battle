import { createDefaultPlayerAvatarSelection, loadPlayerAvatarSelection, parsePlayerAvatarSelection,
  persistPlayerAvatarSelection, PLAYER_AVATAR_ACTIVE_STORAGE_KEY, PLAYER_AVATAR_DRAFT_STORAGE_KEY,
  type PlayerAvatarSelection } from "@pokemon-z-battle/player-state";

export const AVATAR_LAB_STORAGE_KEY = PLAYER_AVATAR_DRAFT_STORAGE_KEY;
export const ACTIVE_AVATAR_STORAGE_KEY = PLAYER_AVATAR_ACTIVE_STORAGE_KEY;
export const AVATAR_LAB_STATE_VERSION = 1 as const;

export type AvatarLabState = PlayerAvatarSelection;

export function createAvatarLabState(): AvatarLabState {
  return createDefaultPlayerAvatarSelection();
}

export function parseAvatarLabState(value: unknown): AvatarLabState {
  try { return parsePlayerAvatarSelection(value); }
  catch { throw new Error("État du laboratoire d'avatar invalide."); }
}

export function loadAvatarLabState(storage: Pick<Storage, "getItem" | "removeItem">): AvatarLabState {
  return loadPlayerAvatarSelection(storage, AVATAR_LAB_STORAGE_KEY);
}

export function persistAvatarLabState(storage: Pick<Storage, "setItem">, state: AvatarLabState): void {
  persistPlayerAvatarSelection(storage, AVATAR_LAB_STORAGE_KEY, state);
}

export function loadActiveAvatarState(storage: Pick<Storage, "getItem" | "removeItem">): AvatarLabState {
  return loadPlayerAvatarSelection(storage, ACTIVE_AVATAR_STORAGE_KEY);
}

export function applyAvatarLabState(storage: Pick<Storage, "setItem">, state: AvatarLabState): void {
  persistPlayerAvatarSelection(storage, ACTIVE_AVATAR_STORAGE_KEY, state);
}
