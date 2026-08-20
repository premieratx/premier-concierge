import type { Decor } from '../types';
import { gid } from './common';

/**
 * Site lighting: the fixtures that make the property navigable after dark,
 * as opposed to the festoon runs and the fire, which make it look like
 * something is happening.
 */

export interface PoleLightRun {
  from: { x: number; z: number };
  to: { x: number; z: number };
  spacingFt: number;
  heightFt: number;
}

export function generatePoleLights(run: PoleLightRun, key: string): Decor[] {
  const dx = run.to.x - run.from.x;
  const dz = run.to.z - run.from.z;
  const span = Math.hypot(dx, dz);
  const count = Math.max(1, Math.round(span / run.spacingFt));
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count;
    return {
      id: gid('pole', key, i),
      kind: 'poleLight' as const,
      center: {
        x: run.from.x + dx * t,
        y: run.heightFt / 2,
        z: run.from.z + dz * t,
      },
      size: { x: 0.45, y: run.heightFt, z: 0.45 },
      layer: 'areaLighting' as const,
    };
  });
}

export function generateBollards(
  from: { x: number; z: number },
  to: { x: number; z: number },
  spacingFt: number,
  key: string,
): Decor[] {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const span = Math.hypot(dx, dz);
  const count = Math.max(1, Math.round(span / spacingFt));
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count;
    return {
      id: gid('bollard', key, i),
      kind: 'bollard' as const,
      center: { x: from.x + dx * t, y: 1.6, z: from.z + dz * t },
      size: { x: 0.7, y: 3.2, z: 0.7 },
      layer: 'areaLighting' as const,
    };
  });
}

/** Ground-mounted uplights washing a wall face. */
export function generateUplights(
  from: { x: number; z: number },
  to: { x: number; z: number },
  spacingFt: number,
  key: string,
): Decor[] {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const span = Math.hypot(dx, dz);
  const count = Math.max(1, Math.round(span / spacingFt));
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count;
    return {
      id: gid('uplight', key, i),
      kind: 'uplight' as const,
      center: { x: from.x + dx * t, y: 0.5, z: from.z + dz * t },
      size: { x: 1.2, y: 1, z: 1.2 },
      layer: 'areaLighting' as const,
    };
  });
}

export interface SiteLightingSpec {
  /** Outer footprint of the castle compound, for the wall wash. */
  compound: { x: number; z: number; sizeX: number; sizeZ: number };
  /** The path from the gate down to the gangway. */
  gateToDock: { from: { x: number; z: number }; to: { x: number; z: number } };
  /** Perimeter of the arrival lawn, for the pole lights. */
  lawn: { x: number; z: number; sizeX: number; sizeZ: number };
  /** The approach drive. */
  drive: { from: { x: number; z: number }; to: { x: number; z: number } };
}

export function generateSiteLighting(spec: SiteLightingSpec): Decor[] {
  const out: Decor[] = [];
  const { lawn, compound } = spec;

  // Poles down both long sides of the lawn.
  out.push(
    ...generatePoleLights(
      {
        from: { x: lawn.x, z: lawn.z },
        to: { x: lawn.x + lawn.sizeX, z: lawn.z },
        spacingFt: 70,
        heightFt: 22,
      },
      'lawn-n',
    ),
    ...generatePoleLights(
      {
        from: { x: lawn.x, z: lawn.z + lawn.sizeZ },
        to: { x: lawn.x + lawn.sizeX, z: lawn.z + lawn.sizeZ },
        spacingFt: 70,
        heightFt: 22,
      },
      'lawn-s',
    ),
    ...generatePoleLights({ ...spec.drive, spacingFt: 80, heightFt: 20 }, 'drive'),
  );

  // Bollards either side of the walk from the gate to the water.
  for (const [i, offset] of [-7, 7].entries()) {
    out.push(
      ...generateBollards(
        { x: spec.gateToDock.from.x + offset, z: spec.gateToDock.from.z },
        { x: spec.gateToDock.to.x + offset, z: spec.gateToDock.to.z },
        22,
        `walk-${i}`,
      ),
    );
  }

  // Uplights washing the water-facing curtain wall and the two long flanks.
  const zFace = compound.z + compound.sizeZ + 6;
  out.push(
    ...generateUplights(
      { x: compound.x, z: zFace },
      { x: compound.x + compound.sizeX, z: zFace },
      26,
      'curtain',
    ),
    ...generateUplights(
      { x: compound.x - 6, z: compound.z },
      { x: compound.x - 6, z: compound.z + compound.sizeZ },
      34,
      'west',
    ),
    ...generateUplights(
      { x: compound.x + compound.sizeX + 6, z: compound.z },
      { x: compound.x + compound.sizeX + 6, z: compound.z + compound.sizeZ },
      34,
      'east',
    ),
  );

  return out;
}
