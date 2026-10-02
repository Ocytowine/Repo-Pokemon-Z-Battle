import { selectEventPage, type ImportedAvatar, type ImportedMapAssets } from "./imported-map.js";
import type { SourceEventState } from "./source-event-state.js";
import { escapeSourceHtml } from "./source-menu-view.js";

export interface SourceOverworldHudModel {
  readonly assets: ImportedMapAssets;
  readonly avatar: ImportedAvatar;
  readonly eventState: SourceEventState;
  readonly battleActive: boolean;
  readonly sequenceStatus: string;
  readonly notice: string;
  readonly parallelAuditNotice: string | null;
  readonly sceneAuditNotice: string | null;
}

export class SourceOverworldHud {
  public constructor(private readonly onStartPendingEncounter: () => void) {}

  public render(model: SourceOverworldHudModel): void {
    const { avatar } = model;
    const tick = document.querySelector<HTMLElement>("#tick");
    if (tick !== null) tick.textContent = `${avatar.x},${avatar.y}`;
    this.renderProgress(model);
    const log = document.querySelector<HTMLElement>("#events");
    if (log !== null) log.textContent = model.notice;
  }

  private renderProgress(model: SourceOverworldHudModel): void {
    const progress = document.querySelector<HTMLElement>("#progress");
    if (progress === null) return;
    const { assets, eventState } = model;
    const visibleEvents = assets.events.filter((event) => {
      const page = selectEventPage(event, assets.map.id, eventState);
      return page !== null && (page.graphic.characterName !== "" || page.graphic.tileId > 0);
    }).length;
    const inventory = Object.entries(eventState.inventory)
      .map(([itemId, quantity]) => `${assets.itemNames.get(itemId) ?? itemId} ×${quantity}`).join(", ") || "vide";
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
    progress.innerHTML = `<p><strong>Source</strong> tileset ${escapeSourceHtml(assets.tileset.tilesetName)}</p><p><strong>Carte</strong> ${assets.map.width} × ${assets.map.height} · ${visibleEvents} événements visibles</p><p><strong>Équipe</strong> ${escapeSourceHtml(party)}</p><p><strong>Rencontre</strong> ${encounterLabel}</p><p><strong>Argent</strong> ${eventState.money.toLocaleString("fr-FR")} ₽</p><p><strong>Inventaire</strong> ${escapeSourceHtml(inventory)}</p><p><strong>Reprise</strong> ${escapeSourceHtml(checkpointLabel)}</p><p><strong>Séquence</strong> ${escapeSourceHtml(model.sequenceStatus)}</p>${model.parallelAuditNotice === null ? "" : `<p><strong>Événement parallèle</strong> ${escapeSourceHtml(model.parallelAuditNotice)}</p>`}${model.sceneAuditNotice === null ? "" : `<p><strong>Audit scène</strong> ${escapeSourceHtml(model.sceneAuditNotice)}</p>`}`;
    progress.querySelector<HTMLButtonElement>("#start-source-encounter")
      ?.addEventListener("click", this.onStartPendingEncounter);
  }
}
