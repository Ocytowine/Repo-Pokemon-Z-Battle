import { MINIMAL_MOVE_CATALOG, activeBattlePositions, createDoubleTeamBattleState, resolveDoubleTeamTurn,
  type BattleMove, type BattleSide, type BattlerState, type RandomSource } from "../src/index.js";
import { describe, expect, it } from "vitest";

const rng: RandomSource = { nextInt: () => 0 };

function pokemon(id: string, side: BattleSide, speed: number, targetCode = "00"): BattlerState {
  const base = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return { id, species: id.toUpperCase(), name: id, level: 30, types: ["NORMAL"],
    stats: { maxHp: 120, attack: 80, defense: 80, specialAttack: 80, specialDefense: 80, speed },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    hp: 120, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: { ...base, accuracy: 0, targetCode }, pp: base.pp }] };
}

describe("double team battles", () => {
  it("keeps Moxie's knockout boost on the exact attacking slot", () => {
    const moxie = { ...pokemon("p1", "player", 100), ability: "MOXIE" as const };
    const state = createDoubleTeamBattleState({
      player: [moxie, pokemon("p2", "player", 90)],
      opponent: [{ ...pokemon("o1", "opponent", 80), hp: 1 }, pokemon("o2", "opponent", 70)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);

    expect(result.state.teams.player.members[0]?.stages.attack).toBe(1);
    expect(result.state.teams.player.members[1]?.stages.attack).toBe(0);
  });

  it("keeps Mummy's contact replacement on the exact attacking slot", () => {
    const contact = { ...pokemon("p1", "player", 100).moves[0]!.move, flags: "a" };
    const attacker = { ...pokemon("p1", "player", 100), ability: "HUSTLE" as const,
      moves: [{ move: contact, pp: contact.pp }] };
    const state = createDoubleTeamBattleState({
      player: [attacker, pokemon("p2", "player", 90)],
      opponent: [{ ...pokemon("o1", "opponent", 80), ability: "MUMMY" }, pokemon("o2", "opponent", 70)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.player.members[0]?.ability).toBe("MUMMY");
    expect(result.state.teams.player.members[1]?.ability).toBeNull();
  });


  it("shares entry talents across both opposing slots and preserves Download's source comparison", () => {
    const download = { ...pokemon("download", "player", 100), ability: "DOWNLOAD" };
    const ally = { ...pokemon("frisk", "player", 90), ability: "FRISK" };
    const first = { ...pokemon("o1", "opponent", 80), heldItem: "ORANBERRY" as const,
      stats: { ...pokemon("o1", "opponent", 80).stats, defense: 50, specialDefense: 100 } };
    const second = { ...pokemon("o2", "opponent", 70), heldItem: "FOCUSSASH" as const,
      stats: { ...pokemon("o2", "opponent", 70).stats, defense: 100, specialDefense: 1 } };
    const state = createDoubleTeamBattleState({ player: [download, ally], opponent: [first, second] });
    const result = resolveDoubleTeamTurn(state, activeBattlePositions(state).map((actor) =>
      ({ actor, action: { kind: "wait" as const } })), rng);
    expect(result.state.teams.player.members[0]!.stages.attack).toBe(1);
    const observations = result.events.flatMap((event) => event.type === "positionedActionResolved" ? event.events : [])
      .filter((event) => event.type === "abilityObserved" && event.ability === "FRISK");
    expect(observations).toHaveLength(2);
  });

  it("lets Clear Body protect both active targets from an entering Intimidate", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("p1", "player", 100), pokemon("p2", "player", 90),
        { ...pokemon("p3", "player", 60), ability: "INTIMIDATE" }],
      opponent: [{ ...pokemon("o1", "opponent", 80), ability: "CLEARBODY" },
        { ...pokemon("o2", "opponent", 70), ability: "CLEARBODY" }],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "switch", teamIndex: 2 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.opponent.members.slice(0, 2).map((member) => member.stages.attack)).toEqual([0, 0]);
    expect(result.events.filter((event) => event.type === "abilityActivated"
      && event.ability === "CLEARBODY")).toHaveLength(2);
  });

  it.each([
    ["WATER", "STORMDRAIN"],
    ["ELECTRIC", "LIGHTNINGROD"],
  ] as const)("redirects a single-target %s move to %s", (type, ability) => {
    const attacker = pokemon("p1", "player", 100);
    const move = { ...attacker.moves[0]!.move, type };
    const state = createDoubleTeamBattleState({
      player: [{ ...attacker, moves: [{ move, pp: move.pp }] }, pokemon("p2", "player", 90)],
      opponent: [pokemon("o1", "opponent", 80), { ...pokemon("o2", "opponent", 70), ability }],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "positionedActionResolved",
      actor: { side: "player", slot: 0 }, targets: [{ side: "opponent", slot: 1 }] }));
    expect(result.state.teams.opponent.members[0]?.hp).toBe(120);
    expect(result.state.teams.opponent.members[1]?.stages.specialAttack).toBe(1);
  });

  it("lets Storm Drain redirect an ally's Water move, as in the source priority scan", () => {
    const attacker = pokemon("p1", "player", 100);
    const move = { ...attacker.moves[0]!.move, type: "WATER" };
    const state = createDoubleTeamBattleState({
      player: [{ ...attacker, moves: [{ move, pp: move.pp }] },
        { ...pokemon("p2", "player", 90), ability: "STORMDRAIN" }],
      opponent: [pokemon("o1", "opponent", 80), pokemon("o2", "opponent", 70)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "positionedActionResolved",
      actor: { side: "player", slot: 0 }, targets: [{ side: "player", slot: 1 }] }));
    expect(result.state.teams.player.members[1]?.stages.specialAttack).toBe(1);
    expect(result.state.teams.opponent.members[0]?.hp).toBe(120);
  });

  it("propagates the wild opponent item-theft rule to positioned actions", () => {
    const attacker = pokemon("p1", "player", 100);
    const contact = { ...attacker.moves[0]!.move, flags: "a" };
    const state = createDoubleTeamBattleState({
      player: [{ ...attacker, heldItem: "ORANBERRY", moves: [{ move: contact, pp: contact.pp }] },
        pokemon("p2", "player", 90)],
      opponent: [{ ...pokemon("o1", "opponent", 80), ability: "PICKPOCKET" },
        pokemon("o2", "opponent", 70)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng, { context: "battle", revivalAllowed: true }, { opponentItemTheft: false });

    expect(result.state.teams.player.members[0]?.heldItem).toBe("ORANBERRY");
    expect(result.state.teams.opponent.members[0]?.heldItem).toBeNull();
  });

  it("applies Acometida's first-turn speed bonus when ordering double-battle slots", () => {
    const charger = { ...pokemon("p1", "player", 60), ability: "ACOMETIDA" as const };
    const state = createDoubleTeamBattleState({
      player: [charger, pokemon("p2", "player", 10)],
      opponent: [pokemon("o1", "opponent", 80), pokemon("o2", "opponent", 5)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 0 } } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    const resolved = result.events.filter((event) => event.type === "positionedActionResolved");
    expect(resolved[0]).toMatchObject({ actor: { side: "player", slot: 0 } });
  });

  it("keeps two active slots per camp and resolves four independently targeted actions", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("p1", "player", 100), pokemon("p2", "player", 90)],
      opponent: [pokemon("o1", "opponent", 80), pokemon("o2", "opponent", 70)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 1 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 1 } } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 0 } } },
    ], rng);

    expect(result.state.teams.player.activeIndices).toEqual([0, 1]);
    expect(result.state.teams.opponent.activeIndices).toEqual([0, 1]);
    expect(result.state.teams.player.members.every((member) => member.hp < 120)).toBe(true);
    expect(result.state.teams.opponent.members.every((member) => member.hp < 120)).toBe(true);
    expect(result.events.filter((event) => event.type === "positionedActionResolved")).toHaveLength(4);
  });

  it("keeps a fainted visual slot stable when no reserve can replace it", () => {
    const fragile = { ...pokemon("p1", "player", 10), hp: 1 };
    const state = createDoubleTeamBattleState({
      player: [fragile, pokemon("p2", "player", 90)],
      opponent: [pokemon("o1", "opponent", 100)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 0 } } },
    ], rng);

    expect(result.state.status).toBe("active");
    expect(result.state.teams.player.members[0]?.hp).toBe(0);
    expect(result.state.teams.player.activeIndices).toEqual([0, 1]);
    expect(result.state.teams.player.activeIndex).toBe(0);
    expect(result.state.slotReplacements).toEqual([]);

    const next = resolveDoubleTeamTurn(result.state, [
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
    ], rng);
    expect(next.state.turn).toBe(result.state.turn + 1);
  });

  it("rejects an action submitted for a fainted active slot", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("p1", "player", 100), pokemon("p2", "player", 90)],
      opponent: [pokemon("o1", "opponent", 80)],
    });
    const withFaintedSlot = { ...state, teams: { ...state.teams, player: { ...state.teams.player,
      members: state.teams.player.members.map((member, index) => index === 0 ? { ...member, hp: 0 } : member) } } };

    expect(() => resolveDoubleTeamTurn(withFaintedSlot, [
      { actor: { side: "player", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
    ], rng)).toThrow("Chaque Pokemon actif doit choisir exactement une action.");
  });

  it("applies spread damage to both opposing slots with the double-battle reduction", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("p1", "player", 100, "04"), pokemon("p2", "player", 10)],
      opponent: [pokemon("o1", "opponent", 20), pokemon("o2", "opponent", 15)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.opponent.members[0]!.hp).toBeLessThan(120);
    expect(result.state.teams.opponent.members[1]!.hp).toBeLessThan(120);
    expect(result.state.teams.player.members[0]!.moves[0]!.pp).toBe(MINIMAL_MOVE_CATALOG.TACKLE.pp - 1);
  });

  it("applies Sweet Scent to both opposing slots", () => {
    const sweetScent: BattleMove = { id: 417, internalName: "SWEETSCENT", name: "Doux Parfum",
      functionCode: "048", power: 0, type: "NORMAL", category: "Status", accuracy: 0, pp: 20,
      priority: 0, effectChance: 0, targetCode: "04" };
    const user = { ...pokemon("p1", "player", 100), moves: [{ move: sweetScent, pp: sweetScent.pp }] };
    const state = createDoubleTeamBattleState({
      player: [user, pokemon("p2", "player", 90)],
      opponent: [pokemon("o1", "opponent", 80), pokemon("o2", "opponent", 70)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);

    expect(result.state.teams.opponent.members.map((member) => member.stages.evasion)).toEqual([-2, -2]);
    expect(result.state.teams.player.members[0]!.moves[0]!.pp).toBe(sweetScent.pp - 1);
  });

  it("reuses self stat moves for one precise active slot", () => {
    const agility: BattleMove = { id: 1, internalName: "AGILITY", name: "Hate", functionCode: "030", power: 0,
      type: "PSYCHIC", category: "Status", accuracy: 0, pp: 30, priority: 0, effectChance: 0, targetCode: "10" };
    const agile = { ...pokemon("p1", "player", 100), moves: [{ move: agility, pp: agility.pp }] };
    const state = createDoubleTeamBattleState({
      player: [agile, pokemon("p2", "player", 90)],
      opponent: [pokemon("o1", "opponent", 80), pokemon("o2", "opponent", 70)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);

    expect(result.state.teams.player.members[0]?.stages.speed).toBe(2);
    expect(result.state.teams.player.members[1]?.stages.speed).toBe(0);
  });

  it("keeps early-route volatile and compound stat effects scoped to their double-battle slot", () => {
    const workUp: BattleMove = { id: 2, internalName: "WORKUP", name: "Rengorgement", functionCode: "027",
      power: 0, type: "NORMAL", category: "Status", accuracy: 0, pp: 30, priority: 0, effectChance: 0,
      targetCode: "10" };
    const boosted = { ...pokemon("p1", "player", 100), moves: [{ move: workUp, pp: workUp.pp }] };
    const state = createDoubleTeamBattleState({
      player: [boosted, pokemon("p2", "player", 90)],
      opponent: [pokemon("o1", "opponent", 80), pokemon("o2", "opponent", 70)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);

    expect(result.state.teams.player.members[0]?.stages).toMatchObject({ attack: 1, specialAttack: 1 });
    expect(result.state.teams.player.members[1]?.stages).toMatchObject({ attack: 0, specialAttack: 0 });
  });

  it("ticks replicated binding effects once per double-battle turn", () => {
    const bound = { ...pokemon("p1", "player", 100), volatile: { confusionTurns: 0, flinched: false,
      focusEnergy: 0, identified: false, disabledMove: null, disableTurns: 0, encoreMove: null,
      encoreTurns: 0, bindingMove: "WRAP", bindingTurns: 5, cursed: false, lastMoveUsed: null } };
    const state = createDoubleTeamBattleState({
      player: [bound, pokemon("p2", "player", 90)],
      opponent: [pokemon("o1", "opponent", 80), pokemon("o2", "opponent", 70)],
    });
    const result = resolveDoubleTeamTurn(state, activeBattlePositions(state).map((actor) =>
      ({ actor, action: { kind: "wait" as const } })), rng);

    expect(result.state.teams.player.members[0]).toMatchObject({ hp: 105,
      volatile: { bindingMove: "WRAP", bindingTurns: 4 } });
    expect(result.events).toContainEqual(expect.objectContaining({ type: "positionedActionResolved",
      actor: { side: "player", slot: 0 }, events: [expect.objectContaining({ type: "bindingDamage", amount: 15 })] }));
  });

  it("lets one active slot spend its action healing an owned reserve", () => {
    const reserve = { ...pokemon("reserve", "player", 60), hp: 10 };
    const state = createDoubleTeamBattleState({
      player: [pokemon("p1", "player", 100), pokemon("p2", "player", 90), reserve],
      opponent: [pokemon("o1", "opponent", 80), pokemon("o2", "opponent", 70)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "item", itemId: "POTION", targetTeamIndex: 2 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.player.members[2]?.hp).toBe(30);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "trainerItemUsed", side: "player",
      itemId: "POTION", targetIndex: 2, target: "reserve", hpRestored: 20,
      statusCured: null, revived: false }));
  });

  it("reuses the held-Berry passive hook for every active double-battle slot", () => {
    const berryHolder = { ...pokemon("p1", "player", 100), hp: 40,
      heldItem: "ORANBERRY" as const, ability: "CHEEKPOUCH" as const };
    const state = createDoubleTeamBattleState({
      player: [berryHolder, pokemon("p2", "player", 90)],
      opponent: [pokemon("o1", "opponent", 80), pokemon("o2", "opponent", 70)],
    });
    const result = resolveDoubleTeamTurn(state, activeBattlePositions(state).map((actor) =>
      ({ actor, action: { kind: "wait" as const } })), rng);
    expect(result.state.teams.player.members[0]).toMatchObject({ heldItem: null, hp: 90 });
    expect(result.events).toContainEqual(expect.objectContaining({ type: "positionedActionResolved",
      actor: { side: "player", slot: 0 }, events: expect.arrayContaining([
        expect.objectContaining({ type: "heldItemConsumed", item: "ORANBERRY" }),
      ]) }));
  });

  it("intercepts the selected outgoing double-battle slot with Pursuit", () => {
    const pursuit: BattleMove = { ...MINIMAL_MOVE_CATALOG.SCRATCH, internalName: "PURSUIT",
      name: "Poursuite", functionCode: "088", power: 40, accuracy: 0 };
    const hunter = { ...pokemon("o1", "opponent", 80), moves: [{ move: pursuit, pp: pursuit.pp }] };
    const state = createDoubleTeamBattleState({
      player: [pokemon("p1", "player", 100), pokemon("p2", "player", 90), pokemon("reserve", "player", 60)],
      opponent: [hunter, pokemon("o2", "opponent", 70)],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "switch", teamIndex: 2 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 0 } } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    const pursuitIndex = result.events.findIndex((event) => event.type === "positionedActionResolved"
      && event.actor.side === "opponent" && event.actor.slot === 0);
    const switchIndex = result.events.findIndex((event) => event.type === "pokemonSwitched"
      && event.side === "player" && event.fromIndex === 0);
    expect(pursuitIndex).toBeGreaterThan(0);
    expect(switchIndex).toBeGreaterThan(pursuitIndex);
    expect(result.state.teams.player.members[0]!.hp).toBeLessThan(120);
    expect(result.state.teams.player.members[2]!.hp).toBe(120);
  });
});
