import { createSourceMiningGame, hitSourceMiningWall, moveSourceMiningCursor, quitSourceMiningGame,
  selectSourceMiningCell, SOURCE_MINING_WIDTH, toggleSourceMiningTool,
  type SourceMiningPlacement, type SourceMiningState, type SourceMiningStatus } from "./source-mining.js";

export interface SourceMiningViewOptions {
  readonly itemName: (itemId: string) => string;
  readonly onComplete: (items: readonly string[], outcome: SourceMiningStatus) => void;
}

const PICTURE_ROOT = "/__pokemon-z/source/Graphics/Pictures/Mining";
const SOUND_ROOT = "/__pokemon-z/source/Audio/SE";

function placementHtml(placement: SourceMiningPlacement, kind: "treasure" | "iron", flashing = false): string {
  const sheetWidth = kind === "treasure" ? 29 : 10;
  const sheetHeight = kind === "treasure" ? 35 : 9;
  const image = kind === "treasure" ? "items.png" : "irons.png";
  const width = placement.shape.width;
  const height = placement.shape.height;
  return `<span class="source-mining-buried ${kind}${placement.revealed ? " revealed" : ""}${flashing ? " just-revealed" : ""}" style="left:${placement.x / SOURCE_MINING_WIDTH * 100}%;top:${placement.y / 10 * 100}%;width:${width / SOURCE_MINING_WIDTH * 100}%;height:${height / 10 * 100}%">
    <img src="${PICTURE_ROOT}/${image}" alt="" style="width:${sheetWidth / width * 100}%;height:${sheetHeight / height * 100}%;left:${-placement.shape.spriteX / width * 100}%;top:${-placement.shape.spriteY / height * 100}%">
  </span>`;
}

/** Personal modal scene. It shares the source rules in solo, host and guest sessions. */
export class SourceMiningView {
  private readonly root: HTMLElement;
  private state: SourceMiningState | null = null;
  private intro = false;
  private striking = false;
  private settled = false;
  private flashingTreasures = new Set<number>();
  private audioVolume = 1;

  public constructor(private readonly options: SourceMiningViewOptions) {
    this.root = document.createElement("section");
    this.root.id = "source-mining";
    this.root.className = "source-mining";
    this.root.hidden = true;
    this.root.setAttribute("aria-label", "Mini-jeu de fouilles");
    (document.getElementById("world-stage") ?? document.body).append(this.root);
    window.addEventListener("keydown", (event) => this.keydown(event), { capture: true });
  }

  public get open(): boolean { return this.state !== null; }

  public setAudioVolume(volume: number): void {
    this.audioVolume = Math.max(0, Math.min(1, volume));
  }

  public start(random: () => number = Math.random): void {
    if (this.open) return;
    this.state = createSourceMiningGame(random);
    this.intro = true;
    this.striking = false;
    this.settled = false;
    this.flashingTreasures.clear();
    this.play("MiningPing.mp3");
    this.render();
  }

  private keydown(event: KeyboardEvent): void {
    if (this.state === null) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (this.intro) {
      if (["Enter", "Space", "KeyZ"].includes(event.code)) this.begin();
      else if (event.code === "Escape") this.quit();
      return;
    }
    if (this.state.status !== "active") {
      if (["Enter", "Space", "KeyZ", "Escape"].includes(event.code)) this.complete();
      return;
    }
    if (event.code === "ArrowUp") this.move(0, -1);
    else if (event.code === "ArrowDown") this.move(0, 1);
    else if (event.code === "ArrowLeft") this.move(-1, 0);
    else if (event.code === "ArrowRight") this.move(1, 0);
    else if (["KeyA", "Tab"].includes(event.code)) this.toggleTool();
    else if (["Enter", "Space", "KeyZ"].includes(event.code)) this.hit();
    else if (event.code === "Escape") this.quit();
  }

  private begin(): void {
    this.intro = false;
    this.render();
  }

  private move(dx: number, dy: number): void {
    if (this.state === null || this.striking) return;
    const next = moveSourceMiningCursor(this.state, dx, dy);
    if (next.cursor !== this.state.cursor) this.play("MiningMove.wav");
    this.state = next;
    this.flashingTreasures.clear();
    this.render();
  }

  private select(position: number, strike: boolean): void {
    if (this.state === null || this.striking || this.state.status !== "active") return;
    const moved = this.state.cursor !== position;
    this.state = selectSourceMiningCell(this.state, position);
    if (moved) this.play("MiningMove.wav");
    if (strike) this.hit(); else this.render();
  }

  private toggleTool(): void {
    if (this.state === null || this.striking) return;
    this.state = toggleSourceMiningTool(this.state);
    this.flashingTreasures.clear();
    this.play("MiningChangeTool.wav");
    this.render();
  }

  private hit(): void {
    if (this.state === null || this.striking || this.state.status !== "active") return;
    this.striking = true;
    const previous = this.state;
    const result = hitSourceMiningWall(previous);
    this.state = result.state;
    this.flashingTreasures = new Set(result.state.treasures.flatMap((placement, index) =>
      !previous.treasures[index]?.revealed && placement.revealed ? [index] : []));
    this.play(result.hit === "iron" ? "MiningIron.mp3"
      : result.state.tool === "hammer" ? "MiningHammer.mp3" : "MiningPick.mp3");
    if (result.revealedItems.length > 0) this.play("MiningFullyRevealItem.mp3", 90);
    else if (result.hit === "treasure") this.play("MiningRevealItem.mp3", 80);
    if (result.state.status === "collapsed") this.play("MiningCollapse.mp3", 180);
    else if (result.state.status === "cleared") this.play("MiningAllFound.mp3", 180);
    this.render();
    window.setTimeout(() => {
      this.striking = false;
      this.root.querySelector(".source-mining-cursor")?.classList.remove("striking");
    }, 310);
  }

  private quit(): void {
    if (this.state === null) return;
    if (!this.intro && this.state.status === "active" && !window.confirm("Voulez-vous arrêter de creuser ? Les trésors déjà dégagés seront conservés.")) return;
    this.state = quitSourceMiningGame(this.state);
    this.complete();
  }

  private complete(): void {
    if (this.state === null || this.settled) return;
    this.settled = true;
    const state = this.state;
    this.root.hidden = true;
    this.root.innerHTML = "";
    this.state = null;
    this.options.onComplete(state.wonItems, state.status);
  }

  private play(file: string, delay = 0): void {
    window.setTimeout(() => {
      if (this.audioVolume <= 0) return;
      const audio = new Audio(`${SOUND_ROOT}/${file}`);
      audio.volume = this.audioVolume;
      void audio.play().catch(() => undefined);
    }, delay);
  }

  private render(): void {
    const state = this.state;
    if (state === null) return;
    const toolLabel = state.tool === "pick" ? "Burin" : "Marteau";
    const treasures = state.treasures.map((placement, index) =>
      placementHtml(placement, "treasure", this.flashingTreasures.has(index))).join("");
    const iron = state.iron.map((placement) => placementHtml(placement, "iron")).join("");
    const tiles = state.layers.map((layer, position) => `<button type="button" class="source-mining-tile${layer === 0 ? " open" : ""}" data-mining-cell="${position}" style="background-position-y:${Math.max(0, layer - 1) * 20}%" aria-label="Creuser la case ${position + 1}"></button>`).join("");
    const found = state.wonItems.map((itemId) => `<li>${this.options.itemName(itemId)}</li>`).join("");
    const outcome = state.status === "collapsed" ? "La paroi s’est effondrée !"
      : state.status === "cleared" ? "Tous les trésors ont été dégagés !"
        : state.status === "quit" ? "Fouilles interrompues." : null;
    this.root.hidden = false;
    this.root.innerHTML = `<div class="source-mining-scene">
      <div class="source-mining-board">${treasures}${iron}<div class="source-mining-rock">${tiles}</div>
        <span class="source-mining-cursor ${state.tool}${this.striking ? " striking" : ""}" style="left:${state.cursor % SOURCE_MINING_WIDTH / SOURCE_MINING_WIDTH * 100}%;top:${Math.floor(state.cursor / SOURCE_MINING_WIDTH) / 10 * 100}%"></span>
      </div>
      <header class="source-mining-meter"><span>Solidité de la paroi</span><div><i style="width:${Math.min(100, state.cracks / 49 * 100)}%"></i></div><strong>${state.cracks}/49</strong></header>
      <div class="source-mining-found${this.flashingTreasures.size > 0 ? " updated" : ""}"><strong>${state.wonItems.length}/${state.treasures.length}</strong><span>trésors dégagés</span></div>
      <button type="button" class="source-mining-tool ${state.tool}" data-mining-tool><span></span><strong>${toolLabel}</strong><small>Changer</small></button>
      <footer class="source-mining-controls"><button type="button" data-mining-quit>Quitter</button><p>Flèches : déplacer · A : outil · Entrée : frapper</p><button type="button" data-mining-hit>Frapper</button></footer>
      ${this.intro ? `<div class="source-mining-dialog"><section><strong>Quelque chose résonne dans la paroi !</strong><p>${state.treasures.length} trésors sont enfouis. Dégagez-les avant que la roche ne s’effondre.</p><button type="button" data-mining-begin>Commencer</button></section></div>` : ""}
      ${outcome === null ? "" : `<div class="source-mining-dialog result"><section><strong>${outcome}</strong>${found === "" ? "<p>Aucun trésor récupéré.</p>" : `<p>Trésors récupérés :</p><ul>${found}</ul>`}<button type="button" data-mining-complete>Ranger dans le Sac</button></section></div>`}
    </div>`;
    this.root.querySelector<HTMLButtonElement>("[data-mining-begin]")?.addEventListener("click", () => this.begin());
    this.root.querySelector<HTMLButtonElement>("[data-mining-tool]")?.addEventListener("click", () => this.toggleTool());
    this.root.querySelector<HTMLButtonElement>("[data-mining-hit]")?.addEventListener("click", () => this.hit());
    this.root.querySelector<HTMLButtonElement>("[data-mining-quit]")?.addEventListener("click", () => this.quit());
    this.root.querySelector<HTMLButtonElement>("[data-mining-complete]")?.addEventListener("click", () => this.complete());
    this.root.querySelectorAll<HTMLButtonElement>("[data-mining-cell]").forEach((button) => button.addEventListener("click", () => {
      const position = Number(button.dataset.miningCell);
      if (Number.isInteger(position)) this.select(position, true);
    }));
  }
}
