import { describe, expect, it, vi } from "vitest";
import { isSourceAndroidUserAgent, sourceAndroidPresentationMode, sourceJoystickDirection, SourceTouchControls }
  from "../src/source-touch-controls.js";
import type { SourceContextAction } from "../src/source-context-action.js";

describe("source Android touch controls", () => {
  it("activates the dedicated layout only for Android user agents", () => {
    expect(isSourceAndroidUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36")).toBe(true);
    expect(isSourceAndroidUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")).toBe(false);
  });

  it("enables Android presentation for local Chrome touch emulation or an explicit preview override", () => {
    const desktop = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
    expect(sourceAndroidPresentationMode(desktop, false, true, true)).toBe(false);
    expect(sourceAndroidPresentationMode(desktop, true, false, false)).toBe(false);
    expect(sourceAndroidPresentationMode(desktop, true, true, false)).toBe(true);
    expect(sourceAndroidPresentationMode(desktop, true, false, true)).toBe(true);
  });

  it("keeps the fixed joystick cardinal with a central dead zone", () => {
    expect(sourceJoystickDirection(0, 0, 60)).toBeNull();
    expect(sourceJoystickDirection(13, 0, 60)).toBeNull();
    expect(sourceJoystickDirection(40, 12, 60)).toBe("right");
    expect(sourceJoystickDirection(-40, 12, 60)).toBe("left");
    expect(sourceJoystickDirection(8, -40, 60)).toBe("up");
    expect(sourceJoystickDirection(8, 40, 60)).toBe("down");
  });

  it("uses a stable horizontal tie-breaker instead of producing diagonals", () => {
    expect(sourceJoystickDirection(30, 30, 60)).toBe("right");
    expect(sourceJoystickDirection(-30, -30, 60)).toBe("left");
  });

  it("opens the menu on the final click, after the opening touch is released", () => {
    const control = () => Object.assign(new EventTarget(), {
      style: { transform: "" }, classList: { add: vi.fn(), remove: vi.fn() },
      dataset: {}, disabled: false, textContent: "", setAttribute: vi.fn(), setPointerCapture: vi.fn(),
    });
    const menu = control();
    const elements = new Map([
      ["#source-touch-joystick", control()], ["#source-touch-joystick-knob", control()],
      ["#source-touch-interact", control()],
      ["#source-touch-menu", menu],
    ]);
    vi.stubGlobal("document", { querySelector: (selector: string) => elements.get(selector) ?? null });
    try {
      const onMenu = vi.fn();
      const onCancel = vi.fn();
      new SourceTouchControls({ onDirection: vi.fn(), onInteract: vi.fn(), onCancel,
        onMenu, onSprint: vi.fn(), getSecondaryAction: () => "menu",
        getAction: () => ({ kind: "interact", label: "Parler", ariaLabel: "Parler" }) });
      const pointer = (type: string, pointerId: number) =>
        Object.assign(new Event(type, { cancelable: true }), { pointerId });
      menu.dispatchEvent(pointer("pointerdown", 7));
      expect(menu.setPointerCapture).toHaveBeenCalledWith(7);
      expect(onMenu).not.toHaveBeenCalled();
      menu.dispatchEvent(pointer("pointerup", 7));
      expect(onMenu).not.toHaveBeenCalled();
      menu.dispatchEvent(new Event("click"));
      expect(onMenu).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
      expect(elements.has("#source-touch-cancel")).toBe(false);
      menu.dispatchEvent(pointer("pointerdown", 8));
      menu.dispatchEvent(pointer("pointerup", 8));
      menu.dispatchEvent(new Event("click"));
      expect(onMenu).toHaveBeenCalledTimes(2);
      expect(onCancel).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses the large Menu button as Retour only for a cancellable dialogue", () => {
    const control = () => Object.assign(new EventTarget(), {
      style: { transform: "" }, classList: { add: vi.fn(), remove: vi.fn() },
      dataset: {}, disabled: false, textContent: "", setAttribute: vi.fn(), setPointerCapture: vi.fn(),
    });
    const menu = control();
    const elements = new Map([
      ["#source-touch-joystick", control()], ["#source-touch-joystick-knob", control()],
      ["#source-touch-interact", control()], ["#source-touch-menu", menu],
    ]);
    vi.stubGlobal("document", { querySelector: (selector: string) => elements.get(selector) ?? null });
    try {
      const onMenu = vi.fn();
      const onCancel = vi.fn();
      let secondaryAction: "menu" | "back" | "unavailable" = "back";
      const controls = new SourceTouchControls({ onDirection: vi.fn(), onInteract: vi.fn(), onCancel,
        onMenu, onSprint: vi.fn(), getSecondaryAction: () => secondaryAction,
        getAction: () => ({ kind: "interact", label: "Suite", ariaLabel: "Suite" }) });
      controls.setSecondaryAction(secondaryAction);
      expect(menu.textContent).toBe("Retour");
      menu.dispatchEvent(new Event("click"));
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onMenu).not.toHaveBeenCalled();
      secondaryAction = "unavailable";
      controls.setSecondaryAction(secondaryAction);
      expect(menu.disabled).toBe(true);
      menu.dispatchEvent(new Event("click"));
      expect(onCancel).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("holds sprint on an empty tile and uses the same button for an interaction target", () => {
    const control = () => Object.assign(new EventTarget(), {
      style: { transform: "" }, classList: { add: vi.fn(), remove: vi.fn() },
      dataset: {}, disabled: false, textContent: "", setAttribute: vi.fn(), setPointerCapture: vi.fn(),
    });
    const actionButton = control();
    const elements = new Map([
      ["#source-touch-joystick", control()], ["#source-touch-joystick-knob", control()],
      ["#source-touch-interact", actionButton],
      ["#source-touch-menu", control()],
    ]);
    vi.stubGlobal("document", { querySelector: (selector: string) => elements.get(selector) ?? null });
    try {
      const onInteract = vi.fn();
      const onSprint = vi.fn();
      let action: SourceContextAction = { kind: "sprint", label: "Sprint", ariaLabel: "Maintenir pour sprinter" };
      const controls = new SourceTouchControls({ onDirection: vi.fn(), onInteract, onCancel: vi.fn(),
        onMenu: vi.fn(), onSprint, getSecondaryAction: () => "menu", getAction: () => action });
      const pointer = (type: string) => Object.assign(new Event(type, { cancelable: true }), { pointerId: 7 });
      controls.setContextAction(action);
      actionButton.dispatchEvent(pointer("pointerdown"));
      expect(onSprint).toHaveBeenCalledWith(true);
      expect(onInteract).not.toHaveBeenCalled();
      controls.setContextAction({ ...action });
      expect(onSprint).not.toHaveBeenCalledWith(false);
      actionButton.dispatchEvent(pointer("pointerup"));
      expect(onSprint).toHaveBeenLastCalledWith(false);
      action = { kind: "interact", label: "Parler", ariaLabel: "Parler" };
      controls.setContextAction(action);
      actionButton.dispatchEvent(pointer("pointerdown"));
      expect(onInteract).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
