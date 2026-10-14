import { describe, expect, it } from "vitest";
import { changePokemonCollectionHeldItem, createEmptyPlayerParty, createEmptyPlayerPokemonStorage,
  createPersistentPokemonMetadata, releaseStoredPokemon, removePokemonHeldItem,
  type PersistentPokemon } from "../src/index.js";

function pokemon(id: string, heldItem: string | null = null): PersistentPokemon {
  return { id, species: "PIKACHU", nickname: null, level: 5, experience: 125,
    stats: { maxHp: 20, attack: 10, defense: 10, specialAttack: 10, specialDefense: 10, speed: 10 },
    hp: 20, majorStatus: null, ability: null, heldItem, moves: [],
    metadata: createPersistentPokemonMetadata(id, "PIKACHU", 5) };
}

describe("personal held item transactions", () => {
  it("equips and swaps a supported item on a team Pokemon atomically", () => {
    const party = { ...createEmptyPlayerParty(), activeIndex: 0, members: [pokemon("team", "LEFTOVERS")] };
    const storage = createEmptyPlayerPokemonStorage();
    const result = changePokemonCollectionHeldItem({ LIFEORB: 2 }, party, storage, "team", "LIFEORB");
    expect(result).toMatchObject({ ok: true, inventory: { LIFEORB: 1, LEFTOVERS: 1 },
      party: { members: [{ heldItem: "LIFEORB" }] }, storage: { members: [] },
      location: "team", returned: "LEFTOVERS" });
    expect(party.members[0]?.heldItem).toBe("LEFTOVERS");
  });

  it("uses the same transaction for a stored Pokemon", () => {
    const party = createEmptyPlayerParty();
    const storage = { ...createEmptyPlayerPokemonStorage(), members: [pokemon("stored")] };
    expect(changePokemonCollectionHeldItem({ ROCKYHELMET: 1 }, party, storage, "stored", "ROCKYHELMET"))
      .toMatchObject({ ok: true, inventory: {}, party: { members: [] },
        storage: { members: [{ heldItem: "ROCKYHELMET" }] }, location: "ranch" });
  });

  it("accepts source held items while rejecting absent and foreign items without mutation", () => {
    const party = { ...createEmptyPlayerParty(), activeIndex: 0, members: [pokemon("team")] };
    const storage = createEmptyPlayerPokemonStorage();
    expect(changePokemonCollectionHeldItem({ POTION: 1 }, party, storage, "team", "POTION"))
      .toMatchObject({ ok: true, inventory: {}, party: { members: [{ heldItem: "POTION" }] }, storage });
    expect(changePokemonCollectionHeldItem({}, party, storage, "team", "LEFTOVERS"))
      .toMatchObject({ ok: false, reason: "item-not-owned" });
    expect(changePokemonCollectionHeldItem({ LEFTOVERS: 1 }, party, storage, "guest", "LEFTOVERS"))
      .toMatchObject({ ok: false, reason: "target-not-found" });
  });

  it("can return a legacy unsupported held item to the Bag", () => {
    const party = { ...createEmptyPlayerParty(), activeIndex: 0, members: [pokemon("team", "LEGACYITEM")] };
    expect(removePokemonHeldItem({}, party, "team")).toMatchObject({ ok: true,
      inventory: { LEGACYITEM: 1 }, party: { members: [{ heldItem: null }] }, returned: "LEGACYITEM" });
    expect(changePokemonCollectionHeldItem({}, party, createEmptyPlayerPokemonStorage(), "team", null))
      .toMatchObject({ ok: true, inventory: { LEGACYITEM: 1 }, party: { members: [{ heldItem: null }] } });
  });

  it("releases only a stored Pokemon and atomically returns its held item", () => {
    const stored = pokemon("stored", "POTION");
    const storage = { ...createEmptyPlayerPokemonStorage(), members: [stored, pokemon("other")] };
    expect(releaseStoredPokemon({ POTION: 2 }, storage, "stored")).toMatchObject({
      ok: true, inventory: { POTION: 3 }, storage: { members: [{ id: "other" }] },
      pokemon: { id: "stored" }, returnedItem: "POTION",
    });
    expect(releaseStoredPokemon({}, storage, "missing")).toMatchObject({ ok: false, reason: "target-not-found" });
    expect(releaseStoredPokemon({ POTION: 999 }, storage, "stored"))
      .toMatchObject({ ok: false, reason: "bag-full", storage });
  });
});
