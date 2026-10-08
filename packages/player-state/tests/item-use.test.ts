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

  it("applies PP Up and PP Max with Pokemon Z's three-step maximum", () => {
    const original = party(pokemon({ moves: [{ internalName: "TACKLE", pp: 20, maxPp: 35 }] }));
    const first = usePokemonItem({ PPUP: 2 }, original, "PPUP", "owner-mon",
      { context: "field", revivalAllowed: true }, 0);
    expect(first).toMatchObject({ ok: true, inventory: { PPUP: 1 },
      party: { members: [{ moves: [{ pp: 20, maxPp: 42, ppUps: 1, basePp: 35 }] }] },
      effect: { maximumPpRaised: 7, targetMoveIndex: 0 } });
    if (!first.ok) throw new Error("PP Plus aurait dû fonctionner.");
    const maximum = usePokemonItem({ PPMAX: 1 }, first.party, "PPMAX", "owner-mon",
      { context: "field", revivalAllowed: true }, 0);
    expect(maximum).toMatchObject({ ok: true, inventory: {},
      party: { members: [{ moves: [{ pp: 20, maxPp: 56, ppUps: 3, basePp: 35 }] }] },
      effect: { maximumPpRaised: 14 } });
    if (!maximum.ok) throw new Error("PP Max aurait dû fonctionner.");
    expect(usePokemonItem({ PPUP: 1 }, maximum.party, "PPUP", "owner-mon",
      { context: "field", revivalAllowed: true }, 0)).toMatchObject({ ok: false,
      inventory: { PPUP: 1 }, reason: "no-effect" });
    expect(isPokemonItemUsableInBattle("PPUP")).toBe(false);
  });

  it("applies vitamins, Z super vitamins and wings against the exact EV limits", () => {
    const recalculate = (target: PersistentPokemon): PersistentPokemon => ({ ...target,
      stats: { ...target.stats, attack: target.stats.attack + 1 } });
    const trained = pokemon({ metadata: { ...pokemon().metadata, happiness: 90,
      evs: { hp: 0, attack: 245, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 } } });
    const vitamin = usePokemonItem({ PROTEIN: 1 }, party(trained), "PROTEIN", trained.id,
      { context: "field", revivalAllowed: true }, undefined, recalculate);
    expect(vitamin).toMatchObject({ ok: true, inventory: {},
      party: { members: [{ stats: { attack: 21 }, metadata: { happiness: 95, evs: { attack: 250 } } }] },
      effect: { trainingStat: "attack", trainingValueRaised: 5, happinessChanged: 5 } });
    if (!vitamin.ok) throw new Error("La Protéine aurait dû fonctionner.");
    expect(usePokemonItem({ SUPERPROTEIN: 1 }, vitamin.party, "SUPERPROTEIN", trained.id,
      { context: "field", revivalAllowed: true }, undefined, recalculate))
      .toMatchObject({ ok: false, inventory: { SUPERPROTEIN: 1 }, reason: "no-effect" });

    const wingTarget = { ...trained, metadata: { ...trained.metadata, happiness: 200,
      evs: { hp: 252, attack: 251, defense: 7, specialAttack: 0, specialDefense: 0, speed: 0 } } };
    expect(usePokemonItem({ MUSCLEWING: 1 }, party(wingTarget), "MUSCLEWING", trained.id,
      { context: "field", revivalAllowed: true }, undefined, recalculate)).toMatchObject({ ok: false,
      inventory: { MUSCLEWING: 1 }, reason: "no-effect" });
    const belowLimit = { ...wingTarget, metadata: { ...wingTarget.metadata,
      evs: { ...wingTarget.metadata.evs, hp: 251 } } };
    expect(usePokemonItem({ MUSCLEWING: 1 }, party(belowLimit), "MUSCLEWING", trained.id,
      { context: "field", revivalAllowed: true }, undefined, recalculate)).toMatchObject({ ok: true,
      inventory: {}, party: { members: [{ metadata: { evs: { attack: 252 } } }] },
      effect: { trainingValueRaised: 1 } });
    expect(isPokemonItemUsableInBattle("SUPERHPUP")).toBe(false);
  });

  it("applies Z potential caps with the source IV total and per-stat limits", () => {
    const recalculate = (target: PersistentPokemon): PersistentPokemon => target;
    const target = pokemon({ metadata: { ...pokemon().metadata, happiness: 150,
      ivs: { hp: 30, attack: 20, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 } } });
    expect(usePokemonItem({ ACapsula: 1 }, party(target), "ACapsula", target.id,
      { context: "field", revivalAllowed: true }, undefined, recalculate)).toMatchObject({ ok: true,
      inventory: {}, party: { members: [{ metadata: { happiness: 153, ivs: { attack: 27 } } }] },
      effect: { trainingStat: "attack", trainingValueRaised: 7, happinessChanged: 3,
        individualValuesRaised: { attack: 7 } } });

    const nearTotalLimit = pokemon({ metadata: { ...pokemon().metadata,
      ivs: { hp: 30, attack: 31, defense: 31, speed: 31, specialAttack: 31, specialDefense: 30 } } });
    expect(usePokemonItem({ CHAPADORADA: 1 }, party(nearTotalLimit), "CHAPADORADA", nearTotalLimit.id,
      { context: "field", revivalAllowed: true }, undefined, recalculate)).toMatchObject({ ok: true,
      inventory: {}, party: { members: [{ metadata: { ivs: { hp: 31, specialDefense: 31 } } }] },
      effect: { trainingValueRaised: 2, happinessChanged: 0,
        individualValuesRaised: { hp: 1, specialDefense: 1 } } });
    const perfect = pokemon({ metadata: { ...pokemon().metadata,
      ivs: { hp: 31, attack: 31, defense: 31, speed: 31, specialAttack: 31, specialDefense: 31 } } });
    expect(usePokemonItem({ CHAPADORADA: 1 }, party(perfect), "CHAPADORADA", perfect.id,
      { context: "field", revivalAllowed: true }, undefined, recalculate)).toMatchObject({ ok: false,
      inventory: { CHAPADORADA: 1 }, reason: "no-effect" });
    expect(isPokemonItemUsableInBattle("SCapsula")).toBe(false);
  });

  it("changes the actual nature with Z's mints and preserves an ineffective item", () => {
    const target = pokemon({ metadata: { ...pokemon().metadata, nature: "HARDY" } });
    const recalculate = (candidate: PersistentPokemon): PersistentPokemon => ({ ...candidate,
      stats: { ...candidate.stats, attack: 22, specialAttack: 18 } });
    const changed = usePokemonItem({ ADAMANTMINT: 1 }, party(target), "ADAMANTMINT", target.id,
      { context: "field", revivalAllowed: true }, undefined, recalculate);
    expect(changed).toMatchObject({ ok: true, inventory: {}, party: { members: [{
      stats: { attack: 22, specialAttack: 18 }, metadata: { nature: "ADAMANT" },
    }] }, effect: { natureChanged: { from: "HARDY", to: "ADAMANT" } } });
    if (!changed.ok) throw new Error("La Menthe Rigide aurait dû fonctionner.");
    expect(usePokemonItem({ ADAMANTMINT: 1 }, changed.party, "ADAMANTMINT", target.id,
      { context: "field", revivalAllowed: true }, undefined, recalculate)).toMatchObject({ ok: false,
      inventory: { ADAMANTMINT: 1 }, reason: "no-effect" });
    expect(isPokemonItemUseSupported("QUITEMINT")).toBe(false);
    expect(isPokemonItemUsableInBattle("ADAMANTMINT")).toBe(false);
  });

  it("combines friendship berries and EV reduction exactly like Z", () => {
    const recalculate = (candidate: PersistentPokemon): PersistentPokemon => candidate;
    const target = pokemon({ metadata: { ...pokemon().metadata, happiness: 90,
      evs: { hp: 5, attack: 0, defense: 0, speed: 0, specialAttack: 0, specialDefense: 0 } } });
    expect(usePokemonItem({ POMEGBERRY: 1 }, party(target), "POMEGBERRY", target.id,
      { context: "field", revivalAllowed: true }, undefined, recalculate)).toMatchObject({ ok: true,
      inventory: {}, party: { members: [{ metadata: { happiness: 100, evs: { hp: 0 } } }] },
      effect: { happinessChanged: 10, trainingValueRaised: -5, effortValuesChanged: { hp: -5 } } });
    const friendly = pokemon({ metadata: { ...pokemon().metadata, happiness: 254 } });
    expect(usePokemonItem({ KELPSYBERRY: 1 }, party(friendly), "KELPSYBERRY", friendly.id,
      { context: "field", revivalAllowed: true }, undefined, recalculate)).toMatchObject({ ok: true,
      party: { members: [{ metadata: { happiness: 255 } }] }, effect: { happinessChanged: 1 } });
    const capped = pokemon({ metadata: { ...pokemon().metadata, happiness: 255 } });
    expect(usePokemonItem({ KELPSYBERRY: 1 }, party(capped), "KELPSYBERRY", capped.id,
      { context: "field", revivalAllowed: true }, undefined, recalculate)).toMatchObject({ ok: false,
      inventory: { KELPSYBERRY: 1 }, reason: "no-effect" });
  });

  it("applies both Z essences up to their unusual 508 EV cap and keeps the refined one", () => {
    const recalculate = (candidate: PersistentPokemon): PersistentPokemon => candidate;
    const target = pokemon({ metadata: { ...pokemon().metadata,
      evs: { hp: 0, attack: 0, defense: 0, speed: 0, specialAttack: 0, specialDefense: 0 } } });
    const first = usePokemonItem({ POKESENCIA: 1 }, party(target), "POKESENCIA", target.id,
      { context: "field", revivalAllowed: true }, undefined, recalculate);
    expect(first).toMatchObject({ ok: true, inventory: {},
      party: { members: [{ metadata: { evs: { hp: 80, attack: 80, defense: 80, speed: 80,
        specialAttack: 80, specialDefense: 80 } } }] }, effect: { trainingValueRaised: 480 } });
    if (!first.ok) throw new Error("La Poké Essence aurait dû fonctionner.");
    const refined = usePokemonItem({ POKESENCIAREFINADA: 1 }, first.party, "POKESENCIAREFINADA", target.id,
      { context: "field", revivalAllowed: true }, undefined, recalculate);
    expect(refined).toMatchObject({ ok: true, inventory: { POKESENCIAREFINADA: 1 },
      party: { members: [{ metadata: { evs: { hp: 108 } } }] },
      effect: { trainingValueRaised: 28, effortValuesChanged: { hp: 28 } } });
    if (!refined.ok) throw new Error("La Poké Essence raffinée aurait dû fonctionner.");
    expect(usePokemonItem(refined.inventory, refined.party, "POKESENCIAREFINADA", target.id,
      { context: "field", revivalAllowed: true }, undefined, recalculate)).toMatchObject({ ok: false,
      inventory: { POKESENCIAREFINADA: 1 }, reason: "no-effect" });
    expect(isPokemonItemUsableInBattle("POKESENCIA")).toBe(false);
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
