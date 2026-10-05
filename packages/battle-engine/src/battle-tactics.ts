import { activeBattlers, replaceFaintedPokemon, resolveTeamTurn } from "./team-battle.js";
import type { BattleSide, RandomSource, TeamBattleAction, TeamBattleState, TeamTurnResult } from "./types.js";

/**
 * Chooses an action for a source-controlled active Pokemon. The caller supplies
 * the authoritative RNG, so solo and room play consume the same decision rule.
 */
export function chooseSourceBattleAction(state: TeamBattleState, side: BattleSide,
  rng: RandomSource): TeamBattleAction {
  if (state.status !== "active" || state.replacementRequired.length > 0) {
    throw new Error("L'IA ne peut pas choisir d'action dans cet état de combat.");
  }
  const active = activeBattlers(state)[side];
  const moves = active.moves.map((slot, moveIndex) => ({ slot, moveIndex })).filter(({ slot }) => slot.pp > 0);
  if (moves.length === 0) throw new Error("Le Pokémon contrôlé par l'IA n'a plus de capacité disponible.");
  const selected = moves[rng.nextInt(moves.length)];
  if (selected === undefined) throw new Error("Le Pokémon contrôlé par l'IA n'a plus de capacité disponible.");
  return { kind: "move", moveIndex: selected.moveIndex };
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
  if (state.status !== "active" || state.replacementRequired.length > 0) {
    throw new Error("La fuite n'est pas disponible dans cet état de combat.");
  }
  const battlers = activeBattlers(state);
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
