import { describe, expect, it } from "vitest";
import { createPersistentPokemonMetadata, discardInventoryItem, isPokemonItemUsableInBattle,
  isPokemonItemUseSupported, usePokemonItem,
  usePokemonPartyItem,
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
  it("discards only an explicit valid quantity from the personal inventory", () => {
    const inventory = { POTION: 3 };
    expect(discardInventoryItem(inventory, "POTION", 2, true))
      .toEqual({ ok: true, inventory: { POTION: 1 }, discarded: 2 });
    expect(discardInventoryItem(inventory, "POTION", 4, true))
      .toEqual({ ok: false, inventory, reason: "item-not-owned" });
    expect(discardInventoryItem(inventory, "POTION", 1, false))
      .toEqual({ ok: false, inventory, reason: "not-discardable" });
    expect(inventory).toEqual({ POTION: 3 });
  });

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

  it("reproduces Pokemon Z bitter medicines and their happiness thresholds", () => {
    const high = pokemon({ hp: 1, metadata: { ...pokemon().metadata, happiness: 220 } });
    expect(usePokemonItem({ ENERGYPOWDER: 1 }, party(high), "ENERGYPOWDER", high.id,
      { context: "field", revivalAllowed: true })).toMatchObject({ ok: true, inventory: {},
      party: { members: [{ hp: 40, metadata: { happiness: 210 } }] },
      effect: { hpRestored: 39, happinessChanged: -10 } });

    const poisoned = pokemon({ majorStatus: { kind: "poison", toxicCounter: null },
      metadata: { ...pokemon().metadata, happiness: 150 } });
    expect(usePokemonItem({ HEALPOWDER: 1 }, party(poisoned), "HEALPOWDER", poisoned.id,
      { context: "field", revivalAllowed: true })).toMatchObject({ ok: true,
      party: { members: [{ majorStatus: null, metadata: { happiness: 145 } }] },
      effect: { statusCured: "poison", happinessChanged: -5 } });
  });

  it("keeps the two source Nuzlocke revival exceptions distinct from battle items", () => {
    const fainted = pokemon({ hp: 0, metadata: { ...pokemon().metadata, happiness: 205 } });
    expect(usePokemonItem({ REVIVALHERB: 1 }, party(fainted), "REVIVALHERB", fainted.id,
      { context: "field", revivalAllowed: false })).toMatchObject({ ok: true,
      party: { members: [{ hp: 40, metadata: { happiness: 185 } }] },
      effect: { revived: true, happinessChanged: -20 } });
    expect(usePokemonItem({ Cenizas: 1 }, party(fainted), "Cenizas", fainted.id,
      { context: "field", revivalAllowed: false })).toMatchObject({ ok: true,
      party: { members: [{ hp: 40, metadata: { happiness: 205 } }] } });
    expect(isPokemonItemUseSupported("Cenizas")).toBe(true);
    expect(isPokemonItemUsableInBattle("Cenizas")).toBe(false);
    expect(isPokemonItemUsableInBattle("REVIVALHERB")).toBe(true);
  });

  it("uses Sacred Ash once to fully restore every fainted non-egg party member", () => {
    const first = pokemon({ id: "first", hp: 0, majorStatus: { kind: "burn" },
      moves: [{ internalName: "TACKLE", pp: 0, maxPp: 35 }] });
    const egg = pokemon({ id: "egg", hp: 0,
      metadata: { ...pokemon().metadata, eggSteps: 20 } });
    const healthy = pokemon({ id: "healthy", hp: 12 });
    const original = { schemaVersion: 1 as const, activeIndex: 2, members: [first, egg, healthy] };
    expect(usePokemonPartyItem({ SACREDASH: 2 }, original, "SACREDASH")).toMatchObject({
      ok: true, inventory: { SACREDASH: 1 }, revived: 1,
      party: { members: [
        { id: "first", hp: 40, majorStatus: null, moves: [{ pp: 35 }] },
        { id: "egg", hp: 0 },
        { id: "healthy", hp: 12 },
      ] },
    });
    expect(usePokemonPartyItem({ SACREDASH: 1 }, party(healthy), "SACREDASH"))
      .toMatchObject({ ok: false, reason: "no-effect", inventory: { SACREDASH: 1 } });
  });
});
