import { describe, expect, it, vi } from "vitest";
import { requestSourceAndroidImmersion } from "../src/source-android-immersion.js";

describe("source Android immersion", () => {
  it("requests fullscreen before locking landscape", async () => {
    const calls: string[] = [];
    const result = await requestSourceAndroidImmersion({ fullscreenElement: null }, {
      requestFullscreen: async () => { calls.push("fullscreen"); },
    }, { lock: async (orientation) => { calls.push(orientation); } });
    expect(result).toEqual({ fullscreen: true, orientationLocked: true });
    expect(calls).toEqual(["fullscreen", "landscape"]);
  });

  it("only retries the optional orientation lock when fullscreen is already active", async () => {
    const requestFullscreen = vi.fn(async () => {});
    const lock = vi.fn(async () => {});
    expect(await requestSourceAndroidImmersion({ fullscreenElement: {} as Element },
      { requestFullscreen }, { lock })).toEqual({ fullscreen: true, orientationLocked: true });
    expect(requestFullscreen).not.toHaveBeenCalled();
    expect(lock).toHaveBeenCalledWith("landscape");
  });

  it("keeps gameplay available when the browser rejects both optional APIs", async () => {
    const result = await requestSourceAndroidImmersion({ fullscreenElement: null }, {
      requestFullscreen: async () => { throw new Error("denied"); },
    }, { lock: async () => { throw new Error("denied"); } });
    expect(result).toEqual({ fullscreen: false, orientationLocked: false });
  });
});
