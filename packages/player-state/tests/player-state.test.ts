import { describe, expect, it } from "vitest";
import { addPokemonToParty, addPokemonToStorage, calculatePokemonStats, createDefaultPlayerAvatarSelection, createDefaultPlayerProfile, createEmptyPlayerParty,
  createEmptyPlayerPokemonStorage,
  createPersistentPokemon, createPersistentPokemonMetadata, createPlayerTrainerIdentity, experienceAtLevel, grantPokemonExperience,
  healPlayerParty, loadPlayerAvatarSelection, parsePlayerAvatarSelection,
  loadSessionPlayerAvatarSelection, parsePlayerParty, parsePlayerPokemonStorage, parsePlayerProfile, persistSessionPlayerAvatarSelection,
  movePokemonToPartyFront, playerPartyToBattleTeam, publicPokemonIdentity, recalculatePersistentPokemonStats,
  reorderPokemonMoves, storeBattleTeam, transferPokemonToParty, transferPokemonToStorage, type PlayerBattleCatalog,
  type PlayerCreationCatalog, type PlayerPartyState } from "../src/index.js";

const party: PlayerPartyState = { schemaVersion: 1, activeIndex: 0, members: [{
  id: "starter", species: "PIKACHU", nickname: null, level: 12, experience: 900,
  stats: { maxHp: 35, attack: 20, defense: 16, specialAttack: 19, specialDefense: 18, speed: 28 },
  hp: 4, majorStatus: { kind: "poison", toxicCounter: null }, ability: "QUICKFEET", heldItem: null,
  moves: [{ internalName: "TACKLE", pp: 2, maxPp: 35 }],
  metadata: createPersistentPokemonMetadata("starter", "PIKACHU", 12),
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

  it("migrates and persists a private stable Trainer identity", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    values.set("profile", JSON.stringify({ schemaVersion: 1, avatarId: "legacy-0", profile: createDefaultPlayerProfile() }));
    const migrated = loadPlayerAvatarSelection(storage, "profile");
    expect(migrated).toMatchObject({ schemaVersion: 2, trainerIdentity: { schemaVersion: 1,
      publicId: migrated.trainerIdentity.trainerId & 0xffff } });
    expect(loadPlayerAvatarSelection(storage, "profile").trainerIdentity).toEqual(migrated.trainerIdentity);
    expect(createPlayerTrainerIdentity(0x1234_5678)).toEqual({ schemaVersion: 1,
      trainerId: 0x1234_5678, publicId: 0x5678 });
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

  it("migrates legacy Pokemon metadata deterministically without changing battle stats", () => {
    const { metadata: _metadata, ...legacyPokemon } = party.members[0]!;
    const legacyParty = { ...party, members: [legacyPokemon] };
    const first = parsePlayerParty(legacyParty).members[0]!;
    const second = parsePlayerParty(legacyParty).members[0]!;
    expect(first.metadata).toEqual(second.metadata);
    expect(first).toMatchObject({ stats: legacyPokemon.stats, hp: 4, metadata: {
      schemaVersion: 1, nature: expect.any(String), evs: { hp: 0, attack: 0, defense: 0,
        specialAttack: 0, specialDefense: 0, speed: 0 }, gender: null, happiness: null,
      owner: { trainerId: null }, origin: { method: "unknown", level: 12 },
    } });
    expect(first.metadata.personalId).not.toBe(createPersistentPokemonMetadata("another", "PIKACHU", 12).personalId);
  });

  it("validates IV and EV limits in versioned Pokemon metadata", () => {
    const member = party.members[0]!;
    expect(() => parsePlayerParty({ ...party, members: [{ ...member, metadata: { ...member.metadata,
      ivs: { ...member.metadata.ivs, hp: 32 } } }] })).toThrow("IV");
    expect(() => parsePlayerParty({ ...party, members: [{ ...member, metadata: { ...member.metadata,
      evs: { hp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 100 } } }] }))
      .toThrow("EV");
  });

  it("keeps an unbounded validated Ranch separate from the six-member party", () => {
    const storage = addPokemonToStorage(createEmptyPlayerPokemonStorage(), party.members[0]!);
    expect(parsePlayerPokemonStorage(storage)).toEqual(storage);
    expect(() => addPokemonToStorage(storage, party.members[0]!)).toThrow("déjà stocké");
  });

  it("transfers Pokemon between party and Ranch while preserving a valid active member", () => {
    const second = { ...party.members[0]!, id: "second" };
    const deposited = transferPokemonToStorage({ ...party, activeIndex: 1, members: [party.members[0]!, second] },
      createEmptyPlayerPokemonStorage(), "second");
    expect(deposited.party).toMatchObject({ activeIndex: 0, members: [{ id: "starter" }] });
    expect(deposited.storage.members).toMatchObject([{ id: "second" }]);
    const withdrawn = transferPokemonToParty(deposited.party, deposited.storage, "second");
    expect(withdrawn.party).toMatchObject({ activeIndex: 0, members: [{ id: "starter" }, { id: "second" }] });
    expect(withdrawn.storage.members).toEqual([]);
  });

  it("keeps at least one party member and enforces the six-member limit", () => {
    expect(() => transferPokemonToStorage(party, createEmptyPlayerPokemonStorage(), "starter")).toThrow("au moins un");
    const fullParty = { ...party, members: Array.from({ length: 6 }, (_, index) => ({
      ...party.members[0]!, id: `pokemon-${index}` })), activeIndex: 0 };
    const storage = { ...createEmptyPlayerPokemonStorage(), members: [{ ...party.members[0]!, id: "stored" }] };
    expect(() => transferPokemonToParty(fullParty, storage, "stored")).toThrow("six Pokémon");
  });

  it("moves a selected Pokemon to the party lead without changing its identity", () => {
    const second = { ...party.members[0]!, id: "second", nickname: "Second" };
    const result = movePokemonToPartyFront({ ...party, activeIndex: 0, members: [party.members[0]!, second] }, "second");
    expect(result).toMatchObject({ activeIndex: 0, members: [{ id: "second", nickname: "Second" }, { id: "starter" }] });
    expect(() => movePokemonToPartyFront(party, "missing")).toThrow("absent de l'équipe");
  });

  it("reorders move slots in the canonical party or Ranch state", () => {
    const twoMoves = { ...party.members[0]!, moves: [party.members[0]!.moves[0]!,
      { internalName: "THUNDERBOLT", pp: 12, maxPp: 15 }] };
    const reorderedParty = reorderPokemonMoves({ ...party, members: [twoMoves] }, createEmptyPlayerPokemonStorage(),
      "starter", 0, 1);
    expect(reorderedParty.party.members[0]?.moves.map((move) => move.internalName))
      .toEqual(["THUNDERBOLT", "TACKLE"]);
    expect(twoMoves.moves.map((move) => move.internalName)).toEqual(["TACKLE", "THUNDERBOLT"]);
    const ranch = { ...createEmptyPlayerPokemonStorage(), members: [twoMoves] };
    expect(reorderPokemonMoves(createEmptyPlayerParty(), ranch, "starter", 1, 0).storage.members[0]?.moves[0]?.internalName)
      .toBe("THUNDERBOLT");
    expect(() => reorderPokemonMoves(party, createEmptyPlayerPokemonStorage(), "starter", 0, 2)).toThrow("Position");
  });

  it("heals HP, status and PP immutably", () => {
    const healed = healPlayerParty(party);
    expect(healed.members[0]).toMatchObject({ hp: 35, majorStatus: null, moves: [{ pp: 35, maxPp: 35 }] });
    expect(party.members[0]).toMatchObject({ hp: 4, majorStatus: { kind: "poison" }, moves: [{ pp: 2 }] });
  });

  it("round-trips mutable battle resources through the engine team", () => {
    const visualParty = { ...party, members: party.members.map((member) => ({ ...member,
      metadata: { ...member.metadata, form: 2, shiny: true, gender: "female" as const } })) };
    const team = playerPartyToBattleTeam(visualParty, catalog);
    expect(team.members[0]).toMatchObject({ species: "PIKACHU", name: "Pikachu", hp: 4, ability: "QUICKFEET",
      appearance: { form: 2, shiny: true, gender: "female" },
      moves: [{ pp: 2, move: { internalName: "TACKLE", name: "Charge" } }] });
    const result = { ...team, members: team.members.map((member) => ({ ...member, hp: 1, majorStatus: { kind: "burn" as const },
      moves: member.moves.map((slot) => ({ ...slot, pp: 1 })) })) };
    expect(storeBattleTeam(visualParty, result).members[0]).toMatchObject({ hp: 1, majorStatus: { kind: "burn" },
      metadata: { form: 2, shiny: true, gender: "female" }, moves: [{ pp: 1 }] });
  });

  it("blocks unsupported battle mechanics explicitly", () => {
    expect(() => playerPartyToBattleTeam({ ...party, members: [{ ...party.members[0]!, ability: "LEVITATE" }] }, catalog)).toThrow("Talent");
    expect(() => playerPartyToBattleTeam(party, { ...catalog, moves: [{ ...catalog.moves[0]!, functionCode: "999" }] })).toThrow("Fonction");
  });

  it("creates a levelled story Pokemon from extracted definitions and adds it to an empty party", () => {
    const creationCatalog: PlayerCreationCatalog = { ...catalog, pokemon: [{ ...catalog.pokemon[0]!,
      baseStats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
      abilities: ["STATIC"], growthRate: "Medium", baseExperience: 112, genderRate: "Female50Percent", happiness: 70,
      levelUpMoves: [{ level: 1, move: "TACKLE" }] }] };
    const pokemon = createPersistentPokemon("starter-1", "PIKACHU", 5, creationCatalog);
    expect(pokemon).toMatchObject({ id: "starter-1", species: "PIKACHU", level: 5, hp: 19, stats: { maxHp: 19 },
      ability: "STATIC", moves: [{ internalName: "TACKLE", pp: 35, maxPp: 35 }] });
    expect(pokemon.experience).toBe(125);
    expect(addPokemonToParty(createEmptyPlayerParty(), pokemon)).toMatchObject({ activeIndex: 0, members: [{ species: "PIKACHU" }] });
  });

  it("matches the source IV, EV and nature formulas in source stat order", () => {
    const definition = { baseStats: { hp: 35, attack: 55, defense: 40, speed: 90,
      specialAttack: 50, specialDefense: 50 } };
    const metadata = { ...createPersistentPokemonMetadata("formula", "PIKACHU", 50), nature: "ADAMANT" as const,
      ivs: { hp: 31, attack: 31, defense: 31, speed: 31, specialAttack: 31, specialDefense: 31 },
      evs: { hp: 252, attack: 252, defense: 0, speed: 0, specialAttack: 0, specialDefense: 0 } };
    expect(calculatePokemonStats(definition, 50, metadata)).toEqual({
      maxHp: 142, attack: 117, defense: 60, speed: 110, specialAttack: 63, specialDefense: 70,
    });
    expect(calculatePokemonStats({ baseStats: { ...definition.baseStats, hp: 1 } }, 50, metadata).maxHp).toBe(1);
  });

  it("reconciles legacy stats without healing damage or knocking out a living Pokemon", () => {
    const creationCatalog: PlayerCreationCatalog = { ...catalog, pokemon: [{ ...catalog.pokemon[0]!,
      baseStats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
      abilities: ["STATIC"], growthRate: "Medium", baseExperience: 112, genderRate: "Female50Percent", happiness: 70,
      levelUpMoves: [{ level: 1, move: "TACKLE" }] }] };
    const living = { ...party.members[0]!, stats: { ...party.members[0]!.stats, maxHp: 100 }, hp: 1 };
    const reconciled = recalculatePersistentPokemonStats(living, creationCatalog);
    expect(reconciled.stats).toEqual(calculatePokemonStats(creationCatalog.pokemon[0]!, living.level, living.metadata));
    expect(reconciled.hp).toBe(1);
    expect(recalculatePersistentPokemonStats({ ...living, hp: 0 }, creationCatalog).hp).toBe(0);
  });

  it("records source-compatible owner, species and obtain data when a Pokemon is created", () => {
    const creationCatalog: PlayerCreationCatalog = { ...catalog, pokemon: [{ ...catalog.pokemon[0]!,
      baseStats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
      abilities: ["STATIC"], growthRate: "Medium", baseExperience: 112, genderRate: "AlwaysFemale", happiness: 42,
      levelUpMoves: [{ level: 1, move: "TACKLE" }] }] };
    const pokemon = createPersistentPokemon("gift-1", "PIKACHU", 5, creationCatalog, {
      owner: { trainerId: 0x1234_5678, name: "Ariane", pronouns: "feminine" },
      origin: { method: "encounter", mapId: 2, receivedAt: "2026-10-03T00:00:00.000Z", ball: "POKEBALL" },
    });
    expect(pokemon.metadata).toMatchObject({ gender: "female", happiness: 42,
      owner: { trainerId: 0x1234_5678, publicId: 0x5678, name: "Ariane", pronouns: "feminine" },
      origin: { method: "encounter", mapId: 2, level: 5, receivedAt: "2026-10-03T00:00:00.000Z", ball: "POKEBALL" },
    });
    const publicIdentity = publicPokemonIdentity(pokemon);
    expect(publicIdentity).toMatchObject({ species: "PIKACHU", gender: "female",
      originalTrainer: { publicId: 0x5678, name: "Ariane", pronouns: "feminine" } });
    expect(JSON.stringify(publicIdentity)).not.toContain("trainerId");
    expect(JSON.stringify(publicIdentity)).not.toContain("ivs");
  });

  it("uses the source growth curves and applies level-up stats without healing existing damage", () => {
    const creationCatalog: PlayerCreationCatalog = { ...catalog, pokemon: [{ ...catalog.pokemon[0]!,
      baseStats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
      abilities: ["STATIC"], growthRate: "Parabolic", baseExperience: 112, genderRate: "Female50Percent", happiness: 70,
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
