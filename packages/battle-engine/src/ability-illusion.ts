import type { BattleTeam, BattlerState } from "./types.js";

function decoyFor(team: BattleTeam, activeIndex: number): BattlerState | undefined {
  for (let index = team.members.length - 1; index >= 0; index -= 1) {
    const member = team.members[index];
    if (index !== activeIndex && member !== undefined && member.hp > 0) return member;
  }
  return undefined;
}

/** Builds only the public decoy. Mechanical identity always remains on the real battler. */
export function applyIllusion(team: BattleTeam, activeIndex: number, suppressed = false): BattleTeam {
  const active = team.members[activeIndex];
  if (active === undefined) return team;
  const { illusion: _oldIllusion, ...revealed } = active;
  if (suppressed || active.ability !== "ILLUSION" || active.hp <= 0) {
    if (active.illusion === undefined) return team;
    return { ...team, members: team.members.map((member, index) => index === activeIndex ? revealed : member) };
  }
  const decoy = decoyFor(team, activeIndex);
  if (decoy === undefined) return { ...team,
    members: team.members.map((member, index) => index === activeIndex ? revealed : member) };
  const illusion = { species: decoy.species, name: decoy.name, types: [...decoy.types],
    form: decoy.appearance?.form ?? 0,
    shiny: decoy.appearance?.shiny ?? false, gender: decoy.appearance?.gender ?? null };
  return { ...team, members: team.members.map((member, index) => index === activeIndex
    ? { ...revealed, illusion } : member) };
}

