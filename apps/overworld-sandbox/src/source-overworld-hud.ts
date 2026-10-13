import { selectEventPage, type ImportedAvatar, type ImportedMapAssets } from "./imported-map.js";
import type { SourceEventState } from "./source-event-state.js";
import { escapeSourceHtml } from "./source-menu-view.js";
import type { SourceBattleReportSummary } from "./source-battle-report.js";

export interface SourceOverworldHudModel {
  readonly assets: ImportedMapAssets;
  readonly avatar: ImportedAvatar;
  readonly eventState: SourceEventState;
  readonly battleActive: boolean;
  readonly sequenceStatus: string;
  readonly notice: string;
  readonly hudNotice?: { readonly text: string; readonly kind: "info" | "error" } | null;
  readonly parallelAuditNotice: string | null;
  readonly sceneAuditNotice: string | null;
  readonly battleReport: SourceBattleReportSummary;
}

export class SourceOverworldHud {
  public constructor(
    private readonly onStartPendingEncounter: () => void,
    private readonly onDownloadBattleReport: () => void,
  ) {}

  public render(model: SourceOverworldHudModel): void {
    const { avatar } = model;
    const tick = document.querySelector<HTMLElement>("#tick");
    if (tick !== null) tick.textContent = `${avatar.x},${avatar.y}`;
    this.renderProgress(model);
    const log = document.querySelector<HTMLElement>("#events");
    if (log !== null) log.textContent = model.notice;
    const hudNotice = document.querySelector<HTMLElement>("#source-hud-notice");
    if (hudNotice !== null) {
      hudNotice.hidden = model.hudNotice === null || model.hudNotice === undefined;
      hudNotice.textContent = model.hudNotice?.text ?? "";
      hudNotice.dataset.kind = model.hudNotice?.kind ?? "info";
    }
  }

  private renderProgress(model: SourceOverworldHudModel): void {
    const progress = document.querySelector<HTMLElement>("#progress");
    if (progress === null) return;
    const { assets, eventState } = model;
    const visibleEvents = assets.events.filter((event) => {
      const page = selectEventPage(event, assets.map.id, eventState);
      return page !== null && (page.graphic.characterName !== "" || page.graphic.tileId > 0);
    }).length;
    const inventoryEntries = Object.entries(eventState.inventory).filter(([, quantity]) => quantity > 0);
    const inventory = inventoryEntries
      .map(([itemId, quantity]) => `${assets.itemNames.get(itemId) ?? itemId} ×${quantity}`).join(", ") || "vide";
    const inventoryQuantity = inventoryEntries.reduce((total, [, quantity]) => total + quantity, 0);
    const checkpoint = eventState.checkpoint;
    const checkpointLabel = checkpoint === null ? "Bourg Canvas · 28,15"
      : `Map${String(checkpoint.mapId).padStart(3, "0")} · ${checkpoint.x},${checkpoint.y}`;
    const speciesName = (species: string): string => assets.battleCatalog.pokemon
      .find((entry) => entry.internalName === species)?.name ?? species;
    const party = eventState.party.members.length === 0 ? "vide (starter non choisi)"
      : eventState.party.members.map((member) => `${member.nickname ?? speciesName(member.species)} N.${member.level} · ${member.hp}/${member.stats.maxHp} PV · ${member.experience} EXP`).join(", ");
    const pendingEncounter = eventState.pendingEncounter;
    const encounterLabel = pendingEncounter === null ? "aucune" : !model.battleActive
      ? `${escapeSourceHtml(speciesName(pendingEncounter.species))} N.${pendingEncounter.level} en attente <button id="start-source-encounter">Lancer</button>`
      : `${escapeSourceHtml(speciesName(pendingEncounter.species))} N.${pendingEncounter.level} en cours`;
    const report = model.battleReport;
    const reportLabel = !report.available ? "aucun rapport"
      : `${report.active ? "en cours" : "terminé"} · ${report.turns} tour(s) · ${report.mode ?? "local"}`;
    progress.innerHTML = `<p><strong>Source</strong> tileset ${escapeSourceHtml(assets.tileset.tilesetName)}</p><p><strong>Carte</strong> ${assets.map.width} × ${assets.map.height} · ${visibleEvents} événements visibles</p><details><summary><strong>Équipe</strong> ${eventState.party.members.length} Pokémon</summary><p>${escapeSourceHtml(party)}</p></details><p><strong>Rencontre</strong> ${encounterLabel}</p><p><strong>Argent</strong> ${eventState.money.toLocaleString("fr-FR")} ₽</p><details><summary><strong>Inventaire</strong> ${inventoryEntries.length} sorte(s) · ${inventoryQuantity} objet(s)</summary><p>${escapeSourceHtml(inventory)}</p></details><p><strong>Reprise</strong> ${escapeSourceHtml(checkpointLabel)}</p><p><strong>Séquence</strong> ${escapeSourceHtml(model.sequenceStatus)}</p>${model.parallelAuditNotice === null ? "" : `<p><strong>Événement parallèle</strong> ${escapeSourceHtml(model.parallelAuditNotice)}</p>`}${model.sceneAuditNotice === null ? "" : `<p><strong>Audit scène</strong> ${escapeSourceHtml(model.sceneAuditNotice)}</p>`}<section class="battle-report-summary"><strong>Rapport combat</strong><span>${escapeSourceHtml(reportLabel)}</span><button id="download-source-battle-report" type="button"${report.available ? "" : " disabled"}>Télécharger le JSON</button></section>`;
    progress.querySelector<HTMLButtonElement>("#start-source-encounter")
      ?.addEventListener("click", this.onStartPendingEncounter);
    progress.querySelector<HTMLButtonElement>("#download-source-battle-report")
      ?.addEventListener("click", this.onDownloadBattleReport);
  }
}
