export interface SourcePokemonSpriteFrameState {
  readonly frame: number;
  readonly offsetY: number;
}

export interface SourcePokemonSpriteAnimation {
  stop(): void;
}

export interface SourcePokemonSpriteAnimationOptions {
  readonly canvas: HTMLCanvasElement;
  readonly image: HTMLImageElement | string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frameCount: number;
  readonly profile?: "idle" | "battle";
  readonly frameDurationMs?: number;
}

export function sourcePokemonSpriteFrameState(elapsedMs: number, frameCount: number,
  frameDurationMs = 125, profile: "idle" | "battle" = "idle"): SourcePokemonSpriteFrameState {
  const count = Math.max(1, Math.floor(frameCount));
  const duration = Math.max(60, frameDurationMs);
  const framePosition = Math.max(0, elapsedMs) / duration;
  const frame = Math.floor(framePosition) % count;
  const motionCycle = profile === "battle" ? 920 : 1280;
  const motion = (Math.sin(elapsedMs / motionCycle * Math.PI * 2 - Math.PI / 2) + 1) / 2;
  const amplitude = profile === "battle" ? 1.15 : 0.75;
  return { frame, offsetY: motion <= Number.EPSILON ? 0 : -motion * amplitude };
}

export function startSourcePokemonSpriteAnimation(
  options: SourcePokemonSpriteAnimationOptions): SourcePokemonSpriteAnimation {
  const context = options.canvas.getContext("2d");
  if (context === null) return { stop: () => undefined };
  const image = typeof options.image === "string" ? new Image() : options.image;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let stopped = false;
  let animationFrame: number | null = null;

  const begin = (): void => {
    if (stopped) return;
    const frameBuffers = Array.from({ length: Math.max(1, Math.floor(options.frameCount)) }, (_, frame) => {
      const buffer = document.createElement("canvas");
      buffer.width = options.frameWidth;
      buffer.height = options.frameHeight;
      const bufferContext = buffer.getContext("2d");
      if (bufferContext !== null) {
        bufferContext.imageSmoothingEnabled = false;
        bufferContext.drawImage(image, frame * options.frameWidth, 0,
          options.frameWidth, options.frameHeight, 0, 0, options.frameWidth, options.frameHeight);
      }
      return buffer;
    });
    const startedAt = performance.now();
    let displayedFrame = -1;
    options.canvas.style.transformOrigin = "50% 100%";
    options.canvas.style.willChange = "transform";
    const draw = (time: number): void => {
      if (stopped) return;
      const elapsed = reducedMotion ? 0 : time - startedAt;
      const state = sourcePokemonSpriteFrameState(elapsed, options.frameCount,
        options.frameDurationMs, options.profile);
      if (state.frame !== displayedFrame) {
        context.imageSmoothingEnabled = false;
        context.globalCompositeOperation = "copy";
        context.drawImage(frameBuffers[state.frame]!, 0, 0);
        context.globalCompositeOperation = "source-over";
        displayedFrame = state.frame;
      }
      options.canvas.style.transform = `translate3d(0, ${state.offsetY.toFixed(3)}px, 0)`;
      if (!reducedMotion) animationFrame = requestAnimationFrame(draw);
    };
    draw(startedAt);
  };

  if (image.complete && image.naturalWidth > 0) begin();
  else image.addEventListener("load", begin, { once: true });
  if (typeof options.image === "string") image.src = options.image;

  return { stop: () => {
    stopped = true;
    image.removeEventListener("load", begin);
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    options.canvas.style.removeProperty("transform");
    options.canvas.style.removeProperty("transform-origin");
    options.canvas.style.removeProperty("will-change");
  } };
}

export function startSourcePokemonSpriteAnimations(root: ParentNode,
  profile: "idle" | "battle" = "idle"): readonly SourcePokemonSpriteAnimation[] {
  const animations: SourcePokemonSpriteAnimation[] = [];
  root.querySelectorAll<HTMLCanvasElement>("[data-pokemon-sprite-animation]").forEach((canvas) => {
    const source = canvas.dataset.src;
    const frameWidth = Number(canvas.dataset.frameWidth);
    const frameHeight = Number(canvas.dataset.frameHeight);
    const frameCount = Number(canvas.dataset.frameCount);
    if (source === undefined || !Number.isSafeInteger(frameWidth) || frameWidth < 1
      || !Number.isSafeInteger(frameHeight) || frameHeight < 1
      || !Number.isSafeInteger(frameCount) || frameCount < 1) return;
    animations.push(startSourcePokemonSpriteAnimation({ canvas, image: source,
      frameWidth, frameHeight, frameCount, profile }));
  });
  return animations;
}
