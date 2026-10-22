import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createTeamBattleState, resolveTeamTurn, resolveTurn,
  type BattleMove, type BattleSide, type BattleState, type BattlerState, type RandomSource } from "../src/index.js";
import { colorChangeType, knockoutAbilityStatReaction } from "../src/ability-after-hit.js";

class ScriptedRandom implements RandomSource {
  private index = 0;

  public constructor(private readonly values: readonly number[]) {}

  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index++];
    if (value === undefined || value < 0 || value >= maxExclusive) {
      throw new Error(`Missing or invalid scripted RNG value for nextInt(${maxExclusive}).`);
    }
    return value;
  }
}

function battler(side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const move = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.GROWL;
  return {
    id: side, species: side === "player" ? "EEVEE" : "MEOWTH", name: side, level: 50,
    types: ["NORMAL"],
    stats: { maxHp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 100 : 90 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0,
      accuracy: 0, evasion: 0 },
    hp: 100, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move, pp: move.pp }], ...overrides,
  };
}

function battle(player: BattlerState, opponent: BattlerState): BattleState {
  return { turn: 1, status: "active", winner: null, battlers: { player, opponent } };
}

function damagingMove(overrides: Partial<BattleMove> = {}): BattleMove {
  return { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0, flags: "a", ...overrides };
}

describe("reactive after-hit abilities", () => {
  it("raises Justified after each damaging Dark hit", () => {
    const dark = damagingMove({ internalName: "DOUBLEHIT", name: "Coup Double", type: "DARK",
      functionCode: "0BD" });
    const player = battler("player", { moves: [{ move: dark, pp: dark.pp }] });
    const opponent = battler("opponent", { ability: "JUSTIFIED" });
    const result = resolveTurn(battle(player, opponent),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([1, 15, 1, 15, 0]));

    expect(result.state.battlers.opponent.stages.attack).toBe(2);
    expect(result.events.filter((event) => event.type === "abilityActivated"
      && event.ability === "JUSTIFIED")).toHaveLength(2);
  });

  it("replaces Color Change types after damage and ignores an already held or pseudo type", () => {
    const water = damagingMove({ internalName: "AQUAJET", name: "Aqua-Jet", type: "WATER" });
    const player = battler("player", { moves: [{ move: water, pp: water.pp }] });
    const opponent = battler("opponent", { ability: "COLORCHANGE", types: ["FIRE", "FLYING"], hp: 200,
      stats: { ...battler("opponent").stats, maxHp: 200 } });
    const result = resolveTurn(battle(player, opponent),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([1, 15, 0]));

    expect(result.state.battlers.opponent.types).toEqual(["WATER"]);
    expect(result.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "COLORCHANGE", effect: "change-type" });
    expect(colorChangeType({ ...opponent, types: ["WATER"] }, "WATER")).toBeNull();
    expect(colorChangeType(opponent, "QMARKS")).toBeNull();
  });

  it("restores Color Change's original types when its user switches out", () => {
    const water = damagingMove({ internalName: "AQUAJET", name: "Aqua-Jet", type: "WATER" });
    const player = battler("player", { moves: [{ move: water, pp: water.pp }] });
    const changed = battler("opponent", { ability: "COLORCHANGE", types: ["FIRE", "FLYING"] });
    const reserve = battler("opponent", { id: "reserve", species: "KECLEON" });
    const initial = createTeamBattleState({ player: [player], opponent: [changed, reserve] });
    const hit = resolveTeamTurn(initial,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } },
      new ScriptedRandom([1, 15]));
    expect(hit.state.teams.opponent.members[0]?.types).toEqual(["WATER"]);

    const switched = resolveTeamTurn(hit.state,
      { player: { kind: "wait" }, opponent: { kind: "switch", teamIndex: 1 } },
      new ScriptedRandom([]));
    expect(switched.state.teams.opponent.members[0]?.types).toEqual(["FIRE", "FLYING"]);
    expect(switched.state.teams.opponent.members[0]?.volatile).toBeUndefined();
  });

  it("raises Moxie's Attack once after the move knocks out its target", () => {
    const move = damagingMove();
    const player = battler("player", { ability: "MOXIE", moves: [{ move, pp: move.pp }] });
    const opponent = battler("opponent", { hp: 1 });
    const result = resolveTurn(battle(player, opponent),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([1, 15]));

    expect(result.state.battlers.player.stages.attack).toBe(1);
    expect(result.events).toContainEqual({ type: "abilityActivated", side: "player",
      ability: "MOXIE", effect: "raise-stat" });
    expect(knockoutAbilityStatReaction({ ...player, hp: 0 })).toBeNull();
  });

  it("gives Brutalidad its source 50% contact chance and respects hemorrhage immunity", () => {
    const move = damagingMove();
    const player = battler("player", { ability: "BRUTALIDAD", moves: [{ move, pp: move.pp }] });
    const result = resolveTurn(battle(player, battler("opponent")),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([1, 15, 4, 0]));
    expect(result.state.battlers.opponent.majorStatus).toEqual({ kind: "hemorrhage" });
    expect(result.events).toContainEqual({ type: "abilityActivated", side: "player",
      ability: "BRUTALIDAD", effect: "inflict-status" });

    const immune = resolveTurn(battle(player, battler("opponent", { types: ["FIRE"] })),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([1, 15, 0]));
    expect(immune.state.battlers.opponent.majorStatus).toBeNull();
  });

  it("raises Thermal Exchange per Fire hit and prevents burns", () => {
    const fire = damagingMove({ internalName: "DOUBLEFIRE", name: "Double Feu", type: "FIRE",
      functionCode: "0BD" });
    const player = battler("player", { moves: [{ move: fire, pp: fire.pp }] });
    const opponent = battler("opponent", { ability: "TERMOCONVERSION" });
    const hit = resolveTurn(battle(player, opponent),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([1, 15, 1, 15, 0]));
    expect(hit.state.battlers.opponent.stages.attack).toBe(2);
    expect(hit.events.filter((event) => event.type === "abilityActivated"
      && event.ability === "TERMOCONVERSION")).toHaveLength(2);

    const burn = { ...MINIMAL_MOVE_CATALOG.WILLOWISP, accuracy: 0 };
    const protectedState = createTeamBattleState({
      player: [battler("player", { moves: [{ move: burn, pp: burn.pp }] })],
      opponent: [opponent],
    });
    const protectedResult = resolveTeamTurn(protectedState,
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(protectedResult.state.teams.opponent.members[0]?.majorStatus).toBeNull();
    expect(protectedResult.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "TERMOCONVERSION", effect: "prevent-status" });

    const cured = resolveTeamTurn(createTeamBattleState({ player: [battler("player")],
      opponent: [{ ...opponent, majorStatus: { kind: "burn" } }] }),
    { player: { kind: "wait" }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(cured.state.teams.opponent.members[0]?.majorStatus).toBeNull();
    expect(cured.events).toContainEqual({ type: "statusCured", side: "opponent", status: "burn" });
  });

  it("lets Baked Body absorb Fire and raise Defense by two unless Mold Breaker bypasses it", () => {
    const fire = damagingMove({ internalName: "FIREPUNCH", name: "Poing Feu", type: "FIRE" });
    const defender = battler("opponent", { ability: "CUERPOHORNEADO" });
    const absorbed = resolveTeamTurn(createTeamBattleState({
      player: [battler("player", { moves: [{ move: fire, pp: fire.pp }] })], opponent: [defender],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(absorbed.state.teams.opponent.members[0]).toMatchObject({ hp: 100, stages: { defense: 2 } });
    expect(absorbed.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "CUERPOHORNEADO", effect: "absorb-type" });

    const bypassed = resolveTeamTurn(createTeamBattleState({
      player: [battler("player", { ability: "MOLDBREAKER", moves: [{ move: fire, pp: fire.pp }] })],
      opponent: [defender],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } },
    new ScriptedRandom([1, 15]));
    expect(bypassed.state.teams.opponent.members[0]?.hp).toBeLessThan(100);
    expect(bypassed.state.teams.opponent.members[0]?.stages.defense).toBe(0);
  });

  it("temporarily replaces a contact attacker's ability with Mummy and restores it on switch", () => {
    const contact = damagingMove();
    const attacker = battler("player", { ability: "HUSTLE", moves: [{ move: contact, pp: contact.pp }] });
    const reserve = battler("player", { id: "reserve", species: "PIKACHU" });
    const mummy = battler("opponent", { ability: "MUMMY" });
    const hit = resolveTeamTurn(createTeamBattleState({ player: [attacker, reserve], opponent: [mummy] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } },
      new ScriptedRandom([1, 15]));
    expect(hit.state.teams.player.members[0]).toMatchObject({ ability: "MUMMY",
      volatile: { originalAbility: "HUSTLE" } });
    expect(hit.events).toContainEqual({ type: "abilityChanged", source: "opponent", target: "player",
      ability: "MUMMY", move: "TACKLE" });

    const switched = resolveTeamTurn(hit.state,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(switched.state.teams.player.members[0]?.ability).toBe("HUSTLE");
    expect(switched.state.teams.player.members[0]?.volatile).toBeUndefined();

    for (const ability of ["MULTITYPE", "DISGUISE", "STANCECHANGE", "MUMMY"]) {
      const excluded = battler("player", { ability, moves: [{ move: contact, pp: contact.pp }] });
      const unchanged = resolveTeamTurn(createTeamBattleState({ player: [excluded], opponent: [mummy] }),
        { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } },
        new ScriptedRandom([1, 15]));
      expect(unchanged.state.teams.player.members[0]?.ability).toBe(ability);
    }

    const abilityless = battler("player", { ability: null, moves: [{ move: contact, pp: contact.pp }] });
    const replacedAbilityless = resolveTeamTurn(createTeamBattleState({
      player: [abilityless, reserve], opponent: [mummy],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } },
    new ScriptedRandom([1, 15]));
    const restoredAbilityless = resolveTeamTurn(replacedAbilityless.state,
      { player: { kind: "switch", teamIndex: 1 }, opponent: { kind: "wait" } }, new ScriptedRandom([]));
    expect(restoredAbilityless.state.teams.player.members[0]?.ability).toBeNull();
  });

  it("raises Grim Neigh's Special Attack after a knockout", () => {
    const move = damagingMove();
    const player = battler("player", { ability: "GRIMNEIGH", moves: [{ move, pp: move.pp }] });
    const result = resolveTurn(battle(player, battler("opponent", { hp: 1 })),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } },
      new ScriptedRandom([1, 15]));
    expect(result.state.battlers.player.stages.specialAttack).toBe(1);
    expect(result.events).toContainEqual({ type: "abilityActivated", side: "player",
      ability: "GRIMNEIGH", effect: "raise-stat" });
  });
});
