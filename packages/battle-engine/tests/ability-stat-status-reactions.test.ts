import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, resolveDoubleTeamTurn, resolveTurn,
  type BattleMove, type BattleSide, type BattleState, type BattlerState,
  type MajorStatusState, type RandomSource } from "../src/index.js";

const zeroRolls: RandomSource = { nextInt: () => 0 };

function battler(side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const move = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return {
    id: side, species: side === "player" ? "EEVEE" : "MEOWTH", name: side, level: 50,
    types: ["NORMAL"],
    stats: { maxHp: 240, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 240, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: { ...move, accuracy: 0 }, pp: move.pp }], ...overrides,
  };
}

function move(functionCode: BattleMove["functionCode"], overrides: Partial<BattleMove> = {}): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: `TEST${functionCode}`,
    name: `Test ${functionCode}`, functionCode, accuracy: 0, ...overrides };
}

function battle(player: BattlerState, opponent: BattlerState): BattleState {
  return { turn: 1, status: "active", winner: null, battlers: { player, opponent } };
}

describe("Pokemon Z shared stat and status ability reactions", () => {
  it("inverts self boosts and opposing drops with Contrary, using the inverted limit", () => {
    const boost = move("01C", { category: "Status", power: 0 });
    const self = resolveTurn(battle(
      battler("player", { ability: "CONTRARY", moves: [{ move: boost, pp: boost.pp }] }),
      battler("opponent")),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, zeroRolls);
    expect(self.state.battlers.player.stages.attack).toBe(-1);

    const growl = move("042", { category: "Status", power: 0 });
    const raised = resolveTurn(battle(
      battler("player", { moves: [{ move: growl, pp: growl.pp }] }),
      battler("opponent", { ability: "CONTRARY" })),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, zeroRolls);
    expect(raised.state.battlers.opponent.stages.attack).toBe(1);

    const capped = battler("opponent", { ability: "CONTRARY",
      stages: { ...battler("opponent").stages, attack: 6 } });
    const limited = resolveTurn(battle(
      battler("player", { moves: [{ move: growl, pp: growl.pp }] }), capped),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, zeroRolls);
    expect(limited.state.battlers.opponent.stages.attack).toBe(6);
    expect(limited.events).toContainEqual({ type: "statStageChangeFailed", source: "player",
      target: "opponent", stat: "attack", reason: "limit" });
  });

  it("lets opposing Mold Breaker bypass Contrary without disabling self changes", () => {
    const growl = move("042", { category: "Status", power: 0 });
    const result = resolveTurn(battle(
      battler("player", { ability: "MOLDBREAKER", moves: [{ move: growl, pp: growl.pp }] }),
      battler("opponent", { ability: "CONTRARY" })),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, zeroRolls);
    expect(result.state.battlers.opponent.stages.attack).toBe(-1);
  });

  it("adds one Toxic Spikes layer per damaging hit and stops at two", () => {
    const doubleHit = move("0BD", { internalName: "DOUBLEHIT", flags: "a", power: 35 });
    const result = resolveTurn(battle(
      battler("player", { moves: [{ move: doubleHit, pp: doubleHit.pp }] }),
      battler("opponent", { ability: "CAPATOXICA" })),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, zeroRolls);
    expect(result.state.effects?.sides.player.toxicSpikesLayers).toBe(2);
    expect(result.events.filter((event) => event.type === "abilityActivated"
      && event.ability === "CAPATOXICA")).toHaveLength(2);
  });

  it("lowers a contact attacker's evasion by two per hit through Olor Porcino", () => {
    const doubleHit = move("0BD", { internalName: "DOUBLEHIT", flags: "a", power: 35 });
    const result = resolveTurn(battle(
      battler("player", { moves: [{ move: doubleHit, pp: doubleHit.pp }] }),
      battler("opponent", { ability: "OLORPORCINO" })),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, zeroRolls);
    expect(result.state.battlers.player.stages.evasion).toBe(-4);
  });

  it("keeps both after-hit reactions on their exact positioned double targets", () => {
    const contact = move("000", { flags: "a", power: 20 });
    const state = createDoubleTeamBattleState({
      player: [battler("player", { moves: [{ move: contact, pp: contact.pp }] }),
        { ...battler("player", { ability: "CAPATOXICA" }), id: "player-capa" }],
      opponent: [battler("opponent", { ability: "OLORPORCINO" }),
        { ...battler("opponent", { moves: [{ move: contact, pp: contact.pp }] }), id: "opponent-hit" }],
    });
    const result = resolveDoubleTeamTurn(state, [
      { actor: { side: "player", slot: 0 }, action: { kind: "move", moveIndex: 0,
        target: { side: "opponent", slot: 0 } } },
      { actor: { side: "player", slot: 1 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 0 }, action: { kind: "wait" } },
      { actor: { side: "opponent", slot: 1 }, action: { kind: "move", moveIndex: 0,
        target: { side: "player", slot: 1 } } },
    ], zeroRolls);
    expect(result.state.teams.player.members.map((member) => member.stages.evasion)).toEqual([-2, 0]);
    expect(result.state.effects?.sides.opponent.toxicSpikesLayers).toBe(1);
  });

  it.each<MajorStatusState>([
    { kind: "sleep", turnsRemaining: 2 }, { kind: "poison", toxicCounter: 0 }, { kind: "burn" },
    { kind: "paralysis" }, { kind: "frozen" }, { kind: "caduco" }, { kind: "hemorrhage" },
  ])("cures Purifying Salt's $kind status at the authoritative turn boundary", (status) => {
    const result = resolveTurn(battle(battler("player", { ability: "PURIFYINGSALT", majorStatus: status }),
      battler("opponent")), { player: { kind: "move", moveIndex: 0 },
        opponent: { kind: "move", moveIndex: 0 } }, zeroRolls);
    expect(result.state.battlers.player.majorStatus).toBeNull();
  });

  it("blocks major status and Ghost damage, while Mold Breaker bypasses both defenses", () => {
    const poison = move("005", { category: "Status", power: 0 });
    const protectedTarget = battler("opponent", { ability: "PURIFYINGSALT", types: ["PSYCHIC"] });
    const blocked = resolveTurn(battle(
      battler("player", { moves: [{ move: poison, pp: poison.pp }] }), protectedTarget),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, zeroRolls);
    expect(blocked.state.battlers.opponent.majorStatus).toBeNull();

    const bypassed = resolveTurn(battle(
      battler("player", { ability: "MOLDBREAKER", moves: [{ move: poison, pp: poison.pp }] }), protectedTarget),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, zeroRolls);
    expect(bypassed.state.battlers.opponent.majorStatus).toEqual({ kind: "poison", toxicCounter: null });

    const ghost = move("000", { type: "GHOST", category: "Special", power: 80 });
    const neutral = calculateDamage("player", battler("player"),
      battler("opponent", { types: ["PSYCHIC"] }), ghost, zeroRolls, []);
    expect(calculateDamage("player", battler("player"), protectedTarget, ghost, zeroRolls, [])).toBeLessThan(neutral);
    expect(calculateDamage("player", battler("player", { ability: "MOLDBREAKER" }),
      protectedTarget, ghost, zeroRolls, [])).toBe(neutral);
  });

  it("keeps Purifying Salt's Mold Breaker context until delayed Yawn resolves", () => {
    const yawn = move("004", { category: "Status", power: 0 });
    const run = (ability: BattlerState["ability"]) => {
      const first = resolveTurn(battle(
        battler("player", { ability, moves: [{ move: yawn, pp: yawn.pp }] }),
        battler("opponent", { ability: "PURIFYINGSALT" })),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, zeroRolls);
      return resolveTurn(first.state,
        { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, zeroRolls);
    };
    expect(run(null).state.battlers.opponent.majorStatus).toBeNull();
    expect(run("MOLDBREAKER").state.battlers.opponent.majorStatus)
      .toEqual({ kind: "sleep", turnsRemaining: 2 });
  });
});
