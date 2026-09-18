import type { BattleMove, BattleSide } from "@pokemon-z-battle/battle-engine";
import type { BattleAnimationCel, BattleAnimationRecord, BattleAnimationsManifest } from "@pokemon-z-battle/local-assets";

export type AttackerMotion = "lunge" | "dash" | "slash" | "cast";
export type MoveEffect = "impact" | "speed" | "claws" | "water" | "vine" | "stars";

export interface MovePresentation {
  readonly motion: AttackerMotion;
  readonly effect: MoveEffect;
  readonly color: string;
  readonly particles: number;
  readonly durationMs: number;
}

export const MOVE_PRESENTATIONS = {
  TACKLE: { motion: "lunge", effect: "impact", color: "#f4e9ca", particles: 3, durationMs: 520 },
  QUICKATTACK: { motion: "dash", effect: "speed", color: "#fff6bf", particles: 7, durationMs: 430 },
  SCRATCH: { motion: "slash", effect: "claws", color: "#fff0dc", particles: 3, durationMs: 500 },
  WATERGUN: { motion: "cast", effect: "water", color: "#56c9ff", particles: 8, durationMs: 720 },
  VINEWHIP: { motion: "cast", effect: "vine", color: "#67d66e", particles: 2, durationMs: 680 },
  SWIFT: { motion: "cast", effect: "stars", color: "#ffe46b", particles: 7, durationMs: 760 },
  SLEEPPOWDER: { motion: "cast", effect: "stars", color: "#b9a7e8", particles: 9, durationMs: 760 },
  POISONPOWDER: { motion: "cast", effect: "stars", color: "#aa67cf", particles: 9, durationMs: 720 },
  TOXIC: { motion: "cast", effect: "water", color: "#8d3db5", particles: 7, durationMs: 700 },
  THUNDERWAVE: { motion: "cast", effect: "speed", color: "#ffe36b", particles: 8, durationMs: 620 },
  WILLOWISP: { motion: "cast", effect: "impact", color: "#6ac8ff", particles: 5, durationMs: 680 },
  ICEBEAM: { motion: "cast", effect: "water", color: "#b9efff", particles: 8, durationMs: 720 },
  LUZDECADENTE: { motion: "cast", effect: "stars", color: "#aa8bff", particles: 9, durationMs: 760 },
  CUT: { motion: "slash", effect: "claws", color: "#ff7590", particles: 3, durationMs: 520 },
  CHARGEBEAM: { motion: "cast", effect: "speed", color: "#ffe36b", particles: 8, durationMs: 650 },
  SANDATTACK: { motion: "cast", effect: "stars", color: "#d9bc79", particles: 7, durationMs: 600 },
  HOWL: { motion: "cast", effect: "speed", color: "#f3ddb0", particles: 5, durationMs: 560 },
  HARDEN: { motion: "cast", effect: "stars", color: "#bbc4d2", particles: 5, durationMs: 560 },
  FLAMECHARGE: { motion: "dash", effect: "impact", color: "#ff7b4e", particles: 8, durationMs: 620 },
  GROWL: { motion: "cast", effect: "speed", color: "#f3ddb0", particles: 5, durationMs: 560 },
  TAILWHIP: { motion: "lunge", effect: "speed", color: "#f4e9ca", particles: 4, durationMs: 520 },
  ICYWIND: { motion: "cast", effect: "water", color: "#b9efff", particles: 9, durationMs: 700 },
  SNARL: { motion: "cast", effect: "speed", color: "#705b8f", particles: 7, durationMs: 620 },
  SHADOWBALL: { motion: "cast", effect: "stars", color: "#7959b8", particles: 8, durationMs: 700 },
} as const satisfies Readonly<Record<string, MovePresentation>>;

export function transformSourcePoint(x: number, y: number, reverse: boolean): { readonly x: number; readonly y: number } {
  return reverse ? { x: 512 - x, y: 320 - y } : { x, y };
}

export function presentationFor(move: BattleMove): MovePresentation {
  const exact = MOVE_PRESENTATIONS[move.internalName as keyof typeof MOVE_PRESENTATIONS];
  if (exact !== undefined) return exact;
  if (move.type === "WATER") return { motion: "cast", effect: "water", color: "#56c9ff", particles: 6, durationMs: 650 };
  if (move.type === "GRASS") return { motion: "cast", effect: "vine", color: "#67d66e", particles: 2, durationMs: 620 };
  return move.category === "Physical"
    ? { motion: "lunge", effect: "impact", color: "#ffffff", particles: 3, durationMs: 500 }
    : { motion: "cast", effect: "stars", color: "#dbe8ff", particles: 5, durationMs: 650 };
}

function abortedDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Presentation cancelled", "AbortError")); return; }
    const timer = window.setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("Presentation cancelled", "AbortError")); }, { once: true });
  });
}

export class BattlePresenter {
  readonly #stage: HTMLElement;
  readonly #effects: HTMLElement;
  readonly #backEffects: HTMLElement | null;
  readonly #message: HTMLElement;
  #controller = new AbortController();
  #speed = 1;
  #sourceAnimations: BattleAnimationsManifest | null = null;
  #assetUrl: ((path: string) => Promise<string>) | null = null;

  constructor(stage: HTMLElement, effects: HTMLElement, message: HTMLElement) {
    this.#stage = stage;
    this.#effects = effects;
    this.#backEffects = document.getElementById("source-effects-back");
    this.#message = message;
  }

  setSpeed(value: number): void {
    this.#speed = value > 0 ? value : 1;
  }

  setSourceAnimations(manifest: BattleAnimationsManifest | null, assetUrl: ((path: string) => Promise<string>) | null): void {
    this.#sourceAnimations = manifest;
    this.#assetUrl = assetUrl;
  }

  cancel(): void {
    this.#controller.abort();
    this.#controller = new AbortController();
    this.#effects.replaceChildren();
    this.#backEffects?.replaceChildren();
    this.#stage.classList.remove("camera-impact", "camera-critical");
    for (const side of ["player", "opponent"] as const) {
      document.getElementById(`${side}-sprite`)?.classList.remove("motion-lunge", "motion-dash", "motion-slash", "motion-cast", "hit");
    }
    this.resetSourceBattlers();
  }

  message(text: string): void {
    this.#message.textContent = text;
  }

  async pause(milliseconds: number): Promise<void> {
    await abortedDelay(this.duration(milliseconds), this.#controller.signal);
  }

  async playMove(side: BattleSide, move: BattleMove): Promise<void> {
    const presentation = presentationFor(move);
    if (await this.playSourceAnimation(side, move)) return;
    const duration = this.duration(presentation.durationMs);
    this.#stage.style.setProperty("--effect-duration", `${duration}ms`);
    const sprite = document.getElementById(`${side}-sprite`);
    if (sprite === null) return;
    sprite.classList.add(`motion-${presentation.motion}`);
    this.#effects.replaceChildren(...Array.from({ length: presentation.particles }, (_, index) => {
      const particle = document.createElement("i");
      particle.style.setProperty("--particle-index", String(index));
      particle.style.setProperty("--effect-color", presentation.color);
      return particle;
    }));
    this.#effects.className = `move-effects effect-${presentation.effect} from-${side}`;
    await abortedDelay(duration, this.#controller.signal);
    sprite.classList.remove(`motion-${presentation.motion}`);
    this.#effects.replaceChildren();
    this.#effects.className = "move-effects";
  }

  async playImpact(target: BattleSide, critical: boolean): Promise<void> {
    const duration = this.duration(critical ? 420 : 300);
    this.#stage.style.setProperty("--impact-duration", `${duration}ms`);
    const sprite = document.getElementById(`${target}-sprite`);
    sprite?.classList.add("hit");
    this.#stage.classList.add(critical ? "camera-critical" : "camera-impact");
    await abortedDelay(duration, this.#controller.signal);
    sprite?.classList.remove("hit");
    this.#stage.classList.remove("camera-impact", "camera-critical");
  }

  private duration(milliseconds: number): number {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return Math.max(20, milliseconds * (reduced ? 0.08 : this.#speed));
  }

  private async playSourceAnimation(side: BattleSide, move: BattleMove): Promise<boolean> {
    if (this.#sourceAnimations === null || this.#assetUrl === null) return false;
    const mapping = this.#sourceAnimations.mappings.find((entry) => entry.internalName === move.internalName);
    if (mapping === undefined) return false;
    const explicitOpponent = side === "opponent" && mapping.opponent !== null;
    const animationIndex = side === "player" ? mapping.player : (mapping.opponent ?? mapping.player);
    const animation = this.#sourceAnimations.animations.find((entry) => entry.index === animationIndex);
    if (animation === undefined) return false;
    try {
      const image = new Image();
      image.src = await this.#assetUrl(animation.graphicPath);
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = this.#sourceAnimations.coordinateSystem.width;
      canvas.height = this.#sourceAnimations.coordinateSystem.height;
      canvas.className = "source-animation-canvas";
      const backCanvas = canvas.cloneNode(false) as HTMLCanvasElement;
      this.#effects.className = "move-effects source-animation";
      this.#effects.replaceChildren(canvas);
      this.#backEffects?.replaceChildren(backCanvas);
      const duration = this.duration(animation.frames.length * 50);
      this.#stage.style.setProperty("--effect-duration", `${duration}ms`);
      const context = canvas.getContext("2d");
      const backContext = backCanvas.getContext("2d");
      for (const [frameIndex, frame] of animation.frames.entries()) {
        this.playSourceTimings(animation, frameIndex);
        const reverse = side === "opponent" && !explicitOpponent;
        this.transformSourceBattlers(frame, side, explicitOpponent, reverse);
        this.drawSourceFrame(backContext, image, frame, reverse, false);
        this.drawSourceFrame(context, image, frame, reverse, true);
        await this.pause(50);
      }
      this.#effects.replaceChildren();
      this.#backEffects?.replaceChildren();
      this.resetSourceBattlers();
      this.#effects.className = "move-effects";
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      this.#effects.replaceChildren();
      this.#backEffects?.replaceChildren();
      this.resetSourceBattlers();
      this.#effects.className = "move-effects";
      return false;
    }
  }

  private drawSourceFrame(
    context: CanvasRenderingContext2D | null,
    image: HTMLImageElement,
    frame: readonly BattleAnimationCel[],
    reverse: boolean,
    front: boolean,
  ): void {
    if (context === null || this.#sourceAnimations === null) return;
    const { width, height, cellSize, sheetColumns } = this.#sourceAnimations.coordinateSystem;
    context.clearRect(0, 0, width, height);
    const cels = frame.filter((cel) => cel.visible && cel.pattern >= 0 && cel.opacity > 0
      && (front ? cel.priority !== 0 && cel.priority !== 2 : cel.priority === 0 || cel.priority === 2))
      .sort((left, right) => left.priority - right.priority || left.slot - right.slot);
    for (const cel of cels) {
      const column = cel.pattern % sheetColumns;
      const row = Math.floor(cel.pattern / sheetColumns);
      context.save();
      const point = transformSourcePoint(cel.x, cel.y, reverse);
      context.translate(point.x, point.y);
      context.rotate((cel.angle * Math.PI) / 180);
      context.scale((cel.zoomX / 100) * ((cel.mirror !== reverse) ? -1 : 1), cel.zoomY / 100);
      context.globalAlpha = cel.opacity / 255;
      context.globalCompositeOperation = cel.blendType === 1 ? "lighter" : cel.blendType === 2 ? "multiply" : "source-over";
      context.drawImage(image, column * cellSize, row * cellSize, cellSize, cellSize, -cellSize / 2, -cellSize / 2, cellSize, cellSize);
      context.restore();
    }
  }

  private transformSourceBattlers(
    frame: readonly BattleAnimationCel[],
    attacker: BattleSide,
    explicitOpponent: boolean,
    reverse: boolean,
  ): void {
    const userSide: BattleSide = explicitOpponent ? (attacker === "player" ? "opponent" : "player") : attacker;
    const targetSide: BattleSide = userSide === "player" ? "opponent" : "player";
    for (const cel of frame) {
      if (cel.pattern !== -1 && cel.pattern !== -2) continue;
      const side = cel.pattern === -1 ? userSide : targetSide;
      const reference = transformSourcePoint(cel.pattern === -1 ? 128 : 384, cel.pattern === -1 ? 224 : 96, reverse);
      const point = transformSourcePoint(cel.x, cel.y, reverse);
      const sprite = document.getElementById(`${side}-sprite`);
      if (sprite === null) continue;
      const stageRect = this.#stage.getBoundingClientRect();
      sprite.style.translate = `${((point.x - reference.x) / 512) * stageRect.width}px ${((point.y - reference.y) / 384) * stageRect.height}px`;
      sprite.style.rotate = `${reverse ? -cel.angle : cel.angle}deg`;
      sprite.style.scale = `${(cel.zoomX / 100) * (cel.mirror ? -1 : 1)} ${cel.zoomY / 100}`;
      sprite.style.opacity = String(cel.opacity / 255);
    }
  }

  private resetSourceBattlers(): void {
    for (const side of ["player", "opponent"] as const) {
      const sprite = document.getElementById(`${side}-sprite`);
      if (sprite === null) continue;
      sprite.style.removeProperty("translate");
      sprite.style.removeProperty("rotate");
      sprite.style.removeProperty("scale");
      sprite.style.removeProperty("opacity");
    }
  }

  private playSourceTimings(animation: BattleAnimationRecord, frame: number): void {
    if (this.#assetUrl === null) return;
    for (const timing of animation.timings) {
      if (timing.frame !== frame || timing.type !== 0 || timing.name.length === 0) continue;
      void this.#assetUrl(`Audio/SE/${timing.name}`).then((url) => {
        const audio = new Audio(url);
        audio.volume = Math.min(1, Math.max(0, timing.volume / 100));
        audio.playbackRate = Math.min(4, Math.max(0.25, timing.pitch / 100));
        return audio.play();
      }).catch(() => {
        // Missing or browser-blocked source sounds never block the animation.
      });
    }
  }
}
