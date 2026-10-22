export type BattleSide = "player" | "opponent";
export type MoveCategory = "Physical" | "Special" | "Status";
export type BattleStatus = "active" | "finished";
export type BattleStat =
  | "attack"
  | "defense"
  | "specialAttack"
  | "specialDefense"
  | "speed"
  | "accuracy"
  | "evasion";

export interface BattleMove {
  readonly id: number;
  readonly internalName: string;
  readonly name: string;
  readonly functionCode: "000" | "001" | "003" | "004" | "005" | "006" | "007" | "008" | "009" | "00A" | "00C"
    | "00F" | "010" | "012" | "013" | "016" | "017"
    | "01C" | "01D" | "01E" | "01F" | "020" | "021" | "022" | "023" | "024" | "025" | "026" | "027" | "028" | "029" | "030" | "031"
    | "02A" | "02B" | "02C" | "02D" | "02E" | "02F" | "032" | "033" | "034" | "035" | "036" | "037" | "038" | "039" | "03A" | "03B" | "03C" | "03D" | "03E" | "03F"
    | "040" | "041" | "042" | "043" | "044" | "045" | "046" | "047" | "048" | "049" | "04A" | "04B" | "04C" | "04D" | "04E" | "04F" | "050" | "051" | "056" | "05B"
    | "064" | "069" | "06D" | "06F" | "077" | "07B" | "082" | "083" | "086" | "088" | "08D" | "091" | "093" | "095" | "098" | "09A" | "09B" | "09C" | "09D" | "09E" | "0A1" | "0A2" | "0A3" | "0A5" | "0A7"
    | "0AA" | "0AD" | "0B3" | "0B9" | "0BA" | "0BC" | "0BD" | "0BE" | "0C0" | "0CF" | "0D1" | "0D3" | "0D5" | "0D8" | "0DC" | "0DD" | "0E0" | "0E8" | "0F0" | "0F1" | "0F4" | "0F8"
    | "0FA" | "0FB" | "0FC" | "0FD" | "0FE" | "10B" | "10D" | "10E" | "110" | "116" | "159" | "906";
  readonly power: number;
  readonly type: string;
  readonly category: MoveCategory;
  readonly accuracy: number;
  readonly pp: number;
  readonly priority: number;
  readonly effectChance: number;
  readonly flags?: string;
  /** Pokemon Z PBTargets hexadecimal code, kept so double battles can resolve real targets. */
  readonly targetCode?: string;
}

export const IMPLEMENTED_BATTLE_ABILITIES = ["ACOMETIDA", "ADAPTABILITY", "AFTERMATH", "ANALYTIC", "ANGERPOINT", "BATTLEARMOR", "BERSERK", "BIGPECKS", "BLAZE", "BRUTALIDAD", "CHEEKPOUCH", "COLORCHANGE", "CORAZAIRA", "CORTANTE", "CUERPOHORNEADO",
  "COMPETITIVE", "COMPOUNDEYES", "CONTRAGUARDIA", "CUTECHARM", "DEFIANT", "DOWNLOAD", "DRYSKIN", "EFFECTSPORE", "FILTER", "FLAMEBODY", "FLASHFIRE", "FLORACION", "FOREWARN", "FRISK", "GOOEY",
  "DAMP", "DEFEATIST", "DINAMO", "FLUFFY", "FURCOAT", "GOODASGOLD", "GRIMNEIGH", "GRANPESADILLA", "GUTS", "HEALER", "HEAVYMETAL", "HUGEPOWER", "HUSTLE", "HYPERCUTTER", "ICESCALES", "IMMUNITY", "INNARDSOUT", "INNERFOCUS", "INSOMNIA", "INTIMIDATE", "IRONBARBS", "IRONFIST", "JUSTIFIED", "KEENEYE", "LIGHTMETAL", "LIQUIDOOZE",
  "ARENATRAP", "CABEZAHIELO", "DESPIERTALLAMA", "DISGUISE", "EMERGENCYEXIT", "FLOWERGIFT", "FORECAST", "FORMAILUSORIA", "HONEYGATHER", "ILLUSION", "LEVITATE", "LIGHTNINGROD", "LIMBER", "MAGICGUARD", "MAGMAARMOR", "MAGNETPULL", "MARVELSCALE", "MOODY", "MOTORDRIVE", "MULTISCALE", "MULTITYPE", "NEUTRALIZINGGAS", "NOGUARD", "OWNTEMPO", "PARENTALBOND", "PODERSABIO",
  "MIRRORARMOR", "MOXIE", "MUMMY", "NATURALCURE", "OVERGROW", "PICKPOCKET", "POISONPOINT", "POISONPUPPETEER", "POISONTOUCH", "PUREPOWER", "QUICKFEET", "RATTLED", "RECKLESS", "REGENERATOR", "RELAMPAGUEO", "RIVALRY", "ROCKHEAD", "ROUGHSKIN", "SOBRECARGA",
  "SERENEGRACE", "SHADOWTAG", "SHEDSKIN", "SHELLARMOR", "SHIELDDUST", "SIMPLE", "SNIPER", "STAMINA", "STANCECHANGE", "STEAMENGINE", "SUCTIONCUPS", "TRUANT", "ZENMODE", "CLEARBODY", "WHITESMOKE",
  "SAPSIPPER", "SHEERFORCE", "SKILLLINK", "SOLIDROCK", "STATIC", "STEADFAST", "STORMDRAIN", "STRONGJAW", "SUPERLUCK", "SWARM", "STURDY", "SYNCHRONIZE", "TECHNICIAN",
  "TERMOCONVERSION", "THICKFAT", "TINTEDLENS", "TORRENT", "TOQUEMAGICO", "TOUGHCLAWS", "TRACE", "ANTICIPATION", "VITALSPIRIT", "VOLTABSORB", "WATERABSORB", "WATERBUBBLE", "WATERCOMPACTION", "WATERVEIL", "WEAKARMOR", "WINDPOWER", "WINDRIDER", "WONDERGUARD", "PLUS", "MINUS", "FRIENDGUARD", "TELEPATHY", "CAMORRISTA", "REALEZA", "MERCILESS", "TANGLEDFEET", "BULLETPROOF", "PUNKROCK", "VOZVALQUIRIA", "PENETRANTE",
  "AERILATE", "AIRLOCK", "ALBINISMO", "ALQUIMIAVIL", "AURABREAK", "AURADORADA", "BADDREAMS", "CANASTO", "CAPATOXICA", "CHLOROPHYLL", "CLOUDNINE", "COLEOPTERO", "CONTRARY", "CORROSION", "CURSEDBODY", "DARKAURA", "DELTASTREAM", "DESOLATELAND", "DRAGONSMAW", "DRIZZLE", "DROUGHT", "EARLYBIRD", "EARTHEATER", "ELECTRICSURGE", "ESPANTO", "FAIRYAURA", "FLAREBOOST", "GALEWINGS", "GLUTTONY", "GRASSYSURGE", "HARVEST", "HEATPROOF", "HYDRATION", "ICEBODY", "ILLUMINATE", "IMPOSTER", "INFLAMABLE", "INFILTRATOR", "KLUTZ", "LEAFGUARD", "LIQUIDVOICE", "MAGICBOUNCE", "MEGALAUNCHER", "MISTYSURGE", "MOLDBREAKER", "NEUROFORCE", "NORMALIZE", "OBLIVIOUS", "OLORPORCINO", "OVERCOAT", "PEDANTE", "PICKUP", "PIELELECTRICA", "PIELHELADA", "PIELHERBACEA", "PIELMALDITA", "PIXILATE", "PODERGELIDO", "POISONHEAL", "PRANKSTER", "PRESENCIARARA", "PRESSURE", "PRIMORDIALSEA", "PROTEAN", "PSYCHICSURGE", "PURIFYINGSALT", "QUEENLYMAJESTY", "RAINDISH", "RUNAWAY", "SANDFORCE", "SANDRUSH", "SANDSTREAM", "SANDVEIL", "SCRAPPY", "SILVANO", "SLOWSTART", "SLUSHRUSH", "SNOWCLOAK", "SNOWWARNING", "SOLARPOWER", "SOUNDPROOF", "SPEEDBOOST", "STALL", "STEELWORKER", "STENCH", "STICKYHOLD", "SURGESURFER", "SWIFTSWIM", "TERAVOLT", "TINTINEO", "TOXICBOOST", "TRANSPORTARROCA", "TRIAGE", "TURBOBLAZE", "UNAWARE", "UNBURDEN", "UNNERVE", "VICTORYSTAR", "WONDERSKIN"] as const;
export type ImplementedBattleAbility = typeof IMPLEMENTED_BATTLE_ABILITIES[number];
/** Source ability identity. Only ImplementedBattleAbility values currently apply an automatic battle effect. */
export type BattleAbility = ImplementedBattleAbility | (string & {});
export const SUPPORTED_HELD_ITEMS = ["ASSAULTVEST", "BLACKSLUDGE", "EXPERTBELT", "FOCUSSASH",
  "LEFTOVERS", "LIFEORB", "MUSCLEBAND", "ROCKYHELMET", "SCOPELENS", "WIDELENS", "WISEGLASSES",
  "BUGGEM", "CASCOPROTECTOR", "COVERTCLOAK", "EVIOLITE", "FIGHTINGGEM", "HONEY", "LIECHIBERRY", "ORANBERRY", "PAYAPABERRY", "SAFETYGOGGLES", "SHEDSHELL",
  "FISTPLATE", "SKYPLATE", "TOXICPLATE", "EARTHPLATE", "STONEPLATE", "INSECTPLATE", "SPOOKYPLATE", "IRONPLATE", "FLAMEPLATE", "SPLASHPLATE", "MEADOWPLATE", "ZAPPLATE", "MINDPLATE", "ICICLEPLATE", "DRACOPLATE", "DREADPLATE", "PIXIEPLATE", "TABLANEUTRA"] as const;
export type HeldItem = typeof SUPPORTED_HELD_ITEMS[number];

export function isHeldItemSupported(value: string): value is HeldItem {
  return (SUPPORTED_HELD_ITEMS as readonly string[]).includes(value);
}

export interface MoveSlot {
  readonly move: BattleMove;
  readonly pp: number;
}

export interface BattleStats {
  readonly maxHp: number;
  readonly attack: number;
  readonly defense: number;
  readonly specialAttack: number;
  readonly specialDefense: number;
  readonly speed: number;
}

export type StatStages = Readonly<Record<BattleStat, number>>;

export type MajorStatusState =
  | { readonly kind: "sleep"; readonly turnsRemaining: number }
  | { readonly kind: "poison"; readonly toxicCounter: number | null }
  | { readonly kind: "burn" }
  | { readonly kind: "paralysis" }
  | { readonly kind: "frozen" }
  | { readonly kind: "caduco" }
  | { readonly kind: "hemorrhage" };

export interface BattlerState {
  readonly id: string;
  readonly species: string;
  readonly name: string;
  readonly level: number;
  readonly types: readonly string[];
  readonly stats: BattleStats;
  readonly stages: StatStages;
  readonly hp: number;
  /** Combat-relevant friendship value; null is preserved for legacy saves. */
  readonly happiness?: number | null;
  /** Public species fact needed by Eviolite; it contains no private evolution state. */
  readonly canEvolve?: boolean;
  readonly majorStatus: MajorStatusState | null;
  /** Temporary battle-only effects. They are authoritative and cleared on switch. */
  readonly volatile?: {
    readonly confusionTurns: number;
    readonly flinched: boolean;
    readonly focusEnergy: number;
    readonly identified: boolean;
    readonly disabledMove: string | null;
    readonly disableTurns: number;
    readonly encoreMove: string | null;
    readonly encoreTurns: number;
    readonly bindingMove: string | null;
    readonly bindingTurns: number;
    readonly cursed: boolean;
    readonly lastMoveUsed: string | null;
    /** Added in the Fortress vertical lot; omitted legacy snapshots use the neutral value. */
    readonly activeTurns?: number;
    /** True only for a battler switched in after the round began; cleared at end of turn. */
    readonly enteredMidTurn?: boolean;
    readonly protected?: boolean;
    readonly endured?: boolean;
    /** Source ProtectRate: 1 initially, doubled after each consecutive success. */
    readonly protectRate?: number;
    readonly tauntTurns?: number;
    readonly rage?: boolean;
    /** Fire boost armed by Flash Fire until this battler leaves combat. */
    readonly flashFire?: boolean;
    /** Entry hooks run once per stay on the field. Trace also keeps its source identity here. */
    readonly entryAbilityResolved?: boolean;
    readonly traceOriginalAbility?: BattleAbility | null;
    /** Ability restored after a temporary source ability replacement such as Mummy or Worry Seed. */
    readonly originalAbility?: BattleAbility | null;
    readonly abilityReplacementActive?: boolean;
    /** Types restored when a temporary Protean/Color Change user leaves the field. */
    readonly originalTypes?: readonly string[] | null;
    /** Source side for Leech Seed; legacy snapshots omit it. */
    readonly leechSeededBy?: BattleSide | null;
    /** Active slot occupied by the Leech Seed user; relevant in double battles. */
    readonly leechSeededBySlot?: number | null;
    /** Source Charge counter (2 when used, then decremented at each end of turn). */
    readonly chargeTurns?: number;
    readonly yawnTurns?: number;
    /** Captures the opposing Mold Breaker context until Yawn resolves. */
    readonly yawnBypassesAbility?: boolean;
    readonly infatuated?: boolean;
    readonly furyCutterCount?: number;
    readonly rolloutTurns?: number;
    readonly uproarTurns?: number;
    readonly embargoTurns?: number;
    /** Armed after this battler loses its held item; cleared when it leaves the field. */
    readonly unburdened?: boolean;
    /** Last consumable item available to an active Pickup user. */
    readonly pickupItem?: HeldItem | null;
    readonly pickupUse?: number;
    /** Truant alternates normally acting and loafing turns; cleared on switch. */
    readonly truantLoafing?: boolean;
    readonly choiceLockedMove?: string | null;
    readonly originalForm?: number | null;
    readonly originalStats?: BattleStats | null;
    /** Autotomize's cumulative weight change in hectograms; cleared on switch. */
    readonly weightChange?: number;
  };
  readonly ability: BattleAbility | null;
  readonly heldItem: HeldItem | null;
  /** Last normally consumed item. Harvest/Recycle state follows the Pokemon through switches. */
  readonly recyclableItem?: HeldItem | null;
  /** Battle-only provenance used to restore temporary thefts after Trainer/PvP battles. */
  readonly heldItemTransfer?: { readonly originalItem: HeldItem | null };
  readonly transformOriginal?: {
    readonly species: string;
    readonly name: string;
    readonly types: readonly string[];
    readonly stats: BattleStats;
    readonly stages: StatStages;
    readonly ability: BattleAbility | null;
    readonly moves: readonly MoveSlot[];
  };
  readonly moves: readonly MoveSlot[];
  /** Public species facts used by the authoritative capture formula. */
  readonly capture?: { readonly rate: number; readonly baseSpeed: number; readonly weight: number };
  /** Public visual identity replicated with battle state; excludes private Pokemon metadata. */
  readonly appearance?: {
    readonly form: number;
    readonly shiny: boolean;
    readonly gender: "male" | "female" | "genderless" | null;
  };
  /** Public decoy identity. It never replaces the mechanical species, types or statistics. */
  readonly illusion?: {
    readonly species: string;
    readonly name: string;
    readonly types: readonly string[];
    readonly form: number;
    readonly shiny: boolean;
    readonly gender: "male" | "female" | "genderless" | null;
  };
  /** Compatible source form projected from the persistent held stone. */
  readonly megaEvolution?: {
    readonly heldItem: string;
    readonly form: number;
    readonly stats: BattleStats;
    readonly types: readonly string[];
    readonly ability: BattleAbility;
    readonly activationAvailable: boolean;
  };
}

export interface BattleState {
  readonly turn: number;
  readonly status: BattleStatus;
  readonly winner: BattleSide | null;
  readonly battlers: Readonly<Record<BattleSide, BattlerState>>;
  readonly effects?: BattleEffects;
}

export interface BattleSideEffects {
  readonly reflectTurns: number;
  readonly luckyChantTurns: number;
  /** Source Tailwind counter; doubles the effective speed of every active ally. */
  readonly tailwindTurns?: number;
  /** Optional for backward-compatible snapshots created before Route 3. */
  readonly lightScreenTurns?: number;
  /** Entry hazards are optional for snapshots created before the Route 3 closure lot. */
  readonly spikesLayers?: number;
  readonly toxicSpikesLayers?: number;
  readonly stealthRock?: boolean;
  readonly stickyWeb?: boolean;
  readonly mistTurns?: number;
  readonly safeguardTurns?: number;
}

export interface BattleEffects {
  readonly sides: Readonly<Record<BattleSide, BattleSideEffects>>;
  readonly waterSportTurns: number;
  /** Tactical transfers retained for owner-scoped persistence at battle settlement. */
  readonly itemTransfers?: readonly { readonly item: HeldItem; readonly sourceId: string;
    readonly targetId: string; readonly reason: "pickpocket" }[];
  /** Monotonic source ordering used when Pickup has several eligible items. */
  readonly nextPickupUse?: number;
  /** Optional for backward-compatible snapshots created before Route 3. */
  readonly mudSportTurns?: number;
  /** Defog clears the active source terrain even before terrain-setting moves are ported. */
  readonly terrain?: "electric" | "grassy" | "misty" | "psychic" | null;
  readonly terrainTurns?: number;
  readonly trickRoomTurns?: number;
  readonly weather?: "sun" | "rain" | "sand" | "hail" | "heavy-rain" | "harsh-sun" | "strong-winds" | null;
  readonly weatherTurns?: number;
  readonly environment?: "none" | "grass" | "moving-water" | "still-water" | "underwater" | "cave"
    | "rock" | "sand" | "snow" | "volcano" | "graveyard" | "sky" | "space";
}

export interface PokemonCaptureCalculation {
  readonly baseRate: number;
  readonly modifiedRate: number;
  readonly maximumHp: number;
  readonly currentHp: number;
  readonly hpNumerator: number;
  readonly hpDenominator: number;
  readonly rateBeforeStatus: number;
  readonly statusMultiplier: number;
  readonly finalRate: number;
  readonly shakeThreshold: number | null;
  readonly criticalCaptureBonus: number;
  readonly criticalRoll: number | null;
  readonly shakeRolls: readonly number[];
  readonly automaticReason: "master-ball" | "rate-overflow" | null;
}

export interface MoveAction {
  readonly kind: "move";
  readonly moveIndex: number;
  /** Owner intent, resolved authoritatively before the selected move. */
  readonly megaEvolution?: true;
  /** Required for a selectable target in a double battle; ignored in a simple battle. */
  readonly target?: BattlePosition;
}

export type BattleAction = MoveAction;
export type TurnActions = Readonly<Record<BattleSide, BattleAction>>;

export interface RandomSource {
  nextInt(maxExclusive: number): number;
}

export interface StatefulRandomSource extends RandomSource {
  snapshot(): number;
}

export interface BattleResolutionRules {
  /** Wild opposing Pokemon cannot permanently steal a player's held item in Pokemon Z. */
  readonly opponentItemTheft: boolean;
}

export type BattleEvent =
  | { readonly type: "turnStarted"; readonly turn: number }
  | { readonly type: "actionOrdered"; readonly order: readonly BattleSide[] }
  | { readonly type: "moveUsed"; readonly side: BattleSide; readonly move: string }
  | { readonly type: "ppChanged"; readonly side: BattleSide; readonly move: string; readonly pp: number }
  | { readonly type: "moveMissed"; readonly side: BattleSide; readonly move: string }
  | { readonly type: "damageApplied"; readonly source: BattleSide; readonly target: BattleSide; readonly amount: number; readonly hp: number; readonly critical: boolean; readonly effectiveness: number }
  | { readonly type: "recoilDamage"; readonly side: BattleSide; readonly move: string;
      readonly reason?: "recoil" | "crash" | "self-destruct" | "belly-drum"; readonly amount: number; readonly hp: number }
  | { readonly type: "hpRestored"; readonly side: BattleSide; readonly source: "move"; readonly move: string; readonly amount: number; readonly hp: number }
  | { readonly type: "abilityActivated"; readonly side: BattleSide; readonly ability: ImplementedBattleAbility; readonly effect: "announce" | "prevent-stat-drop" | "reflect-stat-drop" | "prevent-status" | "prevent-confusion" | "prevent-additional-effect" | "prevent-infatuation" | "prevent-taunt" | "inflict-paralysis" | "inflict-status" | "inflict-burn" | "inflict-flinch" | "disable-move" | "reflect-move" | "lower-attack" | "lower-special-attack" | "lower-accuracy" | "lower-speed" | "lower-evasion" | "raise-stat" | "damage-attacker" | "absorb-type" | "heal-on-switch" | "heal-on-berry" | "cure-on-switch" | "survive" | "steal-item" | "block-move" | "boost-stat" | "charge" | "cure-status" | "change-type" | "change-ability" | "contact-damage" | "set-hazard" | "transform" | "set-terrain" | "set-trick-room" | "set-weather" | "weather-heal" | "weather-damage" | "status-heal" | "status-damage" | "pressure" | "recover-item" | "randomize-stats" | "skip-turn" | "extra-hit" | "request-switch" | "break-disguise" }
  | { readonly type: "abilityObserved"; readonly side: BattleSide; readonly ability: "TRACE" | "FRISK" | "ANTICIPATION" | "FOREWARN";
      readonly observation: { readonly kind: "copied-ability"; readonly targetId: string; readonly ability: BattleAbility }
        | { readonly kind: "held-item"; readonly targetId: string; readonly item: HeldItem }
        | { readonly kind: "danger" }
        | { readonly kind: "move"; readonly targetId: string; readonly move: string } }
  | { readonly type: "abilityDamage"; readonly source: BattleSide; readonly target: BattleSide;
      readonly ability: ImplementedBattleAbility; readonly amount: number; readonly hp: number }
  | { readonly type: "abilityChanged"; readonly source: BattleSide; readonly target: BattleSide;
      readonly ability: BattleAbility; readonly move: string }
  | { readonly type: "formChanged"; readonly side: BattleSide; readonly species: string;
      readonly fromForm: number; readonly toForm: number; readonly reason: "ability" }
  | { readonly type: "forcedSwitchRequested"; readonly side: BattleSide; readonly ability: "EMERGENCYEXIT" }
  | { readonly type: "statusApplied"; readonly source: BattleSide; readonly target: BattleSide; readonly status: MajorStatusState["kind"] }
  | { readonly type: "statusApplicationFailed"; readonly source: BattleSide; readonly target: BattleSide; readonly status: MajorStatusState["kind"]; readonly reason: "already-status" | "type-immune" | "ability-immune" | "safeguard" }
  | { readonly type: "statusContinued"; readonly side: BattleSide; readonly status: MajorStatusState["kind"] }
  | { readonly type: "statusCured"; readonly side: BattleSide; readonly status: MajorStatusState["kind"] }
  | { readonly type: "statusDamage"; readonly side: BattleSide; readonly status: "poison" | "burn" | "frozen"; readonly amount: number; readonly hp: number }
  | { readonly type: "weatherDamage"; readonly side: BattleSide; readonly weather: "sand"; readonly amount: number; readonly hp: number }
  | { readonly type: "itemActivated"; readonly side: BattleSide; readonly item: HeldItem; readonly effect: "heal" | "damage" | "boost"; readonly amount: number; readonly hp: number }
  | { readonly type: "heldItemConsumed"; readonly side: BattleSide; readonly item: HeldItem;
      readonly effect: "survive" | "boost" | "weaken" | "heal" | "eaten"; readonly hp: number }
  | { readonly type: "heldItemRecovered"; readonly side: BattleSide; readonly item: HeldItem;
      readonly ability: "PICKUP" | "HARVEST" }
  | { readonly type: "heldItemTransferred"; readonly source: BattleSide; readonly target: BattleSide;
      readonly item: HeldItem; readonly reason: "pickpocket" }
  | { readonly type: "heldItemTransferred"; readonly source: BattleSide; readonly target: BattleSide;
      readonly item: HeldItem; readonly move: string }
  | { readonly type: "heldItemRemoved"; readonly source: BattleSide; readonly target: BattleSide;
      readonly item: HeldItem; readonly move: string }
  | { readonly type: "moveFailed"; readonly side: BattleSide; readonly move: string;
      readonly reason: "condition" | "protected" | "taunted" }
  | { readonly type: "ppReduced"; readonly source: BattleSide; readonly target: BattleSide;
      readonly move: string; readonly amount: number; readonly pp: number }
  | { readonly type: "battleEffectChanged"; readonly side: BattleSide | null;
      readonly effect: "reflect" | "light-screen" | "lucky-chant" | "mud-sport" | "water-sport"
        | "spikes" | "toxic-spikes" | "stealth-rock" | "sticky-web" | "mist" | "safeguard" | "tailwind" | "terrain" | "trick-room" | "weather";
      readonly turns: number }
  | { readonly type: "captureAttempted"; readonly side: BattleSide; readonly ballId: string;
      readonly target: string; readonly shakes: number; readonly critical: boolean; readonly success: boolean;
      readonly calculation: PokemonCaptureCalculation }
  | { readonly type: "statStageChanged"; readonly source: BattleSide; readonly target: BattleSide; readonly stat: BattleStat; readonly delta: number; readonly stage: number }
  | { readonly type: "statStageChangeFailed"; readonly source: BattleSide; readonly target: BattleSide; readonly stat: BattleStat; readonly reason: "limit" | "mist" }
  | { readonly type: "fainted"; readonly side: BattleSide }
  | { readonly type: "volatileApplied"; readonly source: BattleSide; readonly target: BattleSide;
      readonly effect: "confusion" | "flinch" | "focus-energy" | "identified" | "disable" | "encore" | "binding" | "curse" | "infatuation" | "leech-seed" | "taunt" | "rage" | "protect" | "endure" | "yawn" | "charge" | "helping-hand" | "uproar" | "embargo";
      readonly turns: number | null; readonly move: string | null }
  | { readonly type: "volatileEnded"; readonly side: BattleSide;
      readonly effect: "confusion" | "disable" | "encore" | "binding" | "infatuation" | "leech-seed" | "taunt" | "protect" | "endure" }
  | { readonly type: "confusionDamage"; readonly side: BattleSide; readonly amount: number; readonly hp: number }
  | { readonly type: "bindingDamage"; readonly side: BattleSide; readonly move: string; readonly amount: number; readonly hp: number }
  | { readonly type: "leechSeedDamage"; readonly side: BattleSide; readonly amount: number; readonly hp: number }
  | { readonly type: "curseDamage"; readonly side: BattleSide; readonly amount: number; readonly hp: number }
  | { readonly type: "actionSkipped"; readonly side: BattleSide; readonly reason: "fainted" | "no-pp" | "sleep" | "paralysis" | "item-blocked" | "flinch" | "confusion" | "infatuation" | "disabled" | "taunted" | "truant" }
  | { readonly type: "battleEnded"; readonly winner: BattleSide | null }
  | { readonly type: "turnEnded"; readonly turn: number };

export type BattleTrace =
  | { readonly type: "order"; readonly side: BattleSide; readonly priority: number; readonly speed: number }
  | { readonly type: "rng"; readonly purpose: "speed-tie" | "accuracy" | "critical" | "damage-variance" | "sleep-duration" | "paralysis" | "additional-effect" | "ability" | "confusion-duration" | "confusion-action" | "infatuation" | "binding-duration" | "protection" | "magnitude" | "acupressure"; readonly maxExclusive: number; readonly value: number }
  | { readonly type: "accuracy"; readonly side: BattleSide; readonly base: number; readonly accuracyStage: number; readonly evasionStage: number; readonly threshold: number; readonly hit: boolean;
      readonly abilityModifier?: { readonly ability: ImplementedBattleAbility; readonly multiplier: number } }
  | { readonly type: "damage"; readonly side: BattleSide; readonly move: string; readonly attack: number; readonly defense: number; readonly baseDamage: number; readonly critical: boolean; readonly variance: number; readonly stab: number; readonly effectiveness: number; readonly statusModifier: number;
      readonly abilityModifier: { readonly ability: ImplementedBattleAbility; readonly multiplier: number } | null;
      readonly abilityModifiers: readonly { readonly ability: ImplementedBattleAbility; readonly multiplier: number }[];
      readonly result: number };

export interface TurnResult {
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
  readonly trace: readonly BattleTrace[];
}

export interface SwitchAction {
  readonly kind: "switch";
  readonly teamIndex: number;
  /** Active slot replaced in a double battle. Defaults to slot 0 in a simple battle. */
  readonly activeSlot?: number;
}

export interface WaitAction { readonly kind: "wait" }

export interface ItemAction {
  readonly kind: "item";
  readonly itemId: string;
  /** Team member owned by the acting trainer. It may be active or in reserve. */
  readonly targetTeamIndex: number;
  /** Required by single-move PP restorers; omitted for whole-Pokemon effects. */
  readonly targetMoveIndex?: number;
}

export interface CaptureAction {
  readonly kind: "capture";
  readonly ballId: string;
  readonly target?: BattlePosition;
}

export type TeamBattleAction = MoveAction | SwitchAction | WaitAction | ItemAction | CaptureAction;
export type TeamTurnActions = Readonly<Record<BattleSide, TeamBattleAction>>;

export interface BattleTeam {
  readonly activeIndex: number;
  /** One index in singles, up to two distinct conscious members in doubles. */
  readonly activeIndices?: readonly number[];
  readonly members: readonly BattlerState[];
  /** Source-controlled Trainer inventory. Player bags stay outside the public snapshot. */
  readonly items?: readonly string[];
}

export interface TeamBattleState {
  readonly turn: number;
  readonly status: BattleStatus;
  readonly winner: BattleSide | null;
  readonly teams: Readonly<Record<BattleSide, BattleTeam>>;
  readonly replacementRequired: readonly BattleSide[];
  readonly pivotRequired?: readonly BattleSide[];
  readonly format?: "single" | "double";
  readonly slotReplacements?: readonly BattlePosition[];
  readonly slotPivotReplacements?: readonly BattlePosition[];
  readonly effects?: BattleEffects;
  /** Authoritative once-per-owner usage and member ownership for Mega Evolution. */
  readonly megaEvolution?: {
    readonly owners: Readonly<Record<string, string>>;
    readonly usedOwnerIds: readonly string[];
  };
}

export interface BattlePosition {
  readonly side: BattleSide;
  readonly slot: number;
}

export interface PositionedTeamBattleAction {
  readonly actor: BattlePosition;
  readonly action: TeamBattleAction;
}

export type TeamBattleEvent =
  | BattleEvent
  | { readonly type: "megaEvolved"; readonly side: BattleSide; readonly teamIndex: number;
      readonly pokemonId: string; readonly fromForm: number; readonly toForm: number; readonly heldItem: string }
  | {
      readonly type: "teamActionOrdered";
      readonly order: readonly { readonly side: BattleSide; readonly kind: "move" | "switch" | "wait" | "item" | "capture" }[];
    }
  | {
      readonly type: "pokemonSwitched";
      readonly side: BattleSide;
      readonly fromIndex: number;
      readonly toIndex: number;
      readonly from: string;
      readonly to: string;
      readonly reason: "voluntary" | "replacement" | "forced";
    }
  | { readonly type: "replacementRequired"; readonly side: BattleSide }
  | { readonly type: "trainerItemUsed"; readonly side: BattleSide; readonly itemId: string;
      readonly targetIndex: number; readonly target: string; readonly hpRestored: number;
      readonly ppRestored: number; readonly movePp: readonly number[] | null;
      readonly targetMoveIndex: number | null;
      readonly statusCured: MajorStatusState["kind"] | null; readonly revived: boolean;
      readonly statRaised: BattleStat | null; readonly stagesRaised: number;
      readonly happinessChanged: number };

export type DoubleBattleEvent = TeamBattleEvent | {
  readonly type: "positionedActionResolved";
  readonly actor: BattlePosition;
  readonly targets: readonly BattlePosition[];
  readonly events: readonly BattleEvent[];
};

export interface DoubleTurnResult {
  readonly state: TeamBattleState;
  readonly events: readonly DoubleBattleEvent[];
  readonly trace: readonly BattleTrace[];
}

export interface TeamTurnResult {
  readonly state: TeamBattleState;
  readonly events: readonly TeamBattleEvent[];
  readonly trace: readonly BattleTrace[];
}

export interface TeamReplacementResult {
  readonly state: TeamBattleState;
  readonly events: readonly TeamBattleEvent[];
  readonly trace: readonly BattleTrace[];
}
