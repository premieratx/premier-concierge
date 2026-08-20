import type { Decor, Vec3 } from '../types';
import { type GeneratorResult, gid } from './common';

export interface BartizanOptions {
  /** Corbelled base under the turret, in feet. */
  corbelHeight?: number;
  /** Conical cap height, in feet. */
  capHeight?: number;
  idPrefix?: string;
}

/**
 * Overhanging corner turret. Purely decorative here — a real one is a few
 * hundred pounds of steel bracket hung off the corner castings, which is a
 * rounding error next to the welding budget, so it does not get a container.
 */
export function generateBartizan(
  corner: Vec3,
  radius = 4,
  height = 12,
  options: BartizanOptions = {},
): GeneratorResult {
  const corbelHeight = options.corbelHeight ?? 3;
  const capHeight = options.capHeight ?? 7;
  const prefix = options.idPrefix ?? 'bartizan';

  const decor: Decor[] = [
    {
      id: gid(prefix, 'corbel'),
      kind: 'bartizan',
      center: { x: corner.x, y: corner.y - corbelHeight / 2, z: corner.z },
      size: { x: radius * 2, y: corbelHeight, z: radius * 2 },
      radius: radius * 0.55,
    },
    {
      id: gid(prefix, 'drum'),
      kind: 'bartizan',
      center: { x: corner.x, y: corner.y + height / 2, z: corner.z },
      size: { x: radius * 2, y: height, z: radius * 2 },
      radius,
    },
    {
      id: gid(prefix, 'cap'),
      kind: 'conicalRoof',
      center: { x: corner.x, y: corner.y + height + capHeight / 2, z: corner.z },
      size: { x: radius * 2.3, y: capHeight, z: radius * 2.3 },
      radius: radius * 1.15,
    },
  ];

  return { containers: [], decor };
}
