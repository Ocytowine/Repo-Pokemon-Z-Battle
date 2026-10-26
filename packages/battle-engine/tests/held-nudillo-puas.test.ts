import { describe, expect, it } from "vitest";
import { MINIMAL_MOVE_CATALOG, createTeamBattleState, resolveTeamTurn,
  type BattleMove, type BattleSide, type BattlerState, type RandomSource } from "../src/index.js";

const contact: BattleMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "CONTACT",
  flags: "a", accuracy: 0 };
const roll = (itemRoll: number): RandomSource => ({ nextInt: (max) => max === 10 ? itemRoll : 0 });

function pokemon(id: string, side: BattleSide, overrides: Partial<BattlerState> = {}): BattlerState {
  return { id, species: "EEVEE", name: id, level: 50, types: ["NORMAL"],
    stats: { maxHp: 200, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100,
      speed: side === "player" ? 120 : 80 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0,
      speed: 0, accuracy: 0, evasion: 0 },
    hp: 200, majorStatus: null, ability: null, heldItem: null,
    moves: [{ move: contact, pp: contact.pp }], ...overrides };
}

describe("Pokemon Z Nudillo Púas", () => {
  const play = (attacker: Partial<BattlerState> = {}, defender: Partial<BattlerState> = {}, itemRoll = 0) =>
    resolveTeamTurn(createTeamBattleState({
      player: [pokemon("user", "player", { heldItem: "NUDILLOPUAS", ...attacker })],
      opponent: [pokemon("foe", "opponent", defender)],
    }), { player: { kind: "move", moveIndex: 0 }, opponent: { kind: "wait" } }, roll(itemRoll));

  it("inflicts Hemorrhage on a successful contact roll without consuming the item", () => {
    const result = play();
    expect(result.state.teams.opponent.members[0]!.majorStatus?.kind).toBe("hemorrhage");
    expect(result.state.teams.player.members[0]!.heldItem).toBe("NUDILLOPUAS");
    expect(result.events).toContainEqual(expect.objectContaining({ type: "itemActivated",
      item: "NUDILLOPUAS", effect: "status" }));
    expect(result.trace).toContainEqual(expect.objectContaining({ type: "rng", purpose: "item",
      maxExclusive: 10, value: 0 }));
  });

  it("requires an active item, contact and a susceptible target", () => {
    expect(play({}, {}, 9).state.teams.opponent.members[0]!.majorStatus).toBeNull();
    expect(play({ volatile: { embargoTurns: 2 } as BattlerState["volatile"] })
      .state.teams.opponent.members[0]!.majorStatus).toBeNull();
    expect(play({}, { types: ["FIRE"] }).state.teams.opponent.members[0]!.majorStatus).toBeNull();
    const noContact = { ...contact, flags: "" };
    expect(play({ moves: [{ move: noContact, pp: noContact.pp }] })
      .state.teams.opponent.members[0]!.majorStatus).toBeNull();
  });
});
