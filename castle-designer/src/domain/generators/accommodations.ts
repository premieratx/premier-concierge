import { dimsOf } from '../dimensions';
import type { AccommodationFeature, Container, Decor, ModelLayer } from '../types';
import { type GeneratorResult, gid, merge, withLayer } from './common';

export interface AccommodationResult extends GeneratorResult {
  features: AccommodationFeature[];
}

/** Everything this module emits belongs to the lodging programme. */
function asLodging(result: GeneratorResult): GeneratorResult {
  return {
    containers: result.containers,
    decor: result.decor.map((d) => ({ ...d, zone: 'lodging' as const })),
  };
}

function tag(result: GeneratorResult, layer: ModelLayer): GeneratorResult {
  return withLayer(result, layer);
}

const D40 = dimsOf('40HC');

/** A single-container cabin: one 40HC, a deck, a shed roof and two posts. */
function cabin(x: number, z: number, index: number, baseY: number): GeneratorResult {
  const containers: Container[] = [
    {
      id: gid('cabin', index),
      type: '40HC',
      // Long axis along Z, so the short elevation faces the neighbours.
      position: { x, y: baseY, z },
      rotation: 90,
      role: 'sealed',
      finish: 'painted',
      openings: [
        {
          id: gid('cabin', index, 'door'),
          face: 'sideA',
          width: 3.5,
          height: 7,
          offsetU: 4,
          offsetV: 0,
          label: 'Entry',
        },
        {
          id: gid('cabin', index, 'window'),
          face: 'sideA',
          width: 8,
          height: 5,
          offsetU: 22,
          offsetV: 3,
          label: 'Lake window',
        },
      ],
      zone: 'lodging',
      label: `Cabin ${index + 1}`,
    },
  ];

  const deckWidth = 10;
  const decor: Decor[] = [
    {
      id: gid('cabin', index, 'deck'),
      kind: 'deck',
      center: { x: x - deckWidth / 2, y: baseY + 1.2, z: z + D40.length / 2 },
      size: { x: deckWidth, y: 0.6, z: 24 },
    },
    {
      id: gid('cabin', index, 'roof'),
      kind: 'shedRoof',
      center: { x: x + D40.width / 2 - 1.5, y: baseY + D40.height + 1.1, z: z + D40.length / 2 },
      size: { x: D40.width + deckWidth + 2, y: 0.6, z: D40.length + 3 },
      slope: 0.16,
    },
    {
      id: gid('cabin', index, 'post-a'),
      kind: 'post',
      center: { x: x - deckWidth, y: baseY + 5, z: z + 4 },
      size: { x: 0.5, y: 10, z: 0.5 },
    },
    {
      id: gid('cabin', index, 'post-b'),
      kind: 'post',
      center: { x: x - deckWidth, y: baseY + 5, z: z + D40.length - 4 },
      size: { x: 0.5, y: 10, z: 0.5 },
    },
  ];

  return { containers, decor };
}

/** Two-level bunkhouse: three 40HC per level with a shared gallery. */
function bunkhouse(x0: number, z: number, bays: number, levels: number, baseY: number): GeneratorResult {
  const containers: Container[] = [];
  for (let level = 0; level < levels; level++) {
    for (let bay = 0; bay < bays; bay++) {
      containers.push({
        id: gid('bunk', level, bay),
        type: '40HC',
        position: { x: x0 + bay * D40.length, y: baseY + level * D40.height, z },
        rotation: 0,
        role: 'sealed',
        finish: 'painted',
        openings: [
          {
            id: gid('bunk', level, bay, 'door'),
            face: 'sideA',
            width: 3.5,
            height: 7,
            offsetU: 4,
            offsetV: 0,
          },
          {
            id: gid('bunk', level, bay, 'win'),
            face: 'sideA',
            width: 4,
            height: 4,
            offsetU: 24,
            offsetV: 3.5,
          },
        ],
        zone: 'lodging',
        label: `Bunkhouse L${level + 1} bay ${bay + 1}`,
      });
    }
  }

  const runLength = bays * D40.length;
  const decor: Decor[] = [];
  for (let level = 0; level < levels; level++) {
    decor.push({
      id: gid('bunk', 'gallery', level),
      kind: 'deck',
      center: {
        x: x0 + runLength / 2,
        y: baseY + level * D40.height + 0.8,
        z: z - 3,
      },
      size: { x: runLength, y: 0.6, z: 6 },
    });
  }
  decor.push({
    id: gid('bunk', 'roof'),
    kind: 'shedRoof',
    center: { x: x0 + runLength / 2, y: baseY + levels * D40.height + 1, z: z - 1 },
    size: { x: runLength + 3, y: 0.6, z: D40.width + 9 },
    slope: 0.14,
  });

  return { containers, decor };
}

/** Canvas tents on timber platforms — no containers, no welding, no piers. */
function glampingPlatform(x: number, z: number, index: number, baseY: number): GeneratorResult {
  return {
    containers: [],
    decor: [
      {
        id: gid('glamp', index, 'deck'),
        kind: 'deck',
        center: { x, y: baseY + 1.5, z },
        size: { x: 20, y: 0.6, z: 20 },
      },
      {
        id: gid('glamp', index, 'tent'),
        kind: 'tent',
        center: { x, y: baseY + 6.5, z },
        size: { x: 16, y: 9, z: 16 },
      },
    ],
  };
}

export interface AccommodationsSpec {
  cabinRowsX: number[];
  cabinRowZ: number[];
  bunkhouseAt: { x: number; z: number };
  bunkhouseBays: number;
  bunkhouseLevels: number;
  glampingAt: { x: number; z: number }[];
  /** Keys carved out of the castle towers; adds no containers of its own. */
  towerSuites: number;
  /**
   * Pad level under a footprint, so each unit gets its own bench on the
   * hillside rather than the whole cluster sitting on one imaginary plane.
   * Takes the low point, which cuts the uphill end into the slope.
   */
  padUnder?: (rect: { x: number; z: number; sizeX: number; sizeZ: number }) => number;
  /** Ground level at a point, for the porch furniture. */
  groundAt?: (x: number, z: number) => number;
}

/**
 * Lodging sits on the two benches either side of the compound, each unit on
 * its own small pad at whatever the hill is doing underneath it — which is how
 * cabins actually get built on a slope, and why they step down the site
 * instead of forming a row.
 */
export const DEFAULT_ACCOMMODATIONS: AccommodationsSpec = {
  cabinRowsX: [264, 336, 408],
  cabinRowZ: [-160, -80, 0],
  bunkhouseAt: { x: 240, z: -240 },
  bunkhouseBays: 3,
  bunkhouseLevels: 2,
  glampingAt: [
    { x: 300, z: 96 },
    { x: 300, z: 146 },
    { x: 300, z: 196 },
    { x: 372, z: 120 },
    { x: 372, z: 170 },
    { x: 372, z: 220 },
  ],
  towerSuites: 8,
};

/** Where each cabin's porch furniture goes: the middle of its deck. */
export function cabinPorchPoints(
  spec: AccommodationsSpec = DEFAULT_ACCOMMODATIONS,
): { x: number; y: number; z: number }[] {
  const ground = spec.groundAt ?? (() => 0);
  const points: { x: number; y: number; z: number }[] = [];
  for (const x of spec.cabinRowsX) {
    for (const z of spec.cabinRowZ) {
      points.push({
        x: x - 5,
        y: ground(x, z + D40.length / 2) + 1.5,
        z: z + D40.length / 2,
      });
    }
  }
  return points;
}

/**
 * The lodging build-out. Cabins and the bunkhouse are real containers and go
 * into the takeoff under the `lodging` zone; glamping platforms and tower
 * suites are programme without new steel.
 */
export function generateAccommodations(
  spec: AccommodationsSpec = DEFAULT_ACCOMMODATIONS,
): AccommodationResult {
  const parts: GeneratorResult[] = [];
  const features: AccommodationFeature[] = [];

  const pad = spec.padUnder ?? (() => 0);

  let cabinIndex = 0;
  for (const x of spec.cabinRowsX) {
    for (const z of spec.cabinRowZ) {
      // The cabin runs long-axis along Z, so its footprint is 8 by 40 — plus
      // the deck hanging off the west side.
      const level = pad({ x: x - 12, z, sizeX: D40.width + 12, sizeZ: D40.length });
      parts.push(tag(cabin(x, z, cabinIndex, level), 'cabins'));
      cabinIndex += 1;
    }
  }
  const cabinCount = cabinIndex;
  const cabinsMidX = spec.cabinRowsX[Math.floor(spec.cabinRowsX.length / 2)] ?? 0;
  const cabinsMidZ = spec.cabinRowZ[Math.floor(spec.cabinRowZ.length / 2)] ?? 0;
  features.push({
    id: 'lodging-cabins',
    kind: 'accommodation',
    position: {
      x: cabinsMidX,
      y: pad({ x: cabinsMidX - 12, z: cabinsMidZ, sizeX: 20, sizeZ: D40.length }),
      z: cabinsMidZ + D40.length / 2,
    },
    rotationY: 0,
    style: 'containerCabin',
    units: cabinCount,
    sleeps: cabinCount * 4,
    sqFt: cabinCount * dimsOf('40HC').usableSqFt,
    name: 'Lake cabins',
  });

  parts.push(
    tag(
      bunkhouse(
        spec.bunkhouseAt.x,
        spec.bunkhouseAt.z,
        spec.bunkhouseBays,
        spec.bunkhouseLevels,
        pad({
          x: spec.bunkhouseAt.x,
          z: spec.bunkhouseAt.z - 6,
          sizeX: spec.bunkhouseBays * D40.length,
          sizeZ: D40.width + 6,
        }),
      ),
      'bunkhouse',
    ),
  );
  const bunkUnits = spec.bunkhouseBays * spec.bunkhouseLevels;
  features.push({
    id: 'lodging-bunkhouse',
    kind: 'accommodation',
    position: {
      x: spec.bunkhouseAt.x + (spec.bunkhouseBays * D40.length) / 2,
      y: pad({
        x: spec.bunkhouseAt.x,
        z: spec.bunkhouseAt.z - 6,
        sizeX: spec.bunkhouseBays * D40.length,
        sizeZ: D40.width + 6,
      }),
      z: spec.bunkhouseAt.z,
    },
    rotationY: 0,
    style: 'bunkhouse',
    units: bunkUnits,
    sleeps: bunkUnits * 4,
    sqFt: bunkUnits * dimsOf('40HC').usableSqFt,
    name: 'Bunkhouse',
  });

  spec.glampingAt.forEach((p, i) =>
    parts.push(
      tag(
        glampingPlatform(p.x, p.z, i, pad({ x: p.x - 10, z: p.z - 10, sizeX: 20, sizeZ: 20 })),
        'glamping',
      ),
    ),
  );
  features.push({
    id: 'lodging-glamping',
    kind: 'accommodation',
    position: {
      x: spec.glampingAt[0]?.x ?? 0,
      y: pad({
        x: (spec.glampingAt[0]?.x ?? 0) - 10,
        z: (spec.glampingAt[0]?.z ?? 0) - 10,
        sizeX: 20,
        sizeZ: 20,
      }),
      z: spec.glampingAt[0]?.z ?? 0,
    },
    rotationY: 0,
    style: 'glamping',
    units: spec.glampingAt.length,
    sleeps: spec.glampingAt.length * 2,
    sqFt: spec.glampingAt.length * 220,
    name: 'Canvas platforms',
  });

  if (spec.towerSuites > 0) {
    features.push({
      id: 'lodging-tower-suites',
      kind: 'accommodation',
      position: { x: 0, y: 0, z: -200 },
      rotationY: 0,
      style: 'towerSuite',
      units: spec.towerSuites,
      sleeps: spec.towerSuites * 2,
      // Fitted out inside containers the castle already counts, so the area
      // is programme only — it must not be added to the container takeoff.
      sqFt: spec.towerSuites * 152,
      name: 'Tower suites',
    });
  }

  return { ...asLodging(merge(...parts)), features };
}
