import { buildBattleScenes, loadLocalManifestsFromUrls, resolvePokemonAsset, selectCry,
  type AssetManifest, type BattleAnimationCel, type BattleAnimationRecord, type BattleAnimationsManifest,
  type LocalManifests, type PokemonAssetReference, type PokemonAssetsManifest } from "@pokemon-z-battle/local-assets";
import type { BattleMove, BattleSide, BattlerState, TeamBattleEvent, TeamBattleState } from "@pokemon-z-battle/battle-engine";
import { sourceBattlePercent, sourceBattleScaledVisibleBottom, sourceBattleSpritePlacement, sourceBattleSpriteScale,
  sourceTrainerSpritePlacement } from "./source-battle-layout.js";
import { experienceAtLevel } from "@pokemon-z-battle/player-state";
import type { SourceBattleExperiencePresentation, SourceBattleOutcome } from "./source-battle-controller.js";

interface AnimatedCanvas {
  readonly element: HTMLCanvasElement;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly visibleBottom: number;
  stop(): void;
}

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
  let visibleBottom = frameHeight - 1;
  if (context !== null) {
    const pixels = context.getImageData(0, 0, frameWidth, frameHeight).data;
    outer: for (let y = frameHeight - 1; y >= 0; y -= 1) {
      for (let x = 0; x < frameWidth; x += 1) {
        if (pixels[(y * frameWidth + x) * 4 + 3]! > 0) {
          visibleBottom = y;
          break outer;
        }
      }
    }
  }
  const timer = frameCount > 1 ? window.setInterval(draw, 110) : null;
  return { element: canvas, frameWidth, frameHeight, visibleBottom,
    stop: () => { if (timer !== null) window.clearInterval(timer); } };
}

function delay(milliseconds: number): Promise<void> {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return new Promise((resolve) => window.setTimeout(resolve, reduced ? 20 : milliseconds));
}

// Courbe exacte de pbSendOut dans le script source. Le Dresseur reste une image
// statique ; seule la Ball suit cette trajectoire pendant qu'il sort de l'écran.
export const SOURCE_PLAYER_BALL_PATH = [
  [0, 146], [10, 134], [21, 122], [30, 112], [39, 104], [46, 99], [53, 95], [61, 93], [68, 93], [75, 96],
  [82, 102], [89, 111], [94, 121], [100, 134], [106, 150], [111, 166], [116, 183], [120, 199], [124, 216], [127, 238],
] as const;
const SOURCE_BATTLE_VIEWPORT_HEIGHT = 384;
export const SOURCE_TRAINER_Y_OFFSET = SOURCE_BATTLE_VIEWPORT_HEIGHT - 320;

export function sourcePlayerBallKeyframes(): Keyframe[] {
  return SOURCE_PLAYER_BALL_PATH.map(([x, y], index) => ({
    left: sourceBattlePercent(x, "x"), top: sourceBattlePercent(y + SOURCE_TRAINER_Y_OFFSET, "y"),
    transform: `translate(-50%, -50%) rotate(${(index * 40) % 360}deg)`,
    offset: index / (SOURCE_PLAYER_BALL_PATH.length - 1),
  }));
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
  readonly sendOut: string | null;
}

function availableAudio(manifest: AssetManifest, path: string): string | null {
  const normalized = path.toLocaleLowerCase("en");
  return manifest.records.find((entry) => entry.mediaType === "audio"
    && entry.path.toLocaleLowerCase("en") === normalized)?.path ?? null;
}

function availableAudioStem(manifest: AssetManifest, stem: string): string | null {
  const normalized = stem.toLocaleLowerCase("en");
  return manifest.records.find((entry) => entry.mediaType === "audio"
    && entry.path.slice(0, entry.path.lastIndexOf(".")).toLocaleLowerCase("en") === normalized)?.path ?? null;
}

export function selectSourceBattleAudio(assets: AssetManifest, pokemon: PokemonAssetsManifest,
  playerSpecies: string, opponentSpecies: string, battleMusic = "Salvaje.ogg", victoryMusic = "VictoriaSalvaje.ogg",
  appearance?: { readonly player?: BattlerState["appearance"]; readonly opponent?: BattlerState["appearance"] }): SourceBattleAudio {
  const cry = (species: string, visual: BattlerState["appearance"]): string | null => {
    const record = pokemon.records.find((candidate) => candidate.internalName === species);
    return record === undefined ? null : resolvePokemonAsset(record, { kind: "cry", form: visual?.form ?? 0,
      shiny: visual?.shiny ?? false, female: visual?.gender === "female" }).asset?.path ?? selectCry(record)?.path ?? null;
  };
  return {
    battleMusic: availableAudio(assets, `Audio/BGM/${battleMusic}`),
    victoryMusic: availableAudio(assets, `Audio/ME/${victoryMusic}`),
    playerCry: cry(playerSpecies, appearance?.player),
    opponentCry: cry(opponentSpecies, appearance?.opponent),
    sendOut: availableAudioStem(assets, "Audio/SE/recall"),
  };
}

export class SourceBattleVisuals {
  #manifests: LocalManifests | null = null;
  #loading: Promise<LocalManifests> | null = null;
  #animations: AnimatedCanvas[] = [];
  #renderedSpecies = "";
  #rendering: Promise<void> | null = null;
  #battleMusic: HTMLAudioElement | null = null;
  #outroMusic: HTMLAudioElement | null = null;
  #oneShots = new Set<HTMLAudioElement>();
  #audioSession = 0;
  #victoryMusicPath: string | null = null;
  #playerTrainerImage: HTMLImageElement | null = null;
  #opponentTrainerImage: HTMLImageElement | null = null;

  setPlayerTrainerImage(image: HTMLImageElement | null): void {
    this.#playerTrainerImage = image;
  }

  setOpponentTrainerImage(image: HTMLImageElement | null): void {
    this.#opponentTrainerImage = image;
  }

  async startBattle(state: TeamBattleState, audio: { readonly battleMusic?: string | null;
    readonly victoryMusic?: string | null; readonly battleback?: string;
    readonly opponentTrainer?: { readonly id: number; readonly name: string } } = {}): Promise<void> {
    this.stopAudio();
    this.#renderedSpecies = "";
    this.resetBattlerTransforms();
    const panel = document.getElementById("encounter-panel");
    const stage = document.getElementById("source-battle-stage");
    panel?.classList.remove("leaving");
    panel?.classList.add("entering");
    panel?.classList.add("intro-playing");
    stage?.classList.add("intro-playing");
    stage?.classList.toggle("opponent-intro", audio.opponentTrainer !== undefined);
    const experienceTrack = document.getElementById("source-player-exp-track");
    const experienceBar = document.getElementById("source-player-exp-bar");
    experienceTrack?.classList.remove("active");
    if (experienceBar !== null) experienceBar.style.width = "0%";
    window.setTimeout(() => panel?.classList.remove("entering"), 700);
    const session = ++this.#audioSession;
    // Le chargement asynchrone des manifestes peut sortir de la fenêtre d'activation
    // utilisateur. Démarrer la BGM source immédiatement évite un blocage d'autoplay.
    const battleMusic = audio.battleMusic ?? "Salvaje.ogg";
    const victoryMusic = audio.victoryMusic ?? "VictoriaSalvaje.ogg";
    this.#victoryMusicPath = `Audio/ME/${victoryMusic}`;
    this.#battleMusic = this.playAudio(`Audio/BGM/${battleMusic}`, { loop: true, volume: 0 });
    try {
      const manifests = await this.manifests();
      if (session !== this.#audioSession) return;
      const player = state.teams.player.members[state.teams.player.activeIndex];
      const opponent = state.teams.opponent.members[state.teams.opponent.activeIndex];
      if (player === undefined || opponent === undefined) return;
      const selectedAudio = selectSourceBattleAudio(manifests.assets, manifests.pokemon, player.species, opponent.species,
        battleMusic, victoryMusic, { player: player.appearance, opponent: opponent.appearance });
      this.#victoryMusicPath = selectedAudio.victoryMusic;
      await this.render(state, audio.battleback ?? "snow");
      if (session !== this.#audioSession) return;
      await this.playOpeningTransition(session);
      if (session !== this.#audioSession) return;
      if (this.#battleMusic !== null) this.#battleMusic.volume = 0.55;
      if (audio.opponentTrainer !== undefined) {
        await this.playOpponentEntrance(audio.opponentTrainer, opponent.name, session, selectedAudio.sendOut,
          selectedAudio.opponentCry);
      } else {
        await this.playWildOpponentEntrance(opponent.name, session, selectedAudio.opponentCry);
      }
      await this.playPlayerEntrance(player.name, session, selectedAudio.sendOut, selectedAudio.playerCry);
    } catch {
      // Les visuels et le moteur de combat restent utilisables si l'audio local est absent.
    } finally {
      if (session === this.#audioSession) {
        panel?.classList.remove("intro-playing");
        stage?.classList.remove("intro-playing", "opponent-intro", "revealing-opponent", "revealing-player");
      }
    }
  }

  async endBattle(winner: BattleSide | null, outcome: SourceBattleOutcome = {}): Promise<void> {
    const victoryPath = winner === "player" ? this.#victoryMusicPath : null;
    const session = ++this.#audioSession;
    const panel = document.getElementById("encounter-panel");
    panel?.classList.add("outro-playing");
    await this.fadeAudio(this.#battleMusic, winner === "player" ? 350 : 1_000);
    this.#battleMusic = null;
    if (victoryPath !== null) this.#outroMusic = this.playAudio(victoryPath, { volume: 0.65 });
    if (winner === "player") {
      this.message("Victoire !");
      await delay(700);
      if (outcome.experience !== undefined) await this.playExperience(outcome.experience, session);
      if (outcome.money !== undefined && outcome.money > 0) {
        this.message(`Vous remportez ${outcome.money.toLocaleString("fr-FR")} ₽ !`);
        await delay(850);
      }
    } else if (winner === "opponent") {
      this.message("Vous n'avez plus de Pokémon en état de combattre…");
      await delay(900);
      if (outcome.money !== undefined && outcome.money < 0) {
        this.message(`Vous perdez ${Math.abs(outcome.money).toLocaleString("fr-FR")} ₽.`);
        await delay(750);
      }
    }
    if (session !== this.#audioSession) return;
    panel?.classList.remove("entering");
    panel?.classList.add("leaving");
    await Promise.all([delay(900), this.fadeAudio(this.#outroMusic, 900)]);
    panel?.classList.remove("leaving");
    panel?.classList.remove("outro-playing");
    this.stopAudio();
    this.#victoryMusicPath = null;
  }

  async render(state: TeamBattleState, battleback = "snow"): Promise<void> {
    this.updateHud(state);
    const player = state.teams.player.members[state.teams.player.activeIndex];
    const opponent = state.teams.opponent.members[state.teams.opponent.activeIndex];
    if (player === undefined || opponent === undefined) return;
    const appearanceKey = (battler: BattlerState) => `${battler.species}:${battler.appearance?.form ?? 0}:${Number(battler.appearance?.shiny)}:${battler.appearance?.gender ?? "unknown"}`;
    const key = `${battleback}:${appearanceKey(player)}:${appearanceKey(opponent)}`;
    if (key === this.#renderedSpecies) {
      if (this.#rendering !== null) await this.#rendering;
      return;
    }
    this.#renderedSpecies = key;
    const rendering = (async (): Promise<void> => {
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
          this.renderBattler("player", player, true, manifests),
          this.renderBattler("opponent", opponent, false, manifests),
        ]);
      } catch {
        this.fallback("player", player.name);
        this.fallback("opponent", opponent.name);
        this.message("Les graphismes locaux sont indisponibles, le combat reste jouable.");
      }
    })();
    this.#rendering = rendering;
    await rendering;
    if (this.#rendering === rendering) this.#rendering = null;
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
      } else if (event.type === "pokemonSwitched") {
        const sprite = document.getElementById(`source-${event.side}-sprite`);
        this.message(`${event.from} revient. ${event.to}, en avant !`);
        const animation = sprite?.animate([{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }],
          { duration: 520, easing: "ease-in-out" });
        await animation?.finished.catch(() => undefined);
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

  private async playOpeningTransition(session: number): Promise<void> {
    const curtain = document.getElementById("source-battle-curtain");
    const stage = document.getElementById("source-battle-stage");
    if (curtain === null || stage === null) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    curtain.classList.add("active");
    const flashes = curtain.animate(reduced ? [{ opacity: 1 }, { opacity: 0 }] : [
      { opacity: 0, background: "#a0a0a0", offset: 0 },
      { opacity: .82, background: "#a0a0a0", offset: .09 }, { opacity: 0, offset: .18 },
      { opacity: .82, background: "#a0a0a0", offset: .27 }, { opacity: 0, offset: .36 },
      { opacity: .82, background: "#a0a0a0", offset: .45 }, { opacity: 0, offset: .54 },
      { opacity: 1, background: "#050706", offset: .72 }, { opacity: 1, background: "#050706", offset: 1 },
    ], { duration: reduced ? 20 : 900, fill: "forwards", easing: "linear" });
    await flashes.finished.catch(() => undefined);
    if (session !== this.#audioSession) return;
    const reveal = stage.animate([
      { clipPath: "inset(50% 0 50% 0)" }, { clipPath: "inset(0 0 0 0)" },
    ], { duration: reduced ? 20 : 620, fill: "forwards", easing: "ease-out" });
    const uncover = curtain.animate([{ opacity: 1 }, { opacity: 0 }],
      { duration: reduced ? 20 : 620, fill: "forwards", easing: "ease-out" });
    await Promise.all([reveal.finished.catch(() => undefined), uncover.finished.catch(() => undefined)]);
    reveal.cancel(); uncover.cancel(); flashes.cancel(); curtain.classList.remove("active");
  }

  private async playWildOpponentEntrance(pokemonName: string, session: number, cry: string | null): Promise<void> {
    const stage = document.getElementById("source-battle-stage");
    const sprite = document.getElementById("source-opponent-sprite");
    if (stage === null || sprite === null) return;
    stage.classList.add("revealing-opponent");
    this.message(`Un ${pokemonName} sauvage apparaît !`);
    if (cry !== null) this.playAudio(cry, { volume: 0.8, oneShot: true });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveal = sprite.animate([
      { opacity: 0, transform: "translateX(-42px) scale(.78)", filter: "brightness(0)" },
      { opacity: 1, transform: "translateX(0) scale(1)", filter: "brightness(1)" },
    ], { duration: reduced ? 20 : 720, fill: "forwards", easing: "cubic-bezier(.2,.8,.2,1)" });
    await reveal.finished.catch(() => undefined);
    if (session === this.#audioSession) await delay(reduced ? 20 : 420);
    reveal.cancel();
  }

  private async playPlayerEntrance(playerName: string, session: number, sendOutSound: string | null,
    playerCry: string | null): Promise<void> {
    const trainer = document.getElementById("source-player-trainer") as HTMLImageElement | null;
    const ball = document.getElementById("source-player-ball");
    const stage = document.getElementById("source-battle-stage");
    const sprite = document.getElementById("source-player-sprite");
    const flash = document.getElementById("source-sendout-flash");
    if (trainer === null || ball === null || stage === null || sprite === null || flash === null) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const customTrainer = this.#playerTrainerImage;
    trainer.src = customTrainer?.src ?? sourceUrl("Graphics/Characters/trback000.png");
    this.placeTrainer(trainer, "player", customTrainer?.naturalWidth ?? 160, customTrainer?.naturalHeight ?? 220);
    trainer.hidden = false;
    ball.hidden = true;
    this.message(`En avant, ${playerName} !`);
    const arrival = trainer.animate([
      { transform: "translateX(208px)", opacity: 0 }, { transform: "translateX(0)", opacity: 1 },
    ], { duration: reduced ? 20 : 520, easing: "ease-out" });
    await arrival.finished.catch(() => undefined);
    await delay(reduced ? 20 : 330);
    const trainerDuration = reduced ? 20 : 1_100;
    const trainerAnimation = trainer.animate([
      { transform: "translateX(0)", opacity: 1 },
      { transform: "translateX(-208px)", opacity: 1 },
    ], { duration: trainerDuration, easing: "linear", fill: "forwards" });
    await delay(reduced ? 0 : 425);
    ball.hidden = false;
    const ballAnimation = ball.animate(sourcePlayerBallKeyframes(), {
      duration: reduced ? 20 : 650, easing: "linear", fill: "forwards",
    });
    await Promise.all([trainerAnimation.finished.catch(() => undefined), ballAnimation.finished.catch(() => undefined)]);
    if (session !== this.#audioSession) return;
    trainer.hidden = true;
    trainerAnimation.cancel();
    const [lastX, lastY] = SOURCE_PLAYER_BALL_PATH.at(-1)!;
    ball.style.left = sourceBattlePercent(lastX, "x");
    ball.style.top = sourceBattlePercent(lastY + SOURCE_TRAINER_Y_OFFSET, "y");
    ball.style.transform = `translate(-50%, -50%) rotate(${((SOURCE_PLAYER_BALL_PATH.length - 1) * 40) % 360}deg)`;
    ballAnimation.cancel();
    ball.hidden = true;
    stage.classList.add("revealing-player");
    if (sendOutSound !== null) this.playAudio(sendOutSound, { volume: 0.8, oneShot: true });
    if (playerCry !== null) this.playAudio(playerCry, { volume: 0.8, oneShot: true });
    const revealAnimation = sprite.animate([
      { opacity: 0, transform: "scale(.125)", filter: "brightness(3)" },
      { opacity: 1, transform: "scale(1)", filter: "brightness(1)" },
    ], { duration: reduced ? 20 : 760, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    const flashAnimation = flash.animate([
      { opacity: 0, offset: 0 }, { opacity: 0, offset: 0.16 },
      { opacity: 0.92, offset: 0.52 }, { opacity: 0, offset: 1 },
    ], { duration: reduced ? 20 : 760, easing: "linear" });
    await Promise.all([revealAnimation.finished.catch(() => undefined), flashAnimation.finished.catch(() => undefined)]);
    revealAnimation.cancel();
    flashAnimation.cancel();
  }

  private async playOpponentEntrance(trainerData: { readonly id: number; readonly name: string }, pokemonName: string,
    session: number, sendOutSound: string | null, opponentCry: string | null): Promise<void> {
    const trainer = document.getElementById("source-opponent-trainer") as HTMLImageElement | null;
    const stage = document.getElementById("source-battle-stage");
    const sprite = document.getElementById("source-opponent-sprite");
    if (trainer === null || stage === null || sprite === null) return;
    const customTrainer = this.#opponentTrainerImage;
    const path = `Graphics/Characters/trainer${String(trainerData.id).padStart(3, "0")}.png`;
    trainer.src = customTrainer?.src ?? sourceUrl(path);
    try { await trainer.decode(); } catch { stage.classList.remove("opponent-intro"); return; }
    if (session !== this.#audioSession) return;
    this.placeTrainer(trainer, "opponent", customTrainer?.naturalWidth ?? trainer.naturalWidth,
      customTrainer?.naturalHeight ?? trainer.naturalHeight);
    trainer.hidden = false;
    this.message(`${trainerData.name} vous défie !`);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const arrival = trainer.animate([
      { transform: "translateX(-208px)", opacity: 0 }, { transform: "translateX(0)", opacity: 1 },
    ], { duration: reduced ? 20 : 620, easing: "ease-out" });
    await arrival.finished.catch(() => undefined);
    await delay(reduced ? 20 : 530);
    stage.classList.add("revealing-opponent");
    this.message(`${trainerData.name} envoie ${pokemonName} !`);
    if (sendOutSound !== null) this.playAudio(sendOutSound, { volume: 0.8, oneShot: true });
    if (opponentCry !== null) this.playAudio(opponentCry, { volume: 0.8, oneShot: true });
    const trainerAnimation = trainer.animate([
      { transform: "translateX(0)", opacity: 1 },
      { transform: "translateX(208px)", opacity: 1 },
    ], { duration: reduced ? 20 : 1_100, easing: "linear", fill: "forwards" });
    const pokemonAnimation = sprite.animate([
      { opacity: 0, transform: "scale(.125)", filter: "brightness(3)" },
      { opacity: 1, transform: "scale(1)", filter: "brightness(1)" },
    ], { duration: reduced ? 20 : 760, delay: reduced ? 0 : 260, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    await Promise.all([trainerAnimation.finished.catch(() => undefined), pokemonAnimation.finished.catch(() => undefined)]);
    trainerAnimation.cancel(); pokemonAnimation.cancel(); trainer.hidden = true;
    stage.classList.remove("opponent-intro", "revealing-opponent");
  }

  private async playExperience(experience: SourceBattleExperiencePresentation, session: number): Promise<void> {
    const bar = document.getElementById("source-player-exp-bar");
    const level = document.getElementById("source-player-level");
    const track = document.getElementById("source-player-exp-track");
    if (bar === null || level === null || track === null) return;
    track.classList.add("active");
    this.message(`${experience.pokemonName} gagne ${experience.amount} points d'Expérience !`);
    await delay(700);
    let cursor = experience.beforeExperience;
    for (let currentLevel = experience.beforeLevel; currentLevel <= experience.afterLevel && cursor <= experience.afterExperience; currentLevel += 1) {
      if (session !== this.#audioSession) return;
      const floor = experienceAtLevel(currentLevel, experience.growthRate);
      const ceiling = currentLevel >= 100 ? floor + 1 : experienceAtLevel(currentLevel + 1, experience.growthRate);
      const target = Math.min(experience.afterExperience, ceiling);
      const startRatio = Math.max(0, Math.min(1, (cursor - floor) / Math.max(1, ceiling - floor)));
      const endRatio = Math.max(0, Math.min(1, (target - floor) / Math.max(1, ceiling - floor)));
      bar.style.width = `${startRatio * 100}%`;
      const animation = bar.animate([{ width: `${startRatio * 100}%` }, { width: `${endRatio * 100}%` }],
        { duration: Math.max(260, (endRatio - startRatio) * 1_150), fill: "forwards", easing: "linear" });
      await animation.finished.catch(() => undefined);
      animation.cancel(); bar.style.width = `${endRatio * 100}%`;
      cursor = target;
      if (cursor >= ceiling && currentLevel < experience.afterLevel) {
        level.textContent = `N. ${currentLevel + 1}`;
        this.message(`${experience.pokemonName} monte au niveau ${currentLevel + 1} !`);
        await delay(700);
        bar.style.width = "0%";
      }
      if (currentLevel >= experience.afterLevel || currentLevel >= 100) break;
    }
    for (const move of experience.learnedMoves) {
      this.message(`${experience.pokemonName} apprend ${move} !`);
      await delay(700);
    }
    if (experience.skippedMoves.length > 0) {
      this.message(`Capacité à choisir plus tard : ${experience.skippedMoves.join(", ")}.`);
      await delay(850);
    }
  }

  private placeTrainer(element: HTMLElement, side: BattleSide, width: number, height: number): void {
    const placement = sourceTrainerSpritePlacement(side, width, height);
    element.style.left = sourceBattlePercent(placement.left, "x");
    element.style.top = sourceBattlePercent(placement.top, "y");
    element.style.width = sourceBattlePercent(placement.width, "x");
    element.style.height = sourceBattlePercent(placement.height, "y");
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
      const teamState = document.getElementById(`source-${side}-team`);
      if (name !== null) name.textContent = battler.name;
      if (level !== null) level.textContent = `N. ${battler.level}`;
      if (hp !== null) hp.textContent = side === "player" ? `${battler.hp} / ${battler.stats.maxHp}` : `${battler.hp} PV`;
      if (bar !== null) {
        const ratio = Math.max(0, battler.hp / battler.stats.maxHp);
        bar.style.width = `${ratio * 100}%`;
        bar.dataset.health = ratio <= 0.2 ? "critical" : ratio <= 0.5 ? "warning" : "healthy";
      }
      if (teamState !== null) {
        teamState.replaceChildren(...team.members.map((member, index) => {
          const dot = document.createElement("i");
          dot.className = member.hp <= 0 ? "fainted" : index === team.activeIndex ? "active" : "ready";
          dot.title = `${member.name} · ${member.hp}/${member.stats.maxHp} PV`;
          return dot;
        }));
      }
      if (battler.hp > 0) document.getElementById(`source-${side}-sprite`)?.classList.remove("fainted");
    }
  }

  private setImage(id: string, path: string | null): void {
    const image = document.getElementById(id) as HTMLImageElement | null;
    if (image === null) return;
    image.hidden = path === null;
    if (path === null) image.removeAttribute("src"); else image.src = sourceUrl(path);
  }

  private async renderBattler(side: BattleSide, battler: BattlerState, back: boolean, manifests: LocalManifests): Promise<void> {
    const record = manifests.pokemon.records.find((candidate) => candidate.internalName === battler.species);
    const asset = record === undefined ? null : resolvePokemonAsset(record, { kind: "battler", back,
      form: battler.appearance?.form ?? 0, shiny: battler.appearance?.shiny ?? false,
      female: battler.appearance?.gender === "female" }).asset;
    if (asset === null) { this.fallback(side, battler.species); return; }
    const slot = document.getElementById(`source-${side}-sprite`);
    if (slot === null) return;
    try {
      const animation = await animatedCanvas(asset);
      this.#animations.push(animation);
      slot.replaceChildren(animation.element);
      slot.classList.remove("sprite-fallback");
      const scale = sourceBattleSpriteScale(side);
      const placement = sourceBattleSpritePlacement(side, animation.frameWidth * scale, animation.frameHeight * scale,
        sourceBattleScaledVisibleBottom(animation.visibleBottom, scale));
      slot.style.left = sourceBattlePercent(placement.left, "x");
      slot.style.top = sourceBattlePercent(placement.top, "y");
      slot.style.width = sourceBattlePercent(placement.width, "x");
      slot.style.height = sourceBattlePercent(placement.height, "y");
      slot.style.transformOrigin = `${(placement.originX / placement.width) * 100}% ${(placement.originY / placement.height) * 100}%`;
    } catch {
      this.fallback(side, record?.name ?? battler.species);
    }
  }

  private fallback(side: BattleSide, name: string): void {
    const slot = document.getElementById(`source-${side}-sprite`);
    if (slot === null) return;
    slot.textContent = name.slice(0, 1).toUpperCase();
    slot.classList.add("sprite-fallback");
    const placement = sourceBattleSpritePlacement(side, 96, 96, 95);
    slot.style.left = sourceBattlePercent(placement.left, "x");
    slot.style.top = sourceBattlePercent(placement.top, "y");
    slot.style.width = sourceBattlePercent(placement.width, "x");
    slot.style.height = sourceBattlePercent(placement.height, "y");
    slot.style.transformOrigin = "center bottom";
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

  private async fadeAudio(audio: HTMLAudioElement | null, duration: number): Promise<void> {
    if (audio === null) return;
    const initialVolume = audio.volume;
    if (initialVolume <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      audio.pause();
      return;
    }
    const startedAt = performance.now();
    await new Promise<void>((resolve) => {
      const frame = (now: number): void => {
        const ratio = Math.min(1, (now - startedAt) / Math.max(1, duration));
        audio.volume = initialVolume * (1 - ratio);
        if (ratio < 1 && !audio.paused) window.requestAnimationFrame(frame);
        else resolve();
      };
      window.requestAnimationFrame(frame);
    });
    audio.pause();
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
