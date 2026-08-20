import type { Decor, SiteFeature, Vec3 } from '../types';
import { featuresOfKind } from '../types';
import { gid } from './common';

/**
 * Furniture.
 *
 * It is here because it is a real line item and a real capacity constraint,
 * not set dressing: fifteen square feet per person at a table is what turns a
 * great hall into a seated four hundred, and a premier slip without loungers
 * on it is just a berth.
 */

export interface BanquetSpec {
  /** Centre of the seated area. */
  center: { x: number; z: number };
  /** Deck or floor level the furniture stands on. */
  y: number;
  /** Rows of tables running along X. */
  rowZ: number[];
  tablesPerRow: number;
  tableLengthFt: number;
  tableWidthFt: number;
  /** Total run the row spans along X. */
  runFt: number;
}

const TABLE_HEIGHT = 2.5;
const CHAIR_HEIGHT = 1.6;

function table(id: string, at: Vec3, lengthFt: number, widthFt: number): Decor {
  return {
    id,
    kind: 'table',
    center: { x: at.x, y: at.y + TABLE_HEIGHT / 2, z: at.z },
    size: { x: lengthFt, y: TABLE_HEIGHT, z: widthFt },
    layer: 'furniture',
  };
}

function chair(id: string, at: Vec3, rotationY = 0): Decor {
  return {
    id,
    kind: 'chair',
    center: { x: at.x, y: at.y + CHAIR_HEIGHT / 2, z: at.z },
    size: { x: 1.6, y: CHAIR_HEIGHT, z: 1.6 },
    rotationY,
    layer: 'furniture',
  };
}

/** Trestle tables with chairs either side — the great hall seated. */
export function generateBanquet(spec: BanquetSpec): Decor[] {
  const out: Decor[] = [];
  const pitch = spec.runFt / spec.tablesPerRow;

  for (const [r, z] of spec.rowZ.entries()) {
    for (let i = 0; i < spec.tablesPerRow; i++) {
      const x = spec.center.x - spec.runFt / 2 + pitch * (i + 0.5);
      out.push(table(gid('banquet', r, i), { x, y: spec.y, z }, spec.tableLengthFt, spec.tableWidthFt));
      // Four seats a side, which is what an eight-foot trestle takes.
      for (const side of [-1, 1]) {
        for (let seat = 0; seat < 4; seat++) {
          const sx = x - spec.tableLengthFt / 2 + (spec.tableLengthFt * (seat + 0.5)) / 4;
          out.push(
            chair(gid('banquet', r, i, side, seat), {
              x: sx,
              y: spec.y,
              z: z + side * (spec.tableWidthFt / 2 + 1.4),
            }),
          );
        }
      }
    }
  }
  return out;
}

/** A ring of chairs round a fire pit, pulled back to a comfortable distance. */
export function generateFirePitSeating(
  center: { x: number; z: number },
  y: number,
  pitRadiusFt: number,
  seats = 8,
  key = 'pit',
): Decor[] {
  const radius = pitRadiusFt + 4.5;
  return Array.from({ length: seats }, (_, i) => {
    const angle = (i / seats) * Math.PI * 2;
    return chair(
      gid('firepitseat', key, i),
      { x: center.x + Math.cos(angle) * radius, y, z: center.z + Math.sin(angle) * radius },
      -angle + Math.PI / 2,
    );
  });
}

/**
 * The premier slip furniture package: two loungers, a table with four chairs
 * and an umbrella. This is the thing being rented, so it is modelled rather
 * than assumed.
 */
export function generatePatioFurniture(
  at: { x: number; y: number; z: number },
  key: string,
): Decor[] {
  const out: Decor[] = [];

  for (const [i, dz] of [-3.5, 3.5].entries()) {
    out.push({
      id: gid('lounger', key, i),
      kind: 'lounger',
      center: { x: at.x - 4, y: at.y + 0.8, z: at.z + dz },
      size: { x: 6.2, y: 1.5, z: 2.4 },
      layer: 'furniture',
    });
  }

  out.push(table(gid('patiotable', key), { x: at.x + 4, y: at.y, z: at.z }, 3.5, 3.5));
  for (const [i, [dx, dz]] of ([[-3, 0], [3, 0], [0, -3], [0, 3]] as const).entries()) {
    out.push(chair(gid('patiochair', key, i), { x: at.x + 4 + dx, y: at.y, z: at.z + dz }));
  }
  out.push({
    id: gid('umbrella', key),
    kind: 'umbrella',
    center: { x: at.x + 4, y: at.y + 4, z: at.z },
    size: { x: 9, y: 8, z: 9 },
    layer: 'furniture',
  });

  return out;
}

/** Cocktail tables on a deck. */
export function generateDeckFurniture(
  center: { x: number; y: number; z: number },
  widthFt: number,
  depthFt: number,
  count: number,
  key: string,
): Decor[] {
  const out: Decor[] = [];
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = center.x - widthFt / 2 + (widthFt * (col + 0.5)) / cols;
    const z = center.z - depthFt / 2 + (depthFt * (row + 0.5)) / rows;
    out.push(table(gid('decktable', key, i), { x, y: center.y, z }, 3, 3));
    for (const [j, [dx, dz]] of ([[-2.6, 0], [2.6, 0]] as const).entries()) {
      out.push(chair(gid('deckchair', key, i, j), { x: x + dx, y: center.y, z: z + dz }));
    }
  }
  return out;
}

/** A small table and two chairs on a cabin porch. */
export function generatePorchFurniture(
  at: { x: number; y: number; z: number },
  key: string,
): Decor[] {
  return [
    table(gid('porchtable', key), at, 3, 3),
    chair(gid('porchchair', key, 0), { x: at.x - 2.6, y: at.y, z: at.z }),
    chair(gid('porchchair', key, 1), { x: at.x + 2.6, y: at.y, z: at.z }),
  ];
}

export interface FurnishingContext {
  features: SiteFeature[];
  /** Minimum corners of the cabin containers, for the porch sets. */
  cabinPorches: { x: number; y: number; z: number }[];
  hall: BanquetSpec;
}

/** Every furniture set on the property. */
export function generateFurnishings(context: FurnishingContext): Decor[] {
  const out: Decor[] = [...generateBanquet(context.hall)];

  for (const [i, pit] of featuresOfKind(context.features, 'firePit').entries()) {
    out.push(
      ...generateFirePitSeating(
        { x: pit.position.x, z: pit.position.z },
        pit.position.y,
        pit.radiusFt,
        8,
        String(i),
      ),
    );
  }

  for (const slip of featuresOfKind(context.features, 'slip')) {
    if (!slip.furnished) continue;
    // Matches the deck the marina renderer draws at local [length * 0.28].
    out.push(
      ...generatePatioFurniture(
        {
          x: slip.position.x + slip.lengthFt * 0.28,
          y: slip.position.y + 3.5,
          z: slip.position.z,
        },
        slip.id,
      ),
    );
  }

  for (const dock of featuresOfKind(context.features, 'dock')) {
    if (dock.role !== 'platform') continue;
    out.push(
      ...generateDeckFurniture(
        { x: dock.position.x, y: dock.position.y + 0.4, z: dock.position.z },
        dock.lengthFt - 12,
        dock.widthFt - 8,
        6,
        dock.id,
      ),
    );
  }

  for (const [i, porch] of context.cabinPorches.entries()) {
    out.push(...generatePorchFurniture(porch, String(i)));
  }

  return out;
}
