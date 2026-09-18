export type Direction = "up" | "down" | "left" | "right";

export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

export interface MapTransition {
  readonly at: GridPoint;
  readonly targetMapId: string;
  readonly target: GridPoint;
}

export interface WorldMap {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly blocked: readonly GridPoint[];
  readonly transitions: readonly MapTransition[];
}

export type InteractionPolicy = "PERSONAL" | "SHARED" | "HOST_ONLY" | "SYNCED";
export type EncounterKind = "wild" | "trainer";

export type InteractionEffect =
  | { readonly type: "dialogue"; readonly text: string }
  | { readonly type: "item"; readonly itemId: string; readonly quantity: number }
  | { readonly type: "flag"; readonly flag: string }
  | { readonly type: "encounter"; readonly encounterId: string; readonly kind: EncounterKind };

export interface WorldInteraction {
  readonly id: string;
  readonly label: string;
  readonly kind: "npc" | "item" | "switch";
  readonly mapId: string;
  readonly at: GridPoint;
  readonly policy: InteractionPolicy;
  readonly effect: InteractionEffect;
}

export interface OverworldCatalog {
  readonly maps: Readonly<Record<string, WorldMap>>;
  readonly interactions?: readonly WorldInteraction[];
}

export interface AvatarState extends GridPoint {
  readonly id: string;
  readonly name: string;
  readonly mapId: string;
  readonly direction: Direction;
}

export interface PlayerState {
  readonly inventory: Readonly<Record<string, number>>;
  readonly flags: readonly string[];
  readonly completedInteractions: readonly string[];
}

export interface SessionState {
  readonly flags: readonly string[];
  readonly completedInteractions: readonly string[];
  readonly syncedParticipants: Readonly<Record<string, readonly string[]>>;
  readonly battleResults: readonly {
    readonly encounterId: string;
    readonly kind: EncounterKind;
    readonly winner: "player" | "opponent";
  }[];
}

export interface WorldState {
  readonly tick: number;
  readonly avatars: Readonly<Record<string, AvatarState>>;
  readonly players: Readonly<Record<string, PlayerState>>;
  readonly session: SessionState;
}

export type OverworldState = WorldState;

export interface MoveIntent {
  readonly playerId: string;
  readonly direction: Direction;
}

export interface InteractIntent {
  readonly playerId: string;
  readonly hostPlayerId: string;
}

export type MovementBlockedReason = "bounds" | "collision" | "occupied";

export type OverworldEvent =
  | { readonly type: "directionChanged"; readonly playerId: string; readonly direction: Direction }
  | { readonly type: "movementBlocked"; readonly playerId: string; readonly mapId: string; readonly at: GridPoint; readonly reason: MovementBlockedReason }
  | { readonly type: "avatarMoved"; readonly playerId: string; readonly mapId: string; readonly from: GridPoint; readonly to: GridPoint }
  | { readonly type: "mapChanged"; readonly playerId: string; readonly fromMapId: string; readonly toMapId: string; readonly position: GridPoint }
  | { readonly type: "interactionUnavailable"; readonly playerId: string; readonly interactionId: string | null; readonly reason: "nothing" | "completed" | "host-only" }
  | { readonly type: "interactionPending"; readonly playerId: string; readonly interactionId: string; readonly participants: readonly string[] }
  | { readonly type: "dialogueShown"; readonly playerId: string; readonly interactionId: string; readonly text: string; readonly policy: InteractionPolicy }
  | { readonly type: "itemGranted"; readonly playerId: string; readonly interactionId: string; readonly itemId: string; readonly quantity: number; readonly policy: InteractionPolicy }
  | { readonly type: "flagSet"; readonly playerId: string; readonly interactionId: string; readonly flag: string; readonly policy: InteractionPolicy }
  | { readonly type: "encounterRequested"; readonly playerId: string; readonly interactionId: string; readonly encounterId: string; readonly kind: EncounterKind }
  | { readonly type: "interactionCompleted"; readonly playerId: string; readonly interactionId: string; readonly policy: InteractionPolicy };

export interface OverworldResult {
  readonly state: OverworldState;
  readonly events: readonly OverworldEvent[];
}
