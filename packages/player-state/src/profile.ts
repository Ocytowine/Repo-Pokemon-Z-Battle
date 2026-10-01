export const PLAYER_PROFILE_SCHEMA_VERSION = 1 as const;

export type PlayerPronouns = "masculine" | "feminine" | "neutral";

export interface PlayerProfile {
  readonly schemaVersion: typeof PLAYER_PROFILE_SCHEMA_VERSION;
  readonly displayName: string;
  readonly pronouns: PlayerPronouns;
  readonly bodyModel: string;
  readonly skinTone: string;
  readonly hairStyle: string;
  readonly hairColor: string;
  readonly outfit: string;
  readonly colors: {
    readonly primary: string;
    readonly secondary: string;
    readonly accent: string;
  };
}

const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function identifier(value: unknown): value is string {
  return typeof value === "string" && value.length <= 48 && IDENTIFIER.test(value);
}

export function createDefaultPlayerProfile(): PlayerProfile {
  return { schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION, displayName: "Joueur", pronouns: "neutral",
    bodyModel: "legacy-masculine", skinTone: "classic", hairStyle: "legacy", hairColor: "legacy-classic",
    outfit: "kalos-default", colors: { primary: "navy", secondary: "gold", accent: "red" } };
}

export function parsePlayerProfile(value: unknown): PlayerProfile {
  if (!record(value) || value.schemaVersion !== PLAYER_PROFILE_SCHEMA_VERSION
    || typeof value.displayName !== "string" || value.displayName.trim() === "" || value.displayName.length > 12
    || !["masculine", "feminine", "neutral"].includes(String(value.pronouns))
    || !identifier(value.bodyModel) || !identifier(value.skinTone) || !identifier(value.hairStyle)
    || !identifier(value.hairColor) || !identifier(value.outfit) || !record(value.colors)
    || !identifier(value.colors.primary) || !identifier(value.colors.secondary) || !identifier(value.colors.accent)) {
    throw new Error("Profil joueur invalide.");
  }
  return { schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION, displayName: value.displayName.trim(),
    pronouns: value.pronouns as PlayerPronouns, bodyModel: value.bodyModel, skinTone: value.skinTone,
    hairStyle: value.hairStyle, hairColor: value.hairColor, outfit: value.outfit,
    colors: { primary: value.colors.primary, secondary: value.colors.secondary, accent: value.colors.accent } };
}
