export interface SourceRegionCoordinate {
  readonly region: number;
  readonly x: number;
  readonly y: number;
}

export interface SourceRegionDestination {
  readonly mapId: number;
  readonly x: number;
  readonly y: number;
}

export interface SourceRegionPoint {
  readonly x: number;
  readonly y: number;
  readonly name: string;
  readonly description: string;
  readonly destination: SourceRegionDestination | null;
  readonly hiddenSwitchId: number | null;
}

export interface SourceRegionDefinition {
  readonly id: number;
  readonly name: string;
  readonly filename: string;
  readonly points: readonly SourceRegionPoint[];
}

export interface SourceRegionMapCatalog {
  readonly regions: readonly SourceRegionDefinition[];
  readonly mapPositions: ReadonlyMap<number, SourceRegionCoordinate>;
  readonly habitatMaps: ReadonlyMap<string, readonly number[]>;
}

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function parseDestination(value: unknown): SourceRegionDestination | null {
  if (value === null) return null;
  if (!record(value) || !Number.isSafeInteger(value.mapId) || (value.mapId as number) < 1
    || !nonNegativeInteger(value.x) || !nonNegativeInteger(value.y)) {
    throw new Error("Une destination de la carte regionale est invalide.");
  }
  return { mapId: value.mapId as number, x: value.x as number, y: value.y as number };
}

export function parseSourceRegionMap(regionValue: unknown, metadataValue: unknown,
  encountersValue: unknown, mapInfosValue?: unknown): SourceRegionMapCatalog {
  if (!record(regionValue) || !Array.isArray(regionValue.regions)) {
    throw new Error("Le catalogue de carte regionale est invalide.");
  }
  const regions = regionValue.regions.map((candidate) => {
    if (!record(candidate) || !nonNegativeInteger(candidate.id) || typeof candidate.name !== "string"
      || typeof candidate.filename !== "string" || !Array.isArray(candidate.points)) {
      throw new Error("Une region de la carte est invalide.");
    }
    const points = candidate.points.map((point) => {
      if (!record(point) || !nonNegativeInteger(point.x) || !nonNegativeInteger(point.y)
        || typeof point.name !== "string" || typeof point.description !== "string"
        || point.hiddenSwitchId !== null && (!Number.isSafeInteger(point.hiddenSwitchId)
          || (point.hiddenSwitchId as number) < 1)) {
        throw new Error("Un point de la carte regionale est invalide.");
      }
      return { x: point.x as number, y: point.y as number, name: point.name,
        description: point.description, destination: parseDestination(point.destination),
        hiddenSwitchId: point.hiddenSwitchId as number | null };
    });
    return { id: candidate.id as number, name: candidate.name, filename: candidate.filename, points };
  });

  if (!record(metadataValue) || !Array.isArray(metadataValue.records)) {
    throw new Error("Les metadonnees de carte sont invalides.");
  }
  const mapPositions = new Map<number, SourceRegionCoordinate>();
  for (const entry of metadataValue.records) {
    if (!record(entry) || !Number.isSafeInteger(entry.mapId) || entry.mapPosition === null) continue;
    if (!record(entry.mapPosition) || !nonNegativeInteger(entry.mapPosition.region)
      || !nonNegativeInteger(entry.mapPosition.x) || !nonNegativeInteger(entry.mapPosition.y)) continue;
    mapPositions.set(entry.mapId as number, { region: entry.mapPosition.region as number,
      x: entry.mapPosition.x as number, y: entry.mapPosition.y as number });
  }
  if (mapInfosValue !== undefined) {
    if (!record(mapInfosValue) || !Array.isArray(mapInfosValue.records)) {
      throw new Error("Le catalogue hierarchique des cartes est invalide.");
    }
    const parents = new Map<number, number>();
    for (const entry of mapInfosValue.records) if (record(entry) && Number.isSafeInteger(entry.id)
      && Number.isSafeInteger(entry.parentId)) parents.set(entry.id as number, entry.parentId as number);
    const inheritedPosition = (mapId: number): SourceRegionCoordinate | null => {
      const visited = new Set<number>();
      let candidate = mapId;
      while (candidate > 0 && !visited.has(candidate)) {
        visited.add(candidate);
        const direct = mapPositions.get(candidate);
        if (direct !== undefined) return direct;
        candidate = parents.get(candidate) ?? 0;
      }
      return null;
    };
    for (const mapId of parents.keys()) {
      const position = inheritedPosition(mapId);
      if (position !== null) mapPositions.set(mapId, position);
    }
  }

  if (!record(encountersValue) || !Array.isArray(encountersValue.records)) {
    throw new Error("Le catalogue de rencontres est invalide.");
  }
  const habitatMaps = new Map<string, number[]>();
  for (const encounter of encountersValue.records) {
    if (!record(encounter) || !Number.isSafeInteger(encounter.mapId) || !Array.isArray(encounter.methods)) continue;
    const species = new Set<string>();
    for (const method of encounter.methods) {
      if (!record(method) || !Array.isArray(method.slots)) continue;
      for (const slot of method.slots) if (record(slot) && typeof slot.species === "string") species.add(slot.species);
    }
    for (const id of species) habitatMaps.set(id, [...habitatMaps.get(id) ?? [], encounter.mapId as number]);
  }
  return { regions, mapPositions, habitatMaps };
}

export function sourceRegionForMap(catalog: SourceRegionMapCatalog, mapId: number): SourceRegionDefinition | null {
  const position = catalog.mapPositions.get(mapId);
  return position === undefined ? null : catalog.regions.find((region) => region.id === position.region) ?? null;
}

export function sourceVisibleRegionPoints(region: SourceRegionDefinition,
  switches: Readonly<Record<string, boolean>>): readonly SourceRegionPoint[] {
  return region.points.filter((point) => point.hiddenSwitchId === null || switches[String(point.hiddenSwitchId)] === true);
}

export function sourceSpeciesHabitatCoordinates(catalog: SourceRegionMapCatalog,
  species: string): readonly SourceRegionCoordinate[] {
  const result = new Map<string, SourceRegionCoordinate>();
  for (const mapId of catalog.habitatMaps.get(species) ?? []) {
    const position = catalog.mapPositions.get(mapId);
    if (position !== undefined) result.set(`${position.region}:${position.x}:${position.y}`, position);
  }
  return [...result.values()];
}

export function sourceRegionImageUrl(filename: string): string {
  return `/__pokemon-z/source/Graphics/Pictures/${encodeURIComponent(filename)}`;
}
