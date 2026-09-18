import type { GridPoint, InteractIntent, InteractionEffect, OverworldCatalog, OverworldEvent, OverworldResult, OverworldState, PlayerState, WorldInteraction } from "./types.js";

function targetPoint(x: number, y: number, direction: "up" | "down" | "left" | "right"): GridPoint {
  if (direction === "up") return { x, y: y - 1 };
  if (direction === "down") return { x, y: y + 1 };
  if (direction === "left") return { x: x - 1, y };
  return { x: x + 1, y };
}

function addUnique(values: readonly string[], value: string): readonly string[] {
  return values.includes(value) ? values : [...values, value];
}

function playerState(state: OverworldState, playerId: string): PlayerState {
  return state.players[playerId] ?? { inventory: {}, flags: [], completedInteractions: [] };
}

function effectEvents(interaction: WorldInteraction, playerId: string): readonly OverworldEvent[] {
  const common = { playerId, interactionId: interaction.id, policy: interaction.policy } as const;
  const effect: InteractionEffect = interaction.effect;
  if (effect.type === "dialogue") return [{ type: "dialogueShown", ...common, text: effect.text }];
  if (effect.type === "item") return [{ type: "itemGranted", ...common, itemId: effect.itemId, quantity: effect.quantity }];
  if (effect.type === "flag") return [{ type: "flagSet", ...common, flag: effect.flag }];
  return [{ type: "encounterRequested", playerId, interactionId: interaction.id, encounterId: effect.encounterId, kind: effect.kind }];
}

function applyEffect(state: OverworldState, interaction: WorldInteraction, playerId: string): OverworldState {
  const currentPlayer = playerState(state, playerId);
  if (interaction.effect.type === "item") {
    const quantity = (currentPlayer.inventory[interaction.effect.itemId] ?? 0) + interaction.effect.quantity;
    return { ...state, players: { ...state.players, [playerId]: { ...currentPlayer, inventory: { ...currentPlayer.inventory, [interaction.effect.itemId]: quantity } } } };
  }
  if (interaction.effect.type === "flag") {
    if (interaction.policy === "PERSONAL") {
      return { ...state, players: { ...state.players, [playerId]: { ...currentPlayer, flags: addUnique(currentPlayer.flags, interaction.effect.flag) } } };
    }
    return { ...state, session: { ...state.session, flags: addUnique(state.session.flags, interaction.effect.flag) } };
  }
  return state;
}

function completed(state: OverworldState, interaction: WorldInteraction, playerId: string): boolean {
  return interaction.policy === "PERSONAL"
    ? playerState(state, playerId).completedInteractions.includes(interaction.id)
    : state.session.completedInteractions.includes(interaction.id);
}

function complete(state: OverworldState, interaction: WorldInteraction, playerId: string): OverworldState {
  const effected = applyEffect(state, interaction, playerId);
  if (interaction.policy === "PERSONAL") {
    const currentPlayer = playerState(effected, playerId);
    return { ...effected, players: { ...effected.players, [playerId]: { ...currentPlayer, completedInteractions: addUnique(currentPlayer.completedInteractions, interaction.id) } } };
  }
  return {
    ...effected,
    session: {
      ...effected.session,
      completedInteractions: addUnique(effected.session.completedInteractions, interaction.id),
      syncedParticipants: { ...effected.session.syncedParticipants, [interaction.id]: [] },
    },
  };
}

export function resolveInteraction(catalog: OverworldCatalog, state: OverworldState, intent: InteractIntent): OverworldResult {
  const avatar = state.avatars[intent.playerId];
  if (avatar === undefined) throw new Error(`Unknown avatar: ${intent.playerId}.`);
  const target = targetPoint(avatar.x, avatar.y, avatar.direction);
  const interaction = (catalog.interactions ?? []).find((candidate) => candidate.mapId === avatar.mapId && candidate.at.x === target.x && candidate.at.y === target.y);
  const finish = (next: OverworldState, events: readonly OverworldEvent[]): OverworldResult => ({ state: { ...next, tick: state.tick + 1 }, events });
  if (interaction === undefined) return finish(state, [{ type: "interactionUnavailable", playerId: intent.playerId, interactionId: null, reason: "nothing" }]);
  if (interaction.policy === "HOST_ONLY" && intent.playerId !== intent.hostPlayerId) {
    return finish(state, [{ type: "interactionUnavailable", playerId: intent.playerId, interactionId: interaction.id, reason: "host-only" }]);
  }
  if (completed(state, interaction, intent.playerId)) {
    return finish(state, [{ type: "interactionUnavailable", playerId: intent.playerId, interactionId: interaction.id, reason: "completed" }]);
  }
  if (interaction.policy === "SYNCED") {
    const participants = addUnique(state.session.syncedParticipants[interaction.id] ?? [], intent.playerId);
    const required = Object.values(state.avatars).filter((candidate) => candidate.mapId === avatar.mapId).map((candidate) => candidate.id);
    if (!required.every((playerId) => participants.includes(playerId))) {
      return finish({ ...state, session: { ...state.session, syncedParticipants: { ...state.session.syncedParticipants, [interaction.id]: participants } } }, [
        { type: "interactionPending", playerId: intent.playerId, interactionId: interaction.id, participants },
      ]);
    }
  }
  const next = complete(state, interaction, intent.playerId);
  return finish(next, [
    ...effectEvents(interaction, intent.playerId),
    { type: "interactionCompleted", playerId: intent.playerId, interactionId: interaction.id, policy: interaction.policy },
  ]);
}
