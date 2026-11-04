import { createEmptyPlayerPokemonStorage, type PlayerCreationCatalog, type PlayerPartyState }
  from "@pokemon-z-battle/player-state";
import { resolvePokemonAsset, type PokemonAssetsManifest } from "@pokemon-z-battle/local-assets";
import { createSourcePokemonCollection, type SourcePokemonCollectionEntry } from "./source-pokemon-collection.js";
import { sourcePokemonCardHtml, sourcePokemonIconHtml } from "./source-pokemon-card-view.js";
import { sourceActionWheelHtml } from "./source-action-wheel.js";
import { sourcePokemonFacilityShellHtml } from "./source-pokemon-facility-view.js";
import { sourceDayCareCompatibility, sourceDayCareWithdrawalFee, type SourceDayCareState } from "./source-day-care.js";
import type { SourceShopItem } from "./source-economy.js";
import { startSourcePokemonSpriteAnimation, type SourcePokemonSpriteAnimation }
  from "./source-pokemon-sprite-animator.js";

export interface SourceDayCareViewModel {
  readonly open: boolean;
  readonly party: PlayerPartyState;
  readonly dayCare: SourceDayCareState;
  readonly money: number;
  readonly catalog: PlayerCreationCatalog;
  readonly assets: PokemonAssetsManifest;
  readonly items: ReadonlyMap<string, SourceShopItem>;
}

type Selection = { readonly location: "team"; readonly pokemonId: string }
  | { readonly location: "day-care"; readonly slot: 0 | 1 };
type Confirmation = { readonly kind: "deposit"; readonly slot: 0 | 1; readonly pokemonId: string }
  | { readonly kind: "withdraw"; readonly slot: 0 | 1 }
  | { readonly kind: "exchange"; readonly slot: 0 | 1; readonly pokemonId: string };

function money(value: number): string { return `${new Intl.NumberFormat("fr-FR").format(value)} ₽`; }

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function sourceUrl(path: string): string {
  return `/__pokemon-z/source/${path.replaceAll("\\", "/").split("/").map(encodeURIComponent).join("/")}`;
}

function dayCareBattlerHtml(entry: SourcePokemonCollectionEntry, assets: PokemonAssetsManifest): string {
  const record = assets.records.find((candidate) => candidate.id === entry.number);
  const asset = record === undefined ? null : resolvePokemonAsset(record, {
    kind: "battler", form: entry.pokemon.metadata.form, shiny: entry.pokemon.metadata.shiny,
    female: entry.pokemon.metadata.gender === "female", back: false,
  }).asset;
  const frameCount = Math.max(1, asset?.frameCount ?? 1);
  if (asset === null || asset.width === null || asset.height === null) return sourcePokemonIconHtml(entry);
  const frameWidth = Math.floor(asset.width / frameCount);
  const scale = Math.min(2, 132 / frameWidth, 126 / asset.height);
  return `<canvas class="source-day-care-battler" data-day-care-battler data-src="${escapeHtml(sourceUrl(asset.path))}"
    data-frame-width="${frameWidth}" data-frame-height="${asset.height}" data-frame-count="${frameCount}"
    width="${frameWidth}" height="${asset.height}" style="width:${Math.round(frameWidth * scale)}px;height:${Math.round(asset.height * scale)}px"
    role="img" aria-label="${escapeHtml(entry.displayName)}"></canvas>`;
}

function compatibility(entries: readonly SourcePokemonCollectionEntry[], catalog: PlayerCreationCatalog): string {
  if (entries.length < 2) return "Déposez deux Pokémon pour analyser leur entente.";
  const [first, second] = entries;
  if (first === undefined || second === undefined) return "Analyse indisponible.";
  const result = sourceDayCareCompatibility({ slots: [
    { pokemon: first.pokemon, depositedLevel: first.pokemon.level },
    { pokemon: second.pokemon, depositedLevel: second.pokemon.level },
  ] }, catalog);
  return ["Ces Pokémon préfèrent jouer avec d’autres Pokémon.", "Ils ne semblent pas beaucoup s’apprécier.",
    "Ils ont l’air de bien s’entendre.", "Ils ont l’air de très bien s’entendre."][result.score]!;
}

export class SourceDayCareView {
  private selected: Selection | null = null;
  private analysisSlot: 0 | 1 | null = null;
  private depositSlot: 0 | 1 | null = null;
  private exchangeSlot: 0 | 1 | null = null;
  private confirmation: Confirmation | null = null;
  private wasOpen = false;
  private readonly battlerAnimations = new Set<SourcePokemonSpriteAnimation>();

  public constructor(private readonly onClose: () => void,
    private readonly onDeposit: (pokemonId: string, slot: 0 | 1) => void,
    private readonly onWithdraw: (slot: 0 | 1) => void,
    private readonly onExchange: (slot: 0 | 1, pokemonId: string) => void) {}

  public cancel(): boolean {
    if (this.confirmation === null) return false;
    this.confirmation = null;
    return true;
  }

  private requestDeposit(model: SourceDayCareViewModel, pokemonId: string, slot: 0 | 1): void {
    if (model.dayCare.slots[slot] !== null
      || !model.party.members.some((member) => member.id === pokemonId)) return;
    this.confirmation = { kind: "deposit", slot, pokemonId };
    this.depositSlot = null;
    this.exchangeSlot = null;
    this.selected = null;
    this.render(model);
  }

  public render(model: SourceDayCareViewModel): void {
    const root = document.querySelector<HTMLElement>("#source-day-care");
    if (root === null) return;
    const teamScrollTop = this.wasOpen ? root.querySelector<HTMLElement>(".source-ranch-team-list")?.scrollTop ?? 0 : 0;
    root.hidden = !model.open;
    if (!model.open) { this.wasOpen = false; this.stopBattlerAnimations(); return; }
    if (!this.wasOpen) {
      this.selected = null; this.analysisSlot = null; this.depositSlot = null; this.exchangeSlot = null;
      this.confirmation = null;
    }
    this.wasOpen = true;
    const team = createSourcePokemonCollection(model.party, createEmptyPlayerPokemonStorage(), model.catalog, model.assets);
    const storedState = { schemaVersion: 1 as const,
      members: model.dayCare.slots.flatMap((slot) => slot === null ? [] : [slot.pokemon]) };
    const stored = createSourcePokemonCollection({ schemaVersion: 1, activeIndex: null, members: [] },
      storedState, model.catalog, model.assets);
    const byId = new Map(stored.map((entry) => [entry.pokemon.id, entry]));
    const entries = model.dayCare.slots.map((slot) => slot === null ? null : byId.get(slot.pokemon.id) ?? null) as
      [SourcePokemonCollectionEntry | null, SourcePokemonCollectionEntry | null];
    const teamHtml = Array.from({ length: 6 }, (_, index) => {
      const member = team[index] ?? null;
      return member === null
      ? `<article class="source-ranch-team-empty"><span>${index + 1}</span><strong>Place libre</strong></article>`
      : sourcePokemonCardHtml(member, { compact: true, teamLayout: true, showGender: true,
        heldItemName: member.pokemon.heldItem === null ? null
          : model.items.get(member.pokemon.heldItem)?.name ?? member.pokemon.heldItem,
        selected: this.selected?.location === "team" && this.selected.pokemonId === member.pokemon.id,
        active: member.teamIndex === model.party.activeIndex });
    }).join("");
    const slotHtml = model.dayCare.slots.map((slot, index) => {
      const entry = entries[index as 0 | 1];
      if (slot === null || entry === null) return `<button type="button" class="source-day-care-empty" data-day-care-empty="${index}"><span>+</span><strong>Place ${index + 1}</strong><small>Choisir un Pokémon de l’équipe</small></button>`;
      const fee = sourceDayCareWithdrawalFee(slot);
      const gender = slot.pokemon.metadata.gender === "male" ? "Mâle ♂"
        : slot.pokemon.metadata.gender === "female" ? "Femelle ♀" : "Sans genre ◇";
      return `<article class="source-day-care-slot"><div class="source-day-care-slot-meta"><span>PLACE ${index + 1}</span><b>+${slot.pokemon.level - slot.depositedLevel} niv.</b><em>${money(fee)}</em></div>
        <button type="button" class="source-day-care-occupant${this.selected?.location === "day-care" && this.selected.slot === index ? " selected" : ""}"
          data-pokemon-id="${escapeHtml(entry.pokemon.id)}" aria-haspopup="dialog">
          ${dayCareBattlerHtml(entry, model.assets)}
          <span class="source-day-care-identity"><strong>${escapeHtml(entry.displayName)}</strong><small>Niveau ${entry.pokemon.level}</small><em data-gender="${slot.pokemon.metadata.gender ?? "genderless"}">${gender}</em></span>
        </button></article>`;
    }).join("");
    const content = `<div class="source-day-care-storage-body"><div class="source-day-care-slots">${slotHtml}</div>
      <article class="source-day-care-compatibility"><span>${model.dayCare.eggReady ? "!" : "♡"}</span><div><small>${model.dayCare.eggReady ? "ŒUF EN ATTENTE" : "ANALYSE DU COUPLE"}</small><strong>${model.dayCare.eggReady ? "Le gardien des Œufs souhaite vous parler avant toute modification du couple." : compatibility(stored, model.catalog)}</strong></div></article></div>`;
    let overlay = "";
    const selected = this.selected;
    const selectedEntry = selected?.location === "team" ? team.find((entry) => entry.pokemon.id === selected.pokemonId) ?? null
      : selected?.location === "day-care" ? entries[selected.slot] : null;
    if (selectedEntry !== null && selectedEntry !== undefined) {
      const actions = selected?.location === "team"
        ? model.dayCare.slots.flatMap((slot, index) => slot === null ? [{ id: `deposit:${index}`, label: `Déposer place ${index + 1}`, symbol: "↓", enabled: model.party.members.length > 1, hint: "Dépôt gratuit" }] : [])
        : [{ id: "analyse", label: "Analyser", symbol: "i", enabled: true, hint: "Progression et évolution" },
          { id: "withdraw", label: "Récupérer", symbol: "↑", enabled: model.party.members.length < 6
            && !model.dayCare.eggReady && selected?.location === "day-care" && model.money >= sourceDayCareWithdrawalFee(model.dayCare.slots[selected.slot]!), hint: model.dayCare.eggReady ? "Traitez d’abord l’Œuf" : model.party.members.length >= 6 ? "Équipe complète" : "Payer le retrait" },
          { id: "exchange", label: "Échanger", symbol: "⇄", enabled: model.party.members.length > 0
            && !model.dayCare.eggReady && selected?.location === "day-care" && model.money >= sourceDayCareWithdrawalFee(model.dayCare.slots[selected.slot]!), hint: model.dayCare.eggReady ? "Traitez d’abord l’Œuf" : "Choisir un membre de l’équipe" }];
      overlay = sourceActionWheelHtml({ label: `Pension · ${selectedEntry.displayName}`, actions,
        centerHtml: `${sourcePokemonIconHtml(selectedEntry)}<strong>${selectedEntry.displayName}</strong>` });
    }
    if (this.analysisSlot !== null) {
      const storedSlot = model.dayCare.slots[this.analysisSlot]; const entry = entries[this.analysisSlot];
      if (storedSlot !== null && entry !== null) {
        const definition = model.catalog.pokemon.find((pokemon) => pokemon.internalName === entry.pokemon.species);
        const evolutions = (definition?.evolutions ?? []).map((evolution) => model.catalog.pokemon.find((pokemon) => pokemon.internalName === evolution.species)?.name ?? evolution.species);
        const upcoming = definition?.levelUpMoves.filter((move) => move.level > storedSlot.depositedLevel && move.level <= entry.pokemon.level)
          .map((move) => model.catalog.moves.find((candidate) => candidate.internalName === move.move)?.name ?? move.move) ?? [];
        overlay = `<div class="source-day-care-dialog-backdrop"><section class="source-day-care-analysis" role="dialog" aria-modal="true"><button type="button" data-day-care-dialog-close>×</button>
          <small>ANALYSE D’ÉVOLUTION</small><div class="source-day-care-analysis-pokemon">${sourcePokemonIconHtml(entry)}<div><strong>${entry.displayName}</strong><span>${entry.pokemon.metadata.gender === "male" ? "Mâle ♂" : entry.pokemon.metadata.gender === "female" ? "Femelle ♀" : "Sans genre ◇"} · N.${storedSlot.depositedLevel} → N.${entry.pokemon.level}</span></div></div>
          <dl><div><dt>Progression</dt><dd>${entry.pokemon.level - storedSlot.depositedLevel} niveau(x)</dd></div><div><dt>Retrait</dt><dd>${money(sourceDayCareWithdrawalFee(storedSlot))}</dd></div>
          <div><dt>Évolution possible</dt><dd>${evolutions.length === 0 ? "Aucune connue" : evolutions.join(", ")}</dd></div><div><dt>Capacités rencontrées</dt><dd>${upcoming.length === 0 ? "Aucune" : upcoming.join(", ")}</dd></div></dl>
          <p>La Pension ne déclenche pas l’évolution. Les choix de capacités en attente seront proposés après le retrait.</p></section></div>`;
      }
    }
    const confirmation = this.confirmation;
    if (confirmation !== null) {
      if (confirmation.kind === "deposit") {
        const teamEntry = team.find((entry) => entry.pokemon.id === confirmation.pokemonId) ?? null;
        if (model.dayCare.slots[confirmation.slot] !== null || teamEntry === null) this.confirmation = null;
        else overlay = `<div class="source-day-care-dialog-backdrop"><section class="source-day-care-confirm" role="alertdialog" aria-modal="true" aria-labelledby="source-day-care-confirm-title">
          <small>CONFIRMATION DU DÉPÔT</small><h3 id="source-day-care-confirm-title">Confier ${escapeHtml(teamEntry.displayName)} ?</h3>
          <div class="source-day-care-confirm-pokemon"><span>${sourcePokemonIconHtml(teamEntry)}</span><div><small>PLACE ${confirmation.slot + 1}</small><strong>${escapeHtml(teamEntry.displayName)}</strong><em>Niveau ${teamEntry.pokemon.level}</em></div></div>
          <dl><div><dt>Dépôt</dt><dd>Gratuit</dd></div><div><dt>Retrait initial</dt><dd>${money(100)}</dd></div></dl>
          <p>Le Pokémon quittera votre équipe. Son retrait coûte au moins 100 ₽, puis 100 ₽ de plus par niveau gagné.</p>
          <footer><button type="button" data-day-care-confirm-cancel>Annuler</button><button type="button" class="primary" data-day-care-confirm-accept>Confirmer le dépôt</button></footer>
        </section></div>`;
      } else {
        const storedSlot = model.dayCare.slots[confirmation.slot];
        const storedEntry = entries[confirmation.slot];
        const teamEntry = confirmation.kind === "exchange"
          ? team.find((entry) => entry.pokemon.id === confirmation.pokemonId) ?? null : null;
        if (storedSlot === null || storedEntry === null || confirmation.kind === "exchange" && teamEntry === null) {
          this.confirmation = null;
        } else {
          const fee = sourceDayCareWithdrawalFee(storedSlot);
          const exchangeCopy = confirmation.kind === "exchange" && teamEntry !== null
            ? `<div class="source-day-care-confirm-pokemon"><span>${sourcePokemonIconHtml(teamEntry)}</span><div><small>CONFIER À LA PENSION</small><strong>${escapeHtml(teamEntry.displayName)}</strong><em>Niveau ${teamEntry.pokemon.level}</em></div></div>` : "";
          overlay = `<div class="source-day-care-dialog-backdrop"><section class="source-day-care-confirm" role="alertdialog" aria-modal="true" aria-labelledby="source-day-care-confirm-title">
            <small>CONFIRMATION DE PAIEMENT</small><h3 id="source-day-care-confirm-title">${confirmation.kind === "withdraw" ? `Récupérer ${escapeHtml(storedEntry.displayName)} ?` : "Confirmer cet échange ?"}</h3>
            <div class="source-day-care-confirm-pokemon"><span>${sourcePokemonIconHtml(storedEntry)}</span><div><small>RÉCUPÉRER</small><strong>${escapeHtml(storedEntry.displayName)}</strong><em>Niveau ${storedEntry.pokemon.level}</em></div></div>${exchangeCopy}
            <dl><div><dt>Prix à payer</dt><dd>${money(fee)}</dd></div><div><dt>Après paiement</dt><dd>${money(model.money - fee)}</dd></div></dl>
            <p>${confirmation.kind === "withdraw" ? "Le Pokémon rejoindra votre équipe." : `${escapeHtml(teamEntry!.displayName)} prendra sa place à la Pension.`}</p>
            <footer><button type="button" data-day-care-confirm-cancel>Annuler</button><button type="button" class="primary" data-day-care-confirm-accept>Payer et confirmer</button></footer>
          </section></div>`;
        }
      }
    }
    root.innerHTML = sourcePokemonFacilityShellHtml({ kind: "day-care", title: "Pension Pokémon",
      subtitle: `${money(model.money)} · 1 pas = 1 EXP`, teamCount: team.length,
      facilityEyebrow: "PENSION", facilityTitle: "Pokémon confiés",
      facilityMeta: `${stored.length}/2`, teamHtml,
      teamChoosing: this.exchangeSlot !== null || this.depositSlot !== null,
      contentHtml: content, overlayHtml: overlay });
    root.querySelector<HTMLElement>(".source-ranch-team-list")!.scrollTop = teamScrollTop;
    this.startBattlerAnimations(root);
    root.querySelector<HTMLButtonElement>("[data-facility-close]")?.addEventListener("click", this.onClose);
    root.querySelectorAll<HTMLButtonElement>("[data-pokemon-id]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.pokemonId; if (id === undefined) return;
      if (this.depositSlot !== null && team.some((entry) => entry.pokemon.id === id)) {
        this.requestDeposit(model, id, this.depositSlot); return;
      }
      if (this.exchangeSlot !== null && team.some((entry) => entry.pokemon.id === id)) {
        const slot = this.exchangeSlot; this.exchangeSlot = null; this.selected = null;
        this.confirmation = { kind: "exchange", slot, pokemonId: id }; this.render(model); return;
      }
      this.depositSlot = null; this.exchangeSlot = null;
      const slot = model.dayCare.slots.findIndex((candidate) => candidate?.pokemon.id === id);
      this.selected = slot >= 0 ? { location: "day-care", slot: slot as 0 | 1 } : { location: "team", pokemonId: id };
      this.render(model);
    }));
    root.querySelectorAll<HTMLButtonElement>("[data-day-care-empty]").forEach((button) => button.addEventListener("click", () => {
      const selected = this.selected; const slot = Number(button.dataset.dayCareEmpty);
      if (slot !== 0 && slot !== 1) return;
      if (selected?.location === "team") { this.requestDeposit(model, selected.pokemonId, slot); return; }
      this.depositSlot = slot; this.exchangeSlot = null; this.selected = null; this.render(model);
    }));
    root.querySelectorAll<HTMLButtonElement>("[data-source-wheel-close]").forEach((button) => button.addEventListener("click", () => { this.selected = null; this.render(model); }));
    root.querySelectorAll<HTMLButtonElement>("[data-source-wheel-action]").forEach((button) => button.addEventListener("click", () => {
      const action = button.dataset.sourceWheelAction; const selected = this.selected;
      if (selected === null || action === undefined) return;
      if (selected.location === "team" && action.startsWith("deposit:")) {
        const slot = Number(action.slice(8));
        if (slot === 0 || slot === 1) this.requestDeposit(model, selected.pokemonId, slot);
      } else if (selected.location === "day-care" && action === "withdraw") {
        this.confirmation = { kind: "withdraw", slot: selected.slot }; this.selected = null; this.render(model);
      }
      else if (selected.location === "day-care" && action === "analyse") { this.analysisSlot = selected.slot; this.selected = null; this.render(model); }
      else if (selected.location === "day-care" && action === "exchange") {
        this.exchangeSlot = selected.slot; this.depositSlot = null; this.selected = null; this.render(model);
      }
    }));
    root.querySelector<HTMLButtonElement>("[data-day-care-dialog-close]")?.addEventListener("click", () => { this.analysisSlot = null; this.render(model); });
    root.querySelector<HTMLButtonElement>("[data-day-care-confirm-cancel]")?.addEventListener("click", () => {
      this.confirmation = null; this.render(model);
    });
    root.querySelector<HTMLButtonElement>("[data-day-care-confirm-accept]")?.addEventListener("click", () => {
      const accepted = this.confirmation; this.confirmation = null;
      if (accepted?.kind === "deposit") this.onDeposit(accepted.pokemonId, accepted.slot);
      else if (accepted?.kind === "withdraw") this.onWithdraw(accepted.slot);
      else if (accepted?.kind === "exchange") this.onExchange(accepted.slot, accepted.pokemonId);
    });
  }

  private stopBattlerAnimations(): void {
    this.battlerAnimations.forEach((animation) => animation.stop());
    this.battlerAnimations.clear();
  }

  private startBattlerAnimations(root: HTMLElement): void {
    this.stopBattlerAnimations();
    root.querySelectorAll<HTMLCanvasElement>("[data-day-care-battler]").forEach((canvas) => {
      const source = canvas.dataset.src;
      const frameWidth = Number(canvas.dataset.frameWidth);
      const frameHeight = Number(canvas.dataset.frameHeight);
      const frameCount = Number(canvas.dataset.frameCount);
      if (source === undefined || !Number.isSafeInteger(frameWidth)
        || !Number.isSafeInteger(frameHeight) || !Number.isSafeInteger(frameCount) || frameCount < 1) return;
      const animation = startSourcePokemonSpriteAnimation({ canvas, image: source,
        frameWidth, frameHeight, frameCount, profile: "idle" });
      this.battlerAnimations.add(animation);
    });
  }
}
