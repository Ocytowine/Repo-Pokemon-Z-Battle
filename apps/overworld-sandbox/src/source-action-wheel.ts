export interface SourceActionWheelAction<ActionId extends string = string> {
  readonly id: ActionId;
  readonly label: string;
  readonly symbol: string;
  readonly enabled: boolean;
  readonly hint: string;
}

export interface SourceActionWheelModel<ActionId extends string = string> {
  readonly label: string;
  readonly centerHtml: string;
  readonly actions: readonly SourceActionWheelAction<ActionId>[];
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

/** Shared radial action presenter. Callers own action policy and handle data-source-wheel-action. */
export function sourceActionWheelHtml<ActionId extends string>(model: SourceActionWheelModel<ActionId>): string {
  const buttons = model.actions.map((action, index) => {
    const angle = -90 + (360 / model.actions.length) * index;
    return `<button type="button" class="source-action-wheel-action" style="--action-angle:${angle}deg;--action-counter-angle:${-angle}deg" data-source-wheel-action="${escapeHtml(action.id)}"${action.enabled ? "" : " disabled"} title="${escapeHtml(action.hint)}"><b>${escapeHtml(action.symbol)}</b><span>${escapeHtml(action.label)}</span><small>${escapeHtml(action.hint)}</small></button>`;
  }).join("");
  return `<div class="source-action-wheel-backdrop" data-source-wheel-dismiss>
    <section class="source-action-wheel" role="dialog" aria-modal="true" aria-label="${escapeHtml(model.label)}">
      ${buttons}<button type="button" class="source-action-wheel-center" data-source-wheel-close aria-label="Annuler">${model.centerHtml}<small>Annuler</small></button>
    </section>
  </div>`;
}
