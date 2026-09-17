import { readRubyMarshal } from "./reader.js";
import type { RubyMarshalValue, RubyString, RubyUserDefined } from "./types.js";

export function isRubyString(value: unknown): value is RubyString {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && "kind" in value && value.kind === "string";
}

export function rubyText(value: RubyMarshalValue): string | null {
  if (value === null) return null;
  if (isRubyString(value)) return value.text;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

export function decodeOrderedHash(value: RubyMarshalValue): readonly (readonly [string, string | null])[] {
  if (
    typeof value !== "object"
    || value === null
    || Array.isArray(value)
    || value.kind !== "user-defined"
    || value.className !== "OrderedHash"
  ) {
    throw new TypeError("OrderedHash Ruby attendu.");
  }
  const payload = readRubyMarshal((value as RubyUserDefined).bytes);
  if (!Array.isArray(payload) || !Array.isArray(payload[0]) || !Array.isArray(payload[1])) {
    throw new TypeError("Charge OrderedHash invalide.");
  }
  const keys = payload[0];
  const values = payload[1];
  if (keys.length !== values.length) throw new TypeError("Cles et valeurs OrderedHash incoherentes.");
  return keys.map((key, index) => {
    const textKey = rubyText(key);
    if (textKey === null) throw new TypeError(`Cle OrderedHash ${index} non textuelle.`);
    return [textKey, rubyText(values[index] ?? null)] as const;
  });
}
