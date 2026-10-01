import { createDefaultPlayerProfile, parsePlayerProfile, type PlayerProfile } from "@pokemon-z-battle/player-state";

export const NETWORK_PLAYER_PROFILE_VERSION = 1 as const;

/**
 * Public cosmetic identity that may eventually be attached to a room player.
 * It intentionally contains neither story state nor party data.
 */
export interface NetworkPlayerProfile {
  readonly version: typeof NETWORK_PLAYER_PROFILE_VERSION;
  readonly visualPreset: string;
  readonly profile: PlayerProfile;
}

const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const PROFILE_KEYS = ["bodyModel", "colors", "displayName", "hairColor", "hairStyle", "outfit", "pronouns", "schemaVersion", "skinTone"] as const;
const COLOR_KEYS = ["accent", "primary", "secondary"] as const;

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}

export function parseNetworkPlayerProfile(value: unknown): NetworkPlayerProfile {
  if (!record(value) || !exactKeys(value, ["profile", "version", "visualPreset"])
    || value.version !== NETWORK_PLAYER_PROFILE_VERSION
    || typeof value.visualPreset !== "string" || value.visualPreset.length > 48 || !IDENTIFIER.test(value.visualPreset)
    || !record(value.profile) || !exactKeys(value.profile, PROFILE_KEYS)
    || !record(value.profile.colors) || !exactKeys(value.profile.colors, COLOR_KEYS)) {
    throw new Error("Profil réseau joueur invalide.");
  }

  try {
    return { version: NETWORK_PLAYER_PROFILE_VERSION, visualPreset: value.visualPreset,
      profile: parsePlayerProfile(value.profile) };
  } catch {
    throw new Error("Profil réseau joueur invalide.");
  }
}

export function createNetworkPlayerProfile(visualPreset: string, profile: PlayerProfile): NetworkPlayerProfile {
  return parseNetworkPlayerProfile({ version: NETWORK_PLAYER_PROFILE_VERSION, visualPreset, profile });
}

export function createDefaultNetworkPlayerProfile(): NetworkPlayerProfile {
  return createNetworkPlayerProfile("legacy-0", createDefaultPlayerProfile());
}
