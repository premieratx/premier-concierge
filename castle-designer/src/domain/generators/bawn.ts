import { dimsOf } from '../dimensions';
import type { Container, ContainerType, Decor } from '../types';
import { type GeneratorResult, type Rect, gid, merge } from './common';
import { generateCrenellation } from './crenellation';

export type BawnSide = 'north' | 'south' | 'east' | 'west';

export interface BawnOptions {
  containerType?: ContainerType;
  crenellate?: boolean;
  /** Leave a gap for the gatehouse on this side. */
  gateSide?: BawnSide;
  /** How wide the gate gap is, in container bays. */
  gateBays?: number;
  finish?: Container['finish'];
  role?: Container['role'];
  idPrefix?: string;
}

/**
 * The bawn: the courtyard curtain wall.
 *
 * Containers laid end to end around the perimeter, one or more levels high.
 * Corner towers are generated separately and sit outside this footprint, so
 * the runs here are inset on the Z sides to keep the corners clear.
 */
export function generateBawn(
  perimeter: Rect,
  wallHeightLevels = 1,
  options: BawnOptions = {},
): GeneratorResult {
  const type = options.containerType ?? '40HC';
  const d = dimsOf(type);
  const prefix = options.idPrefix ?? 'bawn';
  const role = options.role ?? 'structural';
  const finish = options.finish ?? 'stone';

  const containers: Container[] = [];
  const decor: Decor[] = [];
  const wallHeight = wallHeightLevels * d.height;

  const baysX = Math.max(1, Math.floor(perimeter.sizeX / d.length));
  // The Z runs stop short of the X runs so the corners do not double up.
  const innerSizeZ = perimeter.sizeZ - 2 * d.width;
  const baysZ = Math.max(0, Math.floor(innerSizeZ / d.length));

  const gateSide = options.gateSide;
  const gateBays = options.gateBays ?? 1;

  /** Bay indices left open for the gate, centred on the run. */
  function gateGap(side: BawnSide, bayCount: number): Set<number> {
    if (side !== gateSide || bayCount === 0) return new Set();
    const start = Math.max(0, Math.floor((bayCount - gateBays) / 2));
    return new Set(Array.from({ length: gateBays }, (_, i) => start + i));
  }

  const northGap = gateGap('north', baysX);
  const southGap = gateGap('south', baysX);
  const westGap = gateGap('west', baysZ);
  const eastGap = gateGap('east', baysZ);

  function run(
    side: BawnSide,
    bayCount: number,
    gap: Set<number>,
    at: (bay: number, level: number) => { x: number; y: number; z: number },
    rotation: 0 | 90,
  ) {
    for (let level = 0; level < wallHeightLevels; level++) {
      for (let bay = 0; bay < bayCount; bay++) {
        if (gap.has(bay)) continue;
        containers.push({
          id: gid(prefix, side, 'l', level, 'b', bay),
          type,
          position: at(bay, level),
          rotation,
          role,
          finish,
          openings: [],
          label: `Bawn ${side} L${level + 1} bay ${bay + 1}`,
        });
      }
    }
  }

  const zNorth = perimeter.z;
  const zSouth = perimeter.z + perimeter.sizeZ - d.width;
  const xWest = perimeter.x;
  const xEast = perimeter.x + perimeter.sizeX - d.width;
  const zInner = perimeter.z + d.width;

  run('north', baysX, northGap, (bay, level) => ({
    x: perimeter.x + bay * d.length,
    y: level * d.height,
    z: zNorth,
  }), 0);

  run('south', baysX, southGap, (bay, level) => ({
    x: perimeter.x + bay * d.length,
    y: level * d.height,
    z: zSouth,
  }), 0);

  run('west', baysZ, westGap, (bay, level) => ({
    x: xWest,
    y: level * d.height,
    z: zInner + bay * d.length,
  }), 90);

  run('east', baysZ, eastGap, (bay, level) => ({
    x: xEast,
    y: level * d.height,
    z: zInner + bay * d.length,
  }), 90);

  const parts: GeneratorResult[] = [{ containers, decor }];

  if (options.crenellate ?? true) {
    const runs: { side: BawnSide; from: { x: number; z: number }; to: { x: number; z: number } }[] = [
      {
        side: 'north',
        from: { x: perimeter.x, z: zNorth + d.width / 2 },
        to: { x: perimeter.x + baysX * d.length, z: zNorth + d.width / 2 },
      },
      {
        side: 'south',
        from: { x: perimeter.x, z: zSouth + d.width / 2 },
        to: { x: perimeter.x + baysX * d.length, z: zSouth + d.width / 2 },
      },
      {
        side: 'west',
        from: { x: xWest + d.width / 2, z: zInner },
        to: { x: xWest + d.width / 2, z: zInner + baysZ * d.length },
      },
      {
        side: 'east',
        from: { x: xEast + d.width / 2, z: zInner },
        to: { x: xEast + d.width / 2, z: zInner + baysZ * d.length },
      },
    ];
    for (const r of runs) {
      if (r.from.x === r.to.x && r.from.z === r.to.z) continue;
      parts.push(
        generateCrenellation({ from: r.from, to: r.to, y: wallHeight }, 3, 3, 4, {
          idPrefix: `${prefix}-${r.side}-cren`,
        }),
      );

      // The wall walk behind the parapet. Architecturally the whole reason to
      // crenellate, and structurally a crowd standing on a container roof —
      // which rule R6 has an opinion about, correctly.
      const dx = r.to.x - r.from.x;
      const dz = r.to.z - r.from.z;
      const run = Math.hypot(dx, dz);
      const alongX = Math.abs(dx) > Math.abs(dz);
      const inboard = r.side === 'north' ? 1 : r.side === 'south' ? -1 : r.side === 'west' ? 1 : -1;
      decor.push({
        id: gid(prefix, r.side, 'walk'),
        kind: 'walkway',
        center: {
          x: (r.from.x + r.to.x) / 2 + (alongX ? 0 : inboard * 1.6),
          y: wallHeight + 0.25,
          z: (r.from.z + r.to.z) / 2 + (alongX ? inboard * 1.6 : 0),
        },
        size: alongX ? { x: run, y: 0.5, z: 4.8 } : { x: 4.8, y: 0.5, z: run },
      });
    }
  }

  if (gateSide) {
    const alongX = gateSide === 'north' || gateSide === 'south';
    const bayCount = alongX ? baysX : baysZ;
    const gap = alongX ? (gateSide === 'north' ? northGap : southGap) : gateSide === 'west' ? westGap : eastGap;
    const first = Math.min(...gap);
    const width = gateBays * d.length;
    const centreAlong = (first + gateBays / 2) * d.length;
    const center = alongX
      ? {
          x: perimeter.x + centreAlong,
          y: 7,
          z: (gateSide === 'north' ? zNorth : zSouth) + d.width / 2,
        }
      : {
          x: (gateSide === 'west' ? xWest : xEast) + d.width / 2,
          y: 7,
          z: zInner + centreAlong,
        };
    if (bayCount > 0 && Number.isFinite(first)) {
      decor.push({
        id: gid(prefix, 'gate'),
        kind: 'gate',
        center,
        size: alongX ? { x: width * 0.55, y: 14, z: 1.2 } : { x: 1.2, y: 14, z: width * 0.55 },
      });
    }
  }

  return merge(...parts);
}
