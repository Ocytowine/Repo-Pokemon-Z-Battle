import type {
  EvolutionDefinition,
  LevelUpMove,
  NormalizedDataset,
  PokemonDefinition,
  Stats,
} from "@pokemon-z-battle/game-data";
import {
  createDataset,
  createEntitySource,
  type ParserContext,
} from "../domain/game-data.js";
import type { PbsSection } from "./sections.js";
import {
  optionalProperty,
  parseCsvValues,
  parseInteger,
  parseList,
  parseNumberValue,
  requireProperty,
} from "./values.js";
import { PbsParseError } from "./errors.js";

function parseStats(value: string, label: string, section: PbsSection, file: string): Stats {
  const fields = parseCsvValues(value, file, section.line);
  if (fields.length !== 6) {
    throw new PbsParseError(`${label} doit contenir exactement 6 valeurs.`, file, section.line);
  }
  const values = fields.map((field) => parseInteger(field, label, file, section.line));
  const [hp, attack, defense, speed, specialAttack, specialDefense] = values;
  if (
    hp === undefined ||
    attack === undefined ||
    defense === undefined ||
    speed === undefined ||
    specialAttack === undefined ||
    specialDefense === undefined
  ) {
    throw new PbsParseError(`${label} est incomplet.`, file, section.line);
  }
  return { hp, attack, defense, speed, specialAttack, specialDefense };
}

function parseLevelUpMoves(
  value: string,
  section: PbsSection,
  file: string,
): readonly LevelUpMove[] {
  const fields = parseList(value, file, section.line);
  if (fields.length % 2 !== 0) {
    throw new PbsParseError("Moves doit contenir des paires niveau/attaque.", file, section.line);
  }
  const moves: LevelUpMove[] = [];
  for (let index = 0; index < fields.length; index += 2) {
    const rawLevel = fields[index];
    const move = fields[index + 1];
    if (rawLevel === undefined || move === undefined) continue;
    moves.push({ level: parseInteger(rawLevel, "niveau d'attaque", file, section.line), move });
  }
  return moves;
}

function parseEvolutions(
  value: string | null,
  section: PbsSection,
  file: string,
): readonly EvolutionDefinition[] {
  const fields = parseCsvValues(value, file, section.line);
  if (fields.length % 3 !== 0) {
    throw new PbsParseError(
      "Evolutions doit contenir des triplets espece/methode/parametre.",
      file,
      section.line,
    );
  }
  const evolutions: EvolutionDefinition[] = [];
  for (let index = 0; index < fields.length; index += 3) {
    const species = fields[index];
    const method = fields[index + 1];
    const parameter = fields[index + 2];
    if (species === undefined || method === undefined || parameter === undefined) continue;
    evolutions.push({ species, method, parameter: parameter === "" ? null : parameter });
  }
  return evolutions;
}

function nullable(value: string | null): string | null {
  return value === null || value === "" ? null : value;
}

export function parsePokemon(
  sections: readonly PbsSection[],
  context: ParserContext,
): NormalizedDataset<"pokemon", PokemonDefinition> {
  const records = sections.map((section): PokemonDefinition => {
    const primaryType = requireProperty(section, "Type1", context.file);
    const secondaryType = optionalProperty(section, "Type2");
    const types = secondaryType === null || secondaryType === primaryType
      ? [primaryType]
      : [primaryType, secondaryType];

    return {
      id: section.id,
      internalName: requireProperty(section, "InternalName", context.file),
      name: requireProperty(section, "Name", context.file),
      kind: requireProperty(section, "Kind", context.file),
      pokedexEntry: requireProperty(section, "Pokedex", context.file),
      types,
      baseStats: parseStats(
        requireProperty(section, "BaseStats", context.file),
        "BaseStats",
        section,
        context.file,
      ),
      effortPoints: parseStats(
        requireProperty(section, "EffortPoints", context.file),
        "EffortPoints",
        section,
        context.file,
      ),
      genderRate: requireProperty(section, "GenderRate", context.file),
      growthRate: requireProperty(section, "GrowthRate", context.file),
      baseExperience: parseInteger(
        requireProperty(section, "BaseEXP", context.file),
        "BaseEXP",
        context.file,
        section.line,
      ),
      captureRate: parseInteger(
        requireProperty(section, "Rareness", context.file),
        "Rareness",
        context.file,
        section.line,
      ),
      happiness: parseInteger(
        requireProperty(section, "Happiness", context.file),
        "Happiness",
        context.file,
        section.line,
      ),
      abilities: parseList(
        requireProperty(section, "Abilities", context.file),
        context.file,
        section.line,
      ),
      hiddenAbilities: parseList(
        optionalProperty(section, "HiddenAbility"),
        context.file,
        section.line,
      ),
      levelUpMoves: parseLevelUpMoves(
        requireProperty(section, "Moves", context.file),
        section,
        context.file,
      ),
      eggMoves: parseList(optionalProperty(section, "EggMoves"), context.file, section.line),
      eggGroups: parseList(
        requireProperty(section, "Compatibility", context.file),
        context.file,
        section.line,
      ),
      evolutions: parseEvolutions(
        optionalProperty(section, "Evolutions"),
        section,
        context.file,
      ),
      formNames: parseList(optionalProperty(section, "FormNames"), context.file, section.line),
      stepsToHatch: parseInteger(
        requireProperty(section, "StepsToHatch", context.file),
        "StepsToHatch",
        context.file,
        section.line,
      ),
      height: parseNumberValue(
        requireProperty(section, "Height", context.file),
        "Height",
        context.file,
        section.line,
      ),
      weight: parseNumberValue(
        requireProperty(section, "Weight", context.file),
        "Weight",
        context.file,
        section.line,
      ),
      color: requireProperty(section, "Color", context.file),
      habitat: nullable(optionalProperty(section, "Habitat")),
      wildHeldItems: {
        common: nullable(optionalProperty(section, "WildItemCommon")),
        uncommon: nullable(optionalProperty(section, "WildItemUncommon")),
        rare: nullable(optionalProperty(section, "WildItemRare")),
      },
      spriteMetrics: {
        playerY: parseInteger(
          requireProperty(section, "BattlerPlayerY", context.file),
          "BattlerPlayerY",
          context.file,
          section.line,
        ),
        enemyY: parseInteger(
          requireProperty(section, "BattlerEnemyY", context.file),
          "BattlerEnemyY",
          context.file,
          section.line,
        ),
        altitude: parseInteger(
          requireProperty(section, "BattlerAltitude", context.file),
          "BattlerAltitude",
          context.file,
          section.line,
        ),
      },
      raw: section.properties,
      _source: createEntitySource(section.id, section.line, context.file),
    };
  });

  return createDataset("pokemon", context, records);
}
