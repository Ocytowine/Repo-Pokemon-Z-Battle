import { calculatePokemonStats, createDefaultPlayerAvatarSelection, createPersistentPokemonMetadata,
  experienceAtLevel, POKEMON_NATURES, sourcePokemonAbility, sourcePokemonGender, sourceShiny,
  type PersistentPokemon,
  type PlayerAvatarSelection, type PlayerCreationCatalog } from "@pokemon-z-battle/player-state";
import { RubyMarshalReader } from "@pokemon-z-battle/extractor/ruby-marshal/reader";
import type { RubyHash, RubyMarshalValue, RubyObject } from "@pokemon-z-battle/extractor/ruby-marshal/types";
import { createSourceEventState, parseSourceEventState } from "./source-event-state.js";
import { parseSourceSaveSlotSnapshot, type SourceSaveSlotSnapshot } from "./source-save-slots.js";
import { createSourceWorldSave } from "./source-world-save.js";

const MAX_RXDATA_BYTES = 4 * 1024 * 1024;

interface CatalogRecord { readonly id: number; readonly internalName: string; }
export interface RxdataImportCatalog {
  readonly pokemon: PlayerCreationCatalog["pokemon"];
  readonly moves: PlayerCreationCatalog["moves"];
  readonly items: readonly CatalogRecord[];
  readonly trainerTypes: readonly CatalogRecord[];
  readonly avatars: readonly { readonly id: string; readonly trainerType: string;
    readonly presentation: string }[];
}
export interface RxdataImportPreview {
  readonly snapshot: SourceSaveSlotSnapshot;
  readonly trainerName: string;
  readonly partyCount: number;
  readonly storageCount: number;
  readonly itemCount: number;
  readonly warnings: readonly string[];
}

function sourceObject(value: RubyMarshalValue, className: string): RubyObject {
  if (value === null || Array.isArray(value) || typeof value !== "object" || value.kind !== "object"
    || value.className !== className) throw new Error(`Bloc ${className} absent ou invalide.`);
  return value;
}
function sourceInteger(value: RubyMarshalValue | undefined, label: string, max = Number.MAX_SAFE_INTEGER): number {
  const number = typeof value === "bigint" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 0 || number > max) {
    throw new Error(`${label} invalide dans la sauvegarde d'origine.`);
  }
  return number;
}
function sourceString(value: RubyMarshalValue | undefined, label: string): string {
  if (value === null || typeof value !== "object" || Array.isArray(value) || value.kind !== "string") {
    throw new Error(`${label} invalide dans la sauvegarde d'origine.`);
  }
  return value.text;
}
function sourceArray(value: RubyMarshalValue | undefined, label: string): RubyMarshalValue[] {
  if (!Array.isArray(value)) throw new Error(`${label} invalide dans la sauvegarde d'origine.`);
  return value;
}
function sourceHash(value: RubyMarshalValue | undefined, label: string): RubyHash {
  if (value === null || typeof value !== "object" || Array.isArray(value) || value.kind !== "hash") {
    throw new Error(`${label} invalide dans la sauvegarde d'origine.`);
  }
  return value;
}
function idLookup<T extends CatalogRecord>(records: readonly T[]): ReadonlyMap<number, T> {
  return new Map(records.map((record) => [record.id, record]));
}
function levelFromExperience(experience: number, growthRate: string): number {
  let level = 1;
  for (let next = 2; next <= 100 && experienceAtLevel(next, growthRate) <= experience; next += 1) level = next;
  return level;
}
function trainingValues(value: RubyMarshalValue | undefined, label: string) {
  const values = sourceArray(value, label);
  if (values.length !== 6) throw new Error(`${label} invalides.`);
  const [hp, attack, defense, speed, specialAttack, specialDefense] = values
    .map((entry) => sourceInteger(entry, label));
  return { hp: hp!, attack: attack!, defense: defense!, speed: speed!, specialAttack: specialAttack!,
    specialDefense: specialDefense! };
}
function convertPokemon(value: RubyMarshalValue, index: number,
  speciesById: ReadonlyMap<number, PlayerCreationCatalog["pokemon"][number]>,
  movesById: ReadonlyMap<number, PlayerCreationCatalog["moves"][number]>,
  itemsById: ReadonlyMap<number, CatalogRecord>): PersistentPokemon {
  const original = sourceObject(value, "PokeBattle_Pokemon").ivars;
  const speciesId = sourceInteger(original["@species"], "Espèce");
  const definition = speciesById.get(speciesId);
  if (definition === undefined) throw new Error(`Espèce ${speciesId} absente du portage (Pokémon ${index + 1}).`);
  const experience = sourceInteger(original["@exp"], "Expérience");
  const level = levelFromExperience(experience, definition.growthRate);
  const personalId = sourceInteger(original["@personalID"], "Identifiant Pokémon", 0xffff_ffff);
  const trainerId = sourceInteger(original["@trainerID"], "Dresseur d'origine", 0xffff_ffff);
  const id = `rxdata-${personalId.toString(16)}-${index}`;
  const ivs = trainingValues(original["@iv"], "IV");
  const evs = trainingValues(original["@ev"], "EV");
  const ownerName = sourceString(original["@ot"], "Dresseur d'origine");
  const originalOwnerGender = sourceInteger(original["@otgender"], "Genre du Dresseur", 2);
  const nickname = sourceString(original["@name"], "Surnom").trim();
  const metadata = { ...createPersistentPokemonMetadata(id, definition.internalName, level), personalId,
    ivs, evs, nature: POKEMON_NATURES[personalId % 25]!, happiness: sourceInteger(original["@happiness"], "Bonheur", 255),
    eggSteps: sourceInteger(original["@eggsteps"], "Pas d'œuf"),
    gender: sourcePokemonGender(definition.genderRate, personalId),
    owner: { trainerId, publicId: trainerId & 0xffff, name: ownerName || null,
      pronouns: originalOwnerGender === 0 ? "masculine" as const : originalOwnerGender === 1
        ? "feminine" as const : null },
    origin: { method: "unknown" as const,
      mapId: sourceInteger(original["@obtainMap"], "Carte d'obtention") || null,
      level: sourceInteger(original["@obtainLevel"], "Niveau d'obtention", 100) || level,
      receivedAt: null, hatchedMapId: sourceInteger(original["@hatchedMap"], "Carte d'éclosion") || null,
      hatchedAt: null,
      ball: itemsById.get(sourceInteger(original["@ballused"], "Ball de capture"))?.internalName ?? null },
    markings: sourceInteger(original["@markings"], "Marquages", 255),
    shiny: sourceShiny(personalId, trainerId),
  };
  const stats = calculatePokemonStats(definition, level, metadata);
  const hp = sourceInteger(original["@hp"], "PV", stats.maxHp);
  const statusId = sourceInteger(original["@status"], "Statut", 5);
  const majorStatus = statusId === 0 ? null : statusId === 1
    ? { kind: "sleep" as const, turnsRemaining: Math.min(10, sourceInteger(original["@statusCount"], "Sommeil")) }
    : statusId === 2 ? { kind: "poison" as const, toxicCounter: null }
      : statusId === 3 ? { kind: "burn" as const } : statusId === 4
        ? { kind: "paralysis" as const } : { kind: "frozen" as const };
  const heldItemId = sourceInteger(original["@item"], "Objet tenu");
  const heldItem = heldItemId === 0 ? null : itemsById.get(heldItemId)?.internalName;
  if (heldItem === undefined) throw new Error(`Objet tenu ${heldItemId} absent du portage.`);
  const moves = sourceArray(original["@moves"], "Capacités").filter((move) => move !== null)
    .map((move) => {
      const fields = sourceObject(move, "PBMove").ivars;
      const moveId = sourceInteger(fields["@id"], "Capacité");
      if (moveId === 0) return null;
      const definition = movesById.get(moveId);
      if (definition === undefined) throw new Error(`Capacité ${moveId} absente du portage.`);
      const ppUps = sourceInteger(fields["@ppup"], "PP Plus", 3);
      const maxPp = definition.pp + Math.floor(definition.pp * ppUps / 5);
      return { internalName: definition.internalName, pp: sourceInteger(fields["@pp"], "PP", maxPp),
        maxPp, ppUps, basePp: definition.pp };
    }).filter((move) => move !== null);
  if (moves.length === 0 || moves.length > 4) throw new Error(`Capacités invalides pour ${definition.internalName}.`);
  return { id, species: definition.internalName, nickname: nickname || null, level, experience,
    stats, hp, majorStatus, ability: sourcePokemonAbility(definition.abilities, personalId), heldItem,
    moves, metadata };
}

/** Read-only conversion. Callers must show the preview before storing its snapshot. */
export function convertRxdataSave(bytes: Uint8Array, catalog: RxdataImportCatalog,
  savedAt = Date.now()): RxdataImportPreview {
  if (bytes.length < 32 || bytes.length > MAX_RXDATA_BYTES) throw new Error("Taille du fichier .rxdata invalide.");
  const roots = new RubyMarshalReader(bytes).readSequence(15);
  const trainer = sourceObject(roots[0]!, "PokeBattle_Trainer").ivars;
  const switches = sourceArray(sourceObject(roots[5]!, "Game_Switches").ivars["@data"], "Switches");
  const variables = sourceArray(sourceObject(roots[6]!, "Game_Variables").ivars["@data"], "Variables");
  const selfSwitches = sourceHash(sourceObject(roots[7]!, "Game_SelfSwitches").ivars["@data"], "Self switches");
  const bag = sourceArray(sourceObject(roots[13]!, "PokemonBag").ivars["@pockets"], "Sac");
  const storage = sourceArray(sourceObject(roots[14]!, "PokemonStorage").ivars["@boxes"], "Boîtes");
  const playerPosition = sourceObject(roots[10]!, "Game_Player").ivars;
  sourceObject(roots[9]!, "PokemonMapFactory");
  const globalMetadata = sourceObject(roots[11]!, "PokemonGlobalMetadata").ivars;
  const mapMetadata = sourceObject(roots[12]!, "PokemonMapMetadata").ivars;
  const speciesById = idLookup(catalog.pokemon.filter((entry): entry is typeof entry & { id: number } =>
    Number.isInteger(entry.id)));
  const movesById = idLookup(catalog.moves.filter((entry): entry is typeof entry & { id: number } =>
    Number.isInteger(entry.id)));
  const itemsById = idLookup(catalog.items);
  let pokemonIndex = 0;
  const party = sourceArray(trainer["@party"], "Équipe").filter((entry) => entry !== null)
    .map((entry) => convertPokemon(entry, pokemonIndex++, speciesById, movesById, itemsById));
  if (party.length > 6) throw new Error("Équipe de plus de six Pokémon.");
  const boxed = storage.flatMap((box) => sourceArray(sourceObject(box, "PokemonBox").ivars["@pokemon"], "Boîte")
    .filter((entry) => entry !== null)
    .map((entry) => convertPokemon(entry, pokemonIndex++, speciesById, movesById, itemsById)));
  const inventory: Record<string, number> = {};
  for (const pocket of bag) for (const tuple of sourceArray(pocket, "Poche")) {
    const [id, count] = sourceArray(tuple, "Objet du sac");
    const itemId = sourceInteger(id, "Objet du sac");
    const quantity = sourceInteger(count, "Quantité");
    if (quantity === 0) continue;
    const item = itemsById.get(itemId);
    if (item === undefined) throw new Error(`Objet ${itemId} absent du portage.`);
    inventory[item.internalName] = (inventory[item.internalName] ?? 0) + quantity;
  }
  const switchState: Record<string, boolean> = {};
  switches.forEach((value, id) => { if (value === true) switchState[String(id)] = true; });
  const variableState: Record<string, number> = {};
  let unconvertedVariables = 0;
  variables.forEach((value, id) => {
    if (typeof value === "number" && Number.isSafeInteger(value) && value !== 0) variableState[String(id)] = value;
    else if (value !== null && value !== 0 && value !== false) unconvertedVariables += 1;
  });
  const selfSwitchState: Record<string, boolean> = {};
  for (const [key, enabled] of selfSwitches.entries) {
    if (enabled !== true) continue;
    const tuple = sourceArray(key, "Clé d'événement");
    if (tuple.length !== 3) throw new Error("Clé d'événement invalide.");
    const letter = sourceString(tuple[2], "Lettre d'événement");
    selfSwitchState[`${sourceInteger(tuple[0], "Carte")}:${sourceInteger(tuple[1], "Événement")}:${letter}`] = true;
  }
  const mapId = sourceInteger(roots[4], "Carte", 999);
  const x = sourceInteger(playerPosition["@x"], "Position X");
  const y = sourceInteger(playerPosition["@y"], "Position Y");
  const directionNumber = sourceInteger(playerPosition["@direction"], "Direction");
  const direction = ({ 2: "down", 4: "left", 6: "right", 8: "up" } as const)[directionNumber as 2 | 4 | 6 | 8];
  if (direction === undefined) throw new Error("Direction du joueur invalide.");
  const trainerName = sourceString(trainer["@name"], "Nom du joueur").trim();
  if (!trainerName || trainerName.length > 12) throw new Error("Nom du joueur incompatible avec l'application.");
  const trainerId = sourceInteger(trainer["@id"], "Identifiant joueur", 0xffff_ffff);
  const trainerTypeId = sourceInteger(trainer["@trainertype"], "Type de joueur");
  const trainerType = catalog.trainerTypes.find((entry) => entry.id === trainerTypeId)?.internalName;
  const avatar = catalog.avatars.find((entry) => entry.trainerType === trainerType);
  const defaultPlayer = createDefaultPlayerAvatarSelection();
  const player: PlayerAvatarSelection = { ...defaultPlayer,
    avatarId: avatar !== undefined && /^legacy-\d+$/u.test(avatar.id) ? avatar.id : defaultPlayer.avatarId,
    profile: { ...defaultPlayer.profile, displayName: trainerName,
      pronouns: avatar?.presentation === "masculine" ? "masculine"
        : avatar?.presentation === "feminine" ? "feminine" : "neutral",
      bodyModel: avatar?.presentation === "feminine" ? "legacy-feminine" : "legacy-masculine" },
    trainerIdentity: { schemaVersion: 1, trainerId, publicId: trainerId & 0xffff } };
  const seen = sourceArray(trainer["@seen"], "Pokédex vu");
  const owned = sourceArray(trainer["@owned"], "Pokédex capturé");
  const speciesNames = (values: RubyMarshalValue[]) => values.flatMap((entry, id) => entry === true
    ? [speciesById.get(id)?.internalName].filter((name): name is string => name !== undefined) : []);
  const eventState = parseSourceEventState({ ...createSourceEventState(), switches: switchState,
    variables: variableState, selfSwitches: selfSwitchState, inventory,
    money: sourceInteger(trainer["@money"], "Argent", 999_999),
    runningShoes: globalMetadata["@runningShoes"] === true, pokedexEnabled: trainer["@pokedex"] === true,
    pokedex: { seenSpecies: speciesNames(seen), caughtSpecies: speciesNames(owned),
      evolvedSpecies: [], releasedSpecies: [] },
    party: { schemaVersion: 1, activeIndex: party.length === 0 ? null : 0, members: party },
    ranch: { schemaVersion: 1, members: boxed }, followerEnabled: party.length > 0,
    happinessSteps: sourceInteger(globalMetadata["@happinessSteps"] ?? 0, "Pas de bonheur") % 128,
    fieldItemEffects: { ...createSourceEventState().fieldItemEffects,
      repelSteps: Math.min(400, sourceInteger(globalMetadata["@repel"] ?? 0, "Répulsif")) } });
  const movementMode = globalMetadata["@surfing"] === true ? "surf"
    : globalMetadata["@bicycle"] === true ? "mount" : "walk";
  const worldSave = createSourceWorldSave(mapId, x, y, direction, savedAt, movementMode, eventState);
  const snapshot = parseSourceSaveSlotSnapshot({ schemaVersion: 1, savedAt, worldSave, eventState,
    player, newGame: null, fieldShortcuts: null });
  const erased = mapMetadata["@erasedEvents"];
  const erasedCount = erased !== null && typeof erased === "object" && !Array.isArray(erased)
    && erased.kind === "hash" ? erased.entries.length : 0;
  const warnings = ["Garde le fichier .rxdata d'origine : certains services personnels du fangame ne sont pas encore portés."];
  if (avatar === undefined) warnings.push(`Type de personnage ${trainerTypeId} inconnu : apparence par défaut.`);
  if (sourceInteger(trainer["@outfit"] ?? 0, "Tenue") !== 0) {
    warnings.push("La variante de tenue du fangame n'est pas encore reproduite.");
  }
  if (unconvertedVariables > 0) warnings.push(`${unconvertedVariables} variable(s) non numériques ne sont pas encore interprétées.`);
  if (erasedCount > 0) warnings.push(`${erasedCount} groupe(s) d'événements effacés ne sont pas encore restaurés.`);
  return { snapshot, trainerName, partyCount: party.length, storageCount: boxed.length,
    itemCount: Object.keys(inventory).length, warnings };
}
