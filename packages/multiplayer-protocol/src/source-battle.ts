import type { SharedBattleFormat } from "@pokemon-z-battle/battle-engine";

export interface SourceBattleRewardOpponent {
  readonly memberId: string;
  readonly species: string;
  readonly level: number;
  readonly baseExperience: number;
}

export interface SourceBattleExperiencePolicy {
  readonly levelCap: number;
  readonly experienceDisabled: boolean;
  readonly boostTenPercent: boolean;
  readonly boostTwentyPercent: boolean;
}

/** Public, bounded facts required to present and eventually settle a Pokemon Z battle. */
export interface SourceBattleContext {
  readonly origin: "source-wild" | "source-trainer";
  readonly mapId: number;
  readonly format: SharedBattleFormat;
  readonly escapable: boolean;
  readonly narrativeOwnerId: string;
  readonly presentation: {
    readonly battlebackId: string;
    readonly battleMusicId: string | null;
    readonly victoryMusicId: string | null;
    readonly opponentTrainer: { readonly id: number; readonly name: string } | null;
  };
  readonly rewards: {
    readonly opponents: readonly SourceBattleRewardOpponent[];
    readonly trainerBaseMoney: number | null;
    readonly experience: SourceBattleExperiencePolicy;
  };
  readonly continuation: "pending-encounter" | "trainer-sequence";
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function integer(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

const IDENTIFIER = /^[A-Za-z0-9_-]{1,64}$/u;

function identifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function logicalAsset(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128
    && !value.includes("/") && !value.includes("\\") && !value.includes("..");
}

function optionalLogicalAsset(value: unknown): value is string | null {
  return value === null || logicalAsset(value);
}

export function parseSourceBattleContext(value: unknown): SourceBattleContext {
  if (!record(value) || !exact(value, ["origin", "mapId", "format", "escapable", "narrativeOwnerId",
    "presentation", "rewards", "continuation"])
    || !["source-wild", "source-trainer"].includes(String(value.origin))
    || !integer(value.mapId, 1, 999_999) || !["single", "double"].includes(String(value.format))
    || typeof value.escapable !== "boolean" || !identifier(value.narrativeOwnerId)
    || !["pending-encounter", "trainer-sequence"].includes(String(value.continuation))) {
    throw new Error("Contexte de combat source invalide.");
  }
  const presentation = value.presentation;
  const rewards = value.rewards;
  if (!record(presentation) || !exact(presentation,
    ["battlebackId", "battleMusicId", "victoryMusicId", "opponentTrainer"])
    || !logicalAsset(presentation.battlebackId) || !optionalLogicalAsset(presentation.battleMusicId)
    || !optionalLogicalAsset(presentation.victoryMusicId)) throw new Error("Présentation de combat source invalide.");
  const trainer = presentation.opponentTrainer;
  if (trainer !== null && (!record(trainer) || !exact(trainer, ["id", "name"])
    || !integer(trainer.id, 0, 999_999) || typeof trainer.name !== "string"
    || trainer.name.length < 1 || trainer.name.length > 128)) throw new Error("Dresseur source invalide.");
  if (value.origin === "source-wild" && (trainer !== null || value.continuation !== "pending-encounter")
    || value.origin === "source-trainer" && (trainer === null || value.escapable || value.continuation !== "trainer-sequence")) {
    throw new Error("Origine de combat source incohérente.");
  }
  if (!record(rewards) || !exact(rewards, ["opponents", "trainerBaseMoney", "experience"])
    || !Array.isArray(rewards.opponents) || rewards.opponents.length < 1 || rewards.opponents.length > 6
    || rewards.trainerBaseMoney !== null && !integer(rewards.trainerBaseMoney, 0, 999_999)
    || value.origin === "source-wild" && rewards.trainerBaseMoney !== null
    || value.origin === "source-trainer" && rewards.trainerBaseMoney === null) {
    throw new Error("Récompenses de combat source invalides.");
  }
  const opponents = rewards.opponents;
  if (!opponents.every((opponent) => record(opponent) && exact(opponent,
    ["memberId", "species", "level", "baseExperience"])
    && identifier(opponent.memberId) && /^[A-Z0-9_]{1,64}$/u.test(String(opponent.species))
    && integer(opponent.level, 1, 100) && integer(opponent.baseExperience, 1, 999_999))
    || new Set(opponents.map((opponent) => String((opponent as Record<string, unknown>).memberId))).size !== opponents.length) {
    throw new Error("Adversaires de récompense invalides.");
  }
  const experience = rewards.experience;
  if (!record(experience) || !exact(experience,
    ["levelCap", "experienceDisabled", "boostTenPercent", "boostTwentyPercent"])
    || !integer(experience.levelCap, 1, 100) || typeof experience.experienceDisabled !== "boolean"
    || typeof experience.boostTenPercent !== "boolean" || typeof experience.boostTwentyPercent !== "boolean") {
    throw new Error("Politique d'expérience source invalide.");
  }
  return value as unknown as SourceBattleContext;
}
