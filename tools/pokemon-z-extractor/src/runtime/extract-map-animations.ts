import { readFile } from "node:fs/promises";
import path from "node:path";
import { readRubyMarshal } from "../ruby-marshal/reader.js";
import { decodeRpgTable } from "../ruby-marshal/table.js";
import type { RubyMarshalValue, RubyObject, RubyUserDefined } from "../ruby-marshal/types.js";
import { rubyText } from "../ruby-marshal/values.js";

export interface NormalizedMapAnimationCel {
  readonly pattern: number;
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  readonly angle: number;
  readonly mirror: boolean;
  readonly opacity: number;
  readonly blendType: number;
}

export interface NormalizedMapAnimation {
  readonly id: number;
  readonly name: string;
  readonly graphicPath: string;
  readonly hue: number;
  readonly position: number;
  readonly frames: readonly (readonly NormalizedMapAnimationCel[])[];
  readonly timings: readonly {
    readonly frame: number;
    readonly sound: { readonly name: string; readonly volume: number; readonly pitch: number } | null;
    readonly flashScope: number;
    readonly flashDuration: number;
    readonly flashColor: { readonly red: number; readonly green: number; readonly blue: number; readonly alpha: number };
  }[];
}

function objectIvars(value: RubyMarshalValue, className: string): RubyObject["ivars"] | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && value.kind === "object" && value.className === className ? value.ivars : null;
}

function number(value: RubyMarshalValue | undefined, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function table(value: RubyMarshalValue | undefined): RubyUserDefined | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && value.kind === "user-defined" && value.className === "Table" ? value : null;
}

function colorComponents(value: RubyMarshalValue | undefined): NormalizedMapAnimation["timings"][number]["flashColor"] | null {
  const ivars = value === undefined ? null : objectIvars(value, "Color");
  if (ivars !== null) return { red: number(ivars["@red"]), green: number(ivars["@green"]),
    blue: number(ivars["@blue"]), alpha: number(ivars["@alpha"]) };
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || value.kind !== "user-defined" || value.className !== "Color" || value.bytes.length < 32) return null;
  const view = new DataView(value.bytes.buffer, value.bytes.byteOffset, value.bytes.byteLength);
  return { red: view.getFloat64(0, true), green: view.getFloat64(8, true),
    blue: view.getFloat64(16, true), alpha: view.getFloat64(24, true) };
}

function normalizeFrame(value: RubyMarshalValue, animationId: number, frameIndex: number): readonly NormalizedMapAnimationCel[] {
  const ivars = objectIvars(value, "RPG::Animation::Frame");
  const source = ivars === null ? null : table(ivars["@cell_data"]);
  if (ivars === null || source === null) throw new TypeError(`Frame ${frameIndex} invalide pour l'animation de carte ${animationId}.`);
  const decoded = decodeRpgTable(source);
  const cellCount = number(ivars["@cell_max"]);
  if (decoded.xSize !== cellCount || (cellCount > 0 && decoded.ySize < 8)) {
    throw new TypeError(`Table de cellules invalide pour l'animation de carte ${animationId}.`);
  }
  return Array.from({ length: cellCount }, (_, cellIndex) => {
    const at = (field: number): number => decoded.values[field * decoded.xSize + cellIndex] ?? 0;
    return {
      pattern: at(0), x: at(1), y: at(2), zoom: at(3), angle: at(4), mirror: at(5) !== 0,
      opacity: at(6), blendType: at(7),
    };
  }).filter((cell) => cell.pattern >= 0);
}

function normalizeTiming(value: RubyMarshalValue, animationId: number, timingIndex: number): NormalizedMapAnimation["timings"][number] {
  const ivars = objectIvars(value, "RPG::Animation::Timing");
  const color = ivars === null ? null : colorComponents(ivars["@flash_color"]);
  const sound = ivars === null ? null : objectIvars(ivars["@se"] ?? null, "RPG::AudioFile");
  if (ivars === null || color === null || sound === null) {
    throw new TypeError(`Timing ${timingIndex} invalide pour l'animation de carte ${animationId}.`);
  }
  const soundName = rubyText(sound["@name"] ?? null) ?? "";
  return {
    frame: number(ivars["@frame"]),
    sound: soundName === "" ? null : { name: soundName, volume: number(sound["@volume"], 80), pitch: number(sound["@pitch"], 100) },
    flashScope: number(ivars["@flash_scope"]), flashDuration: number(ivars["@flash_duration"]),
    flashColor: color,
  };
}

export function normalizeMapAnimations(value: RubyMarshalValue): readonly NormalizedMapAnimation[] {
  if (!Array.isArray(value)) throw new TypeError("Catalogue RPG::Animation attendu.");
  return value.flatMap((entry, index) => {
    if (entry === null) return [];
    const ivars = objectIvars(entry, "RPG::Animation");
    if (ivars === null || !Array.isArray(ivars["@frames"]) || !Array.isArray(ivars["@timings"])) {
      throw new TypeError(`Animation de carte ${index} invalide.`);
    }
    const graphic = rubyText(ivars["@animation_name"] ?? null);
    const name = rubyText(ivars["@name"] ?? null);
    if (graphic === null || name === null) throw new TypeError(`Animation de carte ${index} incomplete.`);
    const graphicPath = graphic === "" ? "" : `Graphics/Animations/${graphic}${/\.[a-z0-9]+$/iu.test(graphic) ? "" : ".png"}`;
    return [{
      id: number(ivars["@id"], index), name,
      graphicPath, hue: number(ivars["@animation_hue"]),
      position: number(ivars["@position"], 1),
      frames: ivars["@frames"].map((frame, frameIndex) => normalizeFrame(frame, index, frameIndex)),
      timings: ivars["@timings"].map((timing, timingIndex) => normalizeTiming(timing, index, timingIndex)),
    }];
  });
}

export async function extractMapAnimations(sourceDirectory: string): Promise<{
  readonly animations: readonly NormalizedMapAnimation[];
  readonly sourceFiles: readonly string[];
}> {
  const sourceFiles = ["Data/Animations.rxdata"] as const;
  const value = readRubyMarshal(await readFile(path.join(sourceDirectory, "Data", "Animations.rxdata")));
  return { animations: normalizeMapAnimations(value), sourceFiles };
}
