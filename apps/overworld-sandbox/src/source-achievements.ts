/** Source `LOGROS` has 27 entries, indexed 0..26. Achievement state belongs to the player. */
export const SOURCE_ACHIEVEMENT_COUNT = 27;
export type SourceAchievementStatus = 1 | 2 | 3;

const SOURCE_ACHIEVEMENT_NAMES = [
  "Canola", "Hisopo", "F3", "Zafra", "Loto", "Belladona", "La chute du roi", "Hibis",
  "Anturia", "Rúpico", "Cendera", "Siempreviva", "Arrayán", "L’adversaire ultime",
  "Une île singulière", "Les cryptes de la ville", "Le trésor maudit", "Un repos mérité",
  "Maîtrise des MT", "Maîtrise de l’alchimie", "Maîtrise Alfa", "Pokévial définitif",
  "Village reconstruit", "Quelques Pokémon", "Beaucoup de Pokémon", "Énormément de Pokémon",
  "Une rencontre destinée",
] as const;

export function sourceNewAchievementNames(before: readonly SourceAchievementStatus[],
  after: readonly SourceAchievementStatus[]): string[] {
  return after.flatMap((status, index) => status === 3 && before[index] !== 3
    ? [SOURCE_ACHIEVEMENT_NAMES[index] ?? `Succès ${index + 1}`] : []);
}

export function createSourceAchievements(): SourceAchievementStatus[] {
  return Array.from({ length: SOURCE_ACHIEVEMENT_COUNT }, () => 2);
}

export function parseSourceAchievements(value: unknown): SourceAchievementStatus[] | null {
  if (value === undefined || value === null) return createSourceAchievements();
  if (!Array.isArray(value) || value.length > SOURCE_ACHIEVEMENT_COUNT
    || !value.every((entry) => entry === null || entry === 1 || entry === 2 || entry === 3)) return null;
  const defaults = createSourceAchievements();
  value.forEach((entry, index) => { if (entry !== null) defaults[index] = entry as SourceAchievementStatus; });
  return defaults;
}

export function sourceAchievementStatus(achievements: readonly SourceAchievementStatus[], id: number): number {
  return Number.isSafeInteger(id) && id >= 0 && id < achievements.length ? achievements[id]! : -1;
}

/** The original Pokédex counts species ever owned, including those no longer in the party. */
export function sourcePokedexOwned(caughtSpecies: readonly string[]): number {
  return new Set(caughtSpecies).size;
}
