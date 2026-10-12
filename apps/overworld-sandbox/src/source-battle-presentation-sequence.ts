import type { BattleSide, DoubleBattleEvent, TeamBattleEvent, TeamBattleState } from "@pokemon-z-battle/battle-engine";

export type SourceBattlePresentationStep =
  | { readonly kind: "action"; readonly side: BattleSide; readonly move: string;
      readonly message: string; readonly state: TeamBattleState }
  | { readonly kind: "impact"; readonly side: BattleSide; readonly effectiveness: number;
      readonly state: TeamBattleState }
  | { readonly kind: "health"; readonly side: BattleSide; readonly from: number; readonly to: number;
      readonly message: string; readonly state: TeamBattleState }
  | { readonly kind: "message" | "status"; readonly message: string; readonly state: TeamBattleState }
  | { readonly kind: "faint"; readonly side: BattleSide; readonly message: string; readonly state: TeamBattleState }
  | { readonly kind: "replacement"; readonly side: BattleSide; readonly message: string;
      readonly state: TeamBattleState }
  | { readonly kind: "capture"; readonly ballId: string; readonly targetId: string;
      readonly targetName: string; readonly shakes: number; readonly critical: boolean;
      readonly success: boolean; readonly state: TeamBattleState };

const STATUS_NAMES = {
  burn: "la brûlure",
  caduco: "Caduco",
  frozen: "le gel",
  hemorrhage: "l'hémorragie",
  paralysis: "la paralysie",
  poison: "le poison",
  sleep: "le sommeil",
} as const;

const STAT_NAMES = {
  accuracy: "Précision",
  attack: "Attaque",
  defense: "Défense",
  evasion: "Esquive",
  specialAttack: "Attaque Spéciale",
  specialDefense: "Défense Spéciale",
  speed: "Vitesse",
} as const;

function activeName(state: TeamBattleState, side: BattleSide): string {
  return state.teams[side].members[state.teams[side].activeIndex]?.name
    ?? (side === "player" ? "Votre Pokémon" : "Le Pokémon adverse");
}

function withActiveHp(state: TeamBattleState, side: BattleSide, hp: number): TeamBattleState {
  const team = state.teams[side];
  return { ...state, teams: { ...state.teams, [side]: { ...team,
    members: team.members.map((member, index) => index === team.activeIndex ? { ...member, hp } : member) } } };
}

function withActiveIndex(state: TeamBattleState, side: BattleSide, activeIndex: number): TeamBattleState {
  const team = state.teams[side];
  return { ...state, teams: { ...state.teams, [side]: { ...team, activeIndex } },
    replacementRequired: state.replacementRequired.filter((candidate) => candidate !== side) };
}

function withSwitchedIndex(state: TeamBattleState, side: BattleSide, fromIndex: number,
  toIndex: number): TeamBattleState {
  const team = state.teams[side];
  if (team.activeIndices === undefined) return withActiveIndex(state, side, toIndex);
  const slot = team.activeIndices.indexOf(fromIndex);
  if (slot < 0) return withActiveIndex(state, side, toIndex);
  const activeIndices = [...team.activeIndices];
  activeIndices[slot] = toIndex;
  // activeIndex pointe volontairement vers le slot animé. Le prochain événement
  // positionné choisira à nouveau son slot et l'état autoritaire final sera rendu
  // après la séquence.
  return { ...state, teams: { ...state.teams, [side]: { ...team, activeIndex: toIndex, activeIndices } },
    replacementRequired: state.replacementRequired.filter((candidate) => candidate !== side),
    ...(state.slotReplacements === undefined ? {} : { slotReplacements: state.slotReplacements
      .filter((position) => position.side !== side || position.slot !== slot) }) };
}

function effectivenessMessage(effectiveness: number): string | null {
  if (effectiveness === 0) return "Cela n'affecte pas la cible…";
  if (effectiveness > 1) return "C'est super efficace !";
  if (effectiveness < 1) return "Ce n'est pas très efficace…";
  return null;
}

/**
 * Derives a deterministic visual queue from authoritative battle events. This is
 * shared by local and network battles and never resolves gameplay a second time.
 */
export function buildSourceBattlePresentationSequence(before: TeamBattleState,
  events: readonly (TeamBattleEvent | DoubleBattleEvent)[]): readonly SourceBattlePresentationStep[] {
  let state = before;
  const steps: SourceBattlePresentationStep[] = [];
  const message = (value: string, kind: "message" | "status" = "message"): void => {
    steps.push({ kind, message: value, state });
  };
  const health = (side: BattleSide, hp: number, value: string): void => {
    const current = state.teams[side].members[state.teams[side].activeIndex]?.hp ?? hp;
    state = withActiveHp(state, side, hp);
    steps.push({ kind: "health", side, from: current, to: hp, message: value, state });
  };

  for (const event of events) {
    if (event.type === "positionedActionResolved") {
      const previousActive = { player: state.teams.player.activeIndex, opponent: state.teams.opponent.activeIndex };
      const actorIndex = state.teams[event.actor.side].activeIndices?.[event.actor.slot];
      const target = event.targets[0];
      const targetIndex = target === undefined ? undefined : state.teams[target.side].activeIndices?.[target.slot];
      let positioned = state;
      if (actorIndex !== undefined) positioned = { ...positioned, teams: { ...positioned.teams,
        [event.actor.side]: { ...positioned.teams[event.actor.side], activeIndex: actorIndex } } };
      if (target !== undefined && targetIndex !== undefined) positioned = { ...positioned, teams: { ...positioned.teams,
        [target.side]: { ...positioned.teams[target.side], activeIndex: targetIndex } } };
      const positionedSteps = buildSourceBattlePresentationSequence(positioned, event.events);
      steps.push(...positionedSteps);
      const resolved = positionedSteps.at(-1)?.state ?? positioned;
      // Conserver les PV/statuts produits par cette action pour la suivante, sans
      // laisser le pointeur visuel d'un slot devenir le slot logique principal.
      state = { ...resolved, teams: {
        player: { ...resolved.teams.player, activeIndex: previousActive.player },
        opponent: { ...resolved.teams.opponent, activeIndex: previousActive.opponent },
      } };
    } else if (event.type === "moveUsed") {
      const battler = state.teams[event.side].members[state.teams[event.side].activeIndex];
      const move = battler?.moves.find((slot) => slot.move.internalName === event.move)?.move;
      steps.push({ kind: "action", side: event.side, move: event.move,
        message: `${activeName(state, event.side)} utilise ${move?.name ?? event.move} !`, state });
    } else if (event.type === "damageApplied") {
      const targetName = activeName(state, event.target);
      steps.push({ kind: "impact", side: event.target, effectiveness: event.effectiveness, state });
      health(event.target, event.hp, event.amount === 0
        ? `${targetName} ne perd aucun PV.`
        : `${targetName} perd ${event.amount} PV.`);
      if (event.critical) message("Coup critique !");
      const effectiveness = effectivenessMessage(event.effectiveness);
      if (effectiveness !== null) message(effectiveness);
    } else if (event.type === "hpRestored") {
      health(event.side, event.hp, `${activeName(state, event.side)} récupère ${event.amount} PV.`);
    } else if (event.type === "moveMissed") {
      message(`${activeName(state, event.side)} rate son attaque.`);
    } else if (event.type === "moveFailed") {
      message(event.reason === "protected" ? `${activeName(state, event.side)} est bloqué par la protection adverse.`
        : event.reason === "taunted" ? `${activeName(state, event.side)} ne peut pas utiliser cette capacité sous l'effet de Provoc.`
          : "Mais cela échoue !", "status");
    } else if (event.type === "ppReduced") {
      message(`${event.move} perd ${event.amount} PP.`, "status");
    } else if (event.type === "battleEffectChanged") {
      const label = event.effect === "reflect" ? "Reflet" : event.effect === "lucky-chant" ? "Air Veinard" : "Tourniquet";
      message(event.turns > 0 ? `${label} agit sur le combat.` : `${label} ne fait plus effet.`, "status");
    } else if (event.type === "statusApplied") {
      message(`${activeName(state, event.target)} subit ${STATUS_NAMES[event.status]}.`, "status");
    } else if (event.type === "statusApplicationFailed") {
      message(event.reason === "already-status"
        ? `${activeName(state, event.target)} a déjà un problème de statut.`
        : `${activeName(state, event.target)} est immunisé contre ${STATUS_NAMES[event.status]}.`, "status");
    } else if (event.type === "statusContinued") {
      message(`${activeName(state, event.side)} est affecté par ${STATUS_NAMES[event.status]}.`, "status");
    } else if (event.type === "statusCured") {
      message(`${activeName(state, event.side)} n'est plus affecté par ${STATUS_NAMES[event.status]}.`, "status");
    } else if (event.type === "statusDamage") {
      health(event.side, event.hp, `${activeName(state, event.side)} souffre de ${STATUS_NAMES[event.status]} et perd ${event.amount} PV.`);
    } else if (event.type === "volatileApplied") {
      const name = activeName(state, event.target);
      const text = event.effect === "confusion" ? `${name} devient confus.`
        : event.effect === "flinch" ? `${name} a peur.`
          : event.effect === "focus-energy" ? `${name} se concentre.`
            : event.effect === "identified" ? `${name} est identifié.`
              : event.effect === "disable" ? `${event.move ?? "Une capacité"} de ${name} est neutralisée.`
                : event.effect === "encore" ? `${name} doit répéter ${event.move ?? "sa dernière capacité"}.`
                  : event.effect === "curse" ? `${name} est maudit.`
                    : event.effect === "taunt" ? `${name} est provoqué.`
                      : event.effect === "protect" ? `${name} se protège.`
                        : event.effect === "endure" ? `${name} se prépare à tenir le coup.`
                          : event.effect === "rage" ? `${name} entre en rage.`
                            : `${name} est pris au piège par ${event.move ?? "l'attaque"}.`;
      message(text, "status");
    } else if (event.type === "volatileEnded") {
      const text = event.effect === "confusion" ? `${activeName(state, event.side)} n'est plus confus.`
        : event.effect === "disable" ? `${activeName(state, event.side)} peut de nouveau utiliser toutes ses capacités.`
          : event.effect === "encore" ? `${activeName(state, event.side)} n'est plus sous Encore.`
            : `${activeName(state, event.side)} est libéré.`;
      message(text, "status");
    } else if (event.type === "confusionDamage") {
      health(event.side, event.hp, `${activeName(state, event.side)} se blesse dans sa confusion et perd ${event.amount} PV.`);
    } else if (event.type === "bindingDamage") {
      health(event.side, event.hp, `${activeName(state, event.side)} souffre de ${event.move} et perd ${event.amount} PV.`);
    } else if (event.type === "curseDamage") {
      health(event.side, event.hp, `${activeName(state, event.side)} souffre de la malédiction et perd ${event.amount} PV.`);
    } else if (event.type === "itemActivated") {
      health(event.side, event.hp, event.effect === "heal"
        ? `${activeName(state, event.side)} récupère ${event.amount} PV grâce à ${event.item}.`
        : `${activeName(state, event.side)} perd ${event.amount} PV à cause de ${event.item}.`);
    } else if (event.type === "heldItemConsumed") {
      message(`${activeName(state, event.side)} consomme ${event.item}.`, "status");
    } else if (event.type === "trainerItemUsed") {
      const team = state.teams[event.side];
      const target = team.members[event.targetIndex];
      if (target !== undefined) {
        state = { ...state, teams: { ...state.teams, [event.side]: { ...team,
          members: team.members.map((member, index) => index === event.targetIndex
            ? { ...member, hp: Math.min(member.stats.maxHp, member.hp + event.hpRestored),
              moves: event.movePp === null ? member.moves : member.moves.map((slot, moveIndex) =>
                ({ ...slot, pp: event.movePp?.[moveIndex] ?? slot.pp })),
              stages: event.statRaised === null ? member.stages : { ...member.stages,
                [event.statRaised]: member.stages[event.statRaised] + event.stagesRaised },
              ...(event.statusCured === null ? {} : { majorStatus: null }) } : member) } } };
        const effect = event.hpRestored > 0 ? ` et récupère ${event.hpRestored} PV`
          : event.ppRestored > 0 ? ` et récupère ${event.ppRestored} PP`
            : event.statRaised === null ? "" : ` : ${STAT_NAMES[event.statRaised]} augmente`;
        message(`${target.name} reçoit ${event.itemId}${effect}.`, "status");
      }
    } else if (event.type === "captureAttempted") {
      const target = Object.values(state.teams).flatMap((team) => team.members)
        .find((member) => member.id === event.target);
      steps.push({ kind: "capture", ballId: event.ballId, targetId: event.target,
        targetName: target?.name ?? "Le Pokémon sauvage", shakes: event.shakes,
        critical: event.critical, success: event.success, state });
    } else if (event.type === "abilityActivated") {
      message(`Le talent ${event.ability} de ${activeName(state, event.side)} s'active !`, "status");
    } else if (event.type === "statStageChanged") {
      message(`${STAT_NAMES[event.stat]} de ${activeName(state, event.target)} ${event.delta > 0 ? "augmente" : "baisse"}.`, "status");
    } else if (event.type === "statStageChangeFailed") {
      message(`${STAT_NAMES[event.stat]} de ${activeName(state, event.target)} ne peut plus changer.`, "status");
    } else if (event.type === "actionSkipped") {
      const reason = event.reason === "sleep" ? "est endormi"
        : event.reason === "paralysis" ? "est paralysé et ne peut pas agir"
          : event.reason === "flinch" ? "a peur et ne peut pas agir"
            : event.reason === "confusion" ? "ne peut pas agir à cause de sa confusion"
              : event.reason === "disabled" ? "ne peut pas utiliser cette capacité"
          : event.reason === "no-pp" ? "n'a plus de PP pour cette capacité"
            : event.reason === "item-blocked" ? "est bloqué par son objet"
              : event.reason === "taunted" ? "est provoqué et ne peut pas utiliser cette capacité"
              : "est K.O.";
      message(`${activeName(state, event.side)} ${reason}.`, "status");
    } else if (event.type === "fainted") {
      state = withActiveHp(state, event.side, 0);
      steps.push({ kind: "faint", side: event.side,
        message: `${activeName(state, event.side)} est K.O. !`, state });
    } else if (event.type === "replacementRequired") {
      if (!state.replacementRequired.includes(event.side)) {
        state = { ...state, replacementRequired: [...state.replacementRequired, event.side] };
      }
    } else if (event.type === "pokemonSwitched") {
      const fromName = state.teams[event.side].members[event.fromIndex]?.name ?? event.from;
      const toName = state.teams[event.side].members[event.toIndex]?.name ?? event.to;
      state = withSwitchedIndex(state, event.side, event.fromIndex, event.toIndex);
      steps.push({ kind: "replacement", side: event.side,
        message: event.reason === "replacement" ? `${toName}, en avant !` : `${fromName} revient. ${toName}, en avant !`, state });
    } else if (event.type === "battleEnded") {
      state = { ...state, status: "finished", winner: event.winner, replacementRequired: [] };
    } else if (event.type === "turnEnded") {
      state = { ...state, turn: event.turn + 1 };
    }
  }
  return steps;
}
