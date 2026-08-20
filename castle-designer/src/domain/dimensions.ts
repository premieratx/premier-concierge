import type { ContainerType } from './types';

export interface ContainerDimensions {
  type: ContainerType;
  label: string;
  /** Feet, outside face to outside face along the long axis. */
  length: number;
  /** Feet, outside face to outside face across. Always 8' for ISO boxes. */
  width: number;
  /** Feet, grade to top of roof. */
  height: number;
  /** Pounds, empty. */
  tareLb: number;
  /** Square feet of usable interior floor after the corrugation. */
  usableSqFt: number;
}

/** 40' High Cube: 40'0" x 8'0" x 9'6". */
export const D40HC: ContainerDimensions = {
  type: '40HC',
  label: `40' High Cube`,
  length: 40,
  width: 8,
  height: 9.5,
  tareLb: 8600,
  usableSqFt: 305,
};

/** 20' Standard: 20'0" x 8'0" x 8'6". */
export const D20ST: ContainerDimensions = {
  type: '20ST',
  label: `20' Standard`,
  length: 20,
  width: 8,
  height: 8.5,
  tareLb: 5100,
  usableSqFt: 152,
};

export const DIMENSIONS: Record<ContainerType, ContainerDimensions> = {
  '40HC': D40HC,
  '20ST': D20ST,
};

export const CONTAINER_TYPES: ContainerType[] = ['40HC', '20ST'];

export function dimsOf(type: ContainerType): ContainerDimensions {
  return DIMENSIONS[type];
}

/**
 * Interior clear width after the corrugated walls: 7'8".
 *
 * This single number governs every room the tool can produce. Nothing in the
 * UI may offer an 8-foot-wide room, because no such room exists inside a
 * shipping container.
 */
export const INTERIOR_WIDTH_FT = 7 + 8 / 12;

/** Grid module across a container (its width). */
export const SNAP_ACROSS_FT = 8;

/** Grid modules along a container, by type. */
export const SNAP_ALONG_FT: Record<ContainerType, number> = {
  '40HC': 40,
  '20ST': 20,
};

/**
 * Corner castings are the only rated load path, so they are the only geometry
 * that matters structurally. They sit at the eight corners of the box.
 */
export const CORNER_CASTING_COUNT = 8;
