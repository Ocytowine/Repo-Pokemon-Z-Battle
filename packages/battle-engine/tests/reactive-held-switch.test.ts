import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, ReactiveHeldSwitchChoiceRequired, attemptReactiveTurn,
  createDoubleTeamBattleState, createTeamBattleState,
  reactiveHeldSwitchRequest, resolveDoubleTeamTurn, resolveTeamTurn,
  type BattleMove, type BattlerState } from "../src/index.js";
import { volatileOf } from "../src/resolve-turn.js";

function mon(id: string, heldItem: BattlerState["heldItem"] = null): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 100, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: 100 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 100, majorStatus: null,
    ability: null, heldItem, moves: [{ move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 10 }] };
}

describe("reactive held replacement request", () => {
  const eligible: { attackerCanSwitch: boolean; defenderCanSwitch: boolean;
    additionalEffectsSuppressed: boolean; magicRoomTurns?: number } = { attackerCanSwitch: true, defenderCanSwitch: true,
    additionalEffectsSuppressed: false };

  it("requests a random attacker reserve for Red Card", () => {
    expect(reactiveHeldSwitchRequest(mon("attacker"), "player", mon("holder", "REDCARD"),
      "opponent", 20, eligible)).toEqual({ item: "REDCARD", holderSide: "opponent",
      holderId: "holder", displacedSide: "player", displacedId: "attacker", selection: "random" });
  });

  it("requests the holder's selected reserve for Eject Button", () => {
    expect(reactiveHeldSwitchRequest(mon("attacker"), "player", mon("holder", "EJECTBUTTON"),
      "opponent", 20, eligible)).toEqual({ item: "EJECTBUTTON", holderSide: "opponent",
      holderId: "holder", displacedSide: "opponent", displacedId: "holder", selection: "owner" });
  });

  it.each(["REDCARD", "EJECTBUTTON"] as const)(
    "requires actual damage, a live holder, an active %s and a legal reserve", (item) => {
      const attacker = mon("attacker");
      const holder = mon("holder", item);
      const request = (target: BattlerState, amount: number, options = eligible) =>
        reactiveHeldSwitchRequest(attacker, "player", target, "opponent", amount, options);
      expect(request(holder, 0)).toBeNull();
      expect(request({ ...holder, hp: 0 }, 20)).toBeNull();
      expect(request({ ...holder, ability: "KLUTZ" }, 20)).toBeNull();
      expect(request({ ...holder, volatile: { ...volatileOf(holder), embargoTurns: 2 } }, 20)).toBeNull();
      expect(request(holder, 20, { ...eligible, magicRoomTurns: 2 })).toBeNull();
      expect(request(holder, 20, { ...eligible, additionalEffectsSuppressed: true })).toBeNull();
      expect(request(holder, 20, { ...eligible,
        [item === "REDCARD" ? "attackerCanSwitch" : "defenderCanSwitch"]: false })).toBeNull();
    });
});

describe("Red Card during a team turn", () => {
  const hit: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0, power: 40 };
  const attack = { kind: "move" as const, moveIndex: 0 };
  const wait = { kind: "wait" as const };
  const fighter = (id: string, speed: number, item: BattlerState["heldItem"] = null): BattlerState => ({
    ...mon(id, item), stats: { ...mon(id).stats, maxHp: 200, speed }, hp: 200,
    moves: [{ move: hit, pp: 10 }],
  });

  it("draws a legal reserve after a hit and completes the holder's queued action", () => {
    const draws: number[] = [];
    const result = resolveTeamTurn(createTeamBattleState({
      player: [fighter("holder", 80, "REDCARD")],
      opponent: [fighter("attacker", 120), fighter("reserve-a", 70), fighter("reserve-b", 60)],
    }), { player: attack, opponent: attack }, { nextInt(max) {
      draws.push(max);
      return max === 2 ? 1 : 0;
    } });
    expect(result.state.teams.player.members[0]?.heldItem).toBeNull();
    expect(result.state.teams.opponent.activeIndex).toBe(2);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "pokemonSwitched",
      side: "opponent", from: "attacker", to: "reserve-b", reason: "forced" }));
    expect(result.events.filter((event) => event.type === "moveUsed" && event.side === "opponent"))
      .toHaveLength(1);
    expect(draws).toContain(2);
  });

  it("keeps Red Card when the attacker has no reserve", () => {
    const result = resolveTeamTurn(createTeamBattleState({
      player: [fighter("holder", 120, "REDCARD")], opponent: [fighter("attacker", 80)],
    }), { player: attack, opponent: wait }, { nextInt: () => 0 });
    expect(result.state.teams.player.members[0]?.heldItem).toBe("REDCARD");
  });

  it("replaces the striking slot in Duo and leaves its partner active", () => {
    const result = resolveDoubleTeamTurn(createDoubleTeamBattleState({
      player: [fighter("attacker", 120), fighter("partner", 90), fighter("reserve", 70)],
      opponent: [fighter("holder", 80, "REDCARD"), fighter("ally", 60)],
    }), [
      { actor: { side: "player", slot: 0 }, action: { ...attack,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: wait },
      { actor: { side: "opponent", slot: 0 }, action: wait },
      { actor: { side: "opponent", slot: 1 }, action: wait },
    ], { nextInt: () => 0 });
    expect(result.state.teams.player.activeIndices).toEqual([2, 1]);
    expect(result.state.teams.opponent.members[0]?.heldItem).toBeNull();
    expect(result.events).toContainEqual(expect.objectContaining({ type: "pokemonSwitched",
      side: "player", from: "attacker", to: "reserve", reason: "forced" }));
  });
});

describe("Eject Button choice in the shared combat engine", () => {
  const hit: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0, power: 40 };
  const fighter = (id: string, speed: number, item: BattlerState["heldItem"] = null): BattlerState => ({
    ...mon(id, item), stats: { ...mon(id).stats, maxHp: 200, speed }, hp: 200,
    moves: [{ move: hit, pp: 10 }],
  });
  const rng = { nextInt: () => 0 };

  it("requests the holder's choice, then replaces it before its queued single action", () => {
    const initial = createTeamBattleState({
      player: [fighter("attacker", 120)],
      opponent: [fighter("holder", 80, "EJECTBUTTON"), fighter("reserve", 70)],
    });
    const actions = { player: { kind: "move" as const, moveIndex: 0 },
      opponent: { kind: "move" as const, moveIndex: 0 } };
    expect(() => resolveTeamTurn(initial, actions, rng)).toThrow(ReactiveHeldSwitchChoiceRequired);
    const result = resolveTeamTurn(initial, actions, rng, undefined, undefined, { holder: 1 });
    expect(result.state.teams.opponent.activeIndex).toBe(1);
    expect(result.state.teams.opponent.members[0]?.heldItem).toBeNull();
    expect(result.events).toContainEqual(expect.objectContaining({ type: "pokemonSwitched",
      side: "opponent", from: "holder", to: "reserve", reason: "forced" }));
    expect(result.events.filter((event) => event.type === "moveUsed" && event.side === "opponent"))
      .toHaveLength(0);
  });

  it("switches only the hit slot in Duo after its owner selects a reserve", () => {
    const initial = createDoubleTeamBattleState({
      player: [fighter("attacker", 120), fighter("partner", 90)],
      opponent: [fighter("holder", 80, "EJECTBUTTON"), fighter("ally", 60), fighter("reserve", 70)],
    });
    const actions = [
      { actor: { side: "player" as const, slot: 0 }, action: { kind: "move" as const,
        moveIndex: 0, target: { side: "opponent" as const, slot: 0 } } },
      { actor: { side: "player" as const, slot: 1 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 0 }, action: { kind: "move" as const, moveIndex: 0 } },
      { actor: { side: "opponent" as const, slot: 1 }, action: { kind: "wait" as const } },
    ];
    expect(() => resolveDoubleTeamTurn(initial, actions, rng)).toThrow(ReactiveHeldSwitchChoiceRequired);
    const result = resolveDoubleTeamTurn(initial, actions, rng, undefined, undefined, { holder: 2 });
    expect(result.state.teams.opponent.activeIndices).toEqual([2, 1]);
    expect(result.state.teams.opponent.members[0]?.heldItem).toBeNull();
    expect(result.events).toContainEqual(expect.objectContaining({ type: "pokemonSwitched",
      side: "opponent", from: "holder", to: "reserve", reason: "forced" }));
    expect(result.events.filter((event) => event.type === "positionedActionResolved"
      && event.actor.side === "opponent" && event.actor.slot === 0)).toHaveLength(0);
  });

  it("replays the exact random prefix before the owner's choice", () => {
    const initial = createTeamBattleState({
      player: [fighter("attacker", 120)],
      opponent: [fighter("holder", 80, "EJECTBUTTON"), fighter("reserve", 70)],
    });
    const actions = { player: { kind: "move" as const, moveIndex: 0 },
      opponent: { kind: "wait" as const } };
    let physicalDraws = 0;
    const source = { nextInt: () => { physicalDraws += 1; return 0; } };
    const pending = attemptReactiveTurn(source, [], (draws) => resolveTeamTurn(initial,
      actions, draws));
    expect(pending.kind).toBe("choice-required");
    if (pending.kind !== "choice-required") return;
    const firstDrawCount = physicalDraws;
    const resumed = attemptReactiveTurn(source, pending.rolls, (draws) => resolveTeamTurn(initial,
      actions, draws, undefined, undefined, { holder: 1 }));
    expect(resumed.kind).toBe("resolved");
    expect(resumed.rolls.length).toBe(physicalDraws);
    expect(physicalDraws).toBeGreaterThanOrEqual(firstDrawCount);
    if (resumed.kind === "resolved") expect(resumed.result.state.teams.opponent.activeIndex).toBe(1);
  });
});
