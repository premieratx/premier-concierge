import { dimsOf } from './dimensions';
import { boxOf, layoutBounds } from './geometry';
import { BAWN, LAWN } from './property';
import { featuresOfKind, layerOfContainer } from './types';
import type { Layout, ModelLayer, Vec3 } from './types';

/**
 * Occupant load.
 *
 * Factors are the IBC Table 1004.5 numbers for the uses that actually occur
 * here. They are a sanity check on the programme, not an egress design: this
 * says how many people the floor area allows, and says nothing about whether
 * there is enough door width, parking, water or septic to match. Those are
 * the constraints that will really bind, and none of them are modelled.
 */
export type OccupancyUse =
  | 'assemblyStanding'
  | 'assemblyUnconcentrated'
  | 'assemblyConcentrated'
  | 'dock'
  | 'business'
  | 'lodging';

/** Square feet per person. */
export const LOAD_FACTOR_SQFT: Record<OccupancyUse, number> = {
  assemblyStanding: 5,
  assemblyUnconcentrated: 15,
  assemblyConcentrated: 7,
  dock: 50,
  business: 150,
  lodging: 200,
};

export const USE_LABEL: Record<OccupancyUse, string> = {
  assemblyStanding: 'Assembly, standing',
  assemblyUnconcentrated: 'Assembly, tables and chairs',
  assemblyConcentrated: 'Assembly, seating only',
  dock: 'Dock and pier',
  business: 'Business',
  lodging: 'Lodging',
};

/** Key colours, shared by the 3D labels and the panel. */
export const USE_COLOR: Record<OccupancyUse, string> = {
  assemblyStanding: '#f97316',
  assemblyUnconcentrated: '#38bdf8',
  assemblyConcentrated: '#a78bfa',
  dock: '#34d399',
  business: '#94a3b8',
  lodging: '#fbbf24',
};

export interface Area {
  id: string;
  name: string;
  use: OccupancyUse;
  /** Where the label hangs in the model. */
  anchor: Vec3;
  /** Gross area, in square feet. */
  sqFt: number;
  /**
   * Share of the gross that is genuinely occupiable once the furniture, the
   * bar, the circulation and the bits nobody stands on are taken out.
   */
  usableFraction: number;
  capacity: number;
  layer: ModelLayer;
  note?: string;
}

function occupants(sqFt: number, usableFraction: number, use: OccupancyUse): number {
  return Math.floor((sqFt * usableFraction) / LOAD_FACTOR_SQFT[use]);
}

function area(
  partial: Omit<Area, 'capacity'> & { capacity?: number },
): Area {
  return {
    ...partial,
    capacity:
      partial.capacity ?? occupants(partial.sqFt, partial.usableFraction, partial.use),
  };
}

/**
 * Every occupiable area on the property, measured off the model.
 *
 * Areas are derived from the layout wherever the geometry can answer the
 * question — the hall from its truss bays, the docks from their decks, the
 * lodging from its bed count — and from stated constants where it cannot,
 * with the assumption written down next to the number.
 */
export function propertyAreas(layout: Layout): Area[] {
  const areas: Area[] = [];
  const containers = layout.containers;

  /* Great hall ---------------------------------------------------- */
  const trusses = layout.decor.filter((d) => d.kind === 'truss');
  if (trusses.length > 0) {
    const xs = trusses.map((t) => t.center.x);
    const span = trusses[0]!.size.z;
    const lengthFt = Math.max(...xs) - Math.min(...xs);
    const centreZ = trusses[0]!.center.z;
    const roofY = trusses[0]!.center.y;
    areas.push(
      area({
        id: 'area-great-hall',
        name: 'Great hall',
        use: 'assemblyUnconcentrated',
        anchor: { x: (Math.max(...xs) + Math.min(...xs)) / 2, y: roofY + 8, z: centreZ },
        sqFt: span * lengthFt,
        usableFraction: 0.85,
        layer: 'greatHall',
        note: 'Banquet seating under the truss roof, circulation taken out',
      }),
    );
  }

  /* Courtyard ----------------------------------------------------- */
  const castleGround = containers.filter(
    (c) => (c.zone ?? 'castle') === 'castle' && c.position.y === 0,
  );
  const groundFootprint = castleGround.reduce((a, c) => {
    const b = boxOf(c);
    return a + (b.max.x - b.min.x) * (b.max.z - b.min.z);
  }, 0);
  const courtyardGross = Math.max(0, BAWN.sizeX * BAWN.sizeZ - groundFootprint);
  areas.push(
    area({
      id: 'area-courtyard',
      name: 'Courtyard',
      use: 'assemblyStanding',
      anchor: { x: BAWN.x + BAWN.sizeX / 2, y: 26, z: BAWN.z + BAWN.sizeZ * 0.32 },
      sqFt: courtyardGross,
      usableFraction: 0.5,
      layer: 'curtainWall',
      note: 'Half the enclosure is surfaced and standable; the rest is planting and back of house',
    }),
  );

  /* Arrival lawn -------------------------------------------------- */
  areas.push(
    area({
      id: 'area-lawn',
      name: 'Arrival lawn',
      use: 'assemblyUnconcentrated',
      anchor: { x: LAWN.x + LAWN.sizeX / 2, y: 30, z: LAWN.z + LAWN.sizeZ / 2 },
      sqFt: LAWN.sizeX * LAWN.sizeZ,
      usableFraction: 0.4,
      layer: 'areaLighting',
      note: 'Net of the dragon plinth, the fire clusters and the vehicle route',
    }),
  );

  /* Fire terraces ------------------------------------------------- */
  const pits = featuresOfKind(layout.features, 'firePit');
  const clusters = new Map<string, typeof pits>();
  for (const pit of pits) {
    const key = pit.position.x < 0 ? 'west' : 'east';
    const list = clusters.get(key);
    if (list) list.push(pit);
    else clusters.set(key, [pit]);
  }
  for (const [key, list] of clusters) {
    const cx = list.reduce((a, p) => a + p.position.x, 0) / list.length;
    const cz = list.reduce((a, p) => a + p.position.z, 0) / list.length;
    const radius = 44;
    areas.push(
      area({
        id: `area-fire-${key}`,
        name: `Fire terrace ${key}`,
        use: 'assemblyStanding',
        anchor: { x: cx, y: 18, z: cz },
        sqFt: Math.PI * radius * radius,
        usableFraction: 0.55,
        layer: 'firePits',
        note: `${list.length} pits, seating ring and the clear zone round each burner`,
      }),
    );
  }

  /* Stages -------------------------------------------------------- */
  for (const stage of featuresOfKind(layout.features, 'stage')) {
    areas.push(
      area({
        id: `area-${stage.id}`,
        name: stage.name,
        use: 'assemblyConcentrated',
        anchor: { x: stage.position.x, y: stage.heightFt + 22, z: stage.position.z },
        sqFt: stage.widthFt * stage.depthFt,
        usableFraction: 0.8,
        layer: 'stages',
        note: 'Performers and crew on the deck',
      }),
    );
  }
  for (const stage of featuresOfKind(layout.features, 'overwaterStage')) {
    areas.push(
      area({
        id: `area-${stage.id}`,
        name: stage.name,
        use: 'assemblyConcentrated',
        anchor: { x: stage.position.x, y: stage.deckHeightFt + 24, z: stage.position.z },
        sqFt: stage.widthFt * stage.depthFt,
        usableFraction: 0.8,
        layer: 'overwaterStage',
      }),
    );
  }

  /* Keep and gate towers ------------------------------------------ */
  const byLayer = (layer: ModelLayer) =>
    containers.filter((c) => layerOfContainer(c) === layer);

  const keep = byLayer('keep');
  if (keep.length > 0) {
    const bounds = layoutBounds(keep)!;
    areas.push(
      area({
        id: 'area-keep',
        name: 'Keep',
        use: 'business',
        anchor: {
          x: (bounds.min.x + bounds.max.x) / 2,
          y: bounds.max.y + 8,
          z: (bounds.min.z + bounds.max.z) / 2,
        },
        sqFt: keep.reduce((a, c) => a + dimsOf(c.type).usableSqFt, 0),
        usableFraction: 1,
        layer: 'keep',
        note: 'Offices, back of house and the bridal suite',
      }),
    );
  }

  const sealedTowers = containers.filter(
    (c) => layerOfContainer(c) === 'towers' && c.role === 'sealed',
  );
  if (sealedTowers.length > 0) {
    const bounds = layoutBounds(sealedTowers)!;
    areas.push(
      area({
        id: 'area-gatehouse',
        name: 'Gatehouse',
        use: 'business',
        anchor: {
          x: (bounds.min.x + bounds.max.x) / 2,
          y: bounds.max.y + 8,
          z: (bounds.min.z + bounds.max.z) / 2,
        },
        sqFt: sealedTowers.reduce((a, c) => a + dimsOf(c.type).usableSqFt, 0),
        usableFraction: 1,
        layer: 'towers',
        note: 'Ticketing, security and the box office',
      }),
    );
  }

  /* Marina -------------------------------------------------------- */
  const docks = featuresOfKind(layout.features, 'dock');
  const walkable = docks.filter((d) => d.role !== 'platform');
  if (walkable.length > 0) {
    const deckSqFt = walkable.reduce((a, d) => a + d.lengthFt * d.widthFt, 0);
    const main = walkable.find((d) => d.role === 'main') ?? walkable[0]!;
    areas.push(
      area({
        id: 'area-docks',
        name: 'Docks and fingers',
        use: 'dock',
        anchor: { x: main.position.x, y: main.position.y + 16, z: main.position.z },
        sqFt: deckSqFt,
        usableFraction: 1,
        layer: 'docks',
        note: 'Circulation only — nobody assembles on a finger pier',
      }),
    );
  }

  for (const platform of docks.filter((d) => d.role === 'platform')) {
    areas.push(
      area({
        id: `area-${platform.id}`,
        name: platform.label ?? 'Dock deck',
        use: 'assemblyUnconcentrated',
        anchor: { x: platform.position.x, y: platform.position.y + 18, z: platform.position.z },
        sqFt: platform.lengthFt * platform.widthFt,
        usableFraction: 0.8,
        layer: 'docks',
        note: 'Bars, high-tops and the crowd for the overwater stage',
      }),
    );
  }

  const patios = featuresOfKind(layout.features, 'slip').filter((s) => s.patio);
  if (patios.length > 0) {
    const each = patios[0]!;
    const patioSqFt = each.lengthFt * 0.92 * (each.widthFt + 1.5);
    const cz = patios.reduce((a, s) => a + s.position.z, 0) / patios.length;
    areas.push(
      area({
        id: 'area-premier-patios',
        name: `Premier patios (${patios.length})`,
        use: 'assemblyUnconcentrated',
        anchor: { x: 0, y: 22, z: cz },
        sqFt: patioSqFt * patios.length,
        usableFraction: 0.7,
        layer: 'patios',
        note: `About ${Math.floor((patioSqFt * 0.7) / LOAD_FACTOR_SQFT.assemblyUnconcentrated)} per berth`,
      }),
    );
  }

  /* Lodging ------------------------------------------------------- */
  for (const lodging of featuresOfKind(layout.features, 'accommodation')) {
    const layer: ModelLayer =
      lodging.style === 'glamping'
        ? 'glamping'
        : lodging.style === 'bunkhouse'
          ? 'bunkhouse'
          : lodging.style === 'towerSuite'
            ? 'towers'
            : 'cabins';
    areas.push(
      area({
        id: `area-${lodging.id}`,
        name: lodging.name,
        use: 'lodging',
        anchor: { x: lodging.position.x, y: 26, z: lodging.position.z },
        sqFt: lodging.sqFt,
        usableFraction: 1,
        capacity: lodging.sleeps,
        layer,
        note: `${lodging.units} keys`,
      }),
    );
  }

  return areas;
}

export interface CapacitySummary {
  /** Everyone the assembly areas allow at once. */
  assembly: number;
  /** Heads in beds. */
  beds: number;
  /** People the docks allow. */
  dock: number;
  /** Staff and back of house. */
  business: number;
  totalSqFt: number;
}

export function capacitySummary(areas: Area[]): CapacitySummary {
  const sum = (predicate: (a: Area) => boolean) =>
    areas.filter(predicate).reduce((a, x) => a + x.capacity, 0);
  return {
    assembly: sum((a) => a.use.startsWith('assembly')),
    beds: sum((a) => a.use === 'lodging'),
    dock: sum((a) => a.use === 'dock'),
    business: sum((a) => a.use === 'business'),
    totalSqFt: areas.reduce((a, x) => a + x.sqFt, 0),
  };
}
