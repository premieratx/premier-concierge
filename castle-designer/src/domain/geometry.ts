import { dimsOf, SNAP_ACROSS_FT, SNAP_ALONG_FT } from './dimensions';
import type { Container, ContainerType, Opening, Rotation, Vec3 } from './types';

/** Axis-aligned bounding box in feet. */
export interface Box {
  min: Vec3;
  max: Vec3;
}

export interface Footprint {
  /** Extent along X, in feet. */
  sizeX: number;
  /** Extent along Z, in feet. */
  sizeZ: number;
}

/**
 * Plan extents of a container once its rotation is applied.
 * At 0 degrees the long axis runs along X; at 90 degrees it runs along Z.
 */
export function footprint(type: ContainerType, rotation: Rotation): Footprint {
  const d = dimsOf(type);
  return rotation === 0
    ? { sizeX: d.length, sizeZ: d.width }
    : { sizeX: d.width, sizeZ: d.length };
}

export function boxOf(c: Container): Box {
  const { sizeX, sizeZ } = footprint(c.type, c.rotation);
  const { height } = dimsOf(c.type);
  return {
    min: { ...c.position },
    max: {
      x: c.position.x + sizeX,
      y: c.position.y + height,
      z: c.position.z + sizeZ,
    },
  };
}

/** Centroid, which is what Three.js wants for a BoxGeometry mesh position. */
export function centerOf(c: Container): Vec3 {
  const b = boxOf(c);
  return {
    x: (b.min.x + b.max.x) / 2,
    y: (b.min.y + b.max.y) / 2,
    z: (b.min.z + b.max.z) / 2,
  };
}

/** Y rotation in radians for the Three.js mesh. */
export function rotationRadians(rotation: Rotation): number {
  return (rotation * Math.PI) / 180;
}

/**
 * The eight corner castings, in world feet. These are the only rated load
 * path, so stack alignment (R1) is checked against these points and nothing
 * else.
 */
export function cornerCastings(c: Container): Vec3[] {
  const b = boxOf(c);
  const xs = [b.min.x, b.max.x];
  const ys = [b.min.y, b.max.y];
  const zs = [b.min.z, b.max.z];
  const out: Vec3[] = [];
  for (const x of xs) for (const y of ys) for (const z of zs) out.push({ x, y, z });
  return out;
}

/** The four plan positions of the corner castings, ignoring elevation. */
export function planCorners(c: Container): { x: number; z: number }[] {
  const b = boxOf(c);
  return [
    { x: b.min.x, z: b.min.z },
    { x: b.max.x, z: b.min.z },
    { x: b.min.x, z: b.max.z },
    { x: b.max.x, z: b.max.z },
  ];
}

/** Tolerance for "same point" in feet — a hair under a quarter inch. */
export const EPS = 1e-6;

function overlaps1d(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  // Touching faces are not an overlap; containers are meant to sit shoulder to
  // shoulder and stack directly on one another.
  return aMin < bMax - EPS && bMin < aMax - EPS;
}

/** True when two containers occupy the same volume rather than merely touching. */
export function intersects(a: Container, b: Container): boolean {
  const ba = boxOf(a);
  const bb = boxOf(b);
  return (
    overlaps1d(ba.min.x, ba.max.x, bb.min.x, bb.max.x) &&
    overlaps1d(ba.min.y, ba.max.y, bb.min.y, bb.max.y) &&
    overlaps1d(ba.min.z, ba.max.z, bb.min.z, bb.max.z)
  );
}

/** Every pair of containers that shares volume, as index pairs. */
export function findIntersections(containers: Container[]): [number, number][] {
  const hits: [number, number][] = [];
  for (let i = 0; i < containers.length; i++) {
    for (let j = i + 1; j < containers.length; j++) {
      const a = containers[i];
      const b = containers[j];
      if (a && b && intersects(a, b)) hits.push([i, j]);
    }
  }
  return hits;
}

export function snapTo(value: number, step: number): number {
  // Adding zero collapses negative zero: JSON cannot represent it, so a
  // position of -0 would survive a save but not a load.
  return Math.round(value / step) * step + 0;
}

/**
 * Snap a container's min corner to the castle grid: 8 feet across the box
 * (its width) and a full container length along it.
 */
export function snapPosition(position: Vec3, type: ContainerType, rotation: Rotation): Vec3 {
  const along = SNAP_ALONG_FT[type];
  const stepX = rotation === 0 ? along : SNAP_ACROSS_FT;
  const stepZ = rotation === 0 ? SNAP_ACROSS_FT : along;
  return {
    x: snapTo(position.x, stepX),
    y: position.y,
    z: snapTo(position.z, stepZ),
  };
}

/** Plan-view bounds of a whole layout, or null when it is empty. */
export function layoutBounds(containers: Container[]): Box | null {
  if (containers.length === 0) return null;
  const min: Vec3 = { x: Infinity, y: Infinity, z: Infinity };
  const max: Vec3 = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const c of containers) {
    const b = boxOf(c);
    min.x = Math.min(min.x, b.min.x);
    min.y = Math.min(min.y, b.min.y);
    min.z = Math.min(min.z, b.min.z);
    max.x = Math.max(max.x, b.max.x);
    max.y = Math.max(max.y, b.max.y);
    max.z = Math.max(max.z, b.max.z);
  }
  return { min, max };
}

/** Gross plan area of one container, in square feet. */
export function grossSqFt(c: Container): number {
  const d = dimsOf(c.type);
  return d.length * d.width;
}

/* ------------------------------------------------------------------ *
 * Adjacency, stacking and exposed surface
 *
 * Everything the rule checker and the cost takeoff need to know about how
 * the boxes touch one another.
 * ------------------------------------------------------------------ */

function overlapLen(aMin: number, aMax: number, bMin: number, bMax: number): number {
  return Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
}

/** Plan-view overlap area between two containers, in square feet. */
export function planOverlapSqFt(a: Container, b: Container): number {
  const ba = boxOf(a);
  const bb = boxOf(b);
  return (
    overlapLen(ba.min.x, ba.max.x, bb.min.x, bb.max.x) *
    overlapLen(ba.min.z, ba.max.z, bb.min.z, bb.max.z)
  );
}

/**
 * Finished ground level at a plan point, in feet.
 *
 * Everything used to assume grade was zero. On a terraced hillside it is not:
 * a container standing on the hall terrace has its base at 74 feet and nothing
 * modelled underneath it, and without this the cantilever rule reads the whole
 * curtain wall as floating in mid-air.
 */
export type GroundAt = (x: number, z: number) => number;

export const FLAT_GROUND: GroundAt = () => 0;

/** How far above finished grade a base can sit and still count as bearing on it. */
export const GRADE_TOLERANCE_FT = 2;

/** Whether a container bears on the ground rather than on another container. */
export function bearsOnGrade(container: Container, groundAt: GroundAt = FLAT_GROUND): boolean {
  const b = boxOf(container);
  const centreX = (b.min.x + b.max.x) / 2;
  const centreZ = (b.min.z + b.max.z) / 2;
  // At or below finished grade counts too: a container cut into the hill is
  // bearing on it just as surely as one sitting on top.
  return container.position.y <= groundAt(centreX, centreZ) + GRADE_TOLERANCE_FT;
}

export interface StackJoint {
  lowerIndex: number;
  upperIndex: number;
  /**
   * Worst corner-casting misalignment in plan, in feet. Zero means casting
   * sits on casting and the load path is direct; anything else needs a
   * transfer structure.
   */
  offsetFt: number;
  sharedPlanSqFt: number;
}

/** Every place one container bears directly on another. */
export function findStackJoints(
  containers: Container[],
  groundAt: GroundAt = FLAT_GROUND,
): StackJoint[] {
  const joints: StackJoint[] = [];
  for (let u = 0; u < containers.length; u++) {
    const upper = containers[u];
    if (!upper || bearsOnGrade(upper, groundAt)) continue;
    for (let l = 0; l < containers.length; l++) {
      if (l === u) continue;
      const lower = containers[l];
      if (!lower) continue;
      if (Math.abs(boxOf(lower).max.y - upper.position.y) > EPS) continue;
      const shared = planOverlapSqFt(lower, upper);
      if (shared <= EPS) continue;

      // Corner casting alignment: how far the upper box's plan rectangle sits
      // off the lower one. Identical rectangles give zero.
      const bl = boxOf(lower);
      const bu = boxOf(upper);
      const offsetFt = Math.max(
        Math.abs(bl.min.x - bu.min.x),
        Math.abs(bl.max.x - bu.max.x),
        Math.abs(bl.min.z - bu.min.z),
        Math.abs(bl.max.z - bu.max.z),
      );
      joints.push({ lowerIndex: l, upperIndex: u, offsetFt, sharedPlanSqFt: shared });
    }
  }
  return joints;
}

/** Containers sitting shoulder to shoulder at the same level. */
export function findAdjacencies(containers: Container[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < containers.length; i++) {
    for (let j = i + 1; j < containers.length; j++) {
      const a = containers[i];
      const b = containers[j];
      if (!a || !b) continue;
      const ba = boxOf(a);
      const bb = boxOf(b);
      if (overlapLen(ba.min.y, ba.max.y, bb.min.y, bb.max.y) <= EPS) continue;
      const touchX =
        (Math.abs(ba.max.x - bb.min.x) < EPS || Math.abs(bb.max.x - ba.min.x) < EPS) &&
        overlapLen(ba.min.z, ba.max.z, bb.min.z, bb.max.z) > EPS;
      const touchZ =
        (Math.abs(ba.max.z - bb.min.z) < EPS || Math.abs(bb.max.z - ba.min.z) < EPS) &&
        overlapLen(ba.min.x, ba.max.x, bb.min.x, bb.max.x) > EPS;
      if (touchX || touchZ) pairs.push([i, j]);
    }
  }
  return pairs;
}

/**
 * How many containers deep each column is, counted from grade. A container
 * sitting on grade is level 1.
 */
export function stackDepths(
  containers: Container[],
  groundAt: GroundAt = FLAT_GROUND,
): number[] {
  const depths = new Array<number>(containers.length).fill(0);
  const order = containers
    .map((c, i) => ({ i, y: c.position.y }))
    .sort((a, b) => a.y - b.y);
  for (const { i } of order) {
    const c = containers[i];
    if (!c) continue;
    if (bearsOnGrade(c, groundAt)) {
      depths[i] = 1;
      continue;
    }
    let best = 0;
    for (let l = 0; l < containers.length; l++) {
      if (l === i) continue;
      const lower = containers[l];
      if (!lower) continue;
      if (Math.abs(boxOf(lower).max.y - c.position.y) > EPS) continue;
      if (planOverlapSqFt(lower, c) <= EPS) continue;
      best = Math.max(best, depths[l] ?? 0);
    }
    // An unsupported container floating above grade still counts as one deep;
    // rule R7 is what complains about it having nothing underneath.
    depths[i] = best + 1;
  }
  return depths;
}

export interface SupportReport {
  /** Fraction of the plan area with something underneath it, 0..1. */
  supportedFraction: number;
  /** Longest unsupported run at either end, as a fraction of the length. */
  endOverhangFraction: number;
}

/** How well a container is carried by grade or by the containers below it. */
export function supportOf(
  container: Container,
  all: Container[],
  groundAt: GroundAt = FLAT_GROUND,
): SupportReport {
  if (bearsOnGrade(container, groundAt)) {
    return { supportedFraction: 1, endOverhangFraction: 0 };
  }
  const b = boxOf(container);
  const alongX = container.rotation === 0;
  const runMin = alongX ? b.min.x : b.min.z;
  const runMax = alongX ? b.max.x : b.max.z;
  const totalArea = (b.max.x - b.min.x) * (b.max.z - b.min.z);

  let supportedArea = 0;
  const intervals: [number, number][] = [];
  for (const other of all) {
    if (other === container) continue;
    if (Math.abs(boxOf(other).max.y - container.position.y) > EPS) continue;
    const shared = planOverlapSqFt(other, container);
    if (shared <= EPS) continue;
    supportedArea += shared;
    const ob = boxOf(other);
    intervals.push(
      alongX
        ? [Math.max(runMin, ob.min.x), Math.min(runMax, ob.max.x)]
        : [Math.max(runMin, ob.min.z), Math.min(runMax, ob.max.z)],
    );
  }

  if (intervals.length === 0) {
    return { supportedFraction: 0, endOverhangFraction: 1 };
  }

  intervals.sort((p, q) => p[0] - q[0]);
  const first = intervals[0]!;
  let coveredEnd = first[1];
  const leadingGap = first[0] - runMin;
  for (const [start, end] of intervals) {
    if (start > coveredEnd + EPS) break;
    coveredEnd = Math.max(coveredEnd, end);
  }
  const trailingGap = runMax - coveredEnd;
  const run = runMax - runMin;

  return {
    supportedFraction: Math.min(1, supportedArea / totalArea),
    endOverhangFraction: Math.max(0, Math.max(leadingGap, trailingGap) / run),
  };
}

export interface SurfaceReport {
  /** Exposed vertical wall area, in square feet. */
  wallSqFt: number;
  /** Exposed roof area, in square feet. */
  roofSqFt: number;
  totalSqFt: number;
  /** Same split, container by container, in input order. */
  perContainer: { wallSqFt: number; roofSqFt: number }[];
}

/**
 * Exposed exterior surface: every face that is not buried against a
 * neighbouring container or sitting on grade. Faces hidden inside the
 * assembly get no paint, no stone, and no insulation, so counting all six
 * sides of every box would badly overstate the finish budget.
 */
export function exposedSurface(containers: Container[]): SurfaceReport {
  let wallSqFt = 0;
  let roofSqFt = 0;
  const perContainer: { wallSqFt: number; roofSqFt: number }[] = [];
  const boxes = containers.map(boxOf);

  for (let i = 0; i < containers.length; i++) {
    const b = boxes[i];
    if (!b) continue;
    const dx = b.max.x - b.min.x;
    const dy = b.max.y - b.min.y;
    const dz = b.max.z - b.min.z;

    // Four walls.
    const walls: { area: number; hidden: number }[] = [
      { area: dz * dy, hidden: 0 }, // -X
      { area: dz * dy, hidden: 0 }, // +X
      { area: dx * dy, hidden: 0 }, // -Z
      { area: dx * dy, hidden: 0 }, // +Z
    ];
    let roofHidden = 0;

    for (let j = 0; j < containers.length; j++) {
      if (i === j) continue;
      const o = boxes[j];
      if (!o) continue;
      const oy = overlapLen(b.min.y, b.max.y, o.min.y, o.max.y);
      const oz = overlapLen(b.min.z, b.max.z, o.min.z, o.max.z);
      const ox = overlapLen(b.min.x, b.max.x, o.min.x, o.max.x);
      if (Math.abs(o.max.x - b.min.x) < EPS) walls[0]!.hidden += oz * oy;
      if (Math.abs(o.min.x - b.max.x) < EPS) walls[1]!.hidden += oz * oy;
      if (Math.abs(o.max.z - b.min.z) < EPS) walls[2]!.hidden += ox * oy;
      if (Math.abs(o.min.z - b.max.z) < EPS) walls[3]!.hidden += ox * oy;
      if (Math.abs(o.min.y - b.max.y) < EPS) roofHidden += ox * oz;
    }

    const ownWall = walls.reduce((a, w) => a + Math.max(0, w.area - w.hidden), 0);
    const ownRoof = Math.max(0, dx * dz - roofHidden);
    wallSqFt += ownWall;
    roofSqFt += ownRoof;
    perContainer.push({ wallSqFt: ownWall, roofSqFt: ownRoof });
  }

  return { wallSqFt, roofSqFt, totalSqFt: wallSqFt + roofSqFt, perContainer };
}

/** Area of one opening, in square feet. */
export function openingSqFt(opening: { width: number; height: number }): number {
  return opening.width * opening.height;
}

/**
 * Area of the face an opening is cut into. Side walls carry the shear
 * diaphragm, which is what rule R3 is protecting.
 */
export function faceSqFt(container: Container, face: Opening['face']): number {
  const d = dimsOf(container.type);
  switch (face) {
    case 'sideA':
    case 'sideB':
      return d.length * d.height;
    case 'endA':
    case 'endB':
      return d.width * d.height;
    case 'roof':
      return d.length * d.width;
  }
}
