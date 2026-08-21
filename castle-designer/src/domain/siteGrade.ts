import { ENCEINTE } from './property';
import { offsetConvexPolygon, planEnceinte, type EnceinteBasin } from './generators/enceinte';
import { finishedGrade } from './terrain';
import type { Point2 } from './types';

/**
 * Grade with the moat cut into it.
 *
 * `finishedGrade` is the terraced ground the buildings sit on, and it has to
 * stay that way: the moat is dug from it, so anything that asks how deep the
 * moat is has to ask before the digging. This module is the one that answers
 * afterwards, and it is what the terrain mesh, the contours and the walk
 * camera use — so the trench is a real hole in the ground rather than a blue
 * ribbon lying on the grass.
 */

const PLAN = planEnceinte(ENCEINTE);

/** Batter on the moat sides: how far in from the bank the bed is reached. */
const BATTER_FT = 7;

const OUTER: Point2[] = offsetConvexPolygon(
  PLAN.vertices,
  ENCEINTE.bermFt + ENCEINTE.wallThicknessFt / 2 + ENCEINTE.moatWidthFt,
);
const INNER: Point2[] = offsetConvexPolygon(
  PLAN.vertices,
  ENCEINTE.bermFt + ENCEINTE.wallThicknessFt / 2,
);

/**
 * Distance from a point to the boundary of a convex polygon: positive inside,
 * negative outside. For a convex ring this is just the smallest of the six
 * edge distances, which is exact and costs nothing.
 */
function signedDistance(polygon: Point2[], x: number, z: number): number {
  const n = polygon.length;
  const centroid = polygon.reduce(
    (acc, p) => ({ x: acc.x + p.x / n, z: acc.z + p.z / n }),
    { x: 0, z: 0 },
  );
  let smallest = Infinity;
  for (let i = 0; i < n; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % n]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    let nx = -dz / len;
    let nz = dx / len;
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    if (nx * (mid.x - centroid.x) + nz * (mid.z - centroid.z) < 0) {
      nx = -nx;
      nz = -nz;
    }
    // Negative outward distance means inside.
    smallest = Math.min(smallest, -((x - a.x) * nx + (z - a.z) * nz));
  }
  return smallest;
}

/** Which basin a point in the trench belongs to: the one it is nearest. */
function basinAt(x: number, z: number): EnceinteBasin {
  let best = PLAN.basins[0]!;
  let bestDistance = Infinity;
  for (const basin of PLAN.basins) {
    const mid = {
      x: (basin.inner[0]!.x + basin.inner[1]!.x) / 2,
      z: (basin.inner[0]!.z + basin.inner[1]!.z) / 2,
    };
    const d = Math.hypot(x - mid.x, z - mid.z);
    if (d < bestDistance) {
      bestDistance = d;
      best = basin;
    }
  }
  return best;
}

/** True where the moat has been dug. */
export function inMoat(x: number, z: number): boolean {
  return signedDistance(OUTER, x, z) > 0 && signedDistance(INNER, x, z) < 0;
}

/**
 * Ground with the trench in it.
 *
 * The sides batter rather than dropping vertically, both because that is how a
 * moat is actually cut and because a vertical face on a five-foot terrain grid
 * turns into a staircase.
 */
export function siteGrade(x: number, z: number): number {
  const outward = signedDistance(OUTER, x, z);
  const inward = -signedDistance(INNER, x, z);
  if (outward <= 0 || inward <= 0) return finishedGrade(x, z);

  const fromBank = Math.min(outward, inward);
  const basin = basinAt(x, z);
  const grade = finishedGrade(x, z);
  // Cut where the ground is above the bed and fill where it is below: a basin
  // has to have a floor, and on this hill half of every run is fill.
  const t = Math.min(1, fromBank / BATTER_FT);
  return grade + (basin.bedY - grade) * t;
}

export { PLAN as ENCEINTE_PLAN };
