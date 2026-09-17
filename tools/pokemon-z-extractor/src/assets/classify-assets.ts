import path from "node:path";

export type PokemonAssetKind = "battler" | "icon" | "footprint" | "cry" | "overworld";

export interface PokemonAssetIdentity {
  readonly pokemonId: number;
  readonly kind: PokemonAssetKind;
  readonly form: number | null;
  readonly shiny: boolean;
  readonly female: boolean;
  readonly back: boolean;
  readonly variant: string | null;
}

function suffixIdentity(
  baseName: string,
  prefix: string,
  kind: PokemonAssetKind,
  acceptedFlags: RegExp,
): PokemonAssetIdentity | null {
  const match = new RegExp(`^${prefix}(\\d{1,4})([fsb]*)(?:_(\\d+))?$`, "iu").exec(baseName);
  if (match === null || !acceptedFlags.test(match[2] ?? "")) return null;
  const flags = (match[2] ?? "").toLowerCase();
  return {
    pokemonId: Number(match[1]),
    kind,
    form: match[3] === undefined ? null : Number(match[3]),
    shiny: flags.includes("s"),
    female: flags.includes("f"),
    back: flags.includes("b"),
    variant: null,
  };
}

export function classifyPokemonAsset(relativePath: string): PokemonAssetIdentity | null {
  const portable = relativePath.replaceAll("\\", "/");
  const baseName = path.posix.basename(portable, path.posix.extname(portable));
  if (portable.startsWith("Graphics/Battlers/")) {
    const egg = /^(\d{1,4})egg$/iu.exec(baseName);
    if (egg !== null) return {
      pokemonId: Number(egg[1]), kind: "battler", form: null,
      shiny: false, female: false, back: false, variant: "egg",
    };
    return suffixIdentity(baseName, "", "battler", /^[fsb]*$/iu);
  }
  if (portable.startsWith("Graphics/Icons/Footprints/")) {
    const match = /^footprint(\d{1,4})(?:_(\d+))?$/iu.exec(baseName);
    return match === null ? null : {
      pokemonId: Number(match[1]), kind: "footprint",
      form: match[2] === undefined ? null : Number(match[2]),
      shiny: false, female: false, back: false, variant: null,
    };
  }
  if (portable.startsWith("Graphics/Icons/")) {
    const special = /^icon(\d{1,4})(egg|_shadow)$/iu.exec(baseName);
    if (special !== null) return {
      pokemonId: Number(special[1]), kind: "icon", form: null,
      shiny: false, female: false, back: false,
      variant: (special[2] ?? "").replace(/^_/u, "").toLowerCase(),
    };
    return suffixIdentity(baseName, "icon", "icon", /^[fsb]*$/iu);
  }
  if (portable.startsWith("Graphics/Characters/")) {
    return suffixIdentity(baseName, "", "overworld", /^[fs]*$/iu);
  }
  if (portable.startsWith("Audio/SE/Cries/")) {
    const match = /^(\d{1,4})(?:Cry(?:_(\d+))?|_(\d+)Cry)?$/iu.exec(baseName);
    return match === null ? null : {
      pokemonId: Number(match[1]), kind: "cry",
      form: match[2] === undefined && match[3] === undefined ? null : Number(match[2] ?? match[3]),
      shiny: false, female: false, back: false, variant: null,
    };
  }
  return null;
}

export function assetCategory(relativePath: string): string {
  const parts = relativePath.replaceAll("\\", "/").split("/");
  return parts.length >= 2 ? `${parts[0]?.toLowerCase()}/${parts[1]?.toLowerCase()}` : "other";
}

export function normalizedWebPath(relativePath: string): string {
  return relativePath.normalize("NFC").replaceAll("\\", "/").toLowerCase();
}
