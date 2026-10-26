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
  it("restores every lowered stat with White Herb and cures mental effects with Mental Herb", () => {
    const run = (user: BattlerState, foe: BattlerState = mon("foe", "opponent")) =>
      resolveTeamTurn(createTeamBattleState({ player: [user], opponent: [foe] }),
        { player: { kind: "wait" }, opponent: { kind: "wait" } }, rng);
    const white = mon("white", "player", { heldItem: "WHITEHERB",
      stages: { ...mon("white", "player").stages, attack: -2, speed: -1 } });
    const restored = run(white, mon("foe", "opponent", { ability: "UNNERVE" }));
    expect(restored.state.teams.player.members[0]).toMatchObject({ heldItem: null,
      stages: { attack: 0, speed: 0 } });
    expect(restored.events).toContainEqual(expect.objectContaining({ type: "heldItemConsumed",
      item: "WHITEHERB" }));
    const mental = mon("mental", "player", { heldItem: "MENTALHERB", volatile: {
      ...volatileOf(mon("mental", "player")), infatuated: true, infatuatedBy: "foe",
      tauntTurns: 2, encoreMove: "TACKLE", encoreTurns: 2, tormented: true,
      disabledMove: "TACKLE", disableTurns: 2, healBlockTurns: 2 } });
    const cured = run(mental);
    expect(cured.state.teams.player.members[0]).toMatchObject({ heldItem: null,
      volatile: { infatuated: false, infatuatedBy: null, tauntTurns: 0,
        encoreTurns: 0, tormented: false, disableTurns: 0, healBlockTurns: 0 } });
    expect(cured.events.filter((event) => event.type === "volatileEnded")
      .map((event) => event.effect)).toEqual(expect.arrayContaining([
        "infatuation", "taunt", "encore", "torment", "disable", "heal-block",
      ]));
    expect(cured.events).toContainEqual(expect.objectContaining({ type: "heldItemConsumed",
      item: "MENTALHERB" }));
    const suppressed = run({ ...white, ability: "KLUTZ" });
    expect(suppressed.state.teams.player.members[0]).toMatchObject({ heldItem: "WHITEHERB",
      stages: { attack: -2, speed: -1 } });
  });

  it("uses held Berry Juice at half HP even under Unnerve", () => {
    const user = mon("user", "player", { hp: 100, heldItem: "BERRYJUICE" });
    const state = createTeamBattleState({ player: [user],
      opponent: [mon("foe", "opponent", { ability: "UNNERVE" })] });
    const turn = resolveTeamTurn(state,
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, rng);
    expect(turn.state.teams.player.members[0]).toMatchObject({ hp: 120, heldItem: null });
    expect(turn.events).toContainEqual({ type: "itemActivated", side: "player",
      item: "BERRYJUICE", effect: "heal", amount: 20, hp: 120 });
    expect(turn.events).toContainEqual({ type: "heldItemConsumed", side: "player",
      item: "BERRYJUICE", effect: "heal", hp: 120 });
  });

  it("blocks Leftovers and Poison-type Black Sludge healing under Heal Block without turning Sludge into damage", () => {
    const play = (user: BattlerState) => resolveTeamTurn(createTeamBattleState({
      player: [user], opponent: [mon("foe", "opponent")] }),
    { player: { kind: "wait" }, opponent: { kind: "wait" } }, rng);
    for (const item of ["LEFTOVERS", "BLACKSLUDGE"] as const) {
      const user = mon("user", "player", { hp: 100, heldItem: item,
        types: item === "BLACKSLUDGE" ? ["POISON"] : ["NORMAL"] });
      expect(play(user).state.teams.player.members[0]!.hp).toBe(115);
      const blocked = play({ ...user, volatile: { ...volatileOf(user), healBlockTurns: 2 } });
      expect(blocked.state.teams.player.members[0]!.hp).toBe(100);
      expect(blocked.events).not.toContainEqual(expect.objectContaining({
        type: "itemActivated", item }));
    }
    const harmed = play(mon("user", "player", { hp: 100, heldItem: "BLACKSLUDGE",
      volatile: { ...volatileOf(mon("user", "player")), healBlockTurns: 2 } }));
    expect(harmed.state.teams.player.members[0]!.hp).toBe(70);
  });

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
    const secondary = { ...tackle, effectChance: 30 };
    const sheerForce = run({ ...user, ability: "SHEERFORCE",
      moves: [{ move: secondary, pp: 10 }] });
    expect(sheerForce.events).not.toContainEqual(expect.objectContaining({
      type: "itemActivated", item: "SHELLBELL" }));
  });

  it("heals once from cumulative move damage across double targets", () => {
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
    const inner = turn.events.flatMap((event) => event.type === "positionedActionResolved" ? event.events : [event]);
    const damages = inner.filter((event) => event.type === "damageApplied").map((event) => event.amount);
    const heals = inner.filter((event) => event.type === "itemActivated" && event.item === "SHELLBELL")
      .map((event) => event.amount);
    expect(damages).toHaveLength(2);
    expect(heals).toEqual([Math.floor((damages[0]! + damages[1]!) / 5)]);
    expect(turn.state.teams.player.members[0]!.hp).toBe(100 + heals[0]!);
  });

  it("still applies after-hit items when the last spread target is immune", () => {
    const spread = { ...tackle, targetCode: "04" };
    const actions = [
      { actor: { side: "player" as const, slot: 0 }, action: { kind: "move" as const, moveIndex: 0 } },
      { actor: { side: "opponent" as const, slot: 0 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 1 }, action: { kind: "wait" as const } },
    ];
    for (const item of ["SHELLBELL", "LIFEORB"] as const) {
      const user = mon("user", "player", { hp: 100, heldItem: item,
        moves: [{ move: spread, pp: 10 }] });
      const turn = resolveDoubleTeamTurn(createDoubleTeamBattleState({ player: [user],
        opponent: [mon("first", "opponent"), mon("ghost", "opponent", { types: ["GHOST"] })] }),
      actions, rng);
      const inner = turn.events.flatMap((event) => event.type === "positionedActionResolved" ? event.events : [event]);
      const damage = inner.filter((event) => event.type === "damageApplied")
        .reduce((sum, event) => sum + event.amount, 0);
      expect(damage).toBeGreaterThan(0);
      expect(inner.filter((event) => event.type === "itemActivated" && event.item === item))
        .toHaveLength(1);
      expect(turn.state.teams.player.members[0]!.hp).toBe(item === "SHELLBELL"
        ? 100 + Math.floor(damage / 5) : 76);
    }
  });

  it("heals once after every hit of a multi-hit move", () => {
    const multi = { ...tackle, internalName: "MULTI", functionCode: "0C0" as const };
    const user = mon("user", "player", { hp: 100, heldItem: "SHELLBELL",
      moves: [{ move: multi, pp: 10 }] });
    const turn = resolveTeamTurn(createTeamBattleState({ player: [user],
      opponent: [mon("foe", "opponent")] }),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    const damage = turn.events.filter((event) => event.type === "damageApplied")
      .reduce((sum, event) => sum + event.amount, 0);
    expect(turn.events.filter((event) => event.type === "damageApplied").length).toBeGreaterThan(1);
    expect(turn.events.filter((event) => event.type === "itemActivated" && event.item === "SHELLBELL"))
      .toEqual([{ type: "itemActivated", side: "player", item: "SHELLBELL",
        effect: "heal", amount: Math.floor(damage / 5), hp: 100 + Math.floor(damage / 5) }]);
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
    const substitute = mon("target", "opponent", { heldItem: "STICKYBARB",
      volatile: { ...volatileOf(target), substituteHp: 100 } });
    const blocked = resolveTeamTurn(createTeamBattleState({ player: [user], opponent: [substitute] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(blocked.state.teams.player.members[0]!.heldItem).toBeNull();
    expect(blocked.state.teams.opponent.members[0]!.heldItem).toBe("STICKYBARB");
  });

  it("applies Rocky Helmet after each landed contact hit", () => {
    const multi = { ...tackle, internalName: "CONTACTMULTI", functionCode: "0C0" as const };
    const user = mon("user", "player", { moves: [{ move: multi, pp: 10 }] });
    const target = mon("target", "opponent", { heldItem: "ROCKYHELMET" });
    const play = (attacker: BattlerState) => resolveTeamTurn(createTeamBattleState({
      player: [attacker], opponent: [target] }),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    const normal = play(user);
    expect(normal.events.filter((event) => event.type === "itemActivated"
      && event.item === "ROCKYHELMET")).toHaveLength(2);
    expect(normal.state.teams.player.members[0]!.hp).toBe(160);
    expect(play({ ...user, ability: "MAGICGUARD" }).state.teams.player.members[0]!.hp).toBe(240);
  });

  it("keeps Life Orb's damage boost while Magic Guard or Sheer Force prevents recoil", () => {
    const attack = { ...MINIMAL_MOVE_CATALOG.ICEBEAM, accuracy: 0, effectChance: 30 };
    const user = mon("user", "player", { hp: 200, heldItem: "LIFEORB",
      moves: [{ move: attack, pp: 10 }] });
    const play = (attacker: BattlerState) => resolveTeamTurn(createTeamBattleState({
      player: [attacker], opponent: [mon("foe", "opponent")] }),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    const base = play({ ...user, heldItem: null });
    const orb = play(user);
    expect(orb.state.teams.opponent.members[0]!.hp).toBeLessThan(base.state.teams.opponent.members[0]!.hp);
    expect(orb.state.teams.player.members[0]!.hp).toBe(176);
    for (const ability of ["MAGICGUARD", "SHEERFORCE"] as const) {
      const protectedTurn = play({ ...user, ability });
      expect(protectedTurn.state.teams.player.members[0]!.hp).toBe(200);
      expect(protectedTurn.state.teams.opponent.members[0]!.hp)
        .toBeLessThan(base.state.teams.opponent.members[0]!.hp);
    }
    const klutz = play({ ...user, ability: "KLUTZ" });
    expect(klutz.state.teams.player.members[0]!.hp).toBe(200);
    expect(klutz.state.teams.opponent.members[0]!.hp).toBe(base.state.teams.opponent.members[0]!.hp);
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
    for (const type of ["WATER", "STEEL"] as const) {
      const salted = { ...bound, types: [type], volatile: { ...bound.volatile,
        bindingMove: "SALAZON" } };
      const withBand = resolveBattleVolatileEndOfTurn(salted, "opponent", undefined, source);
      const withoutBand = resolveBattleVolatileEndOfTurn(salted, "opponent", undefined,
        { ...source, heldItem: null });
      expect(withBand.events).toContainEqual(expect.objectContaining({
        type: "bindingDamage", move: "SALAZON", amount: 60 }));
      expect(withoutBand.events).toContainEqual(expect.objectContaining({
        type: "bindingDamage", move: "SALAZON", amount: 60 }));
    }
    const saltedNormal = { ...bound, volatile: { ...bound.volatile, bindingMove: "SALAZON" } };
    expect(resolveBattleVolatileEndOfTurn(saltedNormal, "opponent", undefined, source).events)
      .toContainEqual(expect.objectContaining({ type: "bindingDamage", amount: 40 }));
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
    const kiss = { ...drain, internalName: "DRAININGKISS", functionCode: "14F" as const };
    const ancestralKiss = resolveTeamTurn(createTeamBattleState({ player: [{ ...user,
      heldItem: "RAIZANCESTRAL", moves: [{ move: kiss, pp: 10 }] }],
    opponent: [mon("target", "opponent")] }),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(ancestralKiss.events).toContainEqual(expect.objectContaining({ type: "hpRestored",
      side: "player", move: "DRAININGKISS", amount: 60 }));
  });

  it("turns Leech Seed into Liquid Ooze damage before Big Root and Heal Block in simple and Duo", () => {
    const user = mon("user", "player", { hp: 100, heldItem: "BIGROOT",
      volatile: { ...volatileOf(mon("user", "player")), healBlockTurns: 2 } });
    const seeded = mon("seeded", "opponent", { ability: "LIQUIDOOZE", volatile: {
      ...volatileOf(mon("seeded", "opponent")), leechSeededBy: "player", leechSeededBySlot: 0 } });
    const single = resolveTeamTurn(createTeamBattleState({ player: [user], opponent: [seeded] }),
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, rng);
    expect(single.state.teams.player.members[0]!.hp).toBe(70);
    expect(single.events).toContainEqual({ type: "abilityDamage", source: "opponent",
      target: "player", ability: "LIQUIDOOZE", amount: 30, hp: 70 });
    expect(single.events).not.toContainEqual(expect.objectContaining({ type: "hpRestored",
      move: "LEECHSEED" }));

    const double = resolveDoubleTeamTurn(createDoubleTeamBattleState({ player: [user,
      mon("ally", "player")], opponent: [seeded, mon("foe", "opponent")] }), [
      { actor: { side: "player", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(double.state.teams.player.members[0]!.hp).toBe(70);
    expect(double.events).toContainEqual(expect.objectContaining({ type: "positionedActionResolved",
      actor: { side: "player", slot: 0 }, events: expect.arrayContaining([expect.objectContaining({
        type: "abilityDamage", target: "player", ability: "LIQUIDOOZE", amount: 30 })]) }));
  });
});
