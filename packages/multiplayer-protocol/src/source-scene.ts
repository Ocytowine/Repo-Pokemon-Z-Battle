import type { Direction } from "@pokemon-z-battle/overworld-engine";

export interface SourceSceneActorSnapshot {
  readonly eventId: number;
  readonly x: number;
  readonly y: number;
  readonly direction: Direction;
  readonly pattern?: number;
  readonly characterName?: string;
  readonly opacity?: number;
}

export interface SourceSceneDialogueSnapshot {
  readonly label: string;
  readonly text: string | null;
  readonly choices: readonly string[];
}

export interface SourceScenePresentationCue {
  readonly id: number;
  readonly kind: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface SourceSceneSnapshot {
  readonly mapId: number;
  readonly sequenceActive: boolean;
  readonly dialogue: SourceSceneDialogueSnapshot | null;
  readonly actors: readonly SourceSceneActorSnapshot[];
  readonly presentation: SourceScenePresentationCue | null;
}

const DIRECTIONS = new Set<Direction>(["up", "down", "left", "right"]);
const PRESENTATION_KINDS = new Set([
  "screen-tone", "screen-flash", "change-map-settings", "panorama-motion", "weather",
  "show-picture", "move-picture", "erase-picture", "play-music", "play-sound",
  "play-background-sound", "play-jingle", "play-cry", "fade-music", "scroll-map",
  "text-options", "show-animation",
]);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => key in value) && Object.keys(value).every((key) => allowed.has(key));
}

function integer(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function finite(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function shortText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length <= maximum;
}

function safeJson(value: unknown, depth = 0): boolean {
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.length <= 4_096;
  if (depth >= 8) return false;
  if (Array.isArray(value)) return value.length <= 256 && value.every((entry) => safeJson(entry, depth + 1));
  return record(value) && Object.keys(value).length <= 128
    && Object.entries(value).every(([key, entry]) => key.length <= 128 && safeJson(entry, depth + 1));
}

function parseActor(value: unknown): SourceSceneActorSnapshot {
  if (!record(value) || !exactKeys(value, ["eventId", "x", "y", "direction"],
    ["pattern", "characterName", "opacity"])
    || !integer(value.eventId, 1, 999_999) || !finite(value.x, -1_024, 1_024)
    || !finite(value.y, -1_024, 1_024) || typeof value.direction !== "string"
    || !DIRECTIONS.has(value.direction as Direction)
    || (value.pattern !== undefined && !integer(value.pattern, 0, 3))
    || (value.characterName !== undefined && !shortText(value.characterName, 256))
    || (value.opacity !== undefined && !finite(value.opacity, 0, 255))) {
    throw new Error("Acteur de cinematique source invalide.");
  }
  return value as unknown as SourceSceneActorSnapshot;
}

function parseDialogue(value: unknown): SourceSceneDialogueSnapshot | null {
  if (value === null) return null;
  if (!record(value) || !exactKeys(value, ["label", "text", "choices"])
    || !shortText(value.label, 256) || (value.text !== null && !shortText(value.text, 8_192))
    || !Array.isArray(value.choices) || value.choices.length > 16
    || value.choices.some((choice) => !shortText(choice, 1_024))) {
    throw new Error("Dialogue de cinematique source invalide.");
  }
  return value as unknown as SourceSceneDialogueSnapshot;
}

function parsePresentation(value: unknown): SourceScenePresentationCue | null {
  if (value === null) return null;
  if (!record(value) || !exactKeys(value, ["id", "kind", "data"])
    || !integer(value.id, 1, Number.MAX_SAFE_INTEGER) || typeof value.kind !== "string"
    || !PRESENTATION_KINDS.has(value.kind) || !record(value.data) || !safeJson(value.data)) {
    throw new Error("Commande visuelle de cinematique source invalide.");
  }
  return value as unknown as SourceScenePresentationCue;
}

export function parseSourceSceneSnapshot(value: unknown): SourceSceneSnapshot {
  if (!record(value) || !exactKeys(value,
    ["mapId", "sequenceActive", "dialogue", "actors", "presentation"])
    || !integer(value.mapId, 1, 999_999) || typeof value.sequenceActive !== "boolean"
    || !Array.isArray(value.actors) || value.actors.length > 4_096) {
    throw new Error("Cinematique source invalide.");
  }
  return {
    mapId: value.mapId,
    sequenceActive: value.sequenceActive,
    dialogue: parseDialogue(value.dialogue),
    actors: value.actors.map(parseActor),
    presentation: parsePresentation(value.presentation),
  };
}
