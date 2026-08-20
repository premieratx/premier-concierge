import type { Decor } from '../types';
import { type Edge, type GeneratorResult, gid, headingOf, lengthOf } from './common';

export interface CrenellationOptions {
  /** Merlon width in feet. Three feet is what reads as "castle". */
  merlonW?: number;
  /** Gap width in feet. Match the merlon width. */
  gapW?: number;
  /** Merlon height above the wall head, in feet. */
  height?: number;
  /** Thickness through the wall, in feet. */
  thickness?: number;
  /** Height of the solid parapet the merlons sit on, in feet. */
  parapetHeight?: number;
  idPrefix?: string;
}

/**
 * The toothed parapet. This is the single element that makes a stack of
 * shipping containers read as a castle from three hundred yards away, so it
 * gets the sizing the eye expects: 3-foot merlons, 4 feet tall, 3-foot gaps.
 */
export function generateCrenellation(
  edge: Edge,
  merlonW = 3,
  gapW = 3,
  height = 4,
  options: CrenellationOptions = {},
): GeneratorResult {
  const thickness = options.thickness ?? 1.5;
  const parapetHeight = options.parapetHeight ?? 1;
  const prefix = options.idPrefix ?? 'cren';

  const dx = edge.to.x - edge.from.x;
  const dz = edge.to.z - edge.from.z;
  const run = lengthOf(dx, dz);
  if (run <= 0) return { containers: [], decor: [] };

  const ux = dx / run;
  const uz = dz / run;
  const rotationY = headingOf(dx, dz);

  const decor: Decor[] = [
    {
      id: gid(prefix, 'parapet'),
      kind: 'parapet',
      center: {
        x: edge.from.x + ux * (run / 2),
        y: edge.y + parapetHeight / 2,
        z: edge.from.z + uz * (run / 2),
      },
      size: { x: run, y: parapetHeight, z: thickness },
      rotationY,
    },
  ];

  // Fit whole merlons and centre the run so both ends read as a tooth.
  const pitch = merlonW + gapW;
  const count = Math.max(1, Math.floor((run + gapW) / pitch));
  const used = count * pitch - gapW;
  const margin = (run - used) / 2;

  for (let i = 0; i < count; i++) {
    const start = margin + i * pitch;
    const centreAlong = start + merlonW / 2;
    decor.push({
      id: gid(prefix, 'merlon', i),
      kind: 'merlon',
      center: {
        x: edge.from.x + ux * centreAlong,
        y: edge.y + parapetHeight + height / 2,
        z: edge.from.z + uz * centreAlong,
      },
      size: { x: merlonW, y: height, z: thickness },
      rotationY,
    });
  }

  return { containers: [], decor };
}

/** Number of merlons a run of the given length will fit. */
export function merlonCount(runFt: number, merlonW = 3, gapW = 3): number {
  if (runFt <= 0) return 0;
  return Math.max(1, Math.floor((runFt + gapW) / (merlonW + gapW)));
}
