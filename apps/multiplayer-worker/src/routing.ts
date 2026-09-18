import { normalizeRoomCode } from "@pokemon-z-battle/multiplayer-protocol";

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(randomValues: Uint8Array): string {
  if (randomValues.length < 6) throw new RangeError("Six octets aléatoires sont requis.");
  return [...randomValues.slice(0, 6)].map((value) => ROOM_ALPHABET[value % ROOM_ALPHABET.length]).join("");
}

export function roomCodeFromPath(pathname: string, suffix: "join" | "socket"): string | null {
  const match = new RegExp(`^/api/rooms/([^/]+)/${suffix}$`, "u").exec(pathname);
  if (match?.[1] === undefined) return null;
  try {
    return normalizeRoomCode(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}
