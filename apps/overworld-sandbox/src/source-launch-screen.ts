import { sourceSavePreview, type CloudSaveItem } from "./source-cloud-sync.js";
import { sourceSaveSlotSummaries, type SourceSaveKind, type SourceSaveSlotId } from "./source-save-slots.js";

export interface SourceLaunchActions {
  select(slot: SourceSaveSlotId, kind: SourceSaveKind): void;
  newGame(slot: SourceSaveSlotId): void;
  cloudConnect(): void;
  cloudSync(): void;
  cloudRecover(slot: SourceSaveSlotId, kind: SourceSaveKind): void;
  cloudKeepLocal(slot: SourceSaveSlotId, kind: SourceSaveKind): void;
  checkUpdate(): void;
  downloadUpdate(): void;
  back(): void;
}

type LaunchTab = "saves" | "cloud" | "version";

/** Personal launch UI. Selection loads the same local snapshot in solo and Coop. */
export class SourceLaunchScreen {
  private tab: LaunchTab = "saves";
  private cloudPage = 0;

  public constructor(private readonly root: HTMLElement, private readonly storage: Pick<Storage, "getItem">,
    private readonly actions: SourceLaunchActions) {}

  public get open(): boolean { return !this.root.hidden; }
  public hide(): void { this.root.hidden = true; }
  public show(): void { this.tab = "saves"; this.root.hidden = false; this.render(); }

  public render(cloudStatus = "Connexion non vérifiée", cloudItems: readonly CloudSaveItem[] = [],
    updateStatus = "Vérification en attente", updateAvailable = false, busy = false): void {
    if (!this.open) return;
    this.root.innerHTML = `<div class="source-launch-panel"><header><div><small>POKÉMON Z</small><h1>Choisir une partie</h1></div><button type="button" data-back>Retour au titre</button></header>
      <nav class="source-launch-tabs" aria-label="Rubriques de démarrage"></nav><div class="source-launch-view"></div></div>`;
    this.root.querySelector<HTMLButtonElement>("[data-back]")!.onclick = this.actions.back;
    const tabs = this.root.querySelector<HTMLElement>(".source-launch-tabs")!;
    for (const [tab, label] of [["saves", "Parties"], ["cloud", "Cloud"], ["version", "Version"]] as const) {
      const button = this.button(tabs, label, () => { this.tab = tab; this.render(cloudStatus, cloudItems,
        updateStatus, updateAvailable, busy); });
      button.setAttribute("aria-current", this.tab === tab ? "page" : "false");
    }
    const view = this.root.querySelector<HTMLElement>(".source-launch-view")!;
    if (this.tab === "saves") this.renderSaves(view);
    else if (this.tab === "cloud") this.renderCloud(view, cloudStatus, cloudItems,
      updateStatus, updateAvailable, busy);
    else this.renderVersion(view, updateStatus, updateAvailable);
  }

  private renderSaves(view: HTMLElement): void {
    view.className += " source-launch-slots";
    for (const summary of sourceSaveSlotSummaries(this.storage)) {
      const card = document.createElement("article");
      card.className = "source-launch-slot";
      const title = document.createElement("h2");
      title.textContent = `Partie ${summary.id}`;
      card.append(title);
      for (const kind of ["manual", "auto"] as const) {
        const snapshot = summary[kind];
        if (snapshot === null) continue;
        const preview = sourceSavePreview(snapshot);
        const row = document.createElement("div");
        row.className = "source-launch-save";
        const info = document.createElement("span");
        info.textContent = `${kind === "manual" ? "Manuelle" : "Automatique"} · ${new Date(snapshot.savedAt).toLocaleString("fr-FR")} · ${preview.playerName}${preview.mapId === null ? "" : ` · Carte ${preview.mapId}`} · Équipe ${preview.partySize}/6`;
        info.title = info.textContent;
        row.append(info);
        this.button(row, kind === "manual" ? "Reprendre" : "Reprendre l'auto",
          () => this.actions.select(summary.id, kind));
        card.append(row);
      }
      if (summary.manual === null && summary.auto === null) {
        const empty = document.createElement("p");
        empty.textContent = "Aucune sauvegarde locale.";
        card.append(empty);
        this.button(card, "Nouvelle aventure", () => this.actions.newGame(summary.id));
      }
      view.append(card);
    }
  }

  private renderCloud(view: HTMLElement, status: string, items: readonly CloudSaveItem[],
    updateStatus: string, updateAvailable: boolean, busy: boolean): void {
    view.className += " source-launch-service";
    const heading = document.createElement("h2");
    heading.textContent = "Sauvegardes cloud";
    const message = document.createElement("p");
    message.textContent = status;
    message.title = status;
    const actions = document.createElement("div");
    actions.className = "source-launch-service-actions";
    this.button(actions, "Se connecter", this.actions.cloudConnect, busy);
    this.button(actions, "Synchroniser", this.actions.cloudSync, busy);
    view.append(heading, message, actions);
    const choices = items.filter((entry) => entry.state === "cloud-only" || entry.state === "conflict");
    if (choices.length === 0) return;
    this.cloudPage = Math.min(this.cloudPage, choices.length - 1);
    const item = choices[this.cloudPage]!;
    const row = document.createElement("div");
    row.className = "source-launch-cloud-item";
    const label = document.createElement("span");
    label.textContent = `Partie ${item.slot} ${item.kind === "manual" ? "manuelle" : "automatique"} · ${item.state === "conflict" ? "conflit" : "cloud uniquement"} · ${item.remoteAt === null ? "date inconnue" : new Date(item.remoteAt).toLocaleString("fr-FR")}`;
    const itemActions = document.createElement("div");
    this.button(itemActions, "Récupérer", () => this.actions.cloudRecover(item.slot, item.kind), busy);
    if (item.state === "conflict") this.button(itemActions, "Garder la locale",
      () => this.actions.cloudKeepLocal(item.slot, item.kind), busy);
    row.append(label, itemActions);
    view.append(row);
    if (choices.length > 1) {
      const pages = document.createElement("div");
      pages.className = "source-launch-pages";
      this.button(pages, "Précédent", () => { this.cloudPage -= 1;
        this.render(status, items, updateStatus, updateAvailable, busy); }, this.cloudPage === 0);
      const count = document.createElement("span");
      count.textContent = `${this.cloudPage + 1} / ${choices.length}`;
      pages.append(count);
      this.button(pages, "Suivant", () => { this.cloudPage += 1;
        this.render(status, items, updateStatus, updateAvailable, busy); },
        this.cloudPage === choices.length - 1);
      view.append(pages);
    }
  }

  private renderVersion(view: HTMLElement, status: string, available: boolean): void {
    view.className += " source-launch-service";
    const heading = document.createElement("h2");
    heading.textContent = "Version de l'application";
    const message = document.createElement("p");
    message.textContent = status;
    message.title = status;
    const actions = document.createElement("div");
    actions.className = "source-launch-service-actions";
    this.button(actions, "Vérifier", this.actions.checkUpdate);
    if (available) this.button(actions, "Télécharger", this.actions.downloadUpdate);
    view.append(heading, message, actions);
  }

  private button(parent: HTMLElement, label: string, action: () => void, disabled = false): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.disabled = disabled;
    button.onclick = action;
    parent.append(button);
    return button;
  }
}
