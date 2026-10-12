import { describe, expect, it } from "vitest";
import { escapeSourceHtml, sourceQuantitySelectorHtml } from "../src/source-menu-view.js";
import { persistSourceAudioChannel, sourceAudioSettings } from "../src/source-audio-settings.js";

function stored(values: Readonly<Record<string, string>>): Pick<Storage, "getItem"> {
  return { getItem: (key) => values[key] ?? null };
}

describe("source menu view helpers", () => {
  it("escapes text inserted into menu markup", () => {
    expect(escapeSourceHtml(`<b title="x">L'équipe & moi</b>`))
      .toBe("&lt;b title=&quot;x&quot;&gt;L&#39;équipe &amp; moi&lt;/b&gt;");
  });

  it("migrates the global volume and loads each clamped audio channel", () => {
    expect(sourceAudioSettings(stored({}))).toEqual({ music: 80, effects: 80, coopEffects: 80 });
    expect(sourceAudioSettings(stored({ "pokemon-z-battle.options.volume.v1": "35" })))
      .toEqual({ music: 35, effects: 35, coopEffects: 35 });
    expect(sourceAudioSettings(stored({ "pokemon-z-battle.options.volume.v1": "35",
      "pokemon-z-battle.options.music-volume.v1": "140",
      "pokemon-z-battle.options.effects-volume.v1": "-8",
      "pokemon-z-battle.options.coop-effects-volume.v1": "not-a-number" })))
      .toEqual({ music: 100, effects: 0, coopEffects: 35 });
    const values = new Map<string, string>();
    expect(persistSourceAudioChannel({ setItem: (key, value) => values.set(key, value) }, "coopEffects", 42)).toBe(42);
    expect(values.get("pokemon-z-battle.options.coop-effects-volume.v1")).toBe("42");
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
