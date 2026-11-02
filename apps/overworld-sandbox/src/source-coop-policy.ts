import type { ImportedEventPage } from "./imported-map.js";
import type { SourceEventState } from "./source-event-state.js";
import type { SourceStorySnapshot } from "@pokemon-z-battle/multiplayer-protocol";
import type { SourceWorldSnapshot } from "@pokemon-z-battle/multiplayer-protocol";
import { isSourceDayCareEggServicePage, isSourceDayCareServicePage, portSourceRubyCommand } from "./source-script-ports.js";
import type { ImportedMapEvent } from "./imported-map.js";
import { sourceVariablesWithPersonalPokeVial } from "./source-poke-vial.js";

export type GuestSourceEventAccess = "blocked" | "personal" | "transfer";
export type SourceInteractionTarget = "event" | "player" | null;

/** Events erased only for the current map visit are reconstructed from the host actor snapshot. */
export function sourceEventUsesTransientErase(page: ImportedEventPage): boolean {
  return page.commands.some((command) => command.kind === "ruby-script"
    && typeof command.data.source === "string"
    && (/^(?:Kernel\.)?pbEncounter\(EncounterTypes::/u.test(command.data.source.trim())
      || /^(?:Kernel\.)?pbEraseThisEvent$/u.test(command.data.source.trim())));
}

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

/** Refuse un acquittement de l'ancienne carte pendant que l'invité a déjà engagé sa sortie locale. */
export function sourceWorldUpdateIsStaleDuringGuestExcursion(guest: boolean, excursion: boolean,
  presence: "shared" | "away", localMapId: number | null, hostMapId: number): boolean {
  return guest && excursion && presence === "shared" && localMapId !== null && localMapId !== hostMapId;
}

/**
 * Une transition locale de l'hote est la source d'autorite du prochain mapId.
 * Un snapshot recu pendant son chargement peut encore decrire la carte de
 * depart : le rejouer ensuite provoquerait une boucle interieur/exterieur.
 * L'invite, lui, doit toujours consommer le dernier monde differe de l'hote.
 */
export function shouldApplyDeferredSourceWorld(guest: boolean, localMapId: number | null,
  deferredMapId: number): boolean {
  return guest || localMapId === null || localMapId === deferredMapId;
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
    variables: sourceVariablesWithPersonalPokeVial(story.variables, local.variables),
    selfSwitches: story.selfSwitches };
}

/** Keeps personal effects while preventing the host story projection from leaking into the guest save. */
export function sourceStateWithLocalStory(local: SourceEventState, applied: SourceEventState): SourceEventState {
  return { ...applied, switches: local.switches,
    variables: sourceVariablesWithPersonalPokeVial(local.variables, applied.variables),
    selfSwitches: local.selfSwitches };
}

/**
 * Sur la carte partagee, l'invite ne peut lancer que les effets qui concernent
 * explicitement sa propre partie ou une sortie de carte. Les autres sequences
 * narratives restent sous l'autorite de l'hote.
 */
export function guestSourceEventAccess(page: ImportedEventPage): GuestSourceEventAccess {
  if (isSourceDayCareServicePage(page) || isSourceDayCareEggServicePage(page)) return "personal";
  if (personalAchievementPageIds(page).length > 0 || personalAchievementStatisticPage(page)) return "personal";
  const commands = page.commands.map((command) => portSourceRubyCommand(command) ?? command);
  const forbiddenPersonalEffects = new Set([
    "add-pokemon", "request-encounter", "request-trainer-battle", "set-pokedex-enabled", "set-follower",
  ]);
  if (commands.some((command) => forbiddenPersonalEffects.has(command.kind))) return "blocked";
  if (commands.some((command) => command.kind === "transfer-player")) return "transfer";
  if (commands.some((command) => command.kind === "heal-party" || command.kind === "recover-all"
    || command.kind === "open-shop" || command.kind === "open-ranch" || command.kind === "open-day-care"
    || command.kind === "open-day-care-eggs" || command.kind === "open-mining")) return "personal";
  return "blocked";
}

/** State effects retained from a personal service while the host owns the story. */
export function guestSourceStateCommandAllowed(page: ImportedEventPage, kind: string): boolean {
  if (personalAchievementPageIds(page).length > 0 || personalAchievementStatisticPage(page)) {
    return kind === "set-achievement" || kind === "set-variable-from-statistic" || kind === "change-variables";
  }
  return guestSourceEventAccess(page) === "personal"
    && (kind === "heal-party" || kind === "set-checkpoint" || kind === "refill-poke-vial");
}

const ACHIEVEMENT_SERVICE_KINDS = new Set([
  "show-text", "text-continuation", "text-options", "condition", "else", "condition-end", "end",
  "change-variables", "set-switches", "set-self-switch", "label", "jump-label",
]);
const achievementServiceCache = new WeakMap<ImportedEventPage,
  { readonly ids: readonly number[]; readonly statistic: boolean } | null>();

function achievementService(page: ImportedEventPage):
{ readonly ids: readonly number[]; readonly statistic: boolean } | null {
  if (achievementServiceCache.has(page)) return achievementServiceCache.get(page) ?? null;
  const commands = page.commands.map((command) => portSourceRubyCommand(command) ?? command);
  const result = commands.every((command) => ACHIEVEMENT_SERVICE_KINDS.has(command.kind)
    || command.kind === "set-achievement" || command.kind === "set-variable-from-statistic")
    ? { ids: commands.flatMap((command) => command.kind === "set-achievement"
      && Number.isSafeInteger(command.data.achievementId) ? [command.data.achievementId as number] : []),
      statistic: commands.some((command) => command.kind === "set-variable-from-statistic") } : null;
  achievementServiceCache.set(page, result);
  return result;
}

function personalAchievementPageIds(page: ImportedEventPage): number[] {
  return [...(achievementService(page)?.ids ?? [])];
}

function personalAchievementStatisticPage(page: ImportedEventPage): boolean {
  return achievementService(page)?.statistic === true;
}

/** Reopen the personal milestone page even when the host has activated its completed page. */
export function guestPersonalAchievementPage(event: ImportedMapEvent):
{ readonly page: ImportedEventPage; readonly pageIndex: number } | null {
  for (let pageIndex = 0; pageIndex < event.pages.length; pageIndex += 1) {
    const page = event.pages[pageIndex];
    if (page === undefined || page.settings.trigger !== 0) continue;
    const ids = personalAchievementPageIds(page);
    if (ids.length > 0) return { page, pageIndex };
  }
  return null;
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
