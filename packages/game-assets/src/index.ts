const UNKNOWN_TYPE_ICON = new URL("../assets/type-icons/unknown.png", import.meta.url).href;
const TYPE_ICONS: Readonly<Record<string, string>> = Object.freeze({
  BUG: new URL("../assets/type-icons/bug.png", import.meta.url).href,
  DARK: new URL("../assets/type-icons/dark.png", import.meta.url).href,
  DRAGON: new URL("../assets/type-icons/dragon.png", import.meta.url).href,
  ELECTRIC: new URL("../assets/type-icons/electric.png", import.meta.url).href,
  FAIRY: new URL("../assets/type-icons/fairy.png", import.meta.url).href,
  FIGHTING: new URL("../assets/type-icons/fighting.png", import.meta.url).href,
  FIRE: new URL("../assets/type-icons/fire.png", import.meta.url).href,
  FLYING: new URL("../assets/type-icons/flying.png", import.meta.url).href,
  GHOST: new URL("../assets/type-icons/ghost.png", import.meta.url).href,
  GRASS: new URL("../assets/type-icons/grass.png", import.meta.url).href,
  GROUND: new URL("../assets/type-icons/ground.png", import.meta.url).href,
  ICE: new URL("../assets/type-icons/ice.png", import.meta.url).href,
  NORMAL: new URL("../assets/type-icons/normal.png", import.meta.url).href,
  POISON: new URL("../assets/type-icons/poison.png", import.meta.url).href,
  PSYCHIC: new URL("../assets/type-icons/psychic.png", import.meta.url).href,
  ROCK: new URL("../assets/type-icons/rock.png", import.meta.url).href,
  STEEL: new URL("../assets/type-icons/steel.png", import.meta.url).href,
  WATER: new URL("../assets/type-icons/water.png", import.meta.url).href,
});

/** Returns the versioned icon shared by every game interface. */
export function pokemonTypeIconUrl(type: string): string {
  return TYPE_ICONS[type.toLocaleUpperCase("en-US")] ?? UNKNOWN_TYPE_ICON;
}
