import type { SourceEventState } from "./source-event-state.js";
import { SOURCE_WORLD_SAVE_KEY } from "./source-world-save.js";

export const SOURCE_EVENT_STATE_STORAGE_KEY = "pokemon-z-battle.source-event-state.v1";
export const SOURCE_NEW_GAME_STORAGE_KEY = "pokemon-z-battle.source-new-game.v1";
export const SOURCE_NEW_GAME_SCHEMA_VERSION = 1 as const;

export type SourceDifficulty = "classic" | "challenging" | "heroic";
export type SourceAdventureMode = "normal" | "nuzlocke";
export type SourceStarterRegion = "kalos" | "kanto" | "johto" | "hoenn" | "sinnoh" | "unys" | "alola" | "galar" | "paldea";

export interface SourceNewGameChoices {
  readonly difficulty: SourceDifficulty;
  readonly adventureMode: SourceAdventureMode;
  readonly starterRegion: SourceStarterRegion;
}

export interface SourceNewGameSetup extends SourceNewGameChoices {
  readonly schemaVersion: typeof SOURCE_NEW_GAME_SCHEMA_VERSION;
  readonly completed: true;
}

export const DEFAULT_SOURCE_NEW_GAME_CHOICES: SourceNewGameChoices = Object.freeze({
  difficulty: "classic",
  adventureMode: "normal",
  starterRegion: "kalos",
});

export const SOURCE_NEW_GAME_DESTINATION = Object.freeze({
  mapId: 2,
  x: 37,
  y: 71,
  direction: "down" as const,
});

const DIFFICULTY_SWITCHES = Object.freeze({ challenging: "666", heroic: "698" });
const NUZLOCKE_SWITCH = "320";
const STARTER_REGION_SWITCHES: Readonly<Record<SourceStarterRegion, string>> = Object.freeze({
  kalos: "238", kanto: "239", johto: "240", hoenn: "241", sinnoh: "242",
  unys: "244", alola: "245", galar: "246", paldea: "247",
});

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSourceNewGameChoices(value: unknown): SourceNewGameChoices {
  if (!record(value)
    || !["classic", "challenging", "heroic"].includes(String(value.difficulty))
    || !["normal", "nuzlocke"].includes(String(value.adventureMode))
    || !(String(value.starterRegion) in STARTER_REGION_SWITCHES)) {
    throw new Error("Choix de nouvelle partie invalides.");
  }
  return { difficulty: value.difficulty as SourceDifficulty,
    adventureMode: value.adventureMode as SourceAdventureMode,
    starterRegion: value.starterRegion as SourceStarterRegion };
}

export function parseSourceNewGameSetup(value: unknown): SourceNewGameSetup {
  if (!record(value) || value.schemaVersion !== SOURCE_NEW_GAME_SCHEMA_VERSION || value.completed !== true) {
    throw new Error("Préparation de nouvelle partie invalide.");
  }
  return { schemaVersion: SOURCE_NEW_GAME_SCHEMA_VERSION, completed: true, ...parseSourceNewGameChoices(value) };
}

export function sourceAdventureSaveExists(storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(SOURCE_WORLD_SAVE_KEY) !== null
    || storage.getItem(SOURCE_EVENT_STATE_STORAGE_KEY) !== null;
}

export function sourceNewGameOpeningScenePending(storage: Pick<Storage, "getItem">,
  worldSave: { readonly mapId: number } | null, state: SourceEventState): boolean {
  if (worldSave?.mapId !== SOURCE_NEW_GAME_DESTINATION.mapId || state.switches["61"] === true) return false;
  const raw = storage.getItem(SOURCE_NEW_GAME_STORAGE_KEY);
  if (raw === null) return false;
  try { return parseSourceNewGameSetup(JSON.parse(raw) as unknown).completed; }
  catch { return false; }
}

export function applySourceNewGameChoices(state: SourceEventState, rawChoices: SourceNewGameChoices): SourceEventState {
  const choices = parseSourceNewGameChoices(rawChoices);
  const switches = { ...state.switches };
  for (const id of [...Object.values(DIFFICULTY_SWITCHES), NUZLOCKE_SWITCH, ...Object.values(STARTER_REGION_SWITCHES)]) {
    delete switches[id];
  }
  if (choices.difficulty !== "classic") switches[DIFFICULTY_SWITCHES[choices.difficulty]] = true;
  if (choices.adventureMode === "nuzlocke") switches[NUZLOCKE_SWITCH] = true;
  switches[STARTER_REGION_SWITCHES[choices.starterRegion]] = true;
  return { ...state, switches };
}

/** Reproduit les deux variables posees par Map001 sans dupliquer la personnalisation visuelle. */
export function applySourceNewGameAvatar(state: SourceEventState, avatarId: string): SourceEventState {
  const match = /^legacy-([0-5])$/u.exec(avatarId);
  if (match === null) throw new Error("Avatar de nouvelle partie invalide.");
  const index = Number(match[1]);
  return { ...state, variables: { ...state.variables,
    "51": index % 2 === 0 ? 1 : 2,
    "88": Math.floor(index / 2),
  } };
}

export function persistSourceNewGameSetup(storage: Pick<Storage, "setItem">,
  choices: SourceNewGameChoices): SourceNewGameSetup {
  const setup = { schemaVersion: SOURCE_NEW_GAME_SCHEMA_VERSION, completed: true,
    ...parseSourceNewGameChoices(choices) } satisfies SourceNewGameSetup;
  storage.setItem(SOURCE_NEW_GAME_STORAGE_KEY, JSON.stringify(setup));
  return setup;
}
