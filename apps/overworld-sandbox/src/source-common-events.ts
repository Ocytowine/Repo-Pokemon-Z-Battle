import type { ImportedEventPage } from "./imported-map.js";

export type SourceEventCommand = ImportedEventPage["commands"][number];

export interface SourceCommonEvent {
  readonly id: number;
  readonly name: string;
  readonly commands: readonly SourceEventCommand[];
}

function commonEventId(command: SourceEventCommand): number | null {
  if (command.kind !== "call-common-event" || !Array.isArray(command.data.parameters)) return null;
  const id = command.data.parameters[0];
  return Number.isInteger(id) && (id as number) > 0 ? id as number : null;
}

/**
 * RPG Maker executes common events inline. Expanding them before scene compilation
 * keeps choices, conditions and audits on the same generic command pipeline.
 */
export function expandSourceCommonEvents(page: ImportedEventPage,
  commonEvents: ReadonlyMap<number, SourceCommonEvent>, maximumDepth = 16): ImportedEventPage {
  const expand = (commands: readonly SourceEventCommand[], stack: readonly number[], depth: number,
    indentOffset: number): SourceEventCommand[] => commands.flatMap((command) => {
      const id = commonEventId(command);
      if (id === null) return [{ ...command, indent: command.indent + indentOffset }];
      if (depth >= maximumDepth || stack.includes(id)) {
        return [{ ...command, indent: command.indent + indentOffset,
          data: { ...command.data, expansionError: stack.includes(id) ? "cycle" : "depth" } }];
      }
      const common = commonEvents.get(id);
      if (common === undefined) return [{ ...command, indent: command.indent + indentOffset,
        data: { ...command.data, expansionError: "missing" } }];
      return expand(common.commands, [...stack, id], depth + 1, indentOffset + command.indent);
    });
  return { ...page, commands: expand(page.commands, [], 0, 0) };
}
