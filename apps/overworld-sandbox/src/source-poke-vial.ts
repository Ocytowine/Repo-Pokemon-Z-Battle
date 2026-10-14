import { healPlayerParty } from "@pokemon-z-battle/player-state";
import type { ImportedEventPage } from "./imported-map.js";
import type { SourceEventState } from "./source-event-state.js";

type EventCommand = ImportedEventPage["commands"][number];

export const SOURCE_POKE_VIAL_ITEM_ID = "POKEVIAL";
export const SOURCE_POKE_VIAL_CURRENT_VARIABLE_ID = 238;
export const SOURCE_POKE_VIAL_MAX_VARIABLE_ID = 239;
export const SOURCE_POKE_VIAL_MAX_CHARGES = 5;

export interface SourcePokeVialState {
  readonly current: number;
  readonly maximum: number;
}

export interface SourcePokeVialStatus extends SourcePokeVialState {
  readonly owned: boolean;
  readonly canUse: boolean;
}

export interface SourcePokeVialUseResult {
  readonly ok: boolean;
  readonly reason: "missing" | "empty" | null;
  readonly state: SourceEventState;
}

function charge(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

export function sourcePokeVialStatus(state: Pick<SourceEventState, "inventory" | "variables" | "pokeVial">): SourcePokeVialStatus {
  const owned = (state.inventory[SOURCE_POKE_VIAL_ITEM_ID] ?? 0) > 0;
  const storedMaximum = charge(state.variables[String(SOURCE_POKE_VIAL_MAX_VARIABLE_ID)])
    ?? charge(state.pokeVial.maximum) ?? 0;
  const maximum = Math.min(SOURCE_POKE_VIAL_MAX_CHARGES,
    owned && storedMaximum === 0 ? 1 : storedMaximum);
  const storedCurrent = charge(state.variables[String(SOURCE_POKE_VIAL_CURRENT_VARIABLE_ID)]);
  const current = Math.min(maximum, storedCurrent ?? (owned && state.pokeVial.maximum === 0
    ? maximum : charge(state.pokeVial.current) ?? maximum));
  return { owned, current, maximum, canUse: owned && current > 0 };
}

/** Maintient le contrat explicite et les variables historiques de Pokemon Z en phase. */
export function reconcileSourcePokeVial(state: SourceEventState): SourceEventState {
  const vial = sourcePokeVialStatus(state);
  if (!vial.owned && vial.current === state.pokeVial.current && vial.maximum === state.pokeVial.maximum) return state;
  const variables = vial.owned ? { ...state.variables,
    [String(SOURCE_POKE_VIAL_CURRENT_VARIABLE_ID)]: vial.current,
    [String(SOURCE_POKE_VIAL_MAX_VARIABLE_ID)]: vial.maximum } : state.variables;
  return { ...state, variables, pokeVial: { current: vial.current, maximum: vial.maximum } };
}

export function refillSourcePokeVial(state: SourceEventState): SourceEventState {
  const vial = sourcePokeVialStatus(state);
  if (!vial.owned) return state;
  return { ...state, variables: { ...state.variables,
    [String(SOURCE_POKE_VIAL_CURRENT_VARIABLE_ID)]: vial.maximum,
    [String(SOURCE_POKE_VIAL_MAX_VARIABLE_ID)]: vial.maximum },
  pokeVial: { current: vial.maximum, maximum: vial.maximum } };
}

export function useSourcePokeVial(state: SourceEventState): SourcePokeVialUseResult {
  const vial = sourcePokeVialStatus(state);
  if (!vial.owned) return { ok: false, reason: "missing", state };
  if (!vial.canUse) return { ok: false, reason: "empty", state };
  const current = vial.current - 1;
  return { ok: true, reason: null, state: { ...state, party: healPlayerParty(state.party),
    variables: { ...state.variables, [String(SOURCE_POKE_VIAL_CURRENT_VARIABLE_ID)]: current,
      [String(SOURCE_POKE_VIAL_MAX_VARIABLE_ID)]: vial.maximum },
    pokeVial: { current, maximum: vial.maximum } } };
}

/** Reconnait uniquement la recharge exacte ecrite par les Centres Pokemon de Z. */
export function portSourcePokeVialCommand(source: EventCommand): EventCommand | null {
  if (source.kind !== "change-variables" || source.data.firstId !== SOURCE_POKE_VIAL_CURRENT_VARIABLE_ID
    || source.data.lastId !== SOURCE_POKE_VIAL_CURRENT_VARIABLE_ID || source.data.operation !== "set") return null;
  const operand = source.data.operand;
  if (typeof operand !== "object" || operand === null || Array.isArray(operand)) return null;
  const values = (operand as { readonly values?: unknown }).values;
  if ((operand as { readonly kind?: unknown }).kind !== "variable" || !Array.isArray(values)
    || values.length !== 1 || values[0] !== SOURCE_POKE_VIAL_MAX_VARIABLE_ID) return null;
  return { kind: "refill-poke-vial", text: null, indent: source.indent, data: { policy: "PERSONAL" } };
}

export function sourceStoryVariables(variables: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
  const shared = { ...variables };
  delete shared[String(SOURCE_POKE_VIAL_CURRENT_VARIABLE_ID)];
  delete shared[String(SOURCE_POKE_VIAL_MAX_VARIABLE_ID)];
  return shared;
}

export function sourceVariablesWithPersonalPokeVial(shared: Readonly<Record<string, number>>,
  local: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
  const variables = { ...shared };
  for (const id of [SOURCE_POKE_VIAL_CURRENT_VARIABLE_ID, SOURCE_POKE_VIAL_MAX_VARIABLE_ID]) {
    const value = local[String(id)];
    if (value !== undefined) variables[String(id)] = value;
  }
  return variables;
}
