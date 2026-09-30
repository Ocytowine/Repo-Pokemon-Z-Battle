export interface SourcePresentationCommand {
  readonly kind: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface SourceTone {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly gray: number;
  readonly durationMs: number;
}

export interface SourcePictureState {
  readonly id: number;
  readonly name: string | null;
  readonly origin: "top-left" | "center";
  readonly x: number;
  readonly y: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly opacity: number;
  readonly blendMode: string;
  readonly durationMs: number;
}

export interface SourceAudioState {
  readonly name: string;
  readonly volume: number;
  readonly pitch: number;
}

export interface SourceMapVisualState {
  readonly kind: "panorama" | "fog";
  readonly name: string;
  readonly hue: number;
  readonly opacity: number;
  readonly blendMode: string;
  readonly zoom: number;
  readonly scrollX: number;
  readonly scrollY: number;
}

export interface SourceWeatherState {
  readonly kind: "none" | "rain" | "storm" | "snow";
  readonly power: number;
  readonly durationMs: number;
}

export interface SourceScrollState {
  readonly direction: 2 | 4 | 6 | 8;
  readonly distancePixels: number;
  readonly durationMs: number;
}

export interface SourceTextOptions {
  readonly position: "top" | "middle" | "bottom";
  readonly transparent: boolean;
}

export interface SourceAnimationRequest { readonly target: number; readonly animationId: number }
export interface SourceScreenTarget { readonly x: number; readonly bottom: number; readonly height: number }

type Delay = (milliseconds: number) => Promise<void>;

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parameters(data: Readonly<Record<string, unknown>>): readonly unknown[] {
  return Array.isArray(data.parameters) ? data.parameters : [];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function blendMode(value: unknown): string {
  return value === 1 ? "screen" : value === 2 ? "multiply" : "normal";
}

function sourceUrl(path: string): string {
  return `/__pokemon-z/source/${path.replaceAll("\\", "/").split("/").map(encodeURIComponent).join("/")}`;
}

function imageUrl(folder: "Pictures" | "Fogs" | "Panoramas", name: string): string {
  const extension = /\.[a-z0-9]+$/iu.test(name) ? "" : ".png";
  return sourceUrl(`Graphics/${folder}/${name}${extension}`);
}

export function parseSourceTone(data: Readonly<Record<string, unknown>>): SourceTone | null {
  if (!record(data.tone)) return null;
  return {
    red: clamp(finite(data.tone.red), -255, 255), green: clamp(finite(data.tone.green), -255, 255),
    blue: clamp(finite(data.tone.blue), -255, 255), gray: clamp(finite(data.tone.gray), 0, 255),
    durationMs: Math.max(0, finite(data.duration) * 25),
  };
}

export function parseSourcePicture(kind: string, data: Readonly<Record<string, unknown>>): SourcePictureState | null {
  const values = parameters(data);
  const id = finite(values[0], -1);
  if (!Number.isInteger(id) || id < 1) return null;
  if (kind === "erase-picture") {
    return { id, name: null, origin: "top-left", x: 0, y: 0, scaleX: 1, scaleY: 1,
      opacity: 0, blendMode: "normal", durationMs: 0 };
  }
  const moving = kind === "move-picture";
  const name = moving ? null : values[1];
  if (!moving && typeof name !== "string") return null;
  return {
    id,
    name: typeof name === "string" ? name : null,
    origin: values[2] === 1 ? "center" : "top-left",
    x: finite(values[4]), y: finite(values[5]),
    scaleX: finite(values[6], 100) / 100, scaleY: finite(values[7], 100) / 100,
    opacity: clamp(finite(values[8], 255) / 255, 0, 1),
    blendMode: blendMode(values[9]),
    durationMs: moving ? Math.max(0, finite(values[1]) * 25) : 0,
  };
}

export function parseSourceAudio(data: Readonly<Record<string, unknown>>): SourceAudioState | null {
  if (!record(data.audio) || typeof data.audio.name !== "string") return null;
  return { name: data.audio.name, volume: clamp(finite(data.audio.volume, 100) / 100, 0, 1),
    pitch: clamp(finite(data.audio.pitch, 100) / 100, 0.25, 4) };
}

export function parseSourceMapVisual(data: Readonly<Record<string, unknown>>): SourceMapVisualState | null {
  const values = parameters(data);
  if ((values[0] !== 0 && values[0] !== 1) || typeof values[1] !== "string") return null;
  return {
    kind: values[0] === 0 ? "panorama" : "fog", name: values[1], hue: finite(values[2]),
    opacity: values[0] === 0 ? 1 : clamp(finite(values[3], 255) / 255, 0, 1),
    blendMode: values[0] === 0 ? "normal" : blendMode(values[4]),
    zoom: values[0] === 0 ? 1 : Math.max(0.01, finite(values[5], 100) / 100),
    scrollX: values[0] === 0 ? 0 : finite(values[6]), scrollY: values[0] === 0 ? 0 : finite(values[7]),
  };
}

export function parseSourceWeather(data: Readonly<Record<string, unknown>>): SourceWeatherState | null {
  const values = parameters(data);
  const type = finite(values[0], -1);
  const power = finite(values[1], -1);
  const duration = finite(values[2], -1);
  if (!Number.isInteger(type) || type < 0 || type > 3 || power < 0 || duration < 0) return null;
  const kinds = ["none", "rain", "storm", "snow"] as const;
  return { kind: kinds[type]!, power: clamp(power, 0, 9), durationMs: duration * 25 };
}

export function parseSourceScroll(data: Readonly<Record<string, unknown>>): SourceScrollState | null {
  const direction = finite(data.direction);
  const distance = finite(data.distance, -1);
  const speed = finite(data.speed, -1);
  if (![2, 4, 6, 8].includes(direction) || distance < 0 || speed < 1 || speed > 6) return null;
  const distancePixels = distance * 32;
  const pixelsPerFrame = (2 ** speed) / 4;
  return { direction: direction as 2 | 4 | 6 | 8, distancePixels,
    durationMs: distancePixels === 0 ? 0 : distancePixels / pixelsPerFrame * 25 };
}

export function parseSourceTextOptions(data: Readonly<Record<string, unknown>>): SourceTextOptions | null {
  const values = parameters(data);
  if (![0, 1, 2].includes(finite(values[0], -1)) || ![0, 1].includes(finite(values[1], -1))) return null;
  return { position: values[0] === 0 ? "top" : values[0] === 1 ? "middle" : "bottom", transparent: values[1] === 1 };
}

export function parseSourceAnimation(data: Readonly<Record<string, unknown>>): SourceAnimationRequest | null {
  const values = parameters(data);
  const target = finite(values[0], Number.NaN);
  const animationId = finite(values[1], Number.NaN);
  return Number.isInteger(target) && Number.isInteger(animationId) && animationId > 0 ? { target, animationId } : null;
}

interface PresentationElements {
  readonly panorama: HTMLElement;
  readonly fog: HTMLElement;
  readonly weather: HTMLElement;
  readonly pictures: HTMLElement;
  readonly tone: HTMLElement;
  readonly flash: HTMLElement;
  readonly animations: HTMLElement;
  readonly dialogue: HTMLElement;
}

interface MapAnimationCel {
  readonly pattern: number; readonly x: number; readonly y: number; readonly zoom: number;
  readonly angle: number; readonly mirror: boolean; readonly opacity: number; readonly blendType: number;
}

interface MapAnimationRecord {
  readonly id: number; readonly graphicPath: string; readonly hue: number; readonly position: number;
  readonly frames: readonly (readonly MapAnimationCel[])[];
  readonly timings: readonly { readonly frame: number;
    readonly sound: { readonly name: string; readonly volume: number; readonly pitch: number } | null;
    readonly flashScope: number; readonly flashDuration: number;
    readonly flashColor: { readonly red: number; readonly green: number; readonly blue: number; readonly alpha: number } }[];
}

interface MapAnimationManifest {
  readonly coordinateSystem: { readonly cellSize: number; readonly sheetColumns: number; readonly framesPerSecond: number };
  readonly animations: readonly MapAnimationRecord[];
}

interface SourcePokemonAssetsManifest {
  readonly records: readonly { readonly internalName: string;
    readonly assets: Readonly<Record<string, readonly { readonly path: string; readonly form: number | null }[]>> }[];
}

interface PresentationOptions {
  readonly onCameraOffset?: (offset: Readonly<{ x: number; y: number }>) => void;
  readonly resolveAnimationTarget?: (target: number) => SourceScreenTarget | null;
}

interface ManagedAudio { readonly audio: HTMLAudioElement; readonly sourceVolume: number }

export function selectSourceCryPath(manifest: SourcePokemonAssetsManifest, speciesId: string): string | null {
  const cries = manifest.records.find((record) => record.internalName === speciesId)?.assets.cry ?? [];
  return (cries.find((cry) => cry.form === null) ?? cries[0])?.path ?? null;
}

export class SourceScenePresentation {
  private masterVolume: number;
  private music: ManagedAudio | null = null;
  private audioSession = 0;
  private readonly oneShots = new Set<ManagedAudio>();
  private cameraOffset = { x: 0, y: 0 };
  private scrollQueue = Promise.resolve();
  private scrollSession = 0;
  private animationManifest: Promise<MapAnimationManifest | null> | null = null;
  private pokemonAssetsManifest: Promise<SourcePokemonAssetsManifest | null> | null = null;
  private animationSession = 0;

  public constructor(private readonly elements: PresentationElements, masterVolume = 1,
    private readonly options: PresentationOptions = {}) {
    this.masterVolume = clamp(masterVolume, 0, 1);
  }

  public setMasterVolume(volume: number): void {
    this.masterVolume = clamp(volume, 0, 1);
    if (this.music !== null) this.music.audio.volume = this.music.sourceVolume * this.masterVolume;
    for (const entry of this.oneShots) entry.audio.volume = entry.sourceVolume * this.masterVolume;
  }

  public async execute(command: SourcePresentationCommand, delay: Delay): Promise<boolean> {
    if (command.kind === "screen-tone") {
      const tone = parseSourceTone(command.data);
      if (tone === null) return false;
      this.applyTone(tone);
      await delay(tone.durationMs);
      return true;
    }
    if (command.kind === "screen-flash") {
      const values = record(command.data.color) ? command.data.color : null;
      if (values === null) return false;
      const duration = Math.max(0, finite(command.data.duration) * 25);
      this.flash(values, duration);
      await delay(duration);
      return true;
    }
    if (command.kind === "weather") return this.weather(command.data, delay);
    if (command.kind === "change-map-settings") return this.changeMapSettings(command.data);
    if (command.kind === "panorama-motion") return this.panoramaMotion(command.data);
    if (["show-picture", "move-picture", "erase-picture"].includes(command.kind)) {
      return this.picture(command.kind, command.data);
    }
    if (command.kind === "play-music") return this.playMusic(command.data);
    if (command.kind === "play-sound") return this.playSound(command.data);
    if (command.kind === "play-jingle") return this.playJingle(command.data);
    if (command.kind === "play-cry") return this.playCry(command.data);
    if (command.kind === "fade-music") return this.fadeMusic(command.data);
    if (command.kind === "scroll-map") return this.scrollMap(command.data);
    if (command.kind === "text-options") return this.textOptions(command.data);
    if (command.kind === "show-animation") return this.showAnimation(command.data, delay);
    return false;
  }

  public currentCameraOffset(): Readonly<{ x: number; y: number }> { return this.cameraOffset; }

  public resetMapPresentation(): void {
    this.scrollSession += 1;
    this.scrollQueue = Promise.resolve();
    this.cameraOffset = { x: 0, y: 0 };
    this.options.onCameraOffset?.(this.cameraOffset);
    this.animationSession += 1;
    this.elements.animations.replaceChildren();
    this.elements.panorama.style.backgroundImage = "none";
    this.elements.panorama.style.animation = "none";
    this.elements.panorama.style.removeProperty("--source-panorama-x");
    this.elements.panorama.style.removeProperty("--source-panorama-y");
    this.elements.fog.style.backgroundImage = "none";
    this.elements.weather.dataset.weather = "none";
    this.elements.weather.style.opacity = "0";
    this.elements.dialogue.dataset.position = "bottom";
    this.elements.dialogue.classList.remove("transparent");
  }

  private applyTone(tone: SourceTone): void {
    const negative = Math.max(0, -(tone.red + tone.green + tone.blue) / (3 * 255));
    const positive = Math.max(0, tone.red, tone.green, tone.blue) / 255;
    this.elements.tone.style.transition = `background-color ${tone.durationMs}ms linear, backdrop-filter ${tone.durationMs}ms linear`;
    this.elements.tone.style.backgroundColor = positive === 0 ? "transparent"
      : `rgba(${Math.max(0, tone.red)}, ${Math.max(0, tone.green)}, ${Math.max(0, tone.blue)}, ${positive})`;
    this.elements.tone.style.mixBlendMode = positive > 0 ? "screen" : "normal";
    this.elements.tone.style.backdropFilter = `brightness(${1 - negative}) grayscale(${tone.gray / 255})`;
  }

  private flash(color: Readonly<Record<string, unknown>>, duration: number): void {
    const alpha = clamp(finite(color.alpha, 255) / 255, 0, 1);
    this.elements.flash.style.transition = "none";
    this.elements.flash.style.backgroundColor = `rgba(${clamp(finite(color.red), 0, 255)}, ${clamp(finite(color.green), 0, 255)}, ${clamp(finite(color.blue), 0, 255)}, ${alpha})`;
    this.elements.flash.style.opacity = "1";
    this.elements.flash.getBoundingClientRect();
    this.elements.flash.style.transition = `opacity ${duration}ms linear`;
    this.elements.flash.style.opacity = "0";
  }

  private changeMapSettings(data: Readonly<Record<string, unknown>>): boolean {
    const visual = parseSourceMapVisual(data);
    if (visual === null) return false;
    const layer = visual.kind === "panorama" ? this.elements.panorama : this.elements.fog;
    layer.style.backgroundImage = visual.name === "" ? "none"
      : `url("${imageUrl(visual.kind === "panorama" ? "Panoramas" : "Fogs", visual.name)}")`;
    layer.style.filter = `hue-rotate(${visual.hue}deg)`;
    if (visual.kind === "fog") {
      layer.style.opacity = String(visual.opacity);
      layer.style.mixBlendMode = visual.blendMode;
      layer.style.backgroundSize = `${visual.zoom * 100}%`;
      layer.style.setProperty("--source-fog-x", `${visual.scrollX * 32}px`);
      layer.style.setProperty("--source-fog-y", `${visual.scrollY * 32}px`);
    }
    return true;
  }

  private panoramaMotion(data: Readonly<Record<string, unknown>>): boolean {
    const scrollX = finite(data.scrollX, Number.NaN);
    const scrollY = finite(data.scrollY, Number.NaN);
    if (!Number.isFinite(scrollX) || !Number.isFinite(scrollY)) return false;
    this.elements.panorama.style.backgroundRepeat = "repeat";
    this.elements.panorama.style.backgroundSize = "auto";
    this.elements.panorama.style.setProperty("--source-panorama-x", `${scrollX * 32}px`);
    this.elements.panorama.style.setProperty("--source-panorama-y", `${scrollY * 32}px`);
    this.elements.panorama.style.animation = "source-panorama-drift 8s linear infinite";
    return true;
  }

  private async weather(data: Readonly<Record<string, unknown>>, delay: Delay): Promise<boolean> {
    const weather = parseSourceWeather(data);
    if (weather === null) return false;
    this.elements.weather.style.transition = `opacity ${weather.durationMs}ms linear`;
    if (weather.kind !== "none") this.elements.weather.dataset.weather = weather.kind;
    this.elements.weather.style.opacity = weather.kind === "none" ? "0" : String(0.2 + weather.power / 15);
    await delay(weather.durationMs);
    if (weather.kind === "none") this.elements.weather.dataset.weather = "none";
    return true;
  }

  private picture(kind: string, data: Readonly<Record<string, unknown>>): boolean {
    const state = parseSourcePicture(kind, data);
    if (state === null) return false;
    const selector = `[data-source-picture="${state.id}"]`;
    const current = this.elements.pictures.querySelector<HTMLImageElement>(selector);
    if (kind === "erase-picture") { current?.remove(); return true; }
    const image = current ?? document.createElement("img");
    if (current === null) {
      image.dataset.sourcePicture = String(state.id);
      image.alt = "";
      image.style.zIndex = String(state.id);
      this.elements.pictures.append(image);
    }
    if (state.name !== null) {
      const size = (): void => {
        image.style.width = `${image.naturalWidth / 512 * 100}%`;
        image.style.height = `${image.naturalHeight / 384 * 100}%`;
      };
      image.addEventListener("load", size, { once: true });
      image.src = imageUrl("Pictures", state.name);
      if (image.complete && image.naturalWidth > 0) size();
    }
    image.getBoundingClientRect();
    image.style.transition = state.durationMs === 0 ? "none" : `all ${state.durationMs}ms linear`;
    image.style.left = `${state.x / 512 * 100}%`;
    image.style.top = `${state.y / 384 * 100}%`;
    image.style.transform = `${state.origin === "center" ? "translate(-50%, -50%) " : ""}scale(${state.scaleX}, ${state.scaleY})`;
    image.style.opacity = String(state.opacity);
    image.style.mixBlendMode = state.blendMode;
    return true;
  }

  private playMusic(data: Readonly<Record<string, unknown>>): boolean {
    const state = parseSourceAudio(data);
    if (state === null) return false;
    this.stopManaged(this.music);
    this.music = null;
    const session = ++this.audioSession;
    if (state.name === "") return true;
    const managed = this.createAudio(state, true);
    this.music = managed;
    void this.playCandidates(managed.audio, "BGM", state.name, session);
    return true;
  }

  private playSound(data: Readonly<Record<string, unknown>>): boolean {
    const state = parseSourceAudio(data);
    if (state === null) return false;
    if (state.name === "") return true;
    const managed = this.createAudio(state, false);
    this.oneShots.add(managed);
    managed.audio.addEventListener("ended", () => this.oneShots.delete(managed), { once: true });
    void this.playCandidates(managed.audio, "SE", state.name, this.audioSession)
      .then((played) => { if (!played) this.oneShots.delete(managed); });
    return true;
  }

  private playJingle(data: Readonly<Record<string, unknown>>): boolean {
    const state = parseSourceAudio(data);
    if (state === null) return false;
    if (state.name === "") return true;
    const managed = this.createAudio(state, false);
    this.oneShots.add(managed);
    managed.audio.addEventListener("ended", () => this.oneShots.delete(managed), { once: true });
    void this.playCandidates(managed.audio, "ME", state.name, this.audioSession)
      .then((played) => { if (!played) this.oneShots.delete(managed); });
    return true;
  }

  private playCry(data: Readonly<Record<string, unknown>>): boolean {
    if (typeof data.speciesId !== "string" || data.speciesId === "") return false;
    void this.loadPokemonAssets().then(async (manifest) => {
      const path = manifest === null ? null : selectSourceCryPath(manifest, data.speciesId as string);
      if (path === null) return;
      const managed = this.createAudio({ name: path, volume: 1, pitch: 1 }, false);
      this.oneShots.add(managed);
      managed.audio.addEventListener("ended", () => this.oneShots.delete(managed), { once: true });
      managed.audio.src = sourceUrl(path);
      try { await managed.audio.play(); } catch { this.oneShots.delete(managed); }
    });
    return true;
  }

  private fadeMusic(data: Readonly<Record<string, unknown>>): boolean {
    const duration = Math.max(0, finite(parameters(data)[0]) * 1_000);
    const managed = this.music;
    if (managed === null) return true;
    const started = performance.now();
    const initial = managed.audio.volume;
    const tick = (): void => {
      if (this.music !== managed) return;
      const progress = duration === 0 ? 1 : Math.min(1, (performance.now() - started) / duration);
      managed.audio.volume = initial * (1 - progress);
      if (progress < 1) requestAnimationFrame(tick);
      else { this.stopManaged(managed); if (this.music === managed) this.music = null; }
    };
    tick();
    return true;
  }

  private scrollMap(data: Readonly<Record<string, unknown>>): boolean {
    const scroll = parseSourceScroll(data);
    if (scroll === null) return false;
    const session = this.scrollSession;
    this.scrollQueue = this.scrollQueue.then(() => this.animateScroll(scroll, session));
    return true;
  }

  private async animateScroll(scroll: SourceScrollState, session: number): Promise<void> {
    if (session !== this.scrollSession) return;
    const start = this.cameraOffset;
    const delta = scroll.direction === 2 ? { x: 0, y: scroll.distancePixels }
      : scroll.direction === 4 ? { x: -scroll.distancePixels, y: 0 }
      : scroll.direction === 6 ? { x: scroll.distancePixels, y: 0 }
      : { x: 0, y: -scroll.distancePixels };
    const startedAt = performance.now();
    await new Promise<void>((resolve) => {
      const frame = (now: number): void => {
        if (session !== this.scrollSession) { resolve(); return; }
        const progress = scroll.durationMs === 0 ? 1 : Math.min(1, (now - startedAt) / scroll.durationMs);
        this.cameraOffset = { x: start.x + delta.x * progress, y: start.y + delta.y * progress };
        this.options.onCameraOffset?.(this.cameraOffset);
        if (progress < 1) requestAnimationFrame(frame); else resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  private textOptions(data: Readonly<Record<string, unknown>>): boolean {
    const options = parseSourceTextOptions(data);
    if (options === null) return false;
    this.elements.dialogue.dataset.position = options.position;
    this.elements.dialogue.classList.toggle("transparent", options.transparent);
    return true;
  }

  private showAnimation(data: Readonly<Record<string, unknown>>, delay: Delay): boolean {
    const request = parseSourceAnimation(data);
    if (request === null) return false;
    void this.playMapAnimation(request, delay);
    return true;
  }

  private loadMapAnimations(): Promise<MapAnimationManifest | null> {
    this.animationManifest ??= fetch("/__pokemon-z/data/map-animations.json")
      .then(async (response) => response.ok ? await response.json() as MapAnimationManifest : null)
      .catch(() => null);
    return this.animationManifest;
  }

  private loadPokemonAssets(): Promise<SourcePokemonAssetsManifest | null> {
    this.pokemonAssetsManifest ??= fetch("/__pokemon-z/data/pokemon-assets.json")
      .then(async (response) => response.ok ? await response.json() as SourcePokemonAssetsManifest : null)
      .catch(() => null);
    return this.pokemonAssetsManifest;
  }

  private async playMapAnimation(request: SourceAnimationRequest, delay: Delay): Promise<void> {
    const session = this.animationSession;
    const manifest = await this.loadMapAnimations();
    const animation = manifest?.animations.find((candidate) => candidate.id === request.animationId);
    if (manifest === null || manifest === undefined || animation === undefined) return;
    const image = animation.graphicPath === "" ? null : new Image();
    if (image !== null) {
      image.src = sourceUrl(animation.graphicPath);
      try { await image.decode(); } catch { return; }
    }
    const canvas = document.createElement("canvas");
    canvas.width = 576;
    canvas.height = 432;
    canvas.className = "source-map-animation-canvas";
    this.elements.animations.append(canvas);
    const context = canvas.getContext("2d");
    if (context === null) { canvas.remove(); return; }
    try {
      for (const [frameIndex, frame] of animation.frames.entries()) {
        if (session !== this.animationSession) return;
        const target = animation.position === 3 ? { x: canvas.width / 2, bottom: canvas.height / 2, height: 0 }
          : this.options.resolveAnimationTarget?.(request.target) ?? null;
        if (target === null) return;
        this.playAnimationTimings(animation, frameIndex, target);
        context.clearRect(0, 0, canvas.width, canvas.height);
        const anchorY = animation.position === 0 ? target.bottom - target.height
          : animation.position === 2 ? target.bottom : target.bottom - target.height / 2;
        if (image !== null) for (const cel of frame) {
          this.drawMapAnimationCel(context, image, manifest, cel, target.x, anchorY, animation.hue);
        }
        await delay(1_000 / manifest.coordinateSystem.framesPerSecond);
      }
    } finally { canvas.remove(); }
  }

  private drawMapAnimationCel(context: CanvasRenderingContext2D, image: HTMLImageElement,
    manifest: MapAnimationManifest, cel: MapAnimationCel, anchorX: number, anchorY: number, hue: number): void {
    const { cellSize, sheetColumns } = manifest.coordinateSystem;
    context.save();
    context.translate(anchorX + cel.x, anchorY + cel.y);
    context.rotate(cel.angle * Math.PI / 180);
    context.scale((cel.zoom / 100) * (cel.mirror ? -1 : 1), cel.zoom / 100);
    context.globalAlpha = clamp(cel.opacity / 255, 0, 1);
    context.globalCompositeOperation = cel.blendType === 1 ? "lighter" : cel.blendType === 2 ? "multiply" : "source-over";
    context.filter = hue === 0 ? "none" : `hue-rotate(${hue}deg)`;
    context.drawImage(image, (cel.pattern % sheetColumns) * cellSize, Math.floor(cel.pattern / sheetColumns) * cellSize,
      cellSize, cellSize, -cellSize / 2, -cellSize / 2, cellSize, cellSize);
    context.restore();
  }

  private playAnimationTimings(animation: MapAnimationRecord, frame: number, target: SourceScreenTarget): void {
    for (const timing of animation.timings.filter((candidate) => candidate.frame === frame)) {
      if (timing.sound !== null) this.playSound({ audio: timing.sound });
      if (timing.flashScope === 1) this.flashTarget(timing.flashColor, timing.flashDuration * 50, target);
      else if (timing.flashScope === 2) this.flash(timing.flashColor, timing.flashDuration * 50);
    }
  }

  private flashTarget(color: Readonly<Record<string, unknown>>, duration: number, target: SourceScreenTarget): void {
    const element = document.createElement("span");
    element.className = "source-map-target-flash";
    element.style.left = `${target.x / 576 * 100}%`;
    element.style.top = `${(target.bottom - target.height) / 432 * 100}%`;
    element.style.width = `${Math.max(32, target.height) / 576 * 100}%`;
    element.style.height = `${Math.max(32, target.height) / 432 * 100}%`;
    element.style.backgroundColor = `rgba(${clamp(finite(color.red), 0, 255)}, ${clamp(finite(color.green), 0, 255)}, ${clamp(finite(color.blue), 0, 255)}, ${clamp(finite(color.alpha) / 255, 0, 1)})`;
    element.style.transition = `opacity ${duration}ms linear`;
    this.elements.animations.append(element);
    element.getBoundingClientRect();
    element.style.opacity = "0";
    globalThis.setTimeout(() => element.remove(), duration);
  }

  private createAudio(state: SourceAudioState, loop: boolean): ManagedAudio {
    const audio = new Audio();
    audio.loop = loop;
    audio.volume = state.volume * this.masterVolume;
    audio.playbackRate = state.pitch;
    return { audio, sourceVolume: state.volume };
  }

  private async playCandidates(audio: HTMLAudioElement, folder: "BGM" | "SE" | "ME", name: string, session: number): Promise<boolean> {
    const names = /\.[a-z0-9]+$/iu.test(name) ? [name] : [name + ".ogg", name + ".wav", name + ".mp3"];
    for (const candidate of names) {
      if (folder === "BGM" && session !== this.audioSession) return false;
      audio.src = sourceUrl(`Audio/${folder}/${candidate}`);
      try { await audio.play(); return true; } catch { /* Essayer l'extension source suivante. */ }
    }
    return false;
  }

  private stopManaged(managed: ManagedAudio | null): void {
    if (managed === null) return;
    managed.audio.pause();
    managed.audio.currentTime = 0;
  }
}
