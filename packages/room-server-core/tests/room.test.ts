import { MINIMAL_MOVE_CATALOG, SeededRandom, createTeamBattleState, type BattleSide, type BattlerState, type TeamBattleState } from "@pokemon-z-battle/battle-engine";
import { describe, expect, it } from "vitest";
import { AuthoritativeBattleRoom, PLAYER_RECONNECT_GRACE_MS, type PersistedRoomState } from "../src/index.js";
import { createDefaultNetworkPlayerProfile, createNetworkPlayerProfile } from "@pokemon-z-battle/multiplayer-protocol";
import { DEMO_WORLD_CATALOG, createDemoWorldState, createOverworldState, type OverworldCatalog } from "@pokemon-z-battle/overworld-engine";

const world = { catalog: DEMO_WORLD_CATALOG, initialState: createDemoWorldState() } as const;
const sourceWorld = { mapId: 3, width: 3, height: 3, passages: "fffffffff",
  blockedPoints: [{ x: 2, y: 1 }], host: { x: 1, y: 1, direction: "down" as const },
  follower: { species: "FENNEKIN", x: 0, y: 1, direction: "right" as const },
  story: { switches: { "67": true }, variables: {}, selfSwitches: {} } };
const worldWithSource = { ...world, sourceWorld } as const;

const syncedCatalog: OverworldCatalog = {
  maps: { test: { id: "test", name: "Test", width: 3, height: 1, blocked: [], transitions: [] } },
  interactions: [{ id: "sync", label: "Sync", kind: "switch", mapId: "test", at: { x: 1, y: 0 }, policy: "SYNCED", effect: { type: "flag", flag: "SYNC_DONE" } }],
};
const syncedWorld = {
  catalog: syncedCatalog,
  initialState: createOverworldState(syncedCatalog, [
    { id: "player", name: "J1", mapId: "test", x: 0, y: 0, direction: "right" },
    { id: "opponent", name: "J2", mapId: "test", x: 2, y: 0, direction: "left" },
  ]),
};

function battler(side: BattleSide): BattlerState {
  const move = side === "player" ? MINIMAL_MOVE_CATALOG.TACKLE : MINIMAL_MOVE_CATALOG.SCRATCH;
  return {
    id: side,
    species: side === "player" ? "EEVEE" : "MEOWTH",
    name: side,
    level: 50,
    types: ["NORMAL"],
    stats: { maxHp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: side === "player" ? 100 : 90 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    hp: 100,
    majorStatus: null,
    ability: null,
    heldItem: null,
    moves: [{ move, pp: move.pp }],
  };
}

function initialBattle(): TeamBattleState {
  return createTeamBattleState({ player: [battler("player")], opponent: [battler("opponent")] });
}

function reactiveBattle(): TeamBattleState {
  return createTeamBattleState({ player: [battler("player")],
    opponent: [{ ...battler("opponent"), ability: "STAMINA" }] });
}

function calculationAbilityBattle(): TeamBattleState {
  const fire = { ...MINIMAL_MOVE_CATALOG.WATERGUN, internalName: "EMBER", name: "Flammèche",
    type: "FIRE", accuracy: 0 };
  const contact = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0 };
  return createTeamBattleState({
    player: [{ ...battler("player"), ability: "REALEZA",
      majorStatus: { kind: "poison", toxicCounter: null }, moves: [{ move: fire, pp: fire.pp }] }],
    opponent: [{ ...battler("opponent"), ability: "MERCILESS",
      moves: [{ move: contact, pp: contact.pp }] }],
  });
}

function moveClassificationAbilityBattle(): TeamBattleState {
  const voice = { ...MINIMAL_MOVE_CATALOG.SWIFT, internalName: "HYPERVOICE", name: "Mégaphone",
    type: "NORMAL", accuracy: 0, flags: "k" };
  return createTeamBattleState({
    player: [{ ...battler("player"), ability: "VOZVALQUIRIA",
      moves: [{ move: voice, pp: voice.pp }] }],
    opponent: [{ ...battler("opponent"), ability: "PUNKROCK", types: ["DRAGON"] }],
  });
}

function statStatusReactionAbilityBattle(): TeamBattleState {
  const contact = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0, flags: "a" };
  return createTeamBattleState({
    player: [{ ...battler("player"), ability: "OLORPORCINO",
      moves: [{ move: contact, pp: contact.pp }] },
    { ...battler("player"), id: "host-contrary", ability: "CONTRARY",
      stages: { ...battler("player").stages, attack: -1 } }],
    opponent: [{ ...battler("opponent"), ability: "CAPATOXICA",
      moves: [{ move: contact, pp: contact.pp }] },
    { ...battler("opponent"), id: "guest-purifying", ability: "PURIFYINGSALT", types: ["GHOST"],
      majorStatus: { kind: "burn" } }],
  });
}

function typeInteractionAbilityBattle(): TeamBattleState {
  const ground = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "EARTHQUAKE", name: "Séisme",
    type: "GROUND", accuracy: 0 };
  return createTeamBattleState({
    player: [{ ...battler("player"), ability: "NORMALIZE",
      moves: [{ move: ground, pp: ground.pp }] },
    { ...battler("player"), id: "host-steelworker", ability: "STEELWORKER", types: ["STEEL"] }],
    opponent: [{ ...battler("opponent"), ability: "EARTHEATER" },
    { ...battler("opponent"), id: "guest-canasto", ability: "CANASTO", types: ["ROCK"] }],
  });
}

function globalAuraAbilityBattle(): TeamBattleState {
  const dark = { ...MINIMAL_MOVE_CATALOG.SWIFT, internalName: "DARKPULSE", name: "Vibrobscur",
    type: "DARK", accuracy: 0 };
  return createTeamBattleState({
    player: [{ ...battler("player"), ability: "DARKAURA", moves: [{ move: dark, pp: dark.pp }] },
    { ...battler("player"), id: "host-fairy-aura", ability: "FAIRYAURA", types: ["FAIRY"] }],
    opponent: [{ ...battler("opponent"), ability: "AURABREAK" },
    { ...battler("opponent"), id: "guest-golden-aura", ability: "AURADORADA", types: ["ELECTRIC"] }],
  });
}

function pokemonZConversionAbilityBattle(): TeamBattleState {
  const normal = { ...MINIMAL_MOVE_CATALOG.SWIFT, internalName: "HYPERVOICE", name: "Mégaphone",
    type: "NORMAL", accuracy: 0 };
  return createTeamBattleState({
    player: [{ ...battler("player"), ability: "TINTINEO", moves: [{ move: normal, pp: normal.pp }] },
    { ...battler("player"), id: "host-coleoptero", ability: "COLEOPTERO", types: ["BUG"] }],
    opponent: [{ ...battler("opponent"), ability: "PIELMALDITA", types: ["POISON"] },
    { ...battler("opponent"), id: "guest-electric-skin", ability: "PIELELECTRICA", types: ["ELECTRIC"] }],
  });
}

function pureTypeBoostAbilityBattle(): TeamBattleState {
  const ice = { ...MINIMAL_MOVE_CATALOG.ICEBEAM, accuracy: 0 };
  return createTeamBattleState({
    player: [{ ...battler("player"), ability: "ALBINISMO", types: ["ICE"],
      moves: [{ move: ice, pp: ice.pp }] },
    { ...battler("player"), id: "host-inflammable", ability: "INFLAMABLE", types: ["FIRE"] },
    { ...battler("player"), id: "host-rock-carrier", ability: "TRANSPORTARROCA", types: ["ROCK"] }],
    opponent: [{ ...battler("opponent"), ability: "PEDANTE", types: ["PSYCHIC"] },
    { ...battler("opponent"), id: "guest-dragons-maw", ability: "DRAGONSMAW", types: ["DRAGON"] }],
  });
}

function easyAbilityBatchBattle(): TeamBattleState {
  const special = { ...MINIMAL_MOVE_CATALOG.WATERGUN, internalName: "SWIFT", name: "Météores",
    type: "NORMAL", accuracy: 0 };
  return createTeamBattleState({
    player: [{ ...battler("player"), ability: "FLAREBOOST", majorStatus: { kind: "burn" },
      moves: [{ move: special, pp: special.pp }] },
    { ...battler("player"), id: "host-toxic-boost", ability: "TOXICBOOST" },
    { ...battler("player"), id: "host-slow-start", ability: "SLOWSTART" },
    { ...battler("player"), id: "host-surge-surfer", ability: "SURGESURFER" },
    { ...battler("player"), id: "host-silvano", ability: "SILVANO" },
    { ...battler("player"), id: "host-gale-wings", ability: "GALEWINGS" }],
    opponent: [{ ...battler("opponent"), ability: "MISTYSURGE" },
    { ...battler("opponent"), id: "guest-psychic-surge", ability: "PSYCHICSURGE" },
    { ...battler("opponent"), id: "guest-teravolt", ability: "TERAVOLT" },
    { ...battler("opponent"), id: "guest-turbo-blaze", ability: "TURBOBLAZE" }],
  });
}

function orderAccuracyAbilityBattle(): TeamBattleState {
  const priority = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "QUICKATTACK", name: "Vive-Attaque",
    priority: 1, accuracy: 0 };
  return createTeamBattleState({
    player: [{ ...battler("player"), ability: "VICTORYSTAR",
      moves: [{ move: priority, pp: priority.pp }] },
    { ...battler("player"), id: "host-triage", ability: "TRIAGE" },
    { ...battler("player"), id: "host-stall", ability: "STALL" }],
    opponent: [{ ...battler("opponent"), ability: "QUEENLYMAJESTY" },
    { ...battler("opponent"), id: "guest-wonder-skin", ability: "WONDERSKIN" }],
  });
}

function customSimpleAbilityBattle(): TeamBattleState {
  const electricContact = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "SPARK", name: "Étincelle",
    type: "ELECTRIC", accuracy: 0, flags: "a" };
  const guest = battler("opponent");
  return createTeamBattleState({
    player: [{ ...battler("player"), hp: 33, ability: "SOBRECARGA",
      moves: [{ move: electricContact, pp: electricContact.pp }] },
    { ...battler("player"), id: "host-magic-touch", ability: "TOQUEMAGICO" },
    { ...battler("player"), id: "host-lightning", ability: "RELAMPAGUEO" }],
    opponent: [{ ...guest, ability: "DINAMO", hp: 200, stats: { ...guest.stats, maxHp: 200 } },
    { ...guest, id: "guest-angry-shell", ability: "CORAZAIRA" },
    { ...guest, id: "guest-nightmare", ability: "GRANPESADILLA" }],
  });
}

function protectionReflectionAbilityBattle(): TeamBattleState {
  const growl = { ...MINIMAL_MOVE_CATALOG.GROWL, accuracy: 0, targetCode: "00" };
  return createTeamBattleState({
    player: [{ ...battler("player"), ability: "GOODASGOLD", moves: [{ move: growl, pp: growl.pp }] },
    { ...battler("player"), id: "host-liquid-ooze", ability: "LIQUIDOOZE" },
    { ...battler("player"), id: "host-innards-out", ability: "INNARDSOUT" }],
    opponent: [{ ...battler("opponent"), ability: "MIRRORARMOR" },
    { ...battler("opponent"), id: "guest-wonder-guard", ability: "WONDERGUARD" }],
  });
}

function contactWeightPartnerAbilityBattle(): TeamBattleState {
  const poison = { ...MINIMAL_MOVE_CATALOG.GROWL, internalName: "POISONTEST", name: "Poison",
    functionCode: "005" as const, accuracy: 0 };
  return createTeamBattleState({
    player: [{ ...battler("player"), ability: "POISONPUPPETEER",
      moves: [{ move: poison, pp: poison.pp }] },
    { ...battler("player"), id: "host-heavy-metal", ability: "HEAVYMETAL" },
    { ...battler("player"), id: "host-healer", ability: "HEALER" }],
    opponent: [{ ...battler("opponent"), ability: "CUTECHARM" },
    { ...battler("opponent"), id: "guest-light-metal", ability: "LIGHTMETAL" }],
  });
}

function recoilAbsorbCycleTrapAbilityBattle(): TeamBattleState {
  return createTeamBattleState({
    player: [{ ...battler("player"), ability: "MOODY" },
    { ...battler("player"), id: "host-ice-head", ability: "CABEZAHIELO" },
    { ...battler("player"), id: "host-awakened-flame", ability: "DESPIERTALLAMA" },
    { ...battler("player"), id: "host-arena-trap", ability: "ARENATRAP" }],
    opponent: [{ ...battler("opponent"), ability: "TRUANT" },
    { ...battler("opponent"), id: "guest-magnet-pull", ability: "MAGNETPULL" },
    { ...battler("opponent"), id: "guest-shadow-tag", ability: "SHADOWTAG" }],
  });
}

function formPivotBondAbilityBattle(): TeamBattleState {
  const bug = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "BUGHIT", name: "Impact Insecte",
    type: "BUG", accuracy: 0 };
  return createTeamBattleState({
    player: [{ ...battler("player"), ability: "EMERGENCYEXIT", moves: [{ move: bug, pp: bug.pp }] },
    { ...battler("player"), id: "host-sage", ability: "PODERSABIO" },
    { ...battler("player"), id: "host-parent", ability: "PARENTALBOND" },
    { ...battler("player"), id: "host-castform", species: "CASTFORM", ability: "FORECAST" }],
    opponent: [{ ...battler("opponent"), ability: "SUCTIONCUPS" },
    { ...battler("opponent"), id: "guest-mimikyu", species: "MIMIKYU", ability: "DISGUISE",
      appearance: { form: 0, shiny: false, gender: null } },
    { ...battler("opponent"), id: "guest-cherrim", species: "CHERRIM", ability: "FLOWERGIFT",
      appearance: { form: 0, shiny: false, gender: null } }],
  });
}

function statMoveFunctionBattle(): TeamBattleState {
  const dragonDance = { ...MINIMAL_MOVE_CATALOG.GROWL, internalName: "DRAGONDANCE", name: "Danse Draco",
    functionCode: "026", category: "Status" as const, power: 0, accuracy: 0 };
  const closeCombat = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "CLOSECOMBAT", name: "Close Combat",
    functionCode: "03C", accuracy: 0 };
  return createTeamBattleState({
    player: [{ ...battler("player"), moves: [{ move: dragonDance, pp: 20 }] }],
    opponent: [{ ...battler("opponent"), moves: [{ move: closeCombat, pp: 5 }] }],
  });
}

function authoritativeTrapBattle(): TeamBattleState {
  return createTeamBattleState({
    player: [{ ...battler("player"), types: ["STEEL"] },
      { ...battler("player"), id: "player-reserve" }],
    opponent: [{ ...battler("opponent"), ability: "MAGNETPULL" }],
  });
}

function weatherBattle(): TeamBattleState {
  return createTeamBattleState({
    player: [{ ...battler("player"), ability: "SOLARPOWER" }],
    opponent: [{ ...battler("opponent"), ability: "DROUGHT" }],
  });
}

function fieldAbilityBattle(): TeamBattleState {
  return createTeamBattleState({
    player: [{ ...battler("player"), ability: "PRESENCIARARA" }],
    opponent: [{ ...battler("opponent"), ability: "ELECTRICSURGE" }],
  });
}

function extremeWeatherBattle(): TeamBattleState {
  return createTeamBattleState({ player: [{ ...battler("player"), ability: "PRIMORDIALSEA" }],
    opponent: [{ ...battler("opponent"), ability: "CLOUDNINE" }] });
}

function speedBoostBattle(): TeamBattleState {
  return createTeamBattleState({ player: [{ ...battler("player"), ability: "SPEEDBOOST" }],
    opponent: [battler("opponent")] });
}

function pressureBattle(): TeamBattleState {
  return createTeamBattleState({ player: [battler("player")],
    opponent: [{ ...battler("opponent"), ability: "PRESSURE" }] });
}

function unburdenBattle(): TeamBattleState {
  return createTeamBattleState({ player: [{ ...battler("player"), ability: "UNBURDEN",
    hp: 40, heldItem: "ORANBERRY" }], opponent: [battler("opponent")] });
}

function magicBounceBattle(): TeamBattleState {
  const taunt = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "TAUNT", name: "Provoc",
    functionCode: "0BA" as const, power: 0, category: "Status" as const, accuracy: 0, flags: "bc" };
  return createTeamBattleState({ player: [{ ...battler("player"), moves: [{ move: taunt, pp: taunt.pp }] }],
    opponent: [{ ...battler("opponent"), ability: "MAGICBOUNCE" }] });
}

function waterBubbleBattle(): TeamBattleState {
  const water = { ...MINIMAL_MOVE_CATALOG.WATERGUN, accuracy: 0 };
  return createTeamBattleState({
    player: [{ ...battler("player"), ability: "WATERBUBBLE", types: ["WATER"],
      moves: [{ move: water, pp: water.pp }] }],
    opponent: [battler("opponent")],
  });
}

function iceScalesBattle(): TeamBattleState {
  const water = { ...MINIMAL_MOVE_CATALOG.WATERGUN, accuracy: 0 };
  return createTeamBattleState({
    player: [{ ...battler("player"), moves: [{ move: water, pp: water.pp }] }],
    opponent: [{ ...battler("opponent"), ability: "ICESCALES" }],
  });
}

function windBattle(): TeamBattleState {
  const move = { ...MINIMAL_MOVE_CATALOG.GROWL, internalName: "TAILWIND", name: "Vent Arrière",
    functionCode: "05B" as const, type: "FLYING", accuracy: 0, targetCode: "40" };
  return createTeamBattleState({
    player: [{ ...battler("player"), ability: "WINDPOWER", moves: [{ move, pp: move.pp }] }],
    opponent: [battler("opponent")],
  });
}

function colorChangeBattle(): TeamBattleState {
  const water = { ...MINIMAL_MOVE_CATALOG.WATERGUN, accuracy: 0 };
  const opponent = battler("opponent");
  return createTeamBattleState({
    player: [{ ...battler("player"), moves: [{ move: water, pp: water.pp }] }],
    opponent: [{ ...opponent, ability: "COLORCHANGE", types: ["FIRE", "FLYING"], hp: 200,
      stats: { ...opponent.stats, maxHp: 200 } }],
  });
}

function mummyBattle(): TeamBattleState {
  const contact = { ...MINIMAL_MOVE_CATALOG.TACKLE, accuracy: 0, flags: "a" };
  return createTeamBattleState({
    player: [{ ...battler("player"), ability: "HUSTLE", moves: [{ move: contact, pp: contact.pp }] }],
    opponent: [{ ...battler("opponent"), ability: "MUMMY" }],
  });
}

function explosionBattle(): TeamBattleState {
  const move = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "EXPLOSION", name: "Explosion",
    functionCode: "0E0" as const, power: 250, accuracy: 0, flags: "bef" };
  const opponent = battler("opponent");
  return createTeamBattleState({
    player: [{ ...battler("player"), moves: [{ move, pp: 5 }] },
      { ...battler("player"), id: "player-reserve" }],
    opponent: [{ ...opponent, hp: 500, stats: { ...opponent.stats, maxHp: 500, defense: 500 } }],
  });
}

function battleWithReserve(): TeamBattleState {
  return createTeamBattleState({
    player: [battler("player")],
    opponent: [{ ...battler("opponent"), hp: 1 }, { ...battler("opponent"), id: "opponent-reserve" }],
  });
}

function encounterBattle(encounter?: { readonly kind: "wild" | "trainer" }): TeamBattleState {
  if (encounter === undefined) return initialBattle();
  return createTeamBattleState({ player: [battler("player")], opponent: [{ ...battler("opponent"), hp: 1 }] });
}

function ready(requestId: string) {
  return { type: "setReady", version: 15, requestId, ready: true } as const;
}

function sourceBattleContext(ownerId: string) {
  return { origin: "source-wild", mapId: 3, format: "single", escapable: true, healingItemsAllowed: true,
    narrativeOwnerId: ownerId, presentation: { battlebackId: "forest", battleMusicId: "Battle wild",
      victoryMusicId: "Victory", opponentTrainer: null, defeatText: null }, rewards: { opponents: [{ memberId: "opponent",
      species: "MEOWTH", level: 50, baseExperience: 58 }], trainerBaseMoney: null,
      experience: { levelCap: 17, experienceDisabled: false, boostTenPercent: false, boostTwentyPercent: false } },
    continuation: "pending-encounter" } as const;
}

function sourceTrainerBattleContext(ownerId: string) {
  return { ...sourceBattleContext(ownerId), origin: "source-trainer", escapable: false,
    presentation: { ...sourceBattleContext(ownerId).presentation,
      opponentTrainer: { id: 12, name: "Dresseur Test", spriteId: "trainer-test" } } } as const;
}

describe("authoritative battle room", () => {
  it("starts a player duel only when facing the other avatar and resolves both players' actions", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const playerTeam = initialBattle().teams.player;
    const originalOpponentTeam = initialBattle().teams.opponent;
    const opponentTeam = { ...originalOpponentTeam,
      members: originalOpponentTeam.members.map((member) => ({ ...member, hp: 1 })) };

    const challenged = room.receive("alice", { type: "challengePlayer", version: 15,
      requestId: "duel-challenge", team: playerTeam });
    expect(challenged.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().duelChallenge).toEqual({ challenger: "player", challenged: "opponent" });

    room.receive("bob", { type: "respondPlayerChallenge", version: 15,
      requestId: "duel-accept", accept: true, team: opponentTeam });
    const battle = room.snapshot().battle;
    expect(battle).toMatchObject({ duel: true, state: { status: "active",
      teams: { player: { members: [{ id: "player" }] }, opponent: { members: [{ id: "opponent" }] } } } });
    expect(room.snapshot().duelChallenge).toBeNull();
    expect(battle).not.toBeNull();
    if (battle === null) return;

    expect(room.receive("alice", { type: "submitAction", version: 15, requestId: "duel-turn-player",
      battleId: battle.id, turn: 1, action: { kind: "move", moveIndex: 0 } })).toHaveLength(1);
    const resolved = room.receive("bob", { type: "submitAction", version: 15, requestId: "duel-turn-opponent",
      battleId: battle.id, turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(resolved.map((entry) => entry.message.type)).toEqual(["ack", "turnResolved", "snapshot"]);
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ trace: expect.arrayContaining([expect.objectContaining({ type: "damage" })]) });
    expect(room.snapshot().battle?.state.status).toBe("finished");
    const left = room.receive("alice", { type: "leaveBattle", version: 15,
      requestId: "duel-leave", battleId: battle.id });
    expect(left.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().battle).toBeNull();

    const reverseChallenge = room.receive("bob", { type: "challengePlayer", version: 15,
      requestId: "duel-reverse", team: opponentTeam });
    expect(reverseChallenge.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().duelChallenge).toEqual({ challenger: "opponent", challenged: "player" });
    room.receive("bob", { type: "respondPlayerChallenge", version: 15,
      requestId: "duel-cancel", accept: false, team: null });
    expect(room.snapshot().duelChallenge).toBeNull();
  });

  it("awards an active PvP duel to the opponent when a player concedes", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const initial = initialBattle();
    room.receive("alice", { type: "challengePlayer", version: 15,
      requestId: "forfeit-challenge", team: initial.teams.player });
    room.receive("bob", { type: "respondPlayerChallenge", version: 15,
      requestId: "forfeit-accept", accept: true, team: initial.teams.opponent });
    const battle = room.snapshot().battle!;

    const forfeited = room.receive("alice", { type: "leaveBattle", version: 15,
      requestId: "forfeit-active", battleId: battle.id });

    expect(forfeited.map((entry) => entry.message.type)).toEqual(["ack", "turnResolved", "snapshot"]);
    expect(room.snapshot().battle).toMatchObject({ state: { status: "finished", winner: "opponent" },
      session: { lifecycle: "settling" } });
    const closed = room.receive("bob", { type: "leaveBattle", version: 15,
      requestId: "forfeit-close", battleId: battle.id });
    expect(closed.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().battle).toBeNull();
  });

  it("clears a player challenge after refusal, cancellation or either participant disconnecting", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const playerTeam = initialBattle().teams.player;

    room.receive("alice", { type: "challengePlayer", version: 15,
      requestId: "duel-refused", team: playerTeam });
    const refused = room.receive("bob", { type: "respondPlayerChallenge", version: 15,
      requestId: "duel-refuse", accept: false, team: null });
    expect(refused.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().duelChallenge).toBeNull();

    room.receive("alice", { type: "challengePlayer", version: 15,
      requestId: "duel-cancelled", team: playerTeam });
    room.receive("alice", { type: "respondPlayerChallenge", version: 15,
      requestId: "duel-cancel", accept: false, team: null });
    expect(room.snapshot().duelChallenge).toBeNull();

    room.receive("alice", { type: "challengePlayer", version: 15,
      requestId: "duel-challenged-disconnect", team: playerTeam });
    room.disconnect("bob");
    expect(room.snapshot().duelChallenge).toBeNull();
    expect(room.receive("alice", { type: "respondPlayerChallenge", version: 15,
      requestId: "duel-stale", accept: false, team: null })[0]?.message)
      .toMatchObject({ type: "error", code: "INVALID_PHASE" });

    room.connect("bob");
    room.receive("alice", { type: "challengePlayer", version: 15,
      requestId: "duel-challenger-disconnect", team: playerTeam });
    room.disconnect("alice");
    expect(room.snapshot().duelChallenge).toBeNull();
  });

  it("removes a disconnected avatar from collisions, expires its grace and restores it safely", () => {
    let now = 1_000;
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource,
      undefined, () => now);
    room.connect("alice");
    room.connect("bob");

    room.disconnect("bob");
    expect(room.snapshot().players[1]).toMatchObject({ playerId: "bob", connected: false,
      connectionState: "reconnecting", reconnectUntil: 16_000 });
    room.receive("alice", { type: "moveAvatar", version: 15, requestId: "occupy-guest-cell",
      direction: "down", sequence: 1 });
    expect(room.snapshot().sourceWorld?.avatars.player).toMatchObject({ x: 1, y: 2 });

    now = 15_999;
    expect(room.expireDisconnectedPlayers()).toBeNull();
    now = 16_000;
    expect(room.expireDisconnectedPlayers()?.players[1]).toMatchObject({ connectionState: "left",
      reconnectUntil: null });
    expect(room.nextReconnectExpiry()).toBeNull();

    const restored = room.connect("bob");
    expect(restored.snapshot.players[1]).toMatchObject({ connected: true, connectionState: "connected" });
    expect(restored.snapshot.sourceWorld?.avatars.opponent).toMatchObject({ x: 0, y: 2 });

    const left = room.receive("bob", { type: "leaveRoom", version: 15, requestId: "leave-now" });
    expect(left.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().players[1]).toMatchObject({ connected: false, connectionState: "left",
      reconnectUntil: null });
  });

  it("releases a departed guest seat for a manual join without bypassing the reconnect grace", () => {
    let now = 1_000;
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource,
      undefined, () => now);
    room.connect("alice");
    room.connect("bob");

    room.disconnect("bob");
    expect(() => room.reserve("charlie")).toThrow("ROOM_FULL");
    now += PLAYER_RECONNECT_GRACE_MS;
    room.expireDisconnectedPlayers();
    expect(room.reserve("charlie")).toMatchObject({ side: "opponent", reconnected: false,
      replacedPlayerId: "bob" });
    expect(room.snapshot().players.map((player) => player.playerId)).toEqual(["alice", "charlie"]);

    const explicit = new AuthoritativeBattleRoom("DEF567", initialBattle, new SeededRandom(2), worldWithSource);
    explicit.connect("host");
    explicit.connect("guest");
    explicit.receive("guest", { type: "leaveRoom", version: 15, requestId: "guest-leave" });
    expect(explicit.reserve("replacement")).toMatchObject({ side: "opponent", replacedPlayerId: "guest" });
  });

  it("hosts the source map, validates both movements and reserves story publication for the host", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    expect(room.snapshot().sourceWorld).toMatchObject({ mapId: 3,
      avatars: { player: { x: 1, y: 1 }, opponent: { x: 1, y: 2 } } });

    const blocked = room.receive("alice", { type: "moveAvatar", version: 15, requestId: "source-host-1",
      direction: "right", sequence: 1 });
    expect(blocked[1]?.message).toMatchObject({ type: "sourceWorldUpdated",
      state: { avatars: { player: { x: 1, y: 1, direction: "right" } } } });
    const guestFollower = room.receive("bob", { type: "setSourceFollower", version: 15,
      requestId: "source-guest-follower", species: "CHESPIN",
      appearance: { form: 1, shiny: true, gender: "female" } });
    expect(guestFollower.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    room.receive("bob", { type: "moveAvatar", version: 15, requestId: "source-guest-1",
      direction: "left", sequence: 1 });
    expect(room.snapshot().sourceWorld?.avatars.opponent).toMatchObject({ x: 0, y: 2, direction: "left" });
    expect(room.snapshot().sourceWorld?.followers.opponent).toMatchObject({ species: "CHESPIN", x: 1, y: 2,
      appearance: { form: 1, shiny: true, gender: "female" } });
    const blockedByGuestFollower = room.receive("alice", { type: "moveAvatar", version: 15,
      requestId: "source-host-follower-collision", direction: "down", sequence: 2 });
    expect(blockedByGuestFollower[1]?.message).toMatchObject({ type: "sourceWorldUpdated",
      state: { avatars: { player: { x: 1, y: 1, direction: "down" } } } });
    room.receive("alice", { type: "moveAvatar", version: 15, requestId: "source-host-2",
      direction: "left", sequence: 3 });
    expect(room.snapshot().sourceWorld).toMatchObject({ avatars: { player: { x: 0, y: 1 } },
      followers: { player: { species: "FENNEKIN", x: 1, y: 1 } } });

    room.receive("alice", { type: "setSourceWorld", version: 15, requestId: "source-story-refresh",
      world: sourceWorld, relocateHost: false });
    expect(room.snapshot().sourceWorld?.avatars.player).toMatchObject({ x: 0, y: 1 });
    room.receive("alice", { type: "setSourceWorld", version: 15, requestId: "source-scripted-relocation",
      world: sourceWorld, relocateHost: true });
    expect(room.snapshot().sourceWorld?.avatars.player).toMatchObject({ x: 1, y: 1 });

    const forbidden = room.receive("bob", { type: "setSourceWorld", version: 15,
      requestId: "source-guest-map", world: sourceWorld });
    expect(forbidden[0]?.message).toMatchObject({ type: "error", code: "HOST_ONLY" });
    const changed = { ...sourceWorld, mapId: 7, host: { x: 0, y: 0, direction: "right" as const } };
    room.receive("alice", { type: "setSourceWorld", version: 15, requestId: "source-host-map", world: changed });
    expect(room.snapshot().sourceWorld).toMatchObject({ mapId: 7, presence: { opponent: "away" },
      avatars: { player: { x: 0, y: 0 } } });
    expect(room.snapshot().sourceWorld?.followers.opponent?.species).toBe("CHESPIN");

    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState),
      worldWithSource, persisted);
    expect(restored.snapshot().sourceWorld).toEqual(room.snapshot().sourceWorld);
  });

  it("autorise le passage HIDE seulement pendant les dix secondes validées par la room", () => {
    let now = 1_000;
    const truthWorld = { ...sourceWorld, blockedPoints: [], truthEvents: [
      { eventId: 70, mode: "hide" as const, points: [{ x: 2, y: 1 }] },
    ] };
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1),
      { ...world, sourceWorld: truthWorld }, undefined, () => now);
    room.connect("alice");
    room.receive("alice", { type: "moveAvatar", version: 15, requestId: "truth-blocked",
      direction: "right", sequence: 1 });
    expect(room.snapshot().sourceWorld?.avatars.player).toMatchObject({ x: 1, y: 1 });
    room.receive("alice", { type: "activateSourceFieldEffect", version: 15,
      requestId: "truth-activate", effect: "truth-lens" });
    room.receive("alice", { type: "moveAvatar", version: 15, requestId: "truth-pass",
      direction: "right", sequence: 2 });
    expect(room.snapshot().sourceWorld?.avatars.player).toMatchObject({ x: 2, y: 1 });

    now += 10_001;
    room.receive("alice", { type: "moveAvatar", version: 15, requestId: "truth-leave",
      direction: "left", sequence: 3 });
    room.receive("alice", { type: "moveAvatar", version: 15, requestId: "truth-expired",
      direction: "right", sequence: 4 });
    expect(room.snapshot().sourceWorld?.avatars.player).toMatchObject({ x: 1, y: 1 });
  });

  it("migrates a room persisted before regional map ids and survives the next host transfer", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const persisted = room.exportState();
    const { regionalMapIds: _regionalMapIds, followers: _followers, ...legacySourceWorld }
      = persisted.sourceWorldState!;
    const legacy = { ...persisted, sourceWorldState: legacySourceWorld } as unknown as PersistedRoomState;
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(legacy.rngState),
      worldWithSource, legacy);

    expect(restored.snapshot().sourceWorld).toMatchObject({ regionalMapIds: { player: 3, opponent: 3 },
      followers: {} });
    const changed = { ...sourceWorld, mapId: 7, host: { x: 0, y: 0, direction: "right" as const } };
    expect(() => restored.receive("alice", { type: "setSourceWorld", version: 15,
      requestId: "legacy-source-host-map", world: changed })).not.toThrow();
    expect(restored.snapshot().sourceWorld).toMatchObject({ mapId: 7,
      regionalMapIds: { player: 7, opponent: 3 }, presence: { opponent: "away" } });
  });

  it("uses host-published NPCs as authoritative collisions and restores them with the room", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const blockingActor = { eventId: 17, x: 2, y: 2, direction: "left" as const,
      blocking: true, moveSpeed: 3, action: "idle" as const };

    const published = room.receive("alice", { type: "setSourceActors", version: 15,
      requestId: "actors-blocking", mapId: 3, actors: [blockingActor] });
    expect(published.map((entry) => entry.message.type)).toEqual(["ack", "sourceActorsUpdated"]);
    expect(published[1]?.message).toMatchObject({ type: "sourceActorsUpdated", actorRevision: 1,
      actors: [blockingActor] });
    const blocked = room.receive("bob", { type: "moveAvatar", version: 15,
      requestId: "guest-blocked-by-npc", direction: "right", sequence: 1 });
    expect(blocked[1]?.message).toMatchObject({ type: "sourceWorldUpdated",
      state: { avatars: { opponent: { x: 1, y: 2, direction: "right" } } } });

    expect(room.receive("bob", { type: "setSourceActors", version: 15,
      requestId: "guest-cannot-move-npcs", mapId: 3, actors: [] })[0]?.message)
      .toMatchObject({ type: "error", code: "HOST_ONLY" });
    const movedActor = { ...blockingActor, x: 0, y: 0, direction: "up" as const, action: "step" as const };
    room.receive("alice", { type: "setSourceActors", version: 15,
      requestId: "actors-moved", mapId: 3, actors: [movedActor] });
    room.receive("bob", { type: "moveAvatar", version: 15,
      requestId: "guest-after-npc", direction: "right", sequence: 2 });
    expect(room.snapshot().sourceWorld).toMatchObject({ actorRevision: 2, actors: [movedActor],
      avatars: { opponent: { x: 2, y: 2 } } });

    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState),
      worldWithSource, persisted);
    expect(restored.snapshot().sourceWorld).toMatchObject({ actorRevision: 2, actors: [movedActor] });
    restored.connect("bob");
    expect(restored.snapshot().sourceWorld?.actors).toEqual([movedActor]);
  });

  it("applies the host narrative blockers to guest movement and restores them after reconnect", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");

    const blockedBySwitch = { ...sourceWorld, blockedPoints: [{ x: 2, y: 2 }],
      story: { ...sourceWorld.story, switches: { ...sourceWorld.story.switches, "90": true } } };
    room.receive("alice", { type: "setSourceWorld", version: 15, requestId: "narrative-switch",
      world: blockedBySwitch });
    const blocked = room.receive("bob", { type: "moveAvatar", version: 15,
      requestId: "guest-blocked-by-switch", direction: "right", sequence: 1 });
    expect(blocked[1]?.message).toMatchObject({ type: "sourceWorldUpdated",
      state: { avatars: { opponent: { x: 1, y: 2, direction: "right" } },
        blockedPoints: [{ x: 2, y: 2 }], story: { switches: { "90": true } } } });

    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState),
      worldWithSource, persisted);
    expect(restored.snapshot().sourceWorld).toMatchObject({ blockedPoints: [{ x: 2, y: 2 }],
      story: { switches: { "90": true } } });

    const openedBySelfSwitch = { ...sourceWorld, blockedPoints: [],
      story: { ...sourceWorld.story, selfSwitches: { "3:8:A": true } } };
    restored.receive("alice", { type: "setSourceWorld", version: 15, requestId: "narrative-self-switch",
      world: openedBySelfSwitch });
    const moved = restored.receive("bob", { type: "moveAvatar", version: 15,
      requestId: "guest-opened-by-self-switch", direction: "right", sequence: 2 });
    expect(moved[1]?.message).toMatchObject({ type: "sourceWorldUpdated",
      state: { avatars: { opponent: { x: 2, y: 2, direction: "right" } }, blockedPoints: [],
        story: { selfSwitches: { "3:8:A": true } } } });
  });

  it("lets the guest leave and safely rejoin the shared source map", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");

    const away = room.receive("bob", { type: "setSourcePresence", version: 15,
      requestId: "guest-away", attached: false, avatar: null, mapId: 7 });
    expect(away.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().sourceWorld?.presence.opponent).toBe("away");
    expect(room.snapshot().sourceWorld?.regionalMapIds).toEqual({ player: 3, opponent: 7 });
    const hostStep = room.receive("alice", { type: "moveAvatar", version: 15,
      requestId: "host-through-guest", direction: "down", sequence: 1 });
    expect(hostStep[1]?.message).toMatchObject({ type: "sourceWorldUpdated",
      state: { avatars: { player: { x: 1, y: 2 } } } });
    expect(room.receive("bob", { type: "moveAvatar", version: 15, requestId: "away-move",
      direction: "left", sequence: 1 })[0]?.message).toMatchObject({ type: "error", code: "INVALID_PHASE" });

    const joined = room.receive("bob", { type: "setSourcePresence", version: 15,
      requestId: "guest-return", attached: true, avatar: { x: 0, y: 2, direction: "right" }, mapId: 3 });
    expect(joined.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().sourceWorld).toMatchObject({ presence: { opponent: "shared" },
      regionalMapIds: { player: 3, opponent: 3 },
      avatars: { opponent: { x: 0, y: 2, direction: "right" } } });

    room.receive("bob", { type: "setSourcePresence", version: 15,
      requestId: "guest-away-again", attached: false, avatar: null, mapId: 7 });
    const safeFallback = room.receive("bob", { type: "setSourcePresence", version: 15,
      requestId: "guest-return-occupied", attached: true, avatar: { x: 1, y: 2, direction: "up" }, mapId: 3 });
    expect(safeFallback.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().sourceWorld?.avatars.opponent).not.toMatchObject({ x: 1, y: 2 });
  });

  it("lets an away guest attach to the shared map without becoming an automatic spectator", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    room.receive("bob", { type: "setSourcePresence", version: 15,
      requestId: "guest-away-during-battle", attached: false, avatar: null, mapId: 7 });
    const initial = initialBattle();
    room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "host-battle-before-return",
      context: sourceBattleContext("alice"), playerTeam: initial.teams.player,
      opponentTeam: initial.teams.opponent });

    expect(room.receive("bob", { type: "setSourcePresence", version: 15,
      requestId: "guest-return-during-battle", attached: true,
      avatar: { x: 0, y: 2, direction: "right" }, mapId: 3 })[0]?.message)
      .toMatchObject({ type: "ack" });
    expect(room.snapshot().sourceWorld?.presence.opponent).toBe("shared");
  });

  it("publishes and persists a host-only read-only source scene", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const scene = { mapId: 3, sequenceActive: true,
      dialogue: { label: "Crisanto", text: "Attention !", choices: [] },
      actors: [{ eventId: 4, x: 1, y: 0, direction: "up" as const }], presentation: null };
    const forbidden = room.receive("bob", { type: "setSourceScene", version: 15,
      requestId: "guest-scene", scene });
    expect(forbidden[0]?.message).toMatchObject({ type: "error", code: "HOST_ONLY" });
    const published = room.receive("alice", { type: "setSourceScene", version: 15,
      requestId: "host-scene", scene });
    expect(published.map((entry) => entry.message.type)).toEqual(["ack", "sourceSceneUpdated"]);
    expect(room.snapshot().sourceScene).toEqual(scene);
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState),
      worldWithSource, persisted);
    expect(restored.snapshot().sourceScene).toEqual(scene);
  });

  it("relays ephemeral source sounds in both directions only on the shared map", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");

    const hostSound = room.receive("alice", { type: "emitSourceSound", version: 15,
      requestId: "host-sound", mapId: 3, name: "Exit Door", volume: 80, pitch: 100 });
    expect(hostSound).toEqual([
      expect.objectContaining({ audience: { playerId: "alice" }, message: expect.objectContaining({ type: "ack" }) }),
      { audience: { playerId: "bob" }, message: { type: "sourceSoundEmitted", version: 15,
        side: "player", mapId: 3, name: "Exit Door", volume: 80, pitch: 100 } },
    ]);

    const guestSound = room.receive("bob", { type: "emitSourceSound", version: 15,
      requestId: "guest-sound", mapId: 3, name: "GEN8- Exclaim", volume: 90, pitch: 110 });
    expect(guestSound[1]).toEqual({ audience: { playerId: "alice" }, message: {
      type: "sourceSoundEmitted", version: 15, side: "opponent", mapId: 3,
      name: "GEN8- Exclaim", volume: 90, pitch: 110,
    } });

    room.receive("bob", { type: "setSourcePresence", version: 15,
      requestId: "guest-away-for-sound", attached: false, avatar: null, mapId: 7 });
    expect(room.receive("bob", { type: "emitSourceSound", version: 15,
      requestId: "away-sound", mapId: 3, name: "Choose", volume: 80, pitch: 100 })[0]?.message)
      .toMatchObject({ type: "error", code: "INVALID_PHASE" });
  });

  it("publishes, updates and persists each player's cosmetic profile", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), world);
    const base = createDefaultNetworkPlayerProfile().profile;
    const ariane = createNetworkPlayerProfile("legacy-1", { ...base, displayName: "Ariane" });
    const lina = createNetworkPlayerProfile("legacy-4", { ...base, displayName: "Lina" });
    room.reserve("alice", ariane);
    room.connect("alice");
    expect(room.snapshot().players[0]?.profile).toEqual(ariane);

    const updated = room.receive("alice", { type: "setProfile", version: 15, requestId: "profile-1", profile: lina });
    expect(updated.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().players[0]?.profile).toEqual(lina);

    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState), world, persisted);
    expect(restored.snapshot().players[0]?.profile).toEqual(lina);
  });

  it("assigns two stable seats and rejects a third player", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), world);
    expect(room.connect("alice").side).toBe("player");
    expect(room.connect("bob").side).toBe("opponent");
    expect(room.connect("alice")).toMatchObject({ side: "player", reconnected: true });
    expect(() => room.connect("charlie")).toThrow("ROOM_FULL");
  });

  it("persists the room, pending intentions and RNG position", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(19), world);
    room.reserve("alice");
    expect(room.snapshot().players[0]).toMatchObject({ playerId: "alice", connected: false });
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("ready-a"));
    room.receive("bob", ready("ready-b"));
    room.receive("alice", { type: "moveAvatar", version: 15, requestId: "world-a-1", direction: "right", sequence: 1 });
    room.receive("alice", { type: "submitAction", version: 15, requestId: "move-a", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });

    const state = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(state.rngState), world, state);
    expect(restored.snapshot()).toEqual(room.snapshot());
    expect(restored.snapshot()).toMatchObject({ world: { avatars: { player: { x: 3 } } }, movementSequences: { player: 1 } });
    expect(restored.receive("alice", { type: "moveAvatar", version: 15, requestId: "world-a-stale", direction: "right", sequence: 1 })[0]?.message)
      .toMatchObject({ type: "error", code: "STALE_MOVEMENT" });
    const secondAction = { type: "submitAction", version: 15, requestId: "move-b", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } } as const;
    const uninterruptedOutput = room.receive("bob", secondAction);
    const restoredOutput = restored.receive("bob", secondAction);
    expect(restoredOutput).toEqual(uninterruptedOutput);
    expect(restoredOutput.some((entry) => entry.message.type === "turnResolved")).toBe(true);
  });

  it("starts only after both players are ready and resolves only after both intentions", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(24_301), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("ready-a"));
    expect(room.snapshot().phase).toBe("waiting");
    room.receive("bob", ready("ready-b"));
    expect(room.snapshot()).toMatchObject({ phase: "battle", battle: { id: "ABC234-1", state: { turn: 1 } } });

    const first = room.receive("alice", { type: "submitAction", version: 15, requestId: "move-a", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(first.map((entry) => entry.message.type)).toEqual(["ack"]);
    expect(room.snapshot().battle?.state.turn).toBe(1);
    const second = room.receive("bob", { type: "submitAction", version: 15, requestId: "move-b", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(second.map((entry) => entry.message.type)).toEqual(["ack", "turnResolved", "snapshot"]);
    expect(room.snapshot().battle?.state.turn).toBe(2);
  });

  it("replicates a reactive ability stage and restores it after guest reconnect", () => {
    const room = new AuthoritativeBattleRoom("ABC234", reactiveBattle, new SeededRandom(24_302), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("reactive-ready-a"));
    room.receive("bob", ready("reactive-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "reactive-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15, requestId: "reactive-move-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ events: expect.arrayContaining([expect.objectContaining({ type: "abilityActivated",
        side: "opponent", ability: "STAMINA", effect: "raise-stat" })]) });
    expect(room.snapshot().battle?.state.teams.opponent.members[0]?.stages.defense).toBe(1);
    room.disconnect("bob");
    const reconnected = room.connect("bob");
    expect(reconnected.snapshot.battle?.state.teams.opponent.members[0]?.stages.defense).toBe(1);
  });

  it("resolves host Realeza and guest Merciless and restores their authoritative calculation state", () => {
    const room = new AuthoritativeBattleRoom("ABC234", calculationAbilityBattle,
      new SeededRandom(24_315), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("calculation-ready-a"));
    room.receive("bob", ready("calculation-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "calculation-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "calculation-move-b", battleId: "ABC234-1", turn: 1,
      action: { kind: "move", moveIndex: 0 } });
    const trace = resolved.find((entry) => entry.message.type === "turnResolved")?.message;
    expect(trace).toMatchObject({ trace: expect.arrayContaining([
      expect.objectContaining({ type: "damage", side: "player",
        abilityModifiers: expect.arrayContaining([{ ability: "REALEZA", multiplier: 1.5 }]) }),
      expect.objectContaining({ type: "damage", side: "opponent", critical: true }),
    ]) });
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", calculationAbilityBattle,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restored.connect("bob").snapshot.battle?.state.teams).toMatchObject({
      player: { members: [{ ability: "REALEZA", majorStatus: { kind: "poison" } }] },
      opponent: { members: [{ ability: "MERCILESS" }] },
    });
  });

  it("resolves host Voz Valquiria against guest Punk Rock and restores both classifications", () => {
    const room = new AuthoritativeBattleRoom("ABC234", moveClassificationAbilityBattle,
      new SeededRandom(24_316), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("classification-ready-a"));
    room.receive("bob", ready("classification-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "classification-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "classification-wait-b", battleId: "ABC234-1", turn: 1,
      action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ trace: expect.arrayContaining([expect.objectContaining({ type: "damage",
        side: "player", effectiveness: 2,
        abilityModifiers: expect.arrayContaining([{ ability: "PUNKROCK", multiplier: 0.5 }]) })]) });
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", moveClassificationAbilityBattle,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restored.connect("bob").snapshot.battle?.state.teams).toMatchObject({
      player: { members: [{ ability: "VOZVALQUIRIA" }] },
      opponent: { members: [{ ability: "PUNKROCK", types: ["DRAGON"] }] },
    });
  });

  it("persists authoritative contact stages, Toxic Spikes and the next reaction abilities", () => {
    const room = new AuthoritativeBattleRoom("ABC234", statStatusReactionAbilityBattle,
      new SeededRandom(24_317), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("reaction-ready-a"));
    room.receive("bob", ready("reaction-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "reaction-wait-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "reaction-hit-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "reaction-wait-b",
      battleId: "ABC234-1", turn: 2, action: { kind: "wait" } });
    room.receive("alice", { type: "submitAction", version: 15, requestId: "reaction-hit-a",
      battleId: "ABC234-1", turn: 2, action: { kind: "move", moveIndex: 0 } });
    expect(room.snapshot().battle?.state).toMatchObject({
      effects: { sides: { player: { toxicSpikesLayers: 1 } } },
      teams: {
        player: { members: [{ ability: "OLORPORCINO" },
          { ability: "CONTRARY", stages: { attack: -1 } }] },
        opponent: { members: [{ ability: "CAPATOXICA", stages: { evasion: -2 } },
          { ability: "PURIFYINGSALT", types: ["GHOST"], majorStatus: { kind: "burn" } }] },
      },
    });
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", statStatusReactionAbilityBattle,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restored.connect("bob").snapshot.battle?.state).toMatchObject({
      effects: { sides: { player: { toxicSpikesLayers: 1 } } },
      teams: { player: { members: [{ ability: "OLORPORCINO" }, { ability: "CONTRARY" }] },
        opponent: { members: [{ ability: "CAPATOXICA", stages: { evasion: -2 } },
          { ability: "PURIFYINGSALT", majorStatus: { kind: "burn" } }] } },
    });
  });

  it("resolves and restores authoritative type-interaction abilities for host and guest", () => {
    const room = new AuthoritativeBattleRoom("ABC234", typeInteractionAbilityBattle,
      new SeededRandom(24_318), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("type-ready-a"));
    room.receive("bob", ready("type-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "type-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15, requestId: "type-wait-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ trace: expect.arrayContaining([expect.objectContaining({ type: "damage",
        side: "player",
        abilityModifiers: expect.arrayContaining([{ ability: "NORMALIZE", multiplier: 1.5 }]) })]) });
    expect(room.snapshot().battle?.state.teams.opponent.members[0]?.hp).toBeLessThan(100);
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", typeInteractionAbilityBattle,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restored.connect("bob").snapshot.battle?.state.teams).toMatchObject({
      player: { members: [{ ability: "NORMALIZE" }, { ability: "STEELWORKER", types: ["STEEL"] }] },
      opponent: { members: [{ ability: "EARTHEATER" }, { ability: "CANASTO", types: ["ROCK"] }] },
    });
  });

  it("resolves and restores host and guest global aura abilities authoritatively", () => {
    const room = new AuthoritativeBattleRoom("ABC234", globalAuraAbilityBattle,
      new SeededRandom(24_319), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("aura-ready-a"));
    room.receive("bob", ready("aura-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "aura-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15, requestId: "aura-wait-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ trace: expect.arrayContaining([expect.objectContaining({ type: "damage", side: "player",
        abilityModifiers: expect.arrayContaining([{ ability: "AURABREAK", multiplier: 2 / 3 }]) })]) });
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", globalAuraAbilityBattle,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restored.connect("bob").snapshot.battle?.state.teams).toMatchObject({
      player: { members: [{ ability: "DARKAURA" }, { ability: "FAIRYAURA", types: ["FAIRY"] }] },
      opponent: { members: [{ ability: "AURABREAK" },
        { ability: "AURADORADA", types: ["ELECTRIC"] }] },
    });
  });

  it("resolves and restores Pokemon Z's Normal conversions for host and guest", () => {
    const room = new AuthoritativeBattleRoom("ABC234", pokemonZConversionAbilityBattle,
      new SeededRandom(24_320), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("conversion-ready-a"));
    room.receive("bob", ready("conversion-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "conversion-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "conversion-wait-b", battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message).toMatchObject({
      events: expect.arrayContaining([expect.objectContaining({ type: "abilityActivated", side: "player",
        ability: "TINTINEO", effect: "announce" })]),
      trace: expect.arrayContaining([expect.objectContaining({ type: "damage", side: "player", effectiveness: 2,
        abilityModifiers: expect.not.arrayContaining([{ ability: "TINTINEO", multiplier: 1.2 }]) })]),
    });
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", pokemonZConversionAbilityBattle,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restored.connect("bob").snapshot.battle?.state.teams).toMatchObject({
      player: { members: [{ ability: "TINTINEO" }, { ability: "COLEOPTERO", types: ["BUG"] }] },
      opponent: { members: [{ ability: "PIELMALDITA", types: ["POISON"] },
        { ability: "PIELELECTRICA", types: ["ELECTRIC"] }] },
    });
  });

  it("resolves and restores pure offensive type boosts for host and guest", () => {
    const room = new AuthoritativeBattleRoom("ABC234", pureTypeBoostAbilityBattle,
      new SeededRandom(24_321), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("type-boost-ready-a"));
    room.receive("bob", ready("type-boost-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "type-boost-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "type-boost-wait-b", battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ trace: expect.arrayContaining([expect.objectContaining({ type: "damage", side: "player",
        abilityModifiers: expect.arrayContaining([{ ability: "ALBINISMO", multiplier: 1.5 }]) })]) });
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", pureTypeBoostAbilityBattle,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restored.connect("bob").snapshot.battle?.state.teams).toMatchObject({
      player: { members: [{ ability: "ALBINISMO", types: ["ICE"] },
        { ability: "INFLAMABLE", types: ["FIRE"] },
        { ability: "TRANSPORTARROCA", types: ["ROCK"] }] },
      opponent: { members: [{ ability: "PEDANTE", types: ["PSYCHIC"] },
        { ability: "DRAGONSMAW", types: ["DRAGON"] }] },
    });
  });

  it("resolves and restores the enlarged easy ability batch for host and guest", () => {
    const room = new AuthoritativeBattleRoom("ABC234", easyAbilityBatchBattle,
      new SeededRandom(24_322), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("easy-batch-ready-a"));
    room.receive("bob", ready("easy-batch-ready-b"));
    expect(room.snapshot().battle?.state.effects).toMatchObject({ terrain: "misty", terrainTurns: 5 });
    room.receive("alice", { type: "submitAction", version: 15, requestId: "easy-batch-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "easy-batch-wait-b", battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ trace: expect.arrayContaining([expect.objectContaining({ type: "damage", side: "player",
        abilityModifiers: expect.arrayContaining([{ ability: "FLAREBOOST", multiplier: 1.5 }]) })]) });
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", easyAbilityBatchBattle,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restored.connect("bob").snapshot.battle?.state).toMatchObject({
      effects: { terrain: "misty", terrainTurns: 4 },
      teams: {
        player: { members: [{ ability: "FLAREBOOST" }, { ability: "TOXICBOOST" },
          { ability: "SLOWSTART" }, { ability: "SURGESURFER" }, { ability: "SILVANO" },
          { ability: "GALEWINGS" }] },
        opponent: { members: [{ ability: "MISTYSURGE" }, { ability: "PSYCHICSURGE" },
          { ability: "TERAVOLT" }, { ability: "TURBOBLAZE" }] },
      },
    });
  });

  it("resolves and restores accuracy and action-order abilities for host and guest", () => {
    const room = new AuthoritativeBattleRoom("ABC234", orderAccuracyAbilityBattle,
      new SeededRandom(24_323), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("order-accuracy-ready-a"));
    room.receive("bob", ready("order-accuracy-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "order-accuracy-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "order-accuracy-wait-b", battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ events: expect.arrayContaining([expect.objectContaining({ type: "abilityActivated",
        side: "opponent", ability: "QUEENLYMAJESTY", effect: "block-move" })]) });
    expect(room.snapshot().battle?.state.teams.opponent.members[0]!.hp).toBe(100);
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", orderAccuracyAbilityBattle,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restored.connect("bob").snapshot.battle?.state.teams).toMatchObject({
      player: { members: [{ ability: "VICTORYSTAR" }, { ability: "TRIAGE" }, { ability: "STALL" }] },
      opponent: { members: [{ ability: "QUEENLYMAJESTY" }, { ability: "WONDERSKIN" }] },
    });
  });

  it("resolves and restores the custom simple ability batch for host and guest", () => {
    const room = new AuthoritativeBattleRoom("ABC234", customSimpleAbilityBattle,
      new SeededRandom(24_324), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("custom-simple-ready-a"));
    room.receive("bob", ready("custom-simple-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "custom-simple-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "custom-simple-wait-b", battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message).toMatchObject({
      trace: expect.arrayContaining([expect.objectContaining({ type: "damage", side: "player",
        abilityModifiers: expect.arrayContaining([{ ability: "SOBRECARGA", multiplier: 1.5 }]) })]),
      events: expect.arrayContaining([expect.objectContaining({ type: "abilityActivated",
        side: "opponent", ability: "DINAMO", effect: "charge" })]),
    });
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", customSimpleAbilityBattle,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restored.connect("bob").snapshot.battle?.state.teams).toMatchObject({
      player: { members: [{ ability: "SOBRECARGA" }, { ability: "TOQUEMAGICO" },
        { ability: "RELAMPAGUEO" }] },
      opponent: { members: [{ ability: "DINAMO", stages: { specialDefense: 1 },
        volatile: { chargeTurns: 1 } }, { ability: "CORAZAIRA" }, { ability: "GRANPESADILLA" }] },
    });
  });

  it("resolves and restores protection, drain and reflection abilities for host and guest", () => {
    const room = new AuthoritativeBattleRoom("ABC234", protectionReflectionAbilityBattle,
      new SeededRandom(24_325), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("protection-reflection-ready-a"));
    room.receive("bob", ready("protection-reflection-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15,
      requestId: "protection-reflection-move-a", battleId: "ABC234-1", turn: 1,
      action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "protection-reflection-wait-b", battleId: "ABC234-1", turn: 1,
      action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message).toMatchObject({
      events: expect.arrayContaining([expect.objectContaining({ type: "abilityActivated",
        side: "opponent", ability: "MIRRORARMOR", effect: "reflect-stat-drop" })]),
    });
    expect(room.snapshot().battle?.state.teams.player.members[0]!.stages.attack).toBe(-1);
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", protectionReflectionAbilityBattle,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restored.connect("bob").snapshot.battle?.state.teams).toMatchObject({
      player: { members: [{ ability: "GOODASGOLD", stages: { attack: -1 } },
        { ability: "LIQUIDOOZE" }, { ability: "INNARDSOUT" }] },
      opponent: { members: [{ ability: "MIRRORARMOR" }, { ability: "WONDERGUARD" }] },
    });
  });

  it("resolves and restores contact, weight, partner and poison abilities for host and guest", () => {
    const room = new AuthoritativeBattleRoom("ABC234", contactWeightPartnerAbilityBattle,
      new SeededRandom(24_326), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("contact-weight-ready-a"));
    room.receive("bob", ready("contact-weight-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15,
      requestId: "contact-weight-move-a", battleId: "ABC234-1", turn: 1,
      action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "contact-weight-wait-b", battleId: "ABC234-1", turn: 1,
      action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message).toMatchObject({
      events: expect.arrayContaining([expect.objectContaining({ type: "abilityActivated",
        side: "player", ability: "POISONPUPPETEER", effect: "inflict-status" })]),
    });
    expect(room.snapshot().battle?.state.teams.opponent.members[0]).toMatchObject({
      ability: "CUTECHARM", majorStatus: { kind: "poison" }, volatile: { confusionTurns: expect.any(Number) },
    });
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", contactWeightPartnerAbilityBattle,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restored.connect("bob").snapshot.battle?.state.teams).toMatchObject({
      player: { members: [{ ability: "POISONPUPPETEER" },
        { ability: "HEAVYMETAL" }, { ability: "HEALER" }] },
      opponent: { members: [{ ability: "CUTECHARM", majorStatus: { kind: "poison" } },
        { ability: "LIGHTMETAL" }] },
    });
  });

  it("replicates recoil, absorption, cycle and trap talents and restores their tactical state", () => {
    const room = new AuthoritativeBattleRoom("ABC234", recoilAbsorbCycleTrapAbilityBattle,
      new SeededRandom(24_327), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("cycle-trap-ready-a"));
    room.receive("bob", ready("cycle-trap-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "cycle-trap-wait-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "cycle-trap-wait-b", battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message).toMatchObject({
      events: expect.arrayContaining([expect.objectContaining({ type: "abilityActivated",
        side: "player", ability: "MOODY", effect: "randomize-stats" })]),
      state: { teams: { opponent: { members: expect.arrayContaining([expect.objectContaining({
        ability: "TRUANT", volatile: expect.objectContaining({ truantLoafing: true }) })]) } } },
    });
    room.disconnect("bob");
    const restored = room.connect("bob").snapshot.battle?.state;
    expect(restored?.teams).toMatchObject({
      player: { members: [{ ability: "MOODY" }, { ability: "CABEZAHIELO" },
        { ability: "DESPIERTALLAMA" }, { ability: "ARENATRAP" }] },
      opponent: { members: [{ ability: "TRUANT", volatile: { truantLoafing: true } },
        { ability: "MAGNETPULL" }, { ability: "SHADOWTAG" }] },
    });
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", recoilAbsorbCycleTrapAbilityBattle,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state.teams.opponent.members[0])
      .toMatchObject({ ability: "TRUANT", volatile: { truantLoafing: true } });
  });

  it("resolves stat move functions for host and guest and restores their stages", () => {
    const room = new AuthoritativeBattleRoom("ABC234", statMoveFunctionBattle,
      new SeededRandom(24_328), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("stat-functions-ready-a"));
    room.receive("bob", ready("stat-functions-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "stat-functions-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "stat-functions-move-b", battleId: "ABC234-1", turn: 1,
      action: { kind: "move", moveIndex: 0 } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message).toMatchObject({
      state: { teams: {
        player: { members: [{ stages: { attack: 1, speed: 1 } }] },
        opponent: { members: [{ stages: { defense: -1, specialDefense: -1 } }] },
      } },
    });
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams).toMatchObject({
      player: { members: [{ stages: { attack: 1, speed: 1 } }] },
      opponent: { members: [{ stages: { defense: -1, specialDefense: -1 } }] },
    });
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", statMoveFunctionBattle,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state.teams).toMatchObject({
      player: { members: [{ stages: { attack: 1, speed: 1 } }] },
      opponent: { members: [{ stages: { defense: -1, specialDefense: -1 } }] },
    });
  });

  it("shares mixed self boosts from both owners across reconnection", () => {
    const shiftGear = { ...MINIMAL_MOVE_CATALOG.GROWL, internalName: "SHIFTGEAR", name: "Chgt Vitesse",
      functionCode: "036", category: "Status" as const, power: 0, accuracy: 0 };
    const coil = { ...shiftGear, internalName: "COIL", name: "Enroulement", functionCode: "025" };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), moves: [{ move: shiftGear, pp: 10 }] }],
      opponent: [{ ...battler("opponent"), moves: [{ move: coil, pp: 10 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_330), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("mixed-boost-ready-a"));
    room.receive("bob", ready("mixed-boost-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "mixed-boost-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "mixed-boost-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const expected = {
      player: { members: [{ stages: { speed: 2, attack: 1 } }] },
      opponent: { members: [{ stages: { attack: 1, defense: 1, accuracy: 1 } }] },
    };
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams).toMatchObject(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state.teams).toMatchObject(expected);
  });

  it("restores Autotomize weight and Shell Smash stages for host and guest", () => {
    const autotomize = { ...MINIMAL_MOVE_CATALOG.GROWL, internalName: "AUTOTOMIZE", name: "Aligerar",
      functionCode: "031", category: "Status" as const, power: 0, accuracy: 0 };
    const shellSmash = { ...autotomize, internalName: "SHELLSMASH", name: "Rompecoraza",
      functionCode: "035" };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), capture: { rate: 45, baseSpeed: 50, weight: 1_500 },
        moves: [{ move: autotomize, pp: 10 }] }],
      opponent: [{ ...battler("opponent"), moves: [{ move: shellSmash, pp: 10 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_331), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("weight-smash-ready-a"));
    room.receive("bob", ready("weight-smash-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "weight-smash-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "weight-smash-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const expected = {
      player: { members: [{ stages: { speed: 2 }, volatile: { weightChange: -1_000 } }] },
      opponent: { members: [{ stages: { defense: -1, specialDefense: -1,
        attack: 2, specialAttack: 2, speed: 2 } }] },
    };
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams).toMatchObject(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state.teams).toMatchObject(expected);
  });

  it("keeps Acupressure's authoritative draw and Belly Drum cost after reconnect", () => {
    const acupressure = { ...MINIMAL_MOVE_CATALOG.GROWL, internalName: "ACUPRESSURE",
      name: "Acupression", functionCode: "037", targetCode: "200", accuracy: 0 };
    const bellyDrum = { ...acupressure, internalName: "BELLYDRUM", name: "Tambor",
      functionCode: "03A", targetCode: "10" };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), moves: [{ move: acupressure, pp: 10 }] }],
      opponent: [{ ...battler("opponent"), moves: [{ move: bellyDrum, pp: 10 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_332), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("random-boost-ready-a"));
    room.receive("bob", ready("random-boost-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "random-boost-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "random-boost-b", battleId: "ABC234-1", turn: 1,
      action: { kind: "move", moveIndex: 0 } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message).toMatchObject({
      trace: expect.arrayContaining([expect.objectContaining({ type: "rng", purpose: "acupressure" })]),
      state: { teams: { opponent: { members: [{ hp: 50, stages: { attack: 6 } }] } } },
    });
    const stages = room.snapshot().battle?.state.teams.player.members[0]!.stages;
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams.player.members[0]!.stages).toEqual(stages);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state.teams.player.members[0]!.stages).toEqual(stages);
  });

  it("replicates Power Split stats to host and guest after reconnect and room restart", () => {
    const powerSplit = { ...MINIMAL_MOVE_CATALOG.GROWL, internalName: "POWERSPLIT",
      name: "Isoforce", functionCode: "058", accuracy: 0 };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), stats: { ...battler("player").stats, attack: 81 },
        moves: [{ move: powerSplit, pp: 10 }] }],
      opponent: [{ ...battler("opponent"), stats: { ...battler("opponent").stats, attack: 140 } }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_337), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("split-ready-a"));
    room.receive("bob", ready("split-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "split-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "split-move-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    const expected = { player: { members: [{ stats: { attack: 110 } }] },
      opponent: { members: [{ stats: { attack: 110 } }] } };
    expect(room.snapshot().battle?.state.teams).toMatchObject(expected);
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams).toMatchObject(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state.teams).toMatchObject(expected);
  });

  it("replicates temporary type and ability changes through host, guest and room restart", () => {
    const soak = { ...MINIMAL_MOVE_CATALOG.GROWL, internalName: "SOAK", name: "Empapar",
      functionCode: "061", accuracy: 0 };
    const simpleBeam = { ...soak, internalName: "SIMPLEBEAM", name: "Onda Simple",
      functionCode: "063" };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), moves: [{ move: soak, pp: 10 }] }],
      opponent: [{ ...battler("opponent"), types: ["FIRE"], ability: "CONTRARY",
        moves: [{ move: simpleBeam, pp: 10 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_338), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("type-ability-ready-a"));
    room.receive("bob", ready("type-ability-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "type-ability-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "type-ability-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const expected = { player: { members: [{ ability: "SIMPLE" }] },
      opponent: { members: [{ types: ["WATER"] }] } };
    expect(room.snapshot().battle?.state.teams).toMatchObject(expected);
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams).toMatchObject(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state.teams).toMatchObject(expected);
  });

  it("keeps fixed damage and the guest's Gastro Acid suppression authoritative after restart", () => {
    const sonicBoom = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "SONICBOOM",
      name: "Bomba Sónica", functionCode: "06A", power: 1, accuracy: 0 };
    const gastroAcid = { ...MINIMAL_MOVE_CATALOG.GROWL, internalName: "GASTROACID",
      name: "Bilis", functionCode: "068", accuracy: 0 };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), ability: "SIMPLE",
        moves: [{ move: sonicBoom, pp: 10 }] }],
      opponent: [{ ...battler("opponent"), moves: [{ move: gastroAcid, pp: 10 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_339), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("fixed-suppress-ready-a"));
    room.receive("bob", ready("fixed-suppress-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "fixed-suppress-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "fixed-suppress-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const expected = { player: { members: [{ ability: null,
      volatile: { gastroAcid: true, originalAbility: "SIMPLE" } }] },
    opponent: { members: [{ hp: 80 }] } };
    expect(room.snapshot().battle?.state.teams).toMatchObject(expected);
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams).toMatchObject(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state.teams).toMatchObject(expected);
  });

  it("keeps Emergency Exit's owner choice authoritative across guest reconnect", () => {
    const room = new AuthoritativeBattleRoom("ABC234", formPivotBondAbilityBattle,
      new SeededRandom(24_329), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("form-pivot-ready-a"));
    room.receive("bob", ready("form-pivot-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "form-pivot-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "form-pivot-wait-b", battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message).toMatchObject({
      events: expect.arrayContaining([expect.objectContaining({ type: "forcedSwitchRequested",
        side: "player", ability: "EMERGENCYEXIT" })]),
      state: { replacementRequired: ["player"], pivotRequired: ["player"] },
    });
    room.disconnect("alice");
    expect(room.connect("alice").snapshot.battle?.state).toMatchObject({
      replacementRequired: ["player"], pivotRequired: ["player"],
      teams: { player: { activeIndex: 0, members: [{ ability: "EMERGENCYEXIT" },
        { ability: "PODERSABIO" }, { ability: "PARENTALBOND" }, { ability: "FORECAST" }] },
      opponent: { members: [{ ability: "SUCTIONCUPS" }, { ability: "DISGUISE" },
        { ability: "FLOWERGIFT" }] } },
    });
    const replacement = room.receive("alice", { type: "submitReplacement", version: 15,
      requestId: "form-pivot-replace-a", battleId: "ABC234-1", turn: 2, teamIndex: 3 });
    expect(replacement.find((entry) => entry.message.type === "replacementResolved")?.message)
      .toMatchObject({ events: expect.arrayContaining([expect.objectContaining({ type: "pokemonSwitched",
        reason: "forced", to: "host-castform" })]) });
    expect(room.snapshot().battle?.state).toMatchObject({ replacementRequired: [], pivotRequired: [],
      teams: { player: { activeIndex: 3 } } });
  });

  it("rejects a trapped host switch before queuing it in the authoritative room", () => {
    const room = new AuthoritativeBattleRoom("ABC234", authoritativeTrapBattle,
      new SeededRandom(24_328), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("trap-authority-ready-a"));
    room.receive("bob", ready("trap-authority-ready-b"));
    expect(room.snapshot().battle?.state.teams).toMatchObject({
      player: { members: expect.arrayContaining([expect.objectContaining({ types: ["STEEL"] })]) },
      opponent: { members: expect.arrayContaining([expect.objectContaining({ ability: "MAGNETPULL" })]) },
    });
    const rejected = room.receive("alice", { type: "submitAction", version: 15,
      requestId: "trap-authority-switch", battleId: "ABC234-1", turn: 1,
      action: { kind: "switch", teamIndex: 1 } });
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.message).toMatchObject({ type: "error", code: "INVALID_MESSAGE",
      message: expect.stringContaining("MAGNETPULL") });
    expect(room.snapshot().battle?.state).toMatchObject({ turn: 1,
      teams: { player: { activeIndex: 0 } } });
  });

  it("keeps authoritative weather and its passive damage across guest reconnect", () => {
    const room = new AuthoritativeBattleRoom("ABC234", weatherBattle, new SeededRandom(24_303), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("weather-ready-a"));
    room.receive("bob", ready("weather-ready-b"));
    expect(room.snapshot().battle?.state.effects).toMatchObject({ weather: "sun", weatherTurns: 5 });
    room.receive("alice", { type: "submitAction", version: 15, requestId: "weather-wait-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15, requestId: "weather-wait-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ events: expect.arrayContaining([expect.objectContaining({ type: "abilityDamage",
        ability: "SOLARPOWER", amount: 12 })]) });
    expect(room.snapshot().battle?.state).toMatchObject({ effects: { weather: "sun", weatherTurns: 4 },
      teams: { player: { members: [{ hp: 88 }] } } });
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state).toMatchObject({
      effects: { weather: "sun", weatherTurns: 4 }, teams: { player: { members: [{ hp: 88 }] } },
    });
  });

  it("keeps authoritative Trick Room and Electric Terrain across guest reconnect", () => {
    const room = new AuthoritativeBattleRoom("ABC234", fieldAbilityBattle, new SeededRandom(24_306), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("field-ready-a"));
    room.receive("bob", ready("field-ready-b"));
    expect(room.snapshot().battle?.state.effects).toMatchObject({
      trickRoomTurns: 5, terrain: "electric", terrainTurns: 5,
    });
    room.receive("alice", { type: "submitAction", version: 15, requestId: "field-wait-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "field-wait-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(room.snapshot().battle?.state.effects).toMatchObject({
      trickRoomTurns: 4, terrain: "electric", terrainTurns: 4,
    });
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.effects).toMatchObject({
      trickRoomTurns: 4, terrain: "electric", terrainTurns: 4,
    });
  });

  it("keeps authoritative Tailwind and Wind Power Charge across guest reconnect", () => {
    const room = new AuthoritativeBattleRoom("ABC234", windBattle, new SeededRandom(24_307), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("wind-ready-a"));
    room.receive("bob", ready("wind-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "wind-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "wind-wait-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(room.snapshot().battle?.state).toMatchObject({
      effects: { sides: { player: { tailwindTurns: 3 } } },
      teams: { player: { members: [{ volatile: { chargeTurns: 1 } }] } },
    });
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state).toMatchObject({
      effects: { sides: { player: { tailwindTurns: 3 } } },
      teams: { player: { members: [{ volatile: { chargeTurns: 1 } }] } },
    });
  });

  it("restores persistent extreme weather and its active suppressor after reconnect", () => {
    const room = new AuthoritativeBattleRoom("ABC234", extremeWeatherBattle, new SeededRandom(24_304), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("extreme-ready-a"));
    room.receive("bob", ready("extreme-ready-b"));
    expect(room.snapshot().battle?.state).toMatchObject({
      effects: { weather: "heavy-rain", weatherTurns: -1 },
      teams: { opponent: { members: [{ ability: "CLOUDNINE" }] } },
    });
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state).toMatchObject({
      effects: { weather: "heavy-rain", weatherTurns: -1 },
      teams: { opponent: { members: [{ ability: "CLOUDNINE" }] } },
    });
  });

  it("replicates an end-of-turn ability stage and restores it after reconnect", () => {
    const room = new AuthoritativeBattleRoom("ABC234", speedBoostBattle, new SeededRandom(24_305), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("speed-ready-a"));
    room.receive("bob", ready("speed-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "speed-wait-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15, requestId: "speed-wait-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ events: expect.arrayContaining([expect.objectContaining({ type: "abilityActivated",
        side: "player", ability: "SPEEDBOOST", effect: "raise-stat" })]) });
    expect(room.snapshot().battle?.state.teams.player.members[0]?.stages.speed).toBe(1);
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams.player.members[0]?.stages.speed).toBe(1);
  });

  it("replicates Pressure's PP cost and restores it after reconnect", () => {
    const room = new AuthoritativeBattleRoom("ABC234", pressureBattle, new SeededRandom(24_306), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("pressure-ready-a"));
    room.receive("bob", ready("pressure-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "pressure-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "pressure-wait-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    const expected = MINIMAL_MOVE_CATALOG.TACKLE.pp - 2;
    expect(room.snapshot().battle?.state.teams.player.members[0]?.moves[0]?.pp).toBe(expected);
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams.player.members[0]?.moves[0]?.pp).toBe(expected);
  });

  it("replicates consumed-item ability state and restores it after reconnect", () => {
    const room = new AuthoritativeBattleRoom("ABC234", unburdenBattle, new SeededRandom(24_307), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("unburden-ready-a"));
    room.receive("bob", ready("unburden-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "unburden-wait-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "unburden-wait-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(room.snapshot().battle?.state.teams.player.members[0]).toMatchObject({ heldItem: null,
      recyclableItem: "ORANBERRY", volatile: { unburdened: true, pickupItem: "ORANBERRY" } });
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams.player.members[0]).toMatchObject({
      recyclableItem: "ORANBERRY", volatile: { unburdened: true } });
  });

  it("replicates a reflected control move and restores it after reconnect", () => {
    const room = new AuthoritativeBattleRoom("ABC234", magicBounceBattle, new SeededRandom(24_308), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("bounce-ready-a"));
    room.receive("bob", ready("bounce-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "bounce-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15, requestId: "bounce-wait-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ events: expect.arrayContaining([expect.objectContaining({ type: "abilityActivated",
        side: "opponent", ability: "MAGICBOUNCE", effect: "reflect-move" })]) });
    expect(room.snapshot().battle?.state.teams.player.members[0]?.volatile?.tauntTurns).toBe(3);
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams.player.members[0]?.volatile?.tauntTurns).toBe(3);
  });

  it("resolves Water Bubble authoritatively and restores the resulting HP after reconnect", () => {
    const room = new AuthoritativeBattleRoom("ABC234", waterBubbleBattle, new SeededRandom(24_309), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("bubble-ready-a"));
    room.receive("bob", ready("bubble-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "bubble-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "bubble-wait-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    const hp = room.snapshot().battle?.state.teams.opponent.members[0]?.hp;
    expect(hp).toBeLessThan(60);
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams.opponent.members[0]?.hp).toBe(hp);
  });

  it("resolves Ice Scales authoritatively and restores the resulting HP after reconnect", () => {
    const room = new AuthoritativeBattleRoom("ABC234", iceScalesBattle, new SeededRandom(24_313), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("ice-scales-ready-a"));
    room.receive("bob", ready("ice-scales-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "ice-scales-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "ice-scales-wait-b", battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ trace: expect.arrayContaining([expect.objectContaining({ type: "damage",
        abilityModifiers: expect.arrayContaining([{ ability: "ICESCALES", multiplier: 2 / 3 }]) })]) });
    const hp = room.snapshot().battle?.state.teams.opponent.members[0]?.hp;
    expect(hp).toBeLessThan(100);
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams.opponent.members[0]?.hp).toBe(hp);
  });

  it("replicates Color Change authoritatively and restores its type after guest reconnect", () => {
    const room = new AuthoritativeBattleRoom("ABC234", colorChangeBattle, new SeededRandom(24_310), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("color-ready-a"));
    room.receive("bob", ready("color-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "color-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15, requestId: "color-wait-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ events: expect.arrayContaining([expect.objectContaining({ type: "abilityActivated",
        side: "opponent", ability: "COLORCHANGE", effect: "change-type" })]) });
    expect(room.snapshot().battle?.state.teams.opponent.members[0]?.types).toEqual(["WATER"]);
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams.opponent.members[0]?.types).toEqual(["WATER"]);
  });

  it("replicates Mummy's ability replacement and restores it after guest reconnect", () => {
    const room = new AuthoritativeBattleRoom("ABC234", mummyBattle, new SeededRandom(24_311), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("mummy-ready-a"));
    room.receive("bob", ready("mummy-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "mummy-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15, requestId: "mummy-wait-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ events: expect.arrayContaining([expect.objectContaining({ type: "abilityActivated",
        side: "opponent", ability: "MUMMY", effect: "change-ability" })]) });
    expect(room.snapshot().battle?.state.teams.player.members[0]).toMatchObject({ ability: "MUMMY",
      volatile: { originalAbility: "HUSTLE" } });
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams.player.members[0]).toMatchObject({
      ability: "MUMMY", volatile: { originalAbility: "HUSTLE" },
    });
  });

  it("resolves Explosion authoritatively and restores its self-KO after guest reconnect", () => {
    const room = new AuthoritativeBattleRoom("ABC234", explosionBattle, new SeededRandom(24_312), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("explosion-ready-a"));
    room.receive("bob", ready("explosion-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "explosion-move-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15, requestId: "explosion-wait-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ events: expect.arrayContaining([expect.objectContaining({ type: "recoilDamage",
        side: "player", reason: "self-destruct", hp: 0 })]) });
    expect(room.snapshot().battle?.state).toMatchObject({ replacementRequired: ["player"],
      teams: { player: { members: [{ hp: 0 }, { hp: 100 }] } } });
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state).toMatchObject({ replacementRequired: ["player"],
      teams: { player: { members: [{ hp: 0 }, { hp: 100 }] } } });
  });

  it("deduplicates requests and rejects stale or duplicate turn actions", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(7), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("ready-a"));
    const firstReady = room.receive("bob", ready("ready-b"));
    const repeatedReady = room.receive("bob", ready("ready-b"));
    expect(repeatedReady[0]?.message).toEqual(firstReady[0]?.message);

    const action = { type: "submitAction", version: 15, requestId: "move-a", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } } as const;
    room.receive("alice", action);
    expect(room.receive("alice", action)[0]?.message.type).toBe("ack");
    const duplicate = room.receive("alice", { ...action, requestId: "move-a-2" });
    expect(duplicate[0]?.message).toMatchObject({ type: "error", code: "ACTION_ALREADY_SUBMITTED" });
    const stale = room.receive("bob", { ...action, requestId: "move-b", battleId: "wrong" });
    expect(stale[0]?.message).toMatchObject({ type: "error", code: "STALE_BATTLE" });
  });

  it("accepts a forced replacement before the following turn", () => {
    const room = new AuthoritativeBattleRoom("ABC234", battleWithReserve, new SeededRandom(7), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("ready-a"));
    room.receive("bob", ready("ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "move-a", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "move-b", battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(room.snapshot().battle?.state.replacementRequired).toEqual(["opponent"]);

    const replacement = room.receive("bob", { type: "submitReplacement", version: 15, requestId: "replace-b", battleId: "ABC234-1", turn: 2, teamIndex: 1 });
    expect(replacement.map((entry) => entry.message.type)).toEqual(["ack", "replacementResolved", "snapshot"]);
    expect(room.snapshot().battle?.state.teams.opponent.activeIndex).toBe(1);
    expect(room.snapshot().battle?.state.replacementRequired).toEqual([]);
  });

  it("resolves overworld intentions authoritatively and rejects stale sequences", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(3), world);
    room.connect("alice");
    room.connect("bob");
    const moved = room.receive("alice", { type: "moveAvatar", version: 15, requestId: "world-a-1", direction: "right", sequence: 1 });
    expect(moved.map((entry) => entry.message.type)).toEqual(["ack", "worldUpdated"]);
    expect(room.snapshot().world.avatars.player).toMatchObject({ x: 3, y: 4, direction: "right" });
    expect(moved[1]?.message).toMatchObject({ type: "worldUpdated", side: "player", sequence: 1 });

    const stale = room.receive("alice", { type: "moveAvatar", version: 15, requestId: "world-a-stale", direction: "left", sequence: 1 });
    expect(stale[0]?.message).toMatchObject({ type: "error", code: "STALE_MOVEMENT" });
    expect(room.snapshot().world.avatars.player).toMatchObject({ x: 3, y: 4 });
  });

  it("resolves cooperative interactions without accepting a client target", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(3), world);
    room.connect("alice");
    room.connect("bob");

    const personal = room.receive("alice", { type: "interact", version: 15, requestId: "interact-a" });
    expect(personal.map((entry) => entry.message.type)).toEqual(["ack", "interactionUpdated"]);
    expect(room.snapshot().world.players.player?.inventory.ORAN_BERRY).toBe(1);

    const shared = room.receive("bob", { type: "interact", version: 15, requestId: "interact-b" });
    expect(shared[1]?.message).toMatchObject({ type: "interactionUpdated", events: [expect.objectContaining({ type: "dialogueShown" }), expect.objectContaining({ type: "interactionCompleted", policy: "SHARED" })] });
    expect(room.snapshot().world.session.completedInteractions).toContain("meadow-guide");
  });

  it("locks the world during an encounter and persists the result on return", () => {
    const room = new AuthoritativeBattleRoom("ABC234", encounterBattle, new SeededRandom(3), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", { type: "moveAvatar", version: 15, requestId: "toward-wild", direction: "left", sequence: 1 });

    const started = room.receive("alice", { type: "interact", version: 15, requestId: "start-wild" });
    expect(started.map((entry) => entry.message.type)).toEqual(["ack", "interactionUpdated", "snapshot"]);
    const battleId = room.snapshot().battle?.id;
    expect(room.snapshot()).toMatchObject({ phase: "battle", battle: { state: { teams: { opponent: { members: [{ hp: 1 }] } } } } });
    expect(room.receive("bob", { type: "moveAvatar", version: 15, requestId: "locked", direction: "up", sequence: 1 })[0]?.message)
      .toMatchObject({ type: "error", code: "INVALID_PHASE" });
    expect(room.receive("bob", { type: "submitAction", version: 15, requestId: "observer-action", battleId: battleId!, turn: 1, action: { kind: "move", moveIndex: 0 } })[0]?.message)
      .toMatchObject({ type: "error", code: "INVALID_PHASE" });

    const finished = room.receive("alice", { type: "submitAction", version: 15, requestId: "encounter-action", battleId: battleId!, turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(finished.map((entry) => entry.message.type)).toEqual(["ack", "turnResolved", "snapshot"]);
    expect(room.snapshot()).toMatchObject({ phase: "waiting", battle: null });
    expect(room.snapshot().world.session.battleResults).toContainEqual({ encounterId: "wild-meadow-1", kind: "wild", winner: "player" });
  });

  it("lets the guest join an encounter on the opposing camp after host approval and restores ownership", () => {
    const room = new AuthoritativeBattleRoom("ABC234", encounterBattle, new SeededRandom(7), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", { type: "moveAvatar", version: 15, requestId: "toward-join", direction: "left", sequence: 1 });
    room.receive("alice", { type: "interact", version: 15, requestId: "start-join" });
    const battle = room.snapshot().battle!;
    const guest = { ...battler("opponent"), id: "guest-mon", hp: 100 };
    const proposed = room.receive("bob", { type: "proposeBattleJoin", version: 15, requestId: "join-enemy",
      battleId: battle.id, side: "opponent", team: { activeIndex: 0, members: [guest] },
      finalMemberIds: [guest.id] });
    expect(proposed.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().battle?.joinProposal).toMatchObject({ joinerId: "bob", side: "opponent" });

    room.receive("alice", { type: "respondBattleJoin", version: 15, requestId: "accept-join",
      battleId: battle.id, accept: true });
    expect(room.snapshot().battle).toMatchObject({ participation: { camps: { opponent: {
      trainerIds: ["bob"], activeMemberId: "guest-mon", members: [{ ownerId: "bob" }],
    } } }, joinProposal: null });
    expect(room.receive("alice", { type: "submitAction", version: 15, requestId: "joined-host-action",
      battleId: battle.id, turn: 1, action: { kind: "move", moveIndex: 0 } })).toHaveLength(1);
    const resolved = room.receive("bob", { type: "submitAction", version: 15, requestId: "joined-guest-action",
      battleId: battle.id, turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(resolved.map((entry) => entry.message.type)).toEqual(["ack", "turnResolved", "snapshot"]);

    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", encounterBattle, new SeededRandom(persisted.rngState), world, persisted);
    expect(restored.snapshot().battle?.participation?.camps.opponent.members[0]).toMatchObject({ ownerId: "bob" });
    expect(restored.snapshot().battle?.ledger?.engagedMemberIds).toEqual({ player: ["player"], opponent: ["guest-mon"] });
  });

  it("opens, persists and settles a Pokemon Z battle through the authoritative room", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const playerTeam = initialBattle().teams.player;
    const opponentTeam = { ...initialBattle().teams.opponent,
      members: initialBattle().teams.opponent.members.map((member) => ({ ...member, hp: 1 })) };
    const forbidden = room.receive("bob", { type: "openSourceBattle", version: 15,
      requestId: "source-battle-guest", context: sourceTrainerBattleContext("bob"), playerTeam, opponentTeam });
    expect(forbidden[0]?.message).toMatchObject({ type: "error", code: "HOST_ONLY" });

    const opened = room.receive("alice", { type: "openSourceBattle", version: 15,
      requestId: "source-battle-host", context: sourceBattleContext("alice"), playerTeam, opponentTeam });
    expect(opened.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().battle).toMatchObject({ duel: false,
      session: { origin: "source-wild", lifecycle: "join-window", narrativeOwnerId: "alice" },
      sourceContext: { mapId: 3, continuation: "pending-encounter" },
      participation: { battleOwnerId: "alice" } });

    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState),
      worldWithSource, persisted);
    expect(restored.snapshot().battle).toEqual(room.snapshot().battle);
    const battle = restored.snapshot().battle!;
    restored.receive("alice", { type: "submitAction", version: 15, requestId: "source-battle-turn",
      battleId: battle.id, turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(restored.snapshot().battle).toMatchObject({ state: { status: "finished", winner: "player" },
      session: { lifecycle: "settling", settlementId: `${battle.id}:settlement` },
      sourceContext: { origin: "source-wild" } });
  });

  it("enforces the source Pickpocket theft rule in the authoritative room", () => {
    const contactMove = { ...MINIMAL_MOVE_CATALOG.TACKLE, flags: "a" };
    const sourceState = createTeamBattleState({
      player: [{ ...battler("player"), heldItem: "ORANBERRY",
        moves: [{ move: contactMove, pp: contactMove.pp }] }],
      opponent: [{ ...battler("opponent"), ability: "PICKPOCKET" }],
    });
    const run = (origin: "source-wild" | "source-trainer") => {
      const room = new AuthoritativeBattleRoom(`PICK-${origin}`, initialBattle, new SeededRandom(9), worldWithSource);
      room.connect("alice");
      room.connect("bob");
      const context = origin === "source-wild" ? sourceBattleContext("alice") : sourceTrainerBattleContext("alice");
      room.receive("alice", { type: "openSourceBattle", version: 15, requestId: `open-${origin}`, context,
        playerTeam: sourceState.teams.player, opponentTeam: sourceState.teams.opponent });
      const battle = room.snapshot().battle!;
      room.receive("alice", { type: "closeBattleJoinWindow", version: 15, requestId: `close-${origin}`,
        battleId: battle.id });
      const output = room.receive("alice", { type: "submitAction", version: 15, requestId: `turn-${origin}`,
        battleId: battle.id, turn: 1, action: { kind: "move", moveIndex: 0 } });
      return { room, output };
    };

    const wild = run("source-wild");
    expect(wild.room.snapshot().battle?.state.teams.player.members[0]?.heldItem).toBe("ORANBERRY");
    expect(wild.room.snapshot().battle?.state.teams.opponent.members[0]?.heldItem).toBeNull();

    const trainer = run("source-trainer");
    expect(trainer.room.snapshot().battle?.state.teams.player.members[0]?.heldItem).toBeNull();
    expect(trainer.room.snapshot().battle?.state.teams.opponent.members[0]?.heldItem).toBe("ORANBERRY");
    expect(trainer.output).toEqual(expect.arrayContaining([expect.objectContaining({ message: expect.objectContaining({
      type: "turnResolved", events: expect.arrayContaining([expect.objectContaining({ type: "heldItemTransferred",
        source: "player", target: "opponent", item: "ORANBERRY" })]),
    }) })]));
  });

  it("keeps a native double source battle hidden until the adjacent guest chooses to observe", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const secondPlayer = { ...battler("player"), id: "player-two" };
    const secondOpponent = { ...battler("opponent"), id: "opponent-two" };
    const context = { ...sourceBattleContext("alice"), format: "double" as const,
      rewards: { ...sourceBattleContext("alice").rewards, opponents: [
        ...sourceBattleContext("alice").rewards.opponents,
        { memberId: secondOpponent.id, species: secondOpponent.species, level: secondOpponent.level,
          baseExperience: 58 },
      ] } };
    room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "native-double-open",
      context, playerTeam: { activeIndex: 0, members: [battler("player"), secondPlayer] },
      opponentTeam: { activeIndex: 0, members: [battler("opponent"), secondOpponent] } });
    const battle = room.snapshot().battle!;
    expect(battle).toMatchObject({ state: { format: "double" }, session: { lifecycle: "active" },
      observerIds: [] });
    const refused = room.receive("bob", { type: "proposeBattleJoin", version: 15,
      requestId: "native-double-join", battleId: battle.id, side: "player",
      team: initialBattle().teams.player, finalMemberIds: ["player"] });
    expect(refused[0]?.message).toMatchObject({ type: "error", code: "INVALID_PHASE",
      message: expect.stringContaining("sauvage est deja double") });
    const observed = room.receive("bob", { type: "observeBattle", version: 15,
      requestId: "native-double-observe", battleId: battle.id });
    expect(observed.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().battle?.observerIds).toEqual(["bob"]);
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState),
      worldWithSource, persisted);
    expect(restored.snapshot().battle?.observerIds).toEqual(["bob"]);
  });

  it("lets the host help a shared wild encounter opened by the guest", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(7), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const initial = initialBattle();
    const opened = room.receive("bob", { type: "openSourceBattle", version: 15,
      requestId: "guest-wild-open", context: sourceBattleContext("bob"),
      playerTeam: initial.teams.player, opponentTeam: initial.teams.opponent });
    expect(opened.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    const battleId = room.snapshot().battle!.id;
    expect(room.snapshot().battle).toMatchObject({
      session: { origin: "source-wild", narrativeOwnerId: "bob", lifecycle: "join-window" },
      participation: { battleOwnerId: "bob", camps: { player: { trainerIds: ["bob"] } } },
    });

    const helper = { ...battler("player"), id: "host-helper" };
    room.receive("alice", { type: "proposeBattleJoin", version: 15, requestId: "host-help-proposal",
      battleId, side: "player", team: { activeIndex: 0, members: [helper] },
      finalMemberIds: ["player", helper.id] });
    room.receive("bob", { type: "respondBattleJoin", version: 15, requestId: "guest-accepts-help",
      battleId, accept: true });
    expect(room.snapshot().battle).toMatchObject({ participation: { camps: { player: {
      trainerIds: ["bob", "alice"], activeMemberId: "player", activeMemberIds: ["player", helper.id],
    } } }, state: { turn: 1, format: "double", teams: { player: { activeIndices: [0, 1] } } } });
    room.receive("alice", { type: "submitAction", version: 15, requestId: "host-helper-turn",
      battleId, turn: 1, activeSlot: 1, action: { kind: "move", moveIndex: 0 } });
    const helped = room.receive("bob", { type: "submitAction", version: 15, requestId: "guest-owner-turn",
      battleId, turn: 1, activeSlot: 0, action: { kind: "move", moveIndex: 0 } });
    expect(helped.map((entry) => entry.message.type)).toContain("turnResolved");
  });

  it("resolves Plus and Minus from host and guest slots and restores their authoritative state", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(24_308), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const initial = initialBattle();
    const special = { ...MINIMAL_MOVE_CATALOG.SWIFT, accuracy: 0 };
    const plus = { ...initial.teams.player.members[0]!, ability: "PLUS",
      moves: [{ move: special, pp: special.pp }] };
    const minus = { ...battler("player"), id: "guest-minus", ability: "MINUS" };
    room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "partner-open",
      context: sourceBattleContext("alice"), playerTeam: { activeIndex: 0, members: [plus] },
      opponentTeam: initial.teams.opponent });
    const battleId = room.snapshot().battle!.id;
    room.receive("bob", { type: "proposeBattleJoin", version: 15, requestId: "partner-propose",
      battleId, side: "player", team: { activeIndex: 0, members: [minus] },
      finalMemberIds: [plus.id, minus.id] });
    room.receive("alice", { type: "respondBattleJoin", version: 15, requestId: "partner-accept",
      battleId, accept: true });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "partner-guest-wait",
      battleId, turn: 1, activeSlot: 1, action: { kind: "wait" } });
    const resolved = room.receive("alice", { type: "submitAction", version: 15,
      requestId: "partner-host-move", battleId, turn: 1, activeSlot: 0,
      action: { kind: "move", moveIndex: 0 } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ trace: expect.arrayContaining([expect.objectContaining({ type: "damage",
        abilityModifiers: expect.arrayContaining([{ ability: "PLUS", multiplier: 1.5 }]) })]) });
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle,
      new SeededRandom(persisted.rngState), worldWithSource, persisted);
    expect(restored.connect("bob").snapshot.battle?.state.teams.player).toMatchObject({
      activeIndices: [0, 1], members: [{ ability: "PLUS" }, { ability: "MINUS" }],
    });
  });

  it("keeps an away guest wild battle joinable when the host reaches its map", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(7), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    room.receive("bob", { type: "setSourcePresence", version: 15,
      requestId: "away-wild-presence", attached: false, avatar: null, mapId: 7 });
    const initial = initialBattle();
    const context = { ...sourceBattleContext("bob"), mapId: 7 };
    const opened = room.receive("bob", { type: "openSourceBattle", version: 15,
      requestId: "away-wild-open", context,
      playerTeam: initial.teams.player, opponentTeam: initial.teams.opponent });
    expect(opened.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().battle).toMatchObject({ sourceContext: { mapId: 7 },
      participation: { battleOwnerId: "bob" } });

    const destination = { ...sourceWorld, mapId: 7 };
    room.receive("alice", { type: "setSourceWorld", version: 15,
      requestId: "host-reaches-away-wild", world: destination });
    room.receive("bob", { type: "setSourcePresence", version: 15,
      requestId: "away-owner-attaches", attached: true,
      avatar: { x: 1, y: 2, direction: "up" }, mapId: 7 });
    expect(room.snapshot().sourceWorld).toMatchObject({ mapId: 7, presence: { opponent: "shared" } });

    const battleId = room.snapshot().battle!.id;
    const helper = { ...battler("player"), id: "travelling-host-helper" };
    const proposed = room.receive("alice", { type: "proposeBattleJoin", version: 15,
      requestId: "travelling-host-proposal", battleId, side: "player",
      team: { activeIndex: 0, members: [helper] }, finalMemberIds: ["player", helper.id] });
    expect(proposed.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
  });

  it("lets a guest help a wild battle from the next turn without resetting its history", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(7), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const initial = initialBattle();
    room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "wild-mid-open",
      context: sourceBattleContext("alice"), playerTeam: initial.teams.player, opponentTeam: initial.teams.opponent });
    const battleId = room.snapshot().battle!.id;
    room.receive("alice", { type: "submitAction", version: 15, requestId: "wild-mid-turn",
      battleId, turn: 1, action: { kind: "move", moveIndex: 0 } });
    const beforeJoin = room.snapshot().battle!;
    expect(beforeJoin.state.turn).toBe(2);
    expect(beforeJoin.session.lifecycle).toBe("active");
    const ledgerBeforeJoin = beforeJoin.ledger;

    const guest = { ...battler("player"), id: "guest-helper" };
    room.receive("bob", { type: "proposeBattleJoin", version: 15, requestId: "wild-mid-propose",
      battleId, side: "player", team: { activeIndex: 0, members: [guest] },
      finalMemberIds: ["player", guest.id] });
    room.receive("alice", { type: "respondBattleJoin", version: 15, requestId: "wild-mid-accept",
      battleId, accept: true });
    expect(room.snapshot().battle).toMatchObject({ state: { turn: 2 }, participation: { camps: { player: {
      activeMemberId: "player", activeMemberIds: ["player", guest.id], trainerIds: ["alice", "bob"],
    } } }, ledger: ledgerBeforeJoin });

    room.receive("bob", { type: "submitAction", version: 15, requestId: "wild-helper-turn",
      battleId, turn: 2, activeSlot: 1, action: { kind: "move", moveIndex: 0 } });
    const nextTurn = room.receive("alice", { type: "submitAction", version: 15, requestId: "wild-owner-turn-2",
      battleId, turn: 2, activeSlot: 0, action: { kind: "move", moveIndex: 0 } });
    expect(nextTurn.map((entry) => entry.message.type)).toContain("turnResolved");
  });

  it("persists an explicit observer choice and lets only the host close the join window", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const playerTeam = initialBattle().teams.player;
    const opponentTeam = initialBattle().teams.opponent;
    room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "open-observed",
      context: sourceBattleContext("alice"), playerTeam, opponentTeam });
    const battleId = room.snapshot().battle!.id;

    const unauthorizedAction = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "observer-action-before-choice", battleId, turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(unauthorizedAction[0]?.message).toMatchObject({ type: "error", code: "INVALID_PHASE" });
    expect(room.snapshot().battle?.session.lifecycle).toBe("join-window");

    room.receive("bob", { type: "observeBattle", version: 15, requestId: "observe", battleId });
    expect(room.snapshot().battle?.observerIds).toEqual(["bob"]);
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState),
      worldWithSource, persisted);
    expect(restored.snapshot().battle?.observerIds).toEqual(["bob"]);
    expect(restored.receive("bob", { type: "closeBattleJoinWindow", version: 15,
      requestId: "guest-close", battleId })[0]?.message).toMatchObject({ type: "error", code: "HOST_ONLY" });
    expect(restored.receive("bob", { type: "proposeBattleJoin", version: 15, requestId: "observer-join",
      battleId, side: "player", team: playerTeam, finalMemberIds: ["player"] })[0]?.message)
      .toMatchObject({ type: "error", message: expect.stringContaining("observer") });
    const closed = restored.receive("alice", { type: "closeBattleJoinWindow", version: 15,
      requestId: "host-close", battleId });
    expect(closed.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(restored.snapshot().battle?.session.lifecycle).toBe("active");
  });

  it("lets the trainer battle owner continue alone without opening Coop", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const initial = initialBattle();
    room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "solo-choice-open",
      context: sourceTrainerBattleContext("alice"), playerTeam: initial.teams.player,
      opponentTeam: initial.teams.opponent });
    const battleId = room.snapshot().battle!.id;
    expect(room.snapshot().battle?.session.lifecycle).toBe("invite-choice");
    const refused = room.receive("bob", { type: "proposeBattleJoin", version: 15,
      requestId: "join-before-call", battleId, side: "player", team: initial.teams.player,
      finalMemberIds: ["player"] });
    expect(refused[0]?.message).toMatchObject({ type: "error", code: "INVALID_PHASE" });
    expect(room.receive("alice", { type: "closeBattleJoinWindow", version: 15,
      requestId: "continue-alone", battleId }).map((entry) => entry.message.type))
      .toEqual(["ack", "snapshot"]);
    expect(room.snapshot().battle?.session.lifecycle).toBe("active");
  });

  it("lets the guest take the second allied slot against a native duo of source trainers", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const initial = initialBattle();
    const hostSecond = { ...battler("player"), id: "host-second" };
    const duoSecond = { ...battler("opponent"), id: "duo-second" };
    const opened = room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "trainer-duo-open",
      context: { ...sourceTrainerBattleContext("alice"), format: "double", rewards: {
        ...sourceTrainerBattleContext("alice").rewards, opponents: [
          ...sourceTrainerBattleContext("alice").rewards.opponents,
          { memberId: duoSecond.id, species: duoSecond.species, level: duoSecond.level, baseExperience: 58 },
        ] } }, playerTeam: { activeIndex: 0, members: [initial.teams.player.members[0]!, hostSecond] },
      opponentTeam: { activeIndex: 0, members: [initial.teams.opponent.members[0]!, duoSecond] } });
    const battleId = room.snapshot().battle!.id;
    expect(opened.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().battle).toMatchObject({ state: { format: "double", teams: {
      player: { activeIndices: [0, 1] }, opponent: { activeIndices: [0, 1] },
    } }, session: { lifecycle: "invite-choice" } });
    room.receive("alice", { type: "requestBattleJoinWindow", version: 15,
      requestId: "trainer-duo-call", battleId });
    const helper = { ...battler("player"), id: "guest-helper" };
    room.receive("bob", { type: "proposeBattleJoin", version: 15, requestId: "trainer-duo-propose",
      battleId, side: "player", team: { activeIndex: 0, members: [helper] },
      finalMemberIds: ["player", hostSecond.id, helper.id] });
    room.receive("alice", { type: "respondBattleJoin", version: 15, requestId: "trainer-duo-accept",
      battleId, accept: true });
    expect(room.snapshot().battle).toMatchObject({ state: { format: "double", teams: {
      player: { activeIndices: [0, 2] }, opponent: { activeIndices: [0, 1] },
    } }, participation: { camps: {
      player: { trainerIds: ["alice", "bob"], activeMemberIds: ["player", "guest-helper"] },
      opponent: { activeMemberIds: ["opponent", "duo-second"] },
    } } });
  });

  it("requires the host to answer a valid composition before closing the join window", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(1), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const playerTeam = initialBattle().teams.player;
    const opponentTeam = initialBattle().teams.opponent;
    room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "open-proposal",
      context: sourceTrainerBattleContext("alice"), playerTeam, opponentTeam });
    const battleId = room.snapshot().battle!.id;
    expect(room.receive("alice", { type: "submitAction", version: 15, requestId: "trainer-too-early",
      battleId, turn: 1, action: { kind: "move", moveIndex: 0 } })[0]?.message)
      .toMatchObject({ type: "error", code: "INVALID_PHASE", message: expect.stringContaining("attend") });
    expect(room.snapshot().battle?.session.lifecycle).toBe("invite-choice");
    expect(room.receive("alice", { type: "requestBattleJoinWindow", version: 15,
      requestId: "trainer-call-guest", battleId }).map((entry) => entry.message.type))
      .toEqual(["ack", "snapshot"]);
    expect(room.snapshot().battle?.session.lifecycle).toBe("join-window");
    expect(room.receive("bob", { type: "moveAvatar", version: 15, requestId: "trainer-guest-move-away",
      direction: "left", sequence: 1 }).map((entry) => entry.message.type))
      .toEqual(["ack", "sourceWorldUpdated"]);
    const guest = { ...battler("opponent"), id: "guest-source-mon" };
    expect(room.receive("bob", { type: "proposeBattleJoin", version: 15, requestId: "source-too-far",
      battleId, side: "opponent", team: { activeIndex: 0, members: [guest] },
      finalMemberIds: ["opponent", guest.id] })[0]?.message)
      .toMatchObject({ type: "error", code: "INTERACTION_UNAVAILABLE", message: expect.stringContaining("a cote") });
    room.receive("bob", { type: "moveAvatar", version: 15, requestId: "trainer-guest-move-back",
      direction: "right", sequence: 2 });
    room.receive("bob", { type: "proposeBattleJoin", version: 15, requestId: "source-proposal",
      battleId, side: "opponent", team: { activeIndex: 0, members: [guest] },
      finalMemberIds: ["opponent", guest.id] });
    expect(room.receive("alice", { type: "closeBattleJoinWindow", version: 15,
      requestId: "close-with-proposal", battleId })[0]?.message)
      .toMatchObject({ type: "error", message: expect.stringContaining("acceptee ou refusee") });
    room.receive("alice", { type: "respondBattleJoin", version: 15, requestId: "accept-source-proposal",
      battleId, accept: true });
    expect(room.snapshot().battle?.participation?.camps.opponent.members.map((member) => member.battler.id))
      .toEqual(["opponent", "guest-source-mon"]);
    expect(room.snapshot().battle?.session.lifecycle).toBe("active");
  });

  it("keeps encounter credits when the host refuses a join proposal", () => {
    const room = new AuthoritativeBattleRoom("ABC234", encounterBattle, new SeededRandom(7), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", { type: "moveAvatar", version: 15, requestId: "toward-refusal", direction: "left", sequence: 1 });
    room.receive("alice", { type: "interact", version: 15, requestId: "start-refusal" });
    const battle = room.snapshot().battle!;
    const guest = { ...battler("opponent"), id: "refused-mon", hp: 100 };
    room.receive("bob", { type: "proposeBattleJoin", version: 15, requestId: "propose-refusal",
      battleId: battle.id, side: "opponent", team: { activeIndex: 0, members: [guest] }, finalMemberIds: [guest.id] });
    room.receive("alice", { type: "respondBattleJoin", version: 15, requestId: "refuse-join",
      battleId: battle.id, accept: false });
    expect(room.snapshot().battle).toMatchObject({ joinProposal: null,
      joinRefusal: { playerId: "bob", reason: expect.stringContaining("refusee") },
      ledger: { engagedMemberIds: { player: ["player"], opponent: ["opponent"] } } });
  });

  it("requires every participating trainer to confirm escape and persists the consensus", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(2), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const initial = initialBattle();
    room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "escape-open",
      context: sourceBattleContext("alice"), playerTeam: initial.teams.player, opponentTeam: initial.teams.opponent });
    const battleId = room.snapshot().battle!.id;
    const helper = { ...battler("player"), id: "escape-helper" };
    room.receive("bob", { type: "proposeBattleJoin", version: 15, requestId: "escape-join",
      battleId, side: "player", team: { activeIndex: 0, members: [helper] },
      finalMemberIds: ["player", helper.id] });
    room.receive("alice", { type: "respondBattleJoin", version: 15, requestId: "escape-join-accept",
      battleId, accept: true });
    const firstVote = room.receive("alice", { type: "attemptBattleEscape", version: 15,
      requestId: "escape-host", battleId, turn: 1 });
    expect(firstVote.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().battle).toMatchObject({ escaped: false, escapeAttempts: 0,
      escapeConfirmations: ["alice"] });
    const pending = room.exportState();
    const cancelled = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "escape-cancelled-by-action", battleId, turn: 1, activeSlot: 1,
      action: { kind: "move", moveIndex: 0 } });
    expect(cancelled.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().battle?.escapeConfirmations).toEqual([]);
    const restoredPending = new AuthoritativeBattleRoom("ABC234", initialBattle,
      new SeededRandom(pending.rngState), worldWithSource, pending);
    expect(restoredPending.snapshot().battle?.escapeConfirmations).toEqual(["alice"]);
    const escaped = restoredPending.receive("bob", { type: "attemptBattleEscape", version: 15,
      requestId: "escape-guest", battleId, turn: 1 });
    expect(escaped.map((entry) => entry.message.type)).toEqual([
      "ack", "battleSettlement", "battleSettlement", "battleEscaped", "snapshot",
    ]);
    const settlement = escaped.find((entry) => entry.message.type === "battleSettlement")?.message;
    expect(settlement).toMatchObject({ type: "battleSettlement", settlement: { ownerId: "alice",
      battleId, outcome: "escaped", money: { kind: "none" }, healParty: false } });
    expect(restoredPending.snapshot()).toMatchObject({ phase: "finished", battle: { escaped: true,
      escapeAttempts: 1, escapeConfirmations: [],
      session: { lifecycle: "settling", settlementId: `${battleId}:settlement` } } });
    const persisted = restoredPending.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle,
      new SeededRandom(persisted.rngState), worldWithSource, persisted);
    expect(restored.snapshot().battle).toMatchObject({ escaped: true, escapeAttempts: 1 });
    expect(restored.connect("alice").settlement).toMatchObject({ battleId, ownerId: "alice" });
    expect(restored.receive("alice", { type: "ackBattleSettlement", version: 15,
      requestId: "escape-settlement-ack", settlementId: `${battleId}-alice` })[0]?.message).toMatchObject({ type: "ack" });
    expect(restored.connect("alice").settlement).toBeNull();
  });

  it("settles a Teleport turn as a wild escape and restores the escaped room", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(2), worldWithSource);
    room.connect("alice");
    const move = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "TELEPORT",
      functionCode: "0EA" as const, category: "Status" as const, power: 0, accuracy: 0 };
    const initial = createTeamBattleState({
      player: [{ ...battler("player"), moves: [{ move, pp: move.pp }] }],
      opponent: [battler("opponent")],
    });
    room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "teleport-open",
      context: sourceBattleContext("alice"), playerTeam: initial.teams.player,
      opponentTeam: initial.teams.opponent });
    const battleId = room.snapshot().battle!.id;
    const output = room.receive("alice", { type: "submitAction", version: 15,
      requestId: "teleport-turn", battleId, turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(output.map((entry) => entry.message.type)).toContain("battleEscaped");
    expect(output.find((entry) => entry.message.type === "battleSettlement")?.message)
      .toMatchObject({ type: "battleSettlement", settlement: { outcome: "escaped", money: { kind: "none" } } });
    expect(room.snapshot().battle).toMatchObject({ escaped: true, state: { status: "finished" } });
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle,
      new SeededRandom(persisted.rngState), worldWithSource, persisted);
    expect(restored.snapshot().battle).toMatchObject({ escaped: true });
    expect(restored.connect("alice").settlement).toMatchObject({ battleId, ownerId: "alice" });
  });

  it("lets an invited guest end a shared wild battle with Teleport", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(3), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const initial = initialBattle();
    room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "guest-teleport-open",
      context: sourceBattleContext("alice"), playerTeam: initial.teams.player,
      opponentTeam: initial.teams.opponent });
    const battleId = room.snapshot().battle!.id;
    const move = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "TELEPORT",
      functionCode: "0EA" as const, category: "Status" as const, power: 0, accuracy: 0 };
    const helper = { ...battler("player"), id: "guest-teleporter", moves: [{ move, pp: move.pp }] };
    room.receive("bob", { type: "proposeBattleJoin", version: 15, requestId: "guest-teleport-propose",
      battleId, side: "player", team: { activeIndex: 0, members: [helper] },
      finalMemberIds: ["player", helper.id] });
    room.receive("alice", { type: "respondBattleJoin", version: 15,
      requestId: "guest-teleport-accept", battleId, accept: true });
    room.receive("alice", { type: "submitAction", version: 15, requestId: "guest-teleport-host-wait",
      battleId, turn: 1, activeSlot: 0, action: { kind: "wait" } });
    const output = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "guest-teleport-move", battleId, turn: 1, activeSlot: 1,
      action: { kind: "move", moveIndex: 0 } });
    expect(output.map((entry) => entry.message.type)).toContain("battleEscaped");
    expect(output.filter((entry) => entry.message.type === "battleSettlement")).toHaveLength(2);
    expect(room.snapshot().battle).toMatchObject({ escaped: true });
  });

  it("settles Pay Day coins only for their winning owner and restores them after reconnect", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(5), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const initial = initialBattle();
    room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "coins-open",
      context: sourceBattleContext("alice"), playerTeam: initial.teams.player,
      opponentTeam: { ...initial.teams.opponent, members: [{ ...initial.teams.opponent.members[0]!, hp: 1 }] } });
    const battleId = room.snapshot().battle!.id;
    const payDay = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "PAYDAY", functionCode: "109" as const };
    const guest = { ...battler("player"), id: "guest-payday", moves: [{ move: payDay, pp: payDay.pp }] };
    room.receive("bob", { type: "proposeBattleJoin", version: 15, requestId: "coins-propose",
      battleId, side: "player", team: { activeIndex: 0, members: [guest] },
      finalMemberIds: ["player", guest.id] });
    room.receive("alice", { type: "respondBattleJoin", version: 15,
      requestId: "coins-accept", battleId, accept: true });
    room.receive("alice", { type: "submitAction", version: 15, requestId: "coins-host-wait",
      battleId, turn: 1, activeSlot: 0, action: { kind: "wait" } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "coins-guest-hit",
      battleId, turn: 1, activeSlot: 1, action: { kind: "move", moveIndex: 0 } });
    expect(room.connect("alice").settlement?.money).toEqual({ kind: "none" });
    expect(room.connect("bob").settlement?.money).toEqual({ kind: "fixed", amount: 250 });
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle,
      new SeededRandom(persisted.rngState), worldWithSource, persisted);
    expect(restored.connect("bob").settlement?.money).toEqual({ kind: "fixed", amount: 250 });
  });

  it("keeps one private settlement per owner while a disconnected guest catches up", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(4), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const initial = initialBattle();
    const opponentTeam = { ...initial.teams.opponent,
      members: initial.teams.opponent.members.map((member) => ({ ...member, hp: 1 })) };
    room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "settlement-open",
      context: sourceTrainerBattleContext("alice"), playerTeam: initial.teams.player, opponentTeam });
    const battleId = room.snapshot().battle!.id;
    room.receive("alice", { type: "requestBattleJoinWindow", version: 15,
      requestId: "settlement-call", battleId });
    const guest = { ...battler("player"), id: "guest-mon" };
    room.receive("bob", { type: "proposeBattleJoin", version: 15, requestId: "settlement-join", battleId,
      side: "player", team: { activeIndex: 0, members: [guest] }, finalMemberIds: ["player", guest.id] });
    room.receive("alice", { type: "respondBattleJoin", version: 15, requestId: "settlement-accept",
      battleId, accept: true });
    room.receive("alice", { type: "closeBattleJoinWindow", version: 15, requestId: "settlement-close", battleId });
    room.disconnect("bob");
    room.connect("bob");
    room.receive("bob", { type: "submitAction", version: 15,
      requestId: "settlement-guest-action", battleId, turn: 1, activeSlot: 1,
      action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("alice", { type: "submitAction", version: 15,
      requestId: "settlement-win", battleId, turn: 1, activeSlot: 0,
      action: { kind: "move", moveIndex: 0 } });
    const settlements = resolved.filter((entry) => entry.message.type === "battleSettlement");
    expect(settlements).toHaveLength(2);
    expect(settlements.map((entry) => entry.audience)).toEqual([
      { playerId: "alice" }, { playerId: "bob" },
    ]);
    expect(room.connect("alice").settlement).toMatchObject({ outcome: "won", ownerId: "alice" });
    expect(room.connect("bob").settlement).toMatchObject({ outcome: "won", ownerId: "bob" });
    expect(room.receive("bob", { type: "closeSourceBattle", version: 15,
      requestId: "settlement-guest-close", battleId })[0]?.message).toMatchObject({ type: "error", code: "HOST_ONLY" });
    expect(room.receive("alice", { type: "closeSourceBattle", version: 15,
      requestId: "settlement-early-close", battleId })[0]?.message).toMatchObject({ type: "error", code: "INVALID_PHASE" });
    room.receive("alice", { type: "ackBattleSettlement", version: 15,
      requestId: "settlement-host-ack", settlementId: `${battleId}-alice` });
    expect(room.connect("alice").settlement).toBeNull();
    expect(room.connect("bob").settlement).not.toBeNull();
    expect(room.receive("alice", { type: "ackBattleSettlement", version: 15,
      requestId: "settlement-host-ack-again", settlementId: `${battleId}-alice` })[0]?.message)
      .toMatchObject({ type: "ack" });
    expect(room.receive("bob", { type: "ackBattleSettlement", version: 15,
      requestId: "settlement-wrong-owner", settlementId: `${battleId}-alice` })[0]?.message)
      .toMatchObject({ type: "error", code: "UNAUTHORIZED" });
    const closed = room.receive("alice", { type: "closeSourceBattle", version: 15,
      requestId: "settlement-host-close", battleId });
    expect(closed.map((entry) => entry.message.type)).toEqual(["ack", "snapshot"]);
    expect(room.snapshot().battle).toBeNull();
    expect(room.connect("bob").settlement).toMatchObject({ ownerId: "bob", battleId });
  });

  it("rolls Honey Gather in the authoritative room and restores the owner-scoped result", () => {
    const deterministic = { nextInt: () => 0, snapshot: () => 0 };
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, deterministic, worldWithSource);
    room.connect("alice");
    const initial = initialBattle();
    const playerTeam = { ...initial.teams.player, members: initial.teams.player.members.map((member) => ({
      ...member, ability: "HONEYGATHER" as const, heldItem: null, level: 100,
    })) };
    const opponentTeam = { ...initial.teams.opponent,
      members: initial.teams.opponent.members.map((member) => ({ ...member, hp: 1 })) };
    room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "honey-open",
      context: sourceBattleContext("alice"), playerTeam, opponentTeam });
    const battleId = room.snapshot().battle!.id;
    room.receive("alice", { type: "submitAction", version: 15, requestId: "honey-win",
      battleId, turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(room.connect("alice").settlement).toMatchObject({ ownerId: "alice",
      honeyGatherPokemonIds: [playerTeam.members[0]!.id] });
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, deterministic, worldWithSource, persisted);
    expect(restored.connect("alice").settlement).toMatchObject({
      honeyGatherPokemonIds: [playerTeam.members[0]!.id],
    });
  });

  it("keeps battle medicine owner-scoped and settles the consumption exactly for that owner", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(4), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const initial = initialBattle();
    const opponentTeam = { ...initial.teams.opponent,
      members: initial.teams.opponent.members.map((member) => ({ ...member, hp: 1 })) };
    room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "item-open",
      context: sourceTrainerBattleContext("alice"), playerTeam: initial.teams.player, opponentTeam,
      battleItems: { POTION: 1, XATTACK: 1 } });
    const battleId = room.snapshot().battle!.id;
    room.receive("alice", { type: "requestBattleJoinWindow", version: 15,
      requestId: "item-call", battleId });
    const guest = { ...battler("player"), id: "guest-item-mon", hp: 50 };
    room.receive("bob", { type: "proposeBattleJoin", version: 15, requestId: "item-join", battleId,
      side: "player", team: { activeIndex: 0, members: [guest] },
      finalMemberIds: ["player", guest.id], battleItems: { POTION: 1 } });
    room.receive("alice", { type: "respondBattleJoin", version: 15, requestId: "item-accept",
      battleId, accept: true });

    expect(room.receive("alice", { type: "submitAction", version: 15, requestId: "item-wrong-owner",
      battleId, turn: 1, activeSlot: 0,
      action: { kind: "item", itemId: "POTION", targetTeamIndex: 1 } })[0]?.message)
      .toMatchObject({ type: "error", code: "INVALID_MESSAGE" });
    const reserved = room.receive("bob", { type: "submitAction", version: 15, requestId: "item-own",
      battleId, turn: 1, activeSlot: 1,
      action: { kind: "item", itemId: "POTION", targetTeamIndex: 1 } });
    expect(reserved.map((entry) => entry.message.type)).toEqual(["ack", "battleInventoryUpdated"]);
    expect(room.connect("bob").battleInventory).toEqual({});
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle,
      new SeededRandom(persisted.rngState), worldWithSource, persisted);
    expect(restored.connect("bob").battleInventory).toEqual({});

    const finished = room.receive("alice", { type: "submitAction", version: 15, requestId: "item-finish",
      battleId, turn: 1, activeSlot: 0,
      action: { kind: "item", itemId: "XATTACK", targetTeamIndex: 0 } });
    expect(finished.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ events: expect.arrayContaining([expect.objectContaining({ type: "trainerItemUsed",
        itemId: "POTION", target: guest.id }), expect.objectContaining({ type: "trainerItemUsed",
        itemId: "XATTACK", target: "player", statRaised: "attack", stagesRaised: 1 })]) });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "item-next-guest",
      battleId, turn: 2, activeSlot: 1, action: { kind: "move", moveIndex: 0 } });
    room.receive("alice", { type: "submitAction", version: 15, requestId: "item-next-host",
      battleId, turn: 2, activeSlot: 0, action: { kind: "move", moveIndex: 0 } });
    expect(room.connect("bob").settlement).toMatchObject({ consumedItems: [{ itemId: "POTION", quantity: 1 }] });
    expect(room.connect("alice").settlement).toMatchObject({ consumedItems: [{ itemId: "XATTACK", quantity: 1 }] });
  });

  it("settles a wild capture only for the trainer who consumed the Ball", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(4), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const initial = initialBattle();
    const wild = { ...initial.teams.opponent.members[0]!,
      capture: { rate: 45, baseSpeed: 90, weight: 420 } };
    room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "capture-open",
      context: sourceBattleContext("alice"), playerTeam: initial.teams.player,
      opponentTeam: { activeIndex: 0, members: [wild] }, battleItems: { MASTERBALL: 1 } });
    const battleId = room.snapshot().battle!.id;
    const resolved = room.receive("alice", { type: "submitAction", version: 15,
      requestId: "capture-throw", battleId, turn: 1, action: { kind: "capture", ballId: "MASTERBALL" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ state: { status: "finished", winner: "player" } });
    expect(room.connect("alice").settlement).toMatchObject({ outcome: "captured", ownerId: "alice",
      consumedItems: [{ itemId: "MASTERBALL", quantity: 1 }],
      capturedPokemon: { ballId: "MASTERBALL", battler: { id: "opponent", species: "MEOWTH" } } });
  });

  it("suspends an owned active after disconnect and resumes the same turn", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(7), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const initial = initialBattle();
    room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "resume-open",
      context: sourceTrainerBattleContext("alice"), playerTeam: initial.teams.player, opponentTeam: initial.teams.opponent });
    const battleId = room.snapshot().battle!.id;
    room.receive("alice", { type: "requestBattleJoinWindow", version: 15,
      requestId: "resume-call", battleId });
    const guest = { ...battler("opponent"), id: "guest-active" };
    room.receive("bob", { type: "proposeBattleJoin", version: 15, requestId: "resume-join", battleId,
      side: "opponent", team: { activeIndex: 0, members: [guest] }, finalMemberIds: [guest.id] });
    room.receive("alice", { type: "respondBattleJoin", version: 15, requestId: "resume-accept", battleId,
      accept: true });
    expect(room.receive("bob", { type: "submitAction", version: 15, requestId: "resume-guest-before-drop",
      battleId, turn: 1, action: { kind: "move", moveIndex: 0 } })).toHaveLength(1);
    room.disconnect("bob");
    expect(room.receive("alice", { type: "submitAction", version: 15, requestId: "resume-host",
      battleId, turn: 1, action: { kind: "move", moveIndex: 0 } })).toHaveLength(1);
    expect(room.snapshot().battle?.state.turn).toBe(1);
    room.connect("bob");
    const resumed = room.receive("bob", { type: "submitAction", version: 15, requestId: "resume-guest-after-drop",
      battleId, turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(resumed.map((entry) => entry.message.type)).toContain("turnResolved");
    expect(room.snapshot().battle?.state.turn).toBe(2);
  });

  it("keeps and consumes a source Trainer item in the authoritative snapshot", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(7), worldWithSource);
    room.connect("alice");
    room.connect("bob");
    const initial = initialBattle();
    const opponentTeam = { ...initial.teams.opponent, items: ["SUPERPOTION"],
      members: initial.teams.opponent.members.map((member) => ({ ...member, hp: 20 })) };
    room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "trainer-item-open",
      context: sourceTrainerBattleContext("alice"), playerTeam: initial.teams.player, opponentTeam });
    const battleId = room.snapshot().battle!.id;
    expect(room.snapshot().battle?.state.teams.opponent.items).toEqual(["SUPERPOTION"]);
    room.receive("alice", { type: "closeBattleJoinWindow", version: 15,
      requestId: "trainer-item-solo", battleId });
    const resolved = room.receive("alice", { type: "submitAction", version: 15,
      requestId: "trainer-item-turn", battleId, turn: 1, action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ events: expect.arrayContaining([expect.objectContaining({ type: "trainerItemUsed",
        side: "opponent", itemId: "SUPERPOTION" })]) });
    expect(room.snapshot().battle?.state.teams.opponent).toMatchObject({ items: [], members: [{ hp: 70 }] });
    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState),
      worldWithSource, persisted);
    expect(restored.snapshot().battle?.state.teams.opponent.items).toEqual([]);
  });

  it("automatically replaces an unowned source Pokemon after a KO", () => {
    const room = new AuthoritativeBattleRoom("ABC234", battleWithReserve, new SeededRandom(4), worldWithSource);
    room.connect("alice");
    const initial = battleWithReserve();
    const context = { ...sourceBattleContext("alice"), rewards: {
      ...sourceBattleContext("alice").rewards,
      opponents: [
        ...sourceBattleContext("alice").rewards.opponents,
        { memberId: "opponent-reserve", species: "MEOWTH", level: 50, baseExperience: 58 },
      ],
    } };
    room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "replace-open", context,
      playerTeam: initial.teams.player, opponentTeam: initial.teams.opponent });
    const battle = room.snapshot().battle!;
    const resolved = room.receive("alice", { type: "submitAction", version: 15, requestId: "replace-ko",
      battleId: battle.id, turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(resolved.map((entry) => entry.message.type)).toEqual(["ack", "turnResolved", "replacementResolved", "snapshot"]);
    expect(room.snapshot().battle?.state).toMatchObject({ replacementRequired: [],
      teams: { opponent: { activeIndex: 1 } } });
  });

  it("waits for the player's replacement and accepts escape from that choice in a wild battle", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(4), worldWithSource);
    room.connect("alice");
    const initial = createTeamBattleState({
      player: [{ ...battler("player"), hp: 1 }, { ...battler("player"), id: "player-reserve" }],
      opponent: [battler("opponent")],
    });
    room.receive("alice", { type: "openSourceBattle", version: 15, requestId: "wild-replace-open",
      context: sourceBattleContext("alice"), playerTeam: initial.teams.player,
      opponentTeam: initial.teams.opponent });
    const battleId = room.snapshot().battle!.id;

    room.receive("alice", { type: "submitAction", version: 15, requestId: "wild-replace-turn",
      battleId, turn: 1, action: { kind: "move", moveIndex: 0 } });

    expect(room.snapshot().battle?.state).toMatchObject({ replacementRequired: ["player"],
      teams: { player: { activeIndex: 0, members: [{ hp: 0 }, { id: "player-reserve", hp: 100 }] } } });
    const turn = room.snapshot().battle!.state.turn;
    const escaped = room.receive("alice", { type: "attemptBattleEscape", version: 15,
      requestId: "wild-replace-escape", battleId, turn });
    expect(escaped.map((entry) => entry.message.type)).toEqual([
      "ack", "battleSettlement", "battleEscaped", "snapshot",
    ]);
    expect(room.snapshot().battle).toMatchObject({ escaped: true,
      state: { teams: { player: { activeIndex: 0 } } } });
  });

  it("restores a pending SYNCED interaction before the second participant", () => {
    const room = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(4), syncedWorld);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", { type: "interact", version: 15, requestId: "sync-a" });
    expect(room.snapshot().world.session.syncedParticipants.sync).toEqual(["player"]);

    const persisted = room.exportState();
    const restored = new AuthoritativeBattleRoom("ABC234", initialBattle, new SeededRandom(persisted.rngState), syncedWorld, persisted);
    restored.receive("bob", { type: "interact", version: 15, requestId: "sync-b" });
    expect(restored.snapshot().world.session.flags).toContain("SYNC_DONE");
    expect(restored.snapshot().world.session.completedInteractions).toContain("sync");
  });

  it("replicates Sketch and Conversion 2 for both players across reconnect and room restart", () => {
    const sketch = { ...MINIMAL_MOVE_CATALOG.GROWL, internalName: "SKETCH", name: "Gribouille",
      functionCode: "05D" as const, targetCode: "10", accuracy: 0 };
    const conversion2 = { ...sketch, internalName: "CONVERSION2", name: "Conversion 2",
      functionCode: "05F" as const };
    const water = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "WATERMOVE", type: "WATER" };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), moves: [{ move: sketch, pp: 10 }] }],
      opponent: [{ ...battler("opponent"), moves: [{ move: water, pp: 20 },
        { move: conversion2, pp: 10 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_340), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("copy-ready-a"));
    room.receive("bob", ready("copy-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "copy-wait-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "copy-water-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    room.receive("alice", { type: "submitAction", version: 15, requestId: "copy-sketch-a",
      battleId: "ABC234-1", turn: 2, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "copy-conversion-b", battleId: "ABC234-1", turn: 2,
      action: { kind: "move", moveIndex: 1 } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ trace: expect.arrayContaining([
        expect.objectContaining({ type: "rng", purpose: "conversion2" }),
      ]) });
    const expected = { player: { members: [{ moves: [{ move: { internalName: "WATERMOVE" } }],
      sketchedMoveSlots: [{ index: 0, move: { internalName: "WATERMOVE" } }] }] },
    opponent: { members: [{ volatile: { lastMoveUsedType: "NORMAL" } }] } };
    expect(room.snapshot().battle?.state.teams).toMatchObject(expected);
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams).toMatchObject(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state.teams).toMatchObject(expected);
  });

  it("restores 085 side-faint history and resolves 087 weather for both owners", () => {
    const retaliate = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "RETALIATE", functionCode: "085" as const,
      power: 50, accuracy: 0 };
    const strike = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "STRIKE", power: 50, accuracy: 0 };
    const weatherBall = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "WEATHERBALL",
      functionCode: "087" as const, category: "Special" as const, power: 50, accuracy: 0 };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), hp: 1 }, { ...battler("player"), id: "reserve",
        hp: 200, stats: { ...battler("player").stats, maxHp: 200 },
        moves: [{ move: retaliate, pp: 20 }] }],
      opponent: [{ ...battler("opponent"), ability: "DRIZZLE", hp: 200,
        stats: { ...battler("opponent").stats, maxHp: 200 },
        moves: [{ move: strike, pp: 20 }, { move: weatherBall, pp: 20 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_343), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("variable-ready-a"));
    room.receive("bob", ready("variable-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "variable-wait-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "variable-strike-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(room.snapshot().battle?.state.effects?.sides.player.lastFaintedTurn).toBe(1);
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.effects?.sides.player.lastFaintedTurn).toBe(1);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state.effects?.sides.player.lastFaintedTurn).toBe(1);
    restarted.connect("bob");
    restarted.receive("alice", { type: "submitReplacement", version: 15, requestId: "variable-replace-a",
      battleId: "ABC234-1", turn: 2, teamIndex: 1 });
    restarted.receive("alice", { type: "submitAction", version: 15, requestId: "variable-retaliate-a",
      battleId: "ABC234-1", turn: 2, action: { kind: "move", moveIndex: 0 } });
    restarted.receive("bob", { type: "submitAction", version: 15, requestId: "variable-weather-b",
      battleId: "ABC234-1", turn: 2, action: { kind: "move", moveIndex: 1 } });
    expect(restarted.snapshot().battle?.state.turn).toBe(3);
    expect(restarted.snapshot().battle?.state.teams.player.members[1]!.hp).toBeLessThan(200);
    expect(restarted.snapshot().battle?.state.teams.opponent.members[0]!.hp).toBeLessThan(200);
  });

  it("uses 08E and 08F for host and guest and restores their boosted stages", () => {
    const storedPower = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "STOREPOWER",
      functionCode: "08E" as const, power: 20, accuracy: 0 };
    const punishment = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "PUNISHMENT",
      functionCode: "08F" as const, power: 60, accuracy: 0 };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), hp: 200,
        stats: { ...battler("player").stats, maxHp: 200 },
        stages: { ...battler("player").stages, attack: 2, accuracy: 1 },
        moves: [{ move: storedPower, pp: 20 }] }],
      opponent: [{ ...battler("opponent"), hp: 200,
        stats: { ...battler("opponent").stats, maxHp: 200 },
        stages: { ...battler("opponent").stages, defense: 1 },
        moves: [{ move: punishment, pp: 20 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_344), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("stages-ready-a"));
    room.receive("bob", ready("stages-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "stages-power-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "stages-punishment-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const expected = room.snapshot().battle?.state.teams;
    expect(expected?.player.members[0]!.hp).toBeLessThan(200);
    expect(expected?.opponent.members[0]!.hp).toBeLessThan(200);
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams).toEqual(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state.teams).toEqual(expected);
  });

  it("resolves 090's derived type and category for host and guest without exposing IVs", () => {
    const hidden = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "HIDDENPOWER",
      functionCode: "090" as const, category: "Special" as const, power: 1, accuracy: 0 };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), hiddenPowerType: "FIGHTING", hp: 500,
        stats: { ...battler("player").stats, maxHp: 500 }, moves: [{ move: hidden, pp: 20 }] }],
      opponent: [{ ...battler("opponent"), hiddenPowerType: "FAIRY", hp: 500,
        stats: { ...battler("opponent").stats, maxHp: 500, attack: 120 },
        moves: [{ move: hidden, pp: 20 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_346), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("hidden-ready-a"));
    room.receive("bob", ready("hidden-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "hidden-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "hidden-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const expected = { player: { members: [{ hiddenPowerType: "FIGHTING",
      volatile: { lastMoveUsedType: "FIGHTING" } }] }, opponent: { members: [{ hiddenPowerType: "FAIRY",
      volatile: { lastMoveUsedType: "FAIRY" } }] } };
    expect(room.snapshot().battle?.state.teams).toMatchObject(expected);
    expect(JSON.stringify(room.snapshot().battle?.state.teams)).not.toContain('"ivs"');
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams).toMatchObject(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state.teams).toMatchObject(expected);
  });

  it("restores each owner's 092 side stack across reconnect and room restart", () => {
    const echo = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "ECHOEDVOICE",
      functionCode: "092" as const, power: 40, accuracy: 0 };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), hp: 500,
        stats: { ...battler("player").stats, maxHp: 500 }, moves: [{ move: echo, pp: 20 }] }],
      opponent: [{ ...battler("opponent"), hp: 500,
        stats: { ...battler("opponent").stats, maxHp: 500 }, moves: [{ move: echo, pp: 20 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_345), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("echo-ready-a"));
    room.receive("bob", ready("echo-ready-b"));
    for (let turn = 1; turn <= 2; turn += 1) {
      room.receive("alice", { type: "submitAction", version: 15, requestId: `echo-a-${turn}`,
        battleId: "ABC234-1", turn, action: { kind: "move", moveIndex: 0 } });
      room.receive("bob", { type: "submitAction", version: 15, requestId: `echo-b-${turn}`,
        battleId: "ABC234-1", turn, action: { kind: "move", moveIndex: 0 } });
    }
    const expected = { player: { echoedVoiceCount: 2, echoedVoiceLastTurn: 2 },
      opponent: { echoedVoiceCount: 2, echoedVoiceLastTurn: 2 } };
    expect(room.snapshot().battle?.state.effects?.sides).toMatchObject(expected);
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.effects?.sides).toMatchObject(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state.effects?.sides).toMatchObject(expected);
  });

  it("resolves 094 and 097 authoritatively for host and guest across reconnect", () => {
    const present = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "PRESENT",
      functionCode: "094" as const, power: 1, accuracy: 0 };
    const trump = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "TRUMPCARD",
      functionCode: "097" as const, power: 1, accuracy: 0 };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), hp: 300,
        stats: { ...battler("player").stats, maxHp: 300 }, moves: [{ move: present, pp: 20 }] }],
      opponent: [{ ...battler("opponent"), hp: 200,
        stats: { ...battler("opponent").stats, maxHp: 300 }, moves: [{ move: trump, pp: 5 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_347), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("present-ready-a"));
    room.receive("bob", ready("present-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "present-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15, requestId: "trump-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ trace: expect.arrayContaining([
        expect.objectContaining({ type: "rng", purpose: "present" }),
      ]) });
    const expected = room.snapshot().battle?.state;
    expect(expected?.turn).toBe(2);
    expect(expected?.teams.player.members[0]!.moves[0]!.pp).toBe(19);
    expect(expected?.teams.opponent.members[0]!.moves[0]!.pp).toBe(4);
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state).toEqual(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state).toEqual(expected);
  });

  it("resolves 099 for both owners and restores the authoritative speed state", () => {
    const electroBall = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "ELECTROBALL",
      functionCode: "099" as const, power: 1, accuracy: 0 };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), hp: 300,
        stats: { ...battler("player").stats, maxHp: 300, speed: 120 },
        moves: [{ move: electroBall, pp: 20 }] }],
      opponent: [{ ...battler("opponent"), hp: 300,
        stats: { ...battler("opponent").stats, maxHp: 300, speed: 40 },
        moves: [{ move: electroBall, pp: 20 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_348), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("electro-ready-a"));
    room.receive("bob", ready("electro-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "electro-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const result = room.receive("bob", { type: "submitAction", version: 15, requestId: "electro-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(result.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ events: expect.arrayContaining([
        expect.objectContaining({ type: "damageApplied", source: "player" }),
        expect.objectContaining({ type: "damageApplied", source: "opponent" }),
      ]) });
    const expected = room.snapshot().battle?.state;
    expect(expected?.turn).toBe(2);
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state).toEqual(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state).toEqual(expected);
  });

  it("resolves 0A0 critical hits for host and guest across reconnect and restart", () => {
    const frostBreath = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "FROSTBREATH",
      functionCode: "0A0" as const, power: 60, accuracy: 0 };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), hp: 300,
        stats: { ...battler("player").stats, maxHp: 300 }, moves: [{ move: frostBreath, pp: 20 }] }],
      opponent: [{ ...battler("opponent"), hp: 300,
        stats: { ...battler("opponent").stats, maxHp: 300 }, moves: [{ move: frostBreath, pp: 20 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_349), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("critical-ready-a"));
    room.receive("bob", ready("critical-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "critical-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const result = room.receive("bob", { type: "submitAction", version: 15, requestId: "critical-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = result.find((entry) => entry.message.type === "turnResolved")?.message;
    expect(resolved).toMatchObject({ events: expect.arrayContaining([
      expect.objectContaining({ type: "damageApplied", source: "player", critical: true }),
      expect.objectContaining({ type: "damageApplied", source: "opponent", critical: true }),
    ]) });
    const expected = room.snapshot().battle?.state;
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state).toEqual(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state).toEqual(expected);
  });

  it("resolves 09F held-item types for both owners across reconnect and restart", () => {
    const judgment = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "JUDGMENT",
      functionCode: "09F" as const, power: 80, accuracy: 0 };
    const techno = { ...judgment, internalName: "TECHNOBLAST" };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), hp: 300, types: ["GRASS"], heldItem: "FLAMEPLATE" as const,
        stats: { ...battler("player").stats, maxHp: 300 }, moves: [{ move: judgment, pp: 20 }] }],
      opponent: [{ ...battler("opponent"), hp: 300, types: ["GRASS"], heldItem: "BURNDRIVE" as const,
        stats: { ...battler("opponent").stats, maxHp: 300 }, moves: [{ move: techno, pp: 20 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_350), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("item-type-ready-a"));
    room.receive("bob", ready("item-type-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "item-type-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const result = room.receive("bob", { type: "submitAction", version: 15, requestId: "item-type-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(result.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ events: expect.arrayContaining([
        expect.objectContaining({ type: "damageApplied", source: "player", effectiveness: 2 }),
        expect.objectContaining({ type: "damageApplied", source: "opponent", effectiveness: 2 }),
      ]) });
    const expected = room.snapshot().battle?.state;
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state).toEqual(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state).toEqual(expected);
  });

  it("keeps 096 berry consumption authoritative for both owners across restart", () => {
    const naturalGift = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "NATURALGIFT",
      functionCode: "096" as const, power: 1, accuracy: 0 };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), hp: 300, heldItem: "ORANBERRY" as const,
        stats: { ...battler("player").stats, maxHp: 300 }, moves: [{ move: naturalGift, pp: 20 }] }],
      opponent: [{ ...battler("opponent"), hp: 300, heldItem: "LIECHIBERRY" as const,
        stats: { ...battler("opponent").stats, maxHp: 300 }, moves: [{ move: naturalGift, pp: 20 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_351), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("gift-ready-a"));
    room.receive("bob", ready("gift-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "gift-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const result = room.receive("bob", { type: "submitAction", version: 15, requestId: "gift-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    expect(result.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ events: expect.arrayContaining([
        expect.objectContaining({ type: "heldItemConsumed", side: "player", item: "ORANBERRY" }),
        expect.objectContaining({ type: "heldItemConsumed", side: "opponent", item: "LIECHIBERRY" }),
      ]) });
    const expected = room.snapshot().battle?.state;
    expect(expected?.teams.player.members[0]!.heldItem).toBeNull();
    expect(expected?.teams.opponent.members[0]!.heldItem).toBeNull();
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state).toEqual(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state).toEqual(expected);
  });

  it("replicates 0F9 and a carried berry to both owners after reconnect and restart", () => {
    const magicRoom = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "MAGICROOM",
      functionCode: "0F9" as const, power: 0, category: "Status" as const,
      accuracy: 0, targetCode: "20", priority: -7 };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), heldItem: "CHERIBERRY" as const,
        moves: [{ move: magicRoom, pp: 20 }] }],
      opponent: [{ ...battler("opponent"), moves: [{ move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 20 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_352), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("magic-ready-a"));
    room.receive("bob", ready("magic-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "magic-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const result = room.receive("bob", { type: "submitAction", version: 15, requestId: "magic-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(result.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ events: expect.arrayContaining([
        expect.objectContaining({ type: "battleEffectChanged", effect: "magic-room", turns: 5 }),
      ]) });
    const expected = room.snapshot().battle?.state;
    expect(expected?.effects?.magicRoomTurns).toBe(4);
    expect(expected?.teams.player.members[0]!.heldItem).toBe("CHERIBERRY");
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state).toEqual(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state).toEqual(expected);
  });

  it("replicates Trick item ownership to host and guest across reconnect and restart", () => {
    const trick = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "TRICK",
      functionCode: "0F2" as const, power: 0, category: "Status" as const, accuracy: 0 };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), heldItem: "HARDSTONE" as const,
        moves: [{ move: trick, pp: 20 }] }],
      opponent: [{ ...battler("opponent"), heldItem: "LEFTOVERS" as const }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_354), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("trick-ready-a"));
    room.receive("bob", ready("trick-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "trick-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const result = room.receive("bob", { type: "submitAction", version: 15, requestId: "trick-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(result.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ events: expect.arrayContaining([
        expect.objectContaining({ type: "heldItemTransferred", source: "player", target: "opponent",
          item: "HARDSTONE" }),
        expect.objectContaining({ type: "heldItemTransferred", source: "opponent", target: "player",
          item: "LEFTOVERS" }),
      ]) });
    const expected = room.snapshot().battle?.state;
    expect(expected?.teams.player.members[0]).toMatchObject({ heldItem: "LEFTOVERS",
      heldItemTransfer: { originalItem: "HARDSTONE" } });
    expect(expected?.teams.opponent.members[0]).toMatchObject({ heldItem: "HARDSTONE",
      heldItemTransfer: { originalItem: "LEFTOVERS" } });
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state).toEqual(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state).toEqual(expected);
  });

  it("settles Sitrus and Salac for both owners through the authoritative room", () => {
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), hp: 80, heldItem: "SITRUSBERRY" as const,
        stats: { ...battler("player").stats, maxHp: 160 } }],
      opponent: [{ ...battler("opponent"), hp: 40, heldItem: "SALACBERRY" as const,
        stats: { ...battler("opponent").stats, maxHp: 160 } }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_353), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("pinch-ready-a"));
    room.receive("bob", ready("pinch-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "pinch-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    const result = room.receive("bob", { type: "submitAction", version: 15, requestId: "pinch-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(result.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ events: expect.arrayContaining([
        expect.objectContaining({ type: "heldItemConsumed", side: "player", item: "SITRUSBERRY" }),
        expect.objectContaining({ type: "heldItemConsumed", side: "opponent", item: "SALACBERRY" }),
      ]) });
    const expected = room.snapshot().battle?.state;
    expect(expected?.teams.player.members[0]).toMatchObject({ hp: 120, heldItem: null,
      recyclableItem: "SITRUSBERRY" });
    expect(expected?.teams.opponent.members[0]).toMatchObject({ heldItem: null,
      recyclableItem: "SALACBERRY", stages: { speed: 1 } });
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state).toEqual(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state).toEqual(expected);
  });

  it("replicates status and PP berry consumption to host and guest across reconnect and restart", () => {
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), heldItem: "PECHABERRY" as const,
        majorStatus: { kind: "poison" as const, toxicCounter: null } }],
      opponent: [{ ...battler("opponent"), heldItem: "LEPPABERRY" as const,
        moves: [{ ...battler("opponent").moves[0]!, pp: 0 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_354), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("cure-ready-a"));
    room.receive("bob", ready("cure-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "cure-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    const result = room.receive("bob", { type: "submitAction", version: 15, requestId: "cure-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(result.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ events: expect.arrayContaining([
        expect.objectContaining({ type: "heldItemConsumed", side: "player", item: "PECHABERRY" }),
        expect.objectContaining({ type: "heldItemConsumed", side: "opponent", item: "LEPPABERRY" }),
      ]) });
    const expected = room.snapshot().battle?.state;
    expect(expected?.teams.player.members[0]).toMatchObject({ majorStatus: null, heldItem: null });
    expect(expected?.teams.opponent.members[0]).toMatchObject({ heldItem: null, moves: [{ pp: 10 }] });
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state).toEqual(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state).toEqual(expected);
  });

  it("restores flavor confusion and a pending Micle boost for both owners", () => {
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), hp: 40, heldItem: "FIGYBERRY" as const,
        berryFlavorDislike: "spicy" as const }],
      opponent: [{ ...battler("opponent"), hp: 25, heldItem: "MICLEBERRY" as const }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_355), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("flavor-ready-a"));
    room.receive("bob", ready("flavor-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "flavor-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15, requestId: "flavor-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "wait" } });
    expect(resolved.find((entry) => entry.message.type === "turnResolved")?.message)
      .toMatchObject({ events: expect.arrayContaining([
        expect.objectContaining({ type: "heldItemConsumed", side: "player", item: "FIGYBERRY" }),
        expect.objectContaining({ type: "heldItemConsumed", side: "opponent", item: "MICLEBERRY" }),
      ]) });
    const expected = room.snapshot().battle?.state;
    expect(expected?.teams.player.members[0]).toMatchObject({ hp: 52, heldItem: null });
    expect(expected?.teams.player.members[0]!.volatile?.confusionTurns).toBeGreaterThanOrEqual(2);
    expect(expected?.teams.opponent.members[0]).toMatchObject({ heldItem: null,
      volatile: { micleBerry: true } });
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state).toEqual(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state).toEqual(expected);
  });

  it("keeps both owners' retaliation history and results across reconnect and restart", () => {
    const strike = { ...MINIMAL_MOVE_CATALOG.TACKLE, power: 20, accuracy: 0 };
    const counter = { ...strike, internalName: "COUNTER", name: "Riposte",
      functionCode: "071" as const, power: 1, priority: -5 };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), hp: 200, stats: { ...battler("player").stats, maxHp: 200 },
        moves: [{ move: strike, pp: 20 }, { move: counter, pp: 20 }] }],
      opponent: [{ ...battler("opponent"), hp: 200, stats: { ...battler("opponent").stats, maxHp: 200 },
        moves: [{ move: strike, pp: 20 }, { move: counter, pp: 20 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_341), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("counter-ready-a"));
    room.receive("bob", ready("counter-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "counter-strike-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "counter-return-b",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 1 } });
    expect(room.snapshot().battle?.state.teams.player.members[0]!.hp).toBeLessThan(200);
    room.receive("alice", { type: "submitAction", version: 15, requestId: "counter-return-a",
      battleId: "ABC234-1", turn: 2, action: { kind: "move", moveIndex: 1 } });
    room.receive("bob", { type: "submitAction", version: 15, requestId: "counter-strike-b",
      battleId: "ABC234-1", turn: 2, action: { kind: "move", moveIndex: 0 } });
    const expected = { player: { members: [{ volatile: { retaliation: {
      turn: 2, attackers: ["opponent"], physical: { attackerId: "opponent" } } } }] },
    opponent: { members: [{ volatile: { retaliation: {
      turn: 2, attackers: ["player"], physical: { attackerId: "player" } } } }] } };
    expect(room.snapshot().battle?.state.teams).toMatchObject(expected);
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams).toMatchObject(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state.teams).toMatchObject(expected);
  });

  it("lets the guest use 081 from authoritative damage history and restores that history", () => {
    const strike = { ...MINIMAL_MOVE_CATALOG.TACKLE, power: 20, accuracy: 0 };
    const revenge = { ...strike, internalName: "REVENGE", name: "Desquite",
      functionCode: "081" as const, priority: -5 };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), hp: 200,
        stats: { ...battler("player").stats, maxHp: 200 }, moves: [{ move: strike, pp: 20 }] }],
      opponent: [{ ...battler("opponent"), hp: 200,
        stats: { ...battler("opponent").stats, maxHp: 200 }, moves: [{ move: revenge, pp: 20 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_343), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("revenge-ready-a"));
    room.receive("bob", ready("revenge-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "revenge-strike-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "revenge-return-b", battleId: "ABC234-1", turn: 1,
      action: { kind: "move", moveIndex: 0 } });
    const message = resolved.find((entry) => entry.message.type === "turnResolved")?.message;
    const hits = message?.type === "turnResolved"
      ? message.events.filter((event) => event.type === "damageApplied") : [];
    expect(hits).toHaveLength(2);
    expect(hits[1]?.type === "damageApplied" ? hits[1].amount : 0)
      .toBeGreaterThan(hits[0]?.type === "damageApplied" ? hits[0].amount : 0);
    const expected = { opponent: { members: [{ volatile: { retaliation: {
      turn: 1, attackers: ["player"] } } }] } };
    expect(room.snapshot().battle?.state.teams).toMatchObject(expected);
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams).toMatchObject(expected);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state.teams).toMatchObject(expected);
  });

  it("resolves reciprocal Fusion from host and guest and restores both HP snapshots", () => {
    const bolt = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "FUSIONBOLT", name: "Rayo Fusión",
      functionCode: "079" as const, category: "Special" as const, power: 30, accuracy: 0 };
    const flare = { ...bolt, internalName: "FUSIONFLARE", name: "Llama Fusión",
      functionCode: "07A" as const };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), moves: [{ move: bolt, pp: 10 }] }],
      opponent: [{ ...battler("opponent"), moves: [{ move: flare, pp: 10 }] }],
    });
    const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_342), world);
    room.connect("alice");
    room.connect("bob");
    room.receive("alice", ready("fusion-ready-a"));
    room.receive("bob", ready("fusion-ready-b"));
    room.receive("alice", { type: "submitAction", version: 15, requestId: "fusion-bolt-a",
      battleId: "ABC234-1", turn: 1, action: { kind: "move", moveIndex: 0 } });
    const resolved = room.receive("bob", { type: "submitAction", version: 15,
      requestId: "fusion-flare-b", battleId: "ABC234-1", turn: 1,
      action: { kind: "move", moveIndex: 0 } });
    const message = resolved.find((entry) => entry.message.type === "turnResolved")?.message;
    const damage = message?.type === "turnResolved"
      ? message.events.filter((event) => event.type === "damageApplied") : [];
    expect(damage).toHaveLength(2);
    expect(damage[1]?.type === "damageApplied" ? damage[1].amount : 0)
      .toBeGreaterThan(damage[0]?.type === "damageApplied" ? damage[0].amount * 1.5 : 0);
    const expected = { teams: { player: { members: [{ hp: expect.any(Number) }] },
      opponent: { members: [{ hp: expect.any(Number) }] } },
    effects: { fusionBoltTurn: null, fusionFlareTurn: null } };
    expect(room.snapshot().battle?.state).toMatchObject(expected);
    const hp = room.snapshot().battle?.state.teams.player.members[0]!.hp;
    room.disconnect("bob");
    expect(room.connect("bob").snapshot.battle?.state.teams.player.members[0]!.hp).toBe(hp);
    const persisted = room.exportState();
    const restarted = new AuthoritativeBattleRoom("ABC234", initial,
      new SeededRandom(persisted.rngState), world, persisted);
    expect(restarted.connect("alice").snapshot.battle?.state).toMatchObject(expected);
  });

  it("restores a two-turn airborne charge for either owner and publishes its landing", () => {
    for (const owner of ["alice", "bob"] as const) {
      const fly = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "FLY",
        functionCode: "0C9" as const, power: 60, accuracy: 0 };
      const charged = (side: BattleSide) => ({ ...battler(side), hp: 300,
        stats: { ...battler(side).stats, maxHp: 300 },
        moves: [{ move: fly, pp: 10 }] });
      const passive = (side: BattleSide) => ({ ...battler(side), hp: 300,
        stats: { ...battler(side).stats, maxHp: 300 } });
      const initial = () => createTeamBattleState({
        player: [owner === "alice" ? charged("player") : passive("player")],
        opponent: [owner === "bob" ? charged("opponent") : passive("opponent")],
      });
      const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_360), world);
      room.connect("alice"); room.connect("bob");
      room.receive("alice", ready(`fly-ready-a-${owner}`));
      room.receive("bob", ready(`fly-ready-b-${owner}`));
      for (const id of ["alice", "bob"] as const) {
        room.receive(id, { type: "submitAction", version: 15,
          requestId: `fly-charge-${owner}-${id}`, battleId: "ABC234-1", turn: 1,
          action: id === owner ? { kind: "move", moveIndex: 0 } : { kind: "wait" } });
      }
      const side = owner === "alice" ? "player" : "opponent";
      const target = side === "player" ? "opponent" : "player";
      expect(room.snapshot().battle?.state.teams[side].members[0]?.volatile?.chargingMove).toBe("FLY");
      const persisted = room.exportState();
      const restored = new AuthoritativeBattleRoom("ABC234", initial,
        new SeededRandom(persisted.rngState), world, persisted);
      restored.connect("alice"); restored.connect("bob");
      restored.receive("alice", { type: "submitAction", version: 15,
        requestId: `fly-land-${owner}-alice`, battleId: "ABC234-1", turn: 2,
        action: { kind: "wait" } });
      restored.receive("bob", { type: "submitAction", version: 15,
        requestId: `fly-land-${owner}-bob`, battleId: "ABC234-1", turn: 2,
        action: { kind: "wait" } });
      expect(restored.snapshot().battle?.state.teams[target].members[0]?.hp).toBeLessThan(300);
      expect(restored.connect(owner).snapshot.battle?.state.teams[side].members[0]?.volatile?.chargingMove)
        .toBeNull();
    }
  });

  it("restores Lock-On for either owner and resolves the guaranteed follow-up", () => {
    for (const owner of ["alice", "bob"] as const) {
      const lockOn = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "LOCKON",
        functionCode: "0A6" as const, category: "Status" as const, power: 0,
        accuracy: 0, targetCode: "00" };
      const followUp = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "FOLLOWUP",
        accuracy: 1, power: 50 };
      const initial = () => createTeamBattleState({
        player: [{ ...battler("player"), hp: 200,
          stats: { ...battler("player").stats, maxHp: 200 },
          moves: owner === "alice" ? [{ move: lockOn, pp: 10 }, { move: followUp, pp: 10 }]
            : [{ move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 10 }] }],
        opponent: [{ ...battler("opponent"), hp: 200,
          stats: { ...battler("opponent").stats, maxHp: 200 },
          moves: owner === "bob" ? [{ move: lockOn, pp: 10 }, { move: followUp, pp: 10 }]
            : [{ move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 10 }] }],
      });
      const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(24_361), world);
      room.connect("alice"); room.connect("bob");
      room.receive("alice", ready(`lock-ready-a-${owner}`));
      room.receive("bob", ready(`lock-ready-b-${owner}`));
      for (const id of ["alice", "bob"] as const) room.receive(id, {
        type: "submitAction", version: 15, requestId: `lock-${owner}-${id}`,
        battleId: "ABC234-1", turn: 1,
        action: id === owner ? { kind: "move", moveIndex: 0 } : { kind: "wait" },
      });
      const target = owner === "alice" ? "opponent" : "player";
      expect(room.snapshot().battle?.state.teams[target].members[0]?.volatile?.lockOnTurns).toBe(1);
      const persisted = room.exportState();
      const restored = new AuthoritativeBattleRoom("ABC234", initial,
        new SeededRandom(persisted.rngState), world, persisted);
      restored.connect("alice"); restored.connect("bob");
      for (const id of ["alice", "bob"] as const) restored.receive(id, {
        type: "submitAction", version: 15, requestId: `follow-${owner}-${id}`,
        battleId: "ABC234-1", turn: 2,
        action: id === owner ? { kind: "move", moveIndex: 1 } : { kind: "wait" },
      });
      expect(restored.snapshot().battle?.state.teams[target].members[0]?.hp).toBeLessThan(200);
      expect(restored.connect(owner).snapshot.battle?.state.teams[target].members[0]?.volatile?.lockOnTurns)
        .toBe(0);
    }
  });
  it("restores the global Copycat source for either Coop owner after room restart", () => {
    const copycat = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "COPYCAT", name: "Copion",
      functionCode: "0AF" as const, category: "Status" as const, power: 0, accuracy: 0 };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), moves: [{ move: copycat, pp: 10 },
        { move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 10 }] }],
      opponent: [{ ...battler("opponent"), moves: [{ move: copycat, pp: 10 },
        { move: MINIMAL_MOVE_CATALOG.TACKLE, pp: 10 }] }],
    });
    for (const owner of ["alice", "bob"] as const) {
      const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(44), world);
      room.connect("alice"); room.connect("bob");
      room.receive("alice", ready(`copycat-ready-a-${owner}`));
      room.receive("bob", ready(`copycat-ready-b-${owner}`));
      for (const id of ["alice", "bob"] as const) room.receive(id, {
        type: "submitAction", version: 15, requestId: `copycat-first-${owner}-${id}`,
        battleId: "ABC234-1", turn: 1,
        action: id === owner ? { kind: "wait" } : { kind: "move", moveIndex: 1 },
      });
      expect(room.snapshot().battle?.state.effects?.lastMoveUsed?.internalName).toBe("TACKLE");
      room.disconnect(owner);
      expect(room.connect(owner).snapshot.battle?.state.effects?.lastMoveUsed?.internalName).toBe("TACKLE");
      const persisted = room.exportState();
      const restored = new AuthoritativeBattleRoom("ABC234", initial,
        new SeededRandom(persisted.rngState), world, persisted);
      restored.connect("alice"); restored.connect("bob");
      for (const id of ["alice", "bob"] as const) restored.receive(id, {
        type: "submitAction", version: 15, requestId: `copycat-follow-${owner}-${id}`,
        battleId: "ABC234-1", turn: 2,
        action: id === owner ? { kind: "move", moveIndex: 0 } : { kind: "wait" },
      });
      const target = owner === "alice" ? "opponent" : "player";
      expect(restored.snapshot().battle?.state.teams[target].members[0]?.hp).toBeLessThan(100);
    }
  });
  it("replicates party-wide status curing for either Coop owner after reconnect and room restart", () => {
    const bell = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "HEALBELL", name: "Cascabel Cura",
      functionCode: "019" as const, category: "Status" as const, power: 0, accuracy: 0, targetCode: "40" };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), majorStatus: { kind: "poison" as const, toxicCounter: null },
        moves: [{ move: bell, pp: 10 }] },
      { ...battler("player"), id: "player-reserve",
        majorStatus: { kind: "paralysis" as const } }],
      opponent: [{ ...battler("opponent"), majorStatus: { kind: "poison" as const, toxicCounter: null },
        moves: [{ move: bell, pp: 10 }] },
      { ...battler("opponent"), id: "opponent-reserve",
        majorStatus: { kind: "paralysis" as const } }],
    });
    for (const owner of ["alice", "bob"] as const) {
      const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(46), world);
      room.connect("alice"); room.connect("bob");
      room.receive("alice", ready(`bell-ready-a-${owner}`));
      room.receive("bob", ready(`bell-ready-b-${owner}`));
      for (const id of ["alice", "bob"] as const) room.receive(id, {
        type: "submitAction", version: 15, requestId: `bell-${owner}-${id}`,
        battleId: "ABC234-1", turn: 1,
        action: id === owner ? { kind: "move", moveIndex: 0 } : { kind: "wait" },
      });
      const side = owner === "alice" ? "player" : "opponent";
      expect(room.snapshot().battle?.state.teams[side].members.map((member) => member.majorStatus))
        .toEqual([null, null]);
      room.disconnect(owner);
      expect(room.connect(owner).snapshot.battle?.state.teams[side].members[1]?.majorStatus).toBeNull();
      const persisted = room.exportState();
      const restarted = new AuthoritativeBattleRoom("ABC234", initial,
        new SeededRandom(persisted.rngState), world, persisted);
      expect(restarted.connect(owner).snapshot.battle?.state.teams[side].members[1]?.majorStatus).toBeNull();
    }
  });
  it("restores Safeguard for either Coop owner after reconnect and room restart", () => {
    const safeguard = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "SAFEGUARD", name: "Velo Sagrado",
      functionCode: "01A" as const, category: "Status" as const, power: 0, accuracy: 0, targetCode: "40" };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), moves: [{ move: safeguard, pp: 10 }] }],
      opponent: [{ ...battler("opponent"), moves: [{ move: safeguard, pp: 10 }] }],
    });
    for (const owner of ["alice", "bob"] as const) {
      const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(47), world);
      room.connect("alice"); room.connect("bob");
      room.receive("alice", ready(`guard-ready-a-${owner}`));
      room.receive("bob", ready(`guard-ready-b-${owner}`));
      for (const id of ["alice", "bob"] as const) room.receive(id, {
        type: "submitAction", version: 15, requestId: `guard-${owner}-${id}`,
        battleId: "ABC234-1", turn: 1,
        action: id === owner ? { kind: "move", moveIndex: 0 } : { kind: "wait" },
      });
      const side = owner === "alice" ? "player" : "opponent";
      expect(room.snapshot().battle?.state.effects?.sides[side].safeguardTurns).toBe(4);
      room.disconnect(owner);
      expect(room.connect(owner).snapshot.battle?.state.effects?.sides[side].safeguardTurns).toBe(4);
      const persisted = room.exportState();
      const restarted = new AuthoritativeBattleRoom("ABC234", initial,
        new SeededRandom(persisted.rngState), world, persisted);
      expect(restarted.connect(owner).snapshot.battle?.state.effects?.sides[side].safeguardTurns).toBe(4);
    }
  });
  it("restores entry hazards and applies them after either Coop owner sets them", () => {
    const spikes = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "SPIKES", name: "Picots",
      functionCode: "103" as const, category: "Status" as const, power: 0, accuracy: 0, targetCode: "80" };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), moves: [{ move: spikes, pp: 10 }] },
        { ...battler("player"), id: "player-reserve" }],
      opponent: [{ ...battler("opponent"), moves: [{ move: spikes, pp: 10 }] },
        { ...battler("opponent"), id: "opponent-reserve" }],
    });
    for (const owner of ["alice", "bob"] as const) {
      const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(48), world);
      room.connect("alice"); room.connect("bob");
      room.receive("alice", ready(`spikes-ready-a-${owner}`));
      room.receive("bob", ready(`spikes-ready-b-${owner}`));
      for (const id of ["alice", "bob"] as const) room.receive(id, {
        type: "submitAction", version: 15, requestId: `spikes-set-${owner}-${id}`,
        battleId: "ABC234-1", turn: 1,
        action: id === owner ? { kind: "move", moveIndex: 0 } : { kind: "wait" },
      });
      const target = owner === "alice" ? "opponent" : "player";
      expect(room.snapshot().battle?.state.effects?.sides[target].spikesLayers).toBe(1);
      room.disconnect(owner);
      expect(room.connect(owner).snapshot.battle?.state.effects?.sides[target].spikesLayers).toBe(1);
      const persisted = room.exportState();
      const restarted = new AuthoritativeBattleRoom("ABC234", initial,
        new SeededRandom(persisted.rngState), world, persisted);
      restarted.connect("alice"); restarted.connect("bob");
      for (const id of ["alice", "bob"] as const) restarted.receive(id, {
        type: "submitAction", version: 15, requestId: `spikes-enter-${owner}-${id}`,
        battleId: "ABC234-1", turn: 2,
        action: id === owner ? { kind: "wait" } : { kind: "switch", teamIndex: 1 },
      });
      expect(restarted.connect(owner).snapshot.battle?.state.teams[target].members[1]?.hp).toBeLessThan(100);
    }
  });
  it("restores each owner's terrain and Sticky Web in the authoritative Coop snapshot", () => {
    const terrain = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "ELECTRICTERRAIN",
      functionCode: "154" as const, category: "Status" as const, power: 0, accuracy: 0,
      targetCode: "01" };
    const web = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "STICKYWEB",
      functionCode: "153" as const, category: "Status" as const, power: 0, accuracy: 0,
      targetCode: "80", flags: "c" };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), moves: [{ move: terrain, pp: 10 }, { move: web, pp: 10 }] },
        { ...battler("player"), id: "player-reserve" }],
      opponent: [{ ...battler("opponent"), moves: [{ move: terrain, pp: 10 }, { move: web, pp: 10 }] },
        { ...battler("opponent"), id: "opponent-reserve" }],
    });
    for (const owner of ["alice", "bob"] as const) {
      const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(49), world);
      room.connect("alice"); room.connect("bob");
      room.receive("alice", ready(`terrain-ready-a-${owner}`));
      room.receive("bob", ready(`terrain-ready-b-${owner}`));
      for (const id of ["alice", "bob"] as const) room.receive(id, {
        type: "submitAction", version: 15, requestId: `terrain-set-${owner}-${id}`,
        battleId: "ABC234-1", turn: 1,
        action: id === owner ? { kind: "move", moveIndex: 0 } : { kind: "wait" },
      });
      expect(room.snapshot().battle?.state.effects?.terrain).toBe("electric");
      for (const id of ["alice", "bob"] as const) room.receive(id, {
        type: "submitAction", version: 15, requestId: `web-set-${owner}-${id}`,
        battleId: "ABC234-1", turn: 2,
        action: id === owner ? { kind: "move", moveIndex: 1 } : { kind: "wait" },
      });
      const target = owner === "alice" ? "opponent" : "player";
      expect(room.snapshot().battle?.state.effects?.sides[target].stickyWeb).toBe(true);
      room.disconnect(owner);
      expect(room.connect(owner).snapshot.battle?.state.effects?.terrain).toBe("electric");
      const persisted = room.exportState();
      const restarted = new AuthoritativeBattleRoom("ABC234", initial,
        new SeededRandom(persisted.rngState), world, persisted);
      expect(restarted.connect(owner).snapshot.battle?.state.effects?.sides[target].stickyWeb).toBe(true);
    }
  });
  it("restores Magic Powder type changes for host and guest after room restart", () => {
    const powder = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "MAGICPOWDER",
      functionCode: "904" as const, category: "Status" as const, power: 0,
      accuracy: 100, type: "PSYCHIC", targetCode: "00", flags: "bce" };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), moves: [{ move: powder, pp: 10 }] }],
      opponent: [{ ...battler("opponent"), moves: [{ move: powder, pp: 10 }] }],
    });
    for (const owner of ["alice", "bob"] as const) {
      const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(50), world);
      room.connect("alice"); room.connect("bob");
      room.receive("alice", ready(`powder-ready-a-${owner}`));
      room.receive("bob", ready(`powder-ready-b-${owner}`));
      for (const id of ["alice", "bob"] as const) room.receive(id, {
        type: "submitAction", version: 15, requestId: `powder-${owner}-${id}`,
        battleId: "ABC234-1", turn: 1,
        action: id === owner ? { kind: "move", moveIndex: 0 } : { kind: "wait" },
      });
      const target = owner === "alice" ? "opponent" : "player";
      expect(room.snapshot().battle?.state.teams[target].members[0]?.types).toEqual(["PSYCHIC"]);
      room.disconnect(owner);
      expect(room.connect(owner).snapshot.battle?.state.teams[target].members[0]?.types).toEqual(["PSYCHIC"]);
      const persisted = room.exportState();
      const restarted = new AuthoritativeBattleRoom("ABC234", initial,
        new SeededRandom(persisted.rngState), world, persisted);
      expect(restarted.connect(owner).snapshot.battle?.state.teams[target].members[0]?.types).toEqual(["PSYCHIC"]);
    }
  });
  it("restores Strength Sap healing and Attack drops for either Coop owner", () => {
    const sap = { ...MINIMAL_MOVE_CATALOG.TACKLE, internalName: "STRENGTHSAP",
      functionCode: "902" as const, category: "Status" as const, power: 0,
      accuracy: 100, type: "GRASS", targetCode: "00", flags: "bc" };
    const initial = () => createTeamBattleState({
      player: [{ ...battler("player"), hp: 50, moves: [{ move: sap, pp: 10 }] }],
      opponent: [{ ...battler("opponent"), hp: 50, moves: [{ move: sap, pp: 10 }] }],
    });
    for (const owner of ["alice", "bob"] as const) {
      const room = new AuthoritativeBattleRoom("ABC234", initial, new SeededRandom(51), world);
      room.connect("alice"); room.connect("bob");
      room.receive("alice", ready(`sap-ready-a-${owner}`));
      room.receive("bob", ready(`sap-ready-b-${owner}`));
      for (const id of ["alice", "bob"] as const) room.receive(id, {
        type: "submitAction", version: 15, requestId: `sap-${owner}-${id}`,
        battleId: "ABC234-1", turn: 1,
        action: id === owner ? { kind: "move", moveIndex: 0 } : { kind: "wait" },
      });
      const own = owner === "alice" ? "player" : "opponent";
      const target = owner === "alice" ? "opponent" : "player";
      expect(room.snapshot().battle?.state.teams[own].members[0]?.hp).toBeGreaterThan(50);
      expect(room.snapshot().battle?.state.teams[target].members[0]?.stages.attack).toBe(-1);
      room.disconnect(owner);
      expect(room.connect(owner).snapshot.battle?.state.teams[target].members[0]?.stages.attack).toBe(-1);
      const persisted = room.exportState();
      const restarted = new AuthoritativeBattleRoom("ABC234", initial,
        new SeededRandom(persisted.rngState), world, persisted);
      expect(restarted.connect(owner).snapshot.battle?.state.teams[target].members[0]?.stages.attack).toBe(-1);
    }
  });
});
