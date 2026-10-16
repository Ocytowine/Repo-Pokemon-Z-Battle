import type { MegaEvolutionDefinition } from "@pokemon-z-battle/battle-engine";
import type { Stats } from "@pokemon-z-battle/game-data";

export interface SourceMegaEvolutionDefinition extends MegaEvolutionDefinition {
  readonly baseStats: Stats;
  readonly types: readonly string[];
  readonly ability: string;
}

export interface SourceMegaEvolutionCatalog {
  readonly activationItems: readonly string[];
  readonly disableSwitchId: number;
  readonly definitions: readonly SourceMegaEvolutionDefinition[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSourceMegaEvolutionCatalog(value: unknown): SourceMegaEvolutionCatalog {
  if (!record(value) || value.schemaVersion !== "1.1.0" || !Array.isArray(value.activationItems)
    || value.activationItems.length === 0 || !value.activationItems.every((item) => typeof item === "string")
    || !Number.isSafeInteger(value.disableSwitchId) || Number(value.disableSwitchId) <= 0
    || !Array.isArray(value.records)) throw new Error("Catalogue de Méga-Évolution invalide.");
  const definitions = value.records.map((entry) => {
    if (!record(entry) || typeof entry.species !== "string" || typeof entry.heldItem !== "string"
      || !Number.isSafeInteger(entry.form) || Number(entry.form) <= 0 || !record(entry.baseStats)
      || !["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"]
        .every((stat) => Number.isSafeInteger(entry.baseStats![stat]) && Number(entry.baseStats![stat]) > 0)
      || !Array.isArray(entry.types) || entry.types.length < 1 || entry.types.length > 2
      || !entry.types.every((type) => typeof type === "string") || typeof entry.ability !== "string") {
      throw new Error("Définition de Méga-Évolution invalide.");
    }
    return { species: entry.species, heldItem: entry.heldItem, form: Number(entry.form),
      baseStats: entry.baseStats as unknown as Stats, types: entry.types as string[], ability: entry.ability };
  });
  return { activationItems: value.activationItems as string[], disableSwitchId: Number(value.disableSwitchId),
    definitions };
}

export function sourceMegaEvolutionForPokemon(catalog: SourceMegaEvolutionCatalog | undefined,
  species: string, heldItem: string | null): MegaEvolutionDefinition | undefined {
  return heldItem === null ? undefined : catalog?.definitions.find((definition) =>
    definition.species === species && definition.heldItem === heldItem);
}

export function sourceMegaActivationAvailable(catalog: SourceMegaEvolutionCatalog,
  inventory: Readonly<Record<string, number>>, switches: Readonly<Record<string, boolean>>): boolean {
  return switches[String(catalog.disableSwitchId)] !== true
    && catalog.activationItems.some((item) => (inventory[item] ?? 0) > 0);
}
