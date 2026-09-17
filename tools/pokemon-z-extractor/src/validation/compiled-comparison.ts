import type {
  CompiledFileComparison,
  MoveDefinition,
  NormalizedDataset,
  PokemonDefinition,
  TypeDefinition,
} from "@pokemon-z-battle/game-data";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { hashFile } from "../inventory/hash-file.js";

const COMPILED_MOVE_RECORD_SIZE = 14;
const COMPILED_POKEMON_RECORD_SIZE = 76;

const CATEGORY_IDS = {
  Physical: 0,
  Special: 1,
  Status: 2,
} as const;

function flagsToBits(flags: string): number {
  let bits = 0;
  for (const flag of flags) {
    const index = flag.charCodeAt(0) - "a".charCodeAt(0);
    if (index >= 0 && index < 16) bits |= 1 << index;
  }
  return bits;
}

function parseHex(value: string): number {
  return Number.parseInt(value, 16);
}

export async function compareCompiledMoves(
  sourceDirectory: string,
  moves: NormalizedDataset<"moves", MoveDefinition>,
  types: NormalizedDataset<"types", TypeDefinition>,
): Promise<CompiledFileComparison> {
  const relativeFile = "Data/moves.dat";
  const filePath = path.join(sourceDirectory, "Data", "moves.dat");
  const [data, sha256] = await Promise.all([readFile(filePath), hashFile(filePath)]);
  const typeIds = new Map(types.records.map((type) => [type.internalName, type.id]));
  const maxId = Math.max(...moves.records.map((move) => move.id));
  const mismatches: string[] = [];
  const expectedSize = (maxId + 1) * COMPILED_MOVE_RECORD_SIZE;
  if (data.length !== expectedSize) {
    mismatches.push(`Taille ${data.length}, attendu ${expectedSize}.`);
  }

  for (const move of moves.records) {
    const offset = move.id * COMPILED_MOVE_RECORD_SIZE;
    if (offset + COMPILED_MOVE_RECORD_SIZE > data.length) {
      mismatches.push(`ID ${move.id}: enregistrement absent.`);
      continue;
    }

    const expected = {
      functionCode: parseHex(move.functionCode),
      power: move.power,
      type: typeIds.get(move.type),
      category: CATEGORY_IDS[move.category],
      accuracy: move.accuracy,
      pp: move.pp,
      effectChance: move.effectChance,
      targetCode: parseHex(move.targetCode),
      priority: move.priority,
      flags: flagsToBits(move.flags),
    };
    const actual = {
      functionCode: data.readUInt16LE(offset),
      power: data.readUInt8(offset + 2),
      type: data.readUInt8(offset + 3),
      category: data.readUInt8(offset + 4),
      accuracy: data.readUInt8(offset + 5),
      pp: data.readUInt8(offset + 6),
      effectChance: data.readUInt8(offset + 7),
      targetCode: data.readUInt16LE(offset + 8),
      priority: data.readInt8(offset + 10),
      flags: data.readUInt16LE(offset + 11),
    };

    for (const key of Object.keys(actual) as (keyof typeof actual)[]) {
      if (actual[key] !== expected[key]) {
        mismatches.push(
          `ID ${move.id} ${key}: compile=${actual[key]}, PBS=${String(expected[key])}.`,
        );
      }
    }
  }

  return {
    file: relativeFile,
    sha256,
    status: mismatches.length === 0 ? "match" : "mismatch",
    checkedRecords: moves.records.length,
    mismatches,
  };
}

export async function compareCompiledPokemonSize(
  sourceDirectory: string,
  pokemon: NormalizedDataset<"pokemon", PokemonDefinition>,
): Promise<CompiledFileComparison> {
  const relativeFile = "Data/dexdata.dat";
  const filePath = path.join(sourceDirectory, "Data", "dexdata.dat");
  const [fileStat, sha256] = await Promise.all([stat(filePath), hashFile(filePath)]);
  const maxId = Math.max(...pokemon.records.map((record) => record.id));
  const expectedSize = maxId * COMPILED_POKEMON_RECORD_SIZE;
  const mismatches = fileStat.size === expectedSize
    ? []
    : [`Taille ${fileStat.size}, attendu ${expectedSize}.`];

  return {
    file: relativeFile,
    sha256,
    status: mismatches.length === 0 ? "match" : "mismatch",
    checkedRecords: pokemon.records.length,
    mismatches,
  };
}
