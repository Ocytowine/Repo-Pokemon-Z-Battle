import { buildBattleScenes, loadLocalManifestsFromUrls, selectBattler, selectCry,
  type AssetManifest, type BattleAnimationCel, type BattleAnimationRecord, type BattleAnimationsManifest,
  type LocalManifests, type PokemonAssetReference, type PokemonAssetsManifest } from "@pokemon-z-battle/local-assets";
import type { BattleMove, BattleSide, TeamBattleEvent, TeamBattleState } from "@pokemon-z-battle/battle-engine";

interface AnimatedCanvas { readonly element: HTMLCanvasElement; stop(): void }

function sourceUrl(path: string): string {
  return `/__pokemon-z/source/${path.replaceAll("\\", "/").split("/").map(encodeURIComponent).join("/")}`;
}

async function animatedCanvas(asset: PokemonAssetReference): Promise<AnimatedCanvas> {
  const image = new Image();
  image.src = sourceUrl(asset.path);
  await image.decode();
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
  const timer = frameCount > 1 ? window.setInterval(draw, 110) : null;
  return { element: canvas, stop: () => { if (timer !== null) window.clearInterval(timer); } };
}

function delay(milliseconds: number): Promise<void> {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return new Promise((resolve) => window.setTimeout(resolve, reduced ? 20 : milliseconds));
}

export function transformBattleAnimationPoint(x: number, y: number, reverse: boolean): { readonly x: number; readonly y: number } {
  return reverse ? { x: 512 - x, y: 320 - y } : { x, y };
}

export function selectSourceBattleAnimation(manifest: BattleAnimationsManifest, side: BattleSide,
  internalName: string): { readonly animation: BattleAnimationRecord; readonly explicitOpponent: boolean; readonly reverse: boolean } | null {
  const mapping = manifest.mappings.find((entry) => entry.internalName === internalName);
  if (mapping === undefined) return null;
  const explicitOpponent = side === "opponent" && mapping.opponent !== null;
  const animationIndex = side === "player" ? mapping.player : (mapping.opponent ?? mapping.player);
  const animation = manifest.animations.find((entry) => entry.index === animationIndex);
  return animation === undefined ? null : { animation, explicitOpponent, reverse: side === "opponent" && !explicitOpponent };
}

export interface SourceBattleAudio {
  readonly battleMusic: string | null;
  readonly victoryMusic: string | null;
  readonly playerCry: string | null;
  readonly opponentCry: string | null;
}

function availableAudio(manifest: AssetManifest, path: string): string | null {
  const normalized = path.toLocaleLowerCase("en");
  return manifest.records.find((entry) => entry.mediaType === "audio"
    && entry.path.toLocaleLowerCase("en") === normalized)?.path ?? null;
}

export function selectSourceBattleAudio(assets: AssetManifest, pokemon: PokemonAssetsManifest,
  playerSpecies: string, opponentSpecies: string, battleMusic = "Salvaje.ogg", victoryMusic = "VictoriaSalvaje.ogg"): SourceBattleAudio {
  const cry = (species: string): string | null => {
    const record = pokemon.records.find((candidate) => candidate.internalName === species);
    return record === undefined ? null : selectCry(record)?.path ?? null;
  };
  return {
    battleMusic: availableAudio(assets, `Audio/BGM/${battleMusic}`),
    victoryMusic: availableAudio(assets, `Audio/ME/${victoryMusic}`),
    playerCry: cry(playerSpecies),
    opponentCry: cry(opponentSpecies),
  };
}

export class SourceBattleVisuals {
  #manifests: LocalManifests | null = null;
  #loading: Promise<LocalManifests> | null = null;
  #animations: AnimatedCanvas[] = [];
  #renderedSpecies = "";
  #battleMusic: HTMLAudioElement | null = null;
  #outroMusic: HTMLAudioElement | null = null;
  #oneShots = new Set<HTMLAudioElement>();
  #audioSession = 0;
  #victoryMusicPath: string | null = null;

  async startBattle(state: TeamBattleState, audio: { readonly battleMusic?: string | null; readonly victoryMusic?: string | null } = {}): Promise<void> {
    this.stopAudio();
    const session = ++this.#audioSession;
    // Le chargement asynchrone des manifestes peut sortir de la fenêtre d'activation
    // utilisateur. Démarrer la BGM source immédiatement évite un blocage d'autoplay.
    const battleMusic = audio.battleMusic ?? "Salvaje.ogg";
    const victoryMusic = audio.victoryMusic ?? "VictoriaSalvaje.ogg";
    this.#victoryMusicPath = `Audio/ME/${victoryMusic}`;
    this.#battleMusic = this.playAudio(`Audio/BGM/${battleMusic}`, { loop: true, volume: 0.55 });
    try {
      const manifests = await this.manifests();
      if (session !== this.#audioSession) return;
      const player = state.teams.player.members[state.teams.player.activeIndex];
      const opponent = state.teams.opponent.members[state.teams.opponent.activeIndex];
      if (player === undefined || opponent === undefined) return;
      const selectedAudio = selectSourceBattleAudio(manifests.assets, manifests.pokemon, player.species, opponent.species,
        battleMusic, victoryMusic);
      this.#victoryMusicPath = selectedAudio.victoryMusic;
      if (selectedAudio.opponentCry !== null) this.playAudio(selectedAudio.opponentCry, { volume: 0.8, oneShot: true });
      await delay(420);
      if (session === this.#audioSession && selectedAudio.playerCry !== null) {
        this.playAudio(selectedAudio.playerCry, { volume: 0.8, oneShot: true });
      }
    } catch {
      // Les visuels et le moteur de combat restent utilisables si l'audio local est absent.
    }
  }

  endBattle(winner: BattleSide | null): void {
    const victoryPath = winner === "player" ? this.#victoryMusicPath : null;
    this.stopAudio();
    this.#audioSession += 1;
    this.#victoryMusicPath = null;
    if (victoryPath !== null) this.#outroMusic = this.playAudio(victoryPath, { volume: 0.65 });
  }

  async render(state: TeamBattleState, battleback = "snow"): Promise<void> {
    this.updateHud(state);
    const player = state.teams.player.members[state.teams.player.activeIndex];
    const opponent = state.teams.opponent.members[state.teams.opponent.activeIndex];
    if (player === undefined || opponent === undefined) return;
    const key = `${battleback}:${player.species}:${opponent.species}`;
    if (key === this.#renderedSpecies) return;
    this.#renderedSpecies = key;
    try {
      const manifests = await this.manifests();
      this.clearSprites();
      const scenes = buildBattleScenes(manifests.assets);
      const requestedScene = battleback.toLocaleLowerCase("fr");
      const scene = scenes.find((candidate) => candidate.id === requestedScene && candidate.complete)
        ?? scenes.find((candidate) => candidate.complete) ?? scenes[0];
      this.setImage("source-battle-background", scene?.background?.path ?? null);
      this.setImage("source-player-base", scene?.playerBase?.path ?? null);
      this.setImage("source-enemy-base", scene?.enemyBase?.path ?? null);
      document.getElementById("source-battle-stage")?.classList.toggle("incomplete-scene", scene?.complete !== true);
      await Promise.all([
        this.renderBattler("player", player.species, true, manifests),
        this.renderBattler("opponent", opponent.species, false, manifests),
      ]);
    } catch {
      this.fallback("player", player.name);
      this.fallback("opponent", opponent.name);
      this.message("Les graphismes locaux sont indisponibles, le combat reste jouable.");
    }
  }

  async playTurn(before: TeamBattleState, events: readonly TeamBattleEvent[]): Promise<void> {
    const names: Record<BattleSide, string> = {
      player: before.teams.player.members[before.teams.player.activeIndex]?.name ?? "Votre Pokémon",
      opponent: before.teams.opponent.members[before.teams.opponent.activeIndex]?.name ?? "Le Pokémon sauvage",
    };
    for (const event of events) {
      if (event.type === "moveUsed") {
        const battler = before.teams[event.side].members[before.teams[event.side].activeIndex];
        const move = battler?.moves.find((slot) => slot.move.internalName === event.move)?.move;
        this.message(`${names[event.side]} utilise ${move?.name ?? event.move} !`);
        if (move === undefined || !(await this.playSourceAnimation(event.side, move))) {
          const sprite = document.getElementById(`source-${event.side}-sprite`);
          sprite?.classList.add("attacking");
          await delay(360);
          sprite?.classList.remove("attacking");
        }
      } else if (event.type === "damageApplied") {
        const sprite = document.getElementById(`source-${event.target}-sprite`);
        sprite?.classList.add("hit");
        this.message(`${names[event.target]} perd ${event.amount} PV${event.critical ? " · Coup critique !" : ""}`);
        await delay(260);
        sprite?.classList.remove("hit");
      } else if (event.type === "hpRestored") {
        this.message(`${names[event.side]} récupère ${event.amount} PV.`);
        await delay(280);
      } else if (event.type === "abilityActivated") {
        this.message(`Le talent ${event.ability} de ${names[event.side]} s'active !`);
        await delay(280);
      } else if (event.type === "moveMissed") {
        this.message(`${names[event.side]} rate son attaque.`);
        await delay(320);
      } else if (event.type === "fainted") {
        document.getElementById(`source-${event.side}-sprite`)?.classList.add("fainted");
        this.message(`${names[event.side]} est K.O. !`);
        await delay(420);
      } else if (event.type === "statusApplied") {
        this.message(`${names[event.target]} subit ${event.status}.`);
        await delay(280);
      }
    }
  }

  message(value: string): void {
    const element = document.getElementById("source-battle-message");
    if (element !== null) element.textContent = value;
  }

  private async manifests(): Promise<LocalManifests> {
    if (this.#manifests !== null) return this.#manifests;
    this.#loading ??= loadLocalManifestsFromUrls([
      "/__pokemon-z/data/asset-manifest.json", "/__pokemon-z/data/pokemon-assets.json",
      "/__pokemon-z/data/battle-animations.json",
    ]);
    this.#manifests = await this.#loading;
    return this.#manifests;
  }

  private updateHud(state: TeamBattleState): void {
    for (const side of ["player", "opponent"] as const) {
      const team = state.teams[side];
      const battler = team.members[team.activeIndex];
      if (battler === undefined) continue;
      const name = document.getElementById(`source-${side}-name`);
      const level = document.getElementById(`source-${side}-level`);
      const hp = document.getElementById(`source-${side}-hp`);
      const bar = document.getElementById(`source-${side}-hp-bar`);
      if (name !== null) name.textContent = battler.name;
      if (level !== null) level.textContent = `N. ${battler.level}`;
      if (hp !== null) hp.textContent = side === "player" ? `${battler.hp} / ${battler.stats.maxHp}` : `${battler.hp} PV`;
      if (bar !== null) bar.style.width = `${Math.max(0, (battler.hp / battler.stats.maxHp) * 100)}%`;
      if (battler.hp > 0) document.getElementById(`source-${side}-sprite`)?.classList.remove("fainted");
    }
  }

  private setImage(id: string, path: string | null): void {
    const image = document.getElementById(id) as HTMLImageElement | null;
    if (image === null) return;
    image.hidden = path === null;
    if (path === null) image.removeAttribute("src"); else image.src = sourceUrl(path);
  }

  private async renderBattler(side: BattleSide, species: string, back: boolean, manifests: LocalManifests): Promise<void> {
    const record = manifests.pokemon.records.find((candidate) => candidate.internalName === species);
    const asset = record === undefined ? null : selectBattler(record, back);
    if (asset === null) { this.fallback(side, species); return; }
    const slot = document.getElementById(`source-${side}-sprite`);
    if (slot === null) return;
    try {
      const animation = await animatedCanvas(asset);
      this.#animations.push(animation);
      slot.replaceChildren(animation.element);
      slot.classList.remove("sprite-fallback");
    } catch {
      this.fallback(side, record?.name ?? species);
    }
  }

  private fallback(side: BattleSide, name: string): void {
    const slot = document.getElementById(`source-${side}-sprite`);
    if (slot === null) return;
    slot.textContent = name.slice(0, 1).toUpperCase();
    slot.classList.add("sprite-fallback");
  }

  private clearSprites(): void {
    for (const animation of this.#animations.splice(0)) animation.stop();
    for (const side of ["player", "opponent"] as const) {
      const slot = document.getElementById(`source-${side}-sprite`);
      slot?.replaceChildren();
      slot?.classList.remove("attacking", "hit", "fainted");
    }
  }

  private async playSourceAnimation(side: BattleSide, move: BattleMove): Promise<boolean> {
    const manifests = await this.manifests();
    const sourceAnimations = manifests.animations;
    if (sourceAnimations === undefined) return false;
    const selection = selectSourceBattleAnimation(sourceAnimations, side, move.internalName);
    if (selection === null) return false;
    const { animation, explicitOpponent, reverse } = selection;
    const front = document.getElementById("source-move-effects");
    const back = document.getElementById("source-effects-back");
    if (front === null || back === null) return false;
    try {
      const image = new Image();
      image.src = sourceUrl(animation.graphicPath);
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = sourceAnimations.coordinateSystem.width;
      canvas.height = sourceAnimations.coordinateSystem.height;
      canvas.className = "source-animation-canvas";
      const backCanvas = canvas.cloneNode(false) as HTMLCanvasElement;
      front.replaceChildren(canvas);
      back.replaceChildren(backCanvas);
      const context = canvas.getContext("2d");
      const backContext = backCanvas.getContext("2d");
      for (const [frameIndex, frame] of animation.frames.entries()) {
        this.playSourceTimings(animation, frameIndex);
        this.transformBattlers(frame, side, explicitOpponent, reverse);
        this.drawSourceFrame(backContext, image, frame, reverse, false);
        this.drawSourceFrame(context, image, frame, reverse, true);
        await delay(50);
      }
      return true;
    } catch {
      return false;
    } finally {
      front.replaceChildren();
      back.replaceChildren();
      this.resetBattlerTransforms();
    }
  }

  private drawSourceFrame(context: CanvasRenderingContext2D | null, image: HTMLImageElement,
    frame: readonly BattleAnimationCel[], reverse: boolean, front: boolean): void {
    const coordinateSystem = this.#manifests?.animations?.coordinateSystem;
    if (context === null || coordinateSystem === undefined) return;
    const { width, height, cellSize, sheetColumns } = coordinateSystem;
    context.clearRect(0, 0, width, height);
    const cels = frame.filter((cel) => cel.visible && cel.pattern >= 0 && cel.opacity > 0
      && (front ? cel.priority !== 0 && cel.priority !== 2 : cel.priority === 0 || cel.priority === 2))
      .sort((left, right) => left.priority - right.priority || left.slot - right.slot);
    for (const cel of cels) {
      context.save();
      const point = transformBattleAnimationPoint(cel.x, cel.y, reverse);
      context.translate(point.x, point.y);
      context.rotate((cel.angle * Math.PI) / 180);
      context.scale((cel.zoomX / 100) * (cel.mirror !== reverse ? -1 : 1), cel.zoomY / 100);
      context.globalAlpha = cel.opacity / 255;
      context.globalCompositeOperation = cel.blendType === 1 ? "lighter" : cel.blendType === 2 ? "multiply" : "source-over";
      const column = cel.pattern % sheetColumns;
      const row = Math.floor(cel.pattern / sheetColumns);
      context.drawImage(image, column * cellSize, row * cellSize, cellSize, cellSize,
        -cellSize / 2, -cellSize / 2, cellSize, cellSize);
      context.restore();
    }
  }

  private transformBattlers(frame: readonly BattleAnimationCel[], attacker: BattleSide,
    explicitOpponent: boolean, reverse: boolean): void {
    const userSide: BattleSide = explicitOpponent ? (attacker === "player" ? "opponent" : "player") : attacker;
    const targetSide: BattleSide = userSide === "player" ? "opponent" : "player";
    const stageWidth = document.getElementById("source-battle-stage")?.getBoundingClientRect().width ?? 512;
    for (const cel of frame) {
      if (cel.pattern !== -1 && cel.pattern !== -2) continue;
      const side = cel.pattern === -1 ? userSide : targetSide;
      const reference = transformBattleAnimationPoint(cel.pattern === -1 ? 128 : 384, cel.pattern === -1 ? 224 : 96, reverse);
      const point = transformBattleAnimationPoint(cel.x, cel.y, reverse);
      const sprite = document.getElementById(`source-${side}-sprite`);
      if (sprite === null) continue;
      sprite.style.translate = `${((point.x - reference.x) / 512) * stageWidth}px ${((point.y - reference.y) / 384) * stageWidth * 0.75}px`;
      sprite.style.rotate = `${reverse ? -cel.angle : cel.angle}deg`;
      sprite.style.scale = `${(cel.zoomX / 100) * (cel.mirror ? -1 : 1)} ${cel.zoomY / 100}`;
      sprite.style.opacity = String(cel.opacity / 255);
    }
  }

  private resetBattlerTransforms(): void {
    for (const side of ["player", "opponent"] as const) {
      const sprite = document.getElementById(`source-${side}-sprite`);
      if (sprite === null) continue;
      for (const property of ["translate", "rotate", "scale", "opacity"]) sprite.style.removeProperty(property);
    }
  }

  private playSourceTimings(animation: BattleAnimationRecord, frame: number): void {
    for (const timing of animation.timings) {
      if (timing.frame !== frame || timing.type !== 0 || timing.name.length === 0) continue;
      const audio = new Audio(sourceUrl(`Audio/SE/${timing.name}`));
      audio.volume = Math.min(1, Math.max(0, timing.volume / 100));
      audio.playbackRate = Math.min(4, Math.max(0.25, timing.pitch / 100));
      void audio.play().catch(() => { /* Un son absent ou bloqué ne doit jamais interrompre le combat. */ });
    }
  }

  private playAudio(path: string, options: { readonly loop?: boolean; readonly volume?: number; readonly oneShot?: boolean }): HTMLAudioElement {
    const audio = new Audio(sourceUrl(path));
    audio.loop = options.loop ?? false;
    audio.volume = options.volume ?? 1;
    if (options.oneShot === true) {
      this.#oneShots.add(audio);
      audio.addEventListener("ended", () => this.#oneShots.delete(audio), { once: true });
    }
    void audio.play().catch(() => {
      this.#oneShots.delete(audio);
      if (this.#battleMusic === audio) this.#battleMusic = null;
      if (this.#outroMusic === audio) this.#outroMusic = null;
    });
    return audio;
  }

  private stopAudio(): void {
    for (const audio of [this.#battleMusic, this.#outroMusic, ...this.#oneShots]) {
      if (audio === null) continue;
      audio.pause();
      audio.currentTime = 0;
    }
    this.#battleMusic = null;
    this.#outroMusic = null;
    this.#oneShots.clear();
  }
}
