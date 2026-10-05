import { describe, expect, it } from "vitest";
import { activateSharedBattleSession, closeSharedBattleSession, createSharedBattleSession,
  createTeamBattleState, settleEscapedSharedBattleSession, settleSharedBattleSession } from "../src/index.js";
import type { BattlerState } from "../src/index.js";

const battler = (id: string): BattlerState => ({ id, species: id, name: id, level: 5, types: ["NORMAL"],
  stats: { maxHp: 20, attack: 10, defense: 10, specialAttack: 10, specialDefense: 10, speed: 10 },
  stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
  hp: 20, majorStatus: null, ability: null, heldItem: null, moves: [],
  appearance: { form: 0, shiny: false, gender: null } });

describe("shared battle session lifecycle", () => {
  it("moves irreversibly from join-window to a stable settlement", () => {
    const opened = createSharedBattleSession({ battleId: "source:2:3:1", origin: "source-wild",
      narrativeOwnerId: "host", allowJoin: true });
    expect(opened).toMatchObject({ lifecycle: "join-window", settlementId: null });
    const active = activateSharedBattleSession(opened);
    const tactical = { ...createTeamBattleState({ player: [battler("ally")], opponent: [battler("wild")] }),
      status: "finished" as const, winner: "player" as const };
    const settling = settleSharedBattleSession(active, tactical);
    expect(settling).toMatchObject({ lifecycle: "settling", settlementId: "source:2:3:1:settlement" });
    expect(settleSharedBattleSession(settling, tactical)).toBe(settling);
    expect(closeSharedBattleSession(settling)).toMatchObject({ lifecycle: "closed",
      settlementId: "source:2:3:1:settlement" });
    expect(() => activateSharedBattleSession(settling)).toThrow("déjà fermée");
  });

  it("refuses settlement before the tactical result exists", () => {
    const active = createSharedBattleSession({ battleId: "duel:1", origin: "player-duel",
      narrativeOwnerId: "host", allowJoin: false });
    expect(active.lifecycle).toBe("active");
    expect(() => settleSharedBattleSession(active,
      createTeamBattleState({ player: [battler("ally")], opponent: [battler("foe")] }))).toThrow("terminé");
    expect(() => closeSharedBattleSession(active)).toThrow("règlement");
  });

  it("settles a wild escape without inventing a tactical winner", () => {
    const active = createSharedBattleSession({ battleId: "wild:1", origin: "source-wild",
      narrativeOwnerId: "local", allowJoin: false });
    const settling = settleEscapedSharedBattleSession(active);
    expect(closeSharedBattleSession(settling)).toMatchObject({ lifecycle: "closed",
      settlementId: "wild:1:settlement" });
    expect(() => settleEscapedSharedBattleSession({ ...active, origin: "source-trainer" })).toThrow("sauvage");
  });
});
