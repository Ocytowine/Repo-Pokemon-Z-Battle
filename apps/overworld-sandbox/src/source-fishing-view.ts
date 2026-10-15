import type { SourceFishingAttempt } from "./source-wild-encounter.js";

type FishingPhase = "waiting" | "bite" | "result";

export interface SourceFishingViewOptions {
  readonly onHook: (attempt: SourceFishingAttempt) => void;
  readonly onFinish: (message: string) => void;
  readonly onBite?: () => void;
}

const SOURCE_FISHING_FRAME_MS = 50;

/** RPG Maker casts with patternb-pattern (3→0) and retracts with patternb+pattern (0→3). */
export function sourceFishingVisualPattern(elapsedMs: number, retract = false): number {
  const frame = Math.min(3, Math.floor(Math.max(0, elapsedMs) / SOURCE_FISHING_FRAME_MS));
  return retract ? frame : 3 - frame;
}

/** Transient personal presentation. The resulting encounter still enters the shared battle authority. */
export class SourceFishingView {
  private readonly root: HTMLElement;
  private attempt: SourceFishingAttempt | null = null;
  private phase: FishingPhase | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private animationStartedAt = 0;

  public constructor(private readonly options: SourceFishingViewOptions) {
    this.root = document.createElement("div");
    this.root.id = "source-fishing";
    this.root.hidden = true;
    (document.getElementById("world-stage") ?? document.body).append(this.root);
    window.addEventListener("keydown", (event) => {
      if (this.phase !== "bite" || !["Enter", " ", "z", "Z"].includes(event.key)) return;
      event.preventDefault();
      this.hook();
    });
  }

  public get open(): boolean { return this.attempt !== null; }

  public visualPattern(now: number): number {
    if (!this.open) return 0;
    return sourceFishingVisualPattern(now - this.animationStartedAt, this.phase === "result");
  }

  public show(attempt: SourceFishingAttempt): void {
    this.clearTimer();
    this.attempt = attempt;
    this.phase = "waiting";
    this.animationStartedAt = performance.now();
    this.render();
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.attempt === null) return;
      if (!this.attempt.bite || this.attempt.encounter === null) {
        this.finish("Ça ne mord pas…");
        return;
      }
      this.phase = "bite";
      this.options.onBite?.();
      this.render();
      this.timer = setTimeout(() => this.finish("Le Pokémon s’est échappé…"), this.attempt.hookWindowMs);
    }, attempt.waitMs + SOURCE_FISHING_FRAME_MS * 4);
  }

  private hook(): void {
    if (this.attempt === null || this.phase !== "bite") return;
    const attempt = this.attempt;
    this.clearTimer();
    this.phase = "result";
    this.animationStartedAt = performance.now();
    this.render("Un Pokémon a été pêché !");
    this.timer = setTimeout(() => {
      this.close();
      this.options.onHook(attempt);
    }, 450);
  }

  private finish(message: string): void {
    this.clearTimer();
    this.phase = "result";
    this.animationStartedAt = performance.now();
    this.render(message);
    this.timer = setTimeout(() => {
      this.close();
      this.options.onFinish(message);
    }, 900);
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private close(): void {
    this.clearTimer();
    this.attempt = null;
    this.phase = null;
    this.root.hidden = true;
    this.root.innerHTML = "";
  }

  private render(result?: string): void {
    if (this.phase === null) return;
    const body = this.phase === "waiting"
      ? "<strong>…</strong><small>La ligne repose sur l’eau.</small>"
      : this.phase === "bite"
        ? "<strong>Oh ! Ça mord !</strong><small>Remontez vite la ligne.</small><button type=\"button\" data-fishing-hook>Remonter</button>"
        : `<strong>${result ?? "Pêche terminée."}</strong>`;
    this.root.hidden = false;
    this.root.innerHTML = `<section class="source-fishing-prompt" data-phase="${this.phase}">${body}</section>`;
    this.root.querySelector<HTMLButtonElement>("[data-fishing-hook]")?.addEventListener("click", () => this.hook());
  }
}
