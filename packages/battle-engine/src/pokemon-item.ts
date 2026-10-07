import type { BattleStat, BattlerState, MajorStatusState } from "./types.js";

export type PokemonItemUseFailure = "unsupported-item" | "no-effect" | "revival-disabled"
  | "battle-healing-disabled";

export interface PokemonItemUsePolicy {
  readonly context: "field" | "battle";
  readonly revivalAllowed: boolean;
  readonly battleHealingAllowed?: boolean;
}

export interface PokemonItemUseEffect {
  readonly hpRestored: number;
  readonly ppRestored: number;
  readonly movePp: readonly number[] | null;
  readonly targetMoveIndex: number | null;
  readonly statusCured: MajorStatusState["kind"] | null;
  readonly revived: boolean;
  readonly statRaised: BattleStat | null;
  readonly stagesRaised: number;
}

export type PokemonItemTargetMode = "pokemon" | "move" | "active";

type ItemEffect =
  | { readonly kind: "heal-hp"; readonly amount: number | "full" | "quarter";
    readonly battleAmount?: number | "full" | "quarter" }
  | { readonly kind: "cure-status"; readonly status: MajorStatusState["kind"] | "all" }
  | { readonly kind: "full-restore" }
  | { readonly kind: "revive"; readonly amount: "half" | "full" }
  | { readonly kind: "restore-pp"; readonly amount: number | "full"; readonly allMoves: boolean }
  | { readonly kind: "raise-stage"; readonly stat: BattleStat; readonly amount: number };

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
register(["ETHER", "LEPPABERRY"], { kind: "restore-pp", amount: 10, allMoves: false });
register(["MAXETHER"], { kind: "restore-pp", amount: "full", allMoves: false });
register(["ELIXIR"], { kind: "restore-pp", amount: 10, allMoves: true });
register(["MAXELIXIR"], { kind: "restore-pp", amount: "full", allMoves: true });

function registerStages(items: readonly string[], stat: BattleStat, amount: number): void {
  register(items, { kind: "raise-stage", stat, amount });
}

registerStages(["XATTACK"], "attack", 1);
registerStages(["XATTACK2"], "attack", 2);
registerStages(["XATTACK3"], "attack", 3);
registerStages(["XATTACK6"], "attack", 6);
registerStages(["XDEFEND", "XDEFENSE"], "defense", 1);
registerStages(["XDEFEND2", "XDEFENSE2"], "defense", 2);
registerStages(["XDEFEND3", "XDEFENSE3"], "defense", 3);
registerStages(["XDEFEND6", "XDEFENSE6"], "defense", 6);
registerStages(["XSPECIAL", "XSPATK"], "specialAttack", 1);
registerStages(["XSPECIAL2", "XSPATK2"], "specialAttack", 2);
registerStages(["XSPECIAL3", "XSPATK3"], "specialAttack", 3);
registerStages(["XSPECIAL6", "XSPATK6"], "specialAttack", 6);
registerStages(["XSPDEF"], "specialDefense", 1);
registerStages(["XSPDEF2"], "specialDefense", 2);
registerStages(["XSPDEF3"], "specialDefense", 3);
registerStages(["XSPDEF6"], "specialDefense", 6);
registerStages(["XSPEED"], "speed", 1);
registerStages(["XSPEED2"], "speed", 2);
registerStages(["XSPEED3"], "speed", 3);
registerStages(["XSPEED6"], "speed", 6);
registerStages(["XACCURACY"], "accuracy", 1);
registerStages(["XACCURACY2"], "accuracy", 2);
registerStages(["XACCURACY3"], "accuracy", 3);
registerStages(["XACCURACY6"], "accuracy", 6);

export function isPokemonItemUseSupported(item: string): boolean {
  return ITEM_EFFECTS.has(item);
}

export function pokemonItemTargetMode(item: string): PokemonItemTargetMode | null {
  const definition = ITEM_EFFECTS.get(item);
  if (definition === undefined) return null;
  if (definition.kind === "raise-stage") return "active";
  return definition.kind === "restore-pp" && !definition.allMoves ? "move" : "pokemon";
}

export function isPokemonItemUsableInField(item: string): boolean {
  return pokemonItemTargetMode(item) !== "active" && ITEM_EFFECTS.has(item);
}

function healingAmount(pokemon: Pick<BattlerState, "hp" | "stats">,
  amount: number | "full" | "quarter"): number {
  if (amount === "full") return pokemon.stats.maxHp - pokemon.hp;
  if (amount === "quarter") return Math.floor(pokemon.stats.maxHp / 4);
  return amount;
}

type PokemonItemMoveSlot = { readonly pp: number; readonly maxPp?: number;
  readonly move?: { readonly pp: number } };
type PokemonItemState = Pick<BattlerState, "hp" | "stats" | "majorStatus">
  & { readonly moves?: readonly PokemonItemMoveSlot[]; readonly stages?: BattlerState["stages"] };

function emptyEffect(): PokemonItemUseEffect {
  return { hpRestored: 0, ppRestored: 0, movePp: null, targetMoveIndex: null, statusCured: null,
    revived: false, statRaised: null, stagesRaised: 0 };
}

function maximumPp(slot: PokemonItemMoveSlot): number {
  return slot.maxPp ?? slot.move?.pp ?? slot.pp;
}

/** Pure item-effect kernel shared by field saves, local battles and the authoritative room. */
export function applyPokemonItemEffect<T extends PokemonItemState>(
  pokemon: T, item: string, policy: PokemonItemUsePolicy, targetMoveIndex?: number,
): { readonly pokemon: T; readonly effect: PokemonItemUseEffect } | PokemonItemUseFailure {
  const definition = ITEM_EFFECTS.get(item);
  if (definition === undefined) return "unsupported-item";
  if (policy.context === "field" && definition.kind === "raise-stage") return "unsupported-item";
  if (policy.context === "battle" && policy.battleHealingAllowed === false
    && definition.kind !== "raise-stage") return "battle-healing-disabled";
  if (definition.kind === "heal-hp") {
    if (pokemon.hp <= 0 || pokemon.hp >= pokemon.stats.maxHp) return "no-effect";
    const configured = policy.context === "battle" && definition.battleAmount !== undefined
      ? definition.battleAmount : definition.amount;
    const hpRestored = Math.min(pokemon.stats.maxHp - pokemon.hp,
      Math.max(1, healingAmount(pokemon, configured)));
    return { pokemon: { ...pokemon, hp: pokemon.hp + hpRestored },
      effect: { ...emptyEffect(), hpRestored } };
  }
  if (definition.kind === "cure-status") {
    if (pokemon.hp <= 0 || pokemon.majorStatus === null
      || definition.status !== "all" && pokemon.majorStatus.kind !== definition.status) return "no-effect";
    return { pokemon: { ...pokemon, majorStatus: null },
      effect: { ...emptyEffect(), statusCured: pokemon.majorStatus.kind } };
  }
  if (definition.kind === "full-restore") {
    if (pokemon.hp <= 0 || pokemon.hp >= pokemon.stats.maxHp && pokemon.majorStatus === null) return "no-effect";
    const hpRestored = pokemon.stats.maxHp - pokemon.hp;
    return { pokemon: { ...pokemon, hp: pokemon.stats.maxHp, majorStatus: null },
      effect: { ...emptyEffect(), hpRestored, statusCured: pokemon.majorStatus?.kind ?? null } };
  }
  if (definition.kind === "revive") {
    if (!policy.revivalAllowed) return "revival-disabled";
    if (pokemon.hp > 0) return "no-effect";
    const hp = definition.amount === "full" ? pokemon.stats.maxHp : Math.max(1, Math.floor(pokemon.stats.maxHp / 2));
    return { pokemon: { ...pokemon, hp, majorStatus: null },
      effect: { ...emptyEffect(), hpRestored: hp, statusCured: pokemon.majorStatus?.kind ?? null, revived: true } };
  }
  if (definition.kind === "restore-pp") {
    if (pokemon.moves === undefined || pokemon.hp <= 0) return "no-effect";
    const indices = definition.allMoves ? pokemon.moves.map((_, index) => index) : [targetMoveIndex ?? -1];
    if (indices.some((index) => !Number.isInteger(index) || index < 0 || index >= pokemon.moves!.length)) return "no-effect";
    let ppRestored = 0;
    const moves = pokemon.moves.map((slot, index) => {
      if (!indices.includes(index)) return slot;
      const maximum = maximumPp(slot);
      const restored = Math.min(maximum - slot.pp, definition.amount === "full" ? maximum : definition.amount);
      ppRestored += Math.max(0, restored);
      return restored <= 0 ? slot : { ...slot, pp: slot.pp + restored };
    });
    if (ppRestored <= 0) return "no-effect";
    return { pokemon: { ...pokemon, moves } as T,
      effect: { ...emptyEffect(), ppRestored, movePp: moves.map((slot) => slot.pp),
        targetMoveIndex: definition.allMoves ? null : targetMoveIndex! } };
  }
  if (pokemon.stages === undefined || pokemon.hp <= 0) return "no-effect";
  const previous = pokemon.stages[definition.stat];
  const next = Math.min(6, previous + definition.amount);
  if (next === previous) return "no-effect";
  return { pokemon: { ...pokemon, stages: { ...pokemon.stages, [definition.stat]: next } } as T,
    effect: { ...emptyEffect(), statRaised: definition.stat, stagesRaised: next - previous } };
}
