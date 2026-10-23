import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide,
  type BattlerState, type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: (max) => max - 1 };
const move = (code: BattleMove["functionCode"], overrides: Partial<BattleMove> = {}): BattleMove => ({
  ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: code, functionCode: code,
  power: 60, accuracy: 0, effectChance: 0, flags: "be", ...overrides,
});
function pokemon(id: string, side: BattleSide, code: BattleMove["functionCode"] = "000",
  overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 400, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: side === "player" ? 100 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 400, majorStatus: null,
    ability: null, heldItem: null, moves: [{ move: move(code), pp: 10 }], ...overrides };
}
const use = { player: { kind: "move" as const, moveIndex: 0 },
  opponent: { kind: "move" as const, moveIndex: 0 } };
const field = (terrain: "electric" | "grassy" | "misty") => ({
  sides: { player: { reflectTurns: 0, luckyChantTurns: 0 },
    opponent: { reflectTurns: 0, luckyChantTurns: 0 } },
  waterSportTurns: 0, terrain, terrainTurns: 3,
});

describe("terrain, targeting and team guards", () => {
  it.each(["075", "076", "078"] as const)("%s reaches its corresponding charge state with double power", (code) => {
    const charge = code === "075" ? "0CB" : code === "076" ? "0CA" : "0C9";
    const attacker = pokemon("attacker", "opponent", code);
    const charged = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("target", "player", charge)], opponent: [attacker],
    }), use, rng);
    const ordinary = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("target", "player")], opponent: [attacker],
    }), { player: { kind: "wait" }, opponent: use.opponent }, rng);
    expect(400 - charged.state.teams.player.members[0]!.hp)
      .toBeGreaterThan(400 - ordinary.state.teams.player.members[0]!.hp);
  });

  it("halves Earthquake on Grassy Terrain", () => {
    const base = createTeamBattleState({ player: [pokemon("user", "player", "076")],
      opponent: [pokemon("target", "opponent")] });
    const plain = resolveTeamTurn(base, { ...use, opponent: { kind: "wait" } }, rng);
    const grassy = resolveTeamTurn({ ...base, effects: field("grassy") },
      { ...use, opponent: { kind: "wait" } }, rng);
    expect(grassy.state.teams.opponent.members[0]!.hp).toBeGreaterThan(plain.state.teams.opponent.members[0]!.hp);
  });

  it("Secret Power applies its terrain-dependent effect", () => {
    const secret = pokemon("user", "player", "0A4", { moves: [{ move: move("0A4",
      { effectChance: 100 }), pp: 10 }] });
    const base = createTeamBattleState({ player: [secret], opponent: [pokemon("target", "opponent")] });
    const electric = resolveTeamTurn({ ...base, effects: field("electric") },
      { ...use, opponent: { kind: "wait" } }, rng);
    expect(electric.state.teams.opponent.members[0]?.majorStatus?.kind).toBe("paralysis");
    const misty = resolveTeamTurn({ ...base, effects: field("misty") },
      { ...use, opponent: { kind: "wait" } }, rng);
    expect(misty.state.teams.opponent.members[0]?.stages.specialAttack).toBe(-1);
  });

  it("Lock-On guarantees only the next round's attack and survives a snapshot", () => {
    const user = pokemon("user", "player", "0A6", { moves: [
      { move: move("0A6", { category: "Status", power: 0 }), pp: 10 },
      { move: move("000", { accuracy: 1 }), pp: 10 },
    ] });
    const first = resolveTeamTurn(createTeamBattleState({ player: [user],
      opponent: [pokemon("target", "opponent")] }),
    { ...use, opponent: { kind: "wait" } }, rng);
    const restored = JSON.parse(JSON.stringify(first.state)) as typeof first.state;
    const second = resolveTeamTurn(restored, { player: { kind: "move", moveIndex: 1 },
      opponent: { kind: "wait" } }, rng);
    expect(second.state.teams.opponent.members[0]!.hp).toBeLessThan(400);
    expect(second.state.teams.opponent.members[0]?.volatile?.lockOnTurns).toBe(0);
  });

  it("Miracle Eye exposes Dark to Psychic without applying Foresight's Ghost rule", () => {
    const user = pokemon("user", "player", "0A8", { moves: [
      { move: move("0A8", { category: "Status", power: 0 }), pp: 10 },
      { move: move("000", { type: "PSYCHIC", category: "Special" }), pp: 10 },
    ] });
    const first = resolveTeamTurn(createTeamBattleState({ player: [user],
      opponent: [pokemon("dark", "opponent", "000", { types: ["DARK"] })] }),
    { ...use, opponent: { kind: "wait" } }, rng);
    const second = resolveTeamTurn(first.state, { player: { kind: "move", moveIndex: 1 },
      opponent: { kind: "wait" } }, rng);
    expect(second.state.teams.opponent.members[0]!.hp).toBeLessThan(400);
  });

  it("Sacred Sword ignores positive Defense and evasion stages", () => {
    const boosted = pokemon("target", "opponent", "000", { stages: {
      attack: 0, defense: 6, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 6,
    } });
    const attacker = pokemon("user", "player", "0A9", { moves: [{ move: move("0A9",
      { accuracy: 100 }), pp: 10 }] });
    const againstBoost = resolveTeamTurn(createTeamBattleState({ player: [attacker], opponent: [boosted] }),
      { ...use, opponent: { kind: "wait" } }, rng);
    const againstNeutral = resolveTeamTurn(createTeamBattleState({ player: [attacker],
      opponent: [pokemon("target", "opponent")] }),
    { ...use, opponent: { kind: "wait" } }, rng);
    expect(againstBoost.state.teams.opponent.members[0]!.hp)
      .toBe(againstNeutral.state.teams.opponent.members[0]!.hp);
  });

  it("Quick Guard blocks priority and Wide Guard blocks spread attacks, then expires", () => {
    for (const [guardCode, attackCode, attackOptions] of [
      ["0AB", "000", { priority: 1 }],
      ["0AC", "000", { targetCode: "04" }],
    ] as const) {
      const guard = pokemon("guard", "player", guardCode, { moves: [{ move: move(guardCode,
        { category: "Status", power: 0, priority: 3, targetCode: "10" }), pp: 10 }] });
      const attack = pokemon("attacker", "opponent", attackCode, { moves: [{ move: move(attackCode,
        attackOptions), pp: 10 }] });
      const first = resolveTeamTurn(createTeamBattleState({ player: [guard], opponent: [attack] }), use, rng);
      expect(first.state.teams.player.members[0]!.hp).toBe(400);
      const second = resolveTeamTurn(first.state, { player: { kind: "wait" },
        opponent: use.opponent }, rng);
      expect(second.state.teams.player.members[0]!.hp).toBeLessThan(400);
    }
  });

  it("a guard protects the ally in double battles after room-style restoration", () => {
    const guard = pokemon("guard", "player", "0AB", { moves: [{ move: move("0AB",
      { category: "Status", power: 0, priority: 3, targetCode: "10" }), pp: 10 }] });
    const attacker = pokemon("attacker", "opponent", "000", { moves: [{ move: move("000",
      { priority: 1 }), pp: 10 }] });
    const state = createDoubleTeamBattleState({ player: [guard, pokemon("ally", "player")],
      opponent: [attacker, pokemon("spare", "opponent")] });
    const actions = [
      { actor: { side: "player" as const, slot: 0 }, action: { kind: "move" as const, moveIndex: 0 } },
      { actor: { side: "player" as const, slot: 1 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 0 }, action: { kind: "move" as const, moveIndex: 0,
        target: { side: "player" as const, slot: 1 } } },
      { actor: { side: "opponent" as const, slot: 1 }, action: { kind: "wait" as const } },
    ];
    const first = resolveDoubleTeamTurn(state, actions, rng);
    expect(first.state.teams.player.members[1]!.hp).toBe(400);
    const restored = JSON.parse(JSON.stringify(first.state)) as typeof first.state;
    const second = resolveDoubleTeamTurn(restored, actions.map((entry) => entry.actor.side === "player"
      ? { ...entry, action: { kind: "wait" as const } } : entry), rng);
    expect(second.state.teams.player.members[1]!.hp).toBeLessThan(400);
  });

  it("Mirror Move copies the target's last eligible move without spending its PP", () => {
    const mirror = pokemon("mirror", "player", "0AE", { moves: [{ move: move("0AE",
      { category: "Status", power: 0 }), pp: 10 }] });
    const target = pokemon("target", "opponent");
    const first = resolveTeamTurn(createTeamBattleState({ player: [mirror], opponent: [target] }),
      { player: { kind: "wait" }, opponent: use.opponent }, rng);
    const restored = JSON.parse(JSON.stringify(first.state)) as typeof first.state;
    const second = resolveTeamTurn(restored, { player: use.player, opponent: { kind: "wait" } }, rng);
    expect(second.state.teams.opponent.members[0]!.hp).toBeLessThan(400);
    expect(second.state.teams.player.members[0]!.moves[0]!.pp).toBe(9);
    expect(second.events).toContainEqual({ type: "moveUsed", side: "player", move: "000" });
    const uncopiable = pokemon("uncopiable", "opponent", "000", { moves: [{ move: move("000",
      { flags: "b" }), pp: 10 }] });
    const failedFirst = resolveTeamTurn(createTeamBattleState({ player: [mirror], opponent: [uncopiable] }),
      { player: { kind: "wait" }, opponent: use.opponent }, rng);
    const failed = resolveTeamTurn(failedFirst.state, { player: use.player,
      opponent: { kind: "wait" } }, rng);
    expect(failed.state.teams.opponent.members[0]!.hp).toBe(400);
    expect(failed.events).toContainEqual({ type: "moveFailed", side: "player", move: "0AE", reason: "condition" });
  });

  it("Mirror Move expands a copied spread move to both double-battle opponents", () => {
    const mirror = pokemon("mirror", "player", "0AE", { moves: [{ move: move("0AE",
      { category: "Status", power: 0 }), pp: 10 }] });
    const spread = pokemon("spread", "opponent", "000", { moves: [{ move: move("000",
      { targetCode: "04" }), pp: 10 }] });
    const state = createDoubleTeamBattleState({ player: [mirror, pokemon("ally", "player")],
      opponent: [spread, pokemon("other", "opponent")] });
    const actions = [
      { actor: { side: "player" as const, slot: 0 }, action: { kind: "wait" as const } },
      { actor: { side: "player" as const, slot: 1 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 0 }, action: { kind: "move" as const, moveIndex: 0 } },
      { actor: { side: "opponent" as const, slot: 1 }, action: { kind: "wait" as const } },
    ];
    const first = resolveDoubleTeamTurn(state, actions, rng);
    const restored = JSON.parse(JSON.stringify(first.state)) as typeof first.state;
    const second = resolveDoubleTeamTurn(restored, actions.map((entry) => entry.actor.side === "player"
      && entry.actor.slot === 0
      ? { ...entry, action: { kind: "move" as const, moveIndex: 0,
        target: { side: "opponent" as const, slot: 0 } } }
      : { ...entry, action: { kind: "wait" as const } }), rng);
    expect(second.state.teams.opponent.members[0]!.hp).toBeLessThan(400);
    expect(second.state.teams.opponent.members[1]!.hp).toBeLessThan(400);
    expect(second.state.teams.player.members[0]!.moves[0]!.pp).toBe(9);
  });

  it("Mirror Move retains a copied two-turn attack across a snapshot", () => {
    const mirror = pokemon("mirror", "player", "0AE", { moves: [{ move: move("0AE",
      { category: "Status", power: 0 }), pp: 10 }] });
    const flyer = pokemon("flyer", "opponent", "0C9");
    const first = resolveTeamTurn(createTeamBattleState({ player: [mirror], opponent: [flyer] }),
      { player: { kind: "wait" }, opponent: use.opponent }, rng);
    const second = resolveTeamTurn(first.state, { player: { kind: "wait" },
      opponent: use.opponent }, rng);
    const copied = resolveTeamTurn(second.state, { player: use.player,
      opponent: { kind: "wait" } }, rng);
    expect(copied.state.teams.player.members[0]?.volatile?.chargingMove).toBe("0AE");
    expect(copied.state.teams.player.members[0]?.volatile?.chargingCalledMove?.functionCode).toBe("0C9");
    const restored = JSON.parse(JSON.stringify(copied.state)) as typeof copied.state;
    const landed = resolveTeamTurn(restored, { player: { kind: "wait" },
      opponent: { kind: "wait" } }, rng);
    expect(landed.state.teams.opponent.members[0]!.hp).toBeLessThan(400);
    expect(landed.state.teams.player.members[0]!.moves[0]!.pp).toBe(9);
  });
});
