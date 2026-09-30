import type { ImportedEventPage, ImportedMapEvent } from "./imported-map.js";
import { sourceCommandCapability, type SourceCommandCapability } from "./source-command-registry.js";
import { parseSourceMoveRoute, sourceMoveRouteIsExecutable } from "./source-move-route.js";

type EventCommand = ImportedEventPage["commands"][number];

export interface SourceSceneStep {
  readonly index: number;
  readonly command: EventCommand;
  readonly capability: SourceCommandCapability | null;
}

export interface SourceSceneAudit {
  readonly commandCount: number;
  readonly counts: Readonly<Record<string, number>>;
  readonly unknownCommands: readonly string[];
  readonly invalidRoutes: readonly number[];
  readonly routeTargets: readonly number[];
  readonly missingTargets: readonly number[];
  readonly characterAssets: readonly string[];
  readonly missingCharacterAssets: readonly string[];
  readonly pendingPresentation: readonly string[];
  readonly complete: boolean;
}

export interface SourceScenePlan {
  readonly page: ImportedEventPage;
  readonly steps: readonly SourceSceneStep[];
  readonly audit: SourceSceneAudit;
}

function routeCharacters(command: EventCommand): readonly string[] {
  const route = command.kind === "move-route" ? parseSourceMoveRoute(command.data.route) : null;
  if (route === null) return [];
  return route.steps.flatMap((step) => step.kind === "change-graphic" && typeof step.parameters[0] === "string"
    && step.parameters[0] !== "" ? [step.parameters[0]] : []);
}

export function compileSourceScene(page: ImportedEventPage, events: readonly ImportedMapEvent[] = [],
  availableCharacters?: ReadonlySet<string>): SourceScenePlan {
  const steps = page.commands.map((command, index) =>
    ({ index, command, capability: sourceCommandCapability(command.kind) }));
  const counts: Record<string, number> = {};
  const unknownCommands = new Set<string>();
  const invalidRoutes: number[] = [];
  const routeTargets = new Set<number>();
  const characterAssets = new Set<string>();
  const pendingPresentation = new Set<string>();
  for (const step of steps) {
    const key = step.capability?.family ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    if (step.capability === null) unknownCommands.add(step.command.kind);
    if (step.capability?.support === "accepted") pendingPresentation.add(step.command.kind);
    if (step.command.kind !== "move-route") continue;
    const route = parseSourceMoveRoute(step.command.data.route);
    if (route === null || !sourceMoveRouteIsExecutable(route)) invalidRoutes.push(step.index);
    if (typeof step.command.data.target === "number") routeTargets.add(step.command.data.target);
    routeCharacters(step.command).forEach((name) => characterAssets.add(name));
  }
  const eventIds = new Set(events.map((event) => event.id));
  const missingTargets = [...routeTargets].filter((target) => target > 0 && !eventIds.has(target));
  const missingCharacterAssets = availableCharacters === undefined ? []
    : [...characterAssets].filter((name) => !availableCharacters.has(name));
  const audit: SourceSceneAudit = {
    commandCount: steps.length, counts, unknownCommands: [...unknownCommands], invalidRoutes,
    routeTargets: [...routeTargets], missingTargets, characterAssets: [...characterAssets], missingCharacterAssets,
    pendingPresentation: [...pendingPresentation],
    complete: unknownCommands.size === 0 && invalidRoutes.length === 0 && missingTargets.length === 0
      && missingCharacterAssets.length === 0,
  };
  return { page, steps, audit };
}

export function formatSourceSceneAudit(audit: SourceSceneAudit): string {
  const routes = audit.counts.movement ?? 0;
  const dialogues = audit.counts.dialogue ?? 0;
  const pending = audit.pendingPresentation.length === 0 ? "aucun rendu en attente"
    : `rendu en attente: ${audit.pendingPresentation.join(", ")}`;
  const issues = [
    ...(audit.unknownCommands.length === 0 ? [] : [`commandes inconnues: ${audit.unknownCommands.join(", ")}`]),
    ...(audit.invalidRoutes.length === 0 ? [] : [`routes invalides: ${audit.invalidRoutes.join(", ")}`]),
    ...(audit.missingTargets.length === 0 ? [] : [`cibles absentes: ${audit.missingTargets.join(", ")}`]),
    ...(audit.missingCharacterAssets.length === 0 ? [] : [`sprites absents: ${audit.missingCharacterAssets.join(", ")}`]),
  ];
  return `${audit.commandCount} commandes · ${dialogues} dialogues · ${routes} mouvements · ${pending}`
    + (issues.length === 0 ? "" : ` · erreurs: ${issues.join(" ; ")}`);
}
