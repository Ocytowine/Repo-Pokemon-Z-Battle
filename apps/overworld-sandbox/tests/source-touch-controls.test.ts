import { describe, expect, it, vi } from "vitest";
import { isSourceAndroidUserAgent, sourceJoystickDirection, SourceTouchControls }
  from "../src/source-touch-controls.js";

describe("source Android touch controls", () => {
  it("activates the dedicated layout only for Android user agents", () => {
    expect(isSourceAndroidUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36")).toBe(true);
    expect(isSourceAndroidUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")).toBe(false);
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
      setPointerCapture: vi.fn(),
    });
    const menu = control();
    const elements = new Map([
      ["#source-touch-joystick", control()], ["#source-touch-joystick-knob", control()],
      ["#source-touch-interact", control()], ["#source-touch-cancel", control()],
      ["#source-touch-menu", menu], ["#source-touch-sprint", control()],
    ]);
    vi.stubGlobal("document", { querySelector: (selector: string) => elements.get(selector) ?? null });
    try {
      const onMenu = vi.fn();
      new SourceTouchControls({ onDirection: vi.fn(), onInteract: vi.fn(), onCancel: vi.fn(),
        onMenu, onSprint: vi.fn() });
      const pointer = (type: string, pointerId: number) =>
        Object.assign(new Event(type, { cancelable: true }), { pointerId });
      menu.dispatchEvent(pointer("pointerdown", 7));
      expect(menu.setPointerCapture).toHaveBeenCalledWith(7);
      expect(onMenu).not.toHaveBeenCalled();
      menu.dispatchEvent(pointer("pointerup", 7));
      expect(onMenu).not.toHaveBeenCalled();
      menu.dispatchEvent(new Event("click"));
      expect(onMenu).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
