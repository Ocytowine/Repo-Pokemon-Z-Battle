import { sourceItemIconUrl, type SourceBagEntry, type SourceBagNode } from "./source-bag.js";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export interface SourceBagGridOptions {
  readonly itemAttribute: "data-source-bag-item" | "data-battle-item";
  readonly familyAttribute: "data-source-bag-family" | "data-battle-bag-family";
  readonly selectedItemId?: string | null;
  readonly displayName?: (entry: SourceBagEntry) => string;
  readonly disabled?: (entry: SourceBagEntry) => boolean;
}

interface SourceInventoryCardModel {
  readonly kind: "item" | "family";
  readonly attribute: string;
  readonly value: string;
  readonly name: string;
  readonly description: string;
  readonly iconUrl: string | null;
  readonly primaryCount: string;
  readonly secondaryCount?: string;
  readonly selected?: boolean;
  readonly disabled?: boolean;
}

/** Shared card primitive: item and folder use identical, collision-free layout areas. */
function sourceInventoryCardHtml(card: SourceInventoryCardModel): string {
  return `<button type="button" class="source-inventory-card source-inventory-${card.kind}${card.selected ? " selected" : ""}" ${card.attribute}="${escapeHtml(card.value)}" data-source-inventory-kind="${card.kind}"${card.disabled ? " disabled" : ""} title="${escapeHtml(card.name)}"><span class="source-inventory-art">${card.iconUrl === null ? "" : `<img src="${card.iconUrl}" data-source-item-icon alt="">`}${card.kind === "family" ? '<i aria-hidden="true">▰</i>' : ""}</span><span class="source-inventory-copy"><strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(card.description)}</small></span><b class="source-inventory-primary-count">${escapeHtml(card.primaryCount)}</b>${card.secondaryCount === undefined ? "" : `<em class="source-inventory-secondary-count">${escapeHtml(card.secondaryCount)}</em>`}</button>`;
}

/** One shared, fixed-size card grid for the field Bag and the battle Bag. */
export function sourceBagGridHtml(nodes: readonly SourceBagNode[], options: SourceBagGridOptions): string {
  return `<div class="source-inventory-grid">${nodes.map((node) => {
    if (node.kind === "family") {
      const cover = node.entries[0]?.item;
      return sourceInventoryCardHtml({ kind: "family", attribute: options.familyAttribute,
        value: node.family.id, name: node.family.name, description: node.family.description,
        iconUrl: cover === undefined ? null : sourceItemIconUrl(cover.id),
        primaryCount: `${node.typeCount} sorte${node.typeCount > 1 ? "s" : ""}`,
        secondaryCount: `${node.totalQuantity} objet${node.totalQuantity > 1 ? "s" : ""}` });
    }
    const { entry } = node;
    const name = options.displayName?.(entry) ?? entry.item.name;
    const isDisabled = options.disabled?.(entry) === true;
    return sourceInventoryCardHtml({ kind: "item", attribute: options.itemAttribute,
      value: entry.item.internalName, name, description: entry.item.description,
      iconUrl: sourceItemIconUrl(entry.item.id), primaryCount: `×${entry.quantity}`,
      selected: entry.item.internalName === options.selectedItemId, disabled: isDisabled });
  }).join("")}</div>`;
}

export function sourceBagPaginationHtml(page: number, pageCount: number): string {
  if (pageCount <= 1) return "";
  return `<nav class="source-inventory-pagination" aria-label="Pages d'objets"><button type="button" data-source-inventory-page="${page - 1}"${page <= 0 ? " disabled" : ""} aria-label="Page précédente">‹</button><span>Page <b>${page + 1}</b> / ${pageCount}</span><button type="button" data-source-inventory-page="${page + 1}"${page + 1 >= pageCount ? " disabled" : ""} aria-label="Page suivante">›</button></nav>`;
}
