import type { ImportedEventPage } from "./imported-map.js";

type EventCommand = ImportedEventPage["commands"][number];

function positiveInteger(value: string | undefined): number | null {
  const parsed = value === undefined ? 1 : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function command(source: EventCommand, kind: string, data: Readonly<Record<string, unknown>>): EventCommand {
  return { kind, text: null, indent: source.indent, data };
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
