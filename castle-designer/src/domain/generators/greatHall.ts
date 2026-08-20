import { dimsOf } from '../dimensions';
import type { Container, ContainerType, Decor } from '../types';
import { type GeneratorResult, gid, merge } from './common';
import { generateCrenellation } from './crenellation';

export interface GreatHallOptions {
  /** Minimum corner of the west wall's footprint. */
  origin?: { x: number; z: number };
  containerType?: ContainerType;
  crenellate?: boolean;
  /** Feet between truss bays. */
  trussSpacingFt?: number;
  finish?: Container['finish'];
  idPrefix?: string;
}

/**
 * Beyond this the truss depth, the crane pick and the connection detail all
 * jump a tier, and the roof stops being a line item and starts being a
 * project. The rule checker warns past it.
 */
export const HALL_SPAN_WARN_FT = 50;
export const HALL_SPAN_COMFORTABLE_FT = 40;

/**
 * The great hall: two parallel container walls with an open span between them
 * and a truss roof over the top.
 *
 * The whole point is that the hall is the space *between* intact containers,
 * not a row of containers with their side walls cut away. A hollowed-out row
 * of the same footprint would need a welded tube-steel frame at every removed
 * wall, which is where the welding budget goes to die. Keeping the boxes
 * intact spends the money on a truss instead, which is bought, not welded on
 * site.
 */
export function generateGreatHall(
  spanFt: number,
  lengthFt: number,
  wallHeightLevels: number,
  options: GreatHallOptions = {},
): GeneratorResult {
  const type = options.containerType ?? '40HC';
  const d = dimsOf(type);
  const origin = options.origin ?? { x: 0, z: 0 };
  const prefix = options.idPrefix ?? 'hall';
  const bays = Math.max(1, Math.round(lengthFt / d.length));
  const actualLength = bays * d.length;
  const wallHeight = wallHeightLevels * d.height;

  const containers: Container[] = [];
  // Wall A sits at z = origin.z; wall B is pushed out by the clear span plus
  // wall A's own depth, so `spanFt` really is the clear dimension inside.
  const wallZ = [origin.z, origin.z + d.width + spanFt];

  for (const [wallIndex, z] of wallZ.entries()) {
    for (let level = 0; level < wallHeightLevels; level++) {
      for (let bay = 0; bay < bays; bay++) {
        containers.push({
          id: gid(prefix, 'w', wallIndex, 'l', level, 'b', bay),
          type,
          position: { x: origin.x + bay * d.length, y: level * d.height, z },
          rotation: 0,
          role: 'wall',
          finish: options.finish ?? 'stone',
          openings: [],
          label: `Hall wall ${wallIndex === 0 ? 'W' : 'E'} L${level + 1} bay ${bay + 1}`,
        });
      }
    }
  }

  // Truss bays across the clear span, bearing on the wall heads.
  const spacing = options.trussSpacingFt ?? 10;
  const trussCount = Math.max(2, Math.round(actualLength / spacing) + 1);
  const decor: Decor[] = [];
  const clearZ0 = origin.z + d.width;
  const trussDepth = Math.max(2.5, spanFt / 14);
  for (let i = 0; i < trussCount; i++) {
    const x = origin.x + (actualLength * i) / (trussCount - 1);
    decor.push({
      id: gid(prefix, 'truss', i),
      kind: 'truss',
      center: {
        x,
        y: wallHeight + trussDepth / 2,
        z: clearZ0 + spanFt / 2,
      },
      size: { x: 0.9, y: trussDepth, z: spanFt },
    });
  }

  const parts: GeneratorResult[] = [{ containers, decor }];

  if (options.crenellate ?? true) {
    for (const [wallIndex, z] of wallZ.entries()) {
      parts.push(
        generateCrenellation(
          {
            from: { x: origin.x, z: z + d.width / 2 },
            to: { x: origin.x + actualLength, z: z + d.width / 2 },
            y: wallHeight,
          },
          3,
          3,
          4,
          { idPrefix: `${prefix}-cren-${wallIndex}` },
        ),
      );
    }
  }

  return merge(...parts);
}

export interface HallMetrics {
  spanFt: number;
  lengthFt: number;
  /** Clear floor area under the truss roof. */
  clearSqFt: number;
  trussRoofSqFt: number;
  overSpan: boolean;
}

export function hallMetrics(
  spanFt: number,
  lengthFt: number,
  containerType: ContainerType = '40HC',
): HallMetrics {
  const d = dimsOf(containerType);
  const bays = Math.max(1, Math.round(lengthFt / d.length));
  const actualLength = bays * d.length;
  return {
    spanFt,
    lengthFt: actualLength,
    clearSqFt: spanFt * actualLength,
    // The roof laps onto both wall heads.
    trussRoofSqFt: (spanFt + 2 * d.width) * actualLength,
    overSpan: spanFt > HALL_SPAN_WARN_FT,
  };
}
