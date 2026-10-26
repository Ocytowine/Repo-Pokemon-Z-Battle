import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, calculateDamage, createDoubleTeamBattleState, createTeamBattleState,
  resolveDoubleTeamTurn, resolveTeamTurn, transformBattler, restoreTransformedBattler,
  type BattleSide, type BattlerState, type RandomSource } from "../src/index.js";

const rng: RandomSource = { nextInt: () => 0 };
const move = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0 };
function mon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: id.toUpperCase(), name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 500, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 80 : 100 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 }, hp: 500, majorStatus: null, ability: null,
    heldItem: null, moves: [{ move, pp: 10 }], ...overrides };
}
const context = { reflect: false, lightScreen: false, luckyChant: false,
  mudSport: false, waterSport: false };
function damage(attacker: BattlerState, defender: BattlerState, magicRoomTurns = 0): number {
  return calculateDamage("player", attacker, defender, move, rng, [], { ...context, magicRoomTurns });
}
function firstSide(player: BattlerState, magicRoomTurns = 0): BattleSide | undefined {
  const start = createTeamBattleState({ player: [player], opponent: [mon("foe", "opponent")] });
  const effects = { sides: { player: { reflectTurns: 0, luckyChantTurns: 0 },
    opponent: { reflectTurns: 0, luckyChantTurns: 0 } }, waterSportTurns: 0, magicRoomTurns };
  const turn = resolveTeamTurn({ ...start, effects }, {
    player: { kind: "move", moveIndex: 0 }, opponent: { kind: "move", moveIndex: 0 } }, rng);
  return turn.events.find((event) => event.type === "teamActionOrdered")?.order[0]?.side;
}

describe("objets de statistiques propres à Z", () => {
  it("applies all three Super Eviolite hooks only to a two-step evolution species", () => {
    const base = mon("basic", "player", { canEvolve: true, canEvolveTwice: true });
    const superUser = { ...base, heldItem: "SUPEREVIOLITE" };
    const target = mon("target", "opponent");
    expect(firstSide(base)).toBe("opponent");
    expect(firstSide(superUser)).toBe("player");
    expect(damage(superUser, target)).toBeGreaterThan(damage(base, target));
    expect(damage(target, superUser)).toBeLessThan(damage(target, base));
    expect(firstSide(superUser, 2)).toBe("opponent");
    expect(damage(superUser, target, 2)).toBe(damage(base, target));
    expect(damage(target, superUser, 2)).toBe(damage(target, base));
    const oneStep = { ...superUser, canEvolveTwice: false };
    expect(firstSide(oneStep)).toBe("opponent");
    expect(damage(oneStep, target)).toBe(damage(base, target));
    expect(damage(target, oneStep)).toBe(damage(target, base));
  });

  it("applies Tabla Esqui's speed and damage only to Bibarel", () => {
    const bibarel = mon("bibarel", "player", { heldItem: "TABLAESQUI" });
    const target = mon("target", "opponent");
    expect(firstSide(bibarel)).toBe("player");
    expect(damage(bibarel, target)).toBeGreaterThan(damage({ ...bibarel, heldItem: null }, target));
    expect(firstSide(bibarel, 2)).toBe("opponent");
    expect(damage(bibarel, target, 2)).toBe(damage({ ...bibarel, heldItem: null }, target));
    const other = { ...bibarel, species: "EEVEE" };
    expect(firstSide(other)).toBe("opponent");
    expect(damage(other, target)).toBe(damage({ ...other, heldItem: null }, target));
  });

  it("uses these public species facts in doubles and restores them after Transform", () => {
    const user = mon("basic", "player", { heldItem: "SUPEREVIOLITE", canEvolveTwice: true });
    const start = createDoubleTeamBattleState({ player: [user], opponent: [mon("foe", "opponent")] });
    const actions = [
      { actor: { side: "player" as const, slot: 0 }, action: { kind: "move" as const, moveIndex: 0 } },
      { actor: { side: "opponent" as const, slot: 0 }, action: { kind: "move" as const, moveIndex: 0 } },
    ];
    expect(resolveDoubleTeamTurn(start, actions, rng).events
      .find((event) => event.type === "teamActionOrdered")?.order[0]?.side).toBe("player");
    const ditto = mon("ditto", "player", { heldItem: "SUPEREVIOLITE", canEvolveTwice: false });
    const transformed = transformBattler(ditto, user)!;
    expect(transformed.canEvolveTwice).toBe(true);
    expect(damage(transformed, mon("target", "opponent"))).toBeGreaterThan(
      damage({ ...transformed, heldItem: null }, mon("target", "opponent")));
    expect(restoreTransformedBattler(transformed).canEvolveTwice).toBe(false);
  });
});
