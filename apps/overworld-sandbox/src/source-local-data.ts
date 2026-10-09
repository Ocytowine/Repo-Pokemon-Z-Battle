import { GAME_DATA_SCHEMA_VERSION, LOCAL_DATA_MANIFEST_FILE, LOCAL_DATA_MANIFEST_SCHEMA_VERSION,
  LOCAL_DATA_REQUIRED_FILES, type LocalDataManifest } from "@pokemon-z-battle/game-data";

const MANIFEST_URL = `/__pokemon-z/data/${LOCAL_DATA_MANIFEST_FILE}`;

export interface SourceLocalDataDiagnostic {
  readonly title: string;
  readonly detail: string;
  readonly command: string;
}

export class SourceLocalDataError extends Error {
  public constructor(public readonly diagnostic: SourceLocalDataDiagnostic) {
    super(`${diagnostic.title} ${diagnostic.detail}`);
    this.name = "SourceLocalDataError";
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSourceLocalDataManifest(value: unknown): LocalDataManifest {
  if (!isRecord(value) || value.schemaVersion !== LOCAL_DATA_MANIFEST_SCHEMA_VERSION
    || value.gameDataSchemaVersion !== GAME_DATA_SCHEMA_VERSION || typeof value.generatedAt !== "string"
    || !Array.isArray(value.files) || value.files.some((file) => typeof file !== "string")) {
    throw new SourceLocalDataError({
      title: "Données locales incompatibles",
      detail: "Le manifeste d’extraction ne correspond pas à cette version du moteur.",
      command: "corepack pnpm prepare:local",
    });
  }
  return value as unknown as LocalDataManifest;
}

export function assertSourceLocalDataFiles(manifest: LocalDataManifest,
  additionalFiles: readonly string[] = []): void {
  const available = new Set(manifest.files);
  const missing = [...LOCAL_DATA_REQUIRED_FILES, ...additionalFiles].filter((file) => !available.has(file));
  if (missing.length === 0) return;
  throw new SourceLocalDataError({
    title: "Données locales incomplètes",
    detail: `Fichier${missing.length > 1 ? "s" : ""} manquant${missing.length > 1 ? "s" : ""} : ${missing.join(", ")}.`,
    command: "corepack pnpm prepare:local",
  });
}

let manifestRequest: Promise<LocalDataManifest> | null = null;

export function clearSourceLocalDataCache(): void { manifestRequest = null; }

export async function validateSourceLocalData(additionalFiles: readonly string[] = []): Promise<LocalDataManifest> {
  manifestRequest ??= fetch(MANIFEST_URL, { cache: "no-store" }).then(async (response) => {
    if (response.status === 503) {
      throw new SourceLocalDataError({
        title: "Configuration locale absente",
        detail: "Chaque poste doit indiquer son propre dossier Pokémon Z et l’emplacement de ses données extraites.",
        command: 'corepack pnpm prepare:local --source "C:\\chemin\\vers\\Pokémon Z" --output ".pokemon-z\\data"',
      });
    }
    if (response.status === 404) {
      throw new SourceLocalDataError({
        title: "Données locales à actualiser",
        detail: `Le fichier ${LOCAL_DATA_MANIFEST_FILE} est absent. L’extraction a probablement été créée avec une ancienne version du moteur.`,
        command: "corepack pnpm prepare:local",
      });
    }
    if (!response.ok) {
      throw new SourceLocalDataError({
        title: "Données locales indisponibles",
        detail: `Le manifeste d’extraction ne peut pas être lu (HTTP ${response.status}).`,
        command: "corepack pnpm prepare:local",
      });
    }
    return parseSourceLocalDataManifest(await response.json() as unknown);
  }).catch((error: unknown) => {
    manifestRequest = null;
    throw error;
  });
  const manifest = await manifestRequest;
  assertSourceLocalDataFiles(manifest, additionalFiles);
  return manifest;
}

export function sourceLocalDataDiagnostic(error: unknown): SourceLocalDataDiagnostic {
  if (error instanceof SourceLocalDataError) return error.diagnostic;
  const message = error instanceof Error ? error.message : "Erreur inattendue pendant le chargement.";
  const missing = /\/__pokemon-z\/data\/([^ ]+)\s*:\s*HTTP 404/u.exec(message)?.[1];
  return {
    title: missing === undefined ? "Chargement du monde impossible" : "Données locales incomplètes",
    detail: missing === undefined ? message : `Fichier manquant : ${decodeURIComponent(missing)}.`,
    command: "corepack pnpm prepare:local",
  };
}
