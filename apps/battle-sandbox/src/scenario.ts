import {
  SeededRandom,
  resolveTurn,
  type BattleSide,
  type BattleState,
  type BattleStats,
  type BattlerState,
  type TurnActions,
  type TurnResult,
} from "@pokemon-z-battle/battle-engine";
import { findPreset, type PokemonPreset } from "./presets.js";

export const SCENARIO_VERSION = 1 as const;

export interface ScenarioTurn {
  readonly playerMove: number;
  readonly opponentMove: number;
}

export interface BattleScenario {
  readonly version: typeof SCENARIO_VERSION;
  readonly seed: number;
  readonly player: string;
  readonly opponent: string;
  readonly turns: readonly ScenarioTurn[];
}

export interface ScenarioReplay {
  readonly initialState: BattleState;
  readonly state: BattleState;
  readonly results: readonly TurnResult[];
}

function level50Stat(base: number): number {
  return Math.floor(((2 * base + 31) * 50) / 100) + 5;
}

export function statsAtLevel50(preset: PokemonPreset): BattleStats {
  return {
    maxHp: Math.floor(((2 * preset.baseStats.hp + 31) * 50) / 100) + 60,
    attack: level50Stat(preset.baseStats.attack),
    defense: level50Stat(preset.baseStats.defense),
    specialAttack: level50Stat(preset.baseStats.specialAttack),
    specialDefense: level50Stat(preset.baseStats.specialDefense),
    speed: level50Stat(preset.baseStats.speed),
  };
}

function createBattler(side: BattleSide, preset: PokemonPreset): BattlerState {
  const stats = statsAtLevel50(preset);
  return {
    id: side,
    species: preset.species,
    name: preset.name,
    level: 50,
    types: [...preset.types],
    stats,
    stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    hp: stats.maxHp,
    moves: preset.moves.map((move) => ({ move, pp: move.pp })),
  };
}

export function createInitialState(playerSpecies: string, opponentSpecies: string): BattleState {
  const player = findPreset(playerSpecies);
  const opponent = findPreset(opponentSpecies);
  if (player === undefined || opponent === undefined) throw new Error("Pokemon inconnu dans ce sandbox.");
  return {
    turn: 1,
    status: "active",
    winner: null,
    battlers: { player: createBattler("player", player), opponent: createBattler("opponent", opponent) },
  };
}

function actionsFor(turn: ScenarioTurn): TurnActions {
  return {
    player: { kind: "move", moveIndex: turn.playerMove },
    opponent: { kind: "move", moveIndex: turn.opponentMove },
  };
}

export function replayScenario(scenario: BattleScenario): ScenarioReplay {
  const initialState = createInitialState(scenario.player, scenario.opponent);
  const rng = new SeededRandom(scenario.seed);
  const results: TurnResult[] = [];
  let state = initialState;
  for (const turn of scenario.turns) {
    if (state.status === "finished") throw new Error("Le scénario contient des actions après la fin du combat.");
    const result = resolveTurn(state, actionsFor(turn), rng);
    results.push(result);
    state = result.state;
  }
  return { initialState, state, results };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseScenario(value: unknown): BattleScenario {
  if (!isRecord(value) || value.version !== SCENARIO_VERSION) throw new Error("Version de scénario non supportée.");
  if (!Number.isSafeInteger(value.seed)) throw new Error("La seed doit être un entier sûr.");
  if (typeof value.player !== "string" || findPreset(value.player) === undefined) throw new Error("Pokémon joueur inconnu.");
  if (typeof value.opponent !== "string" || findPreset(value.opponent) === undefined) throw new Error("Pokémon adversaire inconnu.");
  if (!Array.isArray(value.turns)) throw new Error("La liste des tours est absente.");

  const player = findPreset(value.player);
  const opponent = findPreset(value.opponent);
  if (player === undefined || opponent === undefined) throw new Error("Pokémon inconnu.");
  const turns = value.turns.map((turn, index) => {
    if (!isRecord(turn) || !Number.isInteger(turn.playerMove) || !Number.isInteger(turn.opponentMove)) {
      throw new Error(`Actions invalides au tour ${index + 1}.`);
    }
    const playerMove = Number(turn.playerMove);
    const opponentMove = Number(turn.opponentMove);
    if (playerMove < 0 || playerMove >= player.moves.length || opponentMove < 0 || opponentMove >= opponent.moves.length) {
      throw new Error(`Index d'attaque invalide au tour ${index + 1}.`);
    }
    return { playerMove, opponentMove };
  });
  return { version: SCENARIO_VERSION, seed: Number(value.seed), player: value.player, opponent: value.opponent, turns };
}
