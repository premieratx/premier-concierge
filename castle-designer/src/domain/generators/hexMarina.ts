import type { SiteFeature, SlipFeature, Vec3 } from '../types';
import { gid, headingOf } from './common';

/**
 * The hexagonal marina.
 *
 * Seven hexagons: a hub carrying the ship store with a stage on its roof, and
 * six satellites, one off each corner of the hub at the end of a fifty-foot
 * walkway that retracts when the lake gets ugly. Every hexagon is sixty feet
 * on a side, ringed by a walkway, packed with berths off its inner faces, and
 * roofed at sixteen feet with a clear deck you can stand on and photovoltaic
 * under it.
 *
 * Everything below is derived from the spec rather than drawn by hand, so
 * changing the berth size or the side length re-cuts the whole marina — which
 * is the point of building it this way rather than modelling it.
 */

export interface HexMarinaSpec {
  /** Centre of the hub. */
  center: { x: number; z: number };
  /** Rotation of the whole assembly, in radians. */
  rotation: number;
  /** Side length of every hexagon, in feet. Also its circumradius. */
  sideFt: number;
  /** Walkway ringing the inside of each hexagon. */
  perimeterWalkFt: number;
  /** Clear width of a berth. */
  slipWidthFt: number;
  /** Length of a berth. */
  slipLengthFt: number;
  /** Finger pier between two berths. */
  fingerWidthFt: number;
  /** Clear opening at an entrance. */
  entranceWidthFt: number;
  /** Which edges of a satellite are left open, by index. */
  entranceEdges: number[];
  /** Walkway from each hub corner out to its satellite. */
  walkwayLengthFt: number;
  walkwayWidthFt: number;
  /** Roof deck height above the dock deck. */
  roofHeightFt: number;
  /** Dock deck height above the water. */
  freeboardFt: number;
  /** Share of the roof carrying panels under the clear decking. */
  solarCoverage: number;
  /** Water surface elevation. */
  waterLevelFt: number;
  /** Every satellite this far out or beyond is premier. */
  premiumSatellites: number[];
}

/**
 * Dock float module: four by eight feet, thirty-two inches deep.
 *
 * The deck area divided by this is the float count, which is how a floating
 * dock is actually bought — by the cube, not by the square foot.
 */
export const FLOAT = { widthFt: 4, lengthFt: 8, depthIn: 32, areaSqFt: 32 } as const;

export const DEFAULT_HEX_MARINA: HexMarinaSpec = {
  center: { x: -120, z: 440 },
  rotation: Math.PI / 2,
  sideFt: 60,
  perimeterWalkFt: 6,
  slipWidthFt: 12,
  slipLengthFt: 24,
  fingerWidthFt: 2,
  entranceWidthFt: 20,
  entranceEdges: [0, 2, 4],
  walkwayLengthFt: 50,
  walkwayWidthFt: 6,
  roofHeightFt: 16,
  freeboardFt: 1.6,
  solarCoverage: 0.62,
  waterLevelFt: 0,
  premiumSatellites: [0, 1, 2],
};

export interface Point2 {
  x: number;
  z: number;
}

/** Vertices of a hexagon, counter-clockwise from the given rotation. */
export function hexVertices(centre: Point2, radius: number, rotation: number): Point2[] {
  return Array.from({ length: 6 }, (_, k) => {
    const angle = rotation + (k * Math.PI) / 3;
    return {
      x: centre.x + radius * Math.cos(angle),
      z: centre.z + radius * Math.sin(angle),
    };
  });
}

/** Distance from the centre of a hexagon to the middle of an edge. */
export function apothem(sideFt: number): number {
  return (sideFt * Math.sqrt(3)) / 2;
}

export function hexAreaSqFt(sideFt: number): number {
  return ((3 * Math.sqrt(3)) / 2) * sideFt * sideFt;
}

export interface HexSlipPlan {
  id: string;
  slipNumber: number;
  /** Centre of the berth. */
  center: Point2;
  /** Heading such that the berth's length runs from its mouth inward. */
  rotationY: number;
  widthFt: number;
  lengthFt: number;
  edgeIndex: number;
  moduleId: string;
  premier: boolean;
}

export interface HexModulePlan {
  id: string;
  role: 'hub' | 'satellite';
  /** Index around the hub, or -1 for the hub itself. */
  index: number;
  centre: Point2;
  vertices: Point2[];
  /** Inner edge of the perimeter walkway. */
  innerVertices: Point2[];
  slips: HexSlipPlan[];
  /** Edge indices left open for boats. */
  entranceEdges: number[];
  /** Deck area that has to float, in square feet. */
  deckSqFt: number;
  roofSqFt: number;
  premier: boolean;
}

export interface HexWalkwayPlan {
  id: string;
  from: Point2;
  to: Point2;
  lengthFt: number;
  widthFt: number;
  retractable: boolean;
}

export interface HexMarinaPlan {
  spec: HexMarinaSpec;
  modules: HexModulePlan[];
  walkways: HexWalkwayPlan[];
  slipCount: number;
  /** Total floating deck, in square feet. */
  deckSqFt: number;
  /** Number of 4x8 floats the deck needs. */
  floatCount: number;
  roofSqFt: number;
  solarSqFt: number;
  /** Direct-current array size, in kilowatts. */
  solarKwDc: number;
  /** Overall diameter of the assembly, corner to corner. */
  extentFt: number;
  /** Clear turning basin inside a satellite, across the flats. */
  turningBasinFt: number;
}

/** Watts per square foot of module at standard test conditions. */
export const PV_WATTS_PER_SQFT = 19.5;

function midpoint(a: Point2, b: Point2): Point2 {
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
}

/**
 * Berths along one inner edge.
 *
 * Slips run perpendicular to the edge, pointing in toward the turning basin,
 * on a pitch of one berth plus one finger. An entrance edge gives up the
 * middle of its run to the opening, so it carries fewer.
 */
function slipsAlongEdge(
  spec: HexMarinaSpec,
  moduleId: string,
  a: Point2,
  b: Point2,
  centre: Point2,
  edgeIndex: number,
  isEntrance: boolean,
  premier: boolean,
  startNumber: number,
): HexSlipPlan[] {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const run = Math.hypot(dx, dz);
  const ux = dx / run;
  const uz = dz / run;

  // Inward normal: toward the module centre.
  const mid = midpoint(a, b);
  const toCentre = { x: centre.x - mid.x, z: centre.z - mid.z };
  const nLen = Math.hypot(toCentre.x, toCentre.z);
  const nx = toCentre.x / nLen;
  const nz = toCentre.z / nLen;

  const pitch = spec.slipWidthFt + spec.fingerWidthFt;
  const usable = isEntrance ? run - spec.entranceWidthFt : run;
  const count = Math.max(0, Math.floor(usable / pitch));
  if (count === 0) return [];

  const slips: HexSlipPlan[] = [];
  const rotationY = headingOf(nx, nz);

  if (isEntrance) {
    // Split the berths either side of the opening in the middle of the edge.
    const perSide = Math.floor(count / 2);
    const gapHalf = spec.entranceWidthFt / 2;
    let n = startNumber;
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < perSide; i++) {
        const along = run / 2 + side * (gapHalf + pitch * (i + 0.5));
        const px = a.x + ux * along + nx * (spec.slipLengthFt / 2);
        const pz = a.z + uz * along + nz * (spec.slipLengthFt / 2);
        slips.push({
          id: gid('hexslip', moduleId, edgeIndex, side, i),
          slipNumber: n++,
          center: { x: px, z: pz },
          rotationY,
          widthFt: spec.slipWidthFt,
          lengthFt: spec.slipLengthFt,
          edgeIndex,
          moduleId,
          premier,
        });
      }
    }
    return slips;
  }

  const margin = (run - count * pitch) / 2;
  let n = startNumber;
  for (let i = 0; i < count; i++) {
    const along = margin + pitch * (i + 0.5);
    const px = a.x + ux * along + nx * (spec.slipLengthFt / 2);
    const pz = a.z + uz * along + nz * (spec.slipLengthFt / 2);
    slips.push({
      id: gid('hexslip', moduleId, edgeIndex, i),
      slipNumber: n++,
      center: { x: px, z: pz },
      rotationY,
      widthFt: spec.slipWidthFt,
      lengthFt: spec.slipLengthFt,
      edgeIndex,
      moduleId,
      premier,
    });
  }
  return slips;
}

/** The whole marina, laid out from the spec. */
export function planHexMarina(spec: HexMarinaSpec = DEFAULT_HEX_MARINA): HexMarinaPlan {
  const R = spec.sideFt;
  const a = apothem(R);
  const innerA = a - spec.perimeterWalkFt;
  const innerR = innerA / (Math.sqrt(3) / 2);

  const hexArea = hexAreaSqFt(R);
  const ringArea = hexArea - hexAreaSqFt(innerR);

  const modules: HexModulePlan[] = [];
  const walkways: HexWalkwayPlan[] = [];

  /* Hub ----------------------------------------------------------- */
  modules.push({
    id: 'hex-hub',
    role: 'hub',
    index: -1,
    centre: spec.center,
    vertices: hexVertices(spec.center, R, spec.rotation),
    innerVertices: hexVertices(spec.center, innerR, spec.rotation),
    slips: [],
    entranceEdges: [],
    // The hub is a solid deck: it carries the store, not berths.
    deckSqFt: hexArea,
    roofSqFt: hexArea,
    premier: false,
  });

  /* Satellites ----------------------------------------------------- */
  // One off each hub corner, far enough out that the walkway between the two
  // nearest vertices is exactly the length asked for.
  const satelliteRadius = R + spec.walkwayLengthFt + R;
  let slipNumber = 1;

  for (let k = 0; k < 6; k++) {
    const angle = spec.rotation + (k * Math.PI) / 3;
    const centre: Point2 = {
      x: spec.center.x + satelliteRadius * Math.cos(angle),
      z: spec.center.z + satelliteRadius * Math.sin(angle),
    };
    const vertices = hexVertices(centre, R, spec.rotation);
    const innerVertices = hexVertices(centre, innerR, spec.rotation);
    const id = `hex-sat-${k}`;
    const premier = spec.premiumSatellites.includes(k);

    const slips: HexSlipPlan[] = [];
    for (let e = 0; e < 6; e++) {
      const edgeSlips = slipsAlongEdge(
        spec,
        id,
        innerVertices[e]!,
        innerVertices[(e + 1) % 6]!,
        centre,
        e,
        spec.entranceEdges.includes(e),
        premier,
        slipNumber,
      );
      slipNumber += edgeSlips.length;
      slips.push(...edgeSlips);
    }

    const fingerArea =
      (slips.length + spec.entranceEdges.length) * spec.slipLengthFt * spec.fingerWidthFt;

    modules.push({
      id,
      role: 'satellite',
      index: k,
      centre,
      vertices,
      innerVertices,
      slips,
      entranceEdges: [...spec.entranceEdges],
      deckSqFt: ringArea + fingerArea,
      roofSqFt: hexArea,
      premier,
    });

    // The walkway runs radially between the two facing vertices.
    walkways.push({
      id: `hex-walk-${k}`,
      from: {
        x: spec.center.x + R * Math.cos(angle),
        z: spec.center.z + R * Math.sin(angle),
      },
      to: {
        x: spec.center.x + (satelliteRadius - R) * Math.cos(angle),
        z: spec.center.z + (satelliteRadius - R) * Math.sin(angle),
      },
      lengthFt: spec.walkwayLengthFt,
      widthFt: spec.walkwayWidthFt,
      retractable: true,
    });
  }

  const deckSqFt =
    modules.reduce((sum, m) => sum + m.deckSqFt, 0) +
    walkways.reduce((sum, w) => sum + w.lengthFt * w.widthFt, 0);
  const roofSqFt = modules.reduce((sum, m) => sum + m.roofSqFt, 0);
  const solarSqFt = roofSqFt * spec.solarCoverage;

  return {
    spec,
    modules,
    walkways,
    slipCount: modules.reduce((sum, m) => sum + m.slips.length, 0),
    deckSqFt,
    floatCount: Math.ceil(deckSqFt / FLOAT.areaSqFt),
    roofSqFt,
    solarSqFt,
    solarKwDc: (solarSqFt * PV_WATTS_PER_SQFT) / 1000,
    extentFt: (satelliteRadius + R) * 2,
    // What is left in the middle of a satellite once the berths are in.
    turningBasinFt: (innerA - spec.slipLengthFt) * 2,
  };
}

/**
 * The plan as site features, so the cost engine, the revenue model and the
 * capacity model all keep working without knowing a hexagon from a pier.
 */
export function hexMarinaFeatures(plan: HexMarinaPlan): SiteFeature[] {
  const spec = plan.spec;
  const deckY = spec.waterLevelFt + spec.freeboardFt;
  const features: SiteFeature[] = [];

  for (const module of plan.modules) {
    const position: Vec3 = { x: module.centre.x, y: deckY, z: module.centre.z };
    features.push({
      id: module.id,
      kind: 'hexDock',
      position,
      rotationY: spec.rotation,
      sideFt: spec.sideFt,
      perimeterWalkFt: spec.perimeterWalkFt,
      role: module.role,
      roofHeightFt: spec.roofHeightFt,
      deckSqFt: module.deckSqFt,
      roofSqFt: module.roofSqFt,
      solarSqFt: module.roofSqFt * spec.solarCoverage,
      entranceEdges: module.entranceEdges,
      amenities: {
        // Every satellite roof gets something to jump off; the premier ones
        // get a bar as well.
        bar: module.premier,
        jumpPlatform: module.role === 'satellite',
        ropeSwing: module.role === 'satellite',
      },
      label: module.role === 'hub' ? 'Ship store' : `Dock ${module.index + 1}`,
    });

    for (const slip of module.slips) {
      features.push({
        id: slip.id,
        kind: 'slip',
        position: { x: slip.center.x, y: spec.waterLevelFt, z: slip.center.z },
        rotationY: slip.rotationY,
        widthFt: slip.widthFt,
        lengthFt: slip.lengthFt,
        tier: slip.premier ? 'premier' : 'standard',
        slipNumber: slip.slipNumber,
        // The roof deck overhead is the shade; there is no separate patio.
        patio: false,
        furnished: slip.premier,
        ropeSwing: false,
        jumpPlatform: false,
        bar: false,
        stringLights: true,
        // Two berths in three are occupied, which reads as busy without
        // putting ninety hulls in the frame.
        boat:
          slip.slipNumber % 3 === 0
            ? 'none'
            : slip.slipNumber % 5 === 0
              ? 'pontoon'
              : 'runabout',
        label: `Slip ${slip.slipNumber}${slip.premier ? ' (premier)' : ''}`,
      } satisfies SlipFeature);
    }
  }

  for (const walk of plan.walkways) {
    features.push({
      id: walk.id,
      kind: 'walkway',
      from: { x: walk.from.x, y: deckY, z: walk.from.z },
      to: { x: walk.to.x, y: deckY, z: walk.to.z },
      widthFt: walk.widthFt,
      retractable: walk.retractable,
    });
  }

  return features;
}
