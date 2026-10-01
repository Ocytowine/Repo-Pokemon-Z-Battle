import { describe, expect, it } from "vitest";
import { sourceDialogueHint } from "../src/source-dialogue-view.js";

describe("source dialogue view", () => {
  it("describes progress through ordinary dialogue lines", () => {
    expect(sourceDialogueHint({ choosing: false, index: 0, lines: ["a", "b"] }))
      .toBe("Espace/Entrée · 1/2");
    expect(sourceDialogueHint({ choosing: false, index: 1, lines: ["a", "b"] }))
      .toBe("Espace/Entrée pour continuer");
  });

  it("gives choice input precedence over line progress", () => {
    expect(sourceDialogueHint({ choosing: true, index: 0, lines: [] }))
      .toBe("Choisissez une réponse · Échap pour annuler");
  });
});
