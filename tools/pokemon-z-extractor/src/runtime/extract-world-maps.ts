import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { hashFile } from "../inventory/hash-file.js";
import { assertOutputOutsideSource } from "../inventory/path-safety.js";
import { validatePokemonZSource } from "../inventory/source-validation.js";
import { writeJsonAtomically } from "../io/write-json.js";
import { writeTextAtomically } from "../io/write-text.js";
import { readRubyMarshal } from "../ruby-marshal/reader.js";
import { extractMapInfos } from "./extract-map-infos.js";
import { normalizeTilesets, normalizeWorldMap, renderMapPreview } from "./world-map.js";

export interface WorldMapExtractionResult {
  readonly outputDirectory: string;
  readonly mapCount: number;
  readonly tilesetCount: number;
  readonly transferCount: number;
  readonly invalidTransferTargets: number;
}

interface MapManifestRecord {
  readonly id: number;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly tilesetId: number;
  readonly transfers: number;
  readonly source: { readonly file: string; readonly sha256: string };
  readonly dataFile: string;
  readonly previewFile: string;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function renderPreviewIndex(records: readonly MapManifestRecord[]): string {
  const cards = records.map((record) => `<article><a href="${path.basename(record.previewFile)}"><img loading="lazy" src="${path.basename(record.previewFile)}" alt=""></a><p><strong>${record.id} - ${escapeHtml(record.name)}</strong><br>${record.width} x ${record.height} · ${record.transfers} transfert(s)</p></article>`).join("");
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Pokemon Z - controle des cartes</title><style>body{margin:2rem;background:#10151c;color:#eef;font:14px system-ui}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem}article{background:#1b2532;padding:.75rem;border-radius:.5rem}img{width:100%;height:180px;object-fit:contain;image-rendering:pixelated;background:#0a0d12}p{margin:.5rem 0 0;line-height:1.45}a{color:inherit}</style><h1>Controle des ${records.length} cartes</h1><p>Terrain colore, collisions completes en noir, origines de transfert en orange.</p><main>${cards}</main></html>\n`;
}

export async function extractWorldMaps(sourceDirectory: string, outputDirectory: string): Promise<WorldMapExtractionResult> {
  const paths = await assertOutputOutsideSource(sourceDirectory, outputDirectory);
  await validatePokemonZSource(paths.source);
  const dataDirectory = path.join(paths.source, "Data");
  const [mapInfos, dataFiles, tilesetsBytes] = await Promise.all([
    extractMapInfos(paths.source),
    readdir(dataDirectory),
    readFile(path.join(dataDirectory, "Tilesets.rxdata")),
  ]);
  const mapFileNames = dataFiles.filter((file) => /^Map\d{3}\.rxdata$/u.test(file)).sort();
  const mapInfoById = new Map(mapInfos.map((entry) => [entry.id, entry]));
  const tilesets = normalizeTilesets(readRubyMarshal(tilesetsBytes));
  const tilesetById = new Map(tilesets.map((entry) => [entry.id, entry]));
  const mapsDirectory = path.join(paths.output, "maps");
  const previewsDirectory = path.join(paths.output, "map-previews");
  const manifestRecords: MapManifestRecord[] = [];
  const transferTargets: Array<{ mapId: number; eventId: number; targetMapId: number }> = [];
  let transferCount = 0;
  let totalCells = 0;
  let fullyBlockedCells = 0;

  for (const fileName of mapFileNames) {
    const id = Number.parseInt(fileName.slice(3, 6), 10);
    const info = mapInfoById.get(id);
    if (info === undefined) throw new Error(`${fileName}: entree MapInfos absente.`);
    const absoluteSource = path.join(dataDirectory, fileName);
    const [bytes, sha256] = await Promise.all([readFile(absoluteSource), hashFile(absoluteSource)]);
    const rawMap = readRubyMarshal(bytes);
    if (typeof rawMap !== "object" || rawMap === null || Array.isArray(rawMap) || rawMap.kind !== "object") {
      throw new TypeError(`${fileName}: objet RPG::Map attendu.`);
    }
    const tilesetId = rawMap.ivars["@tileset_id"];
    if (typeof tilesetId !== "number") throw new TypeError(`${fileName}: @tileset_id invalide.`);
    const tileset = tilesetById.get(tilesetId);
    if (tileset === undefined) throw new Error(`${fileName}: tileset ${tilesetId} absent.`);
    const source = { file: `Data/${fileName}`, sha256 };
    const map = normalizeWorldMap(id, info.name, rawMap, tileset, source);
    const outputName = fileName.replace(".rxdata", ".json");
    const previewName = fileName.replace(".rxdata", ".svg");
    await Promise.all([
      writeJsonAtomically(mapsDirectory, outputName, map),
      writeTextAtomically(previewsDirectory, previewName, renderMapPreview(map)),
    ]);
    totalCells += map.width * map.height;
    fullyBlockedCells += map.collision.fullyBlockedCells;
    transferCount += map.transfers.length;
    transferTargets.push(...map.transfers.map((transfer) => ({ mapId: id, eventId: transfer.eventId, targetMapId: transfer.targetMapId })));
    manifestRecords.push({
      id,
      name: info.name,
      width: map.width,
      height: map.height,
      tilesetId,
      transfers: map.transfers.length,
      source,
      dataFile: `maps/${outputName}`,
      previewFile: `map-previews/${previewName}`,
    });
  }

  const importedMapIds = new Set(manifestRecords.map((record) => record.id));
  const invalidTargets = transferTargets.filter((transfer) => !importedMapIds.has(transfer.targetMapId));
  const missingMapFiles = mapInfos.filter((info) => !importedMapIds.has(info.id)).map((info) => info.id);
  const tilesetsSource = { file: "Data/Tilesets.rxdata", sha256: await hashFile(path.join(dataDirectory, "Tilesets.rxdata")) };
  await Promise.all([
    writeJsonAtomically(paths.output, "tilesets.json", { schemaVersion: "1.0.0", source: tilesetsSource, count: tilesets.length, records: tilesets }),
    writeJsonAtomically(paths.output, "world-map-manifest.json", { schemaVersion: "1.0.0", count: manifestRecords.length, records: manifestRecords }),
    writeTextAtomically(previewsDirectory, "index.html", renderPreviewIndex(manifestRecords)),
    writeJsonAtomically(paths.output, "world-map-report.json", {
      schemaVersion: "1.0.0",
      summary: {
        maps: manifestRecords.length,
        tilesets: tilesets.length,
        cells: totalCells,
        fullyBlockedCells,
        simpleTransfers: transferCount,
        invalidTransferTargets: invalidTargets.length,
        missingMapFiles: missingMapFiles.length,
      },
      invalidTransferTargets: invalidTargets,
      missingMapFiles,
      previewLegend: { terrain: "couleur derivee de la tuile visible", fullyBlocked: "noir", transferOrigin: "orange" },
    }),
  ]);
  return {
    outputDirectory: paths.output,
    mapCount: manifestRecords.length,
    tilesetCount: tilesets.length,
    transferCount,
    invalidTransferTargets: invalidTargets.length,
  };
}
