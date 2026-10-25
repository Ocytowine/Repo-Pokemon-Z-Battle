import { isMoveFunctionSupported } from "./move-function-support.js";
import type { BattleMove, BattleTrace, BattlerState, RandomSource } from "./types.js";

const TWO_TURN = ["0C3", "0C4", "0C5", "0C6", "0C7", "0C8", "0C9", "0CA", "0CB", "0CC", "0CD", "0CE", "14D", "14E"];
const SLEEP_TALK_EXCLUDED = new Set([
  "002", "014", "05C", "05D", "0AE", "0AF", "0B0", "0B3", "0B4", "0B5", "0B6", "0D1", "0D4", "115",
  ...TWO_TURN,
]);
const ASSIST_EXCLUDED = new Set([
  "002", "014", "05C", "05D", "069", "071", "072", "073", "09C", "0AA", "0AD", "0AE", "0AF",
  "0B0", "0B2", "0B3", "0B4", "0B5", "0B6", "0CD", "0E7", "0E8", "0EB", "0EC", "0F1", "0F2",
  "0F3", "115", "117", "149", "14B", "14C", "14D", "158", ...TWO_TURN,
]);

function choose(candidates: readonly BattleMove[], rng: RandomSource, trace: BattleTrace[]): BattleMove | null {
  if (candidates.length === 0) return null;
  const value = rng.nextInt(candidates.length);
  trace.push({ type: "rng", purpose: "called-move", maxExclusive: candidates.length, value });
  return candidates[value] ?? null;
}

/** Only battle-ready moves may be called; the admission pipeline rejects unported party moves. */
export function sleepTalkMoveFrom(user: BattlerState, rng: RandomSource, trace: BattleTrace[]): BattleMove | null {
  if (user.majorStatus?.kind !== "sleep") return null;
  return choose(user.moves.filter((slot) => slot.pp > 0
    && !SLEEP_TALK_EXCLUDED.has(slot.move.functionCode)
    && isMoveFunctionSupported(slot.move.functionCode)
    && !(user.volatile?.disableTurns && user.volatile.disabledMove === slot.move.internalName))
    .map((slot) => slot.move), rng, trace);
}

export function assistMoveFrom(user: BattlerState, party: readonly BattlerState[], rng: RandomSource,
  trace: BattleTrace[]): BattleMove | null {
  return choose(party.filter((member) => member.id !== user.id)
    .flatMap((member) => member.moves.map((slot) => slot.move))
    .filter((move) => move.type !== "SHADOW" && !ASSIST_EXCLUDED.has(move.functionCode)
      && isMoveFunctionSupported(move.functionCode)), rng, trace);
}

const METRONOME_FUNCTION_EXCLUDED = new Set([
  "002", "011", "014", "05C", "05D", "069", "071", "072", "073", "09C", "0AA", "0AB",
  "0AC", "0AD", "0AE", "0AF", "0B0", "0B2", "0B3", "0B4", "0B5", "0B6", "0E7", "0E8",
  "0F1", "0F2", "0F3", "115", "117", "11D", "11E",
]);
const METRONOME_MOVE_EXCLUDED = new Set([
  "FREEZESHOCK", "ICEBURN", "RELICSONG", "ECLIPSE", "SECRETSWORD", "SNARL",
  "TECHNOBLAST", "VCREATE", "GEOMANCY",
]);

/** Source 0B6 samples numeric move IDs uniformly before rejecting its blacklist. */
export function metronomeMoveFrom(catalog: readonly BattleMove[] | undefined,
  rng: RandomSource, trace: BattleTrace[]): BattleMove | null {
  if (catalog === undefined || catalog.length === 0) return null;
  const byId = new Map(catalog.map((move) => [move.id, move]));
  const maxId = Math.max(...byId.keys());
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const value = rng.nextInt(maxId);
    trace.push({ type: "rng", purpose: "called-move", maxExclusive: maxId, value });
    const candidate = byId.get(value + 1);
    if (candidate !== undefined && candidate.type !== "SHADOW"
      && !METRONOME_FUNCTION_EXCLUDED.has(candidate.functionCode)
      && !METRONOME_MOVE_EXCLUDED.has(candidate.internalName)
      && isMoveFunctionSupported(candidate.functionCode)) return candidate;
  }
  return null;
}

/** Source Truco Huevo pool, in its Ruby ordering. It is move data, never an animation list. */
const EGG_TRICK_MOVES: readonly BattleMove[] = ([
  [466, "AGILITY", "Agilidad", "030", 0, "PSYCHIC", "Status", 0, 30, 0, "10", "d", 0],
  [608, "PSYCHICTERRAIN", "Campo Psíquico", "905", 0, "PSYCHIC", "Status", 0, 10, 0, "01", "", 0],
  [704, "MAGICPOWDER", "Polvo Mágico", "904", 0, "PSYCHIC", "Status", 0, 20, 0, "00", "bce", 0],
  [479, "HYPNOSIS", "Hipnosis", "003", 0, "PSYCHIC", "Status", 70, 20, 0, "00", "bce", 0],
  [499, "TRICKROOM", "Espacio Raro", "11F", 0, "PSYCHIC", "Status", 0, 5, 0, "20", "e", -7],
  [481, "KINESIS", "Kinético", "047", 0, "PSYCHIC", "Status", 80, 15, 0, "00", "bce", 0],
  [462, "CONFUSION", "Confusión", "013", 50, "PSYCHIC", "Special", 100, 25, 10, "00", "be", 0],
  [460, "PSYBEAM", "Psicorrayo", "013", 65, "PSYCHIC", "Special", 100, 20, 10, "00", "be", 0],
  [465, "STOREDPOWER", "Poderreserva", "08E", 1, "PSYCHIC", "Special", 100, 10, 0, "00", "bef", 0],
  [359, "DOUBLETEAM", "Doble Equipo", "022", 0, "NORMAL", "Status", 0, 15, 0, "10", "d", 0],
  [450, "FUTURESIGHT", "Premonición", "111", 130, "PSYCHIC", "Special", 100, 10, 0, "00", "", 0],
  [554, "BUBBLE", "Burbuja", "044", 40, "WATER", "Special", 100, 30, 10, "04", "be", 0],
  [494, "ROLEPLAY", "Imitación", "065", 0, "PSYCHIC", "Status", 0, 10, 0, "00", "", 0],
  [182, "LICK", "Lengüetazo", "007", 30, "GHOST", "Physical", 100, 30, 30, "00", "abe", 0],
  [413, "SUPERSONIC", "Supersónico", "013", 0, "NORMAL", "Status", 75, 20, 0, "00", "bcek", 0],
  [395, "REFLECTTYPE", "Clonatipo", "062", 0, "NORMAL", "Status", 0, 15, 0, "00", "b", 0],
  [613, "VIRAJE", "Viraje", "0EE", 70, "WATER", "Physical", 100, 20, 100, "00", "abef", 0],
  [452, "PSYCHIC", "Psíquico", "046", 90, "PSYCHIC", "Special", 100, 10, 10, "00", "be", 0],
] as const).map(([id, internalName, name, functionCode, power, type, category, accuracy, pp,
  effectChance, targetCode, flags, priority]) => ({ id, internalName, name,
  functionCode: functionCode as BattleMove["functionCode"], power, type,
  category: category as BattleMove["category"], accuracy, pp, effectChance,
  targetCode, flags, priority }));

export function eggTrickMoveFrom(rng: RandomSource, trace: BattleTrace[]): BattleMove {
  return choose(EGG_TRICK_MOVES, rng, trace)!;
}

export function eggTrickMoveNamed(name: string): BattleMove | null {
  return EGG_TRICK_MOVES.find((move) => move.internalName === name) ?? null;
}
