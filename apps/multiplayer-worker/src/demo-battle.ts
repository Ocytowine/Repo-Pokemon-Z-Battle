import { MINIMAL_MOVE_CATALOG, type BattleSide, type BattleState, type BattlerState } from "@pokemon-z-battle/battle-engine";

function battler(side: BattleSide): BattlerState {
  const player = side === "player";
  const moves = player
    ? [MINIMAL_MOVE_CATALOG.TACKLE, MINIMAL_MOVE_CATALOG.VINEWHIP]
    : [MINIMAL_MOVE_CATALOG.TACKLE, MINIMAL_MOVE_CATALOG.WATERGUN];
  return {
    id: side,
    species: player ? "BULBASAUR" : "SQUIRTLE",
    name: player ? "Bulbizarre" : "Carapuce",
    level: 50,
    types: player ? ["GRASS", "POISON"] : ["WATER"],
    stats: player
      ? { maxHp: 125, attack: 69, defense: 69, specialAttack: 85, specialDefense: 85, speed: 65 }
      : { maxHp: 124, attack: 68, defense: 85, specialAttack: 70, specialDefense: 84, speed: 63 },
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    hp: player ? 125 : 124,
    moves: moves.map((move) => ({ move, pp: move.pp })),
  };
}

export function createDemoBattle(): BattleState {
  return {
    turn: 1,
    status: "active",
    winner: null,
    battlers: { player: battler("player"), opponent: battler("opponent") },
  };
}
