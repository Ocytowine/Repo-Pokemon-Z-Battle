import type { PlayerInventory } from "@pokemon-z-battle/player-state";
import type { SourceShopItem } from "./source-economy.js";
import { SOURCE_BAG_POCKETS, sourceBagFamilyEntries, sourceBagNodes, sourceBagPage,
  sourceBagSubfamily, sourceItemIconFallbackUrl, sourcePocketIconUrl } from "./source-bag.js";
import { sourceBagGridHtml, sourceBagPaginationHtml } from "./source-bag-grid.js";
import { sourceActionWheelHtml } from "./source-action-wheel.js";
import { isSourceItemHoldable } from "./source-item-actions.js";

export interface SourceHeldItemEntry {
  readonly item: SourceShopItem;
  readonly quantity: number;
}

export interface SourceHeldItemBrowserState {
  readonly pocket: number | null;
  readonly familyId: string | null;
  readonly page: number;
}

export const SOURCE_HELD_ITEM_PAGE_SIZE = 6;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function sourceHeldItemEntries(inventory: PlayerInventory,
  catalog: ReadonlyMap<string, SourceShopItem>): readonly SourceHeldItemEntry[] {
  return Object.entries(inventory).flatMap(([itemId, quantity]) => {
    const item = catalog.get(itemId);
    return item !== undefined && isSourceItemHoldable(item) && Number.isSafeInteger(quantity) && quantity > 0
      ? [{ item, quantity }] : [];
  }).sort((left, right) => left.item.id - right.item.id);
}

export function canManageSourceHeldItem(inventory: PlayerInventory, heldItem: string | null,
  catalog: ReadonlyMap<string, SourceShopItem>): boolean {
  return heldItem !== null || sourceHeldItemEntries(inventory, catalog).length > 0;
}

export function sourceHeldItemManagerHtml(pokemonName: string, heldItem: string | null,
  inventory: PlayerInventory, catalog: ReadonlyMap<string, SourceShopItem>,
  state: SourceHeldItemBrowserState = { pocket: null, familyId: null, page: 0 }): string {
  const entries = sourceHeldItemEntries(inventory, catalog);
  const current = heldItem === null ? null : catalog.get(heldItem) ?? null;
  const currentName = heldItem === null ? "Aucun objet" : current?.name ?? heldItem;
  if (state.pocket === null) {
    return sourceActionWheelHtml({ label: `Donner un objet à ${pokemonName}`,
      className: "source-held-item-category-wheel",
      centerHtml: `<span class="source-held-item-give-icon" aria-hidden="true">◇</span><strong>Donner un objet</strong><small>${escapeHtml(pokemonName)}</small>`,
      actions: SOURCE_BAG_POCKETS.map((pocket) => {
        const count = entries.filter((entry) => entry.item.pocket === pocket.id).length;
        return { id: `held-pocket:${pocket.id}` as const, label: pocket.name, symbol: String(pocket.id),
          iconUrl: sourcePocketIconUrl(pocket.id), enabled: count > 0,
          hint: count > 0 ? `${count} objet${count > 1 ? "s" : ""}` : "Catégorie vide" };
      }) });
  }
  const pocket = SOURCE_BAG_POCKETS.find((candidate) => candidate.id === state.pocket) ?? SOURCE_BAG_POCKETS[0]!;
  const pocketEntries = entries.filter((entry) => entry.item.pocket === pocket.id);
  const familyEntries = state.familyId === null ? [] : sourceBagFamilyEntries(pocketEntries, state.familyId);
  const family = familyEntries.length === 0 ? null : sourceBagSubfamily(familyEntries[0]!.item);
  const nodes = family === null ? sourceBagNodes(pocketEntries)
    : familyEntries.map((entry) => ({ kind: "item" as const, entry }));
  const page = sourceBagPage(nodes, state.page, SOURCE_HELD_ITEM_PAGE_SIZE);
  return `<div class="source-held-item-backdrop">
    <section class="source-held-item-panel" role="dialog" aria-modal="true" aria-label="Objet tenu par ${escapeHtml(pokemonName)}">
      <header><button type="button" data-held-item-pocket-back aria-label="Retour aux catégories">‹</button><div><small>${escapeHtml(pocket.name)}</small><strong>Donner un objet à ${escapeHtml(pokemonName)}</strong></div><button type="button" data-held-item-close aria-label="Fermer">×</button></header>
      <article class="source-held-item-current"><span>Actuellement</span><strong>${escapeHtml(currentName)}</strong>${heldItem === null ? "" : `<button type="button" data-held-item-remove>Retirer</button>`}</article>
      <div class="source-held-item-browser">${family === null ? "" : `<div class="source-inventory-breadcrumb"><button type="button" data-held-item-family-back>‹ ${escapeHtml(pocket.name)}</button><strong>${escapeHtml(family.name)}</strong><span>${familyEntries.length} sortes</span></div>`}${page.entries.length === 0
        ? '<p class="source-held-item-empty">Aucun objet de cette catégorie ne peut être tenu.</p>'
        : sourceBagGridHtml(page.entries, { itemAttribute: "data-held-item-equip",
          familyAttribute: "data-held-item-family" })}${sourceBagPaginationHtml(page.page, page.pageCount)}</div>
      <footer>Équiper ou remplacer un objet rend automatiquement l'ancien au Sac.</footer>
    </section>
  </div>`;
}

export function bindSourceHeldItemIconFallback(root: ParentNode): void {
  root.querySelectorAll<HTMLImageElement>("[data-source-item-icon]").forEach((image) => {
    image.addEventListener("error", () => { image.src = sourceItemIconFallbackUrl(image.src); }, { once: true });
  });
}
