import { describe, expect, it } from "vitest";
import { calculateDamage, createTeamBattleState, resolveTeamTurn,
  type BattleMove, type BattleSide, type BattleTrace, type BattlerState,
  type RandomSource } from "../src/index.js";

const random: RandomSource = { nextInt: (max) => max - 1 };
const base: BattleMove = { id: 1, internalName: "TESTMOVE", name: "Test",
  functionCode: "000", power: 80, type: "NORMAL", category: "Physical", accuracy: 0,
  pp: 20, priority: 0, effectChance: 0 };

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 1000, attack: 100, defense: 100, specialAttack: 100,
      specialDefense: 100, speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 1000, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: base, pp: 20 }], ...overrides };
}

const damage = (user: BattlerState, foe: BattlerState, move: BattleMove = base) =>
  calculateDamage("player", user, foe, move, random, []);

describe("Pokemon Z's held combat items", () => {
  it.each([
    ["ARMAZONDEFAUCES", "i", "BITE", 1.2],
    ["CANONDEMANO", "m", "WATERPULSE", 1.3],
    ["FUELLENEUMATICO", "", "GUST", 1.5],
    ["ESPADAVALIENTE", "", "SLASH", 1.3],
  ] as const)("boosts the correct move class with %s", (item, flags, name, multiplier) => {
    const move = { ...base, internalName: name, flags };
    const user = pokemon("user", "player", { heldItem: item });
    const foe = pokemon("foe", "opponent");
    const trace: BattleTrace[] = [];
    calculateDamage("player", user, foe, move, random, trace);
    const hit = trace.find((entry) => entry.type === "damage");
    expect(hit).toMatchObject({ statusModifier: expect.closeTo(multiplier, 5) });
    expect(damage(user, foe, move)).toBeGreaterThan(damage({ ...user, heldItem: null }, foe, move));
    expect(damage(user, foe, base)).toBe(damage({ ...user, heldItem: null }, foe, base));
  });

  it("gives Kricketune the larger cutting bonus", () => {
    const slash = { ...base, internalName: "SLASH" };
    const user = pokemon("user", "player", { heldItem: "ESPADAVALIENTE" });
    const foe = pokemon("foe", "opponent");
    expect(damage({ ...user, species: "KRICKETUNE" }, foe, slash))
      .toBeGreaterThan(damage(user, foe, slash));
  });

  it("adds a critical stage for biting moves with Fang Armor", () => {
    const bite = { ...base, internalName: "BITE", flags: "i" };
    const trace: BattleTrace[] = [];
    calculateDamage("player", pokemon("user", "player", { heldItem: "ARMAZONDEFAUCES" }),
      pokemon("foe", "opponent"), bite, random, trace);
    expect(trace).toContainEqual(expect.objectContaining({ type: "rng", purpose: "critical",
      maxExclusive: 8 }));
  });

  it.each(["ARMAZONDEFAUCES", "KINGSROCK", "RAZORFANG"] as const)(
    "uses the King's Rock flag to flinch with %s", (item) => {
      const bite = { ...base, internalName: "BITE", flags: "fi", power: 20 };
      const attacker = pokemon("user", "player", { heldItem: item,
        moves: [{ move: bite, pp: 20 }] });
      const foe = pokemon("foe", "opponent");
      const actions = { player: { kind: "move" as const, moveIndex: 0 },
        opponent: { kind: "wait" as const } };
      const activated = resolveTeamTurn(createTeamBattleState({ player: [attacker],
        opponent: [foe] }), actions, { nextInt: () => 0 });
      expect(activated.events).toContainEqual(expect.objectContaining({ type: "volatileApplied",
        source: "player", target: "opponent", effect: "flinch" }));
      const noFlag = resolveTeamTurn(createTeamBattleState({ player: [{ ...attacker,
        moves: [{ move: { ...bite, flags: "i" }, pp: 20 }] }], opponent: [foe] }),
      actions, { nextInt: () => 0 });
      expect(noFlag.events.some((event) => event.type === "volatileApplied"
        && event.effect === "flinch")).toBe(false);
    });

  it("uses Anti-Critico before a forced critical, except under Mold Breaker", () => {
    const forced = { ...base, functionCode: "0A0" as const };
    const foe = pokemon("foe", "opponent", { heldItem: "ANTICRITICO" });
    const trace: BattleTrace[] = [];
    calculateDamage("player", pokemon("user", "player"), foe, forced, random, trace);
    expect(trace).toContainEqual(expect.objectContaining({ type: "damage", critical: false }));
    const bypass: BattleTrace[] = [];
    calculateDamage("player", pokemon("user", "player", { ability: "MOLDBREAKER" }),
      foe, forced, random, bypass);
    expect(bypass).toContainEqual(expect.objectContaining({ type: "damage", critical: true }));
  });

  it("makes Coraza Asalto block status moves and multiply special defense", () => {
    const status = { ...base, functionCode: "027" as const, power: 0,
      category: "Status" as const };
    const user = pokemon("user", "player", { heldItem: "CORAZAASALTO",
      moves: [{ move: status, pp: 20 }] });
    const foe = pokemon("foe", "opponent");
    const blocked = resolveTeamTurn(createTeamBattleState({ player: [user], opponent: [foe] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, random);
    expect(blocked.events).toContainEqual({ type: "actionSkipped", side: "player",
      reason: "item-blocked" });
    const defender = { ...foe, heldItem: "CORAZAASALTO" };
    const special = { ...base, category: "Special" as const };
    expect(damage(user, defender, special)).toBeLessThan(damage(user, foe, special));
    expect(damage(user, defender, base)).toBe(damage(user, foe, base));
  });

  it("boosts critical hits with Blood Ring and status hits with Cruel Mask", () => {
    const forced = { ...base, functionCode: "0A0" as const };
    const user = pokemon("user", "player", { heldItem: "ANILLODESANGRE" });
    const foe = pokemon("foe", "opponent");
    expect(damage(user, foe, forced)).toBeGreaterThan(damage({ ...user, heldItem: null }, foe, forced));
    expect(damage(user, foe, base)).toBe(damage({ ...user, heldItem: null }, foe, base));
    const mask = { ...user, heldItem: "MASCARACRUEL" };
    const poisoned = { ...foe, majorStatus: { kind: "poison" as const, toxicCounter: null } };
    expect(damage(mask, poisoned)).toBeGreaterThan(damage({ ...mask, heldItem: null }, poisoned));
    expect(damage(mask, foe)).toBe(damage({ ...mask, heldItem: null }, foe));
    const caduco = { ...foe, majorStatus: { kind: "caduco" as const } };
    expect(damage(mask, caduco)).toBe(damage({ ...mask, heldItem: null }, caduco));
  });

  it("halves a super-effective Fairy hit with Roseli Berry and consumes it", () => {
    const fairy = { ...base, type: "FAIRY" };
    const attacker = pokemon("user", "player", { moves: [{ move: fairy, pp: 20 }] });
    const foe = pokemon("foe", "opponent", { types: ["DARK"], heldItem: "ROSELIBERRY" });
    expect(damage(attacker, foe, fairy)).toBeLessThan(damage(attacker, { ...foe, heldItem: null }, fairy));
    const result = resolveTeamTurn(createTeamBattleState({ player: [attacker], opponent: [foe] }),
      { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, random);
    expect(result.state.teams.opponent.members[0]!.heldItem).toBeNull();
    expect(result.events).toContainEqual(expect.objectContaining({ type: "heldItemConsumed",
      side: "opponent", item: "ROSELIBERRY", effect: "weaken" }));
  });

  it.each([
    ["PUNZASFERA", "hemorrhage"], ["FLAMEORB", "burn"],
    ["TOXICORB", "poison"],
  ] as const)("applies %s's status at the end of the turn", (item, status) => {
    const user = pokemon("user", "player", { heldItem: item });
    const result = resolveTeamTurn(createTeamBattleState({ player: [user],
      opponent: [pokemon("foe", "opponent")] }),
    { player: { kind: "wait" }, opponent: { kind: "wait" } }, random);
    expect(result.state.teams.player.members[0]!.majorStatus?.kind).toBe(status);
    expect(result.state.teams.player.members[0]!.heldItem).toBe(item);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "itemActivated",
      side: "player", item, effect: "status" }));
    const blocked = resolveTeamTurn({ ...createTeamBattleState({ player: [user],
      opponent: [pokemon("foe", "opponent")] }), effects: { sides: {
        player: { reflectTurns: 0, luckyChantTurns: 0 },
        opponent: { reflectTurns: 0, luckyChantTurns: 0 } },
      waterSportTurns: 0, magicRoomTurns: 2 } },
    { player: { kind: "wait" }, opponent: { kind: "wait" } }, random);
    expect(blocked.state.teams.player.members[0]!.majorStatus).toBeNull();
  });

  it("does not give Hemorrhage to a Fire-type Punzasfera holder", () => {
    const user = pokemon("user", "player", { heldItem: "PUNZASFERA", types: ["FIRE"] });
    const result = resolveTeamTurn(createTeamBattleState({ player: [user],
      opponent: [pokemon("foe", "opponent")] }),
    { player: { kind: "wait" }, opponent: { kind: "wait" } }, random);
    expect(result.state.teams.player.members[0]!.majorStatus).toBeNull();
  });
});
