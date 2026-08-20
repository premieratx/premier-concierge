import type { Decor } from '../types';
import { type GeneratorResult, type Rect, gid, headingOf, rectEdges } from './common';

export interface BatterOptions {
  /** Panel thickness at the wall face, in feet. */
  thickness?: number;
  idPrefix?: string;
}

/**
 * Sloped plinth around the base of a wall.
 *
 * This element does most of the work of "massive" for almost no money — a
 * 1-in-6 batter over the bottom eight feet reads as a fortification wall
 * rather than as a box sitting on dirt, and it is stone veneer over light
 * framing, not structure.
 */
export function generateBatter(
  footprint: Rect,
  slope = 1 / 6,
  height = 8,
  options: BatterOptions = {},
): GeneratorResult {
  const thickness = options.thickness ?? 1.25;
  const prefix = options.idPrefix ?? 'batter';
  const tilt = Math.atan(slope);
  const kickOut = slope * height;

  const decor: Decor[] = rectEdges(footprint, 0).map((edge, i) => {
    const dx = edge.to.x - edge.from.x;
    const dz = edge.to.z - edge.from.z;
    const run = Math.hypot(dx, dz);
    const ux = dx / run;
    const uz = dz / run;
    // Outward normal of a clockwise rectangle edge.
    const nx = -uz;
    const nz = ux;
    const slopedHeight = height / Math.cos(tilt);
    return {
      id: gid(prefix, 'panel', i),
      kind: 'batter' as const,
      center: {
        x: edge.from.x + ux * (run / 2) + nx * (kickOut / 2),
        y: height / 2,
        z: edge.from.z + uz * (run / 2) + nz * (kickOut / 2),
      },
      // Local X runs along the wall, local Y up the slope face.
      size: { x: run + kickOut, y: slopedHeight, z: thickness },
      rotationY: headingOf(dx, dz),
      slope: tilt,
      finish: 'stone' as const,
    };
  });

  return { containers: [], decor };
}

/** Square feet of stone veneer a batter of this footprint will need. */
export function batterVeneerSqFt(footprint: Rect, slope = 1 / 6, height = 8): number {
  const perimeter = 2 * (footprint.sizeX + footprint.sizeZ);
  return perimeter * (height / Math.cos(Math.atan(slope)));
}
