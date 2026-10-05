import { afterEach, describe, expect, it, vi } from "vitest";
import { SourceOverworldHud } from "../src/source-overworld-hud.js";

afterEach(() => { vi.unstubAllGlobals(); });

describe("source overworld HUD", () => {
  it("shows Coop request feedback directly over the game canvas", () => {
    const notice = { hidden: true, textContent: "", dataset: {} as Record<string, string> };
    vi.stubGlobal("document", {
      querySelector: (selector: string) => selector === "#source-hud-notice" ? notice : null,
    });
    const hud = new SourceOverworldHud(() => undefined);

    hud.render({ avatar: { x: 2, y: 3, direction: "down" }, notice: "Défi envoyé", sequenceStatus: "aucune",
      battleActive: false, parallelAuditNotice: null, sceneAuditNotice: null,
      hudNotice: { text: "Coop · joueur indisponible", kind: "error" } } as never);

    expect(notice).toMatchObject({ hidden: false, textContent: "Coop · joueur indisponible",
      dataset: { kind: "error" } });
  });
});
