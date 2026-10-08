import { describe, expect, it } from "vitest";
import { grantSourceTestItems, sourceBagEntries, sourceBagPocketCounts, sourceItemIconUrl, sourcePocketIconUrl } from "../src/source-bag.js";
import type { SourceShopItem } from "../src/source-economy.js";
import { sourceActionWheelHtml } from "../src/source-action-wheel.js";
import { isSourceItemDiscardable, sourceItemActions, sourceItemDisplayName, sourceItemTargetFlow } from "../src/source-item-actions.js";

const potion: SourceShopItem = { id: 217, internalName: "POTION", name: "Potion",
  description: "Restaure des PV.", pocket: 2, price: 800 };
const ball: SourceShopItem = { id: 267, internalName: "POKEBALL", name: "Poké Ball",
  description: "Capture un Pokémon.", pocket: 3, price: 500 };
const catalog = new Map([[potion.internalName, potion], [ball.internalName, ball]]);

describe("source bag", () => {
  it("resolves item and pocket assets with their source conventions", () => {
    expect(sourceItemIconUrl(7)).toBe("/__pokemon-z/source/Graphics/Icons/item007.png");
    expect(sourceItemIconUrl(752)).toBe("/__pokemon-z/source/Graphics/Icons/item752.png");
    expect(sourcePocketIconUrl(3)).toBe("/__pokemon-z/source/Graphics/Icons/bagPocket3.png");
  });

  it("groups inventory entries by source pocket and source id", () => {
    const inventory = { POKEBALL: 5, POTION: 3, UNKNOWN: 9 };
    expect(sourceBagEntries(inventory, catalog, 2)).toEqual([{ item: potion, quantity: 3 }]);
    expect(sourceBagEntries(inventory, catalog, 3)).toEqual([{ item: ball, quantity: 5 }]);
    expect([...sourceBagPocketCounts(inventory, catalog)]).toEqual([[3, 1], [2, 1]]);
  });

  it("fills a personal test inventory without mutating its previous values", () => {
    const inventory = { POTION: 2 };
    expect(grantSourceTestItems(inventory, catalog)).toEqual({ POTION: 99, POKEBALL: 99 });
    expect(inventory).toEqual({ POTION: 2 });
  });

  it("builds contextual item actions and accepts feature-specific extensions", () => {
    const actions = sourceItemActions(potion, { quantity: 3, specificActions: [
      { id: "specific:register", label: "Enregistrer", symbol: "R", enabled: false, hint: "À raccorder" },
    ] });
    expect(actions.map(({ id, enabled }) => [id, enabled])).toEqual([
      ["use", true], ["give", false], ["discard", true], ["specific:register", false],
    ]);
    expect(isSourceItemDiscardable({ ...potion, itemType: 6 })).toBe(false);
    expect(isSourceItemDiscardable({ ...potion, fieldUse: 3, machineMove: "HONECLAWS" })).toBe(false);
    const html = sourceActionWheelHtml({ label: "Actions Potion",
      centerHtml: "<strong>Potion</strong>", actions });
    expect(html).toContain('data-source-wheel-action="use"');
    expect(html).toContain("data-source-wheel-close");
    const machine = { ...potion, internalName: "TM01", machineMove: "HONECLAWS" };
    expect(sourceItemActions(machine, { quantity: 1, machineCompatibilityAvailable: true })[0])
      .toMatchObject({ id: "teach", enabled: true });
    expect(sourceItemTargetFlow(machine, "teach").stages)
      .toEqual(["pokemon", "compatibility", "replace-move", "confirmation"]);
  });

  it("adds the localized move name after a machine number without changing regular items", () => {
    const machine = { ...potion, name: "CT01.", internalName: "TM01", machineMove: "BLIZZARD" };
    expect(sourceItemDisplayName(machine, "Blizzard")).toBe("CT01 · Blizzard");
    expect(sourceItemDisplayName(machine)).toBe("CT01.");
    expect(sourceItemDisplayName(potion, "Blizzard")).toBe("Potion");
    expect(sourceItemDisplayName({ ...machine, name: "CT01 Blizzard" }, "Blizzard")).toBe("CT01 Blizzard");
  });
});
