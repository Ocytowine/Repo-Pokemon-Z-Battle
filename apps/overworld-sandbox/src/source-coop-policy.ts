import type { ImportedEventPage } from "./imported-map.js";
import type { SourceEventState } from "./source-event-state.js";
import type { SourceStorySnapshot } from "@pokemon-z-battle/multiplayer-protocol";

export type GuestSourceEventAccess = "blocked" | "personal" | "transfer";
export type SourceInteractionTarget = "event" | "player" | null;

/**
 * Un joueur distant peut occuper la case devant un comptoir sans masquer le
 * PNJ place derriere. Le duel reste disponible lorsqu'aucun evenement de carte
 * n'est vise par l'interaction.
 */
export function sourceInteractionTarget(hasMapEvent: boolean, remotePlayerAhead: boolean): SourceInteractionTarget {
  if (hasMapEvent) return "event";
  return remotePlayerAhead ? "player" : null;
}

export function shouldRejoinSharedSourceMap(guest: boolean, presence: "shared" | "away",
  localMapId: number | null, hostMapId: number): boolean {
  return guest && presence === "away" && localMapId === hostMapId;
}

export function sourceStateWithHostStory(local: SourceEventState, story: SourceStorySnapshot | null,
  guest: boolean): SourceEventState {
  return !guest || story === null ? local : { ...local, switches: story.switches,
    variables: story.variables, selfSwitches: story.selfSwitches };
}

/**
 * Sur la carte partagee, l'invite ne peut lancer que les effets qui concernent
 * explicitement sa propre partie ou une sortie de carte. Les autres sequences
 * narratives restent sous l'autorite de l'hote.
 */
export function guestSourceEventAccess(page: ImportedEventPage): GuestSourceEventAccess {
  if (page.commands.some((command) => command.kind === "transfer-player")) return "transfer";
  if (page.commands.some((command) => command.kind === "heal-party" || command.kind === "recover-all")) return "personal";
  return "blocked";
}
