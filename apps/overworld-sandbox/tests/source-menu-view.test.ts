import { describe, expect, it } from "vitest";
import { escapeSourceHtml, sourceMenuVolume, sourceQuantitySelectorHtml } from "../src/source-menu-view.js";

function stored(value: string | null): Pick<Storage, "getItem"> {
  return { getItem: () => value };
}

describe("source menu view helpers", () => {
  it("escapes text inserted into menu markup", () => {
    expect(escapeSourceHtml(`<b title="x">L'équipe & moi</b>`))
      .toBe("&lt;b title=&quot;x&quot;&gt;L&#39;équipe &amp; moi&lt;/b&gt;");
  });

  it("loads and clamps the persisted volume", () => {
    expect(sourceMenuVolume(stored(null))).toBe(80);
    expect(sourceMenuVolume(stored("35"))).toBe(35);
    expect(sourceMenuVolume(stored("-8"))).toBe(0);
    expect(sourceMenuVolume(stored("140"))).toBe(100);
    expect(sourceMenuVolume(stored("not-a-number"))).toBe(80);
  });

  it("renders a touch-friendly quantity selector without a native number input", () => {
    const html = sourceQuantitySelectorHtml("Bonbons", 12, 30);
    expect(html).toContain('data-source-quantity-delta="-10"');
    expect(html).toContain('data-source-quantity-delta="10"');
    expect(html).toContain("Max · 30");
    expect(html).toContain(">12</output>");
    expect(html).not.toContain('type="number"');
  });
});
