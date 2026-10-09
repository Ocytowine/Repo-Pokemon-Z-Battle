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
  localMapId: number | null, hostMapId: number, roomBattleActive = false,
  battleAllowsAttachment = false): boolean {
  return guest && presence === "away" && localMapId === hostMapId
    && (!roomBattleActive || battleAllowsAttachment);
}

export function sourceBattleAllowsAttachment(battle: {
  readonly state: { readonly status: string };
  readonly sourceContext: { readonly mapId: number } | null;
} | null | undefined, hostMapId: number): boolean {
  return battle?.state.status === "active" && battle.sourceContext?.mapId === hostMapId;
}

export function sourceStateWithHostStory(local: SourceEventState, story: SourceStorySnapshot | null,
  guest: boolean): SourceEventState {
  return !guest || story === null ? local : { ...local, switches: story.switches,
    variables: story.variables, selfSwitches: story.selfSwitches };
}

/** Keeps personal effects while preventing the host story projection from leaking into the guest save. */
export function sourceStateWithLocalStory(local: SourceEventState, applied: SourceEventState): SourceEventState {
  return { ...applied, switches: local.switches, variables: local.variables,
    selfSwitches: local.selfSwitches };
}

/**
 * Sur la carte partagee, l'invite ne peut lancer que les effets qui concernent
 * explicitement sa propre partie ou une sortie de carte. Les autres sequences
 * narratives restent sous l'autorite de l'hote.
 */
export function guestSourceEventAccess(page: ImportedEventPage): GuestSourceEventAccess {
  const commands = page.commands.map((command) => portSourceRubyCommand(command) ?? command);
  const forbiddenPersonalEffects = new Set([
    "add-pokemon", "request-encounter", "request-trainer-battle", "set-pokedex-enabled", "set-follower",
  ]);
  if (commands.some((command) => forbiddenPersonalEffects.has(command.kind))) return "blocked";
  if (commands.some((command) => command.kind === "transfer-player")) return "transfer";
  if (commands.some((command) => command.kind === "heal-party" || command.kind === "recover-all"
    || command.kind === "open-shop" || command.kind === "open-ranch")) return "personal";
  return "blocked";
}

/** State effects retained from a personal service while the host owns the story. */
export function guestSourceStateCommandAllowed(page: ImportedEventPage, kind: string): boolean {
  return guestSourceEventAccess(page) === "personal" && (kind === "heal-party" || kind === "set-checkpoint");
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

/** Joining a source battle is an interaction with the adjacent battle owner, not a duel aiming check. */
export function sourcePlayersAdjacent(world: SourceWorldSnapshot | null,
  side: "player" | "opponent"): boolean {
  if (world === null || world.presence.player !== "shared" || world.presence.opponent !== "shared") return false;
  const otherSide = side === "player" ? "opponent" : "player";
  const avatar = world.avatars[side];
  const target = world.avatars[otherSide];
  return Math.abs(avatar.x - target.x) + Math.abs(avatar.y - target.y) === 1;
}
