import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RubyExtendedValue, RubyMarshalValue, RubyObject } from "../ruby-marshal/types.js";
import { readRubyMarshal } from "../ruby-marshal/reader.js";
import { rubyText } from "../ruby-marshal/values.js";

const SUPPORTED_MOVES = new Set([
  "BITE", "BUBBLE", "EMBER", "GROWL", "MUDSLAP", "POUND", "PSYWAVE", "QUICKATTACK", "SCRATCH", "SWIFT",
  "TACKLE", "TAILWHIP", "VINEWHIP", "WATERGUN",
]);

interface MoveRecord {
  readonly id: number;
  readonly internalName: string;
}

interface MovesJson {
  readonly records: readonly MoveRecord[];
}

export interface NormalizedAnimationCel {
  readonly slot: number;
  readonly x: number;
  readonly y: number;
  readonly zoomX: number;
  readonly zoomY: number;
  readonly angle: number;
  readonly mirror: boolean;
  readonly blendType: number;
  readonly visible: boolean;
  readonly pattern: number;
  readonly opacity: number;
  readonly priority: number;
  readonly focus: number;
}

export interface NormalizedBattleAnimation {
  readonly index: number;
  readonly name: string;
  readonly graphicPath: string;
  readonly hue: number;
  readonly position: number;
  readonly frames: readonly (readonly NormalizedAnimationCel[])[];
  readonly timings: readonly {
    readonly frame: number;
    readonly type: number;
    readonly name: string;
    readonly volume: number;
    readonly pitch: number;
  }[];
}

function isUserClass(value: RubyMarshalValue, moduleName: string): value is RubyExtendedValue {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && value.kind === "user-class" && value.moduleName === moduleName;
}

function number(value: RubyMarshalValue | undefined, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function objectIvars(value: RubyMarshalValue, className: string): RubyObject["ivars"] | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && value.kind === "object" && value.className === className ? value.ivars : null;
}

function normalizeCel(value: RubyMarshalValue, slot: number): NormalizedAnimationCel | null {
  if (!Array.isArray(value)) return null;
  const at = (index: number, fallback = 0): number => number(value[index], fallback);
  return {
    slot,
    x: at(0), y: at(1), zoomX: at(2, 100), angle: at(3), mirror: at(4) > 0,
    blendType: at(5), visible: at(6, 1) === 1, pattern: at(7, -1), opacity: at(8, 255),
    zoomY: at(11, 100), priority: at(25, 1), focus: at(26, 4),
  };
}

function normalizeAnimation(value: RubyMarshalValue, index: number): NormalizedBattleAnimation {
  if (!isUserClass(value, "PBAnimation")) throw new TypeError(`Animation ${index} invalide.`);
  const frames = value.ivars["@array"];
  const timings = value.ivars["@timing"];
  const name = rubyText(value.ivars["@name"] ?? null);
  const graphic = rubyText(value.ivars["@graphic"] ?? null);
  if (!Array.isArray(frames) || !Array.isArray(timings) || name === null || graphic === null) {
    throw new TypeError(`Animation ${index} incomplete.`);
  }
  return {
    index, name, graphicPath: `Graphics/Animations/${graphic}`,
    hue: number(value.ivars["@hue"]), position: number(value.ivars["@position"], 4),
    frames: frames.map((frame, frameIndex) => {
      if (!Array.isArray(frame)) throw new TypeError(`Frame ${frameIndex} invalide pour l'animation ${index}.`);
      return frame.map(normalizeCel).filter((cel): cel is NormalizedAnimationCel => cel !== null);
    }),
    timings: timings.map((timing, timingIndex) => {
      const ivars = objectIvars(timing, "PBAnimTiming");
      if (ivars === null) throw new TypeError(`Timing ${timingIndex} invalide pour l'animation ${index}.`);
      return {
        frame: number(ivars["@frame"]), type: number(ivars["@timingType"]),
        name: rubyText(ivars["@name"] ?? null) ?? "",
        volume: number(ivars["@volume"], 80), pitch: number(ivars["@pitch"], 100),
      };
    }),
  };
}

export function normalizeBattleAnimations(
  animationsValue: RubyMarshalValue,
  moveMapValue: RubyMarshalValue,
  moves: readonly MoveRecord[],
): {
  readonly mappings: readonly { readonly moveId: number; readonly internalName: string; readonly player: number | null; readonly opponent: number | null }[];
  readonly animations: readonly NormalizedBattleAnimation[];
} {
  if (!isUserClass(animationsValue, "PBAnimations")) throw new TypeError("PBAnimations attendu.");
  const sourceAnimations = animationsValue.ivars["@array"];
  if (!Array.isArray(sourceAnimations) || !Array.isArray(moveMapValue)
    || !Array.isArray(moveMapValue[0]) || !Array.isArray(moveMapValue[1])) {
    throw new TypeError("Catalogue d'animations ou move2anim invalide.");
  }
  const [playerMap, opponentMap] = moveMapValue;
  const mapping = (values: RubyMarshalValue[], id: number): number | null => {
    const value = values[id];
    return typeof value === "number" ? value : null;
  };
  const mappings = moves.map((move) => ({
    moveId: move.id, internalName: move.internalName,
    player: mapping(playerMap, move.id), opponent: mapping(opponentMap, move.id),
  }));
  const selectedIndices = new Set<number>();
  for (const entry of mappings) {
    if (!SUPPORTED_MOVES.has(entry.internalName)) continue;
    if (entry.player !== null) selectedIndices.add(entry.player);
    if (entry.opponent !== null) selectedIndices.add(entry.opponent);
  }
  const animations = [...selectedIndices].sort((left, right) => left - right).map((index) => {
    const animation = sourceAnimations[index];
    if (animation === undefined) throw new TypeError(`Animation source ${index} absente.`);
    return normalizeAnimation(animation, index);
  });
  return { mappings, animations };
}

export async function extractBattleAnimations(sourceDirectory: string, outputDirectory: string): Promise<{
  readonly catalog: ReturnType<typeof normalizeBattleAnimations>;
  readonly sourceFiles: readonly string[];
}> {
  const moves = JSON.parse(await readFile(path.join(outputDirectory, "moves.json"), "utf8")) as MovesJson;
  const sourceFiles = ["Data/PkmnAnimations.rxdata", "Data/move2anim.dat"] as const;
  const [animations, moveMap] = await Promise.all([
    readFile(path.join(sourceDirectory, "Data", "PkmnAnimations.rxdata")).then(readRubyMarshal),
    readFile(path.join(sourceDirectory, "Data", "move2anim.dat")).then(readRubyMarshal),
  ]);
  return { catalog: normalizeBattleAnimations(animations, moveMap, moves.records), sourceFiles };
}
