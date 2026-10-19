import type { ImportedEventPage } from "./imported-map.js";
import type { SourceEventState } from "./source-event-state.js";
import { parseSourceAblePokemonCountCondition, parseSourceInventoryQuantityCondition, portSourceRubyCommand,
  portSourceRubyCondition, isSourceDayCareEggServicePage, isSourceDayCareServicePage } from "./source-script-ports.js";
import { parseSourceMoveRoute } from "./source-move-route.js";
import { isKnownSourceCommand } from "./source-command-registry.js";
import { portSourcePokeVialCommand } from "./source-poke-vial.js";
import { sourcePartySpellsUnownEterno } from "./source-unown-puzzle.js";

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

export interface EventFlowContext {
  readonly playerDirection: number;
  readonly movementTestUnlocks?: boolean;
}

function integer(value: unknown): value is number {
  return Number.isInteger(value);
}

function compareInventoryQuantity(left: number, comparator: string, right: number): boolean {
  switch (comparator) {
    case "<": return left < right;
    case "<=": return left <= right;
    case "==": return left === right;
    case "!=": return left !== right;
    case ">=": return left >= right;
    case ">": return left > right;
    default: return false;
  }
}

function evaluateCondition(command: EventCommand, state: SourceEventState, mapId: number, eventId: number,
  context?: EventFlowContext): boolean | null {
  const kind = command.data.kind;
  const operands = command.data.operands;
  if (typeof kind !== "string") return null;
  if (kind === "ruby-script" && typeof command.data.script === "string") {
    if (command.data.script.trim() === "unown_check") return sourcePartySpellsUnownEterno(state.party);
    const condition = parseSourceInventoryQuantityCondition(command.data.script);
    if (condition !== null) {
      const movementItem = condition.itemId === "SURFMONTURA" || /^BICYCLE\d*$/u.test(condition.itemId);
      const owned = movementItem && context?.movementTestUnlocks === true
        ? Math.max(state.inventory[condition.itemId] ?? 0, 1)
        : state.inventory[condition.itemId] ?? 0;
      return compareInventoryQuantity(owned, condition.comparator, condition.quantity);
    }
    const ablePokemon = parseSourceAblePokemonCountCondition(command.data.script);
    if (ablePokemon !== null) {
      const count = state.party.members.filter((pokemon) => pokemon.hp > 0 && pokemon.metadata.eggSteps <= 0).length;
      return compareInventoryQuantity(count, ablePokemon.comparator, ablePokemon.quantity);
    }
    return null;
  }
  if (!Array.isArray(operands)) return null;
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
  if (kind === "gold") {
    const [amount, comparison] = operands;
    return integer(amount) && amount >= 0 && integer(comparison)
      ? comparison === 0 ? state.money >= amount : comparison === 1 ? state.money <= amount : null
      : null;
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
  if (isSourceDayCareEggServicePage(page)) {
    const source = page.commands.find((command) => command.kind === "ruby-script" || command.kind === "condition")
      ?? page.commands[0];
    if (source !== undefined) return { page: { ...page, commands: [{ ...source, kind: "open-day-care-eggs", text: null,
      indent: 0, data: { policy: "PERSONAL" } }] }, pendingChoice: null, complete: true,
      blockedReason: null, consumedChoices: 0 };
  }
  if (isSourceDayCareServicePage(page)) {
    const source = page.commands.find((command) => command.kind === "ruby-script" || command.kind === "condition")
      ?? page.commands[0];
    if (source !== undefined) return { page: { ...page, commands: [{ ...source, kind: "open-day-care", text: null,
      indent: 0, data: { policy: "PERSONAL" } }] }, pendingChoice: null, complete: true,
      blockedReason: null, consumedChoices: 0 };
  }
  const output: EventCommand[] = [];
  let selectionCursor = 0;
  let pendingChoice: PendingEventChoice | null = null;
  let blockedReason: string | null = null;
  const commands = page.commands;
  const projectedInventory: Record<string, number> = { ...state.inventory };

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
        const result = evaluateCondition(command, { ...state, inventory: projectedInventory }, mapId, eventId, context);
        if (result === null) {
          const deferred = portSourceRubyCondition(command);
          if (deferred === null) {
            blockedReason = `condition ${String(command.data.kind ?? "inconnue")} non prise en charge`;
            return false;
          }
          output.push(deferred);
          if (!walk(index + 1, otherwise < 0 ? conditionEnd : otherwise)) return false;
          index = conditionEnd + 1;
          continue;
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
      let consumedCommands = 1;
      let sourceCommand = command;
      if (command.kind === "ruby-script" && typeof command.data.source === "string") {
        const lines = [command.data.source];
        while (index + consumedCommands < end) {
          const continuation = commands[index + consumedCommands];
          if (continuation?.kind !== "ruby-script-continuation" || continuation.indent !== command.indent
            || typeof continuation.data.source !== "string") break;
          lines.push(continuation.data.source);
          consumedCommands += 1;
        }
        sourceCommand = { ...command, data: { ...command.data, source: lines.join("\n") } };
      }
      const executable = sourceCommand.kind === "ruby-script" ? portSourceRubyCommand(sourceCommand)
        : sourceCommand.kind === "recover-all" ? { ...sourceCommand, kind: "heal-party" }
          : portSourcePokeVialCommand(sourceCommand) ?? sourceCommand;
      if (executable === null || !isKnownSourceCommand(executable.kind)) {
        blockedReason = `commande ${command.kind} non prise en charge`;
        return false;
      }
      if (executable.kind === "move-route" && parseSourceMoveRoute(executable.data.route) === null) {
        blockedReason = "route de mouvement invalide";
        return false;
      }
      output.push(executable);
      if ((executable.kind === "grant-item" || executable.kind === "remove-item")
        && typeof executable.data.itemId === "string" && Number.isSafeInteger(executable.data.quantity)) {
        const itemId = executable.data.itemId;
        const quantity = executable.data.quantity as number;
        const current = projectedInventory[itemId] ?? 0;
        const next = executable.kind === "grant-item" ? current + quantity : current - quantity;
        if (next <= 0) delete projectedInventory[itemId];
        else projectedInventory[itemId] = next;
      }
      index += consumedCommands;
    }
    return true;
  };

  const complete = walk(0, commands.length);
  return { page: { ...page, commands: output }, pendingChoice, complete,
    blockedReason, consumedChoices: selectionCursor };
}
