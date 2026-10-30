import { Capacitor, registerPlugin } from "@capacitor/core";

export interface OriginalSaveCandidate {
  readonly name: string;
  readonly path: string;
  readonly uri: string;
  readonly size: number;
}
interface SourceSaveLocatorNative {
  searchFolder(): Promise<{ readonly candidates: readonly OriginalSaveCandidate[]; readonly limited: boolean }>;
  readSave(options: { readonly uri: string }): Promise<{ readonly base64: string }>;
}
const native = registerPlugin<SourceSaveLocatorNative>("SourceSaveLocator");

export function originalSaveFolderSearchAvailable(): boolean {
  return Capacitor.getPlatform() === "android";
}

/** Android grants read access only to the folder the player selects. */
export async function searchOriginalSaveFolder(): Promise<readonly OriginalSaveCandidate[]> {
  if (!originalSaveFolderSearchAvailable()) throw new Error("Recherche par dossier disponible dans l'APK Android.");
  const result = await native.searchFolder();
  if (!Array.isArray(result.candidates)) throw new Error("Résultat de recherche invalide.");
  return result.candidates.filter((entry) => typeof entry.name === "string" && typeof entry.path === "string"
    && typeof entry.uri === "string" && entry.uri.startsWith("content://")
    && Number.isFinite(entry.size));
}

export async function readOriginalSaveCandidate(candidate: OriginalSaveCandidate): Promise<File> {
  const result = await native.readSave({ uri: candidate.uri });
  if (typeof result.base64 !== "string" || result.base64.length > 6 * 1024 * 1024) {
    throw new Error("Fichier d'origine invalide ou trop volumineux.");
  }
  const raw = atob(result.base64);
  const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0));
  return new File([bytes], candidate.name, { type: "application/octet-stream" });
}
