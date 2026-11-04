import type { ActiveMapEvent } from "./imported-map.js";

export type SourceContextAction = Readonly<{
  kind: "interact" | "sprint" | "unavailable";
  label: string;
  ariaLabel: string;
}>;

export interface SourceContextActionInput {
  readonly dialogue: "continue" | "choice" | null;
  readonly worldAvailable: boolean;
  readonly event: ActiveMapEvent | null;
  readonly eventTransfer: boolean;
  readonly remotePlayer: boolean;
  readonly joinableBattle: boolean;
  readonly traversal: "surface" | "dive" | "surf" | null;
  readonly sprintAllowed: boolean;
}

function interaction(label: string): SourceContextAction {
  return { kind: "interact", label, ariaLabel: label };
}

/** Presentation only; the existing interaction and movement paths remain authoritative. */
export function resolveSourceContextAction(input: SourceContextActionInput): SourceContextAction {
  if (input.dialogue === "continue") return interaction("Suite");
  if (input.dialogue === "choice") return { kind: "unavailable", label: "Choisir",
    ariaLabel: "Choisir une réponse dans le dialogue" };
  if (!input.worldAvailable) return { kind: "unavailable", label: "Action", ariaLabel: "Action indisponible" };
  if (input.traversal !== null && input.event === null) {
    return interaction(input.traversal === "surface" ? "Remonter"
      : input.traversal === "dive" ? "Plonger" : "Surfer");
  }
  if (input.joinableBattle) return interaction("Rejoindre");
  if (input.event !== null && (input.event.page.settings.trigger === 0 || input.eventTransfer)) {
    const page = input.event.page;
    const hasText = page.commands.some((command) => command.kind === "show-text");
    return interaction(hasText && page.graphic.characterName !== "" ? "Parler"
      : hasText && page.graphic.tileId > 0 ? "Lire" : "Interagir");
  }
  if (input.remotePlayer && input.event === null) return interaction("Défier");
  return input.sprintAllowed
    ? { kind: "sprint", label: "Sprint", ariaLabel: "Maintenir pour sprinter" }
    : { kind: "unavailable", label: "Action", ariaLabel: "Aucune action disponible" };
}
