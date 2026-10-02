import type { ImportedEventPage } from "./imported-map.js";

export type GuestSourceEventAccess = "blocked" | "personal" | "transfer";
export type SourceDialoguePresentation = "local" | "readonly" | "none";

export function sourceDialoguePresentation(localDialogueActive: boolean,
  observingHostScene: boolean): SourceDialoguePresentation {
  if (localDialogueActive) return "local";
  return observingHostScene ? "readonly" : "none";
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
