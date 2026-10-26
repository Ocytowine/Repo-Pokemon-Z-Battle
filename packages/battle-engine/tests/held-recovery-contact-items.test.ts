import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleSide, type BattlerState,
  type RandomSource } from "../src/index.js";
import { resolveBattleVolatileEndOfTurn, volatileOf } from "../src/resolve-turn.js";

const rng: RandomSource = { nextInt: () => 0 };
const tackle = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0, flags: "a" };
function mon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 240, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 240, majorStatus: null, ability: null,
    heldItem: null, moves: [{ move: tackle, pp: 10 }], ...overrides };
}

describe("récupération et réactions des objets tenus", () => {
  it("heals one fifth of actual damage with Shell Bell and respects Heal Block", () => {
    const user = mon("user", "player", { hp: 100, heldItem: "SHELLBELL" });
    const run = (battler: BattlerState) => resolveTeamTurn(createTeamBattleState({ player: [battler],
      opponent: [mon("target", "opponent")] }),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    const healed = run(user);
    const damage = healed.events.filter((event) => event.type === "damageApplied")
      .reduce((sum, event) => sum + event.amount, 0);
    expect(healed.events).toContainEqual({ type: "itemActivated", side: "player", item: "SHELLBELL",
      effect: "heal", amount: Math.floor(damage / 5), hp: 100 + Math.floor(damage / 5) });
    expect(run({ ...user, volatile: { ...volatileOf(user), healBlockTurns: 2 } }).events)
      .not.toContainEqual(expect.objectContaining({ type: "itemActivated", item: "SHELLBELL" }));
  });

  it("uses cumulative move damage for Shell Bell across double targets", () => {
    const spread = { ...tackle, targetCode: "04" };
    const user = mon("user", "player", { hp: 100, heldItem: "SHELLBELL",
      moves: [{ move: spread, pp: 10 }] });
    const start = createDoubleTeamBattleState({ player: [user], opponent: [
      mon("first", "opponent"), mon("second", "opponent"),
    ] });
    const turn = resolveDoubleTeamTurn(start, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    const inner = turn.events.flatMap((event) => event.type === "positionedActionResolved" ? event.events : []);
    const damages = inner.filter((event) => event.type === "damageApplied").map((event) => event.amount);
    const heals = inner.filter((event) => event.type === "itemActivated" && event.item === "SHELLBELL")
      .map((event) => event.amount);
    expect(damages).toHaveLength(2);
    expect(heals).toEqual([Math.floor(damages[0]! / 5), Math.floor((damages[0]! + damages[1]!) / 5)]);
  });

  it("transfers Sticky Barb on contact, then damages its new holder at turn end", () => {
    const user = mon("user", "player");
    const target = mon("target", "opponent", { heldItem: "STICKYBARB" });
    const turn = resolveTeamTurn(createTeamBattleState({ player: [user], opponent: [target] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(turn.events).toContainEqual({ type: "heldItemTransferred", source: "opponent",
      target: "player", item: "STICKYBARB", reason: "sticky-barb" });
    expect(turn.state.teams.player.members[0]?.heldItem).toBe("STICKYBARB");
    expect(turn.state.teams.opponent.members[0]?.heldItem).toBeNull();
    expect(turn.events).toContainEqual({ type: "itemActivated", side: "player", item: "STICKYBARB",
      effect: "damage", amount: 30, hp: 210 });
  });

  it("uses the active trapping source's Binding Band in single and double battles", () => {
    const source = mon("source", "player", { heldItem: "BINDINGBAND" });
    const target = mon("target", "opponent");
    const bound = { ...target, volatile: { ...volatileOf(target), bindingMove: "WRAP",
      bindingTurns: 2, bindingSourceId: source.id } };
    const residual = (holder: BattlerState | undefined, magicRoomTurns = 0) =>
      resolveBattleVolatileEndOfTurn(bound, "opponent", { sides: {
        player: { reflectTurns: 0, luckyChantTurns: 0 },
        opponent: { reflectTurns: 0, luckyChantTurns: 0 },
      }, waterSportTurns: 0, magicRoomTurns }, holder)
        .events.find((event) => event.type === "bindingDamage")?.amount;
    expect(residual(source)).toBe(40);
    expect(residual(source, 2)).toBe(30);
    expect(residual(undefined)).toBe(30);
    const double = createDoubleTeamBattleState({ player: [source], opponent: [bound] });
    const turn = resolveDoubleTeamTurn(double, [
      { actor: { side: "player", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
    ], rng);
    expect(turn.events.some((event) => event.type === "positionedActionResolved"
      && event.actor.side === "opponent" && event.events.some((inner) => inner.type === "bindingDamage"
        && inner.amount === 40))).toBe(true);
  });

  it("boosts Aqua Ring, Ingrain, Leech Seed and drain healing with Big Root", () => {
    const user = mon("user", "player", { hp: 100, heldItem: "BIGROOT" });
    for (const effect of ["aquaRing", "ingrain"] as const) {
      const active = { ...user, volatile: { ...volatileOf(user), [effect]: true } };
      const events = resolveBattleVolatileEndOfTurn(active, "player").events;
      expect(events).toContainEqual({ type: "hpRestored", side: "player", source: "move",
        move: effect === "aquaRing" ? "AQUARING" : "INGRAIN", amount: 19, hp: 119 });
    }
    const seeded = mon("target", "opponent", { volatile: {
      ...volatileOf(mon("target", "opponent")), leechSeededBy: "player" } });
    const leech = resolveTeamTurn(createTeamBattleState({ player: [user], opponent: [seeded] }),
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, rng);
    expect(leech.events).toContainEqual({ type: "hpRestored", side: "player", source: "move",
      move: "LEECHSEED", amount: 39, hp: 139 });
    const drain = { ...tackle, internalName: "ABSORB", functionCode: "0DD" as const };
    const drained = resolveTeamTurn(createTeamBattleState({ player: [{ ...user,
      moves: [{ move: drain, pp: 10 }] }], opponent: [mon("target", "opponent")] }),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    const unboosted = resolveTeamTurn(createTeamBattleState({ player: [{ ...user, heldItem: null,
      moves: [{ move: drain, pp: 10 }] }], opponent: [mon("target", "opponent")] }),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    const drainHeal = (events: typeof drained.events) => events.find((event) => event.type === "hpRestored"
      && event.side === "player" && event.move === "ABSORB");
    expect(drainHeal(drained.events)?.amount).toBeGreaterThan(drainHeal(unboosted.events)?.amount ?? 0);
    const ancestral = resolveTeamTurn(createTeamBattleState({ player: [{ ...user,
      heldItem: "RAIZANCESTRAL", moves: [{ move: drain, pp: 10 }] }],
    opponent: [mon("target", "opponent")] }),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(drainHeal(ancestral.events)?.amount).toBe(60);
  });
});
