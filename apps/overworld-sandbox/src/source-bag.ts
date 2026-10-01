import type { SourceShopItem } from "./source-economy.js";

export interface SourceBagPocket {
  readonly id: number;
  readonly name: string;
}

export interface SourceBagEntry {
  readonly item: SourceShopItem;
  readonly quantity: number;
}

export const SOURCE_BAG_POCKETS: readonly SourceBagPocket[] = [
  { id: 1, name: "Objets" },
  { id: 2, name: "Médicaments" },
  { id: 3, name: "Poké Balls" },
  { id: 4, name: "CT et CS" },
  { id: 5, name: "Ingrédients" },
  { id: 6, name: "Méga-Gemmes" },
  { id: 7, name: "Objets de combat" },
  { id: 8, name: "Objets rares" },
] as const;

export function sourceItemIconUrl(itemId: number): string {
  const safeId = Number.isSafeInteger(itemId) && itemId >= 0 ? itemId : 0;
  return `/__pokemon-z/source/Graphics/Icons/item${String(safeId).padStart(3, "0")}.png`;
}

export function sourcePocketIconUrl(pocket: number): string {
  const safePocket = Number.isSafeInteger(pocket) ? Math.max(1, Math.min(8, pocket)) : 1;
  return `/__pokemon-z/source/Graphics/Icons/bagPocket${safePocket}.png`;
}

export function sourceBagEntries(inventory: Readonly<Record<string, number>>,
  catalog: ReadonlyMap<string, SourceShopItem>, pocket: number): readonly SourceBagEntry[] {
  return Object.entries(inventory).flatMap(([internalName, quantity]) => {
    const item = catalog.get(internalName);
    return item !== undefined && item.pocket === pocket && Number.isSafeInteger(quantity) && quantity > 0
      ? [{ item, quantity }] : [];
  }).sort((left, right) => left.item.id - right.item.id);
}

export function sourceBagPocketCounts(inventory: Readonly<Record<string, number>>,
  catalog: ReadonlyMap<string, SourceShopItem>): ReadonlyMap<number, number> {
  const counts = new Map<number, number>();
  for (const [internalName, quantity] of Object.entries(inventory)) {
    const item = catalog.get(internalName);
    if (item === undefined || !Number.isSafeInteger(quantity) || quantity <= 0) continue;
    counts.set(item.pocket, (counts.get(item.pocket) ?? 0) + 1);
  }
  return counts;
}
