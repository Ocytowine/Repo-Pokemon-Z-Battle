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

export interface OverworldCatalog {
  readonly maps: Readonly<Record<string, WorldMap>>;
}

export interface AvatarState extends GridPoint {
  readonly id: string;
  readonly name: string;
  readonly mapId: string;
  readonly direction: Direction;
}

export interface OverworldState {
  readonly tick: number;
  readonly avatars: Readonly<Record<string, AvatarState>>;
}

export interface MoveIntent {
  readonly playerId: string;
  readonly direction: Direction;
}

export type MovementBlockedReason = "bounds" | "collision" | "occupied";

export type OverworldEvent =
  | { readonly type: "directionChanged"; readonly playerId: string; readonly direction: Direction }
  | { readonly type: "movementBlocked"; readonly playerId: string; readonly mapId: string; readonly at: GridPoint; readonly reason: MovementBlockedReason }
  | { readonly type: "avatarMoved"; readonly playerId: string; readonly mapId: string; readonly from: GridPoint; readonly to: GridPoint }
  | { readonly type: "mapChanged"; readonly playerId: string; readonly fromMapId: string; readonly toMapId: string; readonly position: GridPoint };

export interface OverworldResult {
  readonly state: OverworldState;
  readonly events: readonly OverworldEvent[];
}
