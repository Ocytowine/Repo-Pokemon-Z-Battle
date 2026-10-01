import { createPersistentPokemon } from "@pokemon-z-battle/player-state";
import { finalDirectSourceTransfer } from "./source-autorun.js";
import type { SourceTrainerBattleAudio } from "./source-battle-controller.js";
import { isSourceStateCommand } from "./source-command-registry.js";
import type { SourceShopItem } from "./source-economy.js";
import { applySafeStateCommands, type SourceEventState } from "./source-event-state.js";
import { sourceItemGains, type SourceItemGain } from "./source-item-presentation.js";
import type { ImportedAvatar, ImportedEventPage, ImportedMapAssets, ImportedTransfer } from "./imported-map.js";
import type { SourceSequenceCommandResult, SourceSequenceSession } from "./source-sequence-controller.js";

type SourceCommand = ImportedEventPage["commands"][number];

export type SourceSequenceCommandFamily = "state" | "trainer-battle" | "shop" | "transfer"
  | "movement" | "presentation";

export function sourceSequenceCommandFamily(command: SourceCommand): SourceSequenceCommandFamily {
  if (isSourceStateCommand(command.kind)) return "state";
  if (command.kind === "request-trainer-battle") return "trainer-battle";
  if (command.kind === "open-shop") return "shop";
  if (command.kind === "transfer-player") return "transfer";
  if (command.kind === "move-route" || command.kind === "wait-for-movement") return "movement";
  return "presentation";
}

export interface SourceSequenceEffectDependencies {
  readonly getEventState: () => SourceEventState;
  readonly updateEventState: (state: SourceEventState) => void;
  readonly getAssets: () => ImportedMapAssets | null;
  readonly getAvatar: () => ImportedAvatar;
  readonly abort: (session: SourceSequenceSession, notice: string) => void;
  readonly beginItemPresentation: (session: SourceSequenceSession, gains: readonly SourceItemGain[]) => void;
  readonly startPendingEncounter: (onComplete: (won: boolean) => void) => boolean;
  readonly startTrainerBattle: (trainer: ImportedMapAssets["trainers"][number],
    audio: SourceTrainerBattleAudio, onComplete: (won: boolean) => void) => boolean;
  readonly openShop: (session: SourceSequenceSession, stock: readonly SourceShopItem[]) => void;
  readonly transferPlayer: (transfer: ImportedTransfer) => Promise<void>;
  readonly startMoveRoute: (session: SourceSequenceSession, target: number, route: unknown) => void;
  readonly present: (command: SourceCommand, delay: (milliseconds: number) => Promise<void>) => Promise<boolean>;
  readonly isActive: (session: SourceSequenceSession) => boolean;
  readonly resume: () => void;
}

export class SourceSequenceEffects {
  public constructor(private readonly dependencies: SourceSequenceEffectDependencies) {}

  public async execute(session: SourceSequenceSession, command: SourceCommand): Promise<SourceSequenceCommandResult> {
    switch (sourceSequenceCommandFamily(command)) {
      case "state": return this.applyState(session, command);
      case "trainer-battle": return this.startTrainerBattle(session, command);
      case "shop": return this.openShop(session, command);
      case "transfer": return this.transfer(session, command);
      case "movement": return this.move(session, command);
      case "presentation": return this.present(session, command);
    }
  }

  private applyState(session: SourceSequenceSession, command: SourceCommand): SourceSequenceCommandResult {
    const state = this.dependencies.getEventState();
    const assets = this.dependencies.getAssets();
    const avatar = this.dependencies.getAvatar();
    const result = applySafeStateCommands(state, { ...session.plan.page, commands: [command] }, session.mapId,
      session.eventId, { checkpoint: { mapId: session.mapId, x: avatar.x, y: avatar.y, direction: avatar.direction },
        createPokemon: (species, level) => {
          if (assets === null) throw new Error("Catalogue Pokémon indisponible.");
          return createPersistentPokemon(crypto.randomUUID(), species, level, assets.battleCatalog);
        } });
    if (!result.safe) return this.abort(session,
      `Séquence interrompue : ${result.reason ?? "commande d'état invalide"}.`);
    session.autorunBaseline ??= state;
    this.dependencies.updateEventState(result.state);
    const gains = assets === null ? [] : sourceItemGains(state.inventory, result.state.inventory, assets.itemNames);
    if (gains.length > 0) {
      this.dependencies.beginItemPresentation(session, gains);
      return "pause";
    }
    if (result.state.pendingEncounter !== null) {
      const started = this.dependencies.startPendingEncounter((won) => {
        if (!this.dependencies.isActive(session)) return;
        if (!won) session.cursor = session.plan.steps.length;
        this.dependencies.resume();
      });
      return started ? "pause"
        : this.abort(session, "Séquence interrompue : le combat sauvage n'a pas pu démarrer.");
    }
    return "continue";
  }

  private startTrainerBattle(session: SourceSequenceSession, command: SourceCommand): SourceSequenceCommandResult {
    const assets = this.dependencies.getAssets();
    if (command.kind !== "request-trainer-battle" || assets === null || typeof command.data.trainerType !== "string"
      || typeof command.data.trainerName !== "string" || !Number.isInteger(command.data.version)) {
      return this.abort(session, "Séquence interrompue : combat de Dresseur invalide.");
    }
    const trainer = assets.trainers.find((candidate) => candidate.trainerType === command.data.trainerType
      && candidate.name === command.data.trainerName && candidate.version === command.data.version);
    const trainerType = assets.trainerTypes.find((candidate) => candidate.internalName === command.data.trainerType);
    if (trainer === undefined || trainerType === undefined) {
      return this.abort(session, "Séquence interrompue : équipe ou classe de Dresseur introuvable.");
    }
    const started = this.dependencies.startTrainerBattle(trainer, {
      battleMusic: trainerType.battleBgm ?? assets.wildBattleBgm,
      victoryMusic: trainerType.victoryMe ?? "VictoriaEntrenador.ogg",
      baseMoney: trainerType.baseMoney,
      trainerTypeId: trainerType.id,
    }, (won) => {
      if (!this.dependencies.isActive(session)) return;
      if (!won) session.cursor = session.plan.steps.length;
      this.dependencies.resume();
    });
    return started ? "pause"
      : this.abort(session, "Séquence interrompue : le combat de Dresseur n'a pas pu démarrer.");
  }

  private openShop(session: SourceSequenceSession, command: SourceCommand): SourceSequenceCommandResult {
    const assets = this.dependencies.getAssets();
    const stockIds = command.kind === "open-shop" ? command.data.stock : null;
    if (assets === null || !Array.isArray(stockIds) || !stockIds.every((id) => typeof id === "string")) {
      throw new Error("stock de boutique invalide");
    }
    const stock = stockIds.map((id) => assets.items.get(id)).filter((item): item is SourceShopItem => item !== undefined);
    if (stock.length === 0) throw new Error("aucun objet du stock n'est disponible");
    this.dependencies.openShop(session, stock);
    return "pause";
  }

  private async transfer(session: SourceSequenceSession, command: SourceCommand): Promise<SourceSequenceCommandResult> {
    const transfer = finalDirectSourceTransfer([command], session.eventId, 0, this.dependencies.getAvatar());
    if (transfer === null) return this.abort(session, "Séquence interrompue : transfert invalide.");
    await this.dependencies.transferPlayer(transfer);
    return "continue";
  }

  private async move(session: SourceSequenceSession, command: SourceCommand): Promise<SourceSequenceCommandResult> {
    if (command.kind === "move-route" && typeof command.data.target === "number") {
      this.dependencies.startMoveRoute(session, command.data.target, command.data.route);
    } else if (command.kind === "wait-for-movement") {
      await session.runner.waitForMovement();
    }
    return "continue";
  }

  private async present(session: SourceSequenceSession, command: SourceCommand): Promise<SourceSequenceCommandResult> {
    if (await this.dependencies.present(command, (milliseconds) => session.runner.delay(milliseconds))) return "continue";
    if (command.kind === "wait" && typeof command.data.frames === "number" && command.data.frames > 0) {
      await session.runner.delay(command.data.frames * 25);
    }
    return "continue";
  }

  private abort(session: SourceSequenceSession, notice: string): SourceSequenceCommandResult {
    this.dependencies.abort(session, notice);
    return "pause";
  }
}
