import type { BattleMove } from "./types.js";

export const MINIMAL_MOVE_CATALOG = {
  TACKLE: { id: 303, internalName: "TACKLE", name: "Placaje", functionCode: "000", power: 40, type: "NORMAL", category: "Physical", accuracy: 100, pp: 35, priority: 0 },
  QUICKATTACK: { id: 310, internalName: "QUICKATTACK", name: "At. Rápido", functionCode: "000", power: 40, type: "NORMAL", category: "Physical", accuracy: 100, pp: 30, priority: 1 },
  SCRATCH: { id: 311, internalName: "SCRATCH", name: "Arañazo", functionCode: "000", power: 40, type: "NORMAL", category: "Physical", accuracy: 100, pp: 35, priority: 0 },
  WATERGUN: { id: 551, internalName: "WATERGUN", name: "Pistola Agua", functionCode: "000", power: 45, type: "WATER", category: "Special", accuracy: 100, pp: 25, priority: 0 },
  VINEWHIP: { id: 208, internalName: "VINEWHIP", name: "Látigo Cepa", functionCode: "000", power: 45, type: "GRASS", category: "Physical", accuracy: 100, pp: 15, priority: 0 },
  SWIFT: { id: 299, internalName: "SWIFT", name: "Meteoros", functionCode: "0A5", power: 60, type: "NORMAL", category: "Special", accuracy: 0, pp: 20, priority: 0 },
} as const satisfies Readonly<Record<string, BattleMove>>;
