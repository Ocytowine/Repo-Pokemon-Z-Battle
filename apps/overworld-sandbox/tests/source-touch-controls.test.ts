import { describe, expect, it } from "vitest";
import { isSourceAndroidUserAgent, sourceJoystickDirection } from "../src/source-touch-controls.js";

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
});
