import { loadSourceSaveSlot, parseSourceSaveSlotSnapshot, persistSourceSaveSlot, sourceImportCloudHoldKey,
  type SourceSaveKind, type SourceSaveSlotId, type SourceSaveSlotSnapshot } from "./source-save-slots.js";

export interface CloudSaveHead {
  readonly slotId: SourceSaveSlotId;
  readonly kind: SourceSaveKind;
  readonly revisionId: string;
  readonly savedAt: number;
}

export const CLOUD_AUTO_UPLOAD_INTERVAL_MS = 10 * 60_000;
export function cloudAutomaticUploadDelay(lastAttemptAt: number, now: number): number {
  return Math.max(4_000, Number.isSafeInteger(lastAttemptAt) && lastAttemptAt > 0 && lastAttemptAt <= now
    ? lastAttemptAt + CLOUD_AUTO_UPLOAD_INTERVAL_MS - now : 4_000);
}

export interface CloudSavePreview {
  readonly playerName: string;
  readonly mapId: number | null;
  readonly partySize: number;
  readonly firstPokemon: { readonly species: string; readonly nickname: string | null;
    readonly level: number } | null;
}

export function sourceSavePreview(snapshot: SourceSaveSlotSnapshot): CloudSavePreview {
  const first = snapshot.eventState.party.members[0] ?? null;
  return { playerName: snapshot.player?.profile.displayName ?? "Joueur",
    mapId: snapshot.worldSave?.mapId ?? null, partySize: snapshot.eventState.party.members.length,
    firstPokemon: first === null ? null : { species: first.species, nickname: first.nickname,
      level: first.level } };
}

export interface CloudSaveApi {
  list(): Promise<readonly CloudSaveHead[]>;
  get(slot: SourceSaveSlotId, kind: SourceSaveKind): Promise<{ head: CloudSaveHead; snapshot: SourceSaveSlotSnapshot }>;
  put(slot: SourceSaveSlotId, kind: SourceSaveKind, expectedRevisionId: string | null,
    snapshot: SourceSaveSlotSnapshot): Promise<CloudSaveHead>;
}

export type CloudSaveState = "saved" | "uploaded" | "pending" | "conflict" | "cloud-only" | "local-only";
export interface CloudSaveItem {
  readonly slot: SourceSaveSlotId;
  readonly kind: SourceSaveKind;
  readonly state: CloudSaveState;
  readonly localAt: number | null;
  readonly remoteAt: number | null;
  readonly localPreview: CloudSavePreview | null;
  readonly remotePreview: CloudSavePreview | null;
}

interface LinkEntry { readonly revisionId: string; readonly digest: string }
interface LinkState { readonly email: string; readonly entries: Record<string, LinkEntry> }
const LINK_KEY = "pokemon-z-battle.cloud-save-link.v1";
const POSITIONS = [[1, "manual"], [1, "auto"], [2, "manual"], [2, "auto"]] as const;

function link(storage: Pick<Storage, "getItem">, email: string): LinkState | null {
  const raw = storage.getItem(LINK_KEY);
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === "object" && value !== null && "email" in value && value.email === email
      && "entries" in value && typeof value.entries === "object" && value.entries !== null) {
      return value as LinkState;
    }
  } catch { /* Treat damaged metadata as unlinked. */ }
  return null;
}

export function linkedCloudEmail(storage: Pick<Storage, "getItem">): string | null {
  const raw = storage.getItem(LINK_KEY);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null && "email" in value
      && typeof value.email === "string" ? value.email : null;
  } catch { return null; }
}

export function linkCloudAccount(storage: Pick<Storage, "getItem" | "setItem">, email: string): void {
  const previous = linkedCloudEmail(storage);
  if (previous !== null && previous !== email) throw new Error("Un autre compte cloud est lié à cet appareil.");
  if (previous === null) storage.setItem(LINK_KEY, JSON.stringify({ email, entries: {} } satisfies LinkState));
}

async function digest(snapshot: SourceSaveSlotSnapshot): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function key(slot: SourceSaveSlotId, kind: SourceSaveKind): string { return `${slot}.${kind}`; }

function remember(storage: Pick<Storage, "getItem" | "setItem">, email: string,
  slot: SourceSaveSlotId, kind: SourceSaveKind, head: CloudSaveHead, contentDigest: string): void {
  const state = link(storage, email);
  if (state === null) throw new Error("Compte cloud non lié.");
  storage.setItem(LINK_KEY, JSON.stringify({ email, entries: { ...state.entries,
    [key(slot, kind)]: { revisionId: head.revisionId, digest: contentDigest } } } satisfies LinkState));
}

/** Never replaces a local save or advances a remote head unless its known revision still matches. */
export async function syncCloudSaves(storage: Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem">>,
  email: string, api: CloudSaveApi, uploadAutomatic = true, allowImported = false): Promise<readonly CloudSaveItem[]> {
  const state = link(storage, email);
  if (state === null) throw new Error("Associe d'abord ce compte cloud à l'appareil.");
  const heads = await api.list();
  const items: CloudSaveItem[] = [];
  for (const [slot, kind] of POSITIONS) {
    const local = loadSourceSaveSlot(storage, slot, kind);
    const listedRemote = heads.find((head) => head.slotId === slot && head.kind === kind) ?? null;
    const remoteCopy = listedRemote === null ? null : await api.get(slot, kind);
    const remote = remoteCopy?.head ?? null;
    const known = link(storage, email)?.entries[key(slot, kind)];
    const localDigest = local === null ? null : await digest(local);
    let state: CloudSaveState;
    let currentRemote = remote;
    if (local !== null && storage.getItem(sourceImportCloudHoldKey(slot)) !== null && !allowImported) {
      const heldState = remote !== null && known?.revisionId === remote.revisionId
        && known.digest === localDigest ? "saved" : "pending";
      items.push({ slot, kind, state: heldState, localAt: local.savedAt,
        remoteAt: remote?.savedAt ?? null, localPreview: sourceSavePreview(local),
        remotePreview: remoteCopy === null ? null : sourceSavePreview(remoteCopy.snapshot) });
      continue;
    }
    if (local === null) state = remote === null ? "local-only" : "cloud-only";
    else if (remote === null && (known === undefined || known.revisionId === "")
      && kind === "auto" && !uploadAutomatic) state = "pending";
    else if (remote === null && (known === undefined || known.revisionId === "")) {
      try {
        currentRemote = await api.put(slot, kind, null, local);
        remember(storage, email, slot, kind, currentRemote, localDigest!);
        state = "uploaded";
      } catch (error) {
        if (!(error instanceof CloudSaveConflict)) throw error;
        state = "conflict";
      }
    } else if (remote === null) state = "conflict";
    else if (known?.revisionId === remote.revisionId && known.digest === localDigest) state = "saved";
    else if (known?.revisionId === remote.revisionId && kind === "auto" && !uploadAutomatic) state = "pending";
    else if (known?.revisionId === remote.revisionId) {
      try {
        currentRemote = await api.put(slot, kind, remote.revisionId, local);
        remember(storage, email, slot, kind, currentRemote, localDigest!);
        state = "uploaded";
      } catch (error) {
        if (!(error instanceof CloudSaveConflict)) throw error;
        state = "conflict";
      }
    } else if (known === undefined) {
      if (remoteCopy !== null && await digest(remoteCopy.snapshot) === localDigest) {
        remember(storage, email, slot, kind, remoteCopy.head, localDigest!);
        state = "saved";
      } else state = "conflict";
    } else state = "conflict";
    items.push({ slot, kind, state, localAt: local?.savedAt ?? null,
      remoteAt: currentRemote?.savedAt ?? null,
      localPreview: local === null ? null : sourceSavePreview(local),
      remotePreview: state === "uploaded" && local !== null ? sourceSavePreview(local)
        : remoteCopy === null ? null : sourceSavePreview(remoteCopy.snapshot) });
  }
  if (allowImported) for (const slot of [1, 2] as const) {
    if (storage.getItem(sourceImportCloudHoldKey(slot)) !== null
      && items.filter((item) => item.slot === slot && item.localAt !== null)
        .every((item) => item.state === "uploaded" || item.state === "saved")) {
      storage.removeItem?.(sourceImportCloudHoldKey(slot));
    }
  }
  return items;
}

export class CloudSaveConflict extends Error {}

/** Explicit recovery: caller must present both dates and obtain confirmation first. */
export async function recoverCloudSave(storage: Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem">>,
  email: string, api: CloudSaveApi, slot: SourceSaveSlotId, kind: SourceSaveKind): Promise<void> {
  if (link(storage, email) === null) throw new Error("Compte cloud non lié.");
  const copy = await api.get(slot, kind);
  const snapshot = parseSourceSaveSlotSnapshot(copy.snapshot);
  persistSourceSaveSlot(storage, slot, kind, snapshot);
  remember(storage, email, slot, kind, copy.head, await digest(snapshot));
}

/** Explicit upload after conflict; the fetched head is used as a compare-and-swap guard. */
export async function keepLocalCloudSave(storage: Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem">>,
  email: string, api: CloudSaveApi, slot: SourceSaveSlotId, kind: SourceSaveKind): Promise<void> {
  if (link(storage, email) === null) throw new Error("Compte cloud non lié.");
  const local = loadSourceSaveSlot(storage, slot, kind);
  if (local === null) throw new Error("Aucune sauvegarde locale dans cet emplacement.");
  const heads = await api.list();
  const current = heads.find((head) => head.slotId === slot && head.kind === kind);
  const next = await api.put(slot, kind, current?.revisionId ?? null, local);
  remember(storage, email, slot, kind, next, await digest(local));
}
