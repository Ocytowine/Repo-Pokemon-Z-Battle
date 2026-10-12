import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlayerDuelChallenge } from "@pokemon-z-battle/multiplayer-protocol";
import { SourcePlayerDuelView } from "../src/source-player-duel-view.js";

class FakePanel {
  public hidden = true;
  public innerHTML = "";
  public replaceChildren(): void { this.innerHTML = ""; }
  public querySelector<T>(): T | null { return null; }
}

const challenge = { challenger: "player", challenged: "opponent" } as PlayerDuelChallenge;

afterEach(() => vi.unstubAllGlobals());

describe("source player duel view", () => {
  it("shows the real projection failure instead of claiming every Pokemon is fainted", () => {
    const panel = new FakePanel();
    vi.stubGlobal("document", { querySelector: () => panel });
    const view = new SourcePlayerDuelView({ onAccept: vi.fn(), onRefuse: vi.fn() });
    view.render({ challenge, battleActive: false, side: "opponent", players: [], canAccept: false,
      unavailableReason: "Objet tenu non supporté par le moteur.",
      teamDiagnostic: "Feunnec 24/24 PV" });
    expect(panel.innerHTML).toContain("Objet tenu non supporté");
    expect(panel.innerHTML).toContain("Feunnec 24/24 PV");
    expect(panel.innerHTML).not.toContain("au moins un Pokémon");
  });

  it("keeps acceptance enabled when source-only mechanics were safely neutralized", () => {
    const panel = new FakePanel();
    vi.stubGlobal("document", { querySelector: () => panel });
    const view = new SourcePlayerDuelView({ onAccept: vi.fn(), onRefuse: vi.fn() });
    view.render({ challenge, battleActive: false, side: "opponent", players: [], canAccept: true,
      teamNotice: "1 objet tenu a été neutralisé pour ce combat." });
    expect(panel.innerHTML).toContain("1 objet tenu a été neutralisé");
    expect(panel.innerHTML).not.toContain("disabled");
  });
});
