import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createDoubleTeamBattleState, createTeamBattleState, resolveDoubleTeamTurn,
  resolveTeamTurn, resolveTurn, type BattleEffects, type BattleMove, type BattleSide, type BattlerState,
  type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: () => 0 };

function pokemon(id: string, side: BattleSide, speed = 80, overrides: Partial<BattlerState> = {}): BattlerState {
  const source = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return {
    id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 120, attack: 90, defense: 80, specialAttack: 90, specialDefense: 80, speed },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 120, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: { ...source, accuracy: 0 }, pp: source.pp }], ...overrides,
  };
}

function windMove(): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "GUST", name: "Tornade",
    functionCode: "000", type: "FLYING", category: "Special", power: 40, accuracy: 0 };
}

function tailwind(): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.GROWL, internalName: "TAILWIND", name: "Vent Arrière",
    functionCode: "05B", type: "FLYING", category: "Status", power: 0, accuracy: 0, targetCode: "40" };
}

function effects(playerTailwind = 0): BattleEffects {
  return { sides: {
    player: { reflectTurns: 0, luckyChantTurns: 0, tailwindTurns: playerTailwind },
    opponent: { reflectTurns: 0, luckyChantTurns: 0 },
  }, waterSportTurns: 0 };
}

describe("Wind Rider, Wind Power and Tailwind", () => {
  it("lets Wind Rider absorb an exact source wind move and raise Attack even through Mold Breaker", () => {
    const move = windMove();
    const attacker = pokemon("attacker", "player", 100, { ability: "MOLDBREAKER",
      moves: [{ move, pp: move.pp }] });
    const rider = pokemon("rider", "opponent", 80, { ability: "WINDRIDER" });
    const result = resolveTeamTurn(createTeamBattleState({ player: [attacker], opponent: [rider] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);

    expect(result.state.teams.opponent.members[0]).toMatchObject({ hp: 120, stages: { attack: 1 } });
    expect(result.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "WINDRIDER", effect: "block-move" });
    expect(result.events.some((event) => event.type === "damageApplied")).toBe(false);
  });

  it("arms Wind Power before the incoming wind damage without absorbing that move", () => {
    const move = windMove();
    const attacker = pokemon("attacker", "player", 100, { moves: [{ move, pp: move.pp }] });
    const powered = pokemon("powered", "opponent", 80, { ability: "WINDPOWER" });
    const result = resolveTeamTurn(createTeamBattleState({ player: [attacker], opponent: [powered] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);

    expect(result.state.teams.opponent.members[0]!.hp).toBeLessThan(120);
    expect(result.state.teams.opponent.members[0]!.volatile?.chargeTurns).toBe(1);
    expect(result.events).toContainEqual({ type: "volatileApplied", source: "opponent", target: "opponent",
      effect: "charge", turns: 2, move: null });
  });

  it("stores Tailwind on the side and uses it in the shared action order", () => {
    const move = tailwind();
    const setter = pokemon("setter", "player", 40, { moves: [{ move, pp: move.pp }] });
    const target = pokemon("target", "opponent", 70);
    const first = resolveTeamTurn(createTeamBattleState({ player: [setter], opponent: [target] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
    expect(first.state.effects?.sides.player.tailwindTurns).toBe(3);
    expect(first.events).toContainEqual({ type: "battleEffectChanged", side: "player",
      effect: "tailwind", turns: 4 });

    const ordered = resolveTurn({ turn: 2, status: "active", winner: null,
      battlers: { player: setter, opponent: target }, effects: effects(2) },
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, rng);
    expect(ordered.events).toContainEqual({ type: "actionOrdered", order: ["player", "opponent"] });
  });

  it("activates both allied wind talents when Tailwind is selected in a double battle", () => {
    const move = tailwind();
    const setter = pokemon("setter", "player", 100, { ability: "WINDPOWER",
      moves: [{ move, pp: move.pp }] });
    const partner = pokemon("partner", "player", 90, { ability: "WINDRIDER" });
    const state = createDoubleTeamBattleState({ player: [setter, partner],
      opponent: [pokemon("enemy-a", "opponent"), pokemon("enemy-b", "opponent")] });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0 } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "wait" } },
    ], rng);

    expect(result.state.teams.player.members[0]!.volatile?.chargeTurns).toBe(1);
    expect(result.state.teams.player.members[1]!.stages.attack).toBe(1);
    expect(result.state.effects?.sides.player.tailwindTurns).toBe(3);
  });

  it("raises an entering Wind Rider while its side still has Tailwind", () => {
    const lead = pokemon("lead", "player");
    const rider = pokemon("rider", "player", 60, { ability: "WINDRIDER" });
    const initial = { ...createTeamBattleState({ player: [lead, rider],
      opponent: [pokemon("enemy", "opponent")] }), effects: effects(2) };
    const result = resolveTeamTurn(initial,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" } }, rng);
    expect(result.state.teams.player.members[1]!.stages.attack).toBe(1);
  });
});
