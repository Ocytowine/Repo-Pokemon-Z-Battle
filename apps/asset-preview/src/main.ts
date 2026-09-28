import { createHttpDirectoryHandle, fileFromLocalPath, findPokemonRecord, loadLocalManifests, loadLocalManifestsFromUrls, type LocalDirectoryHandle, type LocalManifests, type PokemonAssetReference } from "@pokemon-z-battle/local-assets";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`Missing #${id}`);
  return found as T;
}

const ui = {
  manifests: element<HTMLInputElement>("manifests"), folder: element<HTMLButtonElement>("folder"),
  pokemonId: element<HTMLInputElement>("pokemonId"), kind: element<HTMLSelectElement>("kind"),
  status: element<HTMLParagraphElement>("status"), title: element<HTMLDivElement>("title"), grid: element<HTMLElement>("grid"),
};
let manifests: LocalManifests | null = null;
let directory: LocalDirectoryHandle | null = null;
let urls: string[] = [];
let timers: number[] = [];

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function clearResources(): void {
  timers.forEach(window.clearInterval); timers = [];
  urls.forEach(URL.revokeObjectURL); urls = [];
}

async function imageVisual(file: File, asset: PokemonAssetReference): Promise<HTMLElement> {
  const url = URL.createObjectURL(file); urls.push(url);
  if (asset.kind !== "battler" || (asset.frameCount ?? 1) <= 1 || asset.height === null) {
    const image = new Image(); image.src = url; image.alt = asset.path; return image;
  }
  const image = new Image(); image.src = url; await image.decode();
  const canvas = document.createElement("canvas"); canvas.width = asset.height; canvas.height = asset.height;
  const context = canvas.getContext("2d"); let frame = 0;
  const draw = (): void => {
    context?.clearRect(0, 0, canvas.width, canvas.height);
    context?.drawImage(image, frame * asset.height!, 0, asset.height!, asset.height!, 0, 0, asset.height!, asset.height!);
    frame = (frame + 1) % (asset.frameCount ?? 1);
  };
  draw(); timers.push(window.setInterval(draw, 110)); return canvas;
}

async function render(): Promise<void> {
  clearResources();
  if (manifests === null) return;
  const record = findPokemonRecord(manifests.pokemon, Number(ui.pokemonId.value));
  if (record === undefined) { ui.grid.innerHTML = '<div class="empty">Pokémon inconnu.</div>'; return; }
  ui.title.innerHTML = `<h2>${escapeHtml(record.name)}</h2><code>#${String(record.id).padStart(4, "0")} · ${escapeHtml(record.internalName)}</code>`;
  const assets = Object.values(record.assets).flat().filter((asset) => ui.kind.value === "all" || asset.kind === ui.kind.value);
  ui.grid.replaceChildren();
  if (directory === null) { ui.grid.innerHTML = `<div class="empty">${assets.length} variantes indexées. Choisissez le dossier source.</div>`; return; }
  for (const asset of assets) {
    const article = document.createElement("article"); const visual = document.createElement("div"); visual.className = "visual";
    try {
      const file = await fileFromLocalPath(directory, asset.path);
      if (asset.kind === "cry") { const audio = document.createElement("audio"); audio.controls = true; audio.src = URL.createObjectURL(file); urls.push(audio.src); visual.append(audio); }
      else visual.append(await imageVisual(file, asset));
    } catch { visual.textContent = "Fichier inaccessible"; }
    article.append(visual);
    article.insertAdjacentHTML("beforeend", `<h3>${escapeHtml(asset.kind)}</h3><p>${escapeHtml(asset.path)}</p><p>${asset.width ?? "—"} × ${asset.height ?? "—"}${asset.frameCount ? ` · ${asset.frameCount} frames` : ""}</p>`);
    ui.grid.append(article);
  }
  if (assets.length === 0) ui.grid.innerHTML = '<div class="empty">Aucun asset pour ce filtre.</div>';
}

ui.manifests.addEventListener("change", async () => {
  try { manifests = await loadLocalManifests(ui.manifests.files ?? []); ui.status.textContent = "Manifestes chargés. Choisissez maintenant le dossier du jeu."; await render(); }
  catch (error) { ui.status.textContent = error instanceof Error ? error.message : "Chargement impossible."; }
});
ui.folder.addEventListener("click", async () => {
  const picker = (window as Window & { showDirectoryPicker?: (options: { mode: "read" }) => Promise<LocalDirectoryHandle> }).showDirectoryPicker;
  if (picker === undefined) { ui.status.textContent = "Utilisez un navigateur Chromium récent."; return; }
  try { directory = await picker({ mode: "read" }); ui.status.textContent = `Dossier source prêt : ${directory.name}`; await render(); }
  catch { ui.status.textContent = "Sélection du dossier annulée."; }
});
ui.pokemonId.addEventListener("input", () => { void render(); });
ui.kind.addEventListener("change", () => { void render(); });

async function loadAutomaticAssets(): Promise<void> {
  try {
    manifests = await loadLocalManifestsFromUrls([
      "/__pokemon-z/data/asset-manifest.json",
      "/__pokemon-z/data/pokemon-assets.json",
    ]);
    directory = createHttpDirectoryHandle("/__pokemon-z/source/");
    ui.folder.textContent = "Dossier automatique actif";
    ui.status.textContent = "Assets locaux chargés automatiquement par le serveur de développement.";
    await render();
  } catch {
    // Production builds and unconfigured workspaces keep the explicit browser pickers.
  }
}

void loadAutomaticAssets();
