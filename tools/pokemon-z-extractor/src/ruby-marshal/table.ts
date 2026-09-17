import type { RpgTable, RubyUserDefined } from "./types.js";
import { RubyMarshalError } from "./reader.js";

export function decodeRpgTable(value: RubyUserDefined): RpgTable {
  if (value.className !== "Table") throw new RubyMarshalError(`Classe Table attendue : ${value.className}.`, 0);
  const bytes = value.bytes;
  if (bytes.length < 20) throw new RubyMarshalError("Charge Table trop courte.", 0);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dimensions = view.getInt32(0, true);
  const xSize = view.getInt32(4, true);
  const ySize = view.getInt32(8, true);
  const zSize = view.getInt32(12, true);
  const count = view.getInt32(16, true);
  if (count < 0 || bytes.length !== 20 + count * 2) {
    throw new RubyMarshalError(`Taille Table incoherente : ${count} valeurs pour ${bytes.length} octets.`, 16);
  }
  const values = Array.from({ length: count }, (_, index) => view.getInt16(20 + index * 2, true));
  return { dimensions, xSize, ySize, zSize, values };
}
