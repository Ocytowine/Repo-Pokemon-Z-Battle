import { describe, expect, it } from "vitest";
import { configureSourceItemIconAvailability, grantSourceTestItems, resetSourceTestItemPocket, sourceBagEntries,
  sourceBagFamilyEntries, sourceBagNodes, sourceBagPage, sourceBagPocketCounts, sourceItemIconFallbackUrl,
  sourceItemIconUrl, sourcePocketIconUrl } from "../src/source-bag.js";
import type { SourceShopItem } from "../src/source-economy.js";
import { sourceActionWheelHtml } from "../src/source-action-wheel.js";
import { sourceBagGridHtml, sourceBagPaginationHtml } from "../src/source-bag-grid.js";
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

  it("creates a virtual family only after its distinct-item threshold", () => {
    const berries = Array.from({ length: 9 }, (_, index): SourceShopItem => ({ id: 389 + index,
      internalName: `BERRY_${index}BERRY`, name: `Baie ${index + 1}`, description: "Une Baie.",
      pocket: 5, price: 20, itemType: 5 }));
    const entries = [...berries.map((item, index) => ({ item, quantity: index + 1 })),
      { item: { id: 751, internalName: "MADERA", name: "Bois", description: "Du bois.", pocket: 5, price: 0 }, quantity: 3 }];
    const nodes = sourceBagNodes(entries, 8);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({ kind: "family", family: { id: "berries", name: "Sac de Baies" },
      typeCount: 9, totalQuantity: 45 });
    expect(nodes[1]).toMatchObject({ kind: "item", entry: { quantity: 3 } });
    expect(sourceBagFamilyEntries(entries, "berries")).toHaveLength(9);
    expect(sourceBagNodes(entries.slice(0, 7), 8)).toHaveLength(7);
  });

  it("paginates grids without leaving an empty page after inventory changes", () => {
    const values = Array.from({ length: 13 }, (_, index) => index);
    expect(sourceBagPage(values, 1, 6)).toEqual({ entries: [6, 7, 8, 9, 10, 11], page: 1, pageCount: 3 });
    expect(sourceBagPage(values.slice(0, 5), 2, 6)).toEqual({ entries: [0, 1, 2, 3, 4], page: 0, pageCount: 1 });
  });

  it("renders the same quantity-rich grid contract for items and virtual folders", () => {
    const itemHtml = sourceBagGridHtml(sourceBagNodes([{ item: potion, quantity: 27 }]), {
      itemAttribute: "data-source-bag-item", familyAttribute: "data-source-bag-family",
    });
    expect(itemHtml).toContain("source-inventory-grid");
    expect(itemHtml).toContain('data-source-bag-item="POTION"');
    expect(itemHtml).toContain('data-source-inventory-kind="item"');
    expect(itemHtml).toContain("source-inventory-copy");
    expect(itemHtml).toContain("source-inventory-primary-count");
    expect(itemHtml).toContain("×27");
    expect(sourceBagPaginationHtml(1, 3)).toContain("Page <b>2</b> / 3");
  });

  it("keeps the CT/CS pocket flat for its future dedicated filter", () => {
    const machines = Array.from({ length: 12 }, (_, index) => ({
      item: { ...potion, id: 300 + index, pocket: 4, internalName: `TM${String(index + 1).padStart(2, "0")}` },
      quantity: 1,
    }));
    const nodes = sourceBagNodes(machines, 8);
    expect(nodes).toHaveLength(12);
    expect(nodes.every((node) => node.kind === "item")).toBe(true);
  });

  it("grants a configurable pocket or item and resets only the selected pocket", () => {
    expect(grantSourceTestItems({ POTION: 2 }, catalog, 5, { pocket: 2, mode: "add" }))
      .toEqual({ POTION: 7 });
    expect(grantSourceTestItems({ POTION: 998 }, catalog, 5, { itemId: "POTION", mode: "add" }))
      .toEqual({ POTION: 999 });
    expect(resetSourceTestItemPocket({ POTION: 3, POKEBALL: 4 }, catalog, 2))
      .toEqual({ POKEBALL: 4 });
  });

  it("remembers a missing source icon and uses the generic fallback on later renders", () => {
    expect(sourceItemIconUrl(833)).toContain("item833.png");
    expect(sourceItemIconFallbackUrl("http://127.0.0.1:5174/__pokemon-z/source/Graphics/Icons/item833.png"))
      .toContain("item000.png");
    expect(sourceItemIconUrl(833)).toContain("item000.png");
  });

  it("uses the extracted manifest to avoid requesting absent source icons", () => {
    configureSourceItemIconAvailability(new Set([0, 263]));
    expect(sourceItemIconUrl(263)).toContain("item263.png");
    expect(sourceItemIconUrl(548)).toContain("item000.png");
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
    const sacredAsh = { ...potion, internalName: "SACREDASH" };
    expect(sourceItemActions(sacredAsh, { quantity: 1 })[0]).toMatchObject({ id: "use", enabled: true });
    expect(sourceItemTargetFlow(sacredAsh, "use").stages).toEqual(["party", "confirmation"]);
  });

  it("adds the localized move name after a machine number without changing regular items", () => {
    const machine = { ...potion, name: "CT01.", internalName: "TM01", machineMove: "BLIZZARD" };
    expect(sourceItemDisplayName(machine, "Blizzard")).toBe("CT01 · Blizzard");
    expect(sourceItemDisplayName(machine)).toBe("CT01.");
    expect(sourceItemDisplayName(potion, "Blizzard")).toBe("Potion");
    expect(sourceItemDisplayName({ ...machine, name: "CT01 Blizzard" }, "Blizzard")).toBe("CT01 Blizzard");
  });
});
