import type { Direction } from "@pokemon-z-battle/overworld-engine";

export interface SourceTouchControlCallbacks {
  readonly onDirection: (direction: Direction | null) => void;
  readonly onInteract: () => void;
  readonly onCancel: () => void;
  readonly onMenu: () => void;
  readonly onSprint: (held: boolean) => void;
}

export function isSourceAndroidUserAgent(userAgent: string): boolean {
  return /Android/iu.test(userAgent);
}

export function sourceJoystickDirection(x: number, y: number, radius: number): Direction | null {
  const threshold = Math.max(12, radius * 0.24);
  if (Math.hypot(x, y) < threshold) return null;
  if (Math.abs(x) >= Math.abs(y)) return x < 0 ? "left" : "right";
  return y < 0 ? "up" : "down";
}

export class SourceTouchControls {
  private activePointer: number | null = null;
  private direction: Direction | null = null;
  private enabled = true;
  private readonly knob: HTMLElement;
  private readonly sprint: HTMLButtonElement;

  public constructor(private readonly callbacks: SourceTouchControlCallbacks) {
    const joystick = document.querySelector<HTMLElement>("#source-touch-joystick");
    const knob = document.querySelector<HTMLElement>("#source-touch-joystick-knob");
    if (joystick === null || knob === null) throw new Error("Commandes tactiles overworld absentes.");
    this.knob = knob;

    const update = (event: PointerEvent): void => {
      const bounds = joystick.getBoundingClientRect();
      const radius = Math.min(bounds.width, bounds.height) / 2;
      const x = event.clientX - (bounds.left + bounds.width / 2);
      const y = event.clientY - (bounds.top + bounds.height / 2);
      const distance = Math.hypot(x, y);
      const scale = distance > radius * 0.58 ? radius * 0.58 / distance : 1;
      knob.style.transform = `translate(${Math.round(x * scale)}px, ${Math.round(y * scale)}px)`;
      this.setDirection(sourceJoystickDirection(x, y, radius));
    };
    const release = (event?: PointerEvent): void => {
      if (event !== undefined && this.activePointer !== event.pointerId) return;
      this.activePointer = null;
      knob.style.transform = "translate(0, 0)";
      this.setDirection(null);
    };
    joystick.addEventListener("pointerdown", (event) => {
      if (!this.enabled) return;
      event.preventDefault();
      this.activePointer = event.pointerId;
      joystick.setPointerCapture(event.pointerId);
      update(event);
    });
    joystick.addEventListener("pointermove", (event) => {
      if (this.enabled && event.pointerId === this.activePointer) update(event);
    });
    joystick.addEventListener("pointerup", release);
    joystick.addEventListener("pointercancel", release);
    joystick.addEventListener("lostpointercapture", () => release());

    this.bindPress("#source-touch-interact", callbacks.onInteract);
    this.bindPress("#source-touch-cancel", callbacks.onCancel);
    this.bindPress("#source-touch-menu", callbacks.onMenu, "click");
    const sprint = document.querySelector<HTMLButtonElement>("#source-touch-sprint");
    if (sprint === null) throw new Error("Bouton tactile Sprint absent.");
    this.sprint = sprint;
    const stopSprint = (): void => {
      sprint.classList.remove("active");
      callbacks.onSprint(false);
    };
    sprint.addEventListener("pointerdown", (event) => {
      if (!this.enabled) return;
      event.preventDefault();
      sprint.setPointerCapture(event.pointerId);
      sprint.classList.add("active");
      callbacks.onSprint(true);
    });
    sprint.addEventListener("pointerup", stopSprint);
    sprint.addEventListener("pointercancel", stopSprint);
    sprint.addEventListener("lostpointercapture", stopSprint);
  }

  public release(): void {
    this.activePointer = null;
    this.knob.style.transform = "translate(0, 0)";
    this.sprint.classList.remove("active");
    this.setDirection(null);
    this.callbacks.onSprint(false);
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.release();
  }

  private setDirection(direction: Direction | null): void {
    if (direction === this.direction) return;
    this.direction = direction;
    this.callbacks.onDirection(direction);
  }

  private bindPress(selector: string, callback: () => void, phase: "down" | "click" = "down"): void {
    const button = document.querySelector<HTMLButtonElement>(selector);
    if (button === null) throw new Error(`Commande tactile absente : ${selector}.`);
    button.addEventListener("pointerdown", (event) => {
      if (!this.enabled) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      if (phase === "down") callback();
    });
    if (phase === "click") button.addEventListener("click", (event) => {
      if (!this.enabled) return;
      event.preventDefault();
      event.stopPropagation();
      callback();
    });
  }
}
