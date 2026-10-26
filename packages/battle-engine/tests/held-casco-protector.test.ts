import { describe, expect, it } from "vitest";
import { createDoubleTeamBattleState, createTeamBattleState, resolveDoubleTeamTurn,
  resolveTeamTurn, type BattleMove, type BattleSide, type BattlerState } from "../src/index.js";

const hit: BattleMove = { id: 1, internalName: "RECOIL", name: "Recul", functionCode: "0FA",
  power: 30, type: "NORMAL", category: "Physical", accuracy: 0, pp: 10,
  priority: 0, effectChance: 0 };
const status: BattleMove = { ...hit, internalName: "STATUS", name: "Statut",
  functionCode: "027", power: 0, category: "Status" };
const rng = { nextInt: () => 0 };

function mon(id: string, side: BattleSide, item: BattlerState["heldItem"] = null,
  move: BattleMove = hit): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"], hp: 300,
    stats: { maxHp: 300, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, majorStatus: null,
    ability: null, heldItem: item, moves: [{ move, pp: 10 }] };
}

describe("Casco Protector source hooks", () => {
  it("applies Take Down's recoil once when no item prevents it", () => {
    const result = resolveTeamTurn(createTeamBattleState({
      player: [mon("player", "player")], opponent: [mon("opponent", "opponent")],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    const dealt = result.events.find((event) => event.type === "damageApplied")?.amount ?? 0;
    const recoil = result.events.filter((event) => event.type === "recoilDamage"
      && event.side === "player");
    expect(recoil).toHaveLength(1);
    expect(recoil[0]).toMatchObject({ amount: Math.round(dealt / 4) });
  });

  it.each(["0FA", "0FB", "0FC", "0FD", "0FE"] as const)(
    "prevents %s recoil while active, including the shared Duo resolver", (code) => {
      const move = { ...hit, functionCode: code };
      const player = mon("player", "player", "CASCOPROTECTOR", move);
      const opponent = mon("opponent", "opponent");
      const single = resolveTeamTurn(createTeamBattleState({ player: [player], opponent: [opponent] }),
        { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
      expect(single.events).toContainEqual(expect.objectContaining({ type: "damageApplied" }));
      expect(single.events).not.toContainEqual(expect.objectContaining({ type: "recoilDamage",
        side: "player", reason: "recoil" }));
      expect(single.state.teams.player.members[0]?.hp).toBe(300);

      const double = resolveDoubleTeamTurn(createDoubleTeamBattleState({
        player: [player], opponent: [opponent],
      }), [
        { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
        { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      ], rng);
      expect(double.state.teams.player.members[0]?.hp).toBe(300);
    });

  it("blocks status moves while active, then permits them under Magic Room or Klutz", () => {
    const player = mon("player", "player", "CASCOPROTECTOR", status);
    const opponent = mon("opponent", "opponent");
    const start = createTeamBattleState({ player: [player], opponent: [opponent] });
    const actions = { player: { kind: "move" as const, moveIndex: 0 },
      opponent: { kind: "wait" as const } };
    const blocked = resolveTeamTurn(start, actions, rng);
    expect(blocked.events).toContainEqual({ type: "actionSkipped", side: "player",
      reason: "item-blocked" });
    expect(blocked.state.teams.player.members[0]?.moves[0]?.pp).toBe(10);
    const magicRoom = resolveTeamTurn({ ...start, effects: { sides: {
      player: { reflectTurns: 0, luckyChantTurns: 0 },
      opponent: { reflectTurns: 0, luckyChantTurns: 0 } },
    waterSportTurns: 0, magicRoomTurns: 2 } }, actions, rng);
    expect(magicRoom.events).toContainEqual(expect.objectContaining({ type: "moveUsed",
      side: "player", move: "STATUS" }));
    const klutz = resolveTeamTurn(createTeamBattleState({
      player: [{ ...player, ability: "KLUTZ" }], opponent: [opponent],
    }), actions, rng);
    expect(klutz.events).toContainEqual(expect.objectContaining({ type: "moveUsed",
      side: "player", move: "STATUS" }));
  });
});
