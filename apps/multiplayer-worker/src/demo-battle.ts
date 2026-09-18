import { MINIMAL_MOVE_CATALOG, createTeamBattleState, type BattleSide, type BattlerState, type TeamBattleState } from "@pokemon-z-battle/battle-engine";

function battler(side: BattleSide, index: number): BattlerState {
  const player = side === "player";
  const roster = player
    ? [
        { species: "BULBASAUR", name: "Bulbizarre", types: ["GRASS", "POISON"], moves: [MINIMAL_MOVE_CATALOG.TACKLE, MINIMAL_MOVE_CATALOG.VINEWHIP, MINIMAL_MOVE_CATALOG.SLEEPPOWDER, MINIMAL_MOVE_CATALOG.POISONPOWDER] },
        { species: "EEVEE", name: "Évoli", types: ["NORMAL"], moves: [MINIMAL_MOVE_CATALOG.TACKLE, MINIMAL_MOVE_CATALOG.QUICKATTACK, MINIMAL_MOVE_CATALOG.TOXIC] },
        { species: "PIKACHU", name: "Pikachu", types: ["ELECTRIC", "POISON"], moves: [MINIMAL_MOVE_CATALOG.QUICKATTACK, MINIMAL_MOVE_CATALOG.SWIFT, MINIMAL_MOVE_CATALOG.THUNDERWAVE] },
      ]
    : [
        { species: "SQUIRTLE", name: "Carapuce", types: ["WATER"], moves: [MINIMAL_MOVE_CATALOG.TACKLE, MINIMAL_MOVE_CATALOG.WATERGUN, MINIMAL_MOVE_CATALOG.ICEBEAM, MINIMAL_MOVE_CATALOG.CUT] },
        { species: "CHARMANDER", name: "Salamèche", types: ["FIRE"], moves: [MINIMAL_MOVE_CATALOG.SCRATCH, MINIMAL_MOVE_CATALOG.SWIFT, MINIMAL_MOVE_CATALOG.WILLOWISP, MINIMAL_MOVE_CATALOG.LUZDECADENTE] },
        { species: "EEVEE", name: "Évoli", types: ["NORMAL"], moves: [MINIMAL_MOVE_CATALOG.TACKLE, MINIMAL_MOVE_CATALOG.SWIFT, MINIMAL_MOVE_CATALOG.TOXIC] },
      ];
  const selected = roster[index];
  if (selected === undefined) throw new RangeError("Invalid demo team index.");
  return {
    id: `${side}-${index}`,
    species: selected.species,
    name: selected.name,
    level: 50,
    types: selected.types,
    stats: player
      ? { maxHp: 125, attack: 69, defense: 69, specialAttack: 85, specialDefense: 85, speed: 65 }
      : { maxHp: 124, attack: 68, defense: 85, specialAttack: 70, specialDefense: 84, speed: 63 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    hp: player ? 125 : 124,
    majorStatus: null,
    ability: null,
    heldItem: null,
    moves: selected.moves.map((move) => ({ move, pp: move.pp })),
  };
}

export function createDemoBattle(): TeamBattleState {
  return createTeamBattleState({
    player: [0, 1, 2].map((index) => battler("player", index)),
    opponent: [0, 1, 2].map((index) => battler("opponent", index)),
  });
}
