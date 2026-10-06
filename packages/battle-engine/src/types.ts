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
  readonly functionCode: "000" | "003" | "005" | "006" | "007" | "00A" | "00C"
    | "01C" | "01D" | "01F" | "020"
    | "042" | "043" | "044" | "045" | "046" | "047"
    | "06F" | "0A5" | "0D8" | "0DD" | "159" | "906";
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

export type BattleAbility = "BIGPECKS" | "BLAZE" | "CHLOROPHYLL" | "GUTS" | "HUGEPOWER" | "MAGICGUARD" | "OVERGROW"
  | "PUREPOWER" | "QUICKFEET" | "SHIELDDUST" | "SIMPLE" | "STATIC" | "TORRENT";
export type HeldItem = "ASSAULTVEST" | "BLACKSLUDGE" | "LEFTOVERS" | "MUSCLEBAND" | "SCOPELENS" | "WISEGLASSES";

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
  readonly majorStatus: MajorStatusState | null;
  readonly ability: BattleAbility | null;
  readonly heldItem: HeldItem | null;
  readonly moves: readonly MoveSlot[];
  /** Public visual identity replicated with battle state; excludes private Pokemon metadata. */
  readonly appearance?: {
    readonly form: number;
    readonly shiny: boolean;
    readonly gender: "male" | "female" | "genderless" | null;
  };
}

export interface BattleState {
  readonly turn: number;
  readonly status: BattleStatus;
  readonly winner: BattleSide | null;
  readonly battlers: Readonly<Record<BattleSide, BattlerState>>;
}

export interface MoveAction {
  readonly kind: "move";
  readonly moveIndex: number;
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
  | { readonly type: "abilityActivated"; readonly side: BattleSide; readonly ability: BattleAbility; readonly effect: "prevent-stat-drop" | "prevent-additional-effect" | "inflict-paralysis" }
  | { readonly type: "statusApplied"; readonly source: BattleSide; readonly target: BattleSide; readonly status: MajorStatusState["kind"] }
  | { readonly type: "statusApplicationFailed"; readonly source: BattleSide; readonly target: BattleSide; readonly status: MajorStatusState["kind"]; readonly reason: "already-status" | "type-immune" }
  | { readonly type: "statusContinued"; readonly side: BattleSide; readonly status: MajorStatusState["kind"] }
  | { readonly type: "statusCured"; readonly side: BattleSide; readonly status: MajorStatusState["kind"] }
  | { readonly type: "statusDamage"; readonly side: BattleSide; readonly status: "poison" | "burn" | "frozen"; readonly amount: number; readonly hp: number }
  | { readonly type: "itemActivated"; readonly side: BattleSide; readonly item: HeldItem; readonly effect: "heal" | "damage"; readonly amount: number; readonly hp: number }
  | { readonly type: "statStageChanged"; readonly source: BattleSide; readonly target: BattleSide; readonly stat: BattleStat; readonly delta: number; readonly stage: number }
  | { readonly type: "statStageChangeFailed"; readonly source: BattleSide; readonly target: BattleSide; readonly stat: BattleStat; readonly reason: "limit" }
  | { readonly type: "fainted"; readonly side: BattleSide }
  | { readonly type: "actionSkipped"; readonly side: BattleSide; readonly reason: "fainted" | "no-pp" | "sleep" | "paralysis" | "item-blocked" }
  | { readonly type: "battleEnded"; readonly winner: BattleSide }
  | { readonly type: "turnEnded"; readonly turn: number };

export type BattleTrace =
  | { readonly type: "order"; readonly side: BattleSide; readonly priority: number; readonly speed: number }
  | { readonly type: "rng"; readonly purpose: "speed-tie" | "accuracy" | "critical" | "damage-variance" | "sleep-duration" | "paralysis" | "additional-effect" | "ability"; readonly maxExclusive: number; readonly value: number }
  | { readonly type: "accuracy"; readonly side: BattleSide; readonly base: number; readonly accuracyStage: number; readonly evasionStage: number; readonly threshold: number; readonly hit: boolean }
  | { readonly type: "damage"; readonly side: BattleSide; readonly move: string; readonly attack: number; readonly defense: number; readonly baseDamage: number; readonly critical: boolean; readonly variance: number; readonly stab: number; readonly effectiveness: number; readonly statusModifier: number; readonly result: number };

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

export type TeamBattleAction = MoveAction | SwitchAction | WaitAction;
export type TeamTurnActions = Readonly<Record<BattleSide, TeamBattleAction>>;

export interface BattleTeam {
  readonly activeIndex: number;
  /** One index in singles, up to two distinct conscious members in doubles. */
  readonly activeIndices?: readonly number[];
  readonly members: readonly BattlerState[];
}

export interface TeamBattleState {
  readonly turn: number;
  readonly status: BattleStatus;
  readonly winner: BattleSide | null;
  readonly teams: Readonly<Record<BattleSide, BattleTeam>>;
  readonly replacementRequired: readonly BattleSide[];
  readonly format?: "single" | "double";
  readonly slotReplacements?: readonly BattlePosition[];
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
  | {
      readonly type: "teamActionOrdered";
      readonly order: readonly { readonly side: BattleSide; readonly kind: "move" | "switch" | "wait" }[];
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
  | { readonly type: "replacementRequired"; readonly side: BattleSide };

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
