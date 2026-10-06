import type { ImportedEventPage } from "./imported-map.js";
import type { SourceEventState } from "./source-event-state.js";
import type { SourceStorySnapshot } from "@pokemon-z-battle/multiplayer-protocol";
import type { SourceWorldSnapshot } from "@pokemon-z-battle/multiplayer-protocol";
import { portSourceRubyCommand } from "./source-script-ports.js";

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
  localMapId: number | null, hostMapId: number, roomBattleActive = false): boolean {
  return guest && presence === "away" && localMapId === hostMapId && !roomBattleActive;
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
  const commands = page.commands.map((command) => portSourceRubyCommand(command) ?? command);
  const sharedNarrativeEffects = new Set([
    "set-switches", "set-self-switch", "change-variables", "add-pokemon",
    "request-encounter", "request-trainer-battle", "set-pokedex-enabled", "set-follower",
  ]);
  if (commands.some((command) => sharedNarrativeEffects.has(command.kind))) return "blocked";
  if (commands.some((command) => command.kind === "transfer-player")) return "transfer";
  if (commands.some((command) => command.kind === "heal-party" || command.kind === "recover-all"
    || command.kind === "open-shop" || command.kind === "open-ranch")) return "personal";
  return "blocked";
}

/**
 * Le client et la room prennent leur décision depuis le même snapshot
 * autoritaire. Cela évite qu'une interpolation visuelle locale empêche un défi
 * pourtant valide côté serveur.
 */
export function sourcePlayersFaceForDuel(world: SourceWorldSnapshot | null,
  side: "player" | "opponent"): boolean {
  if (world === null || world.presence.player !== "shared" || world.presence.opponent !== "shared") return false;
  const otherSide = side === "player" ? "opponent" : "player";
  const avatar = world.avatars[side];
  const target = world.avatars[otherSide];
  const delta = avatar.direction === "up" ? { x: 0, y: -1 } : avatar.direction === "down"
    ? { x: 0, y: 1 } : avatar.direction === "left" ? { x: -1, y: 0 } : { x: 1, y: 0 };
  return avatar.x + delta.x === target.x && avatar.y + delta.y === target.y;
}
