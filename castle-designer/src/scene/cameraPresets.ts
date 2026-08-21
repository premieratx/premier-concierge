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
    position: [-820, 540, 690],
    target: [0, 50, 20],
    hint: 'The parcel: castle, lawn, lodging and marina in one frame',
  },
  {
    key: 'lake',
    label: 'From the lake',
    position: [-150, 155, 700],
    target: [0, 78, -80],
    hint: 'What the hill looks like from a boat — the elevation that sells it',
  },
  {
    key: 'section',
    label: 'Terraces',
    position: [-620, 165, -66],
    target: [-40, 76, -66],
    hint: 'Side on, so the four cut levels read as steps',
  },
  {
    key: 'castle',
    label: 'Castle',
    position: [-430, 230, 190],
    target: [0, 84, -110],
    hint: 'The compound, the great hall and the towers',
  },
  {
    key: 'watergate',
    label: 'Water gate',
    position: [84, 82, 268],
    target: [0, 44, 150],
    hint: 'The lake drawbridge, its counterweight and the guard on the bank',
  },
  {
    key: 'roadgate',
    label: 'Road gate',
    position: [-96, 132, -372],
    target: [0, 92, -250],
    hint: 'The same gate again from the road — the back matches the front',
  },
  {
    key: 'moat',
    label: 'Moat',
    position: [-455, 96, 88],
    target: [-300, 52, -20],
    hint: 'Six level basins stepping down the hill, weired at every corner',
  },
  {
    key: 'dragon',
    label: 'Dragon',
    position: [-78, 62, 196],
    target: [0, 52, 112],
    hint: 'Close on the scrap build and the fire',
  },
  {
    key: 'marina',
    label: 'Marina',
    position: [330, 320, 830],
    target: [-120, 10, 430],
    hint: 'The seven hexagons, the store and the roof decks',
  },
  {
    key: 'premier',
    label: 'Dock hexagon',
    position: [-120, 116, 168],
    target: [-120, 8, 296],
    hint: 'One module: outboard berths, the swim lagoon and the roof deck',
  },
  {
    key: 'lodging',
    label: 'Lodging',
    position: [640, 175, 70],
    target: [340, 86, -80],
    hint: 'Cabins and canvas platforms on the east bench',
  },
];

export const DEFAULT_PRESET = CAMERA_PRESETS[0]!;
