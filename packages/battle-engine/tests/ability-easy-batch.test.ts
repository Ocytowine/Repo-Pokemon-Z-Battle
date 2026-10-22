import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, type BattleMove, type BattleSide, type BattleTrace,
  type BattlerState, type RandomSource } from "../src/index.js";

const highRolls: RandomSource = { nextInt: (maximum) => Math.max(0, maximum - 1) };

function activeTurns(value: number): NonNullable<BattlerState["volatile"]> {
  return { confusionTurns: 0, flinched: false, focusEnergy: 0, identified: false,
    disabledMove: null, disableTurns: 0, encoreMove: null, encoreTurns: 0,
    bindingMove: null, bindingTurns: 0, cursed: false, lastMoveUsed: null,
    activeTurns: value, enteredMidTurn: false, protected: false, endured: false, protectRate: 1,
    tauntTurns: 0, rage: false };
}

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const move = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return { id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 240, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 80 : 100 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 240, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move, pp: move.pp }], ...overrides };
}

function damage(attacker: BattlerState, move: BattleMove, terrain?: "grassy"): { value: number; trace: BattleTrace[] } {
  const trace: BattleTrace[] = [];
  const value = calculateDamage("player", attacker, pokemon("target", "opponent"), move, highRolls, trace,
    { reflect: false, lightScreen: false, luckyChant: false, mudSport: false, waterSport: false, terrain });
  return { value, trace };
}

function orderedFirst(player: BattlerState, opponent = pokemon("opponent", "opponent"),
  terrain?: "electric" | "grassy"): BattleSide {
  const initial = createTeamBattleState({ player: [player], opponent: [opponent] });
  const state = terrain === undefined ? initial : { ...initial, effects: {
    sides: {
      player: { reflectTurns: 0, luckyChantTurns: 0 },
      opponent: { reflectTurns: 0, luckyChantTurns: 0 },
    },
    waterSportTurns: 0, terrain, terrainTurns: 5,
  } };
  const result = resolveTeamTurn(state,
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, highRolls);
  const event = result.events.find((candidate) => candidate.type === "teamActionOrdered");
  if (event?.type !== "teamActionOrdered") throw new Error("Missing order event.");
  return event.order.find((action) => action.kind === "move")!.side;
}

describe("Pokemon Z easy ability batch", () => {
  it("applies Flare Boost and Toxic Boost only to their source status and category", () => {
    const special = { ...MINIMAL_MOVE_CATALOG.WATERGUN, type: "NORMAL" };
    const burned = pokemon("flare", "player", { ability: "FLAREBOOST", majorStatus: { kind: "burn" } });
    const flare = damage(burned, special);
    expect(flare.value).toBeGreaterThan(damage({ ...burned, ability: null }, special).value);
    expect(flare.trace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifiers: expect.arrayContaining([{ ability: "FLAREBOOST", multiplier: 1.5 }]) }));
    expect(damage(burned, MINIMAL_MOVE_CATALOG.TACKLE).trace)
      .toContainEqual(expect.objectContaining({ type: "damage", abilityModifiers: [] }));

    const poisoned = pokemon("toxic", "player", { ability: "TOXICBOOST",
      majorStatus: { kind: "poison", toxicCounter: null } });
    const toxic = damage(poisoned, MINIMAL_MOVE_CATALOG.TACKLE);
    expect(toxic.value).toBeGreaterThan(damage({ ...poisoned, ability: null }, MINIMAL_MOVE_CATALOG.TACKLE).value);
    expect(toxic.trace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifiers: expect.arrayContaining([{ ability: "TOXICBOOST", multiplier: 1.5 }]) }));
    expect(damage(poisoned, special).trace)
      .toContainEqual(expect.objectContaining({ type: "damage", abilityModifiers: [] }));
  });

  it("keeps Slow Start's physical and Speed penalties through active turn 5 only", () => {
    const slow = pokemon("slow", "player", { ability: "SLOWSTART",
      volatile: activeTurns(5) });
    const penalized = damage(slow, MINIMAL_MOVE_CATALOG.TACKLE);
    const released = damage({ ...slow, volatile: activeTurns(6) }, MINIMAL_MOVE_CATALOG.TACKLE);
    expect(penalized.value).toBeLessThan(released.value);
    expect(penalized.trace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifiers: expect.arrayContaining([{ ability: "SLOWSTART", multiplier: 0.5 }]) }));
    expect(orderedFirst({ ...slow, stats: { ...slow.stats, speed: 150 } })).toBe("opponent");
    expect(orderedFirst({ ...slow, stats: { ...slow.stats, speed: 150 }, volatile: activeTurns(6) })).toBe("player");
  });

  it("resets Slow Start when its user leaves and re-enters battle", () => {
    const slow = pokemon("slow", "player", { ability: "SLOWSTART", volatile: activeTurns(6) });
    const reserve = pokemon("reserve", "player");
    const first = createTeamBattleState({ player: [slow, reserve], opponent: [pokemon("foe", "opponent")] });
    const switchedOut = resolveTeamTurn(first,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" } }, highRolls);
    const returned = resolveTeamTurn(switchedOut.state,
      { player: { kind: "switch", teamIndex: 0 }, opponent: { kind: "wait" } }, highRolls);
    // The returning battler starts at zero, then the completed switch turn advances it to one.
    expect(returned.state.teams.player.members[0]!.volatile?.activeTurns).toBe(1);
    expect(orderedFirst({ ...returned.state.teams.player.members[0]!,
      stats: { ...slow.stats, speed: 150 } })).toBe("opponent");
  });

  it("uses Electric and Grassy Terrain for Surge Surfer and Silvano in shared ordering", () => {
    expect(orderedFirst(pokemon("surfer", "player", { ability: "SURGESURFER",
      stats: { ...pokemon("surfer", "player").stats, speed: 60 } }), undefined, "electric")).toBe("player");
    const silvano = pokemon("silvano", "player", { ability: "SILVANO" });
    expect(orderedFirst(silvano, undefined, "grassy")).toBe("player");
    expect(orderedFirst(silvano)).toBe("opponent");
    const boosted = damage(silvano, MINIMAL_MOVE_CATALOG.TACKLE, "grassy");
    expect(boosted.value).toBeGreaterThan(damage({ ...silvano, ability: null }, MINIMAL_MOVE_CATALOG.TACKLE, "grassy").value);
    expect(boosted.trace).toContainEqual(expect.objectContaining({ type: "damage",
      abilityModifiers: expect.arrayContaining([{ ability: "SILVANO", multiplier: 1.3 }]) }));
  });

  it.each([["MISTYSURGE", "misty"], ["PSYCHICSURGE", "psychic"]] as const)(
    "%s sets %s Terrain in singles and positioned doubles", (ability, terrain) => {
      const single = createTeamBattleState({ player: [pokemon("setter", "player", { ability })],
        opponent: [pokemon("foe", "opponent")] });
      expect(single.effects).toMatchObject({ terrain, terrainTurns: 5 });
      const double = createDoubleTeamBattleState({
        player: [pokemon("setter", "player", { ability }), pokemon("ally", "player")],
        opponent: [pokemon("foe-a", "opponent"), pokemon("foe-b", "opponent")],
      });
      expect(double.effects).toMatchObject({ terrain, terrainTurns: 5 });
    });

  it.each(["TERAVOLT", "TURBOBLAZE"] as const)("lets %s share Mold Breaker's bypass contract", (ability) => {
    const ground = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "EARTHQUAKE", type: "GROUND" };
    const levitating = pokemon("target", "opponent", { ability: "LEVITATE", types: ["ELECTRIC"] });
    expect(calculateDamage("player", pokemon("user", "player"), levitating, ground, highRolls, [])).toBe(0);
    expect(calculateDamage("player", pokemon("user", "player", { ability }), levitating, ground, highRolls, []))
      .toBeGreaterThan(0);
  });

  it("gives every Flying move Gale Wings priority in singles and positioned doubles", () => {
    const flying = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "WINGATTACK", type: "FLYING" };
    const gale = pokemon("gale", "player", { ability: "GALEWINGS",
      stats: { ...pokemon("gale", "player").stats, speed: 40 }, moves: [{ move: flying, pp: flying.pp }] });
    const fast = pokemon("fast", "opponent", { stats: { ...pokemon("fast", "opponent").stats, speed: 200 } });
    expect(orderedFirst(gale, fast)).toBe("player");
    expect(orderedFirst({ ...gale, moves: [{ move: MINIMAL_MOVE_CATALOG.TACKLE,
      pp: MINIMAL_MOVE_CATALOG.TACKLE.pp }] }, fast)).toBe("opponent");

    const state = createDoubleTeamBattleState({ player: [gale, pokemon("ally", "player")],
      opponent: [fast, pokemon("foe-ally", "opponent")] });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 0 } } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], highRolls);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "teamActionOrdered",
      order: expect.arrayContaining([]) }));
    const order = result.events.find((event) => event.type === "teamActionOrdered");
    expect(order?.type === "teamActionOrdered" ? order.order.filter((action) => action.kind === "move")[0]?.side : null)
      .toBe("player");
  });
});
