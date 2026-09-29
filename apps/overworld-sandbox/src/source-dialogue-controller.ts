import { dialogueLines, type ImportedEventPage } from "./imported-map.js";
import { resolveEventFlow, type EventFlowResult } from "./source-event-flow.js";
import type { SourceEventState } from "./source-event-state.js";

export type SourceDialogueSession = Readonly<{
  label: string;
  mapId: number;
  eventId: number;
  page: ImportedEventPage;
  translations: ReadonlyMap<string, string>;
  selections: readonly number[];
  lines: readonly string[];
  index: number;
  shownLines: number;
  flow: EventFlowResult;
  choosing: boolean;
}>;

export interface SourceDialogueUpdate {
  readonly changed: boolean;
  readonly completed: SourceDialogueSession | null;
}

interface MutableSourceDialogueSession {
  readonly label: string;
  readonly mapId: number;
  readonly eventId: number;
  readonly page: ImportedEventPage;
  readonly translations: ReadonlyMap<string, string>;
  readonly selections: number[];
  lines: readonly string[];
  index: number;
  shownLines: number;
  flow: EventFlowResult;
  choosing: boolean;
}

const UNCHANGED: SourceDialogueUpdate = { changed: false, completed: null };

export class SourceDialogueController {
  private activeSession: MutableSourceDialogueSession | null = null;

  public get current(): SourceDialogueSession | null {
    return this.activeSession;
  }

  public begin(page: ImportedEventPage, mapId: number, eventId: number, label: string,
    translations: ReadonlyMap<string, string>, state: SourceEventState, playerDirection: number): SourceDialogueUpdate {
    const session: MutableSourceDialogueSession = {
      label,
      mapId,
      eventId,
      page,
      translations,
      selections: [],
      lines: [],
      index: 0,
      shownLines: 0,
      flow: resolveEventFlow(page, [], state, mapId, eventId, { playerDirection }),
      choosing: false,
    };
    this.activeSession = session;
    return this.refresh(session, state, playerDirection);
  }

  public advance(): SourceDialogueUpdate {
    const session = this.activeSession;
    if (session === null || session.choosing) return UNCHANGED;
    if (session.index + 1 < session.lines.length) {
      session.index += 1;
      return { changed: true, completed: null };
    }
    session.shownLines += session.lines.length;
    session.lines = [];
    session.index = 0;
    session.choosing = session.flow.pendingChoice !== null;
    return session.choosing ? { changed: true, completed: null } : this.finish(session);
  }

  public choose(index: number, state: SourceEventState, playerDirection: number): SourceDialogueUpdate {
    const session = this.activeSession;
    if (session === null || !session.choosing) return UNCHANGED;
    const pending = session.flow.pendingChoice;
    if (pending === null || index < 0 || index >= pending.choices.length) return UNCHANGED;
    session.selections.push(index);
    return this.refresh(session, state, playerDirection);
  }

  public cancel(): boolean {
    if (this.activeSession === null) return false;
    this.activeSession = null;
    return true;
  }

  private refresh(session: MutableSourceDialogueSession, state: SourceEventState,
    playerDirection: number): SourceDialogueUpdate {
    session.flow = resolveEventFlow(session.page, session.selections, state, session.mapId, session.eventId,
      { playerDirection });
    const allLines = dialogueLines(session.flow.page, session.translations);
    session.lines = allLines.slice(session.shownLines);
    session.index = 0;
    session.choosing = session.lines.length === 0 && session.flow.pendingChoice !== null;
    return session.lines.length === 0 && !session.choosing
      ? this.finish(session)
      : { changed: true, completed: null };
  }

  private finish(session: MutableSourceDialogueSession): SourceDialogueUpdate {
    if (this.activeSession === session) this.activeSession = null;
    return { changed: true, completed: session };
  }
}
