export interface CameraPreset {
  key: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  hint: string;
}

/**
 * Named viewpoints, because a property this size is genuinely hard to find
 * your way around with an orbit control and nothing else.
 */
export const CAMERA_PRESETS: CameraPreset[] = [
  {
    key: 'property',
    label: 'Whole property',
    position: [-620, 430, 900],
    target: [0, 20, 250],
    hint: 'Castle, lawn, lodging and marina in one frame',
  },
  {
    key: 'approach',
    label: 'Arrival',
    position: [0, 70, 620],
    target: [0, 45, 240],
    hint: 'What you see coming up the drive: dragon, then gate',
  },
  {
    key: 'castle',
    label: 'Castle',
    position: [-330, 190, 420],
    target: [0, 30, 110],
    hint: 'The compound, the great hall and the towers',
  },
  {
    key: 'dragon',
    label: 'Dragon',
    position: [-52, 26, 318],
    target: [0, 15, 250],
    hint: 'Close on the scrap build and the fire',
  },
  {
    key: 'marina',
    label: 'Marina',
    position: [330, 150, 700],
    target: [0, 0, 460],
    hint: 'Slips, patios and the overwater stage',
  },
  {
    key: 'premier',
    label: 'Premier slip',
    position: [128, 44, 640],
    target: [24, 6, 505],
    hint: 'The product: patio, bar, swing and jump platform',
  },
  {
    key: 'lodging',
    label: 'Lodging',
    position: [-460, 110, 340],
    target: [-240, 10, 130],
    hint: 'Cabins, bunkhouse and canvas platforms',
  },
  {
    key: 'lake',
    label: 'From the lake',
    position: [0, 60, 980],
    target: [0, 45, 200],
    hint: 'The elevation everyone actually sees',
  },
];

export const DEFAULT_PRESET = CAMERA_PRESETS[0]!;
