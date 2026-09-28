import type { RubyMarshalValue, RubyObject } from "../ruby-marshal/types.js";
import { rubyText } from "../ruby-marshal/values.js";

export type EventCommandStatus = "converted" | "reference-only" | "raw";
export type EventCommandFamily = "flow" | "dialogue" | "state" | "movement" | "transition" | "audio" | "visual" | "gameplay" | "script" | "unknown";

export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface EventAstCommand {
  readonly kind: string;
  readonly family: EventCommandFamily;
  readonly status: EventCommandStatus;
  readonly code: number;
  readonly indent: number;
  readonly sourceIndex: number;
  readonly data: JsonValue;
}

const MOVE_NAMES: Readonly<Record<number, string>> = {
  0: "end", 1: "step-down", 2: "step-left", 3: "step-right", 4: "step-up",
  5: "step-lower-left", 6: "step-lower-right", 7: "step-upper-left", 8: "step-upper-right",
  9: "step-random", 10: "step-toward-player", 11: "step-away-from-player", 12: "step-forward", 13: "step-backward",
  14: "jump", 15: "wait", 16: "face-down", 17: "face-left", 18: "face-right", 19: "face-up",
  20: "turn-right", 21: "turn-left", 22: "turn-around", 23: "turn-random", 24: "face-player", 25: "face-away-from-player",
  26: "switch-on", 27: "switch-off", 29: "change-speed", 30: "change-frequency",
  31: "walk-animation-on", 32: "walk-animation-off", 33: "step-animation-on", 34: "step-animation-off",
  35: "direction-fix-on", 36: "direction-fix-off", 37: "through-on", 38: "through-off",
  39: "always-on-top-on", 40: "always-on-top-off", 41: "change-graphic", 42: "change-opacity",
  43: "change-blend-mode", 44: "play-sound", 45: "ruby-script",
};

function rubyObject(value: RubyMarshalValue, className: string, context: string): RubyObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || value.kind !== "object" || value.className !== className) {
    throw new TypeError(`${context} doit etre un objet ${className}.`);
  }
  return value;
}

function numberValue(value: RubyMarshalValue | undefined): number | null {
  return typeof value === "number" ? value : null;
}

function boolValue(value: RubyMarshalValue | undefined): boolean {
  return value === true;
}

function bytesBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export function rubyValueToJson(value: RubyMarshalValue): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(rubyValueToJson);
  if (value.kind === "string") return value.text;
  if (value.kind === "symbol") return { rubySymbol: value.name };
  if (value.kind === "hash") return { rubyHash: value.entries.map(([key, entry]) => [rubyValueToJson(key), rubyValueToJson(entry)]) };
  if (value.kind === "object") return {
    rubyClass: value.className,
    ivars: Object.fromEntries(Object.entries(value.ivars).map(([key, entry]) => [key, rubyValueToJson(entry)])),
  };
  if (value.kind === "user-defined") return { rubyClass: value.className, bytesBase64: bytesBase64(value.bytes) };
  if (value.kind === "user-marshal" || value.kind === "data") return { rubyClass: value.className, value: rubyValueToJson(value.value) };
  if (value.kind === "struct") return { rubyClass: value.className, members: Object.fromEntries(Object.entries(value.members).map(([key, entry]) => [key, rubyValueToJson(entry)])) };
  if (value.kind === "regexp") return { rubyRegexp: value.source.text, options: value.options };
  if (value.kind === "class" || value.kind === "module") return { rubyReference: value.kind, name: value.name };
  if (value.kind === "extended" || value.kind === "user-class") {
    return { rubyExtension: value.moduleName, value: rubyValueToJson(value.value) };
  }
  return { rubyValue: "unsupported" };
}

function tuple(value: RubyMarshalValue | undefined, expectedClass: "Tone" | "Color"): JsonValue {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || value.kind !== "user-defined" || value.className !== expectedClass || value.bytes.length !== 32) {
    return rubyValueToJson(value ?? null);
  }
  const view = new DataView(value.bytes.buffer, value.bytes.byteOffset, value.bytes.byteLength);
  const names = expectedClass === "Tone" ? ["red", "green", "blue", "gray"] : ["red", "green", "blue", "alpha"];
  return Object.fromEntries(names.map((name, index) => [name, view.getFloat64(index * 8, true)]));
}

function audio(value: RubyMarshalValue | undefined): JsonValue {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || value.kind !== "object" || value.className !== "RPG::AudioFile") return rubyValueToJson(value ?? null);
  return {
    name: rubyText(value.ivars["@name"] ?? null) ?? "",
    volume: numberValue(value.ivars["@volume"]) ?? 100,
    pitch: numberValue(value.ivars["@pitch"]) ?? 100,
  };
}

export function convertMoveCommand(value: RubyMarshalValue, stepIndex: number): JsonValue {
  const command = rubyObject(value, "RPG::MoveCommand", `commande de mouvement ${stepIndex}`);
  const code = numberValue(command.ivars["@code"]);
  const parameters = command.ivars["@parameters"];
  if (code === null || !Array.isArray(parameters)) throw new TypeError(`Commande de mouvement ${stepIndex} invalide.`);
  return {
    kind: MOVE_NAMES[code] ?? "raw-move-command",
    code,
    stepIndex,
    status: code === 45 ? "reference-only" : MOVE_NAMES[code] === undefined ? "raw" : "converted",
    parameters: parameters.map(rubyValueToJson),
  };
}

export function convertMoveRoute(value: RubyMarshalValue): JsonValue {
  const route = rubyObject(value, "RPG::MoveRoute", "route de mouvement");
  const list = route.ivars["@list"];
  if (!Array.isArray(list)) throw new TypeError("RPG::MoveRoute.@list doit etre un tableau.");
  return {
    repeat: boolValue(route.ivars["@repeat"]),
    skippable: boolValue(route.ivars["@skippable"]),
    steps: list.map(convertMoveCommand),
  };
}

function command(kind: string, family: EventCommandFamily, status: EventCommandStatus, code: number, indent: number, sourceIndex: number, data: JsonValue = {}): EventAstCommand {
  return { kind, family, status, code, indent, sourceIndex, data };
}

function variableOperand(parameters: readonly RubyMarshalValue[]): JsonValue {
  const type = numberValue(parameters[3]);
  const names: Readonly<Record<number, string>> = { 0: "constant", 1: "variable", 2: "random", 3: "item-count", 4: "actor-property", 5: "enemy-property", 6: "character-property", 7: "other" };
  return { kind: type === null ? "unknown" : names[type] ?? "unknown", values: parameters.slice(4).map(rubyValueToJson) };
}

function conditionData(parameters: readonly RubyMarshalValue[]): { readonly data: JsonValue; readonly status: EventCommandStatus } {
  const type = numberValue(parameters[0]);
  if (type === 12) return { data: { kind: "ruby-script", script: rubyText(parameters[1] ?? null) ?? "" }, status: "reference-only" };
  const names: Readonly<Record<number, string>> = {
    0: "switch", 1: "variable", 2: "self-switch", 3: "timer", 4: "actor", 5: "enemy",
    6: "character-direction", 7: "gold", 8: "item", 9: "weapon", 10: "armor", 11: "button",
  };
  return { data: { kind: type === null ? "unknown" : names[type] ?? "unknown", operands: parameters.slice(1).map(rubyValueToJson) }, status: names[type ?? -1] === undefined ? "raw" : "converted" };
}

const GENERIC_STANDARD: Readonly<Record<number, readonly [string, EventCommandFamily]>> = {
  103: ["number-input", "dialogue"], 104: ["text-options", "dialogue"], 108: ["comment", "flow"], 408: ["comment-continuation", "flow"],
  112: ["loop-start", "flow"], 113: ["loop-break", "flow"], 115: ["exit-event", "flow"], 116: ["erase-event", "flow"],
  117: ["call-common-event", "flow"], 118: ["label", "flow"], 119: ["jump-label", "flow"], 124: ["timer", "state"],
  125: ["change-money", "gameplay"], 126: ["change-items", "gameplay"], 127: ["change-weapons", "gameplay"], 128: ["change-armor", "gameplay"],
  129: ["change-party", "gameplay"], 131: ["change-windowskin", "visual"], 132: ["change-battle-music", "audio"],
  133: ["change-battle-end-music", "audio"], 134: ["change-save-access", "gameplay"], 135: ["change-menu-access", "gameplay"],
  136: ["change-encounter-access", "gameplay"], 204: ["change-map-settings", "visual"], 205: ["change-fog-tone", "visual"],
  206: ["change-fog-opacity", "visual"], 207: ["show-animation", "visual"], 208: ["change-transparency", "visual"],
  210: ["wait-for-movement", "movement"], 221: ["prepare-transition", "transition"], 222: ["execute-transition", "transition"],
  226: ["weather", "visual"], 231: ["show-picture", "visual"], 232: ["move-picture", "visual"], 233: ["rotate-picture", "visual"],
  234: ["picture-tone", "visual"], 235: ["erase-picture", "visual"], 236: ["weather", "visual"], 242: ["fade-music", "audio"],
  246: ["fade-background-sound", "audio"], 247: ["memorize-audio", "audio"], 248: ["restore-audio", "audio"],
  251: ["stop-sound", "audio"], 301: ["start-battle", "gameplay"], 302: ["open-shop", "gameplay"],
  303: ["name-input", "dialogue"], 311: ["change-hp", "gameplay"], 312: ["change-sp", "gameplay"],
  313: ["change-state", "gameplay"], 314: ["recover-all", "gameplay"], 315: ["change-exp", "gameplay"],
  316: ["change-level", "gameplay"], 317: ["change-parameters", "gameplay"], 318: ["change-skills", "gameplay"],
  319: ["change-equipment", "gameplay"], 320: ["change-actor-name", "gameplay"], 321: ["change-actor-class", "gameplay"],
  322: ["change-actor-graphic", "visual"], 331: ["change-enemy-hp", "gameplay"], 332: ["change-enemy-sp", "gameplay"],
  333: ["change-enemy-state", "gameplay"], 334: ["enemy-recover-all", "gameplay"], 335: ["enemy-appear", "gameplay"],
  336: ["enemy-transform", "gameplay"], 337: ["battle-animation", "visual"], 338: ["deal-damage", "gameplay"],
  339: ["force-action", "gameplay"], 340: ["abort-battle", "gameplay"], 351: ["open-menu", "gameplay"],
  352: ["open-save", "gameplay"], 353: ["game-over", "gameplay"], 354: ["return-title", "gameplay"], 605: ["shop-goods", "gameplay"],
};

export function convertEventCommand(value: RubyMarshalValue, sourceIndex: number): EventAstCommand {
  const eventCommand = rubyObject(value, "RPG::EventCommand", `commande ${sourceIndex}`);
  const code = numberValue(eventCommand.ivars["@code"]);
  const indent = numberValue(eventCommand.ivars["@indent"]);
  const rawParameters = eventCommand.ivars["@parameters"];
  if (code === null || indent === null || !Array.isArray(rawParameters)) throw new TypeError(`Commande ${sourceIndex} invalide.`);
  const p = rawParameters;
  const genericData = (): JsonValue => ({ parameters: p.map(rubyValueToJson) });
  switch (code) {
    case 0: return command("end", "flow", "converted", code, indent, sourceIndex);
    case 101: return command("show-text", "dialogue", "converted", code, indent, sourceIndex, { text: rubyText(p[0] ?? null) ?? "" });
    case 401: return command("text-continuation", "dialogue", "converted", code, indent, sourceIndex, { text: rubyText(p[0] ?? null) ?? "" });
    case 102: return command("show-choices", "dialogue", "converted", code, indent, sourceIndex, { choices: Array.isArray(p[0]) ? p[0].map((entry) => rubyText(entry) ?? "") : [], cancelType: numberValue(p[1]) });
    case 402: return command("choice-branch", "dialogue", "converted", code, indent, sourceIndex, { choiceIndex: numberValue(p[0]), text: rubyText(p[1] ?? null) ?? "" });
    case 403: return command("choice-cancel", "dialogue", "converted", code, indent, sourceIndex);
    case 404: return command("choice-end", "dialogue", "converted", code, indent, sourceIndex);
    case 106: return command("wait", "flow", "converted", code, indent, sourceIndex, { frames: numberValue(p[0]) });
    case 111: { const condition = conditionData(p); return command("condition", "flow", condition.status, code, indent, sourceIndex, condition.data); }
    case 411: return command("else", "flow", "converted", code, indent, sourceIndex);
    case 412: return command("condition-end", "flow", "converted", code, indent, sourceIndex);
    case 413: return command("loop-repeat", "flow", "converted", code, indent, sourceIndex);
    case 121: return command("set-switches", "state", "converted", code, indent, sourceIndex, { firstId: numberValue(p[0]), lastId: numberValue(p[1]), value: p[2] === 0 });
    case 122: return command("change-variables", "state", "converted", code, indent, sourceIndex, { firstId: numberValue(p[0]), lastId: numberValue(p[1]), operation: ["set", "add", "subtract", "multiply", "divide", "modulo"][numberValue(p[2]) ?? -1] ?? "unknown", operand: variableOperand(p) });
    case 123: return command("set-self-switch", "state", "converted", code, indent, sourceIndex, { id: rubyText(p[0] ?? null) ?? "", value: p[1] === 0 });
    case 201: return command("transfer-player", "transition", "converted", code, indent, sourceIndex, { addressing: p[0] === 0 ? "direct" : "variables", map: numberValue(p[1]), x: numberValue(p[2]), y: numberValue(p[3]), direction: numberValue(p[4]), fade: numberValue(p[5]) });
    case 202: return command("set-event-location", "movement", "converted", code, indent, sourceIndex, { eventId: numberValue(p[0]), addressing: ["direct", "variables", "exchange"][numberValue(p[1]) ?? -1] ?? "unknown", x: numberValue(p[2]), y: numberValue(p[3]), direction: numberValue(p[4]) });
    case 203: return command("scroll-map", "movement", "converted", code, indent, sourceIndex, { direction: numberValue(p[0]), distance: numberValue(p[1]), speed: numberValue(p[2]) });
    case 209: {
      const route = convertMoveRoute(p[1] ?? null);
      const routeJson = route as { readonly steps?: readonly JsonValue[] };
      const statuses = routeJson.steps?.map((step) => (step as { readonly status?: JsonValue }).status) ?? [];
      const status = statuses.includes("raw") ? "raw" : statuses.includes("reference-only") ? "reference-only" : "converted";
      return command("move-route", "movement", status, code, indent, sourceIndex, { target: numberValue(p[0]), route });
    }
    case 509: {
      const step = convertMoveCommand(p[0] ?? null, sourceIndex);
      const stepStatus = (step as { readonly status?: JsonValue }).status;
      const status = stepStatus === "raw" ? "raw" : stepStatus === "reference-only" ? "reference-only" : "converted";
      return command("move-route-continuation", "movement", status, code, indent, sourceIndex, { step });
    }
    case 223: return command("screen-tone", "visual", "converted", code, indent, sourceIndex, { tone: tuple(p[0], "Tone"), duration: numberValue(p[1]) });
    case 224: return command("screen-flash", "visual", "converted", code, indent, sourceIndex, { color: tuple(p[0], "Color"), duration: numberValue(p[1]) });
    case 225: return command("screen-shake", "visual", "converted", code, indent, sourceIndex, { power: numberValue(p[0]), speed: numberValue(p[1]), duration: numberValue(p[2]) });
    case 241: return command("play-music", "audio", "converted", code, indent, sourceIndex, { audio: audio(p[0]) });
    case 245: return command("play-background-sound", "audio", "converted", code, indent, sourceIndex, { audio: audio(p[0]) });
    case 249: return command("play-jingle", "audio", "converted", code, indent, sourceIndex, { audio: audio(p[0]) });
    case 250: return command("play-sound", "audio", "converted", code, indent, sourceIndex, { audio: audio(p[0]) });
    case 355: case 655: return command(code === 355 ? "ruby-script" : "ruby-script-continuation", "script", "reference-only", code, indent, sourceIndex, { source: rubyText(p[0] ?? null) ?? "" });
    default: {
      const known = GENERIC_STANDARD[code];
      return known === undefined
        ? command("raw", "unknown", "raw", code, indent, sourceIndex, genericData())
        : command(known[0], known[1], "converted", code, indent, sourceIndex, genericData());
    }
  }
}

export interface EventPageAst {
  readonly condition: JsonValue;
  readonly graphic: JsonValue;
  readonly settings: JsonValue;
  readonly commands: readonly EventAstCommand[];
}

export function convertEventPage(value: RubyMarshalValue): EventPageAst {
  const page = rubyObject(value, "RPG::Event::Page", "page d'evenement");
  const condition = rubyObject(page.ivars["@condition"] ?? null, "RPG::Event::Page::Condition", "condition de page");
  const graphic = rubyObject(page.ivars["@graphic"] ?? null, "RPG::Event::Page::Graphic", "graphique de page");
  const list = page.ivars["@list"];
  if (!Array.isArray(list)) throw new TypeError("RPG::Event::Page.@list doit etre un tableau.");
  return {
    condition: {
      switch1Id: boolValue(condition.ivars["@switch1_valid"]) ? numberValue(condition.ivars["@switch1_id"]) : null,
      switch2Id: boolValue(condition.ivars["@switch2_valid"]) ? numberValue(condition.ivars["@switch2_id"]) : null,
      variable: boolValue(condition.ivars["@variable_valid"]) ? { id: numberValue(condition.ivars["@variable_id"]), minimum: numberValue(condition.ivars["@variable_value"]) } : null,
      selfSwitch: boolValue(condition.ivars["@self_switch_valid"]) ? rubyText(condition.ivars["@self_switch_ch"] ?? null) : null,
    },
    graphic: {
      tileId: numberValue(graphic.ivars["@tile_id"]), characterName: rubyText(graphic.ivars["@character_name"] ?? null) ?? "",
      hue: numberValue(graphic.ivars["@character_hue"]), direction: numberValue(graphic.ivars["@direction"]),
      pattern: numberValue(graphic.ivars["@pattern"]), opacity: numberValue(graphic.ivars["@opacity"]), blendType: numberValue(graphic.ivars["@blend_type"]),
    },
    settings: {
      moveType: numberValue(page.ivars["@move_type"]), moveSpeed: numberValue(page.ivars["@move_speed"]), moveFrequency: numberValue(page.ivars["@move_frequency"]),
      moveRoute: convertMoveRoute(page.ivars["@move_route"] ?? null), walkAnimation: boolValue(page.ivars["@walk_anime"]),
      stepAnimation: boolValue(page.ivars["@step_anime"]), directionFix: boolValue(page.ivars["@direction_fix"]),
      through: boolValue(page.ivars["@through"]), alwaysOnTop: boolValue(page.ivars["@always_on_top"]), trigger: numberValue(page.ivars["@trigger"]),
    },
    commands: list.map(convertEventCommand),
  };
}
