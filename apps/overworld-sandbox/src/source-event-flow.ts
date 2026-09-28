import type { ImportedEventPage } from "./imported-map.js";
import type { SourceEventState } from "./source-event-state.js";
import { portSourceRubyCommand } from "./source-script-ports.js";

type EventCommand = ImportedEventPage["commands"][number];

export interface PendingEventChoice {
  readonly choices: readonly string[];
  readonly cancelType: number | null;
}

export interface EventFlowResult {
  readonly page: ImportedEventPage;
  readonly pendingChoice: PendingEventChoice | null;
  readonly complete: boolean;
  readonly blockedReason: string | null;
  readonly consumedChoices: number;
}

export interface EventFlowContext { readonly playerDirection: number }

const EXECUTABLE_COMMANDS = new Set(["show-text", "text-continuation", "set-switches", "set-self-switch", "change-variables",
  "grant-item", "remove-item", "set-checkpoint", "heal-party", "play-cry", "wait", "screen-tone", "play-jingle", "play-sound",
  "play-music", "play-background-sound", "show-animation", "screen-flash", "show-picture", "move-picture", "erase-picture",
  "move-route", "move-route-continuation", "wait-for-movement", "add-pokemon", "request-encounter", "set-follower", "end"]);

function integer(value: unknown): value is number {
  return Number.isInteger(value);
}

function evaluateCondition(command: EventCommand, state: SourceEventState, mapId: number, eventId: number,
  context?: EventFlowContext): boolean | null {
  const kind = command.data.kind;
  const operands = command.data.operands;
  if (typeof kind !== "string" || !Array.isArray(operands)) return null;
  if (kind === "switch") {
    const [id, expected] = operands;
    return integer(id) && integer(expected) ? (state.switches[String(id)] === true) === (expected === 0) : null;
  }
  if (kind === "self-switch") {
    const [id, expected] = operands;
    return typeof id === "string" && integer(expected)
      ? (state.selfSwitches[`${mapId}:${eventId}:${id}`] === true) === (expected === 0) : null;
  }
  if (kind === "variable") {
    const [id, operandKind, rawOperand, operator] = operands;
    if (!integer(id) || !integer(operandKind) || !integer(rawOperand) || !integer(operator)) return null;
    const left = state.variables[String(id)] ?? 0;
    const right = operandKind === 0 ? rawOperand : operandKind === 1 ? state.variables[String(rawOperand)] ?? 0 : null;
    if (right === null) return null;
    switch (operator) {
      case 0: return left === right;
      case 1: return left >= right;
      case 2: return left <= right;
      case 3: return left > right;
      case 4: return left < right;
      case 5: return left !== right;
      default: return null;
    }
  }
  if (kind === "character-direction") {
    const [characterId, direction] = operands;
    return integer(characterId) && characterId === -1 && integer(direction) && context !== undefined
      ? context.playerDirection === direction : null;
  }
  return null;
}

function matchingIndex(commands: readonly EventCommand[], start: number, end: number, indent: number, kinds: ReadonlySet<string>): number {
  for (let index = start; index < end; index += 1) {
    const command = commands[index];
    if (command !== undefined && command.indent === indent && kinds.has(command.kind)) return index;
  }
  return -1;
}

export function resolveEventFlow(page: ImportedEventPage, selections: readonly number[], state: SourceEventState,
  mapId: number, eventId: number, context?: EventFlowContext): EventFlowResult {
  const output: EventCommand[] = [];
  let selectionCursor = 0;
  let pendingChoice: PendingEventChoice | null = null;
  let blockedReason: string | null = null;
  const commands = page.commands;

  const walk = (start: number, end: number): boolean => {
    let index = start;
    while (index < end) {
      const command = commands[index];
      if (command === undefined) break;
      if (command.kind === "show-choices") {
        const choiceEnd = matchingIndex(commands, index + 1, end, command.indent, new Set(["choice-end"]));
        const choices = command.data.choices;
        if (choiceEnd < 0 || !Array.isArray(choices) || !choices.every((choice) => typeof choice === "string")) {
          blockedReason = "structure de choix invalide";
          return false;
        }
        if (selectionCursor >= selections.length) {
          pendingChoice = { choices, cancelType: integer(command.data.cancelType) ? command.data.cancelType : null };
          return false;
        }
        const selected = selections[selectionCursor++];
        if (!integer(selected) || selected < 0 || selected >= choices.length) {
          blockedReason = "réponse de choix invalide";
          return false;
        }
        let branch = -1;
        for (let cursor = index + 1; cursor < choiceEnd; cursor += 1) {
          const candidate = commands[cursor];
          if (candidate?.kind === "choice-branch" && candidate.indent === command.indent && candidate.data.choiceIndex === selected) {
            branch = cursor;
            break;
          }
        }
        if (branch < 0) {
          blockedReason = "branche de choix introuvable";
          return false;
        }
        const branchEnd = matchingIndex(commands, branch + 1, choiceEnd + 1, command.indent,
          new Set(["choice-branch", "choice-cancel", "choice-end"]));
        if (!walk(branch + 1, branchEnd < 0 ? choiceEnd : branchEnd)) return false;
        index = choiceEnd + 1;
        continue;
      }
      if (command.kind === "condition") {
        const conditionEnd = matchingIndex(commands, index + 1, end, command.indent, new Set(["condition-end"]));
        if (conditionEnd < 0) {
          blockedReason = "branche conditionnelle incomplète";
          return false;
        }
        const otherwise = matchingIndex(commands, index + 1, conditionEnd, command.indent, new Set(["else"]));
        const result = evaluateCondition(command, state, mapId, eventId, context);
        if (result === null) {
          blockedReason = `condition ${String(command.data.kind ?? "inconnue")} non prise en charge`;
          return false;
        }
        const branchStart = result ? index + 1 : otherwise < 0 ? conditionEnd : otherwise + 1;
        const branchEnd = result && otherwise >= 0 ? otherwise : conditionEnd;
        if (!walk(branchStart, branchEnd)) return false;
        index = conditionEnd + 1;
        continue;
      }
      if (["choice-branch", "choice-cancel", "choice-end", "else", "condition-end"].includes(command.kind)) {
        blockedReason = `marqueur ${command.kind} inattendu`;
        return false;
      }
      const executable = command.kind === "ruby-script" ? portSourceRubyCommand(command)
        : command.kind === "recover-all" ? { ...command, kind: "heal-party" } : command;
      if (executable === null || !EXECUTABLE_COMMANDS.has(executable.kind)) {
        blockedReason = `commande ${command.kind} non prise en charge`;
        return false;
      }
      output.push(executable);
      index += 1;
    }
    return true;
  };

  const complete = walk(0, commands.length);
  return { page: { ...page, commands: output }, pendingChoice, complete,
    blockedReason, consumedChoices: selectionCursor };
}
