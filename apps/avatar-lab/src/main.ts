import { parsePlayerProfile, type PlayerProfile, type PlayerPronouns } from "@pokemon-z-battle/player-state";
import { AVATAR_PALETTE_COLORS, loadRecoloredAvatarCanvas } from "@pokemon-z-battle/local-assets";
import { AVATAR_LAB_STORAGE_KEY, applyAvatarLabState, createAvatarLabState, loadActiveAvatarState, loadAvatarLabState,
  persistAvatarLabState,
} from "./avatar-lab-state.js";

type Context = "overworld" | "bicycle" | "surf" | "run" | "dive" | "fish" | "fishSurf";
interface AssetReference { readonly path: string | null; readonly native: boolean; readonly fallbackContext: string | null }
interface AvatarRecord {
  readonly id: string; readonly legacyPlayerId: number; readonly presentation: "masculine" | "feminine";
  readonly legacyPalette: "classic" | "light" | "dark"; readonly trainerType: string;
  readonly assets: Readonly<Record<Context | "battleFront" | "battleBack" | "introPreview", AssetReference>>;
  readonly overworldPoses: readonly string[]; readonly battleBackVariants: readonly string[];
}
interface AvatarCatalog { readonly schemaVersion: "1.0.0"; readonly records: readonly AvatarRecord[] }
interface AuditProfile { readonly id: string; readonly missing: readonly string[]; readonly fallbacks: readonly string[];
  readonly missingOverworldPoseVariants: readonly number[]; readonly missingBattleBackVariants: readonly number[] }
interface AuditReport { readonly profiles: readonly AuditProfile[] }

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id); if (element === null) throw new Error(`#${id} introuvable.`); return element as T;
}
function sourceUrl(path: string): string {
  return `/__pokemon-z/source/${path.split("/").map(encodeURIComponent).join("/")}`;
}
async function json<T>(url: string): Promise<T> {
  const response = await fetch(url); if (!response.ok) throw new Error(`${url} indisponible.`); return response.json() as Promise<T>;
}

const ui = { name: required<HTMLInputElement>("display-name"), pronouns: required<HTMLSelectElement>("pronouns"),
  avatars: required<HTMLDivElement>("avatar-options"), context: required<HTMLSelectElement>("overworld-context"),
  primary: required<HTMLSelectElement>("primary"), secondary: required<HTMLSelectElement>("secondary"),
  accent: required<HTMLSelectElement>("accent"), swatches: required<HTMLDivElement>("swatches"),
  canvas: required<HTMLCanvasElement>("overworld-preview"), front: required<HTMLImageElement>("front-preview"),
  back: required<HTMLImageElement>("back-preview"), overworldDetail: required<HTMLParagraphElement>("overworld-detail"),
  backDetail: required<HTMLParagraphElement>("back-detail"), audit: required<HTMLDivElement>("audit"),
  status: required<HTMLParagraphElement>("save-status"), reset: required<HTMLButtonElement>("reset"),
  apply: required<HTMLButtonElement>("apply"), export: required<HTMLButtonElement>("export") };
let catalog: AvatarCatalog | null = null;
let report: AuditReport | null = null;
let state = loadAvatarLabState(localStorage);
let activeState = loadActiveAvatarState(localStorage);
let overworldAnimationSession = 0;
let visualSession = 0;

function activeRecord(): AvatarRecord | null {
  return catalog?.records.find((record) => record.id === state.avatarId) ?? catalog?.records[0] ?? null;
}
function updateProfile(change: Partial<PlayerProfile>): void {
  state = { ...state, profile: parsePlayerProfile({ ...state.profile, ...change }) };
  persistAvatarLabState(localStorage, state); ui.status.textContent = "Brouillon sauvegardé · cliquez sur Appliquer pour modifier le joueur."; render();
}
function paletteOptions(select: HTMLSelectElement): void {
  for (const [id, color] of Object.entries(AVATAR_PALETTE_COLORS)) { const option = document.createElement("option"); option.value = id;
    option.textContent = id[0]!.toUpperCase() + id.slice(1); option.style.backgroundColor = color; select.append(option); }
}
function renderSwatches(): void {
  ui.swatches.replaceChildren(...([state.profile.colors.primary, state.profile.colors.secondary, state.profile.colors.accent]
    .map((id) => { const swatch = document.createElement("span"); swatch.title = id;
      swatch.style.background = AVATAR_PALETTE_COLORS[id as keyof typeof AVATAR_PALETTE_COLORS] ?? "transparent"; return swatch; })));
}
function renderAvatarOptions(): void {
  if (catalog === null) return; ui.avatars.replaceChildren();
  for (const record of catalog.records) { const button = document.createElement("button"); button.type = "button";
    button.className = record.id === state.avatarId ? "avatar-option selected" : "avatar-option";
    button.dataset.avatar = record.id; const image = document.createElement("img"); const path = record.assets.battleFront.path;
    if (path !== null) image.src = sourceUrl(path); image.alt = ""; button.append(image);
    const label = document.createElement("span"); label.textContent = `${record.presentation === "masculine" ? "Modèle A" : "Modèle B"} · ${record.legacyPalette}`;
    button.append(label); button.addEventListener("click", () => {
      state = { ...state, avatarId: record.id, profile: { ...state.profile,
        bodyModel: `legacy-${record.presentation}`, skinTone: record.legacyPalette, hairColor: `legacy-${record.legacyPalette}` } };
      persistAvatarLabState(localStorage, state); ui.status.textContent = "Brouillon sauvegardé · cliquez sur Appliquer pour modifier le joueur."; render();
    }); ui.avatars.append(button); }
}
function identityVariantUrls(record: AvatarRecord, context: Context | "battleFront" | "battleBack"): string[] {
  if (catalog === null) return [];
  return catalog.records.filter((candidate) => candidate.presentation === record.presentation && candidate.id !== record.id)
    .map((candidate) => candidate.assets[context].path).filter((path): path is string => path !== null).map(sourceUrl);
}
async function recoloredCanvas(record: AvatarRecord, context: Context | "battleFront" | "battleBack"): Promise<HTMLCanvasElement | null> {
  const path = record.assets[context].path; if (path === null) return null;
  return loadRecoloredAvatarCanvas(sourceUrl(path), identityVariantUrls(record, context), state.profile.colors);
}
async function animateOverworld(record: AvatarRecord, contextName: Context): Promise<void> {
  const session = ++overworldAnimationSession; const context = ui.canvas.getContext("2d"); if (context === null) return;
  context.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
  let image: HTMLCanvasElement | null; try { image = await recoloredCanvas(record, contextName); } catch { return; }
  if (image === null) return; const width = image.width / 4; const height = image.height / 4; let frame = 0;
  const draw = (): void => { if (session !== overworldAnimationSession) return; context.clearRect(0, 0, 128, 128);
    const scale = Math.min(2, 100 / Math.max(width, height)); const targetWidth = width * scale; const targetHeight = height * scale;
    context.imageSmoothingEnabled = false; context.drawImage(image, frame * width, 0, width, height,
      64 - targetWidth / 2, 112 - targetHeight, targetWidth, targetHeight); frame = (frame + 1) % 4;
    window.setTimeout(draw, 180); }; draw();
}
async function renderBattlePreview(record: AvatarRecord, context: "battleFront" | "battleBack", image: HTMLImageElement,
  session: number): Promise<void> {
  try { const canvas = await recoloredCanvas(record, context); if (session === visualSession && canvas !== null) image.src = canvas.toDataURL(); }
  catch { if (session === visualSession) { const path = record.assets[context].path; if (path !== null) image.src = sourceUrl(path); } }
}
function renderBattleBack(record: AvatarRecord, session: number): void {
  void renderBattlePreview(record, "battleBack", ui.back, session);
  ui.backDetail.textContent = `Vue principale fixe · ${record.battleBackVariants.length} variante(s) narrative(s) cataloguée(s)`;
}
function renderAudit(record: AvatarRecord): void {
  const audit = report?.profiles.find((profile) => profile.id === record.id); ui.audit.replaceChildren(); if (audit === undefined) return;
  const lines = [audit.missing.length === 0 ? "Tous les contextes essentiels sont résolus." : `Assets absents : ${audit.missing.join(", ")}`,
    audit.fallbacks.length === 0 ? "Aucun repli." : `Replis : ${audit.fallbacks.join(", ")}`,
    audit.missingBattleBackVariants.length === 0 ? "Variantes de dos homogènes." : `Variantes de dos absentes : ${audit.missingBattleBackVariants.join(", ")}`];
  for (const text of lines) { const paragraph = document.createElement("p"); paragraph.textContent = text; ui.audit.append(paragraph); }
}
function render(): void {
  const session = ++visualSession;
  const record = activeRecord(); ui.name.value = state.profile.displayName; ui.pronouns.value = state.profile.pronouns;
  ui.primary.value = state.profile.colors.primary; ui.secondary.value = state.profile.colors.secondary; ui.accent.value = state.profile.colors.accent;
  ui.apply.disabled = JSON.stringify(state) === JSON.stringify(activeState);
  renderSwatches(); renderAvatarOptions(); if (record === null) return;
  const context = ui.context.value as Context; const reference = record.assets[context];
  ui.overworldDetail.textContent = reference.native ? context : `${context} · repli sur ${reference.fallbackContext ?? "aucun"}`;
  void animateOverworld(record, context); void renderBattlePreview(record, "battleFront", ui.front, session);
  renderBattleBack(record, session); renderAudit(record);
}

for (const select of [ui.primary, ui.secondary, ui.accent]) paletteOptions(select);
ui.name.addEventListener("change", () => updateProfile({ displayName: ui.name.value.trim() || "Joueur" }));
ui.pronouns.addEventListener("change", () => updateProfile({ pronouns: ui.pronouns.value as PlayerPronouns }));
ui.context.addEventListener("change", render);
for (const [key, select] of [["primary", ui.primary], ["secondary", ui.secondary], ["accent", ui.accent]] as const) {
  select.addEventListener("change", () => updateProfile({ colors: { ...state.profile.colors, [key]: select.value } }));
}
ui.reset.addEventListener("click", () => { localStorage.removeItem(AVATAR_LAB_STORAGE_KEY); state = createAvatarLabState(); render(); });
ui.apply.addEventListener("click", () => { applyAvatarLabState(localStorage, state); activeState = state;
  ui.status.textContent = "Profil appliqué au joueur. Le brouillon et l’aventure restent sauvegardés séparément."; render(); });
ui.export.addEventListener("click", () => { const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "pokemon-z-avatar-profile.json"; link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 0); });

try { [catalog, report] = await Promise.all([json<AvatarCatalog>("/__pokemon-z/data/player-avatars.json"),
  json<AuditReport>("/__pokemon-z/data/player-avatar-report.json")]);
  if (!catalog.records.some((record) => record.id === state.avatarId)) state = createAvatarLabState();
  ui.status.textContent = JSON.stringify(state) === JSON.stringify(activeState)
    ? "Catalogue local chargé · ce profil est appliqué." : "Brouillon chargé · cliquez sur Appliquer pour modifier le joueur."; render();
} catch (error) { ui.status.textContent = error instanceof Error ? error.message : "Catalogue local indisponible."; }
