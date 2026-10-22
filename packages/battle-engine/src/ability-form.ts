import { ordinaryWeather } from "./ability-weather.js";
import type { BattleEffects, BattleEvent, BattleSide, BattlerState } from "./types.js";

const CASTFORM_BY_WEATHER = {
  sun: { form: 1, type: "FIRE" }, rain: { form: 2, type: "WATER" },
  hail: { form: 3, type: "ICE" }, sand: { form: 4, type: "ROCK" },
} as const;

const ARCEUS_PLATES: Readonly<Record<string, { readonly form: number; readonly type: string }>> = {
  FISTPLATE: { form: 1, type: "FIGHTING" }, SKYPLATE: { form: 2, type: "FLYING" },
  TOXICPLATE: { form: 3, type: "POISON" }, EARTHPLATE: { form: 4, type: "GROUND" },
  STONEPLATE: { form: 5, type: "ROCK" }, INSECTPLATE: { form: 6, type: "BUG" },
  SPOOKYPLATE: { form: 7, type: "GHOST" }, IRONPLATE: { form: 8, type: "STEEL" },
  FLAMEPLATE: { form: 10, type: "FIRE" }, SPLASHPLATE: { form: 11, type: "WATER" },
  MEADOWPLATE: { form: 12, type: "GRASS" }, ZAPPLATE: { form: 13, type: "ELECTRIC" },
  MINDPLATE: { form: 14, type: "PSYCHIC" }, ICICLEPLATE: { form: 15, type: "ICE" },
  DRACOPLATE: { form: 16, type: "DRAGON" }, DREADPLATE: { form: 17, type: "DARK" },
  PIXIEPLATE: { form: 18, type: "FAIRY" }, TABLANEUTRA: { form: 0, type: "NORMAL" },
};

function changeForm(battler: BattlerState, side: BattleSide, form: number,
  types: readonly string[], stats = battler.stats): { readonly battler: BattlerState; readonly events: readonly BattleEvent[] } {
  const previousForm = battler.appearance?.form ?? 0;
  if (previousForm === form && battler.types.length === types.length
    && battler.types.every((type, index) => type === types[index])) return { battler, events: [] };
  const volatile = battler.volatile;
  const next = { ...battler, types: [...types], stats: { ...stats }, appearance: {
    form, shiny: battler.appearance?.shiny ?? false, gender: battler.appearance?.gender ?? null,
  }, volatile: {
    confusionTurns: 0, flinched: false, focusEnergy: 0, identified: false,
    disabledMove: null, disableTurns: 0, encoreMove: null, encoreTurns: 0,
    bindingMove: null, bindingTurns: 0, cursed: false, lastMoveUsed: null,
    ...(volatile ?? {}), originalForm: volatile?.originalForm ?? previousForm,
    originalTypes: volatile?.originalTypes ?? battler.types,
    originalStats: volatile?.originalStats ?? battler.stats,
  } };
  return { battler: next, events: [{ type: "formChanged", side, species: battler.species,
    fromForm: previousForm, toForm: form, reason: "ability" }] };
}

export function reconcileAbilityForm(battler: BattlerState, side: BattleSide,
  weather: BattleEffects["weather"], abilitySuppressed = false): { readonly battler: BattlerState; readonly events: readonly BattleEvent[] } {
  if (battler.hp <= 0) return { battler, events: [] };
  const current = ordinaryWeather(weather);
  if (battler.species === "CASTFORM") {
    const target = !abilitySuppressed && battler.ability === "FORECAST" && current !== null ? CASTFORM_BY_WEATHER[current] : undefined;
    return changeForm(battler, side, target?.form ?? 0, [target?.type ?? "NORMAL"]);
  }
  if (battler.species === "GRENINJA" && ![2, 3, 4].includes(battler.appearance?.form ?? 0)) {
    const form = !abilitySuppressed && battler.ability === "FORMAILUSORIA"
      && battler.hp > battler.stats.maxHp / 1.5 ? 1 : 0;
    return changeForm(battler, side, form, battler.volatile?.originalTypes ?? battler.types);
  }
  if (battler.species === "DARMANITAN") {
    const form = !abilitySuppressed && battler.ability === "ZENMODE"
      && battler.hp <= Math.floor(battler.stats.maxHp / 2) ? 1 : 0;
    const baseTypes = battler.volatile?.originalTypes ?? battler.types.filter((type) => type !== "ICE");
    return changeForm(battler, side, form, form === 1 ? [...baseTypes, "ICE"] : baseTypes);
  }
  if (battler.species === "ARCEUS") {
    // Pokemon Z derives Arceus's persistent form directly from the raw ability/item pair,
    // rather than hasWorkingAbility, so Neutralizing Gas does not reset it.
    const plate = battler.ability === "MULTITYPE" && battler.heldItem !== null
      ? ARCEUS_PLATES[battler.heldItem] : undefined;
    return changeForm(battler, side, plate?.form ?? 0, [plate?.type ?? "NORMAL"]);
  }
  return { battler, events: [] };
}

/** Stance Change is evaluated when the move is attempted, before its success checks. */
export function applyStanceChange(battler: BattlerState, side: BattleSide,
  move: { readonly internalName: string; readonly category: string }, abilitySuppressed = false) {
  if (abilitySuppressed || battler.hp <= 0 || battler.species !== "AEGISLASH"
    || battler.ability !== "STANCECHANGE") return { battler, events: [] as readonly BattleEvent[] };
  const currentForm = battler.appearance?.form ?? 0;
  const targetForm = move.category !== "Status" ? 1 : move.internalName === "KINGSSHIELD" ? 0 : currentForm;
  if (targetForm === currentForm) return { battler, events: [] as readonly BattleEvent[] };
  const original = battler.volatile?.originalStats ?? battler.stats;
  const stats = targetForm === 1 ? { ...original, attack: original.defense, defense: original.attack,
    specialAttack: original.specialDefense, specialDefense: original.specialAttack } : original;
  return changeForm(battler, side, targetForm, battler.types, stats);
}

export function restoreAbilityForm(battler: BattlerState): BattlerState {
  const originalForm = battler.volatile?.originalForm;
  const originalTypes = battler.volatile?.originalTypes;
  const originalStats = battler.volatile?.originalStats;
  if (originalForm == null && originalTypes == null && originalStats == null) return battler;
  return { ...battler,
    ...(originalTypes == null ? {} : { types: [...originalTypes] }),
    ...(originalStats == null ? {} : { stats: { ...originalStats } }),
    ...(originalForm == null ? {} : { appearance: {
      form: originalForm, shiny: battler.appearance?.shiny ?? false,
      gender: battler.appearance?.gender ?? null,
    } }) };
}
