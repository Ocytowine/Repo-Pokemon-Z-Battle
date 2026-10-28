import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { CloudSaveConflict, type CloudSaveApi, type CloudSaveHead } from "./source-cloud-sync.js";
import { parseSourceSaveSlotSnapshot, type SourceSaveKind, type SourceSaveSlotId,
  type SourceSaveSlotSnapshot } from "./source-save-slots.js";

const BASE = "https://pokemon-z-battle-cloud-save.mimidu33-eb.workers.dev/api";

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function head(value: unknown): CloudSaveHead {
  if (!object(value) || value.slotId !== 1 && value.slotId !== 2
    || value.kind !== "manual" && value.kind !== "auto"
    || typeof value.revisionId !== "string" || !Number.isSafeInteger(value.savedAt)) {
    throw new Error("Réponse cloud illisible.");
  }
  return value as unknown as CloudSaveHead;
}

function data(response: { status: number; data: unknown }): Record<string, unknown> {
  if (response.status === 409) throw new CloudSaveConflict("Une autre version a été enregistrée dans le cloud.");
  if (response.status === 413) throw new Error("Sauvegarde trop volumineuse pour le cloud.");
  if (response.status === 401 || response.status === 403 || !object(response.data)) {
    throw new Error("Connexion cloud expirée. Reconnecte-toi depuis Sauvegardes.");
  }
  if (response.status < 200 || response.status >= 300) throw new Error("Cloud momentanément indisponible.");
  return response.data;
}

export async function cloudIdentity(): Promise<string | null> {
  if (Capacitor.getPlatform() !== "android") return null;
  const response = await CapacitorHttp.get({ url: `${BASE}/session`, connectTimeout: 10_000, readTimeout: 10_000 });
  if (response.status !== 200 || !object(response.data) || response.data.authenticated !== true
    || typeof response.data.email !== "string") return null;
  return response.data.email.trim().toLowerCase();
}

export const sourceCloudApi: CloudSaveApi = {
  async list() {
    const value = data(await CapacitorHttp.get({ url: `${BASE}/saves`, connectTimeout: 10_000,
      readTimeout: 15_000 }));
    if (!Array.isArray(value.heads)) throw new Error("Liste des sauvegardes cloud illisible.");
    return value.heads.map(head);
  },
  async get(slot: SourceSaveSlotId, kind: SourceSaveKind) {
    const value = data(await CapacitorHttp.get({ url: `${BASE}/saves/${slot}/${kind}`,
      connectTimeout: 10_000, readTimeout: 20_000 }));
    return { head: head(value.head), snapshot: parseSourceSaveSlotSnapshot(value.snapshot) };
  },
  async put(slot: SourceSaveSlotId, kind: SourceSaveKind, expectedRevisionId: string | null,
    snapshot: SourceSaveSlotSnapshot) {
    const value = data(await CapacitorHttp.put({ url: `${BASE}/saves/${slot}/${kind}`,
      headers: { "Content-Type": "application/json" },
      data: { expectedRevisionId, snapshot }, connectTimeout: 10_000, readTimeout: 25_000 }));
    return head(value.head);
  },
};
