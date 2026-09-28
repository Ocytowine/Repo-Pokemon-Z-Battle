import { describe, expect, it } from "vitest";
import type { RubyMarshalValue, RubyObject, RubyString } from "../src/ruby-marshal/types.js";
import { convertEventCommand, convertMoveRoute } from "../src/runtime/event-ast.js";

function text(value: string): RubyString {
  return { kind: "string", bytes: new TextEncoder().encode(value), text: value, ivars: {} };
}

function object(className: string, ivars: RubyObject["ivars"]): RubyObject {
  return { kind: "object", className, ivars };
}

function eventCommand(code: number, parameters: readonly RubyMarshalValue[], indent = 0): RubyObject {
  return object("RPG::EventCommand", { "@code": code, "@indent": indent, "@parameters": [...parameters] });
}

describe("event command AST", () => {
  it("normalizes dialogue, switches, variables and direct transfers", () => {
    expect(convertEventCommand(eventCommand(101, [text("Bonjour")]), 4)).toMatchObject({
      kind: "show-text", status: "converted", sourceIndex: 4, data: { text: "Bonjour" },
    });
    expect(convertEventCommand(eventCommand(121, [7, 9, 0]), 5)).toMatchObject({
      kind: "set-switches", data: { firstId: 7, lastId: 9, value: true },
    });
    expect(convertEventCommand(eventCommand(122, [2, 3, 1, 2, 4, 8]), 6)).toMatchObject({
      kind: "change-variables", data: { operation: "add", operand: { kind: "random", values: [4, 8] } },
    });
    expect(convertEventCommand(eventCommand(201, [0, 12, 8, 4, 2, 0]), 7)).toMatchObject({
      kind: "transfer-player", data: { addressing: "direct", map: 12, x: 8, y: 4 },
    });
  });

  it("converts movement routes while keeping Ruby steps reference-only", () => {
    const route = object("RPG::MoveRoute", {
      "@repeat": false,
      "@skippable": true,
      "@list": [
        object("RPG::MoveCommand", { "@code": 1, "@parameters": [] }),
        object("RPG::MoveCommand", { "@code": 45, "@parameters": [text("turn_down")] }),
        object("RPG::MoveCommand", { "@code": 0, "@parameters": [] }),
      ],
    });
    expect(convertMoveRoute(route)).toMatchObject({
      repeat: false,
      skippable: true,
      steps: [
        { kind: "step-down", status: "converted" },
        { kind: "ruby-script", status: "reference-only", parameters: ["turn_down"] },
        { kind: "end", status: "converted" },
      ],
    });
    expect(convertEventCommand(eventCommand(209, [-1, route]), 8)).toMatchObject({
      kind: "move-route", status: "reference-only", sourceIndex: 8,
    });
  });

  it("preserves unknown commands and Ruby scripts without executing them", () => {
    expect(convertEventCommand(eventCommand(999, [text("opaque"), 42], 2), 11)).toEqual({
      kind: "raw",
      family: "unknown",
      status: "raw",
      code: 999,
      indent: 2,
      sourceIndex: 11,
      data: { parameters: ["opaque", 42] },
    });
    expect(convertEventCommand(eventCommand(355, [text("pbWildBattle(:PIKACHU,5)")]), 12)).toMatchObject({
      kind: "ruby-script", status: "reference-only", data: { source: "pbWildBattle(:PIKACHU,5)" },
    });
  });
});
