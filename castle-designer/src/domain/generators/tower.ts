import { dimsOf } from '../dimensions';
import type { Container, ContainerType, Rotation } from '../types';
import { generateBartizan } from './bartizan';
import { type GeneratorResult, gid, merge, type Rect, rectEdges } from './common';
import { generateCrenellation } from './crenellation';

export interface TowerOptions {
  rotation?: Rotation;
  /** Crown the tower with a crenellated parapet. */
  crenellate?: boolean;
  /** Hang bartizans off the two outward corners. */
  bartizans?: boolean;
  bartizanRadius?: number;
  finish?: Container['finish'];
  role?: Container['role'];
  idPrefix?: string;
}

/**
 * Corner tower: two containers per level, shoulder to shoulder across their
 * width, stacked corner casting to corner casting so every level is a clean
 * load path down to the piers.
 *
 * (x, z) is the minimum corner of the tower footprint. At rotation 0 the
 * footprint is (container length) x 16 feet.
 */
export function generateTower(
  x: number,
  z: number,
  levels: number,
  containerType: ContainerType = '20ST',
  options: TowerOptions = {},
): GeneratorResult {
  const rotation = options.rotation ?? 0;
  const prefix = options.idPrefix ?? 'tower';
  const d = dimsOf(containerType);
  const containers: Container[] = [];

  const alongX = rotation === 0;
  const sizeX = alongX ? d.length : d.width * 2;
  const sizeZ = alongX ? d.width * 2 : d.length;

  for (let level = 0; level < levels; level++) {
    const y = level * d.height;
    for (let pair = 0; pair < 2; pair++) {
      containers.push({
        id: gid(prefix, 'l', level, 'p', pair),
        type: containerType,
        position: {
          x: alongX ? x : x + pair * d.width,
          y,
          z: alongX ? z + pair * d.width : z,
        },
        rotation,
        role: options.role ?? 'tower',
        finish: options.finish ?? 'stone',
        openings: [],
        layer: 'towers',
        label: `${prefix} L${level + 1}`,
      });
    }
  }

  const crownY = levels * d.height;
  const footprint: Rect = { x, z, sizeX, sizeZ };
  const parts: GeneratorResult[] = [{ containers, decor: [] }];

  if (options.crenellate ?? true) {
    for (const [i, edge] of rectEdges(footprint, crownY).entries()) {
      parts.push(
        generateCrenellation(edge, 3, 3, 4, { idPrefix: `${prefix}-crown-${i}` }),
      );
    }
  }

  if (options.bartizans ?? true) {
    const r = options.bartizanRadius ?? 4;
    const corners = [
      { x, z },
      { x: x + sizeX, z: z + sizeZ },
    ];
    for (const [i, corner] of corners.entries()) {
      parts.push(
        generateBartizan({ x: corner.x, y: crownY - 6, z: corner.z }, r, 11, {
          idPrefix: `${prefix}-bartizan-${i}`,
        }),
      );
    }
  }

  return merge(...parts);
}

/** Plan footprint a tower of this type and rotation will occupy. */
export function towerFootprint(
  x: number,
  z: number,
  containerType: ContainerType,
  rotation: Rotation = 0,
): Rect {
  const d = dimsOf(containerType);
  return rotation === 0
    ? { x, z, sizeX: d.length, sizeZ: d.width * 2 }
    : { x, z, sizeX: d.width * 2, sizeZ: d.length };
}
