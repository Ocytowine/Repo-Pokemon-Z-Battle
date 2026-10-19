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
    | "00F" | "012" | "013" | "016"
    | "01C" | "01D" | "01E" | "01F" | "020" | "021" | "022" | "023" | "027" | "028" | "030"
    | "033" | "034" | "042" | "043" | "044" | "045" | "046" | "047" | "048" | "049" | "04B" | "04C" | "04D" | "04F"
    | "06F" | "077" | "07B" | "082" | "083" | "088" | "093" | "098" | "09A" | "09C" | "09D" | "09E" | "0A1" | "0A2" | "0A3" | "0A5" | "0A7"
    | "0AA" | "0AD" | "0B9" | "0BA" | "0BC" | "0BD" | "0BE" | "0C0" | "0CF" | "0D5" | "0D8" | "0DC" | "0DD" | "0E8" | "0F1" | "0F4"
    | "0FA" | "10D" | "10E" | "110" | "116" | "159" | "906";
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

export const IMPLEMENTED_BATTLE_ABILITIES = ["ACOMETIDA", "ADAPTABILITY", "AERILATE", "BATTLEARMOR", "BIGPECKS", "BLAZE", "CHEEKPOUCH", "COMPOUNDEYES", "CORROSION",
  "CONTRAGUARDIA", "DRYSKIN", "FILTER", "FLORACION", "GUTS", "HUGEPOWER", "INNERFOCUS", "INTIMIDATE",
  "IRONFIST", "KEENEYE", "LEVITATE", "LIQUIDVOICE", "MAGICGUARD", "MEGALAUNCHER", "MULTISCALE", "NEUROFORCE", "NOGUARD", "OVERGROW", "PIELHELADA", "PIXILATE",
  "NATURALCURE", "PIELHERBACEA", "PRANKSTER", "PUREPOWER", "QUICKFEET", "REGENERATOR", "RIVALRY", "SAPSIPPER", "SERENEGRACE", "SHELLARMOR", "SHEDSKIN", "SHIELDDUST",
  "SCRAPPY", "SHEERFORCE", "SIMPLE", "SKILLLINK", "SNIPER", "SOLIDROCK", "SOUNDPROOF", "STATIC", "STEADFAST", "STRONGJAW", "SWARM", "SYNCHRONIZE", "TECHNICIAN", "UNAWARE", "WATERABSORB", "COMPETITIVE",
  "THICKFAT", "TORRENT", "TOUGHCLAWS"] as const;
export type ImplementedBattleAbility = typeof IMPLEMENTED_BATTLE_ABILITIES[number];
/** Source ability identity. Only ImplementedBattleAbility values currently apply an automatic battle effect. */
export type BattleAbility = ImplementedBattleAbility | (string & {});
export const SUPPORTED_HELD_ITEMS = ["ASSAULTVEST", "BLACKSLUDGE", "EXPERTBELT", "FOCUSSASH",
  "LEFTOVERS", "LIFEORB", "MUSCLEBAND", "ROCKYHELMET", "SCOPELENS", "WIDELENS", "WISEGLASSES",
  "BUGGEM", "COVERTCLOAK", "EVIOLITE", "FIGHTINGGEM", "ORANBERRY", "PAYAPABERRY"] as const;
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
    readonly protected?: boolean;
    readonly endured?: boolean;
    /** Source ProtectRate: 1 initially, doubled after each consecutive success. */
    readonly protectRate?: number;
    readonly tauntTurns?: number;
    readonly rage?: boolean;
    /** Source side for Leech Seed; legacy snapshots omit it. */
    readonly leechSeededBy?: BattleSide | null;
    readonly yawnTurns?: number;
    readonly infatuated?: boolean;
  };
  readonly ability: BattleAbility | null;
  readonly heldItem: HeldItem | null;
  readonly moves: readonly MoveSlot[];
  /** Public species facts used by the authoritative capture formula. */
  readonly capture?: { readonly rate: number; readonly baseSpeed: number; readonly weight: number };
  /** Public visual identity replicated with battle state; excludes private Pokemon metadata. */
  readonly appearance?: {
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
  /** Optional for backward-compatible snapshots created before Route 3. */
  readonly lightScreenTurns?: number;
}

export interface BattleEffects {
  readonly sides: Readonly<Record<BattleSide, BattleSideEffects>>;
  readonly waterSportTurns: number;
  /** Optional for backward-compatible snapshots created before Route 3. */
  readonly mudSportTurns?: number;
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

export type BattleEvent =
  | { readonly type: "turnStarted"; readonly turn: number }
  | { readonly type: "actionOrdered"; readonly order: readonly BattleSide[] }
  | { readonly type: "moveUsed"; readonly side: BattleSide; readonly move: string }
  | { readonly type: "ppChanged"; readonly side: BattleSide; readonly move: string; readonly pp: number }
  | { readonly type: "moveMissed"; readonly side: BattleSide; readonly move: string }
  | { readonly type: "damageApplied"; readonly source: BattleSide; readonly target: BattleSide; readonly amount: number; readonly hp: number; readonly critical: boolean; readonly effectiveness: number }
  | { readonly type: "hpRestored"; readonly side: BattleSide; readonly source: "move"; readonly move: string; readonly amount: number; readonly hp: number }
  | { readonly type: "abilityActivated"; readonly side: BattleSide; readonly ability: ImplementedBattleAbility; readonly effect: "prevent-stat-drop" | "prevent-additional-effect" | "inflict-paralysis" | "lower-attack" | "heal-on-switch" | "heal-on-berry" | "block-move" | "boost-stat" | "cure-status" }
  | { readonly type: "statusApplied"; readonly source: BattleSide; readonly target: BattleSide; readonly status: MajorStatusState["kind"] }
  | { readonly type: "statusApplicationFailed"; readonly source: BattleSide; readonly target: BattleSide; readonly status: MajorStatusState["kind"]; readonly reason: "already-status" | "type-immune" }
  | { readonly type: "statusContinued"; readonly side: BattleSide; readonly status: MajorStatusState["kind"] }
  | { readonly type: "statusCured"; readonly side: BattleSide; readonly status: MajorStatusState["kind"] }
  | { readonly type: "statusDamage"; readonly side: BattleSide; readonly status: "poison" | "burn" | "frozen"; readonly amount: number; readonly hp: number }
  | { readonly type: "itemActivated"; readonly side: BattleSide; readonly item: HeldItem; readonly effect: "heal" | "damage"; readonly amount: number; readonly hp: number }
  | { readonly type: "heldItemConsumed"; readonly side: BattleSide; readonly item: HeldItem;
      readonly effect: "survive" | "boost" | "weaken" | "heal" | "eaten"; readonly hp: number }
  | { readonly type: "moveFailed"; readonly side: BattleSide; readonly move: string;
      readonly reason: "condition" | "protected" | "taunted" }
  | { readonly type: "ppReduced"; readonly source: BattleSide; readonly target: BattleSide;
      readonly move: string; readonly amount: number; readonly pp: number }
  | { readonly type: "battleEffectChanged"; readonly side: BattleSide | null;
      readonly effect: "reflect" | "light-screen" | "lucky-chant" | "mud-sport" | "water-sport"; readonly turns: number }
  | { readonly type: "captureAttempted"; readonly side: BattleSide; readonly ballId: string;
      readonly target: string; readonly shakes: number; readonly critical: boolean; readonly success: boolean;
      readonly calculation: PokemonCaptureCalculation }
  | { readonly type: "statStageChanged"; readonly source: BattleSide; readonly target: BattleSide; readonly stat: BattleStat; readonly delta: number; readonly stage: number }
  | { readonly type: "statStageChangeFailed"; readonly source: BattleSide; readonly target: BattleSide; readonly stat: BattleStat; readonly reason: "limit" }
  | { readonly type: "fainted"; readonly side: BattleSide }
  | { readonly type: "volatileApplied"; readonly source: BattleSide; readonly target: BattleSide;
      readonly effect: "confusion" | "flinch" | "focus-energy" | "identified" | "disable" | "encore" | "binding" | "curse" | "infatuation" | "leech-seed" | "taunt" | "rage" | "protect" | "endure" | "yawn";
      readonly turns: number | null; readonly move: string | null }
  | { readonly type: "volatileEnded"; readonly side: BattleSide;
      readonly effect: "confusion" | "disable" | "encore" | "binding" | "taunt" | "protect" | "endure" }
  | { readonly type: "confusionDamage"; readonly side: BattleSide; readonly amount: number; readonly hp: number }
  | { readonly type: "bindingDamage"; readonly side: BattleSide; readonly move: string; readonly amount: number; readonly hp: number }
  | { readonly type: "leechSeedDamage"; readonly side: BattleSide; readonly amount: number; readonly hp: number }
  | { readonly type: "curseDamage"; readonly side: BattleSide; readonly amount: number; readonly hp: number }
  | { readonly type: "actionSkipped"; readonly side: BattleSide; readonly reason: "fainted" | "no-pp" | "sleep" | "paralysis" | "item-blocked" | "flinch" | "confusion" | "infatuation" | "disabled" | "taunted" }
  | { readonly type: "battleEnded"; readonly winner: BattleSide }
  | { readonly type: "turnEnded"; readonly turn: number };

export type BattleTrace =
  | { readonly type: "order"; readonly side: BattleSide; readonly priority: number; readonly speed: number }
  | { readonly type: "rng"; readonly purpose: "speed-tie" | "accuracy" | "critical" | "damage-variance" | "sleep-duration" | "paralysis" | "additional-effect" | "ability" | "confusion-duration" | "confusion-action" | "infatuation" | "binding-duration" | "protection"; readonly maxExclusive: number; readonly value: number }
  | { readonly type: "accuracy"; readonly side: BattleSide; readonly base: number; readonly accuracyStage: number; readonly evasionStage: number; readonly threshold: number; readonly hit: boolean }
  | { readonly type: "damage"; readonly side: BattleSide; readonly move: string; readonly attack: number; readonly defense: number; readonly baseDamage: number; readonly critical: boolean; readonly variance: number; readonly stab: number; readonly effectiveness: number; readonly statusModifier: number;
      readonly abilityModifier: { readonly ability: ImplementedBattleAbility; readonly multiplier: number } | null;
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
  readonly format?: "single" | "double";
  readonly slotReplacements?: readonly BattlePosition[];
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
      readonly reason: "voluntary" | "replacement";
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
  readonly trace: readonly [];
}
