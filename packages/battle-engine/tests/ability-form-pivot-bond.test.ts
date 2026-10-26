import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  forcedSwitchBlockedByAbility, reconcileAbilityForm, replaceFaintedDoublePokemon, replaceFaintedPokemon,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide,
  type BattlerState, type DoubleBattleEvent, type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: () => 0 };

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const move = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return {
    id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 300, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 300, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: { ...move, accuracy: 0 }, pp: move.pp }], ...overrides,
  };
}

function inner(events: readonly DoubleBattleEvent[]) {
  return events.flatMap((event) => event.type === "positionedActionResolved" ? event.events : []);
}

describe("Pokemon Z forms, pivots and extra hits", () => {
  it("pops Air Balloon only after HP damage, including Disguise, and excludes Pickup", () => {
    const target = pokemon("balloon", "opponent", { heldItem: "AIRBALLOON" });
    const hit = resolveTeamTurn(createTeamBattleState({ player: [pokemon("user", "player")],
      opponent: [target] }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(hit.state.teams.opponent.members[0]).toMatchObject({ heldItem: null });
    expect(hit.state.teams.opponent.members[0]!.recyclableItem).toBe("AIRBALLOON");
    expect(hit.state.teams.opponent.members[0]!.volatile?.pickupItem).toBeNull();
    expect(hit.events).toContainEqual(expect.objectContaining({ type: "heldItemConsumed",
      item: "AIRBALLOON", effect: "popped" }));

    const shielded = resolveTeamTurn(createTeamBattleState({ player: [pokemon("user", "player")],
      opponent: [pokemon("shield", "opponent", { heldItem: "AIRBALLOON",
        volatile: { substituteHp: 100 } as BattlerState["volatile"] })] }),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(shielded.state.teams.opponent.members[0]!.heldItem).toBe("AIRBALLOON");

    const disguise = resolveTeamTurn(createTeamBattleState({ player: [pokemon("user", "player")],
      opponent: [pokemon("mimikyu", "opponent", { species: "MIMIKYU", ability: "DISGUISE",
        heldItem: "AIRBALLOON", appearance: { form: 0, shiny: false, gender: null } })] }),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(disguise.state.teams.opponent.members[0]!.heldItem).toBeNull();
    expect(disguise.events).toContainEqual(expect.objectContaining({ type: "heldItemConsumed",
      item: "AIRBALLOON", effect: "popped" }));
  });
  it.each([
    ["ABSORBBULB", "WATER", "specialAttack"],
    ["LUMINOUSMOSS", "WATER", "specialDefense"],
    ["CELLBATTERY", "ELECTRIC", "attack"],
    ["SNOWBALL", "ICE", "attack"],
  ] as const)("activates %s on a damaging %s hit", (item, type, stat) => {
    const attack: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, type, accuracy: 0 };
    const attacker = pokemon("user", "player", { moves: [{ move: attack, pp: attack.pp }] });
    const target = pokemon("target", "opponent", { heldItem: item });
    const battle = (defender: BattlerState) => resolveTeamTurn(createTeamBattleState({
      player: [attacker], opponent: [defender],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    const triggered = battle(target);
    expect(triggered.state.teams.opponent.members[0]!.stages[stat]).toBe(1);
    expect(triggered.state.teams.opponent.members[0]!.heldItem).toBeNull();
    expect(triggered.events).toContainEqual(expect.objectContaining({ type: "heldItemConsumed",
      item, effect: "boost" }));
    const capped = battle({ ...target, stages: { ...target.stages, [stat]: 6 } });
    expect(capped.state.teams.opponent.members[0]!.heldItem).toBe(item);
  });
  it("consumes Weakness Policy only when a super-effective hit can raise a stat", () => {
    const fire: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, type: "FIRE", accuracy: 0 };
    const attacker = pokemon("user", "player", { moves: [{ move: fire, pp: fire.pp }] });
    const target = pokemon("target", "opponent", { types: ["GRASS"], heldItem: "WEAKNESSPOLICY" });
    const battle = (defender: BattlerState) => resolveTeamTurn(createTeamBattleState({
      player: [attacker], opponent: [defender],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    const triggered = battle(target);
    expect(triggered.state.teams.opponent.members[0]!.stages).toMatchObject({ attack: 2, specialAttack: 2 });
    expect(triggered.state.teams.opponent.members[0]!.heldItem).toBeNull();
    expect(triggered.events).toContainEqual(expect.objectContaining({ type: "heldItemConsumed",
      item: "WEAKNESSPOLICY", effect: "boost" }));
    const capped = battle({ ...target,
      stages: { ...target.stages, attack: 6, specialAttack: 6 } });
    expect(capped.state.teams.opponent.members[0]!.heldItem).toBe("WEAKNESSPOLICY");
    const neutral = battle({ ...target, types: ["NORMAL"] });
    expect(neutral.state.teams.opponent.members[0]!.heldItem).toBe("WEAKNESSPOLICY");
  });
  it.each([
    ["KEEBERRY", "Physical", "defense"],
    ["MARANGABERRY", "Special", "specialDefense"],
  ] as const)("activates %s only for a %s hit", (item, category, stat) => {
    const attack: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, category, accuracy: 0 };
    const attacker = pokemon("user", "player", { moves: [{ move: attack, pp: attack.pp }] });
    const target = pokemon("target", "opponent", { heldItem: item });
    const result = resolveTeamTurn(createTeamBattleState({ player: [attacker], opponent: [target] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(result.state.teams.opponent.members[0]!.stages[stat]).toBe(1);
    expect(result.state.teams.opponent.members[0]!.heldItem).toBeNull();
    const wrongCategory: BattleMove = { ...attack,
      category: category === "Physical" ? "Special" : "Physical" };
    const wrongAttacker = pokemon("user", "player", { moves: [{ move: wrongCategory, pp: wrongCategory.pp }] });
    const ignored = resolveTeamTurn(createTeamBattleState({ player: [wrongAttacker], opponent: [target] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(ignored.state.teams.opponent.members[0]!.heldItem).toBe(item);
  });
  it("keeps reactive item effects on the struck slot in Duo", () => {
    const fire: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, type: "FIRE", accuracy: 0 };
    const attacker = pokemon("p1", "player", { moves: [{ move: fire, pp: fire.pp }] });
    const state = createDoubleTeamBattleState({ player: [attacker, pokemon("p2", "player")],
      opponent: [pokemon("o1", "opponent", { types: ["GRASS"], heldItem: "WEAKNESSPOLICY" }),
        pokemon("o2", "opponent", { types: ["GRASS"], heldItem: "WEAKNESSPOLICY" })] });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 1 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.teams.opponent.members[0]!.heldItem).toBe("WEAKNESSPOLICY");
    expect(result.state.teams.opponent.members[1]!.stages).toMatchObject({ attack: 2, specialAttack: 2 });
    expect(result.state.teams.opponent.members[1]!.heldItem).toBeNull();
  });
  it("boosts only special attacks with Poder Sabio and locks the selected move until switching", () => {
    const special: BattleMove = { ...MINIMAL_MOVE_CATALOG.WATERGUN, accuracy: 0 };
    const physical: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0 };
    const target = pokemon("target", "opponent");
    const damage = (ability: BattlerState["ability"], move: BattleMove) => calculateDamage("player",
      pokemon("user", "player", { ability }), target, move, rng, []);
    expect(damage("PODERSABIO", special)).toBeGreaterThan(damage(null, special));
    expect(damage("PODERSABIO", physical)).toBe(damage(null, physical));

    const user = pokemon("sage", "player", { ability: "PODERSABIO", moves: [
      { move: physical, pp: 10 }, { move: special, pp: 10 },
    ] });
    const first = resolveTeamTurn(createTeamBattleState({ player: [user, pokemon("reserve", "player")], opponent: [target] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    const second = resolveTeamTurn(first.state,
      { player: { kind: "move", moveIndex: 1 }, opponent: { kind: "wait" } }, rng);
    expect(second.events).toContainEqual({ type: "moveUsed", side: "player", move: physical.internalName });
    expect(second.state.teams.player.members[0]!.volatile?.choiceLockedMove).toBe(physical.internalName);
    const switched = resolveTeamTurn(second.state,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" } }, rng);
    expect(switched.state.teams.player.members[0]!.volatile?.choiceLockedMove).toBeUndefined();
  });

  it("blocks opponent-forced switches with Ventouses unless Mold Breaker bypasses it", () => {
    const target = pokemon("cups", "opponent", { ability: "SUCTIONCUPS" });
    expect(forcedSwitchBlockedByAbility(pokemon("source", "player"), target)).toBe(true);
    expect(forcedSwitchBlockedByAbility(pokemon("breaker", "player", { ability: "MOLDBREAKER" }), target)).toBe(false);
    expect(forcedSwitchBlockedByAbility(pokemon("source", "player"), { ...target, hp: 0 })).toBe(false);
  });

  it("makes Lien Parental hit twice, with a half-strength second hit, but not on multi-hit moves", () => {
    const user = pokemon("parent", "player", { ability: "PARENTALBOND" });
    const result = resolveTeamTurn(createTeamBattleState({ player: [user], opponent: [pokemon("target", "opponent")] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    const hits = result.events.filter((event): event is Extract<typeof event, { readonly type: "damageApplied" }> =>
      event.type === "damageApplied" && event.source === "player");
    expect(hits).toHaveLength(2);
    expect(hits[1]!.amount).toBeLessThan(hits[0]!.amount);
    expect(result.events).toContainEqual({ type: "abilityActivated", side: "player",
      ability: "PARENTALBOND", effect: "extra-hit" });

    const multi: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "MULTI", functionCode: "0BD" };
    const excluded = resolveTeamTurn(createTeamBattleState({ player: [{ ...user,
      moves: [{ move: multi, pp: multi.pp }] }], opponent: [pokemon("target", "opponent")] }),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(excluded.events).not.toContainEqual(expect.objectContaining({ type: "abilityActivated",
      ability: "PARENTALBOND" }));
  });

  it("breaks Disguise, stops the pending Parental Bond sequence, and resets it on switching", () => {
    const mimikyu = pokemon("mimikyu", "opponent", { species: "MIMIKYU", ability: "DISGUISE",
      appearance: { form: 0, shiny: false, gender: null } });
    const result = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("parent", "player", { ability: "PARENTALBOND" }), pokemon("reserve", "player")],
      opponent: [mimikyu, pokemon("reserve-foe", "opponent")],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    const target = result.state.teams.opponent.members[0]!;
    expect(target.appearance?.form).toBe(1);
    expect(target.hp).toBe(300 - Math.floor(300 / 8));
    expect(result.events).toContainEqual(expect.objectContaining({ type: "abilityActivated", ability: "DISGUISE" }));
    expect(result.events).not.toContainEqual(expect.objectContaining({ type: "abilityActivated",
      ability: "PARENTALBOND" }));
    expect(result.events.filter((event) => event.type === "damageApplied" && event.source === "player"))
      .toHaveLength(0);

    const bypass = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("breaker", "player", { ability: "MOLDBREAKER" })], opponent: [mimikyu],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(bypass.state.teams.opponent.members[0]).toMatchObject({ appearance: { form: 0 } });
    expect(bypass.state.teams.opponent.members[0]!.hp).toBeLessThan(300);

    const switchedOut = resolveTeamTurn(result.state,
      { player: { kind: "wait" }, opponent: { kind: "switch", teamIndex: 1 } }, rng);
    const switchedBack = resolveTeamTurn(switchedOut.state,
      { player: { kind: "wait" }, opponent: { kind: "switch", teamIndex: 0 } }, rng);
    expect(switchedBack.state.teams.opponent.members[0]!.appearance?.form).toBe(0);
  });

  it("requests Emergency Exit only after a damaging Bug move and resolves the owner's replacement", () => {
    const bug: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "BUGHIT", type: "BUG", accuracy: 0 };
    const state = createTeamBattleState({ player: [pokemon("pivot", "player", { ability: "EMERGENCYEXIT",
      moves: [{ move: bug, pp: bug.pp }] }), pokemon("reserve", "player")],
    opponent: [pokemon("target", "opponent")] });
    const result = resolveTeamTurn(state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(result.state).toMatchObject({ replacementRequired: ["player"], pivotRequired: ["player"] });
    expect(result.events).toContainEqual({ type: "forcedSwitchRequested", side: "player", ability: "EMERGENCYEXIT" });
    const replaced = replaceFaintedPokemon(result.state, { player: 1 }, rng);
    expect(replaced.state).toMatchObject({ replacementRequired: [], pivotRequired: [],
      teams: { player: { activeIndex: 1 } } });
    expect(replaced.events).toContainEqual(expect.objectContaining({ type: "pokemonSwitched", reason: "forced" }));

    const noReserve = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("pivot", "player", { ability: "EMERGENCYEXIT", moves: [{ move: bug, pp: bug.pp }] })],
      opponent: [pokemon("target", "opponent")],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(noReserve.events).not.toContainEqual(expect.objectContaining({ type: "forcedSwitchRequested" }));
  });

  it("tracks Emergency Exit by active position in doubles", () => {
    const bug: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "BUGHIT", type: "BUG",
      accuracy: 0, targetCode: "00" };
    const state = createDoubleTeamBattleState({ player: [pokemon("pivot", "player", { ability: "EMERGENCYEXIT",
      moves: [{ move: bug, pp: bug.pp }] }), pokemon("ally", "player"), pokemon("reserve", "player")],
    opponent: [pokemon("target", "opponent"), pokemon("other", "opponent")] });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(result.state.slotPivotReplacements).toEqual([{ side: "player", slot: 0 }]);
    expect(inner(result.events)).toContainEqual({ type: "forcedSwitchRequested", side: "player",
      ability: "EMERGENCYEXIT" });
    const replaced = replaceFaintedDoublePokemon(result.state, { side: "player", slot: 0 }, 2, rng);
    expect(replaced.teams.player.activeIndices).toEqual([2, 1]);
    expect(replaced.slotPivotReplacements).toEqual([]);

    const knockout: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "KNOCKOUT",
      power: 1_000, accuracy: 0, targetCode: "00" };
    const contested = createDoubleTeamBattleState({
      player: [pokemon("pivot", "player", { ability: "EMERGENCYEXIT",
        moves: [{ move: bug, pp: bug.pp }] }), pokemon("ally", "player"), pokemon("only-reserve", "player")],
      opponent: [pokemon("attacker", "opponent", { moves: [{ move: knockout, pp: knockout.pp }] }),
        pokemon("other", "opponent")],
    });
    const priority = resolveDoubleTeamTurn(contested, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 1 } } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);
    expect(priority.state.slotReplacements).toEqual([{ side: "player", slot: 1 }]);
    expect(priority.state.slotPivotReplacements).toEqual([]);
  });

  it("applies Flower Gift's sunny self/partner bonuses and Mold Breaker bypass", () => {
    const physical: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0 };
    const special: BattleMove = { ...MINIMAL_MOVE_CATALOG.WATERGUN, type: "NORMAL", accuracy: 0 };
    const attacker = pokemon("attacker", "player");
    const defender = pokemon("defender", "opponent");
    const context = { reflect: false, lightScreen: false, luckyChant: false, mudSport: false,
      waterSport: false, weather: "sun" as const };
    const neutralPhysical = calculateDamage("player", attacker, defender, physical, rng, [], context);
    const giftedPhysical = calculateDamage("player", attacker, defender, physical, rng, [],
      { ...context, attackerPartnerAbility: "FLOWERGIFT" });
    expect(giftedPhysical).toBeGreaterThan(neutralPhysical);
    expect(calculateDamage("player", { ...attacker, ability: "FLOWERGIFT" }, defender,
      physical, rng, [], context)).toBe(giftedPhysical);
    const neutralSpecial = calculateDamage("player", attacker, defender, special, rng, [], context);
    const guardedSpecial = calculateDamage("player", attacker, defender, special, rng, [],
      { ...context, defenderPartnerAbility: "FLOWERGIFT" });
    expect(guardedSpecial).toBeLessThan(neutralSpecial);
    expect(calculateDamage("player", { ...attacker, ability: "MOLDBREAKER" }, defender, special, rng, [],
      { ...context, defenderPartnerAbility: "FLOWERGIFT" })).toBe(neutralSpecial);
  });

  it("maps Forecast forms and types from authoritative weather", () => {
    const castform = pokemon("castform", "player", { species: "CASTFORM", ability: "FORECAST",
      appearance: { form: 0, shiny: false, gender: null } });
    for (const [weather, form, type] of [["sun", 1, "FIRE"], ["rain", 2, "WATER"],
      ["hail", 3, "ICE"], ["sand", 4, "ROCK"]] as const) {
      const result = reconcileAbilityForm(castform, "player", weather);
      expect(result.battler).toMatchObject({ types: [type], appearance: { form } });
      expect(result.events).toContainEqual({ type: "formChanged", side: "player", species: "CASTFORM",
        fromForm: 0, toForm: form, reason: "ability" });
    }
    expect(reconcileAbilityForm({ ...castform, ability: null }, "player", "sun").battler)
      .toMatchObject({ types: ["NORMAL"], appearance: { form: 0 } });
    expect(reconcileAbilityForm(castform, "player", "harsh-sun").battler)
      .toMatchObject({ types: ["FIRE"], appearance: { form: 1 } });
    expect(reconcileAbilityForm(castform, "player", "heavy-rain").battler)
      .toMatchObject({ types: ["WATER"], appearance: { form: 2 } });

    const sunny = createTeamBattleState({ player: [castform, pokemon("reserve", "player")],
      opponent: [pokemon("sun", "opponent", { ability: "DROUGHT" })] });
    expect(sunny.teams.player.members[0]).toMatchObject({ types: ["FIRE"], appearance: { form: 1 } });
    const away = resolveTeamTurn(sunny,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" } }, rng);
    expect(away.state.teams.player.members[0]).toMatchObject({ types: ["NORMAL"], appearance: { form: 0 } });
    const back = resolveTeamTurn(away.state,
      { player: { kind: "switch", teamIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(back.state.teams.player.members[0]).toMatchObject({ types: ["FIRE"], appearance: { form: 1 } });

    const suppressed = createDoubleTeamBattleState({
      player: [castform, pokemon("air-lock", "player", { ability: "AIRLOCK" })],
      opponent: [pokemon("sun", "opponent", { ability: "DROUGHT" }), pokemon("other", "opponent")],
    });
    expect(suppressed.effects).toMatchObject({ weather: "sun" });
    expect(suppressed.teams.player.members[0]).toMatchObject({ types: ["NORMAL"], appearance: { form: 0 } });
  });
});
