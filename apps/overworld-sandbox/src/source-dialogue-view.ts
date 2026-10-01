import { localizedDialogueText } from "./imported-map.js";
import type { SourceDialogueSession } from "./source-dialogue-controller.js";
import { escapeSourceHtml } from "./source-menu-view.js";

export function sourceDialogueHint(session: Pick<SourceDialogueSession, "choosing" | "index" | "lines">): string {
  if (session.choosing) return "Choisissez une réponse · Échap pour annuler";
  return session.index + 1 < session.lines.length
    ? `Espace/Entrée · ${session.index + 1}/${session.lines.length}`
    : "Espace/Entrée pour continuer";
}

export class SourceDialogueView {
  public constructor(private readonly onChoose: (index: number) => void) {}

  public render(session: SourceDialogueSession | null, visible: boolean): void {
    const panel = document.querySelector<HTMLElement>("#source-dialogue");
    if (panel === null) return;
    panel.hidden = session === null || !visible;
    if (session === null || !visible) return;
    const label = panel.querySelector<HTMLElement>("strong");
    if (label !== null) label.textContent = session.label;
    const text = panel.querySelector<HTMLElement>("p");
    if (text !== null) {
      text.hidden = session.choosing;
      text.textContent = session.lines[session.index] ?? "";
    }
    this.renderChoices(panel, session);
    const hint = panel.querySelector<HTMLElement>("small");
    if (hint !== null) hint.textContent = sourceDialogueHint(session);
  }

  private renderChoices(panel: HTMLElement, session: SourceDialogueSession): void {
    const choices = panel.querySelector<HTMLElement>(".source-choices");
    if (choices === null) return;
    const pending = session.flow.pendingChoice;
    choices.hidden = !session.choosing || pending === null;
    choices.innerHTML = !session.choosing || pending === null ? "" : pending.choices.map((choice, index) =>
      `<button type="button" data-source-choice="${index}"><span>${index + 1}</span>${escapeSourceHtml(localizedDialogueText(choice, session.translations))}</button>`).join("");
    choices.querySelectorAll<HTMLButtonElement>("[data-source-choice]").forEach((button) =>
      button.addEventListener("click", () => {
        const index = Number(button.dataset.sourceChoice);
        if (Number.isInteger(index)) this.onChoose(index);
      }));
  }
}
