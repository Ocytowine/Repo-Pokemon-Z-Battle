export type BattleSide = "player" | "opponent";
export type MoveCategory = "Physical" | "Special";
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
  readonly functionCode: "000" | "0A5";
  readonly power: number;
  readonly type: string;
  readonly category: MoveCategory;
  readonly accuracy: number;
  readonly pp: number;
  readonly priority: number;
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

export interface BattlerState {
  readonly id: string;
  readonly species: string;
  readonly name: string;
  readonly level: number;
  readonly types: readonly string[];
  readonly stats: BattleStats;
  readonly stages: StatStages;
  readonly hp: number;
  readonly moves: readonly MoveSlot[];
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
}

export type BattleAction = MoveAction;
export type TurnActions = Readonly<Record<BattleSide, BattleAction>>;

export interface RandomSource {
  nextInt(maxExclusive: number): number;
}

export type BattleEvent =
  | { readonly type: "turnStarted"; readonly turn: number }
  | { readonly type: "actionOrdered"; readonly order: readonly BattleSide[] }
  | { readonly type: "moveUsed"; readonly side: BattleSide; readonly move: string }
  | { readonly type: "ppChanged"; readonly side: BattleSide; readonly move: string; readonly pp: number }
  | { readonly type: "moveMissed"; readonly side: BattleSide; readonly move: string }
  | { readonly type: "damageApplied"; readonly source: BattleSide; readonly target: BattleSide; readonly amount: number; readonly hp: number }
  | { readonly type: "fainted"; readonly side: BattleSide }
  | { readonly type: "actionSkipped"; readonly side: BattleSide; readonly reason: "fainted" | "no-pp" }
  | { readonly type: "battleEnded"; readonly winner: BattleSide }
  | { readonly type: "turnEnded"; readonly turn: number };

export type BattleTrace =
  | { readonly type: "order"; readonly side: BattleSide; readonly priority: number; readonly speed: number }
  | { readonly type: "rng"; readonly purpose: "speed-tie" | "accuracy" | "critical" | "damage-variance"; readonly maxExclusive: number; readonly value: number }
  | { readonly type: "accuracy"; readonly side: BattleSide; readonly base: number; readonly accuracyStage: number; readonly evasionStage: number; readonly threshold: number; readonly hit: boolean }
  | { readonly type: "damage"; readonly side: BattleSide; readonly move: string; readonly attack: number; readonly defense: number; readonly baseDamage: number; readonly critical: boolean; readonly variance: number; readonly stab: number; readonly effectiveness: number; readonly result: number };

export interface TurnResult {
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
  readonly trace: readonly BattleTrace[];
}
