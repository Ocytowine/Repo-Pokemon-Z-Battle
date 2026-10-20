import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { writeJsonAtomically } from "../io/write-json.js";

interface MegaCatalog {
  readonly activationItems: readonly string[];
  readonly records: readonly { readonly species: string; readonly form: number; readonly heldItem: string }[];
}

interface ItemCatalog {
  readonly records: readonly { readonly internalName: string }[];
}

export interface MegaIntegrationAudit {
  readonly schemaVersion: "1.0.0";
  readonly policy: string;
  readonly summary: {
    readonly forms: number;
    readonly distinctHeldItems: number;
    readonly missingCatalogItems: number;
    readonly itemsWithoutEventReference: number;
  };
  readonly activationItems: readonly { readonly item: string; readonly eventReferences: readonly string[] }[];
  readonly heldItems: readonly {
    readonly item: string;
    readonly catalogDefined: boolean;
    readonly eventReferences: readonly string[];
    readonly forms: readonly string[];
  }[];
}

function referencedItems(source: string, candidates: ReadonlySet<string>): Set<string> {
  const result = new Set<string>();
  for (const match of source.matchAll(/\b[A-Z][A-Z0-9_]{2,}\b/gu)) {
    if (candidates.has(match[0])) result.add(match[0]);
  }
  return result;
}

/** Audits source-event references only; absence is a diagnostic, never an invented acquisition rule. */
export async function createMegaIntegrationAudit(outputDirectory: string): Promise<MegaIntegrationAudit> {
  const [megaCatalog, itemCatalog, mapFiles] = await Promise.all([
    readFile(path.join(outputDirectory, "mega-evolutions.json"), "utf8").then((value) => JSON.parse(value) as MegaCatalog),
    readFile(path.join(outputDirectory, "items.json"), "utf8").then((value) => JSON.parse(value) as ItemCatalog),
    readdir(path.join(outputDirectory, "events")),
  ]);
  const heldItems = [...new Set(megaCatalog.records.map((record) => record.heldItem))].sort();
  const candidates = new Set([...heldItems, ...megaCatalog.activationItems]);
  const references = new Map<string, string[]>();
  const sourceFiles = ["common-events.json", ...mapFiles.filter((file) => file.endsWith(".json"))
    .map((file) => `events/${file}`)];
  await Promise.all(sourceFiles.map(async (file) => {
    const source = await readFile(path.join(outputDirectory, ...file.split("/")), "utf8");
    for (const item of referencedItems(source, candidates)) {
      const current = references.get(item) ?? [];
      current.push(file);
      references.set(item, current);
    }
  }));
  const itemIds = new Set(itemCatalog.records.map((record) => record.internalName));
  const records = heldItems.map((item) => ({
    item,
    catalogDefined: itemIds.has(item),
    eventReferences: [...new Set(references.get(item) ?? [])].sort(),
    forms: megaCatalog.records.filter((record) => record.heldItem === item)
      .map((record) => `${record.species}:${record.form}`).sort(),
  }));
  const report: MegaIntegrationAudit = {
    schemaVersion: "1.0.0",
    policy: "Une absence de référence d'événement reste auditée ; le moteur n'invente ni don ni boutique.",
    summary: {
      forms: megaCatalog.records.length,
      distinctHeldItems: records.length,
      missingCatalogItems: records.filter((record) => !record.catalogDefined).length,
      itemsWithoutEventReference: records.filter((record) => record.eventReferences.length === 0).length,
    },
    activationItems: megaCatalog.activationItems.map((item) => ({ item,
      eventReferences: [...new Set(references.get(item) ?? [])].sort() })),
    heldItems: records,
  };
  await writeJsonAtomically(outputDirectory, "mega-integration-report.json", report);
  return report;
}
