import { sourceSavePreview, type CloudSaveItem } from "./source-cloud-sync.js";
import { sourceImportBackupExists, sourceSaveSlotSummaries,
  type SourceSaveKind, type SourceSaveSlotId } from "./source-save-slots.js";
import { originalSaveFolderSearchAvailable, type OriginalSaveCandidate } from "./source-save-locator.js";
import type { RxdataImportPreview } from "./source-rxdata-import.js";
import { loadSourceNewGameDraft } from "./source-new-game.js";

export interface SourceLaunchActions {
  select(slot: SourceSaveSlotId, kind: SourceSaveKind): void;
  newGame(slot: SourceSaveSlotId): void;
  prepareImport(file: File): Promise<void>;
  searchFolder(): Promise<void>;
  prepareFoundSave(candidate: OriginalSaveCandidate): Promise<void>;
  confirmImport(slot: SourceSaveSlotId): void;
  cancelImport(): void;
  restoreImportBackup(slot: SourceSaveSlotId): void;
  deleteSave(slot: SourceSaveSlotId): void;
  cloudConnect(): void;
  cloudSync(): void;
  cloudRecover(slot: SourceSaveSlotId, kind: SourceSaveKind): void;
  cloudKeepLocal(slot: SourceSaveSlotId, kind: SourceSaveKind): void;
  checkUpdate(): void;
  downloadUpdate(): void;
  back(): void;
}

type LaunchTab = "saves" | "import" | "cloud" | "version";

/** Personal launch UI. Selection loads the same local snapshot in solo and Coop. */
export class SourceLaunchScreen {
  private tab: LaunchTab = "saves";
  private cloudPage = 0;
  private importStatus = "";
  private foundSaves: readonly OriginalSaveCandidate[] | null = null;
  private foundPage = 0;
  private importPreview: { readonly fileName: string; readonly value: RxdataImportPreview } | null = null;

  public constructor(private readonly root: HTMLElement, private readonly storage: Pick<Storage, "getItem">,
    private readonly actions: SourceLaunchActions) {}

  public get open(): boolean { return !this.root.hidden; }
  public hide(): void { this.root.hidden = true; }
  public show(): void { this.tab = "saves"; this.foundSaves = null; this.importPreview = null; this.root.hidden = false; this.render(); }
  public setImportStatus(status: string): void { this.tab = "import"; this.importStatus = status; this.render(); }
  public clearImportSelection(): void { this.foundSaves = null; this.importPreview = null; this.importStatus = ""; this.render(); }
  public showImportPreview(fileName: string, preview: RxdataImportPreview): void {
    this.tab = "import";
    this.foundSaves = null;
    this.importPreview = { fileName, value: preview };
    this.importStatus = "";
    this.render();
  }
  public showFoundSaves(candidates: readonly OriginalSaveCandidate[], limited: boolean): void {
    this.tab = "import";
    this.foundSaves = candidates;
    this.foundPage = 0;
    this.importStatus = candidates.length === 0
      ? limited ? "Dossier trop vaste : sélectionne plutôt le dossier Pokémon Z V2.12 - Français."
        : "Aucun Game.rxdata trouvé. Sélectionne le dossier du jeu, pas Data ou Graphics."
      : `${candidates.length} sauvegarde(s) trouvée(s)${limited ? " avant la limite de recherche" : ""}.`;
    this.render();
  }

  public render(cloudStatus = "Connexion non vérifiée", cloudItems: readonly CloudSaveItem[] = [],
    updateStatus = "Vérification en attente", updateAvailable = false, busy = false): void {
    if (!this.open) return;
    this.root.innerHTML = `<div class="source-launch-panel"><header><div><small>POKÉMON Z</small><h1>Choisir une partie</h1></div><button type="button" data-back>Retour au titre</button></header>
      <nav class="source-launch-tabs" aria-label="Rubriques de démarrage"></nav><div class="source-launch-view"></div></div>`;
    this.root.querySelector<HTMLButtonElement>("[data-back]")!.onclick = this.actions.back;
    const tabs = this.root.querySelector<HTMLElement>(".source-launch-tabs")!;
    for (const [tab, label] of [["saves", "Parties"], ["import", "Import"], ["cloud", "Cloud"], ["version", "Version"]] as const) {
      const button = this.button(tabs, label, () => { this.tab = tab; this.render(cloudStatus, cloudItems,
        updateStatus, updateAvailable, busy); });
      button.setAttribute("aria-current", this.tab === tab ? "page" : "false");
    }
    const view = this.root.querySelector<HTMLElement>(".source-launch-view")!;
    if (this.tab === "saves") this.renderSaves(view);
    else if (this.tab === "import") this.renderImport(view);
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
      const removable = summary.manual !== null || summary.auto !== null
        || sourceImportBackupExists(this.storage, summary.id)
        || loadSourceNewGameDraft(this.storage, summary.id) !== null;
      const remove = this.button(card, "Supprimer la partie", () => this.actions.deleteSave(summary.id), !removable);
      remove.className = "source-launch-delete-save";
      view.append(card);
    }
  }

  private renderImport(view: HTMLElement): void {
    view.className += " source-launch-service source-launch-import";
    if (this.importPreview !== null) {
      if (this.importStatus !== "") {
        const status = document.createElement("p");
        status.className = "source-launch-import-status";
        status.role = "status";
        status.textContent = this.importStatus;
        view.append(status);
      }
      this.renderImportPreview(view);
      return;
    }
    if (this.foundSaves !== null) {
      this.renderFoundSaves(view);
      return;
    }
    const heading = document.createElement("h2");
    heading.textContent = "Importer une sauvegarde Pokémon Z";
    const guide = document.createElement("p");
    guide.className = "source-launch-import-guide";
    guide.textContent = "Choisis Game.rxdata ou Game_2.rxdata dans le dossier Pokémon Z V2.12 - Français. Tu choisiras la partie de destination après vérification du fichier.";
    view.append(heading, guide);
    if (this.importStatus !== "") {
      const status = document.createElement("p");
      status.className = "source-launch-import-status";
      status.role = "status";
      status.textContent = this.importStatus;
      view.append(status);
    }
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = ".rxdata,application/octet-stream";
    picker.hidden = true;
    picker.setAttribute("aria-label", "Sauvegarde Pokémon Z à importer");
    picker.onchange = () => {
      const file = picker.files?.[0];
      if (file !== undefined) void this.actions.prepareImport(file);
      picker.value = "";
    };
    view.append(picker);
    const actions = document.createElement("div");
    actions.className = "source-launch-service-actions";
    this.button(actions, "Choisir le fichier de sauvegarde", () => picker.click());
    if (originalSaveFolderSearchAvailable()) {
      const search = this.button(actions, "Rechercher dans un dossier choisi", () => {
        void this.actions.searchFolder();
      });
      search.className = "source-launch-search-helper";
      search.title = "Choisis le dossier Pokémon Z, pas Data ou Graphics.";
    }
    view.append(actions);
    for (const summary of sourceSaveSlotSummaries(this.storage)) {
      if (!sourceImportBackupExists(this.storage, summary.id)) continue;
      const restore = document.createElement("div");
      restore.className = "source-launch-import-restore";
      this.button(restore, `Restaurer l'ancienne Partie ${summary.id}`,
        () => this.actions.restoreImportBackup(summary.id));
      view.append(restore);
    }
  }

  private renderImportPreview(view: HTMLElement): void {
    const { fileName, value } = this.importPreview!;
    const heading = document.createElement("h2");
    heading.textContent = "Choisir la partie de destination";
    const details = document.createElement("p");
    details.textContent = `${fileName} · ${value.trainerName} · Carte ${value.snapshot.worldSave?.mapId ?? "?"} · Équipe ${value.partyCount}/6 · Boîtes ${value.storageCount} · Objets ${value.itemCount}`;
    view.append(heading, details);
    if (value.warnings.length > 0) {
      const message = document.createElement("p");
      message.className = "source-launch-import-warning";
      message.textContent = `${value.warnings.length} limite(s) de conversion : détails affichés avant confirmation.`;
      view.append(message);
    }
    const slots = document.createElement("div");
    slots.className = "source-launch-import-slots";
    for (const summary of sourceSaveSlotSummaries(this.storage)) {
      const occupied = summary.manual !== null || summary.auto !== null;
      const card = document.createElement("div");
      card.className = "source-launch-import-slot";
      const label = document.createElement("span");
      label.textContent = `Partie ${summary.id} · ${occupied ? "occupée — copie de secours prévue" : "vide"}`;
      card.append(label);
      this.button(card, `Importer dans Partie ${summary.id}`, () => this.actions.confirmImport(summary.id));
      slots.append(card);
    }
    view.append(slots);
    const note = document.createElement("p");
    note.textContent = "Le fichier original reste intact. Le cloud attendra une synchronisation manuelle.";
    view.append(note);
    this.button(view, "Annuler l'import", () => { this.actions.cancelImport(); this.clearImportSelection(); });
  }

  private renderFoundSaves(view: HTMLElement): void {
    const result = this.foundSaves!;
    view.className += " source-launch-found";
    const heading = document.createElement("h2");
    heading.textContent = "Sauvegardes trouvées";
    const status = document.createElement("p");
    status.role = "status";
    status.textContent = this.importStatus;
    view.append(heading, status);
    for (const candidate of result.slice(this.foundPage * 4, this.foundPage * 4 + 4)) {
      const row = document.createElement("div");
      row.className = "source-launch-save";
      const label = document.createElement("span");
      label.textContent = candidate.path;
      label.title = candidate.path;
      row.append(label);
      this.button(row, "Choisir", () => { void this.actions.prepareFoundSave(candidate); });
      view.append(row);
    }
    const navigation = document.createElement("div");
    navigation.className = "source-launch-service-actions";
    this.button(navigation, "Retour à l'import", () => { this.foundSaves = null; this.render(); });
    this.button(navigation, "Autre dossier", () => { void this.actions.searchFolder(); });
    if (result.length > 4) {
      this.button(navigation, "Précédent", () => { this.foundPage -= 1; this.render(); }, this.foundPage === 0);
      this.button(navigation, "Suivant", () => { this.foundPage += 1; this.render(); },
        (this.foundPage + 1) * 4 >= result.length);
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
