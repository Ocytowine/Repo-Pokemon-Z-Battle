import { describe, expect, it } from "vitest";
import type { ItemDefinition } from "@pokemon-z-battle/game-data";
import { createBattleOnlyItemCoverage, createDualUseItemCoverage, createFieldToolInventory,
  createHeldTypeBoosterCoverage, sourceBattleItemHandlers, sourceFieldItemHandlers,
  sourceHeldTypeBoosters } from "../src/runtime/item-coverage-audit.js";

describe("battle-only item coverage", () => {
  it("separates usable source effects from catalog entries without a Ruby handler", () => {
    const handlers = sourceBattleItemHandlers(`
      ItemHandlers::BattleUseOnBattler.add(:DIREHIT,proc{|item,battler,scene| true })
      ItemHandlers::BattleUseOnBattler.add(:POKEDOLL,proc{|item,battler,scene| true })
      ItemHandlers::BattleUseOnBattler.copy(:POKEDOLL,:FLUFFYTAIL,:POKETOY)
    `);
    const entry = (id: number, internalName: string, fieldUse: number, battleUse: number,
      itemType: number) => ({ id, internalName, name: internalName, fieldUse, battleUse, itemType });
    const report = createBattleOnlyItemCoverage([
      entry(1, "DIREHIT", 0, 2, 0), entry(2, "POKETOY", 0, 2, 0),
      entry(3, "RESETURGE", 0, 2, 0), entry(4, "POKEBALL", 0, 2, 4),
      entry(5, "POTION", 1, 1, 0),
    ] as ItemDefinition[], handlers);
    expect(report.summary).toEqual({ total: 3, actionable: 2, supported: 2,
      remaining: 0, sourceWithoutHandler: 1 });
    expect(report.records.find((item) => item.internalName === "RESETURGE")?.support)
      .toBe("source-no-handler");
  });

  it("requires both source handlers for medicine that works in the field and battle", () => {
    const script = `ItemHandlers::UseOnPokemon.add(:HEALPOWDER,proc{|item,pokemon,scene| true })
      ItemHandlers::BattleUseOnPokemon.add(:HEALPOWDER,proc{|item,pokemon,battler,scene| true })
      ItemHandlers::UseOnPokemon.add(:Cenizas,proc{|item,pokemon,scene| true })`;
    const items = [
      { id: 1, internalName: "HEALPOWDER", name: "HEALPOWDER", fieldUse: 1, battleUse: 1, itemType: 0 },
      { id: 2, internalName: "Cenizas", name: "Cenizas", fieldUse: 1, battleUse: 1, itemType: 0 },
    ] as ItemDefinition[];
    const report = createDualUseItemCoverage(items, 0,
      sourceFieldItemHandlers(script), sourceBattleItemHandlers(script));
    expect(report.summary).toEqual({ total: 2, actionable: 1, supported: 1,
      remaining: 0, sourceWithoutHandler: 1 });
    expect(report.records[1]).toMatchObject({ internalName: "Cenizas",
      fieldHandler: true, battleHandler: false });
  });
});

describe("held and field item inventory", () => {
  it("compares ordinary held type boosts with the actual Ruby item and type pairs", () => {
    const source = sourceHeldTypeBoosters(`if (attacker.hasWorkingItem(:SILKSCARF) && isConst?(type,PBTypes,:NORMAL)) ||
      (attacker.hasWorkingItem(:Tela) && isConst?(type,PBTypes,:FAIRY)) ||
      (attacker.hasWorkingItem(:CHARCOAL) && isConst?(type,PBTypes,:WATER))
      damagemult=(damagemult*1.2).round`);
    const entry = (id: number, internalName: string) => ({ id, internalName, name: internalName });
    const report = createHeldTypeBoosterCoverage([
      entry(1, "SILKSCARF"), entry(2, "Tela"), entry(3, "CHARCOAL"),
    ] as ItemDefinition[], source);
    expect(report.summary).toEqual({ total: 3, supported: 2, remaining: 1 });
    expect(report.records.find((item) => item.internalName === "CHARCOAL")?.support)
      .toBe("not-implemented");
  });

  it("lists field tools independently from battle items and records source Bag handlers", () => {
    const entry = (id: number, internalName: string, fieldUse: number, battleUse: number) =>
      ({ id, internalName, name: internalName, fieldUse, battleUse, itemType: 0 });
    const report = createFieldToolInventory([
      entry(1, "REPEL", 2, 0), entry(2, "BLACKFLUTE", 2, 0),
      entry(3, "POTION", 1, 1), entry(4, "POKEDOLL", 0, 2),
    ] as ItemDefinition[], new Set(["REPEL"]));
    expect(report.summary).toEqual({ total: 2, sourceBagHandlers: 1 });
    expect(report.records[1]).toMatchObject({ internalName: "BLACKFLUTE", sourceBagHandler: false });
  });
});
