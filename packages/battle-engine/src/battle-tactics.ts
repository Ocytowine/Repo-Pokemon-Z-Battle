import { activeBattlers, replaceFaintedPokemon, resolveTeamTurn } from "./team-battle.js";
import { applyPokemonItemEffect } from "./pokemon-item.js";
import { heldItemIsActive } from "./ability-item-control.js";
import type { BattleSide, RandomSource, TeamBattleAction, TeamBattleState, TeamTurnResult } from "./types.js";

const TRAINER_HP_ITEMS = new Set(["POTION", "SUPERPOTION", "HYPERPOTION", "MAXPOTION", "MOOMOOMILK", "FULLRESTORE"]);

function chooseSourceTrainerItem(state: TeamBattleState, side: BattleSide, activeSlot: number,
  rng: RandomSource): TeamBattleAction | null {
  const team = state.teams[side];
  const targetTeamIndex = team.activeIndices?.[activeSlot] ?? (activeSlot === 0 ? team.activeIndex : undefined);
  const active = targetTeamIndex === undefined ? undefined : team.members[targetTeamIndex];
  if (targetTeamIndex === undefined || active === undefined || active.hp <= 0 || active.hp >= active.stats.maxHp) return null;
  const itemId = team.items?.find((item) => TRAINER_HP_ITEMS.has(item)
    && typeof applyPokemonItemEffect(active, item, { context: "battle", revivalAllowed: true }) !== "string");
  if (itemId === undefined) return null;
  const quarter = active.hp <= Math.floor(active.stats.maxHp / 4);
  const half = active.hp <= Math.floor(active.stats.maxHp / 2);
  if (!quarter && (!half || rng.nextInt(10) >= 3)) return null;
  return { kind: "item", itemId, targetTeamIndex };
}

/**
 * Chooses an action for a source-controlled active Pokemon. The caller supplies
 * the authoritative RNG, so solo and room play consume the same decision rule.
 */
export function chooseSourceBattleAction(state: TeamBattleState, side: BattleSide,
  rng: RandomSource, activeSlot = 0, allowTrainerItem = true): TeamBattleAction {
  if (state.status !== "active" || state.replacementRequired.length > 0) {
    throw new Error("L'IA ne peut pas choisir d'action dans cet état de combat.");
  }
  const team = state.teams[side];
  const activeIndex = team.activeIndices?.[activeSlot] ?? (activeSlot === 0 ? team.activeIndex : undefined);
  const active = activeIndex === undefined ? undefined : team.members[activeIndex];
  if (active === undefined) throw new Error("Le Pokemon controle par l'IA est absent de cet emplacement.");
  const item = allowTrainerItem ? chooseSourceTrainerItem(state, side, activeSlot, rng) : null;
  if (item !== null) return item;
  const disabledMove = active.volatile?.disableTurns && active.volatile.disableTurns > 0
    ? active.volatile.disabledMove : null;
  const encoreMove = active.volatile?.encoreTurns && active.volatile.encoreTurns > 0
    ? active.volatile.encoreMove : null;
  const moves = active.moves.map((slot, moveIndex) => ({ slot, moveIndex }))
    .filter(({ slot }) => slot.pp > 0 && slot.move.internalName !== disabledMove
      && (encoreMove === null || slot.move.internalName === encoreMove)
      && !(active.volatile?.tauntTurns && active.volatile.tauntTurns > 0 && slot.move.category === "Status")
      && !(slot.move.functionCode === "012" && (active.volatile?.activeTurns ?? 0) > 0));
  if (moves.length === 0) throw new Error("Le Pokémon contrôlé par l'IA n'a plus de capacité disponible.");
  const selected = moves[rng.nextInt(moves.length)];
  if (selected === undefined) throw new Error("Le Pokémon contrôlé par l'IA n'a plus de capacité disponible.");
  const megaOwner = state.megaEvolution?.owners[active.id] ?? side;
  const megaEvolution = active.megaEvolution !== undefined && active.megaEvolution.activationAvailable
    && active.appearance?.form !== active.megaEvolution.form
    && !state.megaEvolution?.usedOwnerIds.includes(megaOwner);
  return { kind: "move", moveIndex: selected.moveIndex, ...(megaEvolution ? { megaEvolution: true as const } : {}) };
}

/** Chooses a deterministic valid reserve, optionally restricted to one owner. */
export function chooseSourceBattleReplacement(state: TeamBattleState, side: BattleSide,
  eligibleTeamIndices?: readonly number[]): number {
  if (!state.replacementRequired.includes(side)) throw new Error(`Aucun remplacement n'est requis pour ${side}.`);
  const allowed = eligibleTeamIndices === undefined ? null : new Set(eligibleTeamIndices);
  const team = state.teams[side];
  const replacement = team.members.findIndex((member, index) => index !== team.activeIndex && member.hp > 0
    && (allowed === null || allowed.has(index)));
  if (replacement < 0) throw new Error(`Aucun remplaçant contrôlable n'est disponible pour ${side}.`);
  return replacement;
}

export type BattleEscapeResult = { readonly escaped: true }
  | { readonly escaped: false; readonly turn: TeamTurnResult };

export function canEscapeSourceBattle(state: TeamBattleState, attempts: number, rng: RandomSource): boolean {
  if (!Number.isSafeInteger(attempts) || attempts < 0) throw new Error("Nombre de tentatives de fuite invalide.");
  if (state.status !== "active") {
    throw new Error("La fuite n'est pas disponible dans cet état de combat.");
  }
  // Une rencontre sauvage ne doit jamais choisir automatiquement le prochain
  // Pokémon du joueur. Depuis l'écran de remplacement, Fuite est une sortie
  // garantie : aucun adversaire ne peut attaquer un emplacement déjà K.O.
  if (state.replacementRequired.length > 0 || (state.slotReplacements?.length ?? 0) > 0) return true;
  const battlers = activeBattlers(state);
  if (battlers.player.types.includes("GHOST")) return true;
  if (battlers.player.heldItem === "SMOKEBALL"
    && heldItemIsActive(battlers.player, state.effects?.magicRoomTurns ?? 0)) return true;
  if (battlers.player.ability === "RUNAWAY") return true;
  const rate = battlers.player.stats.speed > battlers.opponent.stats.speed ? 256
    : (Math.floor((battlers.player.stats.speed * 128) / Math.max(1, battlers.opponent.stats.speed))
      + attempts * 30) & 0xff;
  return rate === 256 || rng.nextInt(256) < rate;
}

/** Pokemon Z/Essentials-style escape check, shared by the local and room adapters. */
export function attemptSourceBattleEscape(state: TeamBattleState, attempts: number,
  rng: RandomSource): BattleEscapeResult {
  if (canEscapeSourceBattle(state, attempts, rng)) return { escaped: true };
  return { escaped: false, turn: resolveTeamTurn(state, {
    player: { kind: "wait" }, opponent: chooseSourceBattleAction(state, "opponent", rng),
  }, rng) };
}

/** Applies replacements when every required camp is source-controlled. */
export function applySourceBattleReplacements(state: TeamBattleState,
  replacements: Readonly<Partial<Record<BattleSide, number>>>): TeamBattleState {
  return replaceFaintedPokemon(state, replacements).state;
}
