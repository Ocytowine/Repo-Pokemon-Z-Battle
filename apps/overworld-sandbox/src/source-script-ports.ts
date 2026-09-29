import type { ImportedEventPage } from "./imported-map.js";

type EventCommand = ImportedEventPage["commands"][number];

function positiveInteger(value: string | undefined): number | null {
  const parsed = value === undefined ? 1 : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function command(source: EventCommand, kind: string, data: Readonly<Record<string, unknown>>): EventCommand {
  return { kind, text: null, indent: source.indent, data };
}

function rubySource(source: EventCommand): string | null {
  return source.kind === "ruby-script" && typeof source.data.source === "string" ? source.data.source.trim() : null;
}

export function isSourceStarterSelectionPage(page: ImportedEventPage): boolean {
  const scripts = page.commands.map(rubySource).filter((source): source is string => source !== null);
  const addsPokemon = scripts.some((source) => /^pbAddPokemon\(:[A-Z][A-Z0-9_]*,\s*\d+\)$/u.test(source));
  const startsTrialBattle = scripts.some((source) => /^pbWildBattle\(PBSpecies::BIDOOF,\s*2\)$/u.test(source));
  const selectsStarterType = page.commands.some((source) => source.kind === "set-switches"
    && (source.data.firstId === 62 || source.data.firstId === 63 || source.data.firstId === 64)
    && source.data.lastId === source.data.firstId && source.data.value === true);
  return addsPokemon && startsTrialBattle && selectsStarterType;
}

export function portSourceRubyCommand(source: EventCommand): EventCommand | null {
  if (source.kind !== "ruby-script" || typeof source.data.source !== "string") return null;
  const ruby = source.data.source.trim();
  if (/^(?:Kernel\.)?pbSetPokemonCenter$/u.test(ruby)) return command(source, "set-checkpoint", { policy: "PERSONAL" });
  let match = /^pbAddPokemon\(:([A-Z][A-Z0-9_]*),\s*(\d+)\)$/u.exec(ruby);
  if (match !== null) return command(source, "add-pokemon", { species: match[1], level: Number(match[2]), policy: "PERSONAL" });
  match = /^pbWildBattle\(PBSpecies::([A-Z][A-Z0-9_]*),\s*(\d+)\)$/u.exec(ruby);
  if (match !== null) return command(source, "request-encounter", { species: match[1], level: Number(match[2]), policy: "HOST_ONLY" });
  if (/^pbPokemonFollow\(-?\d+\)$/u.test(ruby)) return command(source, "set-follower", { policy: "SHARED" });
  match = /^(?:Kernel\.)?pbItemBall\(PBItems::([A-Z][A-Z0-9_]*)\)$/u.exec(ruby);
  if (match !== null) return command(source, "grant-item", { itemId: match[1], quantity: 1, policy: "PERSONAL" });
  match = /^(?:Kernel\.)?pbReceiveItem\(:(\w+)(?:,\s*(\d+))?\)$/u.exec(ruby);
  if (match !== null) {
    const quantity = positiveInteger(match[2]);
    return quantity === null ? null : command(source, "grant-item", { itemId: match[1]?.toUpperCase(), quantity, policy: "PERSONAL" });
  }
  match = /^\$PokemonBag\.pbStoreItem\(:(\w+),\s*(\d+)\)$/u.exec(ruby);
  if (match !== null) {
    const quantity = positiveInteger(match[2]);
    return quantity === null ? null : command(source, "grant-item", { itemId: match[1]?.toUpperCase(), quantity, policy: "PERSONAL" });
  }
  match = /^\$PokemonBag\.pbDeleteItem\(:(\w+),\s*(\d+)\)$/u.exec(ruby);
  if (match !== null) {
    const quantity = positiveInteger(match[2]);
    return quantity === null ? null : command(source, "remove-item", { itemId: match[1]?.toUpperCase(), quantity, policy: "PERSONAL" });
  }
  match = /^pbPlayCry\(PBSpecies::([A-Z][A-Z0-9_]*)\)$/u.exec(ruby);
  if (match !== null) return command(source, "play-cry", { speciesId: match[1], policy: "PERSONAL" });
  return null;
}
