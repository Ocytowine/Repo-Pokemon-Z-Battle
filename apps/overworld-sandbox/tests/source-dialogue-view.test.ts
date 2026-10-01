import { describe, expect, it, vi } from "vitest";
import type { SourceDialogueSession } from "../src/source-dialogue-controller.js";
import { SourceDialogueView, sourceDialogueHint } from "../src/source-dialogue-view.js";

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

  it("keeps choice buttons mounted when an unrelated render repeats", () => {
    let markupWrites = 0;
    let markup = "";
    const choices = {
      hidden: false,
      dataset: {} as Record<string, string>,
      replaceChildren: (): void => undefined,
      querySelectorAll: (): readonly HTMLButtonElement[] => [],
    };
    Object.defineProperty(choices, "innerHTML", {
      set: (value: string): void => { markupWrites += 1; markup = value; },
    });
    const passive = { hidden: false, textContent: "" };
    const panel = { hidden: false, querySelector: (selector: string) => selector === ".source-choices" ? choices : passive };
    vi.stubGlobal("document", { querySelector: () => panel });
    try {
      const session = { label: "Starter", lines: [], index: 0, choosing: true, translations: new Map(),
        variables: { playerName: "Ariane" },
        flow: { pendingChoice: { choices: ["Oui, \\PN", "Non"], cancelType: 1 } } } as unknown as SourceDialogueSession;
      const view = new SourceDialogueView(() => undefined);
      view.render(session, true);
      view.render(session, true);
      expect(markupWrites).toBe(1);
      expect(markup).toContain("Oui, Ariane");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
