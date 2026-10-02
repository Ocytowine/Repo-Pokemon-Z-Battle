import { describe, expect, it } from "vitest";
import { addPokemonToParty, createDefaultPlayerAvatarSelection, createDefaultPlayerProfile, createEmptyPlayerParty,
  createPersistentPokemon, experienceAtLevel, grantPokemonExperience, healPlayerParty, parsePlayerAvatarSelection,
  loadSessionPlayerAvatarSelection, parsePlayerParty, parsePlayerProfile, persistSessionPlayerAvatarSelection,
  playerPartyToBattleTeam, storeBattleTeam, type PlayerBattleCatalog,
  type PlayerCreationCatalog, type PlayerPartyState } from "../src/index.js";

const party: PlayerPartyState = { schemaVersion: 1, activeIndex: 0, members: [{
  id: "starter", species: "PIKACHU", nickname: null, level: 12, experience: 900,
  stats: { maxHp: 35, attack: 20, defense: 16, specialAttack: 19, specialDefense: 18, speed: 28 },
  hp: 4, majorStatus: { kind: "poison", toxicCounter: null }, ability: "QUICKFEET", heldItem: null,
  moves: [{ internalName: "TACKLE", pp: 2, maxPp: 35 }],
}] };

const catalog: PlayerBattleCatalog = {
  pokemon: [{ internalName: "PIKACHU", name: "Pikachu", types: ["ELECTRIC"] }],
  moves: [{ id: 303, internalName: "TACKLE", name: "Charge", functionCode: "000", power: 40, type: "NORMAL",
    category: "Physical", accuracy: 100, pp: 35, priority: 0, effectChance: 0 }],
};

describe("player profile", () => {
  it("validates a standalone versioned cosmetic profile", () => {
    const profile = createDefaultPlayerProfile();
    expect(parsePlayerProfile(profile)).toEqual(profile);
    expect(() => parsePlayerProfile({ ...profile, displayName: "" })).toThrow("Profil joueur");
    expect(() => parsePlayerProfile({ ...profile, colors: { ...profile.colors, primary: "#ff00ff" } }))
      .toThrow("Profil joueur");
  });

  it("validates the independently persisted avatar selection", () => {
    const selection = createDefaultPlayerAvatarSelection();
    expect(parsePlayerAvatarSelection(selection)).toEqual(selection);
    expect(() => parsePlayerAvatarSelection({ ...selection, avatarId: "../../trainer" })).toThrow("avatar");
  });

  it("keeps active profiles isolated between tabs sharing persistent storage", () => {
    const persistentValues = new Map<string, string>();
    const firstSessionValues = new Map<string, string>();
    const secondSessionValues = new Map<string, string>();
    const storage = (values: Map<string, string>) => ({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    const first = { ...createDefaultPlayerAvatarSelection(),
      profile: { ...createDefaultPlayerProfile(), displayName: "Hote" } };
    const second = { ...createDefaultPlayerAvatarSelection(), avatarId: "legacy-1",
      profile: { ...createDefaultPlayerProfile(), displayName: "Invite" } };

    persistSessionPlayerAvatarSelection(storage(firstSessionValues), storage(persistentValues), first);
    persistSessionPlayerAvatarSelection(storage(secondSessionValues), storage(persistentValues), second);

    expect(loadSessionPlayerAvatarSelection(storage(firstSessionValues), storage(persistentValues))).toEqual(first);
    expect(loadSessionPlayerAvatarSelection(storage(secondSessionValues), storage(persistentValues))).toEqual(second);
  });
});

describe("persistent player party", () => {
  it("represents an empty story party without inventing a starter", () => {
    expect(createEmptyPlayerParty()).toEqual({ schemaVersion: 1, activeIndex: null, members: [] });
    expect(parsePlayerParty(createEmptyPlayerParty())).toEqual(createEmptyPlayerParty());
  });

  it("validates identity, bounds and active member", () => {
    expect(parsePlayerParty(party)).toEqual(party);
    expect(() => parsePlayerParty({ ...party, activeIndex: 2 })).toThrow("actif");
    expect(() => parsePlayerParty({ ...party, members: [party.members[0], party.members[0]] })).toThrow("dupliqués");
    expect(() => parsePlayerParty({ ...party, members: [{ ...party.members[0], hp: 40 }] })).toThrow("PV");
  });

  it("heals HP, status and PP immutably", () => {
    const healed = healPlayerParty(party);
    expect(healed.members[0]).toMatchObject({ hp: 35, majorStatus: null, moves: [{ pp: 35, maxPp: 35 }] });
    expect(party.members[0]).toMatchObject({ hp: 4, majorStatus: { kind: "poison" }, moves: [{ pp: 2 }] });
  });

  it("round-trips mutable battle resources through the engine team", () => {
    const team = playerPartyToBattleTeam(party, catalog);
    expect(team.members[0]).toMatchObject({ species: "PIKACHU", name: "Pikachu", hp: 4, ability: "QUICKFEET",
      moves: [{ pp: 2, move: { internalName: "TACKLE", name: "Charge" } }] });
    const result = { ...team, members: team.members.map((member) => ({ ...member, hp: 1, majorStatus: { kind: "burn" as const },
      moves: member.moves.map((slot) => ({ ...slot, pp: 1 })) })) };
    expect(storeBattleTeam(party, result).members[0]).toMatchObject({ hp: 1, majorStatus: { kind: "burn" }, moves: [{ pp: 1 }] });
  });

  it("blocks unsupported battle mechanics explicitly", () => {
    expect(() => playerPartyToBattleTeam({ ...party, members: [{ ...party.members[0]!, ability: "LEVITATE" }] }, catalog)).toThrow("Talent");
    expect(() => playerPartyToBattleTeam(party, { ...catalog, moves: [{ ...catalog.moves[0]!, functionCode: "999" }] })).toThrow("Fonction");
  });

  it("creates a levelled story Pokemon from extracted definitions and adds it to an empty party", () => {
    const creationCatalog: PlayerCreationCatalog = { ...catalog, pokemon: [{ ...catalog.pokemon[0]!,
      baseStats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
      abilities: ["STATIC"], growthRate: "Medium", baseExperience: 112,
      levelUpMoves: [{ level: 1, move: "TACKLE" }] }] };
    const pokemon = createPersistentPokemon("starter-1", "PIKACHU", 5, creationCatalog);
    expect(pokemon).toMatchObject({ id: "starter-1", species: "PIKACHU", level: 5, hp: 20, stats: { maxHp: 20 },
      ability: "STATIC", moves: [{ internalName: "TACKLE", pp: 35, maxPp: 35 }] });
    expect(pokemon.experience).toBe(125);
    expect(addPokemonToParty(createEmptyPlayerParty(), pokemon)).toMatchObject({ activeIndex: 0, members: [{ species: "PIKACHU" }] });
  });

  it("uses the source growth curves and applies level-up stats without healing existing damage", () => {
    const creationCatalog: PlayerCreationCatalog = { ...catalog, pokemon: [{ ...catalog.pokemon[0]!,
      baseStats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
      abilities: ["STATIC"], growthRate: "Parabolic", baseExperience: 112,
      levelUpMoves: [{ level: 1, move: "TACKLE" }, { level: 6, move: "TACKLE" }] }] };
    expect(experienceAtLevel(5, "Parabolic")).toBe(135);
    expect(experienceAtLevel(100, "Erratic")).toBe(600_000);
    const created = createPersistentPokemon("starter-1", "PIKACHU", 5, creationCatalog);
    const damaged = { ...created, hp: created.hp - 4 };
    const result = grantPokemonExperience(damaged, experienceAtLevel(6, "Parabolic") - created.experience, creationCatalog);
    expect(result).toMatchObject({ gained: 44, levelsGained: 1, pokemon: { level: 6, experience: 179 } });
    expect(result.pokemon.stats.maxHp - result.pokemon.hp).toBe(4);
  });
});
