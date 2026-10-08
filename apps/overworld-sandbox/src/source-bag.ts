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

const unavailableSourceItemIcons = new Set<number>();
let availableSourceItemIcons: ReadonlySet<number> | null = null;

export function configureSourceItemIconAvailability(itemIds: ReadonlySet<number>): void {
  availableSourceItemIcons = new Set(itemIds);
}

export function sourceItemIconUrl(itemId: number): string {
  const safeId = Number.isSafeInteger(itemId) && itemId >= 0 ? itemId : 0;
  const resolvedId = unavailableSourceItemIcons.has(safeId)
    || availableSourceItemIcons !== null && !availableSourceItemIcons.has(safeId) ? 0 : safeId;
  return `/__pokemon-z/source/Graphics/Icons/item${String(resolvedId).padStart(3, "0")}.png`;
}

/** Remembers source gaps so rerendering the Bag does not request the same missing bitmap repeatedly. */
export function sourceItemIconFallbackUrl(failedUrl: string): string {
  const match = /\/item(\d+)\.png(?:[?#].*)?$/iu.exec(failedUrl);
  if (match?.[1] !== undefined) unavailableSourceItemIcons.add(Number(match[1]));
  return sourceItemIconUrl(0);
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

/** Explicit test-only mutation. The caller remains responsible for persisting its own personal save. */
export function grantSourceTestItems(inventory: Readonly<Record<string, number>>,
  catalog: ReadonlyMap<string, SourceShopItem>, quantity = 99): Readonly<Record<string, number>> {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) throw new Error("Quantité de test invalide.");
  const next = { ...inventory };
  for (const internalName of catalog.keys()) next[internalName] = quantity;
  return next;
}
