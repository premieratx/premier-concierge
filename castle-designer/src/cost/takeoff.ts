import { dimsOf } from '../domain/dimensions';
import {
  boxOf,
  exposedSurface,
  findAdjacencies,
  findStackJoints,
  layoutBounds,
  stackDepths,
} from '../domain/geometry';
import type { Container, ContainerType, ContainerZone, Layout } from '../domain/types';
import { weldingTakeoff } from '../rules/welding';

export function zoneOf(c: Container): ContainerZone {
  return c.zone ?? 'castle';
}

/**
 * Share of the enclosed courtyard that actually gets a finished surface.
 * The rest stays native ground — paving all of it would be both wrong and
 * ruinous, and the impervious cover cap would stop it anyway.
 */
export const COURTYARD_HARDSCAPE_FRACTION = 0.25;

/** How the open-air floor area splits across the three surface types. */
export const OPEN_AIR_SURFACE_MIX = {
  stabilizedDg: 0.6,
  flagstone: 0.25,
  decking: 0.15,
} as const;

/** Corner castings connected at each joint. */
export const CONNECTIONS_PER_STACK_JOINT = 4;
export const CONNECTIONS_PER_ADJACENCY = 2;

/** Drilled piers under each ground-level container, one per corner casting. */
export const PIERS_PER_GROUND_CONTAINER = 4;

export interface Quantities {
  containersByType: Record<ContainerType, number>;
  containerCount: number;
  /** Sum of every container footprint, all levels. */
  grossSqFt: number;
  /** Conditioned interior area. */
  sealedSqFt: number;
  /** Finished open-air venue area. */
  openAirSqFt: number;
  exteriorWallSqFt: number;
  exteriorRoofSqFt: number;
  /** Share of exposed exterior in real stone veneer, 0..1. */
  stoneFraction: number;
  stackConnections: number;
  adjacencyConnections: number;
  weldingHours: number;
  groundContainers: number;
  gradeBeamLf: number;
  slabSqFt: number;
  trussRoofSqFt: number;
  standingSeamSqFt: number;
  flooringDgSqFt: number;
  flooringFlagstoneSqFt: number;
  flooringDeckingSqFt: number;
  /** Deepest stack in this zone, counted from grade. */
  maxStackDepth: number;
  /** Three levels or more, so the engineered lateral system is in the price. */
  needsLateralBracing: boolean;
}

function emptyByType(): Record<ContainerType, number> {
  return { '40HC': 0, '20ST': 0 };
}

/**
 * Quantity takeoff for one zone of a layout.
 *
 * Zones are kept separate so the castle's dollars per square foot can be
 * checked against the reference design without the lodging or the marina
 * quietly changing the answer.
 */
export function takeoff(layout: Layout, zone: ContainerZone = 'castle'): Quantities {
  const containers = layout.containers.filter((c) => zoneOf(c) === zone);
  const containersByType = emptyByType();
  let grossSqFt = 0;
  let sealedSqFt = 0;

  for (const c of containers) {
    const d = dimsOf(c.type);
    containersByType[c.type] += 1;
    grossSqFt += d.length * d.width;
    if (c.role === 'sealed') sealedSqFt += d.usableSqFt;
  }

  const surface = exposedSurface(containers);
  let stoneArea = 0;
  containers.forEach((c, i) => {
    const s = surface.perContainer[i];
    if (!s) return;
    if (c.finish === 'stone') stoneArea += s.wallSqFt;
  });
  const stoneFraction = surface.wallSqFt > 0 ? stoneArea / surface.wallSqFt : 0;

  const joints = findStackJoints(containers);
  const adjacencies = findAdjacencies(containers);
  const groundContainers = containers.filter((c) => c.position.y === 0).length;

  const bounds = layoutBounds(containers);
  const footprintSqFt = bounds
    ? (bounds.max.x - bounds.min.x) * (bounds.max.z - bounds.min.z)
    : 0;
  const gradeBeamLf = bounds
    ? 2 * (bounds.max.x - bounds.min.x + (bounds.max.z - bounds.min.z))
    : 0;

  const groundFootprintSqFt = containers
    .filter((c) => c.position.y === 0)
    .reduce((a, c) => {
      const b = boxOf(c);
      return a + (b.max.x - b.min.x) * (b.max.z - b.min.z);
    }, 0);

  // Decor is zoned the same way containers are, so the castle's truss roof
  // never lands in the lodging takeoff.
  const zoneDecor = layout.decor.filter((d) => (d.zone ?? 'castle') === zone);

  // Truss-roofed area comes from the plan extent of the truss bays.
  const trusses = zoneDecor.filter((d) => d.kind === 'truss');
  let trussRoofSqFt = 0;
  if (trusses.length > 0) {
    const xs = trusses.map((t) => t.center.x);
    const zMin = Math.min(...trusses.map((t) => t.center.z - t.size.z / 2));
    const zMax = Math.max(...trusses.map((t) => t.center.z + t.size.z / 2));
    trussRoofSqFt = (Math.max(...xs) - Math.min(...xs)) * (zMax - zMin);
  }

  // Standing seam goes over the conditioned boxes only; everything else is
  // an exposed container roof, which is already a roof.
  let standingSeamSqFt = 0;
  containers.forEach((c, i) => {
    if (c.role !== 'sealed') return;
    standingSeamSqFt += surface.perContainer[i]?.roofSqFt ?? 0;
  });

  const deckDecorSqFt = zoneDecor
    .filter((d) => d.kind === 'deck' || d.kind === 'walkway')
    .reduce((a, d) => a + d.size.x * d.size.z, 0);

  // Only the castle has an enclosed courtyard to surface. Scattered lodging
  // sits in native ground with its own decks, so measuring the gap between
  // its buildings as paving would invent tens of thousands of square feet.
  const courtyardSqFt =
    zone === 'castle' ? Math.max(0, footprintSqFt - groundFootprintSqFt) : 0;
  const openAirSqFt =
    courtyardSqFt * COURTYARD_HARDSCAPE_FRACTION + deckDecorSqFt + trussRoofSqFt;

  const welding = weldingTakeoff(containers);
  const maxStackDepth = stackDepths(containers).reduce((a, b) => Math.max(a, b), 0);

  return {
    containersByType,
    containerCount: containers.length,
    grossSqFt,
    sealedSqFt,
    openAirSqFt,
    exteriorWallSqFt: surface.wallSqFt,
    exteriorRoofSqFt: surface.roofSqFt,
    stoneFraction,
    stackConnections: joints.length * CONNECTIONS_PER_STACK_JOINT,
    adjacencyConnections: adjacencies.length * CONNECTIONS_PER_ADJACENCY,
    weldingHours: welding.totalHours,
    groundContainers,
    gradeBeamLf,
    slabSqFt: sealedSqFt,
    trussRoofSqFt,
    standingSeamSqFt,
    flooringDgSqFt: openAirSqFt * OPEN_AIR_SURFACE_MIX.stabilizedDg,
    flooringFlagstoneSqFt: openAirSqFt * OPEN_AIR_SURFACE_MIX.flagstone,
    flooringDeckingSqFt: openAirSqFt * OPEN_AIR_SURFACE_MIX.decking,
    maxStackDepth,
    needsLateralBracing: maxStackDepth >= 3,
  };
}
