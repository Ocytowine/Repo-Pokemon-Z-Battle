import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "@pokemon-z-battle/multiplayer-protocol";
import { SourceBattleJoinView } from "../src/source-battle-join-view.js";

class FakePanel {
  public hidden = true;
  public innerHTML = "";
  public readonly classList = { add: vi.fn(), remove: vi.fn() };

  public querySelector<T>(): T | null { return null; }
  public querySelectorAll<T>(): readonly T[] { return []; }
}

function trainerBattleWithProposal(): NonNullable<RoomSnapshot["battle"]> {
  const battler = (id: string, name: string) => ({ id, name, species: id, level: 8, hp: 24,
    stats: { maxHp: 24, attack: 12, defense: 12, specialAttack: 12, specialDefense: 12, speed: 12 },
    stages: {}, types: ["NORMAL"], majorStatus: null, ability: null, heldItem: null, moves: [] });
  const hostPokemon = battler("host-mon", "Feunnec");
  const guestPokemon = battler("guest-mon", "Marisson");
  return {
    id: "battle-1",
    duel: false,
    sourceContext: { origin: "source-trainer" },
    session: { lifecycle: "join-window" },
    participation: { battleOwnerId: "host", format: "single", camps: {
      player: { trainerIds: ["host"], members: [{ ownerId: "host", battler: hostPokemon }],
        activeMemberId: hostPokemon.id },
      opponent: { trainerIds: [], members: [], activeMemberId: "opponent-mon" },
    } },
    joinProposal: { joinerId: "guest", side: "player",
      members: [{ ownerId: "host", battler: hostPokemon }, { ownerId: "guest", battler: guestPokemon }],
      finalMemberIds: [hostPokemon.id, guestPokemon.id], requiredApprovals: ["host", "guest"],
      approvals: ["guest"] },
    observerIds: [],
  } as unknown as NonNullable<RoomSnapshot["battle"]>;
}

afterEach(() => vi.unstubAllGlobals());

describe("source battle join view", () => {
  it("shows the pending proposal to the owner instead of the continue-without-guest prompt", () => {
    const panel = new FakePanel();
    vi.stubGlobal("document", { querySelector: () => panel });
    const view = new SourceBattleJoinView({ onPropose: vi.fn(), onRespond: vi.fn(),
      onInvite: vi.fn(), onContinue: vi.fn() });

    view.render({ battle: trainerBattleWithProposal(), playerId: "host", team: null, available: true,
      ownerName: "Alice", guestName: "Bob", opponentName: "Jean" });

    expect(panel.hidden).toBe(false);
    expect(panel.innerHTML).toContain("Confirmer la participation");
    expect(panel.innerHTML).toContain("Marisson");
    expect(panel.innerHTML).not.toContain("Continuer sans lui");
  });
});
