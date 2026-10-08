import { isHeldItemSupported, type PlayerInventory } from "@pokemon-z-battle/player-state";
import type { SourceShopItem } from "./source-economy.js";
import { sourceItemIconFallbackUrl, sourceItemIconUrl } from "./source-bag.js";

export interface SourceHeldItemEntry {
  readonly item: SourceShopItem;
  readonly quantity: number;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function sourceHeldItemEntries(inventory: PlayerInventory,
  catalog: ReadonlyMap<string, SourceShopItem>): readonly SourceHeldItemEntry[] {
  return Object.entries(inventory).flatMap(([itemId, quantity]) => {
    const item = catalog.get(itemId);
    return item !== undefined && isHeldItemSupported(itemId) && Number.isSafeInteger(quantity) && quantity > 0
      ? [{ item, quantity }] : [];
  }).sort((left, right) => left.item.id - right.item.id);
}

export function canManageSourceHeldItem(inventory: PlayerInventory, heldItem: string | null): boolean {
  return heldItem !== null || Object.entries(inventory)
    .some(([itemId, quantity]) => isHeldItemSupported(itemId) && Number.isSafeInteger(quantity) && quantity > 0);
}

export function sourceHeldItemManagerHtml(pokemonName: string, heldItem: string | null,
  inventory: PlayerInventory, catalog: ReadonlyMap<string, SourceShopItem>): string {
  const entries = sourceHeldItemEntries(inventory, catalog);
  const current = heldItem === null ? null : catalog.get(heldItem) ?? null;
  const currentName = heldItem === null ? "Aucun objet" : current?.name ?? heldItem;
  return `<div class="source-held-item-backdrop">
    <section class="source-held-item-panel" role="dialog" aria-modal="true" aria-label="Objet tenu par ${escapeHtml(pokemonName)}">
      <header><div><small>OBJET TENU</small><strong>${escapeHtml(pokemonName)}</strong></div><button type="button" data-held-item-close aria-label="Fermer">×</button></header>
      <article class="source-held-item-current"><span>Actuellement</span><strong>${escapeHtml(currentName)}</strong>${heldItem === null ? "" : `<button type="button" data-held-item-remove>Retirer</button>`}</article>
      <div class="source-held-item-list">${entries.length === 0
        ? "<p>Aucun objet tenu compatible dans le Sac.</p>"
        : entries.map(({ item, quantity }) => `<button type="button" data-held-item-equip="${escapeHtml(item.internalName)}"><img src="${sourceItemIconUrl(item.id)}" data-source-item-icon alt=""><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small></span><em>×${quantity}</em></button>`).join("")}</div>
      <footer>Équiper ou remplacer un objet rend automatiquement l'ancien au Sac.</footer>
    </section>
  </div>`;
}

export function bindSourceHeldItemIconFallback(root: ParentNode): void {
  root.querySelectorAll<HTMLImageElement>("[data-source-item-icon]").forEach((image) => {
    image.addEventListener("error", () => { image.src = sourceItemIconFallbackUrl(image.src); }, { once: true });
  });
}
