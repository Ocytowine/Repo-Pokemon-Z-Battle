import { describe, expect, it } from "vitest";
import { parseSourceTruthEventTag, sourceTruthEventInteractive, sourceTruthEventOpacity,
  sourceTruthInRange } from "../src/source-truth-lens.js";

describe("Miroir de la Vérité", () => {
  it("lit les balises source et leurs opacités optionnelles", () => {
    expect(parseSourceTruthEventTag("Mur #EOT HIDE")).toEqual({ mode: "hide", opacity: 0 });
    expect(parseSourceTruthEventTag("Esprit #EOT SHOW 180")).toEqual({ mode: "show", opacity: 180 });
    expect(parseSourceTruthEventTag("PNJ ordinaire")).toBeNull();
  });

  it("reprend la portée euclidienne de trois cases du jeu source", () => {
    expect(sourceTruthInRange({ x: 5, y: 5 }, { x: 8, y: 5 })).toBe(true);
    expect(sourceTruthInRange({ x: 5, y: 5 }, { x: 8, y: 6 })).toBe(false);
  });

  it("masque les obstacles HIDE et révèle les événements SHOW seulement pendant l'effet", () => {
    const hidden = { name: "#EOT HIDE", x: 6, y: 5 };
    const shown = { name: "#EOT SHOW", x: 6, y: 5 };
    expect(sourceTruthEventInteractive(hidden, { x: 5, y: 5 }, false)).toBe(true);
    expect(sourceTruthEventInteractive(hidden, { x: 5, y: 5 }, true)).toBe(false);
    expect(sourceTruthEventInteractive(shown, { x: 5, y: 5 }, false)).toBe(false);
    expect(sourceTruthEventInteractive(shown, { x: 5, y: 5 }, true)).toBe(true);
    expect(sourceTruthEventOpacity(hidden, { x: 5, y: 5 }, true, 255)).toBe(0);
    expect(sourceTruthEventOpacity(shown, { x: 5, y: 5 }, true, 255)).toBe(255);
  });
});
