import { sourceSavePreview, type CloudSaveItem } from "./source-cloud-sync.js";
import { sourceImportBackupExists, sourceSaveSlotSummaries,
  type SourceSaveKind, type SourceSaveSlotId } from "./source-save-slots.js";
import { originalSaveFolderSearchAvailable, type OriginalSaveCandidate } from "./source-save-locator.js";

export interface SourceLaunchActions {
  select(slot: SourceSaveSlotId, kind: SourceSaveKind): void;
  newGame(slot: SourceSaveSlotId): void;
  importSave(slot: SourceSaveSlotId, file: File): Promise<void>;
  searchFolder(slot: SourceSaveSlotId): Promise<void>;
  importFoundSave(slot: SourceSaveSlotId, candidate: OriginalSaveCandidate): Promise<void>;
  restoreImportBackup(slot: SourceSaveSlotId): void;
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
  private importStatus = "";
  private foundSaves: { readonly slot: SourceSaveSlotId; readonly candidates: readonly OriginalSaveCandidate[] } | null = null;
  private foundPage = 0;

  public constructor(private readonly root: HTMLElement, private readonly storage: Pick<Storage, "getItem">,
    private readonly actions: SourceLaunchActions) {}

  public get open(): boolean { return !this.root.hidden; }
  public hide(): void { this.root.hidden = true; }
  public show(): void { this.tab = "saves"; this.foundSaves = null; this.root.hidden = false; this.render(); }
  public setImportStatus(status: string): void { this.importStatus = status; this.render(); }
  public showFoundSaves(slot: SourceSaveSlotId, candidates: readonly OriginalSaveCandidate[]): void {
    this.foundSaves = { slot, candidates };
    this.foundPage = 0;
    this.importStatus = candidates.length === 0
      ? "Aucun Game.rxdata trouvé. Si le jeu est dans Android/data, copie la sauvegarde dans Téléchargements."
      : `${candidates.length} sauvegarde(s) trouvée(s), classées par pertinence.`;
    this.render();
  }

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
    if (this.foundSaves !== null) {
      this.renderFoundSaves(view);
      return;
    }
    if (this.importStatus !== "") {
      const status = document.createElement("p");
      status.className = "source-launch-import-status";
      status.role = "status";
      status.textContent = this.importStatus;
      view.append(status);
    }
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
      const picker = document.createElement("input");
      picker.type = "file";
      picker.accept = ".rxdata,application/octet-stream";
      picker.hidden = true;
      picker.setAttribute("aria-label", `Sauvegarde Pokémon Z pour la partie ${summary.id}`);
      picker.onchange = () => {
        const file = picker.files?.[0];
        if (file !== undefined) void this.actions.importSave(summary.id, file);
        picker.value = "";
      };
      card.append(picker);
      this.button(card, "Importer Game.rxdata", () => picker.click());
      if (originalSaveFolderSearchAvailable()) {
        this.button(card, "Chercher dans un dossier", () => { void this.actions.searchFolder(summary.id); });
      }
      if (sourceImportBackupExists(this.storage, summary.id)) {
        this.button(card, "Restaurer la partie précédente", () => this.actions.restoreImportBackup(summary.id));
      }
      view.append(card);
    }
  }

  private renderFoundSaves(view: HTMLElement): void {
    const result = this.foundSaves!;
    view.className += " source-launch-found";
    const heading = document.createElement("h2");
    heading.textContent = `Recherche pour la partie ${result.slot}`;
    const status = document.createElement("p");
    status.role = "status";
    status.textContent = this.importStatus;
    view.append(heading, status);
    for (const candidate of result.candidates.slice(this.foundPage * 4, this.foundPage * 4 + 4)) {
      const row = document.createElement("div");
      row.className = "source-launch-save";
      const label = document.createElement("span");
      label.textContent = candidate.path;
      label.title = candidate.path;
      row.append(label);
      this.button(row, "Importer", () => { void this.actions.importFoundSave(result.slot, candidate); });
      view.append(row);
    }
    const navigation = document.createElement("div");
    navigation.className = "source-launch-service-actions";
    this.button(navigation, "Retour aux parties", () => { this.foundSaves = null; this.render(); });
    this.button(navigation, "Autre dossier", () => { void this.actions.searchFolder(result.slot); });
    if (result.candidates.length > 4) {
      this.button(navigation, "Précédent", () => { this.foundPage -= 1; this.render(); }, this.foundPage === 0);
      this.button(navigation, "Suivant", () => { this.foundPage += 1; this.render(); },
        (this.foundPage + 1) * 4 >= result.candidates.length);
    }
    view.append(navigation);
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
