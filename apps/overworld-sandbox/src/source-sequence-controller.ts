import type { SourceEventState } from "./source-event-state.js";
import type { PendingEventChoice } from "./source-event-flow.js";
import type { ImportedEventPage } from "./imported-map.js";
import type { SourceScenePlan } from "./source-scene-plan.js";
import { SourceSequenceRunner } from "./source-sequence-runner.js";

export interface SourceSequenceSession {
  readonly label: string;
  readonly mapId: number;
  readonly eventId: number;
  plan: SourceScenePlan;
  readonly translations: ReadonlyMap<string, string>;
  readonly sourcePage?: ImportedEventPage;
  selections: number[];
  pendingChoice: PendingEventChoice | null;
  cursor: number;
  advancing: boolean;
  autorunBaseline?: SourceEventState;
  readonly runner: SourceSequenceRunner;
  readonly onComplete?: () => void;
}

export interface SourceSequenceInput {
  readonly label: string;
  readonly mapId: number;
  readonly eventId: number;
  readonly plan: SourceScenePlan;
  readonly translations: ReadonlyMap<string, string>;
  readonly sourcePage?: ImportedEventPage;
  readonly selections?: readonly number[];
  readonly pendingChoice?: PendingEventChoice | null;
  readonly onComplete?: () => void;
  readonly runner?: SourceSequenceRunner;
}

export type SourceSequenceCommandResult = "continue" | "pause";

export interface SourceSequenceCallbacks {
  readonly dialogueActive: () => boolean;
  readonly onText: (session: SourceSequenceSession, page: ImportedEventPage) => void;
  readonly onChoice: (session: SourceSequenceSession, choice: PendingEventChoice) => void;
  readonly executeCommand: (session: SourceSequenceSession,
    command: ImportedEventPage["commands"][number]) => Promise<SourceSequenceCommandResult>;
  readonly onComplete: (session: SourceSequenceSession) => Promise<void> | void;
  readonly onError: (session: SourceSequenceSession, commandKind: string, error: unknown) => void;
}

export class SourceSequenceController {
  private activeSession: SourceSequenceSession | null = null;

  public constructor(private readonly callbacks: SourceSequenceCallbacks) {}

  public get current(): SourceSequenceSession | null { return this.activeSession; }

  public isActive(session: SourceSequenceSession): boolean { return this.activeSession === session; }

  public start(input: SourceSequenceInput): SourceSequenceSession {
    const session: SourceSequenceSession = {
      label: input.label,
      mapId: input.mapId,
      eventId: input.eventId,
      plan: input.plan,
      translations: input.translations,
      ...(input.sourcePage === undefined ? {} : { sourcePage: input.sourcePage }),
      selections: [...(input.selections ?? [])],
      pendingChoice: input.pendingChoice ?? null,
      cursor: 0,
      advancing: false,
      runner: input.runner ?? new SourceSequenceRunner(),
      ...(input.onComplete === undefined ? {} : { onComplete: input.onComplete }),
    };
    this.activeSession = session;
    void this.advance();
    return session;
  }

  public clear(session?: SourceSequenceSession): boolean {
    if (this.activeSession === null || (session !== undefined && this.activeSession !== session)) return false;
    this.activeSession = null;
    return true;
  }

  public async advance(): Promise<void> {
    const session = this.activeSession;
    if (session === null || session.advancing || this.callbacks.dialogueActive()) return;
    session.advancing = true;
    let currentCommand = "initialisation";
    try {
      while (this.activeSession === session && session.cursor < session.plan.steps.length) {
        const command = session.plan.steps[session.cursor]?.command;
        if (command === undefined) break;
        currentCommand = command.kind;
        if (command.kind === "show-text") {
          const dialogueCommands: ImportedEventPage["commands"][number][] = [command];
          session.cursor += 1;
          while (session.cursor < session.plan.steps.length) {
            const continuation = session.plan.steps[session.cursor]?.command;
            if (continuation === undefined || continuation.kind !== "text-continuation") break;
            dialogueCommands.push(continuation);
            session.cursor += 1;
          }
          this.callbacks.onText(session, { ...session.plan.page, commands: dialogueCommands });
          return;
        }
        session.cursor += 1;
        if (await this.callbacks.executeCommand(session, command) === "pause") return;
      }
      if (this.activeSession === session && session.pendingChoice !== null) {
        const choice = session.pendingChoice;
        session.pendingChoice = null;
        this.callbacks.onChoice(session, choice);
        return;
      }
      if (this.activeSession === session) {
        await session.runner.waitForMovement();
        if (this.activeSession !== session) return;
        this.activeSession = null;
        await this.callbacks.onComplete(session);
      }
    } catch (error) {
      if (this.activeSession === session) {
        this.activeSession = null;
        this.callbacks.onError(session, currentCommand, error);
      }
    } finally {
      session.advancing = false;
    }
  }
}
