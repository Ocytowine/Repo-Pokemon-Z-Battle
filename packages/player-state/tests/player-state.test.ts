import { describe, expect, it } from "vitest";
import { addPokemonToParty, addPokemonToStorage, applySharedBattleExperience, calculatePokemonStats, createDefaultPlayerAvatarSelection, createDefaultPlayerProfile, createEmptyPlayerParty,
  createEmptyPlayerPokemonStorage,
  createPersistentPokemon, createPersistentPokemonMetadata, createPlayerTrainerIdentity, declinePendingPokemonMove,
  experienceAtLevel, grantPokemonExperience,
  learnPendingPokemonMove, pokemonEvolutionCandidates, pokemonLevelEvolutionCandidates, pokemonZLevelCap,
  resolvePendingPokemonEvolution,
  usePokemonEvolutionItem, useRareCandy,
  healPlayerParty, loadPlayerAvatarSelection, parsePlayerAvatarSelection,
  loadSessionPlayerAvatarSelection, parsePlayerParty, parsePlayerPokemonStorage, parsePlayerProfile, persistSessionPlayerAvatarSelection,
  movePokemonToPartyFront, playerPartyToBattleTeam, pokemonZParticipantExperience, publicPokemonIdentity, recalculatePersistentPokemonStats,
  reorderPokemonMoves, storeBattleTeam, storeOwnedBattleResults, transferPokemonToParty, transferPokemonToStorage, type PlayerBattleCatalog,
  type PlayerCreationCatalog, type PlayerPartyState } from "../src/index.js";
import { createTeamBattleState, type SharedBattleOwnerSettlement, type SharedBattleParticipation } from "@pokemon-z-battle/battle-engine";

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
    expect(team.members[0]).toMatchObject({ species: "PIKACHU", name: "Pikachu", hp: 4,
      happiness: visualParty.members[0]!.metadata.happiness, ability: "QUICKFEET",
      appearance: { form: 2, shiny: true, gender: "female" },
      moves: [{ pp: 2, move: { internalName: "TACKLE", name: "Charge" } }] });
    const result = { ...team, members: team.members.map((member) => ({ ...member, hp: 1, happiness: 12,
      majorStatus: { kind: "burn" as const },
      moves: member.moves.map((slot) => ({ ...slot, pp: 1 })) })) };
    expect(storeBattleTeam(visualParty, result).members[0]).toMatchObject({ hp: 1, majorStatus: { kind: "burn" },
      metadata: { form: 2, shiny: true, gender: "female", happiness: 12 }, moves: [{ pp: 1 }] });
  });

  it("preserves inert source abilities and still blocks malformed or unsupported battle mechanics", () => {
    expect(playerPartyToBattleTeam({ ...party,
      members: [{ ...party.members[0]!, ability: "CHEEKPOUCH" }] }, catalog).members[0]?.ability)
      .toBe("CHEEKPOUCH");
    expect(() => playerPartyToBattleTeam({ ...party,
      members: [{ ...party.members[0]!, ability: "bad ability" }] }, catalog)).toThrow("Identifiant de talent invalide");
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

  it("projects a detailed move catalog to the strict public battle shape", () => {
    const detailedCatalog = { ...catalog, moves: [{ ...catalog.moves[0]!, flags: "ab",
      targetCode: "SingleNonUser", description: "Une description locale." }] };
    const move = playerPartyToBattleTeam(party, detailedCatalog).members[0]!.moves[0]!.move;

    expect(Object.keys(move).sort()).toEqual([
      "accuracy", "category", "effectChance", "flags", "functionCode", "id", "internalName", "name",
      "power", "pp", "priority", "targetCode", "type",
    ]);
    expect(move).toHaveProperty("targetCode", "00");
    expect(move).not.toHaveProperty("description");
  });

  it("projects decimal PBS weights to the integer battle unit used by capture", () => {
    const captureCatalog: PlayerBattleCatalog = { ...catalog, pokemon: [{ ...catalog.pokemon[0]!,
      captureRate: 190, weight: 6.9,
      baseStats: { speed: 90 } }] };

    expect(playerPartyToBattleTeam(party, captureCatalog).members[0]?.capture)
      .toEqual({ rate: 190, baseSpeed: 90, weight: 69 });
  });

  it("never starts a battle with a fainted active Pokemon", () => {
    const reserve = { ...party.members[0]!, id: "reserve", hp: 3 };
    const team = playerPartyToBattleTeam({ ...party,
      members: [{ ...party.members[0]!, hp: 0 }, reserve] }, catalog);
    expect(team.activeIndex).toBe(1);
    expect(() => playerPartyToBattleTeam({ ...party,
      members: [{ ...party.members[0]!, hp: 0 }] }, catalog)).toThrow(/entièrement K\.O\./u);
  });

  it("restores only one owner's resources from a mixed shared camp", () => {
    const hostTeam = playerPartyToBattleTeam(party, catalog);
    const guest = { ...hostTeam.members[0]!, id: "guest-mon", hp: 18 };
    const state = createTeamBattleState({ player: [{ ...hostTeam.members[0]!, hp: 1 }, guest],
      opponent: [{ ...guest, id: "wild" }] });
    const participation: SharedBattleParticipation = { battleOwnerId: "host", format: "single", camps: {
      player: { trainerIds: ["host", "guest"], activeMemberId: "starter", members: [
        { ownerId: "host", battler: state.teams.player.members[0]! },
        { ownerId: "guest", battler: state.teams.player.members[1]! },
      ] },
      opponent: { trainerIds: [], activeMemberId: "wild",
        members: [{ ownerId: null, battler: state.teams.opponent.members[0]! }] },
    } };
    expect(storeOwnedBattleResults(party, participation, state, "host").members[0]).toMatchObject({ id: "starter", hp: 1 });
    expect(storeOwnedBattleResults(party, participation, state, "guest").members[0]).toMatchObject({ id: "starter", hp: 4 });
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

  it("uses Rare Candies up to Z's story cap and exposes evolution candidates", () => {
    const pikachu = { ...catalog.pokemon[0]!,
      baseStats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
      abilities: ["STATIC"], growthRate: "Parabolic", baseExperience: 112, genderRate: "Female50Percent", happiness: 70,
      levelUpMoves: [{ level: 1, move: "TACKLE" }, { level: 6, move: "GROWL" }],
      evolutions: [{ species: "RAICHU", method: "Level", parameter: "6" }] };
    const raichu = { ...pikachu, internalName: "RAICHU", name: "Raichu", abilities: ["SURGE"],
      baseStats: { hp: 60, attack: 90, defense: 55, specialAttack: 90, specialDefense: 80, speed: 110 },
      levelUpMoves: [{ level: 6, move: "GROWL" }], evolutions: [] };
    const creationCatalog: PlayerCreationCatalog = { ...catalog, pokemon: [pikachu, raichu],
      moves: [...catalog.moves, { ...catalog.moves[0]!, internalName: "GROWL", name: "Rugissement", pp: 40 }] };
    const created = createPersistentPokemon("candy-mon", "PIKACHU", 5, creationCatalog);
    const result = useRareCandy({ RARECANDY: 5 }, { schemaVersion: 1, activeIndex: 0, members: [created] },
      created.id, 3, 6, creationCatalog);
    expect(result).toMatchObject({ ok: true, inventory: { RARECANDY: 4 }, consumed: 1, levelsGained: 1,
      pokemon: { level: 6, pendingEvolution: { species: "RAICHU", method: "Level", parameter: "6" } }, learnedMoves: ["GROWL"],
      evolutionCandidates: [{ species: "RAICHU", method: "Level", parameter: "6" }] });
    if (!result.ok) throw new Error("Bonbon Rare attendu.");
    expect(resolvePendingPokemonEvolution(result.party, created.id, true, creationCatalog))
      .toMatchObject({ ok: true, previousSpecies: "PIKACHU",
        pokemon: { species: "RAICHU", ability: "SURGE" } });
    expect(pokemonZLevelCap({})).toBe(17);
    expect(pokemonZLevelCap({ "88": true, "97": true })).toBe(36);
  });

  it("keeps full-moveset level attacks pending until an explicit replacement", () => {
    const full = { ...party.members[0]!, id: "pending-mon",
      moves: ["TACKLE", "A", "B", "C"].map((internalName) => ({ internalName, pp: 10, maxPp: 10 })),
      pendingMoves: ["GROWL"] };
    const currentParty = { schemaVersion: 1 as const, activeIndex: 0, members: [full] };
    expect(learnPendingPokemonMove(currentParty, full.id, { internalName: "GROWL", pp: 40 }))
      .toMatchObject({ ok: false, reason: "replacement-required" });
    expect(learnPendingPokemonMove(currentParty, full.id, { internalName: "GROWL", pp: 40 }, 2))
      .toMatchObject({ ok: true, forgottenMove: "B", pokemon: { pendingMoves: [],
        moves: [{ internalName: "TACKLE" }, { internalName: "A" }, { internalName: "GROWL", pp: 40 },
          { internalName: "C" }] } });
    expect(declinePendingPokemonMove(currentParty, full.id, "GROWL"))
      .toMatchObject({ ok: true, pokemon: { moves: full.moves } });
    expect(pokemonLevelEvolutionCandidates(full, { ...catalog, pokemon: [] })).toEqual([]);
  });

  it("uses source evolution stones atomically and applies imbued IV gains", () => {
    const base = party.members[0]!;
    const source = { ...base, species: "PIKACHU", heldItem: null,
      metadata: { ...base.metadata, gender: "female" as const,
        ivs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 } } };
    const definition = { id: 25, internalName: "PIKACHU", name: "Pikachu", types: ["ELECTRIC"],
      baseStats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
      abilities: ["STATIC"], growthRate: "Medium", baseExperience: 112, genderRate: "Female50Percent", happiness: 70,
      levelUpMoves: [{ level: 1, move: "TACKLE" }],
      evolutions: [{ species: "RAICHU", method: "Item", parameter: "THUNDERSTONEIMBUIDA" }] };
    const creationCatalog: PlayerCreationCatalog = { ...catalog, pokemon: [definition,
      { ...definition, id: 26, internalName: "RAICHU", name: "Raichu", abilities: ["SURGE"], evolutions: [] }] };
    const result = usePokemonEvolutionItem({ THUNDERSTONEIMBUIDA: 1 },
      { schemaVersion: 1, activeIndex: 0, members: [source] }, source.id, "THUNDERSTONEIMBUIDA", creationCatalog);
    expect(result).toMatchObject({ ok: true, inventory: {}, individualValuesRaised: 42,
      pokemon: { species: "RAICHU", ability: "SURGE" } });
  });

  it("evaluates Z's time, held-item and party evolution contexts", () => {
    const base = { ...party.members[0]!, metadata: { ...party.members[0]!.metadata, happiness: 220 },
      heldItem: "KINGSROCK" };
    const companion = { ...party.members[0]!, id: "moon", species: "LUNATONE" };
    const definition = { id: 1, internalName: "PIKACHU", name: "Pikachu", types: ["ELECTRIC"],
      baseStats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
      abilities: ["STATIC"], growthRate: "Medium", baseExperience: 112, genderRate: "Female50Percent", happiness: 70,
      levelUpMoves: [{ level: 1, move: "TACKLE" }], evolutions: [
        { species: "DAYMON", method: "HappinessDay", parameter: null },
        { species: "KINGMON", method: "DayHoldItem", parameter: "KINGSROCK" },
        { species: "PARTYMON", method: "HasInParty", parameter: "LUNATONE" },
      ] };
    const creationCatalog: PlayerCreationCatalog = { ...catalog, pokemon: [definition] };
    expect(pokemonEvolutionCandidates(base, creationCatalog,
      { trigger: "level", hour: 12, party: { schemaVersion: 1, activeIndex: 0, members: [base, companion] } })
      .map((candidate) => candidate.method)).toEqual(["HappinessDay", "DayHoldItem", "HasInParty"]);
    expect(pokemonEvolutionCandidates(base, creationCatalog, { trigger: "level", hour: 23 })
      .map((candidate) => candidate.method)).toEqual([]);
  });
});

describe("Pokemon Z shared battle experience", () => {
  const creationCatalog: PlayerCreationCatalog = { ...catalog, pokemon: [{ ...catalog.pokemon[0]!,
    baseStats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
    abilities: ["STATIC"], growthRate: "Medium", baseExperience: 112, genderRate: "Female50Percent", happiness: 70,
    levelUpMoves: [{ level: 1, move: "TACKLE" }] }] };

  it("reproduces the final repexp participant formula and switch ordering", () => {
    const base = { defeatedLevel: 5, defeatedBaseExperience: 112, recipientLevel: 5,
      participantCount: 1, luckyEgg: false };
    expect(pokemonZParticipantExperience(base, { trainerBattle: false, levelCap: 17 })).toBe(113);
    expect(pokemonZParticipantExperience(base, { trainerBattle: true, levelCap: 17 })).toBe(169);
    expect(pokemonZParticipantExperience({ ...base, luckyEgg: true }, { trainerBattle: true, levelCap: 17 })).toBe(253);
    expect(pokemonZParticipantExperience(base, { trainerBattle: false, levelCap: 17,
      boostTenPercent: true, boostTwentyPercent: true })).toBe(148);
    expect(pokemonZParticipantExperience(base, { trainerBattle: false, levelCap: 17,
      experienceDisabled: true })).toBe(0);
    expect(pokemonZParticipantExperience({ ...base, recipientLevel: 18 }, { trainerBattle: false, levelCap: 17,
      experienceDisabled: true })).toBe(1);
  });

  it("uses the whole camp participant count while updating only the current owner's party", () => {
    const first = createPersistentPokemon("host-a", "PIKACHU", 5, creationCatalog);
    const second = createPersistentPokemon("host-b", "PIKACHU", 5, creationCatalog);
    const defeated = { ...playerPartyToBattleTeam({ schemaVersion: 1, activeIndex: 0, members: [first] }, creationCatalog)
      .members[0]!, id: "wild-pikachu" };
    const settlement: SharedBattleOwnerSettlement = { ownerId: "host", side: "player", won: true,
      resourceMemberIds: [first.id, second.id], defeatCredits: [{ turn: 2, defeatedBattler: defeated,
        participantCount: 2, recipientMemberIds: [first.id, second.id] }] };
    const applied = applySharedBattleExperience({ schemaVersion: 1, activeIndex: 0, members: [first, second] },
      settlement, creationCatalog, { trainerBattle: false, levelCap: 17 });
    expect(applied.gains).toEqual([
      expect.objectContaining({ recipientMemberId: "host-a", calculated: 57, gained: 57 }),
      expect.objectContaining({ recipientMemberId: "host-b", calculated: 57, gained: 57 }),
    ]);
    expect(applied.party.members.map((pokemon) => pokemon.experience)).toEqual([182, 182]);
  });
});
