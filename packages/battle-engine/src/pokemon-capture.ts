import type { BattlerState, RandomSource } from "./types.js";

const BALL_IDS = new Set([
  "POKEBALL", "GREATBALL", "SAFARIBALL", "ULTRABALL", "MASTERBALL", "NETBALL", "DIVEBALL",
  "NESTBALL", "REPEATBALL", "TIMERBALL", "LUXURYBALL", "PREMIERBALL", "DUSKBALL", "HEALBALL",
  "QUICKBALL", "CHERISHBALL", "FASTBALL", "LEVELBALL", "LUREBALL", "HEAVYBALL", "LOVEBALL",
  "FRIENDBALL", "MOONBALL", "SPORTBALL", "ESPIRIBALL", "POKEBALLCASERA", "SUPERBALLCASERA",
  "ULTRABALLCASERA",
]);
const MOON_SPECIES = new Set(["NIDORANFE", "NIDORINA", "NIDOQUEEN", "NIDORANMA", "NIDORINO", "NIDOKING",
  "CLEFFA", "CLEFAIRY", "CLEFABLE", "IGGLYBUFF", "JIGGLYPUFF", "WIGGLYTUFF", "SKITTY", "DELCATTY",
  "MUNNA", "MUSHARNA"]);

export interface PokemonCaptureContext {
  readonly turn: number;
  readonly actorLevels: readonly number[];
  readonly underwater?: boolean;
  readonly night?: boolean;
  readonly fishing?: boolean;
  readonly alreadyOwned?: boolean;
  readonly sameSpeciesOppositeGender?: boolean;
  readonly criticalCaptureBonus?: number;
}
export interface PokemonCaptureResult { readonly shakes: number; readonly critical: boolean; readonly success: boolean }

export function isPokemonBallSupported(itemId: string): boolean { return BALL_IDS.has(itemId); }

function modifiedRate(ballId: string, target: BattlerState, context: PokemonCaptureContext): number {
  let rate = target.capture?.rate ?? 0;
  switch (ballId) {
    case "POKEBALLCASERA": case "GREATBALL": case "SAFARIBALL": case "SPORTBALL": rate = Math.floor(rate * 3 / 2); break;
    case "SUPERBALLCASERA": case "ULTRABALL": rate = Math.floor(rate * 2); break;
    case "ULTRABALLCASERA": rate = Math.floor(rate * 3); break;
    case "NETBALL": if (target.types.includes("BUG") || target.types.includes("WATER")) rate *= 3.5; break;
    case "ESPIRIBALL": if (target.types.includes("GHOST")) rate *= 100; break;
    case "DIVEBALL": if (context.underwater) rate = Math.floor(rate * 7 / 2); break;
    case "NESTBALL": if (target.level <= 40) rate *= Math.max(Math.floor((41 - target.level) / 10), 1); break;
    case "REPEATBALL": if (context.alreadyOwned) rate *= 3.5; break;
    case "TIMERBALL": rate *= Math.min(1 + 0.3 * context.turn, 4); break;
    case "DUSKBALL": if (context.night) rate *= 3.5; break;
    case "QUICKBALL": if (context.turn <= 1) rate *= 5; break;
    case "FASTBALL": if ((target.capture?.baseSpeed ?? 0) >= 100) rate *= 4; break;
    case "LEVELBALL": {
      const level = Math.max(0, ...context.actorLevels);
      if (level >= target.level * 4) rate *= 8;
      else if (level >= target.level * 2) rate *= 4;
      else if (level > target.level) rate *= 2;
      break;
    }
    case "LUREBALL": if (context.fishing) rate *= 5; break;
    case "HEAVYBALL": {
      const weight = target.capture?.weight ?? 0;
      rate += weight >= 4096 ? 40 : weight >= 3072 ? 30 : weight >= 2048 ? 20 : -20;
      rate = Math.max(rate, 1); break;
    }
    case "LOVEBALL": if (context.sameSpeciesOppositeGender) rate *= 8; break;
    case "MOONBALL": if (MOON_SPECIES.has(target.species)) rate *= 4; break;
  }
  return Math.floor(Math.min(rate, 255));
}

/** Exact four-shake formula used by Pokemon Z, driven by an injectable authoritative RNG. */
export function attemptPokemonCapture(ballId: string, target: BattlerState, context: PokemonCaptureContext,
  rng: RandomSource): PokemonCaptureResult {
  if (!isPokemonBallSupported(ballId)) throw new Error(`Ball non supportee : ${ballId}.`);
  if (target.hp <= 0 || target.capture === undefined) throw new Error("Ce Pokemon ne peut pas etre capture.");
  if (ballId === "MASTERBALL") return { shakes: 4, critical: false, success: true };
  const rate = modifiedRate(ballId, target, context);
  let x = Math.floor(((target.stats.maxHp * 3 - target.hp * 2) * rate) / (target.stats.maxHp * 3));
  if (target.majorStatus?.kind === "sleep" || target.majorStatus?.kind === "frozen") x = Math.floor(x * 2.5);
  else if (target.majorStatus !== null) x = Math.floor(x * 1.5);
  if (x > 255) return { shakes: 4, critical: false, success: true };
  x = Math.max(1, x);
  const threshold = Math.floor(65536 / ((255 / x) ** 0.1875));
  const criticalBonus = Math.max(0, Math.floor(context.criticalCaptureBonus ?? 0));
  if (criticalBonus > 0 && rng.nextInt(256) < criticalBonus) {
    const success = rng.nextInt(65536) < threshold;
    return { shakes: success ? 4 : 0, critical: true, success };
  }
  let shakes = 0;
  while (shakes < 4 && rng.nextInt(65536) < threshold) shakes += 1;
  return { shakes, critical: false, success: shakes === 4 };
}
