import { describe, expect, it } from "vitest";
import { readRubyMarshal, RubyMarshalError } from "../src/ruby-marshal/reader.js";
import { decodeRpgTable } from "../src/ruby-marshal/table.js";

function marshal(...body: number[]): Uint8Array {
  return Uint8Array.from([4, 8, ...body]);
}

describe("RubyMarshalReader", () => {
  it("reads symbols plus symbol and object links without losing identity", () => {
    const value = readRubyMarshal(marshal(
      0x5b, 0x09,
      0x3a, 0x08, 0x66, 0x6f, 0x6f,
      0x3b, 0x00,
      0x22, 0x08, 0x61, 0x62, 0x63,
      0x40, 0x06,
    ));
    expect(Array.isArray(value)).toBe(true);
    if (!Array.isArray(value)) return;
    expect(value[0]).toBe(value[1]);
    expect(value[2]).toBe(value[3]);
  });

  it("reconstructs cyclic object graphs", () => {
    const value = readRubyMarshal(marshal(0x5b, 0x06, 0x40, 0x00));
    expect(Array.isArray(value)).toBe(true);
    if (Array.isArray(value)) expect(value[0]).toBe(value);
  });

  it("reads Ruby objects and their instance variables", () => {
    const value = readRubyMarshal(marshal(
      0x6f,
      0x3a, 0x0a, 0x54, 0x68, 0x69, 0x6e, 0x67,
      0x06,
      0x3a, 0x0a, 0x40, 0x6e, 0x61, 0x6d, 0x65,
      0x22, 0x06, 0x78,
    ));
    expect(value).toMatchObject({
      kind: "object",
      className: "Thing",
      ivars: { "@name": { kind: "string", text: "x" } },
    });
  });

  it("decodes RPG Maker Table user data", () => {
    const payload = Buffer.alloc(26);
    payload.writeInt32LE(1, 0);
    payload.writeInt32LE(3, 4);
    payload.writeInt32LE(1, 8);
    payload.writeInt32LE(1, 12);
    payload.writeInt32LE(3, 16);
    payload.writeInt16LE(10, 20);
    payload.writeInt16LE(-2, 22);
    payload.writeInt16LE(30, 24);
    const bytes = Uint8Array.from([
      4, 8, 0x75,
      0x3a, 0x0a, 0x54, 0x61, 0x62, 0x6c, 0x65,
      31,
      ...payload,
    ]);
    const value = readRubyMarshal(bytes);
    if (typeof value !== "object" || value === null || Array.isArray(value)
      || value.kind !== "user-defined") throw new TypeError("fixture invalide");
    expect(decodeRpgTable(value)).toEqual({
      dimensions: 1,
      xSize: 3,
      ySize: 1,
      zSize: 1,
      values: [10, -2, 30],
    });
  });

  it("rejects unsupported Marshal versions", () => {
    expect(() => readRubyMarshal(Uint8Array.from([4, 9, 0x30]))).toThrow(RubyMarshalError);
  });
});
