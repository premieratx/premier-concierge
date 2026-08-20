import type { Container, Decor, Finish } from '../types';

export interface GeneratorResult {
  containers: Container[];
  decor: Decor[];
}

export function merge(...results: GeneratorResult[]): GeneratorResult {
  return {
    containers: results.flatMap((r) => r.containers),
    decor: results.flatMap((r) => r.decor),
  };
}

/** A plan rectangle, given by its minimum corner and extents. */
export interface Rect {
  x: number;
  z: number;
  sizeX: number;
  sizeZ: number;
}

/** A horizontal line at elevation `y`, used to place a run of crenellation. */
export interface Edge {
  from: { x: number; z: number };
  to: { x: number; z: number };
  y: number;
}

/** The four edges of a rectangle, running clockwise from the -X/-Z corner. */
export function rectEdges(rect: Rect, y: number): Edge[] {
  const x0 = rect.x;
  const z0 = rect.z;
  const x1 = rect.x + rect.sizeX;
  const z1 = rect.z + rect.sizeZ;
  return [
    { from: { x: x0, z: z0 }, to: { x: x1, z: z0 }, y },
    { from: { x: x1, z: z0 }, to: { x: x1, z: z1 }, y },
    { from: { x: x1, z: z1 }, to: { x: x0, z: z1 }, y },
    { from: { x: x0, z: z1 }, to: { x: x0, z: z0 }, y },
  ];
}

export function rectCorners(rect: Rect): { x: number; z: number }[] {
  return [
    { x: rect.x, z: rect.z },
    { x: rect.x + rect.sizeX, z: rect.z },
    { x: rect.x + rect.sizeX, z: rect.z + rect.sizeZ },
    { x: rect.x, z: rect.z + rect.sizeZ },
  ];
}

export interface CommonOptions {
  /** Prefix for generated ids so two calls never collide. */
  idPrefix?: string;
  finish?: Finish;
}

let seq = 0;

/** Deterministic-enough ids for generated geometry. */
export function gid(prefix: string, ...parts: (string | number)[]): string {
  seq += 1;
  return [prefix, ...parts, seq].join('-');
}

export function resetGeneratorIds(): void {
  seq = 0;
}

export function container(
  partial: Omit<Container, 'openings'> & { openings?: Container['openings'] },
): Container {
  return { openings: [], ...partial };
}

/**
 * Y rotation that points a box's local +X axis along (dx, dz).
 *
 * Rotating by theta about Y sends local +X to (cos t, 0, -sin t), so the
 * heading we want is atan2(-dz, dx).
 */
export function headingOf(dx: number, dz: number): number {
  // Adding zero collapses negative zero, which JSON cannot represent and
  // which would otherwise make a serialise/deserialise round trip unequal.
  return Math.atan2(-dz, dx) + 0;
}

export function lengthOf(dx: number, dz: number): number {
  return Math.hypot(dx, dz);
}
