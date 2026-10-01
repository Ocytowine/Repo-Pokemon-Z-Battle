import { SOURCE_MAP_ID, selectEventPage, type ImportedAvatar, type ImportedMapAssets }
  from "./imported-map.js";
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
  readonly canChangeScene: boolean;
}

export class SourceOverworldHud {
  public constructor(private readonly onStartPendingEncounter: () => void) {}

  public render(model: SourceOverworldHudModel): void {
    const { assets, avatar, eventState } = model;
    const name = document.querySelector<HTMLElement>("#map-name");
    if (name !== null) name.textContent = `${assets.map.name} · Map${String(assets.map.id).padStart(3, "0")}`;
    const tick = document.querySelector<HTMLElement>("#tick");
    if (tick !== null) tick.textContent = `${avatar.x},${avatar.y}`;
    this.renderProgress(model);
    const log = document.querySelector<HTMLElement>("#events");
    if (log !== null) log.textContent = model.notice;
    const legend = document.querySelector<HTMLElement>("#map-legend");
    if (legend !== null) legend.innerHTML = `<span class="source"></span>Graphismes locaux originaux <span class="door"></span>Origine d'un transfert`;
    document.querySelectorAll<HTMLButtonElement>("[data-map]").forEach((button) =>
      button.classList.toggle("active", button.dataset.map === SOURCE_MAP_ID));
    document.querySelectorAll<HTMLElement>("[data-controller]").forEach((controller) =>
      controller.classList.toggle("disabled", controller.dataset.controller === "opponent"));
    const reset = document.querySelector<HTMLButtonElement>("#reset");
    if (reset !== null) {
      reset.disabled = !model.canChangeScene;
      reset.textContent = eventState.checkpoint === null ? "Réinitialiser la position" : "Revenir au point de reprise";
    }
    const create = document.querySelector<HTMLButtonElement>("#create-room");
    if (create !== null) create.disabled = true;
    const join = document.querySelector<HTMLButtonElement>("#join-room");
    if (join !== null) join.disabled = true;
    const guide = document.querySelector<HTMLElement>("#coop-guide");
    if (guide !== null) guide.innerHTML = `<article><span>9.5</span><strong>Choix et conditions</strong><small>Les branches imbriquées suivent la réponse et l'état courant.</small></article><article><span>REPRISE</span><strong>Point de soin</strong><small>L'infirmière mémorise la carte et la position de retour.</small></article><article><span>COMBAT</span><strong>Rencontre source</strong><small>L'équipe persistante affronte le Pokémon sauvage puis récupère ses PV, statuts et PP.</small></article>`;
    const guidePhase = document.querySelector<HTMLElement>("#guide-phase");
    if (guidePhase !== null) guidePhase.textContent = "Phase 9.5";
    const guideTitle = document.querySelector<HTMLElement>("#guide-title");
    if (guideTitle !== null) guideTitle.textContent = "État des événements";
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
