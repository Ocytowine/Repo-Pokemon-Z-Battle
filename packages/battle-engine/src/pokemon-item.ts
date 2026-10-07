import type { BattlerState, MajorStatusState } from "./types.js";

export type PokemonItemUseFailure = "unsupported-item" | "no-effect" | "revival-disabled"
  | "battle-healing-disabled";

export interface PokemonItemUsePolicy {
  readonly context: "field" | "battle";
  readonly revivalAllowed: boolean;
  readonly battleHealingAllowed?: boolean;
}

export interface PokemonItemUseEffect {
  readonly hpRestored: number;
  readonly statusCured: MajorStatusState["kind"] | null;
  readonly revived: boolean;
}

type ItemEffect =
  | { readonly kind: "heal-hp"; readonly amount: number | "full" | "quarter";
    readonly battleAmount?: number | "full" | "quarter" }
  | { readonly kind: "cure-status"; readonly status: MajorStatusState["kind"] | "all" }
  | { readonly kind: "full-restore" }
  | { readonly kind: "revive"; readonly amount: "half" | "full" };

const ITEM_EFFECTS = new Map<string, ItemEffect>();

function register(items: readonly string[], effect: ItemEffect): void {
  for (const item of items) ITEM_EFFECTS.set(item, effect);
}

register(["POTION"], { kind: "heal-hp", amount: 20 });
register(["SUPERPOTION"], { kind: "heal-hp", amount: 50 });
register(["HYPERPOTION"], { kind: "heal-hp", amount: 150 });
register(["MAXPOTION"], { kind: "heal-hp", amount: "full" });
register(["BERRYJUICE", "RAGECANDYBAR"], { kind: "heal-hp", amount: 20 });
register(["SWEETHEART"], { kind: "heal-hp", amount: 150, battleAmount: 20 });
register(["FRESHWATER"], { kind: "heal-hp", amount: 50 });
register(["SODAPOP", "MOOMOOMILK"], { kind: "heal-hp", amount: 100 });
register(["LEMONADE"], { kind: "heal-hp", amount: 150 });
register(["ORANBERRY"], { kind: "heal-hp", amount: 10 });
register(["SITRUSBERRY"], { kind: "heal-hp", amount: "quarter" });
register(["AWAKENING", "CHESTOBERRY", "BLUEFLUTE", "POKEFLUTE"],
  { kind: "cure-status", status: "sleep" });
register(["VENDAJE"], { kind: "cure-status", status: "hemorrhage" });
register(["ANTIDOTE", "PECHABERRY"], { kind: "cure-status", status: "poison" });
register(["BURNHEAL", "RAWSTBERRY"], { kind: "cure-status", status: "burn" });
register(["PARLYZHEAL", "PARALYZEHEAL", "CHERIBERRY"], { kind: "cure-status", status: "paralysis" });
register(["ICEHEAL", "ASPEARBERRY"], { kind: "cure-status", status: "frozen" });
register(["FULLHEAL", "LAVACOOKIE", "OLDGATEAU", "CASTELIACONE", "LUMIOSEGALETTE",
  "SHALOURSABLE", "LUMBERRY"], { kind: "cure-status", status: "all" });
register(["FULLRESTORE"], { kind: "full-restore" });
register(["REVIVE"], { kind: "revive", amount: "half" });
register(["MAXREVIVE"], { kind: "revive", amount: "full" });

export function isPokemonItemUseSupported(item: string): boolean {
  return ITEM_EFFECTS.has(item);
}

function healingAmount(pokemon: Pick<BattlerState, "hp" | "stats">,
  amount: number | "full" | "quarter"): number {
  if (amount === "full") return pokemon.stats.maxHp - pokemon.hp;
  if (amount === "quarter") return Math.floor(pokemon.stats.maxHp / 4);
  return amount;
}

/** Pure item-effect kernel shared by field saves, local battles and the authoritative room. */
export function applyPokemonItemEffect<T extends Pick<BattlerState, "hp" | "stats" | "majorStatus">>(
  pokemon: T, item: string, policy: PokemonItemUsePolicy,
): { readonly pokemon: T; readonly effect: PokemonItemUseEffect } | PokemonItemUseFailure {
  const definition = ITEM_EFFECTS.get(item);
  if (definition === undefined) return "unsupported-item";
  if (policy.context === "battle" && policy.battleHealingAllowed === false) return "battle-healing-disabled";
  if (definition.kind === "heal-hp") {
    if (pokemon.hp <= 0 || pokemon.hp >= pokemon.stats.maxHp) return "no-effect";
    const configured = policy.context === "battle" && definition.battleAmount !== undefined
      ? definition.battleAmount : definition.amount;
    const hpRestored = Math.min(pokemon.stats.maxHp - pokemon.hp,
      Math.max(1, healingAmount(pokemon, configured)));
    return { pokemon: { ...pokemon, hp: pokemon.hp + hpRestored },
      effect: { hpRestored, statusCured: null, revived: false } };
  }
  if (definition.kind === "cure-status") {
    if (pokemon.hp <= 0 || pokemon.majorStatus === null
      || definition.status !== "all" && pokemon.majorStatus.kind !== definition.status) return "no-effect";
    return { pokemon: { ...pokemon, majorStatus: null },
      effect: { hpRestored: 0, statusCured: pokemon.majorStatus.kind, revived: false } };
  }
  if (definition.kind === "full-restore") {
    if (pokemon.hp <= 0 || pokemon.hp >= pokemon.stats.maxHp && pokemon.majorStatus === null) return "no-effect";
    const hpRestored = pokemon.stats.maxHp - pokemon.hp;
    return { pokemon: { ...pokemon, hp: pokemon.stats.maxHp, majorStatus: null },
      effect: { hpRestored, statusCured: pokemon.majorStatus?.kind ?? null, revived: false } };
  }
  if (!policy.revivalAllowed) return "revival-disabled";
  if (pokemon.hp > 0) return "no-effect";
  const hp = definition.amount === "full" ? pokemon.stats.maxHp : Math.max(1, Math.floor(pokemon.stats.maxHp / 2));
  return { pokemon: { ...pokemon, hp, majorStatus: null },
    effect: { hpRestored: hp, statusCured: pokemon.majorStatus?.kind ?? null, revived: true } };
}
