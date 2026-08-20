import type { SiteFeature, SlipFeature, Vec3 } from '../types';
import { gid, headingOf } from './common';

/**
 * The hexagonal marina.
 *
 * Seven hexagons: a hub carrying the ship store with a stage on its roof, and
 * six satellites, one off each corner of the hub at the end of a fifty-foot
 * walkway that retracts when the lake gets ugly.
 *
 * Berths hang off the *outside* of each hexagon and the middle is left open as
 * a swimming lagoon, with a net twelve feet down to catch what people drop and
 * to stop anybody going deeper than that. Turning it inside out this way costs
 * nothing in berth count — it gains a great deal, because the outer perimeter
 * is longer than the inner one — and it turns the part of the structure that
 * was a turning basin into the best amenity on the property.
 *
 * Everything below is derived from the spec rather than drawn by hand, so
 * changing the berth size or the side length re-cuts the whole marina.
 */

export interface HexMarinaSpec {
  /** Centre of the hub. */
  center: { x: number; z: number };
  /** Rotation of the whole assembly, in radians. */
  rotation: number;
  /** Side length of every hexagon, in feet. Also its circumradius. */
  sideFt: number;
  /** Walkway ringing each hexagon, inboard of its outer edge. */
  perimeterWalkFt: number;
  /** Clear width of a berth. */
  slipWidthFt: number;
  /** Length of a berth. */
  slipLengthFt: number;
  /** Finger pier between two berths. */
  fingerWidthFt: number;
  /** Berths left out either side of the corner the walkway lands on. */
  walkwayClearBerths: number;
  /** Walkway from each hub corner out to its satellite. */
  walkwayLengthFt: number;
  walkwayWidthFt: number;
  /** Roof deck height above the dock deck. */
  roofHeightFt: number;
  /** Dock deck height above the water. */
  freeboardFt: number;
  /** How far the roof reaches past the hexagon to cover the berths. */
  roofOverhangFt: number;
  /** Share of the roof carrying panels under the clear decking. */
  solarCoverage: number;
  /** Depth of the safety net below the water inside each lagoon. */
  swimNetDepthFt: number;
  /** Water surface elevation. */
  waterLevelFt: number;
  /** Every satellite in this list is premier. */
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
  perimeterWalkFt: 12,
  slipWidthFt: 12,
  slipLengthFt: 24,
  fingerWidthFt: 2,
  walkwayClearBerths: 1,
  walkwayLengthFt: 50,
  walkwayWidthFt: 12,
  roofHeightFt: 16,
  freeboardFt: 1.6,
  roofOverhangFt: 0,
  solarCoverage: 0.62,
  swimNetDepthFt: 12,
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

/** Area of any simple polygon, by the shoelace formula. */
export function polygonAreaSqFt(points: Point2[]): number {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    total += a.x * b.z - b.x * a.z;
  }
  return Math.abs(total) / 2;
}

/**
 * The hexagon grown outward by a constant distance — straight runs parallel to
 * each edge, arcs around each corner.
 *
 * This is the shape the roof actually has to be: a plain larger hexagon would
 * reach a great deal further at the corners than it needs to, and on this
 * layout that is the difference between roofs that clear their neighbours and
 * roofs that collide.
 */
export function offsetHexagon(
  centre: Point2,
  radius: number,
  rotation: number,
  offset: number,
  cornerSegments = 3,
): Point2[] {
  if (offset <= 0) return hexVertices(centre, radius, rotation);
  const points: Point2[] = [];
  const vertices = hexVertices(centre, radius, rotation);

  for (let i = 0; i < 6; i++) {
    const prev = vertices[(i + 5) % 6]!;
    const here = vertices[i]!;
    const next = vertices[(i + 1) % 6]!;

    // Outward normals of the two edges meeting at this vertex.
    const normalOf = (a: Point2, b: Point2) => {
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      const n = { x: -dz / len, z: dx / len };
      const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      const outward = { x: mid.x - centre.x, z: mid.z - centre.z };
      return n.x * outward.x + n.z * outward.z >= 0 ? n : { x: -n.x, z: -n.z };
    };

    const inNormal = normalOf(prev, here);
    const outNormal = normalOf(here, next);
    const startAngle = Math.atan2(inNormal.z, inNormal.x);
    let endAngle = Math.atan2(outNormal.z, outNormal.x);
    while (endAngle < startAngle) endAngle += Math.PI * 2;

    for (let s = 0; s <= cornerSegments; s++) {
      const a = startAngle + ((endAngle - startAngle) * s) / cornerSegments;
      points.push({ x: here.x + Math.cos(a) * offset, z: here.z + Math.sin(a) * offset });
    }
  }
  return points;
}

export interface HexSlipPlan {
  id: string;
  slipNumber: number;
  /** Centre of the berth. */
  center: Point2;
  /** Heading such that the berth's length runs from the dock outward. */
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
  /** Outer edge of the perimeter walkway. */
  vertices: Point2[];
  /** Inner edge of the walkway, which is the lip of the swim lagoon. */
  innerVertices: Point2[];
  /** Outline of the roof, offset out far enough to cover the berths. */
  roofOutline: Point2[];
  slips: HexSlipPlan[];
  /** Which corner the walkway lands on, by vertex index. */
  walkwayVertex: number;
  /** Deck area that has to float, in square feet. */
  deckSqFt: number;
  roofSqFt: number;
  /** Open water inside the ring, in square feet. Zero on the hub. */
  swimSqFt: number;
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
  /** Open swimming water inside the six lagoons, in square feet. */
  swimSqFt: number;
  /** Safety net area, which is the same water measured at depth. */
  netSqFt: number;
  /** Across the flats of one lagoon, in feet. */
  lagoonWidthFt: number;
  /** Overall diameter of the assembly, corner to corner. */
  extentFt: number;
  /**
   * Gap between the roofs of two adjacent satellites.
   *
   * Negative means they collide, which is the number that decides whether the
   * fifty-foot walkway is long enough for this berth length.
   */
  roofClearanceFt: number;
}

/** Watts per square foot of module at standard test conditions. */
export const PV_WATTS_PER_SQFT = 19.5;

/**
 * Berths along one outer edge, projecting away from the hexagon.
 *
 * Berths near the corner the walkway lands on are left out so there is a clear
 * landing to step onto.
 */
function slipsAlongEdge(
  spec: HexMarinaSpec,
  moduleId: string,
  a: Point2,
  b: Point2,
  centre: Point2,
  edgeIndex: number,
  skipFirst: number,
  skipLast: number,
  premier: boolean,
  startNumber: number,
): HexSlipPlan[] {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const run = Math.hypot(dx, dz);
  const ux = dx / run;
  const uz = dz / run;

  // Outward normal: away from the module centre.
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  const away = { x: mid.x - centre.x, z: mid.z - centre.z };
  const nLen = Math.hypot(away.x, away.z);
  const nx = away.x / nLen;
  const nz = away.z / nLen;

  const pitch = spec.slipWidthFt + spec.fingerWidthFt;
  const count = Math.max(0, Math.floor(run / pitch));
  if (count === 0) return [];

  const margin = (run - count * pitch) / 2;
  const rotationY = headingOf(nx, nz);
  const slips: HexSlipPlan[] = [];
  let n = startNumber;

  for (let i = 0; i < count; i++) {
    if (i < skipFirst) continue;
    if (i >= count - skipLast) continue;
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
  const lagoonArea = hexAreaSqFt(innerR);
  const ringArea = hexArea - lagoonArea;
  const roofOffset = spec.slipLengthFt + spec.roofOverhangFt;

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
    // The hub carries the store, so its roof is the hexagon and nothing more.
    roofOutline: hexVertices(spec.center, R, spec.rotation),
    slips: [],
    walkwayVertex: -1,
    deckSqFt: hexArea,
    roofSqFt: hexArea,
    swimSqFt: 0,
    premier: false,
  });

  /* Satellites ----------------------------------------------------- */
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

    // The corner facing the hub is where the walkway lands.
    const walkwayVertex = (k + 3) % 6;

    const slips: HexSlipPlan[] = [];
    for (let e = 0; e < 6; e++) {
      // Edge e runs from vertex e to vertex e+1, so the landing corner is the
      // start of edge `walkwayVertex` and the end of the one before it.
      const skipFirst = e === walkwayVertex ? spec.walkwayClearBerths : 0;
      const skipLast = e === (walkwayVertex + 5) % 6 ? spec.walkwayClearBerths : 0;
      const edgeSlips = slipsAlongEdge(
        spec,
        id,
        vertices[e]!,
        vertices[(e + 1) % 6]!,
        centre,
        e,
        skipFirst,
        skipLast,
        premier,
        slipNumber,
      );
      slipNumber += edgeSlips.length;
      slips.push(...edgeSlips);
    }

    const roofOutline = offsetHexagon(centre, R, spec.rotation, roofOffset);
    const fingerArea = (slips.length + 6) * spec.slipLengthFt * spec.fingerWidthFt;

    modules.push({
      id,
      role: 'satellite',
      index: k,
      centre,
      vertices,
      innerVertices,
      roofOutline,
      slips,
      walkwayVertex,
      deckSqFt: ringArea + fingerArea,
      // A ring of roof: it covers the walkway and the berths and leaves the
      // lagoon open to the sky, which is the point of having a lagoon.
      roofSqFt: polygonAreaSqFt(roofOutline) - lagoonArea,
      swimSqFt: lagoonArea,
      premier,
    });

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
  const swimSqFt = modules.reduce((sum, m) => sum + m.swimSqFt, 0);

  // Adjacent satellites sit a hexagon-radius apart; each roof reaches its own
  // circumradius plus the offset in the direction of its neighbour.
  const roofReach = R + roofOffset;
  const roofClearanceFt = satelliteRadius - 2 * roofReach;

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
    swimSqFt,
    netSqFt: swimSqFt,
    lagoonWidthFt: innerA * 2,
    extentFt: (satelliteRadius + roofReach) * 2,
    roofClearanceFt,
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
      roofOffsetFt: module.role === 'hub' ? 0 : spec.slipLengthFt + spec.roofOverhangFt,
      deckSqFt: module.deckSqFt,
      roofSqFt: module.roofSqFt,
      solarSqFt: module.roofSqFt * spec.solarCoverage,
      swimSqFt: module.swimSqFt,
      netDepthFt: module.role === 'hub' ? 0 : spec.swimNetDepthFt,
      walkwayVertex: module.walkwayVertex,
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
        // The roof overhead is the shade; there is no separate patio.
        patio: false,
        furnished: slip.premier,
        ropeSwing: false,
        jumpPlatform: false,
        bar: false,
        stringLights: true,
        // Two berths in three occupied, which reads as busy without putting
        // every hull in the frame.
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
