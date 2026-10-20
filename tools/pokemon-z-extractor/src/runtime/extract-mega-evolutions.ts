import { readFile } from "node:fs/promises";
import path from "node:path";
import { writeJsonAtomically } from "../io/write-json.js";
import type { ScriptManifestEntry } from "./extract-scripts.js";

export interface SourceMegaEvolution {
  readonly species: string;
  readonly heldItem: string;
  readonly form: number;
  readonly baseStats?: {
    readonly hp: number;
    readonly attack: number;
    readonly defense: number;
    readonly speed: number;
    readonly specialAttack: number;
    readonly specialDefense: number;
  };
  readonly ability?: string;
  readonly type1?: string;
  readonly type2?: string;
  readonly types?: readonly string[];
}

export interface SourceMegaEvolutionCatalog {
  readonly schemaVersion: "1.1.0";
  readonly sourceScripts: readonly string[];
  readonly activationItems: readonly string[];
  readonly disableSwitchId: number;
  readonly onePerOwner: true;
  readonly opponentsRequireActivationItem: false;
  readonly speciesCount: number;
  readonly records: readonly (SourceMegaEvolution & { readonly baseStats: NonNullable<SourceMegaEvolution["baseStats"]>;
    readonly ability: string; readonly types: readonly string[] })[];
  readonly audit: { readonly missingHeldItems: readonly string[]; readonly fallbackCombatData: readonly string[] };
}

const REGISTRATION = /MultipleForms\.register\(\s*:([A-Z0-9_]+)\s*,\s*\{/gu;
const MEGA_FORM = /"getMegaForm"\s*=>\s*proc\s*\{\|pokemon\|([\s\S]*?)\n\s*\},/u;
const ITEM_BRANCH = /next\s+(\d+)\s+if\s+isConst\?\(\s*pokemon\.item\s*,\s*PBItems\s*,\s*:([A-Z0-9_]+)\s*\)/gu;

function procBody(block: string, property: string): string | undefined {
  return new RegExp(`"${property}"\\s*=>\\s*proc\\s*\\{\\|pokemon\\|([\\s\\S]*?)\\n\\s*\\}(?:,|\\s*\\))`, "u")
    .exec(block)?.[1];
}

function conditionMatches(form: number, operator: string, compared: number): boolean {
  if (operator === "==") return form === compared;
  if (operator === ">=") return form >= compared;
  if (operator === "<=") return form <= compared;
  if (operator === ">") return form > compared;
  return form < compared;
}

function formValue(body: string | undefined, form: number, valuePattern: string): string | undefined {
  if (body === undefined) return undefined;
  const pattern = new RegExp(`next\\s+(${valuePattern})\\s+if\\s+pokemon\\.form\\s*(==|>=|<=|>|<)\\s*(\\d+)`, "gu");
  for (const match of body.matchAll(pattern)) {
    if (conditionMatches(form, match[2]!, Number(match[3]))) return match[1];
  }
  return undefined;
}

/** Parses only declarative item/form branches and never executes source Ruby. */
export function parseMegaEvolutions(source: string): readonly SourceMegaEvolution[] {
  const starts = [...source.matchAll(REGISTRATION)];
  const records: SourceMegaEvolution[] = [];
  for (const [index, match] of starts.entries()) {
    const species = match[1]!;
    const start = match.index ?? 0;
    const end = starts[index + 1]?.index ?? source.length;
    const block = source.slice(start, end);
    const megaBody = MEGA_FORM.exec(block)?.[1];
    if (megaBody === undefined) continue;
    for (const branch of megaBody.matchAll(ITEM_BRANCH)) {
      const form = Number(branch[1]);
      const rawStats = formValue(procBody(block, "getBaseStats"), form, "\\[[0-9,\\s]+\\]");
      const ability = (formValue(procBody(block, "getAbilityList"), form,
        "\\[\\[getID\\(PBAbilities,\\s*:[A-Z0-9_]+\\),\\s*0\\]\\]")
        ?? formValue(procBody(block, "ability"), form, "getID\\(PBAbilities,\\s*:[A-Z0-9_]+\\)"))
        ?.match(/PBAbilities,\s*:([A-Z0-9_]+)/u)?.[1];
      const stats = rawStats === undefined ? [] : [...rawStats.matchAll(/\d+/gu)].map((value) => Number(value[0]));
      if (rawStats !== undefined && (stats.length !== 6
        || stats.some((value) => !Number.isSafeInteger(value) || value < 1))) {
        throw new Error(`Statistiques de Méga-Évolution invalides pour ${species}, forme ${form}.`);
      }
      const type = (property: "type1" | "type2"): string | undefined => formValue(procBody(block, property), form,
        "getID\\(PBTypes,\\s*:[A-Z0-9_]+\\)")?.match(/PBTypes,\s*:([A-Z0-9_]+)/u)?.[1];
      const type1 = type("type1");
      const type2 = type("type2");
      records.push({ species, form, heldItem: branch[2]!,
        ...(rawStats === undefined ? {} : { baseStats: { hp: stats[0]!, attack: stats[1]!,
          defense: stats[2]!, speed: stats[3]!, specialAttack: stats[4]!, specialDefense: stats[5]! } }),
        ...(ability === undefined ? {} : { ability }),
        ...(type1 === undefined ? {} : { type1 }), ...(type2 === undefined ? {} : { type2 }) });
    }
  }
  if (records.length === 0) throw new Error("Aucune Méga-Évolution déclarative trouvée dans le script source.");
  const keys = records.map(({ species, heldItem }) => `${species}:${heldItem}`);
  if (new Set(keys).size !== keys.length) throw new Error("Déclaration de Méga-Évolution dupliquée.");
  return records;
}

export async function extractMegaEvolutions(outputDirectory: string,
  scripts: readonly ScriptManifestEntry[]): Promise<SourceMegaEvolutionCatalog> {
  const script = scripts.find((entry) => entry.name.toLowerCase().replaceAll(" ", "").includes("megaevolution"));
  if (script === undefined) throw new Error("Script Pokemon_MegaEvolution introuvable.");
  const source = await readFile(path.join(outputDirectory, ...script.file.split("/")), "utf8");
  const parsedRecords = parseMegaEvolutions(source);
  const battleScript = scripts.find((entry) => entry.name.toLowerCase().replaceAll(/[^a-z]/gu, "") === "pokebattlebattle");
  const settingsScript = scripts.find((entry) => entry.name.toLowerCase() === "settings");
  if (battleScript === undefined || settingsScript === undefined) {
    throw new Error("Contrat d’activation de la Méga-Évolution introuvable.");
  }
  const [battleSource, settingsSource, itemsSource, pokemonSource] = await Promise.all([
    readFile(path.join(outputDirectory, ...battleScript.file.split("/")), "utf8"),
    readFile(path.join(outputDirectory, ...settingsScript.file.split("/")), "utf8"),
    readFile(path.join(outputDirectory, "items.json"), "utf8"),
    readFile(path.join(outputDirectory, "pokemon.json"), "utf8"),
  ]);
  const ringBody = /MEGARINGS\s*=\s*\[([^\]]+)\]/u.exec(battleSource)?.[1];
  const activationItems = ringBody === undefined ? []
    : [...ringBody.matchAll(/:([A-Z0-9_]+)/gu)].map((match) => match[1]!);
  const disableSwitchId = Number(/NO_MEGA_EVOLUTION\s*=\s*(\d+)/u.exec(settingsSource)?.[1]);
  if (activationItems.length === 0 || !Number.isSafeInteger(disableSwitchId)) {
    throw new Error("Règles globales de Méga-Évolution invalides.");
  }
  const itemRecords = JSON.parse(itemsSource) as { readonly records?: readonly { readonly internalName?: unknown }[] };
  const itemIds = new Set((itemRecords.records ?? []).flatMap((item) =>
    typeof item.internalName === "string" ? [item.internalName] : []));
  const pokemonRecords = JSON.parse(pokemonSource) as { readonly records?: readonly {
    readonly internalName?: unknown; readonly types?: unknown; readonly baseStats?: unknown;
    readonly abilities?: unknown }[] };
  const basePokemon = new Map((pokemonRecords.records ?? []).flatMap((pokemon) =>
    typeof pokemon.internalName === "string" && Array.isArray(pokemon.types)
      && pokemon.types.every((type) => typeof type === "string") && typeof pokemon.baseStats === "object"
      && pokemon.baseStats !== null && Array.isArray(pokemon.abilities)
      && pokemon.abilities.every((ability) => typeof ability === "string")
      ? [[pokemon.internalName, pokemon] as const] : []));
  const fallbackCombatData: string[] = [];
  const records = parsedRecords.map((record) => {
    const inherited = basePokemon.get(record.species);
    if (inherited === undefined || !Array.isArray(inherited.types) || inherited.types.length === 0
      || !Array.isArray(inherited.abilities) || typeof inherited.abilities[0] !== "string") {
      throw new Error(`Types de base introuvables pour la Méga-Évolution ${record.species}.`);
    }
    const inheritedTypes = inherited.types as string[];
    const first = record.type1 ?? inheritedTypes[0]!;
    const second = record.type2 ?? inheritedTypes[1];
    if (record.baseStats === undefined || record.ability === undefined) {
      fallbackCombatData.push(`${record.species}:${record.form}`);
    }
    return { ...record,
      baseStats: (record.baseStats ?? inherited.baseStats) as NonNullable<SourceMegaEvolution["baseStats"]>,
      ability: record.ability ?? inherited.abilities[0],
      types: second === undefined || second === first ? [first] : [first, second] };
  });
  const missingHeldItems = [...new Set(records.map(({ heldItem }) => heldItem)
    .filter((heldItem) => !itemIds.has(heldItem)))].sort();
  const catalog: SourceMegaEvolutionCatalog = {
    schemaVersion: "1.1.0",
    sourceScripts: [script.file, battleScript.file, settingsScript.file],
    activationItems,
    disableSwitchId,
    onePerOwner: true,
    opponentsRequireActivationItem: false,
    speciesCount: new Set(records.map(({ species }) => species)).size,
    records,
    audit: { missingHeldItems, fallbackCombatData },
  };
  await writeJsonAtomically(outputDirectory, "mega-evolutions.json", catalog);
  return catalog;
}
