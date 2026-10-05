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
  const mart = /^pbPokemonMart\(\s*\[([\s\S]*?)\]\s*\)$/u.exec(ruby);
  if (mart !== null) {
    const stock = [...mart[1]!.matchAll(/:([A-Za-z][A-Za-z0-9_]*)/gu)].map((match) => match[1]!.toUpperCase());
    if (stock.length > 0) return command(source, "open-shop", { stock, policy: "PERSONAL" });
  }
  if (/^\$GameSpeed\s*=\s*0$/u.test(ruby)) return command(source, "runtime-noop", { policy: "PRESENTATION" });
  if (/^\$PokemonGlobal\.nuzlocke\s*=\s*(?:true|false)$/u.test(ruby)) {
    return command(source, "runtime-noop", { policy: "UNSUPPORTED_GAME_MODE" });
  }
  if (/^pbTrainerIntro\(\s*:[A-Z][A-Z0-9_]*\s*\)$/u.test(ruby) || /^pbTrainerEnd$/u.test(ruby)) {
    return command(source, "runtime-noop", { policy: "TRAINER_PRESENTATION" });
  }
  if (/^(?:Kernel\.)?pbNoticePlayer\(\s*get_character\(\s*0\s*\)\s*\)$/u.test(ruby)) {
    return command(source, "trainer-notice", { animationId: 3, policy: "SHARED_PRESENTATION" });
  }
  if (/^\$Trainer\.pokedex\s*=\s*true$/u.test(ruby)) {
    return command(source, "set-pokedex-enabled", { value: true, policy: "PERSONAL" });
  }
  const booleanMatch = /^\$PokemonGlobal\.runningShoes\s*=\s*(true|false)$/u.exec(ruby);
  if (booleanMatch !== null) {
    return command(source, "set-running-shoes", { value: booleanMatch[1] === "true", policy: "PERSONAL" });
  }
  if (/^(?:Kernel\.)?pbMountBike$/u.test(ruby)) {
    return command(source, "set-movement-mode", { mode: "mount", policy: "SHARED_PRESENTATION" });
  }
  if (/^(?:Kernel\.)?pbDismountBike$/u.test(ruby)) {
    return command(source, "set-movement-mode", { mode: "walk", policy: "SHARED_PRESENTATION" });
  }
  if (/^\$PokemonTemp\.dependentEvents\.(?:remove_sprite\s*\(\s*true\s*\)|refresh_sprite)$/u.test(ruby)) {
    return command(source, "runtime-noop", { policy: "FOLLOWER_PRESENTATION" });
  }
  if (/^(?:Kernel\.)?pbSetPokemonCenter$/u.test(ruby)) return command(source, "set-checkpoint", { policy: "PERSONAL" });
  if (/^(?:Kernel\.)?pbPokeCenterPC$/u.test(ruby)) return command(source, "open-ranch", { policy: "PERSONAL" });
  let match = /^pbAddPokemon\(:([A-Z][A-Z0-9_]*),\s*(\d+)\)$/u.exec(ruby);
  if (match !== null) return command(source, "add-pokemon", { species: match[1], level: Number(match[2]), policy: "PERSONAL" });
  match = /^pbWildBattle\(PBSpecies::([A-Z][A-Z0-9_]*),\s*(\d+)\)$/u.exec(ruby);
  if (match !== null) return command(source, "request-encounter", { species: match[1], level: Number(match[2]), policy: "HOST_ONLY" });
  if (/^pbPokemonFollow\(-?\d+\)$/u.test(ruby)) return command(source, "set-follower", { policy: "SHARED" });
  match = /^(?:Kernel\.)?pbItemBall\(PBItems::([A-Za-z][A-Za-z0-9_]*)\)$/u.exec(ruby);
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
  match = /^pbPanoramaMove\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/u.exec(ruby);
  // Pokemon Z's helper accepts two arguments but its Ruby implementation always applies 1,1.
  if (match !== null) return command(source, "panorama-motion", {
    scrollX: 1, scrollY: 1, requestedX: Number(match[1]), requestedY: Number(match[2]), policy: "PRESENTATION",
  });
  return null;
}

export function portSourceRubyCondition(source: EventCommand): EventCommand | null {
  if (source.kind !== "condition" || source.data.kind !== "ruby-script" || typeof source.data.script !== "string") return null;
  const match = /^pbTrainerBattle\(PBTrainers::([A-Z][A-Z0-9_]*),\s*"((?:\\.|[^"\\])*)",\s*_I\("((?:\\.|[^"\\])*)"\),\s*(true|false),\s*(\d+),\s*(true|false)(?:,\s*[^)]*)?\)$/u
    .exec(source.data.script.trim());
  if (match === null) return null;
  return command(source, "request-trainer-battle", {
    trainerType: match[1], trainerName: match[2]?.replaceAll(/\\(["\\])/gu, "$1"),
    defeatText: match[3]?.replaceAll(/\\(["\\])/gu, "$1"), format: match[4] === "true" ? "double" : "single",
    version: Number(match[5]), canLose: match[6] === "true", policy: "HOST_ONLY",
  });
}
