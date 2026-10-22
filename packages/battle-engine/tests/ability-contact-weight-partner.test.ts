import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn,
  type BattleMove, type BattleSide, type BattlerState, type DoubleBattleEvent,
  type RandomSource } from "../src/index.js";

const lowRolls: RandomSource = { nextInt: () => 0 };
const highRolls: RandomSource = { nextInt: (maximum) => Math.max(0, maximum - 1) };

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  const source = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return {
    id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 240, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 240, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: { ...source, accuracy: 0 }, pp: source.pp }], ...overrides,
  };
}

function single(attacker: BattlerState, defender: BattlerState, rng: RandomSource = lowRolls) {
  return resolveTeamTurn(createTeamBattleState({ player: [attacker], opponent: [defender] }),
    { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, rng);
}

function innerEvents(events: readonly DoubleBattleEvent[]) {
  return events.flatMap((event) => event.type === "positionedActionResolved" ? event.events : []);
}

describe("Pokemon Z contact, effective weight and partner abilities", () => {
  it("applies Cute Charm after contact only to an eligible opposite-gender attacker", () => {
    const contact = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0, flags: "a" };
    const charmer = pokemon("charmer", "opponent", { ability: "CUTECHARM",
      appearance: { form: 0, shiny: false, gender: "female" } });
    const result = single(pokemon("attacker", "player", {
      appearance: { form: 0, shiny: false, gender: "male" }, moves: [{ move: contact, pp: contact.pp }],
    }), charmer);
    expect(result.state.teams.player.members[0]!.volatile?.infatuated).toBe(true);
    expect(result.events).toContainEqual({ type: "abilityActivated", side: "opponent",
      ability: "CUTECHARM", effect: "inflict-status" });

    for (const overrides of [
      { appearance: { form: 0, shiny: false, gender: "female" as const } },
      { ability: "OBLIVIOUS", appearance: { form: 0, shiny: false, gender: "male" as const } },
    ]) {
      const protectedResult = single(pokemon("protected", "player", { ...overrides,
        moves: [{ move: contact, pp: contact.pp }] }), charmer);
      expect(protectedResult.state.teams.player.members[0]!.volatile?.infatuated ?? false).toBe(false);
    }
  });

  it("uses Heavy Metal and Light Metal in both target- and ratio-based weight moves", () => {
    const lowKick: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "LOWKICK",
      name: "Balayette", functionCode: "09A", type: "FIGHTING", power: 1, accuracy: 0 };
    const heavySlam: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "HEAVYSLAM",
      name: "Tacle Lourd", functionCode: "09B", type: "STEEL", power: 1, accuracy: 0 };
    const attacker = pokemon("attacker", "player", { capture: { rate: 45, baseSpeed: 50, weight: 1_000 } });
    const target = pokemon("target", "opponent", { capture: { rate: 45, baseSpeed: 50, weight: 300 } });
    const damage = (user: BattlerState, defender: BattlerState, move: BattleMove) =>
      calculateDamage("player", user, defender, move, highRolls, []);

    const neutralKick = damage(attacker, target, lowKick);
    expect(damage(attacker, { ...target, ability: "HEAVYMETAL" }, lowKick)).toBeGreaterThan(neutralKick);
    expect(damage(attacker, { ...target, ability: "LIGHTMETAL" }, lowKick)).toBeLessThan(neutralKick);
    expect(damage({ ...attacker, ability: "MOLDBREAKER" }, { ...target, ability: "HEAVYMETAL" }, lowKick))
      .toBe(neutralKick);

    const neutralSlam = damage(attacker, target, heavySlam);
    expect(damage({ ...attacker, ability: "HEAVYMETAL" }, target, heavySlam)).toBeGreaterThan(neutralSlam);
    expect(damage({ ...attacker, ability: "LIGHTMETAL" }, target, heavySlam)).toBeLessThan(neutralSlam);
  });

  it("lets Healer cure only its active partner after the authoritative roll", () => {
    const state = createDoubleTeamBattleState({
      player: [pokemon("healer", "player", { ability: "HEALER" }),
        pokemon("partner", "player", { majorStatus: { kind: "burn" } })],
      opponent: [pokemon("foe-a", "opponent"), pokemon("foe-b", "opponent")],
    });
    const actions = [
      { actor: { side: "player" as const, slot: 0 }, action: { kind: "wait" as const } },
      { actor: { side: "player" as const, slot: 1 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 0 }, action: { kind: "wait" as const } },
      { actor: { side: "opponent" as const, slot: 1 }, action: { kind: "wait" as const } },
    ];
    const cured = resolveDoubleTeamTurn(state, actions, lowRolls);
    expect(cured.state.teams.player.members[1]!.majorStatus).toBeNull();
    expect(innerEvents(cured.events)).toContainEqual({ type: "abilityActivated", side: "player",
      ability: "HEALER", effect: "cure-status" });

    const failed = resolveDoubleTeamTurn(state, actions, highRolls);
    expect(failed.state.teams.player.members[1]!.majorStatus?.kind).toBe("burn");
  });

  it("adds Poison Puppeteer confusion only after poison was successfully applied", () => {
    const poison: BattleMove = { ...MINIMAL_MOVE_CATALOG.GROWL, internalName: "POISONTEST",
      name: "Poison", functionCode: "005", accuracy: 0 };
    const puppeteer = pokemon("puppeteer", "player", { ability: "POISONPUPPETEER",
      moves: [{ move: poison, pp: poison.pp }] });
    const result = single(puppeteer, pokemon("target", "opponent"));
    expect(result.state.teams.opponent.members[0]).toMatchObject({
      majorStatus: { kind: "poison" }, volatile: { confusionTurns: 2 },
    });
    expect(result.events).toContainEqual({ type: "abilityActivated", side: "player",
      ability: "POISONPUPPETEER", effect: "inflict-status" });

    const ownTempo = single(puppeteer, pokemon("tempo", "opponent", { ability: "OWNTEMPO" }));
    expect(ownTempo.state.teams.opponent.members[0]!.majorStatus?.kind).toBe("poison");
    expect(ownTempo.state.teams.opponent.members[0]!.volatile?.confusionTurns ?? 0).toBe(0);
    const immune = single(puppeteer, pokemon("steel", "opponent", { types: ["STEEL"] }));
    expect(immune.state.teams.opponent.members[0]!.majorStatus).toBeNull();
    expect(immune.state.teams.opponent.members[0]!.volatile?.confusionTurns ?? 0).toBe(0);
  });
});
