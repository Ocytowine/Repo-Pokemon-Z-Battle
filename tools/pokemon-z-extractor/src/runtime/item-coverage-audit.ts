import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { isPokemonItemUsableInBattle, isPokemonItemUsableInField,
  isHeldTurnOrderItemSupported, pokemonItemTargetMode,
  TYPE_BOOST_HELD_ITEM_TYPES } from "@pokemon-z-battle/battle-engine";
import type { ItemDefinition } from "@pokemon-z-battle/game-data";
import { writeJsonAtomically } from "../io/write-json.js";

/** PBS battle-only, ordinary items: excludes Balls, berries, held items and field tools. */
function sourceItemHandlers(script: string, kinds: string): ReadonlySet<string> {
  const names = new Set<string>();
  const entries = script.matchAll(new RegExp(`ItemHandlers::(?:${kinds})\\.(?:add|copy)\\(([^)]*)\\)`, "g"));
  for (const entry of entries) {
    for (const name of entry[1]!.matchAll(/:([A-Za-z0-9_]+)/g)) names.add(name[1]!);
  }
  return names;
}

export function sourceBattleItemHandlers(script: string): ReadonlySet<string> {
  return sourceItemHandlers(script, "BattleUseOnPokemon|BattleUseOnBattler|UseInBattle");
}

export function sourceFieldItemHandlers(script: string): ReadonlySet<string> {
  return sourceItemHandlers(script, "UseOnPokemon");
}

/** The ordinary held type-boost block in Pokemon Z's damage script. */
export function sourceHeldTypeBoosters(script: string): ReadonlyMap<string, string> {
  const block = script.match(/if \(attacker\.hasWorkingItem\(:SILKSCARF\)[\s\S]*?damagemult=\(damagemult\*1\.2\)\.round/);
  if (block === null) throw new Error("Bloc source des objets tenus renforçant un type introuvable.");
  const result = new Map<string, string>();
  for (const match of block[0].matchAll(/hasWorkingItem\(:(\w+)\)\s*&&\s*isConst\?\(type,PBTypes,:(\w+)\)/g)) {
    result.set(match[1]!, match[2]!);
  }
  return result;
}

export function createHeldTypeBoosterCoverage(items: readonly ItemDefinition[], source: ReadonlyMap<string, string>,
  localizedNames: ReadonlyMap<number, string> = new Map()) {
  const records = [...source].map(([internalName, type]) => {
    const item = items.find((candidate) => candidate.internalName === internalName);
    return { internalName, type, id: item?.id ?? null,
      name: item === undefined ? internalName : localizedNames.get(item.id) ?? item.name,
      support: item === undefined ? "source-item-absent" as const
        : TYPE_BOOST_HELD_ITEM_TYPES[internalName] === type ? "supported" as const : "not-implemented" as const };
  });
  return { summary: { total: records.length, supported: records.filter((record) => record.support === "supported").length,
    remaining: records.filter((record) => record.support !== "supported").length }, records };
}

/** The four item identities in Pokemon Z's pbPriority held-item branch. */
export function sourceHeldTurnOrderItems(script: string): ReadonlySet<string> {
  const block = script.match(/def pbPriority\(ignorequickclaw=false,log=false\)[\s\S]*?# Calculate each Pokémon's priority bracket/);
  if (block === null) throw new Error("Bloc source des objets d'ordre d'action introuvable.");
  return new Set([...block[0].matchAll(/hasWorkingItem\(:(\w+)\)/g)].map((match) => match[1]!));
}

export function createHeldTurnOrderCoverage(items: readonly ItemDefinition[], source: ReadonlySet<string>,
  localizedNames: ReadonlyMap<number, string> = new Map()) {
  const records = [...source].map((internalName) => {
    const item = items.find((candidate) => candidate.internalName === internalName);
    return { internalName, id: item?.id ?? null,
      name: item === undefined ? internalName : localizedNames.get(item.id) ?? item.name,
      support: item === undefined ? "source-item-absent" as const
        : isHeldTurnOrderItemSupported(internalName) ? "supported" as const : "not-implemented" as const };
  });
  return { summary: { total: records.length, supported: records.filter((record) => record.support === "supported").length,
    remaining: records.filter((record) => record.support !== "supported").length }, records };
}

export function createFieldToolInventory(items: readonly ItemDefinition[], sourceBagHandlers: ReadonlySet<string>,
  localizedNames: ReadonlyMap<number, string> = new Map()) {
  const records = items.filter((item) => item.itemType === 0 && item.fieldUse === 2 && item.battleUse === 0)
    .map((item) => ({ id: item.id, internalName: item.internalName,
      name: localizedNames.get(item.id) ?? item.name, sourceBagHandler: sourceBagHandlers.has(item.internalName) }));
  return { summary: { total: records.length,
    sourceBagHandlers: records.filter((record) => record.sourceBagHandler).length }, records };
}

function summarize(records: readonly { readonly support: string }[]) {
  const supported = records.filter((item) => item.support === "supported").length;
  const sourceWithoutHandler = records.filter((item) => item.support === "source-no-handler").length;
  return { total: records.length, actionable: records.length - sourceWithoutHandler,
    supported, remaining: records.length - supported - sourceWithoutHandler, sourceWithoutHandler };
}

export function createBattleOnlyItemCoverage(items: readonly ItemDefinition[],
  sourceHandlers: ReadonlySet<string>, localizedNames: ReadonlyMap<number, string> = new Map()) {
  const records = items.filter((item) => item.fieldUse === 0 && item.battleUse === 2
    && item.itemType === 0).map((item) => ({
    id: item.id, internalName: item.internalName, name: localizedNames.get(item.id) ?? item.name,
    sourceName: item.name,
    support: !sourceHandlers.has(item.internalName) ? "source-no-handler" as const
      : isPokemonItemUsableInBattle(item.internalName) ? "supported" as const : "not-implemented" as const,
    targetMode: pokemonItemTargetMode(item.internalName),
  }));
  return { schemaVersion: "1.0.0" as const,
    scope: "ordinary-battle-only-items" as const,
    summary: summarize(records),
    records };
}

export function createDualUseItemCoverage(items: readonly ItemDefinition[], itemType: number,
  sourceFieldHandlers: ReadonlySet<string>, sourceBattleHandlers: ReadonlySet<string>,
  localizedNames: ReadonlyMap<number, string> = new Map()) {
  const records = items.filter((item) => item.fieldUse === 1 && item.battleUse === 1
    && item.itemType === itemType).map((item) => ({
    id: item.id, internalName: item.internalName, name: localizedNames.get(item.id) ?? item.name,
    sourceName: item.name,
    support: !sourceFieldHandlers.has(item.internalName) || !sourceBattleHandlers.has(item.internalName)
      ? "source-no-handler" as const
      : isPokemonItemUsableInField(item.internalName) && isPokemonItemUsableInBattle(item.internalName)
        ? "supported" as const : "not-implemented" as const,
    fieldHandler: sourceFieldHandlers.has(item.internalName),
    battleHandler: sourceBattleHandlers.has(item.internalName),
  }));
  return { summary: summarize(records), records };
}

export async function writeBattleOnlyItemCoverage(outputDirectory: string) {
  const [itemsText, localizationText, scriptFiles, damageScript, priorityScript] = await Promise.all([
    readFile(path.join(outputDirectory, "items.json"), "utf8"),
    readFile(path.join(outputDirectory, "localization.json"), "utf8"),
    readdir(path.join(outputDirectory, "scripts")),
    readFile(path.join(outputDirectory, "scripts", "082-5818042-pokebattle-move.rb"), "utf8"),
    readFile(path.join(outputDirectory, "scripts", "084-37140976-pokebattle-battle.rb"), "utf8"),
  ]);
  const items = JSON.parse(itemsText) as {
    readonly records: readonly ItemDefinition[] };
  const sourceScripts = await Promise.all(scriptFiles.filter((file) => file.includes("itemeffects"))
    .map((file) => readFile(path.join(outputDirectory, "scripts", file), "utf8")));
  const handlers = new Set(sourceScripts.flatMap((script) => [...sourceBattleItemHandlers(script)]));
  const fieldHandlers = new Set(sourceScripts.flatMap((script) => [...sourceFieldItemHandlers(script)]));
  const bagHandlers = new Set(sourceScripts.flatMap((script) => [...sourceItemHandlers(script, "UseFromBag")]));
  const localization = JSON.parse(localizationText) as { readonly categories?: {
    readonly itemNames?: readonly { readonly key: string; readonly value: string }[] } };
  const names = new Map((localization.categories?.itemNames ?? [])
    .map((entry) => [Number(entry.key), entry.value] as const));
  const battleOnly = createBattleOnlyItemCoverage(items.records, handlers, names);
  const medicine = createDualUseItemCoverage(items.records, 0, fieldHandlers, handlers, names);
  const curativeBerries = createDualUseItemCoverage(items.records, 5, fieldHandlers, handlers, names);
  const heldTypeBoosters = createHeldTypeBoosterCoverage(items.records, sourceHeldTypeBoosters(damageScript), names);
  const heldTurnOrder = createHeldTurnOrderCoverage(items.records, sourceHeldTurnOrderItems(priorityScript), names);
  const coveredFamilies = [
    { actionable: battleOnly.summary.actionable, supported: battleOnly.summary.supported },
    { actionable: medicine.summary.actionable, supported: medicine.summary.supported },
    { actionable: curativeBerries.summary.actionable, supported: curativeBerries.summary.supported },
    { actionable: heldTypeBoosters.summary.total, supported: heldTypeBoosters.summary.supported },
    { actionable: heldTurnOrder.summary.total, supported: heldTurnOrder.summary.supported },
  ];
  const actionable = coveredFamilies.reduce((total, family) => total + family.actionable, 0);
  const supported = coveredFamilies.reduce((total, family) => total + family.supported, 0);
  const report = { schemaVersion: "1.4.0" as const,
    auditedEffects: { actionable, supported, remaining: actionable - supported,
      familyCount: coveredFamilies.length }, battleOnly, medicine, curativeBerries,
    heldTypeBoosters, heldTurnOrder,
    fieldTools: createFieldToolInventory(items.records, bagHandlers, names) };
  await writeJsonAtomically(outputDirectory, "item-coverage-report.json", report);
  return report;
}
