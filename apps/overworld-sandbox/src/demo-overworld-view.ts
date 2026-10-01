import type { Direction, GridPoint, OverworldCatalog, OverworldEvent, OverworldState, WorldMap }
  from "@pokemon-z-battle/overworld-engine";

export type DemoAvatarId = "player" | "opponent";

export interface DemoRenderPosition {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
}

export interface DemoOverworldViewModel {
  readonly mapId: string;
  readonly state: OverworldState;
  readonly positions: Readonly<Record<DemoAvatarId, DemoRenderPosition>>;
  readonly events: readonly OverworldEvent[];
  readonly networkSide: DemoAvatarId | null;
}

export function demoEventText(event: OverworldEvent): string {
  switch (event.type) {
    case "directionChanged": return `${event.playerId} regarde vers ${event.direction}`;
    case "movementBlocked": return `${event.playerId} bloqué (${event.reason}) en ${event.at.x},${event.at.y}`;
    case "avatarMoved": return `${event.playerId} avance vers ${event.to.x},${event.to.y}`;
    case "mapChanged": return `${event.playerId} passe de ${event.fromMapId} à ${event.toMapId}`;
    case "interactionUnavailable": return `${event.playerId} : interaction indisponible (${event.reason})`;
    case "interactionPending": return `${event.playerId} attend son partenaire (${event.participants.join(", ")})`;
    case "dialogueShown": return `${event.playerId} · ${event.text}`;
    case "itemGranted": return `${event.playerId} reçoit ${event.quantity} × ${event.itemId}`;
    case "flagSet": return `${event.playerId} active ${event.flag}`;
    case "encounterRequested": return `${event.playerId} déclenche ${event.kind} · ${event.encounterId}`;
    case "interactionCompleted": return `${event.interactionId} terminé [${event.policy}]`;
  }
}

export class DemoOverworldView {
  public constructor(private readonly canvas: HTMLCanvasElement,
    private readonly context: CanvasRenderingContext2D,
    private readonly catalog: OverworldCatalog,
    private readonly tileSize: number) {}

  public render(model: DemoOverworldViewModel): void {
    const map = this.catalog.maps[model.mapId];
    if (map === undefined) throw new Error(`Missing map ${model.mapId}.`);
    this.drawMap(map);
    this.drawInteractions(map, model.state);
    this.drawAvatar("player", "#76e6bb", model);
    this.drawAvatar("opponent", "#ff7c98", model);
    const name = document.querySelector<HTMLElement>("#map-name");
    if (name !== null) name.textContent = map.name;
    const tick = document.querySelector<HTMLElement>("#tick");
    if (tick !== null) tick.textContent = `Tick ${model.state.tick}`;
    this.renderProgress(model.state);
    const log = document.querySelector<HTMLElement>("#events");
    if (log !== null) log.innerHTML = model.events.length === 0 ? "Déplace un avatar pour commencer."
      : model.events.slice(-12).reverse().map((event) => `<p>${demoEventText(event)}</p>`).join("");
    document.querySelectorAll<HTMLButtonElement>("[data-map]").forEach((button) =>
      button.classList.toggle("active", button.dataset.map === model.mapId));
    const legend = document.querySelector<HTMLElement>("#map-legend");
    if (legend !== null) legend.innerHTML = `<span class="ground"></span>Sol <span class="wall"></span>Collision <span class="door"></span>Transition <span class="interaction"></span>Interaction`;
    document.querySelectorAll<HTMLElement>("[data-controller]").forEach((controller) => {
      controller.classList.toggle("disabled", model.networkSide !== null
        && controller.dataset.controller !== model.networkSide);
    });
    const reset = document.querySelector<HTMLButtonElement>("#reset");
    if (reset !== null) { reset.disabled = model.networkSide !== null; reset.textContent = "Réinitialiser le monde"; }
    const create = document.querySelector<HTMLButtonElement>("#create-room");
    if (create !== null) create.disabled = model.networkSide !== null;
    const join = document.querySelector<HTMLButtonElement>("#join-room");
    if (join !== null) join.disabled = model.networkSide !== null;
    this.renderGuide(model.state);
  }

  private drawMap(map: WorldMap): void {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const blocked = new Set(map.blocked.map((point) => `${point.x},${point.y}`));
    const transitions = new Set(map.transitions.map((entry) => `${entry.at.x},${entry.at.y}`));
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const key = `${x},${y}`;
        this.context.fillStyle = blocked.has(key) ? "#18392e" : transitions.has(key) ? "#e4b953"
          : (x + y) % 2 === 0 ? "#5b9d69" : "#559463";
        this.context.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
        this.context.strokeStyle = "#0a211722";
        this.context.strokeRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
        if (blocked.has(key)) {
          this.context.fillStyle = "#2d694b";
          this.context.beginPath();
          this.context.arc(x * this.tileSize + 24, y * this.tileSize + 21, 15, 0, Math.PI * 2);
          this.context.fill();
          this.context.fillStyle = "#815f3a";
          this.context.fillRect(x * this.tileSize + 20, y * this.tileSize + 28, 8, 14);
        }
        if (transitions.has(key)) {
          this.context.fillStyle = "#fff1ad";
          this.context.fillRect(x * this.tileSize + 18, y * this.tileSize + 10, 12, 28);
        }
      }
    }
  }

  private drawInteractions(map: WorldMap, state: OverworldState): void {
    for (const interaction of this.catalog.interactions ?? []) {
      if (interaction.mapId !== map.id || state.session.completedInteractions.includes(interaction.id)) continue;
      const centerX = interaction.at.x * this.tileSize + this.tileSize / 2;
      const centerY = interaction.at.y * this.tileSize + this.tileSize / 2;
      this.context.fillStyle = interaction.kind === "npc" ? "#ffd166"
        : interaction.kind === "item" ? "#8be9fd" : "#c792ea";
      this.context.beginPath();
      this.context.arc(centerX, centerY, interaction.kind === "npc" ? 12 : 8, 0, Math.PI * 2);
      this.context.fill();
      this.context.fillStyle = "#07110d";
      this.context.font = "900 10px system-ui";
      this.context.textAlign = "center";
      this.context.fillText("!", centerX, centerY + 4);
    }
  }

  private drawAvatar(id: DemoAvatarId, color: string, model: DemoOverworldViewModel): void {
    const avatar = model.state.avatars[id];
    const position = model.positions[id];
    if (avatar === undefined || position.mapId !== model.mapId) return;
    const centerX = position.x * this.tileSize + this.tileSize / 2;
    const centerY = position.y * this.tileSize + this.tileSize / 2;
    this.context.fillStyle = "#06130f99";
    this.context.beginPath();
    this.context.ellipse(centerX, centerY + 16, 15, 6, 0, 0, Math.PI * 2);
    this.context.fill();
    this.context.fillStyle = color;
    this.context.beginPath();
    this.context.arc(centerX, centerY - 2, 15, 0, Math.PI * 2);
    this.context.fill();
    const offsets: Record<Direction, GridPoint> = {
      up: { x: 0, y: -8 }, down: { x: 0, y: 8 }, left: { x: -8, y: 0 }, right: { x: 8, y: 0 },
    };
    const eye = offsets[avatar.direction];
    this.context.fillStyle = "#07130e";
    this.context.beginPath();
    this.context.arc(centerX + eye.x, centerY - 2 + eye.y, 3, 0, Math.PI * 2);
    this.context.fill();
    this.context.fillStyle = "#f7fff9";
    this.context.font = "700 10px system-ui";
    this.context.textAlign = "center";
    this.context.fillText(avatar.name, centerX, centerY - 23);
  }

  private renderProgress(state: OverworldState): void {
    const progress = document.querySelector<HTMLElement>("#progress");
    if (progress === null) return;
    const inventory = (id: DemoAvatarId): string => Object.entries(state.players[id]?.inventory ?? {})
      .map(([item, quantity]) => `${item} ×${quantity}`).join(", ") || "vide";
    const result = state.session.battleResults.at(-1);
    progress.innerHTML = `<p><strong>J1</strong> ${inventory("player")}</p><p><strong>J2</strong> ${inventory("opponent")}</p><p><strong>Session</strong> ${state.session.flags.join(", ") || "aucun drapeau"}</p><p><strong>Combat</strong> ${result === undefined ? "aucun résultat" : `${result.kind} · ${result.winner} gagne`}</p>`;
  }

  private renderGuide(state: OverworldState): void {
    const phase = document.querySelector<HTMLElement>("#guide-phase");
    if (phase !== null) phase.textContent = "Phase 8.3";
    const title = document.querySelector<HTMLElement>("#guide-title");
    if (title !== null) title.textContent = "Parcours coop";
    const guide = document.querySelector<HTMLElement>("#coop-guide");
    if (guide === null) return;
    guide.innerHTML = (this.catalog.interactions ?? []).map((interaction) => {
      const personalDone = Object.values(state.players)
        .filter((player) => player.completedInteractions.includes(interaction.id)).length;
      const sharedDone = state.session.completedInteractions.includes(interaction.id);
      const waiting = state.session.syncedParticipants[interaction.id]?.length ?? 0;
      const status = interaction.policy === "PERSONAL" ? `${personalDone}/2` : sharedDone ? "terminé"
        : waiting > 0 ? `${waiting}/2 en attente` : "disponible";
      return `<article><span>${interaction.policy}</span><strong>${interaction.label}</strong><small>${interaction.mapId} · ${status}</small></article>`;
    }).join("");
  }
}
