import { dimsOf, SNAP_ACROSS_FT, SNAP_ALONG_FT } from './dimensions';
import type { Container, ContainerType, Rotation, Vec3 } from './types';

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
  return Math.round(value / step) * step;
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
