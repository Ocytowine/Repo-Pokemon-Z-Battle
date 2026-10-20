import {
  MAX_TEAM_SIZE,
  MINIMAL_MOVE_CATALOG,
  activeBattlers,
  attemptSourceBattleEscape,
  chooseSourceBattleAction,
  createTeamBattleState,
  replaceFaintedPokemon,
  resolveTeamTurn,
  type BattleSide,
  type BattleMove,
  type BattlerState,
  type RandomSource,
} from "../src/index.js";
import { describe, expect, it } from "vitest";

class ScriptedRandom implements RandomSource {
  private index = 0;

  public constructor(private readonly values: readonly number[]) {}

  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index++];
    if (value === undefined || value < 0 || value >= maxExclusive) {
      throw new Error(`Missing RNG value for nextInt(${maxExclusive}).`);
    }
    return value;
  }
}

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const move = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return {
    id,
    species: id.toUpperCase(),
    name: id,
    level: 50,
    types: ["NORMAL"],
    stats: { maxHp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: side === "player" ? 100 : 90 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    hp: 100,
    majorStatus: null,
    ability: null,
    heldItem: null,
    moves: [{ move, pp: move.pp }],
    ...overrides,
  };
}

describe("team battles", () => {
  it("resolves Download once on entry and Natural Cure when leaving", () => {
    const state = createTeamBattleState({
      player: [pokemon("download", "player", { ability: "DOWNLOAD",
        majorStatus: { kind: "burn" } }), pokemon("reserve", "player")],
      opponent: [pokemon("wall", "opponent", { stats: { maxHp: 100, attack: 100, defense: 80,
        specialAttack: 100, specialDefense: 120, speed: 90 } })],
    });
    const entered = resolveTeamTurn(state, { player: { kind: "wait" }, opponent: { kind: "wait" } },
      new ScriptedRandom([]));
    expect(entered.state.teams.player.members[0]!.stages.attack).toBe(1);
    expect(entered.events).toContainEqual({ type: "abilityActivated", side: "player",
      ability: "DOWNLOAD", effect: "raise-stat" });
    const unchanged = resolveTeamTurn(entered.state,
      { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(unchanged.state.teams.player.members[0]!.stages.attack).toBe(1);

    const natural = createTeamBattleState({
      player: [pokemon("cure", "player", { ability: "NATURALCURE", majorStatus: { kind: "burn" } }),
        pokemon("reserve", "player")], opponent: [pokemon("foe", "opponent")],
    });
    const switched = resolveTeamTurn(natural,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(switched.state.teams.player.members[0]!.majorStatus).toBeNull();
    expect(switched.events).toContainEqual({ type: "abilityActivated", side: "player",
      ability: "NATURALCURE", effect: "cure-on-switch" });
  });

  it("copies a valid entry talent with Trace, triggers it, then restores Trace on switch", () => {
    const state = createTeamBattleState({
      player: [pokemon("tracer", "player", { ability: "TRACE" }), pokemon("reserve", "player")],
      opponent: [pokemon("download", "opponent", { ability: "DOWNLOAD", stats: { maxHp: 100, attack: 100,
        defense: 80, specialAttack: 100, specialDefense: 120, speed: 90 } })],
    });
    const entered = resolveTeamTurn(state, { player: { kind: "wait" }, opponent: { kind: "wait" } },
      new ScriptedRandom([0]));
    expect(entered.state.teams.player.members[0]!.ability).toBe("DOWNLOAD");
    expect(entered.state.teams.player.members[0]!.stages.attack).toBe(1);
    expect(entered.events).toContainEqual({ type: "abilityObserved", side: "player", ability: "TRACE",
      observation: { kind: "copied-ability", targetId: "download", ability: "DOWNLOAD" } });
    expect(entered.trace).toContainEqual({ type: "rng", purpose: "ability", maxExclusive: 1, value: 0 });
    const switched = resolveTeamTurn(entered.state,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(switched.state.teams.player.members[0]!.ability).toBe("TRACE");
  });

  it("reports Frisk, Anticipation and Forewarn observations only on entry", () => {
    const held = pokemon("held", "opponent", { heldItem: "ORANBERRY" });
    const frisk = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("frisk", "player", { ability: "FRISK" })], opponent: [held],
    }), { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(frisk.events).toContainEqual({ type: "abilityObserved", side: "player", ability: "FRISK",
      observation: { kind: "held-item", targetId: "held", item: "ORANBERRY" } });

    const fireMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "FIREHIT", type: "FIRE", power: 60 };
    const anticipation = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("warning", "player", { ability: "ANTICIPATION", types: ["GRASS"] })],
      opponent: [pokemon("fire", "opponent", { moves: [{ move: fireMove, pp: fireMove.pp }] })],
    }), { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(anticipation.events).toContainEqual({ type: "abilityObserved", side: "player",
      ability: "ANTICIPATION", observation: { kind: "danger" } });

    const forewarn = resolveTeamTurn(createTeamBattleState({
      player: [pokemon("forewarn", "player", { ability: "FOREWARN" })],
      opponent: [pokemon("moves", "opponent", { moves: [
        { move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 10 }, { move: fireMove, pp: 10 },
      ] })],
    }), { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([0]));
    expect(forewarn.events).toContainEqual({ type: "abilityObserved", side: "player", ability: "FOREWARN",
      observation: { kind: "move", targetId: "moves", move: "FIREHIT" } });
  });

  it("lets Hyper Cutter block Intimidate when an opponent switches in", () => {
    const state = createTeamBattleState({
      player: [pokemon("lead", "player"), pokemon("intimidator", "player", { ability: "INTIMIDATE" })],
      opponent: [pokemon("protected", "opponent", { ability: "HYPERCUTTER" })],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(result.state.teams.opponent.members[0]?.stages.attack).toBe(0);
    expect(result.events).toContainEqual({ type: "abilityActivated", side: "opponent", ability: "HYPERCUTTER",
      effect: "prevent-stat-drop" });
  });

  it("lets Competitive react when an opponent switches in with Intimidate", () => {
    const state = createTeamBattleState({
      player: [pokemon("lead", "player"), pokemon("intimidator", "player", { ability: "INTIMIDATE" })],
      opponent: [pokemon("competitive", "opponent", { ability: "COMPETITIVE" })],
    });
    const result = resolveTeamTurn(state,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(result.state.teams.opponent.members[0]?.stages).toMatchObject({ attack: -1, specialAttack: 2 });
    expect(result.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "COMPETITIVE", effect: "raise-stat" });
  });

  it("applies Pickpocket while protecting player items from wild opponents", () => {
    const contactMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, flags: "a" };
    const trainerState = createTeamBattleState({
      player: [pokemon("hero", "player", { heldItem: "ORANBERRY", moves: [{ move: contactMove, pp: contactMove.pp }] })],
      opponent: [pokemon("thief", "opponent", { ability: "PICKPOCKET" })],
    });
    const actions = { player: { kind: "move" as const, moveIndex: 0 }, opponent: { kind: "wait" as const } };
    const trainerResult = resolveTeamTurn(trainerState, actions, new ScriptedRandom([0, 0, 0, 0, 0]));

    expect(trainerResult.state.teams.player.members[0]?.heldItem).toBeNull();
    expect(trainerResult.state.teams.opponent.members[0]?.heldItem).toBe("ORANBERRY");
    expect(trainerResult.events).toContainEqual({ type: "heldItemTransferred", source: "player",
      target: "opponent", item: "ORANBERRY", reason: "pickpocket" });
    expect(trainerResult.state.effects?.itemTransfers).toEqual([
      { item: "ORANBERRY", sourceId: "hero", targetId: "thief", reason: "pickpocket" },
    ]);

    const wildResult = resolveTeamTurn(trainerState, actions, new ScriptedRandom([0, 0, 0, 0, 0]),
      { context: "battle", revivalAllowed: true }, { opponentItemTheft: false });
    expect(wildResult.state.teams.player.members[0]?.heldItem).toBe("ORANBERRY");
    expect(wildResult.state.teams.opponent.members[0]?.heldItem).toBeNull();
    expect(wildResult.events).not.toContainEqual(expect.objectContaining({ type: "heldItemTransferred" }));

    const playerThief = createTeamBattleState({
      player: [pokemon("hero", "player", { ability: "PICKPOCKET" })],
      opponent: [pokemon("wild", "opponent", { heldItem: "ORANBERRY",
        moves: [{ move: contactMove, pp: contactMove.pp }] })],
    });
    const playerSteals = resolveTeamTurn(playerThief,
      { player: { kind: "wait" }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([0, 0, 0, 0, 0]), { context: "battle", revivalAllowed: true },
      { opponentItemTheft: false });
    expect(playerSteals.state.teams.player.members[0]?.heldItem).toBe("ORANBERRY");
    expect(playerSteals.state.teams.opponent.members[0]?.heldItem).toBeNull();
  });

  it("shares source AI and escape decisions between adapters", () => {
    const scratch = MINIMAL_MOVE_CATALOG.SCRATCH;
    const tackle = MINIMAL_MOVE_CATALOG.TACKLE;
    const opponent = pokemon("foe", "opponent", { moves: [
      { move: scratch, pp: scratch.pp }, { move: tackle, pp: tackle.pp },
    ] });
    const state = createTeamBattleState({ player: [pokemon("hero", "player")], opponent: [opponent] });
    expect(chooseSourceBattleAction(state, "opponent", new ScriptedRandom([1])))
      .toEqual({ kind: "move", moveIndex: 1 });
    expect(attemptSourceBattleEscape(state, 0, new ScriptedRandom([]))).toEqual({ escaped: true });
  });

  it("allows a guaranteed wild escape instead of auto-selecting a fainted player's reserve", () => {
    const base = createTeamBattleState({
      player: [pokemon("fainted", "player"), pokemon("reserve", "player")],
      opponent: [pokemon("wild", "opponent")],
    });
    const waiting = { ...base, replacementRequired: ["player" as const], teams: { ...base.teams,
      player: { ...base.teams.player, members: base.teams.player.members.map((member, index) =>
        index === base.teams.player.activeIndex ? { ...member, hp: 0 } : member) } } };

    expect(attemptSourceBattleEscape(waiting, 0, new ScriptedRandom([]))).toEqual({ escaped: true });
    expect(waiting.teams.player.activeIndex).toBe(0);
  });

  it("accepts teams from one to six members and owns an immutable copy", () => {
    const source = Array.from({ length: MAX_TEAM_SIZE }, (_, index) => pokemon(`player-${index}`, "player"));
    const state = createTeamBattleState({ player: source, opponent: [pokemon("opponent-0", "opponent")] });
    source[0] = pokemon("changed", "player");

    expect(state.teams.player.members).toHaveLength(6);
    expect(state.teams.player.members[0]?.id).toBe("player-0");
    expect(activeBattlers(state).player.id).toBe("player-0");
    expect(() => createTeamBattleState({ player: [...source, pokemon("seventh", "player")], opponent: [pokemon("opponent", "opponent")] })).toThrow("between 1 and 6");
  });

  it("switches before the opposing attack and resets the outgoing stat stages", () => {
    const boosted = pokemon("lead", "player", { stages: { attack: 3, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 } });
    const reserve = pokemon("reserve", "player");
    const state = createTeamBattleState({ player: [boosted, reserve], opponent: [pokemon("foe", "opponent")] });
    const result = resolveTeamTurn(
      state,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([99, 1, 15]),
    );

    expect(result.events[1]).toEqual({ type: "teamActionOrdered", order: [{ side: "player", kind: "switch" }, { side: "opponent", kind: "move" }] });
    expect(result.state.teams.player.activeIndex).toBe(1);
    expect(result.state.teams.player.members[0]?.hp).toBe(100);
    expect(result.state.teams.player.members[0]?.stages.attack).toBe(0);
    expect(result.state.teams.player.members[1]?.hp).toBeLessThan(100);
    expect(state.teams.player.activeIndex).toBe(0);
  });

  it("requires a replacement after an active Pokemon faints and preserves the turn number", () => {
    const state = createTeamBattleState({
      player: [pokemon("attacker", "player")],
      opponent: [pokemon("lead", "opponent", { hp: 1 }), pokemon("reserve", "opponent")],
    });
    const result = resolveTeamTurn(
      state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([99, 1, 15]),
    );

    expect(result.state).toMatchObject({ turn: 2, status: "active", winner: null, replacementRequired: ["opponent"] });
    expect(result.events).toContainEqual({ type: "replacementRequired", side: "opponent" });
    expect(result.events.some((event) => event.type === "battleEnded")).toBe(false);
    expect(() => resolveTeamTurn(result.state, { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, new ScriptedRandom([]))).toThrow("Resolve required replacements");

    const replacement = replaceFaintedPokemon(result.state, { opponent: 1 });
    expect(replacement.state.turn).toBe(2);
    expect(replacement.state.replacementRequired).toEqual([]);
    expect(replacement.state.teams.opponent.activeIndex).toBe(1);
    expect(replacement.events).toContainEqual({ type: "pokemonSwitched", side: "opponent", fromIndex: 0, toIndex: 1, from: "lead", to: "reserve", reason: "replacement" });
  });

  it("ends only when the defeated side has no conscious reserve", () => {
    const state = createTeamBattleState({ player: [pokemon("attacker", "player")], opponent: [pokemon("last", "opponent", { hp: 1 })] });
    const result = resolveTeamTurn(
      state,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([99, 1, 15]),
    );
    expect(result.state).toMatchObject({ status: "finished", winner: "player", replacementRequired: [] });
    expect(result.events).toContainEqual({ type: "battleEnded", winner: "player" });
  });

  it("resolves two voluntary switches without consuming RNG", () => {
    const state = createTeamBattleState({
      player: [pokemon("p1", "player"), pokemon("p2", "player")],
      opponent: [pokemon("o1", "opponent"), pokemon("o2", "opponent")],
    });
    const result = resolveTeamTurn(
      state,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "switch", teamIndex: 1 } },
      new ScriptedRandom([]),
    );
    expect(result.state.turn).toBe(2);
    expect(result.state.teams.player.activeIndex).toBe(1);
    expect(result.state.teams.opponent.activeIndex).toBe(1);
    expect(result.trace).toEqual([]);
  });

  it("uses a trainer medicine as a turn action on the selected team member", () => {
    const state = createTeamBattleState({
      player: [pokemon("lead", "player"), pokemon("reserve", "player", { hp: 25 })],
      opponent: [pokemon("foe", "opponent")],
    });
    const result = resolveTeamTurn(state, {
      player: { kind: "item", itemId: "POTION", targetTeamIndex: 1 },
      opponent: { kind: "wait" },
    }, new ScriptedRandom([]));

    expect(result.state.teams.player.members[1]?.hp).toBe(45);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "trainerItemUsed", side: "player",
      itemId: "POTION", targetIndex: 1, target: "reserve", hpRestored: 20,
      statusCured: null, revived: false }));
    expect(result.events[1]).toEqual({ type: "teamActionOrdered", order: [
      { side: "player", kind: "item" }, { side: "opponent", kind: "wait" },
    ] });
    expect(() => resolveTeamTurn(state, { player: { kind: "item", itemId: "POTION", targetTeamIndex: 0 },
      opponent: { kind: "wait" } }, new ScriptedRandom([]))).toThrow("no-effect");
  });

  it("lets source Trainer AI consume its own healing item exactly once", () => {
    const base = createTeamBattleState({ player: [pokemon("hero", "player")],
      opponent: [pokemon("canola", "opponent", { hp: 20 })] });
    const state = { ...base, teams: { ...base.teams,
      opponent: { ...base.teams.opponent, items: ["SUPERPOTION"] } } };
    const action = chooseSourceBattleAction(state, "opponent", new ScriptedRandom([]));
    expect(action).toEqual({ kind: "item", itemId: "SUPERPOTION", targetTeamIndex: 0 });
    const result = resolveTeamTurn(state, { player: { kind: "wait" }, opponent: action }, new ScriptedRandom([]));
    expect(result.state.teams.opponent).toMatchObject({ items: [], members: [{ hp: 70 }] });
    expect(chooseSourceBattleAction(result.state, "opponent", new ScriptedRandom([0])))
      .toEqual({ kind: "move", moveIndex: 0 });
  });

  it("intercepts a voluntary switch with Pursuit before the outgoing Pokemon leaves", () => {
    const pursuit: BattleMove = { ...MINIMAL_MOVE_CATALOG.SCRATCH, internalName: "PURSUIT",
      name: "Poursuite", functionCode: "088", power: 40, accuracy: 0 };
    const state = createTeamBattleState({
      player: [pokemon("outgoing", "player"), pokemon("incoming", "player")],
      opponent: [pokemon("hunter", "opponent", { moves: [{ move: pursuit, pp: pursuit.pp }] })],
    });
    const result = resolveTeamTurn(state, { player: { kind: "switch", teamIndex: 1 },
      opponent: { kind: "move", moveIndex: 0 } }, new ScriptedRandom([1, 15]));
    const damageIndex = result.events.findIndex((event) => event.type === "damageApplied");
    const switchIndex = result.events.findIndex((event) => event.type === "pokemonSwitched");
    expect(damageIndex).toBeGreaterThan(1);
    expect(switchIndex).toBeGreaterThan(damageIndex);
    expect(result.state.teams.player.members[0]!.hp).toBeLessThan(100);
    expect(result.state.teams.player.members[1]!.hp).toBe(100);
  });

  it("halves consecutive Protect success and resets the rate after failure", () => {
    const protect: BattleMove = { ...MINIMAL_MOVE_CATALOG.HOWL, internalName: "PROTECT",
      name: "Abri", functionCode: "0AA", priority: 4 };
    const state = createTeamBattleState({ player: [pokemon("guard", "player", {
      moves: [{ move: protect, pp: protect.pp }] })], opponent: [pokemon("foe", "opponent")] });
    const first = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "move", moveIndex: 0 } }, new ScriptedRandom([]));
    expect(first.state.teams.player.members[0]!.volatile).toMatchObject({ protectRate: 2, protected: false });
    const second = resolveTeamTurn(first.state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "move", moveIndex: 0 } }, new ScriptedRandom([40_000, 99, 1, 15]));
    expect(second.events).toContainEqual({ type: "moveFailed", side: "player", move: "PROTECT", reason: "condition" });
    expect(second.state.teams.player.members[0]!.volatile).toMatchObject({ protectRate: 1, protected: false });
  });

  it("emits one damage event per hit of a multi-hit move", () => {
    const multi: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "FURYATTACK",
      name: "Furie", functionCode: "0C0", accuracy: 0 };
    const state = createTeamBattleState({ player: [pokemon("multi", "player", {
      moves: [{ move: multi, pp: multi.pp }] })], opponent: [pokemon("target", "opponent")] });
    const result = resolveTeamTurn(state, { player: { kind: "move", moveIndex: 0 },
      opponent: { kind: "wait" } }, { nextInt: () => 0 });
    const hits = result.events.filter((event) => event.type === "damageApplied");
    expect(hits).toHaveLength(2);
    expect(hits[1]).toMatchObject({ hp: result.state.teams.opponent.members[0]!.hp });
  });

  it("applies bitter medicine happiness and source revival exceptions in battle", () => {
    const state = createTeamBattleState({
      player: [pokemon("lead", "player", { hp: 20, happiness: 210 }),
        pokemon("fainted", "player", { hp: 0, happiness: 205 })],
      opponent: [pokemon("foe", "opponent")],
    });
    const healed = resolveTeamTurn(state, {
      player: { kind: "item", itemId: "ENERGYPOWDER", targetTeamIndex: 0 },
      opponent: { kind: "wait" },
    }, new ScriptedRandom([]));
    expect(healed.state.teams.player.members[0]).toMatchObject({ hp: 70, happiness: 200 });
    expect(healed.events).toContainEqual(expect.objectContaining({ type: "trainerItemUsed",
      itemId: "ENERGYPOWDER", happinessChanged: -10 }));

    const revived = resolveTeamTurn(state, {
      player: { kind: "item", itemId: "REVIVALHERB", targetTeamIndex: 1 },
      opponent: { kind: "wait" },
    }, new ScriptedRandom([]), { context: "battle", revivalAllowed: false });
    expect(revived.state.teams.player.members[1]).toMatchObject({ hp: 100, happiness: 185 });
    expect(() => resolveTeamTurn(state, {
      player: { kind: "item", itemId: "Cenizas", targetTeamIndex: 1 },
      opponent: { kind: "wait" },
    }, new ScriptedRandom([]))).toThrow("unsupported-item");
  });

  it("restores a selected move's PP and raises only the active Pokemon's battle stage", () => {
    const depleted = pokemon("lead", "player", { moves: [
      { move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 1 },
      { move: MINIMAL_MOVE_CATALOG.SCRATCH, pp: 0 },
    ] });
    const state = createTeamBattleState({ player: [depleted], opponent: [pokemon("foe", "opponent")] });
    const ether = resolveTeamTurn(state, {
      player: { kind: "item", itemId: "ETHER", targetTeamIndex: 0, targetMoveIndex: 1 },
      opponent: { kind: "wait" },
    }, new ScriptedRandom([]));
    expect(ether.state.teams.player.members[0]?.moves.map((slot) => slot.pp)).toEqual([1, 10]);
    expect(ether.events).toContainEqual(expect.objectContaining({ type: "trainerItemUsed", itemId: "ETHER",
      ppRestored: 10, targetMoveIndex: 1, movePp: [1, 10] }));

    const boosted = resolveTeamTurn(state, {
      player: { kind: "item", itemId: "XATTACK2", targetTeamIndex: 0 },
      opponent: { kind: "wait" },
    }, new ScriptedRandom([]));
    expect(boosted.state.teams.player.members[0]?.stages.attack).toBe(2);
    expect(boosted.events).toContainEqual(expect.objectContaining({ type: "trainerItemUsed", itemId: "XATTACK2",
      statRaised: "attack", stagesRaised: 2 }));
  });

  it("runs residual status hooks after switch-only turns and requests a replacement", () => {
    const state = createTeamBattleState({
      player: [pokemon("p1", "player"), pokemon("p2", "player")],
      opponent: [
        pokemon("o1", "opponent"),
        pokemon("burned", "opponent", { hp: 1, majorStatus: { kind: "burn" } }),
        pokemon("reserve", "opponent"),
      ],
    });
    const result = resolveTeamTurn(
      state,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "switch", teamIndex: 1 } },
      new ScriptedRandom([]),
    );
    expect(result.events).toContainEqual({ type: "statusDamage", side: "opponent", status: "burn", amount: 1, hp: 0 });
    expect(result.state.replacementRequired).toEqual(["opponent"]);
  });

  it("resets the toxic counter but preserves poison when switching out", () => {
    const poisoned = pokemon("poisoned", "player", { majorStatus: { kind: "poison", toxicCounter: 7 } });
    const state = createTeamBattleState({ player: [poisoned, pokemon("p2", "player")], opponent: [pokemon("o1", "opponent"), pokemon("o2", "opponent")] });
    const result = resolveTeamTurn(
      state,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "switch", teamIndex: 1 } },
      new ScriptedRandom([]),
    );
    expect(result.state.teams.player.members[0]?.majorStatus).toEqual({ kind: "poison", toxicCounter: 0 });
  });

  it("activates Leftovers and both Black Sludge branches after a switch-only turn", () => {
    const state = createTeamBattleState({
      player: [pokemon("p1", "player"), pokemon("leftovers", "player", { hp: 50, heldItem: "LEFTOVERS" })],
      opponent: [pokemon("o1", "opponent"), pokemon("sludge", "opponent", { heldItem: "BLACKSLUDGE" })],
    });
    const result = resolveTeamTurn(
      state,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "switch", teamIndex: 1 } },
      new ScriptedRandom([]),
    );
    expect(result.events).toContainEqual({ type: "itemActivated", side: "player", item: "LEFTOVERS", effect: "heal", amount: 6, hp: 56 });
    expect(result.events).toContainEqual({ type: "itemActivated", side: "opponent", item: "BLACKSLUDGE", effect: "damage", amount: 12, hp: 88 });

    const poisonState = createTeamBattleState({
      player: [pokemon("p1", "player"), pokemon("poison", "player", { hp: 80, types: ["POISON"], heldItem: "BLACKSLUDGE" })],
      opponent: [pokemon("o1", "opponent"), pokemon("o2", "opponent")],
    });
    const poisonResult = resolveTeamTurn(
      poisonState,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "switch", teamIndex: 1 } },
      new ScriptedRandom([]),
    );
    expect(poisonResult.events).toContainEqual({ type: "itemActivated", side: "player", item: "BLACKSLUDGE", effect: "heal", amount: 6, hp: 86 });
  });
});
