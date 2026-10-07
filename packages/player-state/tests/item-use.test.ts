import { describe, expect, it } from "vitest";
import { createPersistentPokemonMetadata, isPokemonItemUseSupported, usePokemonItem,
  type PersistentPokemon, type PlayerPartyState } from "../src/index.js";

function pokemon(input: Partial<PersistentPokemon> = {}): PersistentPokemon {
  return {
    id: "owner-mon", species: "PIKACHU", nickname: null, level: 5, experience: 125,
    stats: { maxHp: 40, attack: 20, defense: 20, specialAttack: 20, specialDefense: 20, speed: 20 },
    hp: 10, majorStatus: null, ability: null, heldItem: null, moves: [],
    metadata: createPersistentPokemonMetadata("owner-mon", "PIKACHU", 5), ...input,
  };
}

function party(member: PersistentPokemon): PlayerPartyState {
  return { schemaVersion: 1, activeIndex: 0, members: [member] };
}

describe("personal Pokemon item use", () => {
  it("heals and consumes exactly one owned item without mutating its inputs", () => {
    const inventory = { POTION: 2 };
    const original = party(pokemon());
    const result = usePokemonItem(inventory, original, "POTION", "owner-mon",
      { context: "field", revivalAllowed: true });
    expect(result).toMatchObject({ ok: true, inventory: { POTION: 1 },
      party: { members: [{ hp: 30 }] }, effect: { hpRestored: 20, revived: false } });
    expect(inventory).toEqual({ POTION: 2 });
    expect(original.members[0]?.hp).toBe(10);
  });

  it("keeps the item when the target cannot receive its effect", () => {
    const full = party(pokemon({ hp: 40 }));
    expect(usePokemonItem({ POTION: 1 }, full, "POTION", "owner-mon",
      { context: "field", revivalAllowed: true })).toEqual({
      ok: false, inventory: { POTION: 1 }, party: full, reason: "no-effect",
    });
  });

  it("cures only the matching source status and preserves another owner's party", () => {
    const poisoned = party(pokemon({ majorStatus: { kind: "poison", toxicCounter: 2 } }));
    const cured = usePokemonItem({ ANTIDOTE: 1 }, poisoned, "ANTIDOTE", "owner-mon",
      { context: "field", revivalAllowed: true });
    expect(cured).toMatchObject({ ok: true, inventory: {}, party: { members: [{ majorStatus: null }] },
      effect: { statusCured: "poison" } });
    expect(usePokemonItem({ BURNHEAL: 1 }, poisoned, "BURNHEAL", "owner-mon",
      { context: "field", revivalAllowed: true })).toMatchObject({ ok: false, reason: "no-effect" });
    const guestParty = party(pokemon({ id: "guest-mon", hp: 3 }));
    expect(usePokemonItem({ POTION: 1 }, poisoned, "POTION", "guest-mon",
      { context: "field", revivalAllowed: true })).toEqual({
      ok: false, inventory: { POTION: 1 }, party: poisoned, reason: "target-not-found",
    });
    expect(guestParty.members[0]?.hp).toBe(3);
  });

  it("honours the Nuzlocke revival restriction", () => {
    const fainted = party(pokemon({ hp: 0, majorStatus: { kind: "burn" } }));
    expect(usePokemonItem({ REVIVE: 1 }, fainted, "REVIVE", "owner-mon",
      { context: "field", revivalAllowed: false })).toMatchObject({ ok: false, reason: "revival-disabled" });
    expect(usePokemonItem({ REVIVE: 1 }, fainted, "REVIVE", "owner-mon",
      { context: "field", revivalAllowed: true })).toMatchObject({ ok: true, inventory: {},
      party: { members: [{ hp: 20, majorStatus: null }] }, effect: { revived: true, hpRestored: 20 } });
  });

  it("keeps source-specific field and battle values explicit", () => {
    const field = usePokemonItem({ SWEETHEART: 1 }, party(pokemon({ hp: 1, stats: { ...pokemon().stats, maxHp: 200 } })),
      "SWEETHEART", "owner-mon", { context: "field", revivalAllowed: true });
    const battle = usePokemonItem({ SWEETHEART: 1 }, party(pokemon({ hp: 1, stats: { ...pokemon().stats, maxHp: 200 } })),
      "SWEETHEART", "owner-mon", { context: "battle", revivalAllowed: true });
    expect(field).toMatchObject({ ok: true, effect: { hpRestored: 150 } });
    expect(battle).toMatchObject({ ok: true, effect: { hpRestored: 20 } });
    expect(isPokemonItemUseSupported("POKEBALL")).toBe(false);
  });

  it("restores only the selected move's PP and consumes nothing for an invalid target", () => {
    const moves = [
      { internalName: "TACKLE", pp: 4, maxPp: 35 },
      { internalName: "EMBER", pp: 0, maxPp: 25 },
    ];
    const original = party(pokemon({ moves }));
    const restored = usePokemonItem({ ETHER: 2 }, original, "ETHER", "owner-mon",
      { context: "field", revivalAllowed: true }, 1);
    expect(restored).toMatchObject({ ok: true, inventory: { ETHER: 1 },
      party: { members: [{ moves: [{ pp: 4 }, { pp: 10 }] }] },
      effect: { ppRestored: 10, targetMoveIndex: 1, movePp: [4, 10] } });
    expect(usePokemonItem({ ETHER: 2 }, original, "ETHER", "owner-mon",
      { context: "field", revivalAllowed: true }, 3)).toMatchObject({ ok: false,
      inventory: { ETHER: 2 }, reason: "no-effect" });
    expect(moves[1]?.pp).toBe(0);
  });

  it("keeps temporary battle-stage items out of personal field state", () => {
    expect(usePokemonItem({ XATTACK: 1 }, party(pokemon()), "XATTACK", "owner-mon",
      { context: "field", revivalAllowed: true })).toMatchObject({ ok: false,
      inventory: { XATTACK: 1 }, reason: "unsupported-item" });
  });
});
