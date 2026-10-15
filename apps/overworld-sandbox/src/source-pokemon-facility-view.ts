export interface SourcePokemonFacilityShell {
  readonly kind: "ranch" | "day-care" | "incubator";
  readonly title: string;
  readonly subtitle: string;
  readonly teamCount: number;
  readonly facilityEyebrow: string;
  readonly facilityTitle: string;
  readonly facilityMeta: string;
  readonly teamHtml: string;
  readonly contentHtml: string;
  readonly overlayHtml?: string;
}

function escape(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Responsive facility frame shared by finite services and future Ranch/Incubator presentation. */
export function sourcePokemonFacilityShellHtml(model: SourcePokemonFacilityShell): string {
  return `<header class="source-ranch-header"><div><strong>${escape(model.title)}</strong><span>${escape(model.subtitle)}</span></div>
      <button type="button" data-facility-close aria-label="Fermer">×</button></header>
    <div class="source-ranch-workspace source-pokemon-facility" data-facility="${model.kind}" data-team-expanded="true">
      <div class="source-ranch-toolbar">
        <section class="source-ranch-team-heading"><div><small>ÉQUIPE</small><strong>Vos compagnons</strong></div><span class="source-facility-count">${model.teamCount}/6</span></section>
        <section class="source-ranch-storage-heading"><div><small>${escape(model.facilityEyebrow)}</small><strong>${escape(model.facilityTitle)}</strong></div><span>${escape(model.facilityMeta)}</span></section>
      </div><div class="source-ranch-tools-slot"></div>
      <div class="source-ranch-content">
        <aside class="source-ranch-team" aria-label="Équipe Pokémon"><div class="source-ranch-team-list">${model.teamHtml}</div></aside>
        <section class="source-ranch-storage source-facility-storage">${model.contentHtml}</section>
      </div>
    </div>${model.overlayHtml ?? ""}`;
}
