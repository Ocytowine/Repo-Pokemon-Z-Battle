import { describe, expect, it } from "vitest";
import { grantSourceTestItems, sourceBagEntries, sourceBagPocketCounts, sourceItemIconUrl, sourcePocketIconUrl } from "../src/source-bag.js";
import type { SourceShopItem } from "../src/source-economy.js";

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
});
