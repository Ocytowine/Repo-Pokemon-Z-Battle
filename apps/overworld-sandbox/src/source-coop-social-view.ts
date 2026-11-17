import type { SocialEmoji, SocialTeamMember } from "@pokemon-z-battle/multiplayer-protocol";

export const SOCIAL_EMOJI: Readonly<Record<SocialEmoji, string>> = {
  wave: "👋", heart: "❤️", happy: "😊", surprised: "😮", sad: "😢", idea: "💡",
};

export interface CoopSocialMessage {
  readonly side: "player" | "opponent";
  readonly kind: "invite" | "text" | "emoji" | "team";
  readonly text?: string;
  readonly emoji?: SocialEmoji;
  readonly team?: readonly SocialTeamMember[];
  readonly sentAt: number;
}

export interface CoopSocialDisplay {
  readonly active: boolean;
  readonly ownSide: "player" | "opponent" | null;
  readonly mutual: boolean;
  readonly remoteVisible: boolean;
  readonly remoteX: number;
  readonly remoteY: number;
  readonly ownX: number;
  readonly ownY: number;
  readonly remoteName: string;
  readonly remoteSprite: HTMLImageElement | null;
}

/** Ephemeral room UI: only the room receives text; no save or cloud data is written. */
export class SourceCoopSocialView {
  private readonly root: HTMLElement;
  private readonly bubble: HTMLButtonElement;
  private readonly shortcut: HTMLButtonElement;
  private readonly ownEmoji: HTMLElement;
  private readonly emojiToggle: HTMLButtonElement;
  private readonly emojiPalette: HTMLElement;
  private readonly shortcutName: HTMLElement;
  private readonly shortcutSprite: HTMLCanvasElement;
  private readonly panel: HTMLElement;
  private readonly messagesRoot: HTMLElement;
  private readonly textarea: HTMLTextAreaElement;
  private readonly sendButton: HTMLButtonElement;
  private readonly status: HTMLElement;
  private messages: CoopSocialMessage[] = [];
  private pendingRemote = false;
  private remoteEmoji: SocialEmoji | null = null;
  private ownEmojiValue: SocialEmoji | null = null;
  private remoteEmojiUntil = 0;
  private ownEmojiUntil = 0;
  private shortcutSpriteSource: HTMLImageElement | null = null;
  private open = false;
  private display: CoopSocialDisplay = { active: false, ownSide: null, mutual: false,
    remoteVisible: false, remoteX: 0, remoteY: 0, ownX: 50, ownY: 50,
    remoteName: "Joueur", remoteSprite: null };

  constructor(stage: HTMLElement, private readonly send: (kind: "text" | "emoji", value: string) => boolean,
    private readonly shareTeam: () => boolean) {
    stage.insertAdjacentHTML("beforeend", `<div id="source-coop-social" class="source-coop-social">
      <button type="button" class="source-coop-social-bubble" aria-label="Ouvrir la conversation" hidden>…</button>
      <span class="source-coop-social-own-emoji" hidden></span>
      <button type="button" class="source-coop-social-shortcut" aria-label="Un joueur veut vous parler" hidden><canvas width="48" height="48"></canvas><span><strong></strong><small>veut te parler</small></span></button>
      <button type="button" class="source-coop-emoji-toggle" aria-label="Envoyer un émoji" hidden>😊</button>
      <div class="source-coop-emoji-palette" hidden></div>
      <section class="source-coop-chat" aria-label="Conversation Coop" hidden>
        <header><strong>Conversation</strong><button type="button" data-chat-close aria-label="Fermer la conversation">✕</button></header>
        <div class="source-coop-chat-messages" aria-live="polite"></div>
        <p class="source-coop-chat-status"></p>
        <div class="source-coop-chat-emojis"></div>
        <button type="button" class="source-coop-chat-team">Montrer mon équipe</button>
        <form class="source-coop-chat-compose"><textarea rows="1" maxlength="140" placeholder="Écrire un message…" aria-label="Message Coop"></textarea><button type="submit">Envoyer</button></form>
      </section></div>`);
    this.root = stage.querySelector<HTMLElement>("#source-coop-social")!;
    this.bubble = this.root.querySelector<HTMLButtonElement>(".source-coop-social-bubble")!;
    this.shortcut = this.root.querySelector<HTMLButtonElement>(".source-coop-social-shortcut")!;
    this.ownEmoji = this.root.querySelector<HTMLElement>(".source-coop-social-own-emoji")!;
    this.emojiToggle = this.root.querySelector<HTMLButtonElement>(".source-coop-emoji-toggle")!;
    this.emojiPalette = this.root.querySelector<HTMLElement>(".source-coop-emoji-palette")!;
    this.shortcutName = this.shortcut.querySelector("strong")!;
    this.shortcutSprite = this.shortcut.querySelector("canvas")!;
    this.panel = this.root.querySelector<HTMLElement>(".source-coop-chat")!;
    this.messagesRoot = this.panel.querySelector<HTMLElement>(".source-coop-chat-messages")!;
    this.textarea = this.panel.querySelector("textarea")!;
    this.sendButton = this.panel.querySelector<HTMLButtonElement>("[type=submit]")!;
    this.status = this.panel.querySelector<HTMLElement>(".source-coop-chat-status")!;
    this.bubble.addEventListener("click", () => this.show());
    this.shortcut.addEventListener("click", () => this.show());
    this.emojiToggle.addEventListener("click", () => {
      this.emojiPalette.hidden = !this.emojiPalette.hidden;
    });
    this.panel.querySelector("[data-chat-close]")?.addEventListener("click", () => this.hide());
    this.panel.querySelector(".source-coop-chat-team")?.addEventListener("click", () => {
      if (this.display.mutual) this.shareTeam();
    });
    this.panel.querySelector("form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = this.textarea.value.trim();
      if (!this.display.mutual || !text || !this.send("text", text)) return;
      this.textarea.value = "";
    });
    this.textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        this.panel.querySelector<HTMLFormElement>("form")?.requestSubmit();
      }
    });
    const emojis = this.panel.querySelector<HTMLElement>(".source-coop-chat-emojis")!;
    for (const [id, glyph] of Object.entries(SOCIAL_EMOJI)) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = glyph;
      button.title = id;
      button.addEventListener("click", () => { if (this.display.mutual) this.send("emoji", id); });
      emojis.append(button);
      const quick = button.cloneNode(true) as HTMLButtonElement;
      quick.addEventListener("click", () => {
        this.emojiPalette.hidden = true;
        if (this.display.mutual) this.send("emoji", id);
      });
      this.emojiPalette.append(quick);
    }
  }

  receive(message: CoopSocialMessage): void {
    if (message.kind === "emoji" && message.emoji !== undefined) {
      if (message.side === this.display.ownSide) {
        this.ownEmojiValue = message.emoji;
        this.ownEmojiUntil = Date.now() + 3_000;
      } else {
        this.remoteEmoji = message.emoji;
        this.remoteEmojiUntil = Date.now() + 3_000;
      }
      window.setTimeout(() => this.sync(this.display), 3_100);
    }
    if (message.kind === "text" || message.kind === "emoji" || message.kind === "team") {
      this.messages.push(message);
      this.messages = this.messages.slice(-30);
      this.renderMessages();
    }
    if (message.side !== this.display.ownSide && message.kind !== "emoji") this.pendingRemote = true;
    this.sync(this.display);
  }

  sync(display: CoopSocialDisplay): void {
    this.display = display;
    if (!display.active && this.open) this.hide();
    this.root.hidden = !display.active;
    const remoteEmojiActive = this.remoteEmoji !== null && Date.now() < this.remoteEmojiUntil;
    const ownEmojiActive = this.ownEmojiValue !== null && Date.now() < this.ownEmojiUntil;
    this.bubble.textContent = remoteEmojiActive ? SOCIAL_EMOJI[this.remoteEmoji!] : "…";
    this.bubble.hidden = !display.active || !(this.pendingRemote || remoteEmojiActive) || this.open || !display.mutual
      || !display.remoteVisible;
    this.shortcut.hidden = !display.active || !this.pendingRemote || this.open || !this.bubble.hidden;
    this.ownEmoji.hidden = !display.active || !ownEmojiActive || this.open || !display.mutual;
    this.ownEmoji.textContent = ownEmojiActive ? SOCIAL_EMOJI[this.ownEmojiValue!] : "";
    this.ownEmoji.style.left = `${display.ownX}%`;
    this.ownEmoji.style.top = `${display.ownY}%`;
    this.emojiToggle.hidden = !display.active || !display.mutual || this.open;
    if (this.emojiToggle.hidden) this.emojiPalette.hidden = true;
    this.bubble.style.left = `${display.remoteX}%`;
    this.bubble.style.top = `${display.remoteY}%`;
    this.shortcutName.textContent = display.remoteName;
    this.panel.querySelector("header strong")!.textContent = display.remoteName;
    this.status.textContent = display.mutual ? "Vous vous voyez : la conversation est ouverte."
      : "Rapprochez-vous jusqu’à voir vos deux personnages pour écrire.";
    this.textarea.disabled = !display.mutual;
    this.sendButton.disabled = !display.mutual;
    this.panel.querySelectorAll<HTMLButtonElement>(".source-coop-chat-emojis button")
      .forEach((button) => { button.disabled = !display.mutual; });
    this.panel.querySelector<HTMLButtonElement>(".source-coop-chat-team")!.disabled = !display.mutual;
    const context = this.shortcutSprite.getContext("2d");
    if (context !== null && display.remoteSprite !== this.shortcutSpriteSource) {
      context.clearRect(0, 0, 48, 48);
      const sprite = display.remoteSprite;
      this.shortcutSpriteSource = null;
      if (sprite?.complete && sprite.naturalWidth > 0) {
        this.shortcutSpriteSource = sprite;
        context.imageSmoothingEnabled = false;
        context.drawImage(sprite, 0, 0, sprite.naturalWidth / 4, sprite.naturalHeight / 4,
          0, 0, 48, 48);
      }
    }
  }

  show(): void {
    if (!this.display.active) return;
    this.open = true;
    this.pendingRemote = false;
    this.panel.hidden = false;
    this.sync(this.display);
    this.renderMessages();
    if (this.display.mutual) this.textarea.focus();
  }

  hide(): void {
    this.open = false;
    this.panel.hidden = true;
    this.textarea.blur();
    this.sync(this.display);
  }

  reset(): void {
    this.messages = [];
    this.pendingRemote = false;
    this.remoteEmoji = null;
    this.ownEmojiValue = null;
    this.shortcutSpriteSource = null;
    this.hide();
    this.renderMessages();
  }

  private renderMessages(): void {
    this.messagesRoot.replaceChildren();
    for (const message of this.messages) {
      const item = document.createElement("p");
      item.className = message.side === this.display.ownSide ? "own" : "remote";
      item.textContent = message.kind === "emoji" ? SOCIAL_EMOJI[message.emoji ?? "wave"]
        : message.kind === "team" ? (message.team?.length
          ? `Équipe : ${message.team.map((member) => `${member.name} · N.${member.level}`).join("  /  ")}`
          : "Équipe vide") : message.text ?? "";
      this.messagesRoot.append(item);
    }
    this.messagesRoot.scrollTop = this.messagesRoot.scrollHeight;
  }
}
