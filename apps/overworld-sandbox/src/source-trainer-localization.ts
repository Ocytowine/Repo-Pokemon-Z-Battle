export interface SourceTrainerLocalizations {
  readonly names: ReadonlyMap<string, string>;
  readonly typeNames: ReadonlyMap<number, string>;
}

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function entries(value: unknown): ReadonlyMap<string, string> {
  if (!Array.isArray(value)) return new Map();
  return new Map(value.flatMap((entry): readonly (readonly [string, string])[] =>
    record(entry) && typeof entry.key === "string" && typeof entry.value === "string"
      && entry.value.trim() !== "" ? [[entry.key, entry.value.trim()]] : []));
}

export function parseSourceTrainerLocalizations(value: unknown): SourceTrainerLocalizations {
  const categories = record(value) && record(value.categories) ? value.categories : null;
  const names = entries(categories?.trainerNames);
  const typeNames = new Map<number, string>();
  for (const [key, name] of entries(categories?.trainerTypeNames)) {
    const id = Number(key);
    if (Number.isSafeInteger(id) && id >= 0) typeNames.set(id, name);
  }
  return { names, typeNames };
}

/** Only the presentation label is localized; source identity stays available for battle resolution. */
export function sourceTrainerDisplayName(trainer: { readonly id: number; readonly name: string },
  localizations: SourceTrainerLocalizations | null): string {
  const name = localizations?.names.get(trainer.name) ?? trainer.name;
  const typeName = localizations?.typeNames.get(trainer.id);
  return typeName === undefined ? name : `${typeName} ${name}`;
}
