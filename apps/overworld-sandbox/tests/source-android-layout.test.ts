import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Android landscape layout", () => {
  it("does not subtract horizontal safe areas twice from the 4:3 scene", async () => {
    const css = await readFile(new URL("../src/style.css", import.meta.url), "utf8");

    expect(css).toMatch(/html\.source-android \.world-panel\s*\{[^}]*width:\s*min\(calc\(100vw - 340px\),/s);
    expect(css).not.toMatch(/html\.source-android \.world-panel\s*\{[^}]*100vw - 340px - var\(--source-safe-left\)/s);
  });

  it("places the Pokemon summary above the full-height menu", async () => {
    const css = await readFile(new URL("../src/style.css", import.meta.url), "utf8");

    expect(css).toMatch(/html\.source-android \.source-menu\s*\{[^}]*position:\s*fixed;[^}]*z-index:\s*100;/s);
    expect(css).toMatch(/html\.source-android \.source-pokemon-summary\s*\{[^}]*position:\s*fixed;[^}]*z-index:\s*110;[^}]*inset:\s*var\(--source-safe-top\)/s);
  });
});
