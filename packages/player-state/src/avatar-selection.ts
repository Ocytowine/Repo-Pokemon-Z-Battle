import { createDefaultPlayerProfile, parsePlayerProfile, type PlayerProfile } from "./profile.js";

export const PLAYER_AVATAR_SELECTION_SCHEMA_VERSION = 2 as const;
export const PLAYER_TRAINER_IDENTITY_SCHEMA_VERSION = 1 as const;
export const PLAYER_AVATAR_DRAFT_STORAGE_KEY = "pokemon-z-battle.avatar-lab-profile.v1";
export const PLAYER_AVATAR_ACTIVE_STORAGE_KEY = "pokemon-z-battle.active-player-profile.v1";
/** Surcharge propre a l'onglet, utile lorsque deux joueurs partagent la meme origine de navigateur. */
export const PLAYER_AVATAR_SESSION_ACTIVE_STORAGE_KEY = "pokemon-z-battle.session-player-profile.v1";

export interface PlayerAvatarSelection {
  readonly schemaVersion: typeof PLAYER_AVATAR_SELECTION_SCHEMA_VERSION;
  readonly avatarId: string;
  readonly profile: PlayerProfile;
  readonly trainerIdentity: PlayerTrainerIdentity;
}

/** Private persistent identity. Only its publicId and trainer name belong on a public Pokemon summary. */
export interface PlayerTrainerIdentity {
  readonly schemaVersion: typeof PLAYER_TRAINER_IDENTITY_SCHEMA_VERSION;
  readonly trainerId: number;
  readonly publicId: number;
}

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uint32(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 0xffffffff;
}

function randomUint32(): number {
  const cryptoProvider = (globalThis as unknown as {
    readonly crypto?: { getRandomValues(values: Uint32Array): Uint32Array };
  }).crypto;
  if (cryptoProvider !== undefined) {
    const values = new Uint32Array(1);
    cryptoProvider.getRandomValues(values);
    return values[0]!;
  }
  return Math.floor(Math.random() * 0x1_0000_0000);
}

export function createPlayerTrainerIdentity(trainerId = randomUint32()): PlayerTrainerIdentity {
  if (!uint32(trainerId)) throw new Error("Identifiant de Dresseur invalide.");
  return { schemaVersion: PLAYER_TRAINER_IDENTITY_SCHEMA_VERSION, trainerId, publicId: trainerId & 0xffff };
}

export function parsePlayerTrainerIdentity(value: unknown): PlayerTrainerIdentity {
  if (!record(value) || value.schemaVersion !== PLAYER_TRAINER_IDENTITY_SCHEMA_VERSION || !uint32(value.trainerId)
    || !Number.isSafeInteger(value.publicId) || (value.publicId as number) < 0 || (value.publicId as number) > 0xffff
    || value.publicId !== ((value.trainerId as number) & 0xffff)) {
    throw new Error("Identité de Dresseur invalide.");
  }
  return { schemaVersion: PLAYER_TRAINER_IDENTITY_SCHEMA_VERSION, trainerId: value.trainerId,
    publicId: value.publicId as number };
}

export function createDefaultPlayerAvatarSelection(): PlayerAvatarSelection {
  return { schemaVersion: PLAYER_AVATAR_SELECTION_SCHEMA_VERSION, avatarId: "legacy-0",
    profile: createDefaultPlayerProfile(), trainerIdentity: createPlayerTrainerIdentity() };
}

export function parsePlayerAvatarSelection(value: unknown): PlayerAvatarSelection {
  if (!record(value) || ![1, PLAYER_AVATAR_SELECTION_SCHEMA_VERSION].includes(value.schemaVersion as number)
    || typeof value.avatarId !== "string" || !/^legacy-\d+$/u.test(value.avatarId)) {
    throw new Error("Sélection d'avatar invalide.");
  }
  return { schemaVersion: PLAYER_AVATAR_SELECTION_SCHEMA_VERSION, avatarId: value.avatarId,
    profile: parsePlayerProfile(value.profile),
    trainerIdentity: value.schemaVersion === 1 ? createPlayerTrainerIdentity()
      : parsePlayerTrainerIdentity(value.trainerIdentity) };
}

export function loadPlayerAvatarSelection(storage: { getItem(key: string): string | null; removeItem(key: string): void;
  setItem?(key: string, value: string): void }, key: string,
  fallback = createDefaultPlayerAvatarSelection()): PlayerAvatarSelection {
  const raw = storage.getItem(key);
  if (raw === null) {
    storage.setItem?.(key, JSON.stringify(fallback));
    return fallback;
  }
  try {
    const parsed = parsePlayerAvatarSelection(JSON.parse(raw) as unknown);
    if (storage.setItem !== undefined && JSON.stringify(parsed) !== raw) storage.setItem(key, JSON.stringify(parsed));
    return parsed;
  }
  catch { storage.removeItem(key); return fallback; }
}

export function persistPlayerAvatarSelection(storage: { setItem(key: string, value: string): void }, key: string,
  selection: PlayerAvatarSelection): void {
  storage.setItem(key, JSON.stringify(parsePlayerAvatarSelection(selection)));
}

export function loadSessionPlayerAvatarSelection(
  session: { getItem(key: string): string | null; removeItem(key: string): void },
  persistent: { getItem(key: string): string | null; removeItem(key: string): void },
): PlayerAvatarSelection {
  return loadPlayerAvatarSelection(session, PLAYER_AVATAR_SESSION_ACTIVE_STORAGE_KEY,
    loadPlayerAvatarSelection(persistent, PLAYER_AVATAR_ACTIVE_STORAGE_KEY));
}

export function persistSessionPlayerAvatarSelection(
  session: { setItem(key: string, value: string): void },
  persistent: { setItem(key: string, value: string): void }, selection: PlayerAvatarSelection,
): void {
  persistPlayerAvatarSelection(persistent, PLAYER_AVATAR_ACTIVE_STORAGE_KEY, selection);
  persistPlayerAvatarSelection(session, PLAYER_AVATAR_SESSION_ACTIVE_STORAGE_KEY, selection);
}
