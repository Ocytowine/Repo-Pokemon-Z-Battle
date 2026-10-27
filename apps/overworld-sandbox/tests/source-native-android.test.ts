import { describe, expect, it, vi } from "vitest";
import { hideSourceAndroidSystemBars } from "../src/source-native-android.js";

describe("source native Android", () => {
  it("hides native system bars", async () => {
    const hide = vi.fn(async () => {});
    await expect(hideSourceAndroidSystemBars({ hide })).resolves.toBe(true);
    expect(hide).toHaveBeenCalledOnce();
  });

  it("keeps the game available when Android rejects immersive mode", async () => {
    await expect(hideSourceAndroidSystemBars({
      hide: async () => { throw new Error("unavailable"); },
    })).resolves.toBe(false);
  });
});
