import type { Direction } from "@pokemon-z-battle/overworld-engine";
import type { SourceContextAction } from "./source-context-action.js";

export interface SourceTouchControlCallbacks {
  readonly onDirection: (direction: Direction | null) => void;
  readonly onInteract: () => void;
  readonly getAction: () => SourceContextAction;
  readonly onCancel: () => void;
  readonly onMenu: () => void;
  readonly getSecondaryAction: () => "menu" | "back" | "unavailable";
  readonly onSprint: (held: boolean) => void;
}

export function isSourceAndroidUserAgent(userAgent: string): boolean {
  return /Android/iu.test(userAgent);
}

/** Local Chrome preview may emulate touch without changing its desktop user agent. */
export function sourceAndroidPresentationMode(userAgent: string, localPreview: boolean,
  touchEmulation: boolean, forcedPreview: boolean): boolean {
  return isSourceAndroidUserAgent(userAgent) || localPreview && (touchEmulation || forcedPreview);
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
  private readonly actionButton: HTMLButtonElement;
  private readonly menuButton: HTMLButtonElement;
  private secondaryAction: "menu" | "back" | "unavailable" = "menu";
  private action: SourceContextAction = { kind: "unavailable", label: "Action", ariaLabel: "Action contextuelle" };
  private actionPointer: number | null = null;
  private actionSprintHeld = false;

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

    const actionButton = document.querySelector<HTMLButtonElement>("#source-touch-interact");
    if (actionButton === null) throw new Error("Bouton d'action contextuelle absent.");
    this.actionButton = actionButton;
    const releaseAction = (event?: PointerEvent): void => {
      if (event !== undefined && this.actionPointer !== event.pointerId) return;
      this.actionPointer = null;
      this.actionButton.classList.remove("active");
      if (this.actionSprintHeld) {
        this.actionSprintHeld = false;
        callbacks.onSprint(false);
      }
    };
    actionButton.addEventListener("pointerdown", (event) => {
      if (!this.enabled || this.actionPointer !== null) return;
      this.setContextAction(callbacks.getAction());
      if (this.action.kind === "unavailable") return;
      event.preventDefault();
      this.actionPointer = event.pointerId;
      actionButton.setPointerCapture(event.pointerId);
      actionButton.classList.add("active");
      if (this.action.kind === "sprint") {
        this.actionSprintHeld = true;
        callbacks.onSprint(true);
      } else callbacks.onInteract();
    });
    actionButton.addEventListener("pointerup", releaseAction);
    actionButton.addEventListener("pointercancel", releaseAction);
    actionButton.addEventListener("lostpointercapture", () => releaseAction());
    const menuButton = document.querySelector<HTMLButtonElement>("#source-touch-menu");
    if (menuButton === null) throw new Error("Bouton Menu tactile absent.");
    this.menuButton = menuButton;
    this.bindPress("#source-touch-menu", () => {
      const secondaryAction = callbacks.getSecondaryAction();
      this.setSecondaryAction(secondaryAction);
      if (secondaryAction === "menu") callbacks.onMenu();
      else if (secondaryAction === "back") callbacks.onCancel();
    }, "click");
  }

  public setSecondaryAction(action: "menu" | "back" | "unavailable"): void {
    if (this.secondaryAction === action) return;
    this.secondaryAction = action;
    this.menuButton.textContent = action === "back" ? "Retour" : "Menu";
    this.menuButton.setAttribute("aria-label", action === "back" ? "Annuler le dialogue"
      : action === "menu" ? "Ouvrir le menu" : "Menu indisponible");
    this.menuButton.disabled = action === "unavailable";
  }

  public setContextAction(action: SourceContextAction): void {
    if (this.action.kind === action.kind && this.action.label === action.label
      && this.action.ariaLabel === action.ariaLabel) return;
    if (this.actionSprintHeld && action.kind !== "sprint") {
      this.actionSprintHeld = false;
      this.callbacks.onSprint(false);
      this.actionButton.classList.remove("active");
    }
    this.action = action;
    this.actionButton.textContent = action.label;
    this.actionButton.setAttribute("aria-label", action.ariaLabel);
    this.actionButton.dataset.mode = action.kind;
    this.actionButton.disabled = action.kind === "unavailable";
  }

  public release(): void {
    this.activePointer = null;
    this.knob.style.transform = "translate(0, 0)";
    this.actionPointer = null;
    this.actionButton.classList.remove("active");
    this.actionSprintHeld = false;
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
