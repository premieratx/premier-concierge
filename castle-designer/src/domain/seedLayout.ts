import type { Layout } from './types';

/**
 * Hardcoded six-container test layout: a fragment of the castle rather than
 * the whole thing.
 *
 * Two stacked 40HC walls forty feet apart — that clear span is the great hall,
 * and it is open air between two intact container walls rather than a
 * hollowed-out row, which is the design principle the whole tool exists to
 * teach. A two-level 20ST tower anchors the northwest corner.
 */
export const SEED_LAYOUT: Layout = {
  version: 1,
  id: 'seed-hall-fragment',
  name: 'Great hall fragment',
  units: 'ft',
  notes:
    'Phase 1 test layout: two 40HC wall stacks bracketing a 40-foot open span, ' +
    'plus a two-level 20ST corner tower.',
  decor: [],
  features: [],
  site: {
    sizeX: 400,
    sizeZ: 400,
    shorelineZ: 300,
    waterLevelFt: -6,
    marinaPhase: 'existing',
    terrain: 'flat',
  },
  containers: [
    {
      id: 'wall-w-l1',
      type: '40HC',
      position: { x: 0, y: 0, z: 0 },
      rotation: 0,
      role: 'wall',
      finish: 'painted',
      label: 'West hall wall L1',
      openings: [
        {
          id: 'wall-w-l1-door',
          face: 'sideB',
          width: 10,
          height: 8,
          offsetU: 15,
          offsetV: 0,
          label: 'Hall door',
        },
      ],
    },
    {
      id: 'wall-w-l2',
      type: '40HC',
      position: { x: 0, y: 9.5, z: 0 },
      rotation: 0,
      role: 'wall',
      finish: 'painted',
      label: 'West hall wall L2',
      openings: [],
    },
    {
      id: 'wall-e-l1',
      type: '40HC',
      position: { x: 0, y: 0, z: 48 },
      rotation: 0,
      role: 'wall',
      finish: 'painted',
      label: 'East hall wall L1',
      openings: [],
    },
    {
      id: 'wall-e-l2',
      type: '40HC',
      position: { x: 0, y: 9.5, z: 48 },
      rotation: 0,
      role: 'wall',
      finish: 'painted',
      label: 'East hall wall L2',
      openings: [],
    },
    {
      id: 'tower-nw-l1',
      type: '20ST',
      position: { x: -8, y: 0, z: 0 },
      rotation: 90,
      role: 'sealed',
      finish: 'stone',
      label: 'NW tower L1 (sealed)',
      openings: [
        {
          id: 'tower-nw-l1-window',
          face: 'sideA',
          width: 3,
          height: 3,
          offsetU: 8,
          offsetV: 4,
          label: 'Arrow slit',
        },
      ],
    },
    {
      id: 'tower-nw-l2',
      type: '20ST',
      position: { x: -8, y: 8.5, z: 0 },
      rotation: 90,
      role: 'tower',
      finish: 'stone',
      label: 'NW tower L2',
      openings: [],
    },
  ],
};

/** The clear span of the seed layout's great hall, in feet. */
export const SEED_HALL_SPAN_FT = 40;
