import { createDefaultPlayerAvatarSelection, loadPlayerAvatarSelection, parsePlayerProfile, persistPlayerAvatarSelection,
  PLAYER_AVATAR_ACTIVE_STORAGE_KEY, PLAYER_AVATAR_DRAFT_STORAGE_KEY, type PlayerAvatarSelection,
  type PlayerProfile } from "@pokemon-z-battle/player-state";
import { AVATAR_PALETTE_COLORS, loadRecoloredAvatarCanvas } from "@pokemon-z-battle/local-assets";

export const AVATAR_LAB_MAP_ID = "avatar-lab";
export const AVATAR_LAB_STORAGE_KEY = PLAYER_AVATAR_DRAFT_STORAGE_KEY;

interface AssetReference { readonly path: string | null; readonly native: boolean; readonly fallbackContext: string | null }
interface AvatarRecord { readonly id: string; readonly presentation: "masculine" | "feminine";
  readonly legacyPalette: "classic" | "light" | "dark";
  readonly assets: Readonly<Record<string, AssetReference>>; readonly battleBackVariants: readonly string[] }
interface AvatarCatalog { readonly records: readonly AvatarRecord[] }
interface AuditProfile { readonly id: string; readonly missing: readonly string[]; readonly fallbacks: readonly string[];
  readonly missingBattleBackVariants: readonly number[] }
interface AuditReport { readonly profiles: readonly AuditProfile[] }
type StoredLabState = PlayerAvatarSelection;

function sourceUrl(path: string): string { return `/__pokemon-z/source/${path.split("/").map(encodeURIComponent).join("/")}`; }
function freshState(): StoredLabState { return createDefaultPlayerAvatarSelection(); }
function loadState(storage: Pick<Storage, "getItem" | "removeItem">, key = AVATAR_LAB_STORAGE_KEY): StoredLabState {
  return loadPlayerAvatarSelection(storage, key);
}

export class AvatarLabView {
  private catalog: AvatarCatalog | null = null;
  private report: AuditReport | null = null;
  private state = loadState(localStorage);
  private activeState = loadState(localStorage, PLAYER_AVATAR_ACTIVE_STORAGE_KEY);
  private overworldAnimationSession = 0;

  public constructor(private readonly root: HTMLElement,
    private readonly onApply: (selection: PlayerAvatarSelection) => void | Promise<void> = () => undefined,
    private readonly onClose: () => void = () => undefined) {}

  public async load(): Promise<void> {
    const responses = await Promise.all([fetch("/__pokemon-z/data/player-avatars.json"), fetch("/__pokemon-z/data/player-avatar-report.json")]);
    if (responses.some((response) => !response.ok)) throw new Error("Catalogue des personnages indisponible.");
    [this.catalog, this.report] = await Promise.all([responses[0]!.json() as Promise<AvatarCatalog>, responses[1]!.json() as Promise<AuditReport>]);
    if (!this.catalog.records.some((record) => record.id === this.state.avatarId)) this.state = freshState();
  }

  public show(): void { this.root.hidden = false; this.render(); }
  public hide(): void { this.root.hidden = true; this.overworldAnimationSession += 1; }

  private save(profile: PlayerProfile = this.state.profile): void {
    this.state = { ...this.state, profile: parsePlayerProfile(profile) };
    persistPlayerAvatarSelection(localStorage, AVATAR_LAB_STORAGE_KEY, this.state); this.render();
  }

  private render(): void {
    if (this.root.hidden) return;
    const record = this.catalog?.records.find((candidate) => candidate.id === this.state.avatarId);
    if (record === undefined) { this.root.textContent = "Chargement du catalogue des personnages…"; return; }
    const colorOptions = Object.keys(AVATAR_PALETTE_COLORS).map((id) => `<option value="${id}">${id}</option>`).join("");
    this.root.innerHTML = `<div class="embedded-avatar-editor"><label>Nom<input data-avatar-name maxlength="12"></label>
      <label>Pronoms<select data-avatar-pronouns><option value="masculine">Masculins</option><option value="feminine">Féminins</option><option value="neutral">Neutres</option></select></label>
      <div class="embedded-avatar-options"></div><label>Animation<select data-avatar-context><option value="overworld">Marche</option><option value="run">Course</option><option value="bicycle">Vélo</option><option value="surf">Surf</option><option value="fish">Pêche</option><option value="fishSurf">Pêche en surf</option><option value="dive">Plongée</option></select></label>
      <div class="embedded-avatar-colors"><label>Principale<select data-color="primary">${colorOptions}</select></label><label>Secondaire<select data-color="secondary">${colorOptions}</select></label><label>Accent<select data-color="accent">${colorOptions}</select></label></div>
      <p class="embedded-avatar-note">Les modifications restent en brouillon jusqu’à leur application. La sauvegarde de l’aventure n’est pas réinitialisée.</p>
      <div class="embedded-avatar-actions"><button type="button" class="embedded-avatar-return">Retour au jeu</button>
      <button type="button" class="embedded-avatar-apply">Appliquer au joueur</button></div></div>
      <div class="embedded-avatar-previews"><article><canvas width="150" height="150"></canvas><strong>Overworld</strong><small data-avatar-context-detail></small></article>
      <article><img data-avatar-front alt="Face du Dresseur"><strong>Face</strong></article><article><img data-avatar-back alt="Dos du Dresseur"><strong>Dos de combat fixe</strong><small data-avatar-back-detail></small></article><div data-avatar-audit class="embedded-avatar-audit"></div></div>`;
    const name = this.root.querySelector<HTMLInputElement>("[data-avatar-name]")!; name.value = this.state.profile.displayName;
    const pronouns = this.root.querySelector<HTMLSelectElement>("[data-avatar-pronouns]")!; pronouns.value = this.state.profile.pronouns;
    const options = this.root.querySelector<HTMLElement>(".embedded-avatar-options")!;
    for (const candidate of this.catalog!.records) { const button = document.createElement("button"); button.type = "button";
      button.className = candidate.id === record.id ? "selected" : ""; const image = document.createElement("img"); const front = candidate.assets.battleFront?.path;
      if (front !== null && front !== undefined) image.src = sourceUrl(front); button.append(image);
      const label = document.createElement("span"); label.textContent = `${candidate.presentation === "masculine" ? "A" : "B"} · ${candidate.legacyPalette}`; button.append(label);
      button.addEventListener("click", () => { this.state = { ...this.state, avatarId: candidate.id, profile: { ...this.state.profile,
        bodyModel: `legacy-${candidate.presentation}`, skinTone: candidate.legacyPalette, hairColor: `legacy-${candidate.legacyPalette}` } }; this.save(); }); options.append(button); }
    name.addEventListener("change", () => this.save({ ...this.state.profile, displayName: name.value.trim() || "Joueur" }));
    pronouns.addEventListener("change", () => this.save({ ...this.state.profile, pronouns: pronouns.value as PlayerProfile["pronouns"] }));
    this.root.querySelectorAll<HTMLSelectElement>("[data-color]").forEach((select) => { const key = select.dataset.color as keyof PlayerProfile["colors"];
      select.value = this.state.profile.colors[key]; select.addEventListener("change", () => this.save({ ...this.state.profile,
        colors: { ...this.state.profile.colors, [key]: select.value } })); });
    const apply = this.root.querySelector<HTMLButtonElement>(".embedded-avatar-apply");
    if (apply !== null) { apply.disabled = JSON.stringify(this.state) === JSON.stringify(this.activeState);
      apply.addEventListener("click", () => { apply.disabled = true; apply.textContent = "Application…";
        persistPlayerAvatarSelection(localStorage, PLAYER_AVATAR_ACTIVE_STORAGE_KEY, this.state); this.activeState = this.state;
        void Promise.resolve(this.onApply(this.state)).then(() => { apply.textContent = "Profil appliqué"; })
          .catch(() => { apply.disabled = false; apply.textContent = "Réessayer"; }); }); }
    this.root.querySelector<HTMLButtonElement>(".embedded-avatar-return")?.addEventListener("click", this.onClose);
    const context = this.root.querySelector<HTMLSelectElement>("[data-avatar-context]")!;
    context.addEventListener("change", () => { void this.drawOverworld(record, context.value); }); void this.drawOverworld(record, context.value);
    const frontImage = this.root.querySelector<HTMLImageElement>("[data-avatar-front]");
    if (frontImage !== null) void this.renderBattlePreview(record, "battleFront", frontImage);
    const backImage = this.root.querySelector<HTMLImageElement>("[data-avatar-back]");
    if (backImage !== null) void this.renderBattlePreview(record, "battleBack", backImage);
    const backDetail = this.root.querySelector<HTMLElement>("[data-avatar-back-detail]");
    if (backDetail !== null) backDetail.textContent = `${record.battleBackVariants.length} variante(s) narrative(s)`;
    const audit = this.report?.profiles.find((candidate) => candidate.id === record.id);
    this.root.querySelector<HTMLElement>("[data-avatar-audit]")!.textContent = audit === undefined ? ""
      : `Replis : ${audit.fallbacks.join(", ") || "aucun"} · variantes narratives de dos absentes : ${audit.missingBattleBackVariants.join(", ") || "aucune"}`;
  }

  private async drawOverworld(record: AvatarRecord, contextName: string): Promise<void> {
    const reference = record.assets[contextName]; const canvas = this.root.querySelector<HTMLCanvasElement>("canvas"); if (reference?.path === null || reference === undefined || canvas === null) return;
    const detail = this.root.querySelector<HTMLElement>("[data-avatar-context-detail]"); if (detail !== null) detail.textContent = reference.native ? contextName : `${contextName} · repli ${reference.fallbackContext}`;
    const session = ++this.overworldAnimationSession; let image: HTMLCanvasElement;
    try { image = await this.recoloredCanvas(record, contextName); } catch { return; }
    const context = canvas.getContext("2d"); if (context === null) return; const width = image.width / 4; const height = image.height / 4; let frame = 0;
    const draw = (): void => { if (session !== this.overworldAnimationSession || this.root.hidden) return; context.clearRect(0, 0, 150, 150); context.imageSmoothingEnabled = false;
      const scale = Math.min(2, 120 / Math.max(width, height)); context.drawImage(image, frame * width, 0, width, height, 75 - width * scale / 2, 135 - height * scale, width * scale, height * scale);
      frame = (frame + 1) % 4; window.setTimeout(draw, 180); }; draw();
  }

  private identityVariantUrls(record: AvatarRecord, contextName: string): string[] {
    if (this.catalog === null) return [];
    return this.catalog.records.filter((candidate) => candidate.presentation === record.presentation && candidate.id !== record.id)
      .map((candidate) => candidate.assets[contextName]?.path).filter((path): path is string => path !== null && path !== undefined)
      .map(sourceUrl);
  }

  private async recoloredCanvas(record: AvatarRecord, contextName: string): Promise<HTMLCanvasElement> {
    const path = record.assets[contextName]?.path; if (path === null || path === undefined) throw new Error("Asset d'avatar absent.");
    return loadRecoloredAvatarCanvas(sourceUrl(path), this.identityVariantUrls(record, contextName), this.state.profile.colors);
  }

  private async renderBattlePreview(record: AvatarRecord, contextName: "battleFront" | "battleBack",
    target: HTMLImageElement): Promise<void> {
    try { target.src = (await this.recoloredCanvas(record, contextName)).toDataURL(); }
    catch { const path = record.assets[contextName]?.path; if (path !== null && path !== undefined) target.src = sourceUrl(path); }
  }
}
