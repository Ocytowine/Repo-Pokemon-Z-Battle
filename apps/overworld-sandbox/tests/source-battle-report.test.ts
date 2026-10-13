import { describe, expect, it } from "vitest";
import { createTeamBattleState, MINIMAL_MOVE_CATALOG, type BattlerState } from "@pokemon-z-battle/battle-engine";
import { SourceBattleReportStore } from "../src/source-battle-report.js";

function battler(id: string): BattlerState {
  const move = MINIMAL_MOVE_CATALOG.TACKLE;
  return { id, species: id.toUpperCase(), name: id, level: 5, types: ["NORMAL"],
    stats: { maxHp: 20, attack: 10, defense: 10, specialAttack: 10, specialDefense: 10, speed: 10 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    hp: 20, majorStatus: null, ability: null, heldItem: null, moves: [{ move, pp: move.pp }] };
}

describe("source battle report", () => {
  it("keeps a complete export after battle end without any personal bag", () => {
    const store = new SourceBattleReportStore();
    const before = createTeamBattleState({ player: [battler("hero")], opponent: [battler("wild")] });
    const after = { ...before, turn: 2 };
    store.start({ battleId: "local-7-1", mode: "solo", viewerSide: "player", state: before });
    store.recordTurn({ battleId: "local-7-1", before, after,
      actions: [{ actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } }],
      events: [{ type: "turnEnded", turn: 1 }],
      trace: [{ type: "damage", side: "player", move: "TACKLE", attack: 10, defense: 10,
        baseDamage: 4, critical: false, variance: 95, stab: 1.5, effectiveness: 1,
        statusModifier: 1, abilityModifier: null, result: 6 }] });
    store.recordSettlement({ battleId: "local-7-1", outcome: { money: 120 },
      moneyBefore: 3_000, moneyAfter: 3_120 });
    store.finish("local-7-1", after, "won");

    expect(store.summary).toMatchObject({ available: true, active: false, turns: 1, endReason: "won" });
    const exported = JSON.parse(store.serialize()!) as Record<string, unknown>;
    expect(exported).toMatchObject({ schemaVersion: 1, battleId: "local-7-1", endReason: "won",
      turns: [{ kind: "turn", trace: [{ type: "damage", result: 6 }] }],
      settlements: [{ moneyBefore: 3000, moneyAfter: 3120 }] });
    expect(JSON.stringify(exported)).not.toContain("inventory");
  });
});
