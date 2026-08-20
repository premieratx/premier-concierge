import { useMemo } from 'react';
import * as THREE from 'three';
import {
  CONTOUR_INTERVAL_FT,
  PARCEL,
  TERRACES,
  finishedGrade,
} from '../domain/terrain';

/**
 * Elevation contours, pulled straight off the height model by marching
 * squares.
 *
 * Ten-foot intervals over the parcel. Where the lines bunch, the ground is
 * steep; where they run straight and parallel across a rectangle, that is a
 * cut pad. It is the fastest way to see whether a building is sitting on the
 * hill or fighting it.
 */
function buildContours(step: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const lift = 0.6;

  const nx = Math.round(PARCEL.sizeX / step);
  const nz = Math.round(PARCEL.sizeZ / step);

  // Sample once; marching squares then walks the same grid for every level.
  const heights = new Float32Array((nx + 1) * (nz + 1));
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= nz; j++) {
      heights[i * (nz + 1) + j] = finishedGrade(
        PARCEL.minX + i * step,
        PARCEL.minZ + j * step,
      );
    }
  }
  const at = (i: number, j: number) => heights[i * (nz + 1) + j] ?? 0;

  /** Where along an edge the contour crosses, as a world point. */
  const cross = (
    x1: number,
    z1: number,
    h1: number,
    x2: number,
    z2: number,
    h2: number,
    level: number,
  ): [number, number] => {
    const t = Math.abs(h2 - h1) < 1e-6 ? 0.5 : (level - h1) / (h2 - h1);
    return [x1 + (x2 - x1) * t, z1 + (z2 - z1) * t];
  };

  let maxHeight = 0;
  for (let k = 0; k < heights.length; k++) maxHeight = Math.max(maxHeight, heights[k] ?? 0);

  for (let level = CONTOUR_INTERVAL_FT; level < maxHeight; level += CONTOUR_INTERVAL_FT) {
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const x0 = PARCEL.minX + i * step;
        const z0 = PARCEL.minZ + j * step;
        const x1 = x0 + step;
        const z1 = z0 + step;

        const h00 = at(i, j);
        const h10 = at(i + 1, j);
        const h11 = at(i + 1, j + 1);
        const h01 = at(i, j + 1);

        // Corner-by-corner: which are above the level.
        const code =
          (h00 > level ? 1 : 0) |
          (h10 > level ? 2 : 0) |
          (h11 > level ? 4 : 0) |
          (h01 > level ? 8 : 0);
        if (code === 0 || code === 15) continue;

        const edges: [number, number][] = [];
        if ((code & 1) !== (code & 2) >> 1) edges.push(cross(x0, z0, h00, x1, z0, h10, level));
        if ((code & 2) >> 1 !== (code & 4) >> 2) edges.push(cross(x1, z0, h10, x1, z1, h11, level));
        if ((code & 4) >> 2 !== (code & 8) >> 3) edges.push(cross(x1, z1, h11, x0, z1, h01, level));
        if ((code & 8) >> 3 !== (code & 1)) edges.push(cross(x0, z1, h01, x0, z0, h00, level));

        // Two crossings make one segment; four make the ambiguous saddle,
        // which is drawn as two segments in grid order and is close enough at
        // this interval.
        for (let e = 0; e + 1 < edges.length; e += 2) {
          const a = edges[e]!;
          const b = edges[e + 1]!;
          positions.push(a[0], level + lift, a[1], b[0], level + lift, b[1]);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

export function Contours({ step = 10 }: { step?: number }) {
  const geometry = useMemo(() => buildContours(step), [step]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#d9c98a" transparent opacity={0.4} />
    </lineSegments>
  );
}

/** The cut pads, drawn as outlines so you can see what was engineered. */
export function TerraceOutlines() {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    for (const t of TERRACES) {
      const y = t.elevation + 0.8;
      const { x, z, sizeX, sizeZ } = t.rect;
      const corners: [number, number][] = [
        [x, z],
        [x + sizeX, z],
        [x + sizeX, z + sizeZ],
        [x, z + sizeZ],
      ];
      for (let i = 0; i < 4; i++) {
        const a = corners[i]!;
        const b = corners[(i + 1) % 4]!;
        positions.push(a[0], y, a[1], b[0], y, b[1]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, []);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#5ad1ff" transparent opacity={0.75} />
    </lineSegments>
  );
}
