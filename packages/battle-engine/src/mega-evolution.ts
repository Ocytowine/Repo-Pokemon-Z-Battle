import type { BattleSide, TeamBattleEvent, TeamBattleState } from "./types.js";

export interface MegaEvolutionDefinition {
  readonly species: string;
  readonly heldItem: string;
  readonly form: number;
}

export type MegaEvolutionFailure = "disabled" | "fainted" | "no-compatible-form"
  | "missing-activation-item" | "already-registered" | "already-used" | "sky-drop";

export interface MegaEvolutionEligibilityInput {
  readonly species: string;
  readonly heldItem: string | null;
  readonly currentForm: number;
  readonly hp: number;
  readonly disabled: boolean;
  readonly ownerKind: "player" | "opponent";
  readonly activationItemAvailable: boolean;
  /** Mirrors Pokemon Z's -1 (available), battler index (registered), -2 (used) states. */
  readonly ownerState: "available" | "registered" | "used";
  readonly skyDropped: boolean;
}

export type MegaEvolutionEligibility =
  | { readonly eligible: true; readonly definition: MegaEvolutionDefinition }
  | { readonly eligible: false; readonly reason: MegaEvolutionFailure };

/** Shared deterministic gate used by the solo adapter and the authoritative Coop room. */
export function megaEvolutionEligibility(definitions: readonly MegaEvolutionDefinition[],
  input: MegaEvolutionEligibilityInput): MegaEvolutionEligibility {
  if (input.disabled) return { eligible: false, reason: "disabled" };
  if (input.hp <= 0) return { eligible: false, reason: "fainted" };
  const definition = input.heldItem === null ? undefined : definitions.find((candidate) =>
    candidate.species === input.species && candidate.heldItem === input.heldItem
      && candidate.form !== input.currentForm);
  if (definition === undefined) return { eligible: false, reason: "no-compatible-form" };
  if (input.ownerKind === "player" && !input.activationItemAvailable) {
    return { eligible: false, reason: "missing-activation-item" };
  }
  if (input.ownerState === "registered") return { eligible: false, reason: "already-registered" };
  if (input.ownerState === "used") return { eligible: false, reason: "already-used" };
  if (input.skyDropped) return { eligible: false, reason: "sky-drop" };
  return { eligible: true, definition };
}

export interface MegaEvolutionIntent {
  readonly side: BattleSide;
  readonly teamIndex: number;
}

export function initializeMegaEvolutionState(state: TeamBattleState,
  owners: Readonly<Record<string, string>> = {}): TeamBattleState {
  const capable = Object.entries(state.teams).flatMap(([side, team]) => team.members
    .filter((member) => member.megaEvolution !== undefined)
    .map((member) => [member.id, owners[member.id] ?? state.megaEvolution?.owners[member.id] ?? side] as const));
  if (capable.length === 0) return state;
  return { ...state, megaEvolution: { owners: Object.fromEntries(capable),
    usedOwnerIds: [...(state.megaEvolution?.usedOwnerIds ?? [])] } };
}

/** Rebinds public battle members to their authoritative Coop owners without changing usage. */
export function bindMegaEvolutionOwners(state: TeamBattleState,
  owners: Readonly<Record<string, string>>): TeamBattleState {
  const current = initializeMegaEvolutionState(state, owners);
  if (current.megaEvolution === undefined) return current;
  return { ...current, megaEvolution: { ...current.megaEvolution,
    owners: Object.fromEntries(Object.keys(current.megaEvolution.owners)
      .map((id) => [id, owners[id] ?? current.megaEvolution!.owners[id]!] as const)) } };
}

/** Applies valid intentions before move ordering. Invalid/stale intentions are safe no-ops. */
export function resolveMegaEvolutionIntents(state: TeamBattleState,
  intents: readonly MegaEvolutionIntent[]): { readonly state: TeamBattleState;
    readonly events: readonly TeamBattleEvent[] } {
  let next = initializeMegaEvolutionState(state);
  if (next.megaEvolution === undefined || intents.length === 0) return { state: next, events: [] };
  const used = new Set(next.megaEvolution.usedOwnerIds);
  const events: TeamBattleEvent[] = [];
  let teams = next.teams;
  for (const intent of intents) {
    const team = teams[intent.side];
    const pokemon = team.members[intent.teamIndex];
    const target = pokemon?.megaEvolution;
    if (pokemon === undefined || target === undefined || pokemon.hp <= 0 || !target.activationAvailable
      || pokemon.appearance?.form === target.form) continue;
    const ownerId = next.megaEvolution.owners[pokemon.id] ?? intent.side;
    if (used.has(ownerId)) continue;
    const damage = pokemon.stats.maxHp - pokemon.hp;
    const transformed = { ...pokemon, stats: { ...target.stats }, types: [...target.types], ability: target.ability,
      hp: Math.max(0, Math.min(target.stats.maxHp, target.stats.maxHp - damage)),
      appearance: { form: target.form, shiny: pokemon.appearance?.shiny ?? false,
        gender: pokemon.appearance?.gender ?? null } };
    teams = { ...teams, [intent.side]: { ...team, members: team.members.map((member, index) =>
      index === intent.teamIndex ? transformed : member) } };
    used.add(ownerId);
    events.push({ type: "megaEvolved", side: intent.side, teamIndex: intent.teamIndex,
      pokemonId: pokemon.id, fromForm: pokemon.appearance?.form ?? 0, toForm: target.form,
      heldItem: target.heldItem });
  }
  next = { ...next, teams, megaEvolution: { ...next.megaEvolution, usedOwnerIds: [...used] } };
  return { state: next, events };
}
