import {
  ObjectUrlStore,
  buildBattleScenes,
  findPokemonRecord,
  selectBattler,
  selectCry,
  type BattleScene,
  type LocalDirectoryHandle,
  type LocalManifests,
  type PokemonAssetReference,
} from "@pokemon-z-battle/local-assets";
import { findPreset } from "./presets.js";

interface AnimatedCanvas {
  readonly element: HTMLCanvasElement;
  stop(): void;
}

function animatedCanvas(image: HTMLImageElement, asset: PokemonAssetReference): AnimatedCanvas {
  const frameCount = Math.max(1, asset.frameCount ?? 1);
  const frameHeight = asset.height ?? image.naturalHeight;
  const frameWidth = frameCount > 1 ? frameHeight : (asset.width ?? image.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = frameWidth;
  canvas.height = frameHeight;
  canvas.setAttribute("aria-label", asset.path);
  const context = canvas.getContext("2d");
  let frame = 0;
  const draw = (): void => {
    context?.clearRect(0, 0, frameWidth, frameHeight);
    context?.drawImage(image, frame * frameWidth, 0, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
    frame = (frame + 1) % frameCount;
  };
  draw();
  const timer = frameCount > 1 ? window.setInterval(draw, 110) : undefined;
  return { element: canvas, stop: () => { if (timer !== undefined) window.clearInterval(timer); } };
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

function setImage(element: HTMLImageElement, url: string | null): void {
  if (url === null) {
    element.removeAttribute("src");
    element.hidden = true;
  } else {
    element.src = url;
    element.hidden = false;
  }
}

export class BattleVisuals {
  readonly #urls = new ObjectUrlStore();
  readonly #animations: AnimatedCanvas[] = [];
  #manifests: LocalManifests | null = null;
  #directory: LocalDirectoryHandle | null = null;
  #scenes: readonly BattleScene[] = [];

  get ready(): boolean {
    return this.#manifests !== null && this.#directory !== null;
  }

  setManifests(manifests: LocalManifests): readonly BattleScene[] {
    this.#manifests = manifests;
    this.#scenes = buildBattleScenes(manifests.assets);
    return this.#scenes;
  }

  setDirectory(directory: LocalDirectoryHandle): void {
    this.#directory = directory;
  }

  async render(playerSpecies: string, opponentSpecies: string, sceneId: string): Promise<void> {
    this.clearRenderedAssets();
    if (!this.ready || this.#manifests === null || this.#directory === null) return;
    const scene = this.#scenes.find((candidate) => candidate.id === sceneId) ?? this.#scenes[0];
    await this.renderScene(scene);
    await Promise.all([
      this.renderBattler("player", playerSpecies, true),
      this.renderBattler("opponent", opponentSpecies, false),
    ]);
  }

  async playCry(species: string): Promise<void> {
    if (!this.ready || this.#manifests === null || this.#directory === null) return;
    const preset = findPreset(species);
    const record = preset === undefined ? undefined : findPokemonRecord(this.#manifests.pokemon, preset.id);
    const cry = record === undefined ? null : selectCry(record);
    if (cry === null) return;
    try {
      const url = await this.#urls.create(this.#directory, cry.path);
      const audio = new Audio(url);
      audio.volume = 0.55;
      audio.addEventListener("ended", () => this.#urls.revoke(url), { once: true });
      await audio.play();
    } catch {
      // A missing or browser-blocked cry never blocks the battle.
    }
  }

  async localUrl(path: string): Promise<string> {
    if (this.#directory === null) throw new Error("Le dossier source n'est pas sélectionné.");
    return this.#urls.create(this.#directory, path);
  }

  clear(): void {
    this.clearRenderedAssets();
    this.#manifests = null;
    this.#directory = null;
    this.#scenes = [];
  }

  private clearRenderedAssets(): void {
    for (const animation of this.#animations.splice(0)) animation.stop();
    this.#urls.clear();
    for (const side of ["player", "opponent"] as const) {
      const slot = document.getElementById(`${side}-sprite`);
      slot?.replaceChildren();
      slot?.classList.remove("attacking", "hit", "fainted");
      slot?.classList.add("sprite-fallback");
      if (slot !== null) slot.textContent = "?";
    }
  }

  private async renderScene(scene: BattleScene | undefined): Promise<void> {
    if (this.#directory === null) return;
    const parts = [
      ["battle-background", scene?.background ?? null],
      ["player-base", scene?.playerBase ?? null],
      ["enemy-base", scene?.enemyBase ?? null],
    ] as const;
    await Promise.all(parts.map(async ([id, entry]) => {
      const element = document.getElementById(id) as HTMLImageElement | null;
      if (element === null) return;
      try {
        setImage(element, entry === null ? null : await this.#urls.create(this.#directory as LocalDirectoryHandle, entry.path));
      } catch {
        setImage(element, null);
      }
    }));
    document.getElementById("battle-stage")?.classList.toggle("incomplete-scene", scene?.complete !== true);
  }

  private async renderBattler(side: "player" | "opponent", species: string, back: boolean): Promise<void> {
    if (this.#directory === null || this.#manifests === null) return;
    const preset = findPreset(species);
    const record = preset === undefined ? undefined : findPokemonRecord(this.#manifests.pokemon, preset.id);
    const asset = record === undefined ? null : selectBattler(record, back);
    const slot = document.getElementById(`${side}-sprite`);
    if (slot === null || asset === null) return;
    try {
      const image = await loadImage(await this.#urls.create(this.#directory, asset.path));
      const animation = animatedCanvas(image, asset);
      this.#animations.push(animation);
      slot.replaceChildren(animation.element);
      slot.classList.remove("sprite-fallback");
    } catch {
      slot.textContent = preset?.name.slice(0, 1).toUpperCase() ?? "?";
    }
  }
}

export function directoryPickerAvailable(): boolean {
  return "showDirectoryPicker" in window;
}

export async function pickLocalDirectory(): Promise<LocalDirectoryHandle> {
  const picker = (window as Window & { showDirectoryPicker?: (options: { mode: "read" }) => Promise<LocalDirectoryHandle> }).showDirectoryPicker;
  if (picker === undefined) throw new Error("Utilisez un navigateur Chromium récent pour sélectionner le dossier local.");
  return picker({ mode: "read" });
}
