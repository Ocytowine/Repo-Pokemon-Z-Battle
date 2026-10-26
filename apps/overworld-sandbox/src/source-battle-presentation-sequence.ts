import type { BattleSide, DoubleBattleEvent, TeamBattleEvent, TeamBattleState } from "@pokemon-z-battle/battle-engine";

export interface SourceBattlePresentationOptions {
  readonly abilityName?: (internalName: string) => string;
  readonly itemName?: (internalName: string) => string;
  readonly moveName?: (internalName: string) => string;
}

export type SourceBattleStatusVisual = "burn" | "caduco" | "confusion" | "cured" | "flinch" | "frozen"
  | "hemorrhage" | "paralysis" | "poison" | "sleep" | "stat-down" | "stat-up";

export type SourceBattlePresentationStep =
  | { readonly kind: "action"; readonly side: BattleSide; readonly move: string;
      readonly message: string; readonly state: TeamBattleState }
  | { readonly kind: "impact"; readonly side: BattleSide; readonly effectiveness: number;
      readonly state: TeamBattleState }
  | { readonly kind: "health"; readonly side: BattleSide; readonly from: number; readonly to: number;
      readonly message: string; readonly state: TeamBattleState }
  | { readonly kind: "message"; readonly message: string; readonly state: TeamBattleState }
  | { readonly kind: "status"; readonly message: string; readonly state: TeamBattleState;
      readonly side?: BattleSide; readonly visual?: SourceBattleStatusVisual }
  | { readonly kind: "mega-evolution"; readonly side: BattleSide; readonly teamIndex: number;
      readonly activationMessage: string; readonly message: string;
      readonly beforeState: TeamBattleState; readonly state: TeamBattleState }
  | { readonly kind: "form-change"; readonly side: BattleSide;
      readonly message: string; readonly state: TeamBattleState }
  | { readonly kind: "faint"; readonly side: BattleSide; readonly message: string; readonly state: TeamBattleState }
  | { readonly kind: "replacement"; readonly side: BattleSide; readonly message: string;
      readonly state: TeamBattleState }
  | { readonly kind: "capture"; readonly ballId: string; readonly targetId: string;
      readonly targetName: string; readonly shakes: number; readonly critical: boolean;
      readonly success: boolean; readonly state: TeamBattleState };

const STATUS_NAMES = {
  burn: "la brûlure",
  caduco: "l’Exténuation",
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

function battlerName(state: TeamBattleState, id: string): string {
  return Object.values(state.teams).flatMap((team) => team.members).find((member) => member.id === id)?.name ?? id;
}

function withActiveHp(state: TeamBattleState, side: BattleSide, hp: number): TeamBattleState {
  const team = state.teams[side];
  return { ...state, teams: { ...state.teams, [side]: { ...team,
    members: team.members.map((member, index) => index === team.activeIndex ? { ...member, hp } : member) } } };
}

function withActiveHeldItem(state: TeamBattleState, side: BattleSide, heldItem: string | null): TeamBattleState {
  const team = state.teams[side];
  return { ...state, teams: { ...state.teams, [side]: { ...team,
    members: team.members.map((member, index) => index === team.activeIndex ? { ...member, heldItem } : member) } } };
}

function withActiveIndex(state: TeamBattleState, side: BattleSide, activeIndex: number): TeamBattleState {
  const team = state.teams[side];
  return { ...state, teams: { ...state.teams, [side]: { ...team, activeIndex } },
    replacementRequired: state.replacementRequired.filter((candidate) => candidate !== side) };
}

function withMegaEvolution(state: TeamBattleState, side: BattleSide, teamIndex: number,
  form: number): TeamBattleState {
  const team = state.teams[side];
  const member = team.members[teamIndex];
  const target = member?.megaEvolution;
  if (member === undefined || target === undefined) return state;
  const damage = member.stats.maxHp - member.hp;
  return { ...state, teams: { ...state.teams, [side]: { ...team,
    members: team.members.map((candidate, index) => index !== teamIndex ? candidate : { ...candidate,
      stats: { ...target.stats }, types: [...target.types], ability: target.ability,
      hp: Math.max(0, Math.min(target.stats.maxHp, target.stats.maxHp - damage)),
      appearance: { form, shiny: candidate.appearance?.shiny ?? false,
        gender: candidate.appearance?.gender ?? null } }) } } };
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
  events: readonly (TeamBattleEvent | DoubleBattleEvent)[],
  options: SourceBattlePresentationOptions = {}): readonly SourceBattlePresentationStep[] {
  let state = before;
  const steps: SourceBattlePresentationStep[] = [];
  const message = (value: string, kind: "message" | "status" = "message",
    visual?: { readonly side: BattleSide; readonly effect: SourceBattleStatusVisual }): void => {
    if (kind === "status") {
      steps.push({ kind, message: value, state,
        ...(visual === undefined ? {} : { side: visual.side, visual: visual.effect }) });
    } else {
      steps.push({ kind, message: value, state });
    }
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
      const positionedSteps = buildSourceBattlePresentationSequence(positioned, event.events, options);
      steps.push(...positionedSteps);
      const resolved = positionedSteps.at(-1)?.state ?? positioned;
      // Conserver les PV/statuts produits par cette action pour la suivante, sans
      // laisser le pointeur visuel d'un slot devenir le slot logique principal.
      state = { ...resolved, teams: {
        player: { ...resolved.teams.player, activeIndex: previousActive.player },
        opponent: { ...resolved.teams.opponent, activeIndex: previousActive.opponent },
      } };
    } else if (event.type === "megaEvolved") {
      const beforeState = state;
      const before = state.teams[event.side].members[event.teamIndex];
      state = withMegaEvolution(state, event.side, event.teamIndex, event.toForm);
      const pokemon = state.teams[event.side].members[event.teamIndex];
      const name = pokemon?.name ?? before?.name ?? "Le Pokémon";
      steps.push({ kind: "mega-evolution", side: event.side, teamIndex: event.teamIndex,
        activationMessage: `Le lien avec son Dresseur déclenche la Méga-Évolution de ${name} !`,
        message: `${name} a Méga-Évolué !`, beforeState, state });
    } else if (event.type === "moveUsed") {
      const battler = state.teams[event.side].members[state.teams[event.side].activeIndex];
      const move = battler?.moves.find((slot) => slot.move.internalName === event.move)?.move;
      steps.push({ kind: "action", side: event.side, move: event.move,
        message: `${activeName(state, event.side)} utilise ${move?.name ?? event.move} !`, state });
    } else if (event.type === "moveReflected") {
      message(`${activeName(state, event.target)} renvoie ${event.move} !`, "status");
    } else if (event.type === "moveSnatched") {
      message(`${activeName(state, event.target)} vole l'effet de ${event.move} !`, "status");
    } else if (event.type === "damageApplied") {
      const targetName = activeName(state, event.target);
      steps.push({ kind: "impact", side: event.target, effectiveness: event.effectiveness, state });
      health(event.target, event.hp, event.amount === 0
        ? `${targetName} ne perd aucun PV.`
        : `${targetName} perd ${event.amount} PV.`);
      if (event.critical) message("Coup critique !");
      const effectiveness = effectivenessMessage(event.effectiveness);
      if (effectiveness !== null) message(effectiveness);
    } else if (event.type === "substituteChanged") {
      const name = activeName(state, event.side);
      health(event.side, event.battlerHp, event.move === "SUBSTITUTE"
        ? `${name} crée un substitut.`
        : event.hp > 0 ? `Le substitut de ${name} absorbe le coup.`
          : `Le substitut de ${name} disparaît.`);
    } else if (event.type === "collateralDamage") {
      health(event.target, event.hp,
        `Les flammes atteignent aussi ${activeName(state, event.target)} : ${event.amount} PV perdus.`);
    } else if (event.type === "hpRestored") {
      health(event.side, event.hp, `${activeName(state, event.side)} récupère ${event.amount} PV.`);
    } else if (event.type === "hpShared") {
      health(event.side, event.hp, `Les PV de ${activeName(state, event.side)} sont rééquilibrés.`);
    } else if (event.type === "moveMissed") {
      message(`${activeName(state, event.side)} rate son attaque.`);
    } else if (event.type === "moveFailed") {
      message(event.reason === "protected" ? `${activeName(state, event.side)} est bloqué par la protection adverse.`
        : event.reason === "taunted" ? `${activeName(state, event.side)} ne peut pas utiliser cette capacité sous l'effet de Provoc.`
          : "Mais cela échoue !", "status");
    } else if (event.type === "abilityChanged") {
      message(`${activeName(state, event.target)} acquiert le talent ${event.ability}.`, "status");
    } else if (event.type === "abilitySuppressed") {
      message(`Le talent de ${activeName(state, event.target)} est supprimé.`, "status");
    } else if (event.type === "abilitiesSwapped") {
      message(`${activeName(state, event.source)} et ${activeName(state, event.target)} échangent leurs talents.`, "status");
    } else if (event.type === "typesChanged") {
      const team = state.teams[event.target];
      state = { ...state, teams: { ...state.teams, [event.target]: { ...team,
        members: team.members.map((member, index) => index === team.activeIndex
          ? { ...member, types: [...event.types] } : member) } } };
      message(`Le type de ${activeName(state, event.target)} change.`, "status");
    } else if (event.type === "formChanged") {
      const team = state.teams[event.side];
      state = { ...state, teams: { ...state.teams, [event.side]: { ...team,
        members: team.members.map((member, index) => index === team.activeIndex
          ? { ...member, appearance: { form: event.toForm,
            shiny: member.appearance?.shiny ?? false,
            gender: member.appearance?.gender ?? null } } : member) } } };
      steps.push({ kind: "form-change", side: event.side,
        message: `${activeName(state, event.side)} change de forme.`, state });
    } else if (event.type === "moveCopied") {
      message(`${activeName(state, event.side)} apprend ${event.copiedMove}${event.permanent ? " définitivement" : " temporairement"}.`, "status");
    } else if (event.type === "ppReduced") {
      message(`${event.move} perd ${event.amount} PP.`, "status");
    } else if (event.type === "heldItemRemoved") {
      message(`${activeName(state, event.target)} perd son objet tenu.`, "status");
    } else if (event.type === "battleEffectChanged") {
      const labels: Record<typeof event.effect, string> = {
        reflect: "Reflet", "light-screen": "Mur Lumière", "lucky-chant": "Air Veinard",
        "mud-sport": "Lance-Boue", "water-sport": "Tourniquet", spikes: "Picots",
        "toxic-spikes": "Pics Toxik", "stealth-rock": "Piège de Roc", "sticky-web": "Toile Gluante",
        mist: "Brume", safeguard: "Rune Protect", tailwind: "Vent Arrière",
        "sea-of-fire": "La mer de flammes", swamp: "Le marécage", rainbow: "L'arc-en-ciel",
        "future-sight": "L'attaque différée",
        terrain: "Le terrain",
        "trick-room": "Distorsion", "magic-room": "Zone Magique", "wonder-room": "Zone Étrange", gravity: "Gravité", weather: "La météo",
      };
      const label = labels[event.effect];
      message(event.turns !== 0 ? `${label} agit sur le combat.` : `${label} ne fait plus effet.`, "status");
    } else if (event.type === "statusApplied") {
      message(`${activeName(state, event.target)} subit ${STATUS_NAMES[event.status]}.`, "status",
        { side: event.target, effect: event.status });
    } else if (event.type === "statusApplicationFailed") {
      message(event.reason === "already-status"
        ? `${activeName(state, event.target)} a déjà un problème de statut.`
        : `${activeName(state, event.target)} est immunisé contre ${STATUS_NAMES[event.status]}.`, "status");
    } else if (event.type === "statusContinued") {
      message(`${activeName(state, event.side)} est affecté par ${STATUS_NAMES[event.status]}.`, "status",
        { side: event.side, effect: event.status });
    } else if (event.type === "statusCured") {
      message(`${activeName(state, event.side)} n'est plus affecté par ${STATUS_NAMES[event.status]}.`, "status",
        { side: event.side, effect: "cured" });
    } else if (event.type === "statusDamage") {
      health(event.side, event.hp, `${activeName(state, event.side)} souffre de ${STATUS_NAMES[event.status]} et perd ${event.amount} PV.`);
    } else if (event.type === "weatherDamage") {
      health(event.side, event.hp, `${activeName(state, event.side)} est blessé par la tempête de sable et perd ${event.amount} PV.`);
    } else if (event.type === "entryHazardDamage") {
      health(event.side, event.hp, `${activeName(state, event.side)} perd ${event.amount} PV à cause ${event.hazard === "spikes" ? "des Picots" : "du Piège de Roc"}.`);
    } else if (event.type === "volatileApplied") {
      const name = activeName(state, event.target);
      const text = event.effect === "confusion" ? `${name} devient confus.`
        : event.effect === "flinch" ? `${name} a peur.`
          : event.effect === "focus-energy" ? `${name} se concentre.`
            : event.effect === "identified" ? `${name} est identifié.`
              : event.effect === "miracle-eye" ? `${name} est repéré par Œil Miracle.`
                : event.effect === "lock-on" ? `${name} est verrouillé comme cible.`
                  : event.effect === "quick-guard" ? `L'équipe de ${name} se protège des attaques prioritaires.`
                    : event.effect === "wide-guard" ? `L'équipe de ${name} se protège des attaques de zone.`
                      : event.effect === "torment" ? `${name} est soumis à Tourmente.`
                        : event.effect === "imprison" ? `${name} scelle les capacités communes.`
                          : event.effect === "magic-coat" ? `${name} se prépare à renvoyer les capacités.`
                            : event.effect === "snatch" ? `${name} guette une capacité à voler.`
                            : event.effect === "heal-block" ? `${name} ne peut plus se soigner.`
                              : event.effect === "magnet-rise" ? `${name} s'élève par magnétisme.`
                                : event.effect === "telekinesis" ? `${name} est soulevé dans les airs.`
                                  : event.effect === "smack-down" ? `${name} est ramené au sol.`
              : event.effect === "disable" ? `${event.move ?? "Une capacité"} de ${name} est neutralisée.`
                : event.effect === "encore" ? `${name} doit répéter ${event.move ?? "sa dernière capacité"}.`
                  : event.effect === "curse" ? `${name} est maudit.`
                    : event.effect === "nightmare" ? `${name} est tourmenté par un cauchemar.`
                    : event.effect === "taunt" ? `${name} est provoqué.`
                      : event.effect === "protect" ? `${name} se protège.`
                        : event.effect === "endure" ? `${name} se prépare à tenir le coup.`
                          : event.effect === "rage" ? `${name} entre en rage.`
                            : event.effect === "charge" ? `${name} prépare son attaque.`
                              : event.effect === "sky-drop" ? `${name} est emporté dans les airs.`
                              : event.effect === "helping-hand" ? `${name} reçoit un coup de main.`
                                : event.effect === "follow-me" ? `${name} attire l'attention.`
                                  : event.effect === "after-you" ? `${name} agit ensuite.`
                                    : event.effect === "quash" ? `${name} agira en dernier.`
                                      : event.effect === "ally-switch" ? `${name} échange sa position avec son allié.`
                                : event.effect === "leech-seed" ? `${name} est infecté par Vampigraine.`
                            : `${name} est pris au piège par ${event.move ?? "l'attaque"}.`;
      message(text, "status", event.effect === "confusion" || event.effect === "flinch"
        ? { side: event.target, effect: event.effect } : undefined);
    } else if (event.type === "volatileEnded") {
      const text = event.effect === "confusion" ? `${activeName(state, event.side)} n'est plus confus.`
        : event.effect === "disable" ? `${activeName(state, event.side)} peut de nouveau utiliser toutes ses capacités.`
          : event.effect === "encore" ? `${activeName(state, event.side)} n'est plus sous Encore.`
            : event.effect === "sky-drop" ? `${activeName(state, event.side)} retombe au sol.`
              : event.effect === "heal-block" ? `${activeName(state, event.side)} peut de nouveau se soigner.`
                : event.effect === "magnet-rise" ? `${activeName(state, event.side)} retombe au sol.`
                  : event.effect === "telekinesis" ? `${activeName(state, event.side)} retombe au sol.`
            : event.effect === "nightmare" ? `${activeName(state, event.side)} n'est plus tourmenté par son cauchemar.`
              : `${activeName(state, event.side)} est libéré.`;
      message(text, "status");
    } else if (event.type === "confusionDamage") {
      health(event.side, event.hp, `${activeName(state, event.side)} se blesse dans sa confusion et perd ${event.amount} PV.`);
    } else if (event.type === "bindingDamage") {
      health(event.side, event.hp, `${activeName(state, event.side)} souffre de ${event.move} et perd ${event.amount} PV.`);
    } else if (event.type === "leechSeedDamage") {
      health(event.side, event.hp, `${activeName(state, event.side)} perd ${event.amount} PV à cause de Vampigraine.`);
    } else if (event.type === "curseDamage") {
      health(event.side, event.hp, `${activeName(state, event.side)} souffre de la malédiction et perd ${event.amount} PV.`);
    } else if (event.type === "nightmareDamage") {
      health(event.side, event.hp, `${activeName(state, event.side)} souffre d'un cauchemar et perd ${event.amount} PV.`);
    } else if (event.type === "pledgeDamage") {
      health(event.side, event.hp, `${activeName(state, event.side)} perd ${event.amount} PV dans la mer de flammes.`);
    } else if (event.type === "futureSightHit") {
      message(`${event.move} frappe ${activeName(state, event.target)} !`, "attack");
    } else if (event.type === "calledMoveTriggered") {
      message(`${activeName(state, event.side)} déclenche ${event.move} !`, "attack");
    } else if (event.type === "recoilDamage") {
      health(event.side, event.hp, event.reason === "belly-drum"
        ? `${activeName(state, event.side)} sacrifie ${event.amount} PV pour se renforcer !`
        : `${activeName(state, event.side)} est blessé par le contrecoup et perd ${event.amount} PV.`);
    } else if (event.type === "itemActivated") {
      if (event.effect === "boost") message(`${activeName(state, event.side)} utilise ${event.item}.`, "status");
      else health(event.side, event.hp, event.effect === "heal"
        ? `${activeName(state, event.side)} récupère ${event.amount} PV grâce à ${event.item}.`
        : `${activeName(state, event.side)} perd ${event.amount} PV à cause de ${event.item}.`);
    } else if (event.type === "abilityDamage") {
      const ability = options.abilityName?.(event.ability) ?? event.ability;
      health(event.target, event.hp,
        `${activeName(state, event.target)} perd ${event.amount} PV à cause de ${ability}.`);
    } else if (event.type === "recoilDamage") {
      health(event.side, event.hp, event.reason === "crash"
        ? `${activeName(state, event.side)} rate son attaque et s'écrase au sol !`
        : `${activeName(state, event.side)} perd ${event.amount} PV à cause du contrecoup.`);
    } else if (event.type === "heldItemConsumed") {
      state = withActiveHeldItem(state, event.side, null);
      message(`${activeName(state, event.side)} consomme ${event.item}.`, "status");
    } else if (event.type === "heldItemTransferred") {
      const sourceName = activeName(state, event.source);
      const targetName = activeName(state, event.target);
      const sourceMember = state.teams[event.source].members[state.teams[event.source].activeIndex];
      state = withActiveHeldItem(sourceMember?.heldItem === event.item
        ? withActiveHeldItem(state, event.source, null) : state, event.target, event.item);
      const item = options.itemName?.(event.item) ?? event.item;
      message("move" in event
        ? `${sourceName} transmet ${item} à ${targetName} avec ${event.move}.`
        : `${targetName} vole ${item} à ${sourceName} !`, "status");
    } else if (event.type === "heldItemRecovered") {
      state = withActiveHeldItem(state, event.side, event.item);
      message(`${activeName(state, event.side)} récupère ${options.itemName?.(event.item) ?? event.item}.`, "status");
    } else if (event.type === "heldItemRemoved") {
      state = withActiveHeldItem(state, event.target, null);
      message(`${activeName(state, event.target)} perd ${options.itemName?.(event.item) ?? event.item}.`, "status");
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
              volatile: event.focusEnergyRaised || event.confusionCured || event.infatuationCured
                ? { ...member.volatile!, ...(event.focusEnergyRaised
                  ? { focusEnergy: (member.volatile?.focusEnergy ?? 0) + event.focusEnergyRaised } : {}),
                  ...(event.confusionCured ? { confusionTurns: 0 } : {}),
                  ...(event.infatuationCured ? { infatuated: false } : {}) }
                : member.volatile,
              ...(event.statusCured === null ? {} : { majorStatus: null }) } : member) } } };
        if (event.mistTurnsStarted) {
          const sides = state.effects?.sides ?? { player: { reflectTurns: 0, luckyChantTurns: 0 },
            opponent: { reflectTurns: 0, luckyChantTurns: 0 } };
          state = { ...state, effects: { ...state.effects,
            sides: { ...sides, [event.side]: { ...sides[event.side], mistTurns: event.mistTurnsStarted } },
            waterSportTurns: state.effects?.waterSportTurns ?? 0 } };
        }
        const effect = event.hpRestored > 0 ? ` et récupère ${event.hpRestored} PV`
          : event.ppRestored > 0 ? ` et récupère ${event.ppRestored} PP`
            : event.statRaised !== null ? ` : ${STAT_NAMES[event.statRaised]} augmente`
              : event.focusEnergyRaised ? " et augmente sa concentration"
                : event.confusionCured ? " et n'est plus confus"
                  : event.infatuationCured ? " et n'est plus amoureux"
                    : event.mistTurnsStarted ? " et protège son équipe des baisses de statistiques" : "";
        const itemName = options.itemName?.(event.itemId) ?? event.itemId;
        message(event.escaped ? `${target.name} utilise ${itemName} et quitte le combat.`
          : `${target.name} reçoit ${itemName}${effect}.`, "status");
      }
    } else if (event.type === "captureAttempted") {
      const target = Object.values(state.teams).flatMap((team) => team.members)
        .find((member) => member.id === event.target);
      steps.push({ kind: "capture", ballId: event.ballId, targetId: event.target,
        targetName: target?.name ?? "Le Pokémon sauvage", shakes: event.shakes,
        critical: event.critical, success: event.success, state });
    } else if (event.type === "abilityObserved") {
      const pokemon = activeName(state, event.side);
      const ability = options.abilityName?.(event.ability) ?? event.ability;
      const observation = event.observation;
      const text = observation.kind === "copied-ability"
        ? `${pokemon} copie le talent ${options.abilityName?.(observation.ability) ?? observation.ability} de ${battlerName(state, observation.targetId)} !`
        : observation.kind === "held-item"
          ? `${ability} de ${pokemon} détecte ${options.itemName?.(observation.item) ?? observation.item} tenu par ${battlerName(state, observation.targetId)} !`
          : observation.kind === "move"
            ? `${ability} de ${pokemon} détecte ${options.moveName?.(observation.move) ?? observation.move} !`
            : `${pokemon} frémit grâce à ${ability} !`;
      message(text, "status");
    } else if (event.type === "abilityActivated") {
      const pokemon = activeName(state, event.side);
      const ability = options.abilityName?.(event.ability) ?? event.ability;
      const text = event.effect === "prevent-stat-drop" && event.ability === "BIGPECKS"
        ? `${ability} de ${pokemon} l'empêche de perdre de la Défense !`
        : event.effect === "prevent-stat-drop" && event.ability === "KEENEYE"
          ? `${ability} de ${pokemon} l'empêche de perdre de la Précision !`
          : `Le talent ${ability} de ${pokemon} s'active !`;
      message(text, "status");
    } else if (event.type === "statStageChanged") {
      message(`${STAT_NAMES[event.stat]} de ${activeName(state, event.target)} ${event.delta > 0 ? "augmente" : "baisse"}.`, "status",
        { side: event.target, effect: event.delta > 0 ? "stat-up" : "stat-down" });
    } else if (event.type === "battleStatsChanged") {
      message(`Les statistiques de ${activeName(state, event.target)} changent.`, "status");
    } else if (event.type === "statStageChangeFailed") {
      message(event.reason === "mist" ? `La Brume protège ${activeName(state, event.target)} !`
        : `${STAT_NAMES[event.stat]} de ${activeName(state, event.target)} ne peut plus changer.`, "status");
    } else if (event.type === "actionSkipped") {
      const reason = event.reason === "sleep" ? "est endormi"
        : event.reason === "paralysis" ? "est paralysé et ne peut pas agir"
          : event.reason === "flinch" ? "a peur et ne peut pas agir"
            : event.reason === "confusion" ? "ne peut pas agir à cause de sa confusion"
              : event.reason === "disabled" ? "ne peut pas utiliser cette capacité"
          : event.reason === "no-pp" ? "n'a plus de PP pour cette capacité"
            : event.reason === "item-blocked" ? "est bloqué par son objet"
              : event.reason === "taunted" ? "est provoqué et ne peut pas utiliser cette capacité"
              : event.reason === "tormented" ? "ne peut pas répéter cette capacité sous Tourmente"
              : event.reason === "imprisoned" ? "ne peut pas utiliser une capacité scellée"
                : event.reason === "heal-blocked" ? "ne peut pas utiliser une capacité de soin"
              : event.reason === "recharge" ? "doit se reposer après son attaque"
              : event.reason === "sky-drop" ? "ne peut pas agir pendant sa chute libre"
              : "est K.O.";
      const visual = event.reason === "sleep" || event.reason === "paralysis" || event.reason === "confusion"
        || event.reason === "flinch" ? event.reason : null;
      message(`${activeName(state, event.side)} ${reason}.`, "status",
        visual === null ? undefined : { side: event.side, effect: visual });
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
