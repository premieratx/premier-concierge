import { dimsOf } from './dimensions';
import { cabinPorchPoints, generateAccommodations } from './generators/accommodations';
import { generateBatter } from './generators/batter';
import { generateBawn } from './generators/bawn';
import { type GeneratorResult, type Rect, gid, merge, resetGeneratorIds } from './generators/common';
import { generateGreatHall } from './generators/greatHall';
import { MARINA_SPECS, generateMarina } from './generators/marina';
import {
  generateDragon,
  generateFirePitRing,
  generateLandStages,
  generateLawnLights,
} from './generators/spectacle';
import { generateFurnishings, type BanquetSpec } from './generators/furnishings';
import { generateSiteLighting } from './generators/siteLighting';
import { generateTower } from './generators/tower';
import type { Container, Layout, MarinaPhase, SiteFeature, SiteDefinition } from './types';

/* ------------------------------------------------------------------ *
 * Site geography, in feet.
 *
 * +Z runs from the back of the property down to the water. The castle
 * compound sits inland, the arrival lawn with the dragon and the fire pits
 * fills the ground between the gate and the bank, and the marina runs out
 * from the shoreline on the centre line.
 * ------------------------------------------------------------------ */

export const SITE: SiteDefinition = {
  sizeX: 800,
  sizeZ: 1000,
  shorelineZ: 300,
  waterLevelFt: -6,
  marinaPhase: 'enhanced',
};

/** Outer footprint of the bawn — the courtyard curtain wall. */
export const BAWN: Rect = { x: -200, z: 0, sizeX: 400, sizeZ: 200 };

/** The gate faces the water, so it goes in the +Z curtain. */
const GATE_BAYS = 2;

const D40 = dimsOf('40HC');
const D20 = dimsOf('20ST');

/**
 * One extra course of curtain wall along the water-facing side, so the
 * elevation you see from the lake is two containers tall rather than one.
 * The bays either side of the gate opening only — nothing spans the gate,
 * because a container bridging an opening with no support under its corner
 * castings is exactly the cantilever the checker is there to catch.
 */
function curtainUpperCourse(perimeter: Rect, gateBays: number): GeneratorResult {
  const containers: Container[] = [];
  const baysX = Math.floor(perimeter.sizeX / D40.length);
  const gateStart = Math.max(0, Math.floor((baysX - gateBays) / 2));
  const z = perimeter.z + perimeter.sizeZ - D40.width;
  for (let bay = 0; bay < baysX; bay++) {
    if (bay >= gateStart && bay < gateStart + gateBays) continue;
    containers.push({
      id: gid('curtain-upper', bay),
      type: '40HC',
      position: { x: perimeter.x + bay * D40.length, y: D40.height, z },
      rotation: 0,
      role: 'structural',
      finish: 'stone',
      openings: [],
      zone: 'castle',
      layer: 'curtainWall',
      label: `Water curtain L2 bay ${bay + 1}`,
    });
  }
  return { containers, decor: [] };
}

/** The keep: the tall block at the back of the courtyard. */
function keep(): GeneratorResult {
  const containers: Container[] = [];
  const levels = 3;
  const xs = [-40, 0];
  const zs = [144, 152];
  for (let level = 0; level < levels; level++) {
    for (const x of xs) {
      for (const z of zs) {
        containers.push({
          id: gid('keep', level, x, z),
          type: '40HC',
          position: { x, y: level * D40.height, z },
          rotation: 0,
          role: 'sealed',
          finish: 'stone',
          openings:
            level === 0 && z === zs[1]
              ? [
                  {
                    id: gid('keep', 'door', x),
                    face: 'sideB',
                    width: 6,
                    height: 8,
                    offsetU: 17,
                    offsetV: 0,
                    label: 'Keep entry',
                  },
                ]
              : [
                  {
                    id: gid('keep', 'win', level, x, z),
                    face: 'sideA',
                    width: 3,
                    height: 4,
                    offsetU: 18,
                    offsetV: 3.5,
                  },
                ],
          zone: 'castle',
          layer: 'keep',
          label: `Keep L${level + 1}`,
        });
      }
    }
  }
  return { containers, decor: [] };
}

export interface CastleResult extends GeneratorResult {
  features: SiteFeature[];
}

/** Everything inside and immediately around the curtain wall. */
export function generateCastle(): CastleResult {
  const parts: GeneratorResult[] = [];

  parts.push(
    generateBawn(BAWN, 1, {
      gateSide: 'south',
      gateBays: GATE_BAYS,
      idPrefix: 'bawn',
      finish: 'stone',
    }),
  );
  parts.push(curtainUpperCourse(BAWN, GATE_BAYS));

  // Corner towers, sitting proud of the curtain at each corner. The
  // south-west one is the great tower and runs a level higher, which is what
  // trips the lateral-bracing warning — deliberately, so the cost of height
  // shows up in the estimate instead of being free.
  const towerCorners: { x: number; z: number; levels: number; name: string }[] = [
    { x: BAWN.x - D20.length, z: BAWN.z - D20.width * 2, levels: 3, name: 'nw' },
    { x: BAWN.x + BAWN.sizeX, z: BAWN.z - D20.width * 2, levels: 3, name: 'ne' },
    { x: BAWN.x + BAWN.sizeX, z: BAWN.z + BAWN.sizeZ, levels: 3, name: 'se' },
    { x: BAWN.x - D20.length, z: BAWN.z + BAWN.sizeZ, levels: 4, name: 'sw' },
  ];
  for (const t of towerCorners) {
    parts.push(
      generateTower(t.x, t.z, t.levels, '20ST', {
        idPrefix: `tower-${t.name}`,
        role: 'tower',
        finish: 'stone',
      }),
    );
  }

  // Gate towers flank the opening, standing outside the curtain line.
  for (const [i, x] of [-60, 40].entries()) {
    parts.push(
      generateTower(x, BAWN.z + BAWN.sizeZ, 2, '20ST', {
        idPrefix: `gatetower-${i}`,
        role: 'sealed',
        finish: 'stone',
        bartizans: false,
      }),
    );
  }

  parts.push(
    generateGreatHall(44, 160, 2, {
      origin: { x: -80, z: 48 },
      idPrefix: 'hall',
      finish: 'stone',
    }),
  );

  parts.push(keep());

  // Battered plinth around the whole compound: cheap, and it is what makes
  // the thing look like it weighs something.
  parts.push(
    generateBatter(
      { x: BAWN.x, z: BAWN.z, sizeX: BAWN.sizeX, sizeZ: BAWN.sizeZ },
      1 / 6,
      8,
      { idPrefix: 'bawn-batter' },
    ),
  );

  return { ...merge(...parts), features: [] };
}

/** The lawn between the gate and the water: dragon, fire, stages, lights. */
export function generateLawn(): SiteFeature[] {
  const features: SiteFeature[] = [];

  features.push(
    generateDragon({
      position: { x: 0, y: 0, z: 248 },
      // Facing the water, so the fire goes out over the lake, not the gate.
      rotationY: 0,
      lengthFt: 48,
      wingspanFt: 58,
      shoulderHeightFt: 14,
      breathingFire: true,
      burstPeriodS: 9,
    }),
  );

  // Two rainbow pit clusters flanking the dragon, clear of its footprint.
  features.push(
    ...generateFirePitRing({
      center: { x: -128, z: 252 },
      ringRadiusFt: 34,
      count: 4,
      pitRadiusFt: 5,
      rainbow: true,
      startHue: 0,
    }),
    ...generateFirePitRing({
      center: { x: 128, z: 252 },
      ringRadiusFt: 34,
      count: 3,
      pitRadiusFt: 5,
      rainbow: true,
      startHue: 180,
    }),
  );

  features.push(
    ...generateLandStages([
      {
        name: 'Great hall stage',
        position: { x: 0, y: 0, z: 78 },
        rotationY: 0,
        widthFt: 28,
        depthFt: 18,
        heightFt: 3,
        roof: 'container',
      },
      {
        name: 'Fire ring stage',
        position: { x: -128, y: 0, z: 252 },
        rotationY: Math.PI / 2,
        widthFt: 22,
        depthFt: 14,
        heightFt: 2.5,
        roof: 'truss',
      },
      {
        name: 'Grove stage',
        position: { x: 128, y: 0, z: 252 },
        rotationY: -Math.PI / 2,
        widthFt: 22,
        depthFt: 14,
        heightFt: 2.5,
        roof: 'open',
      },
    ]),
  );

  features.push(...generateLawnLights({ x: 0, z: 250 }, 150, 16));

  return features;
}

/**
 * The banquet in the great hall: two rows of trestles flanking the stage,
 * which is what turns the clear span into a seated capacity rather than an
 * abstract number of square feet.
 */
export const HALL_BANQUET: BanquetSpec = {
  center: { x: 0, z: 78 },
  y: 0,
  rowZ: [68, 88],
  tablesPerRow: 8,
  tableLengthFt: 8,
  tableWidthFt: 2.5,
  runFt: 152,
};

/** The arrival lawn between the gate and the bank. */
export const LAWN = { x: -380, z: 216, sizeX: 760, sizeZ: 84 };

export interface PropertyOptions {
  marinaPhase?: MarinaPhase;
  includeLodging?: boolean;
  includeLawn?: boolean;
  /** Furniture and site lighting. On by default. */
  includeFurnishings?: boolean;
}

/**
 * The whole property as one layout: castle, lodging, lawn spectacle and
 * whichever marina scheme is selected.
 */
export function generateProperty(options: PropertyOptions = {}): Layout {
  resetGeneratorIds();
  const marinaPhase = options.marinaPhase ?? 'enhanced';

  const castle = generateCastle();
  const lodging = options.includeLodging === false
    ? { containers: [], decor: [], features: [] }
    : generateAccommodations();
  const lawn = options.includeLawn === false ? [] : generateLawn();
  const marinaSpec = MARINA_SPECS[marinaPhase];
  const marina = generateMarina({
    ...marinaSpec,
    shorelineZ: SITE.shorelineZ,
    waterLevelFt: SITE.waterLevelFt,
  });

  const features = [...lawn, ...lodging.features, ...marina.features];

  const furnishings =
    options.includeFurnishings === false
      ? []
      : [
          ...generateFurnishings({
            features,
            cabinPorches: options.includeLodging === false ? [] : cabinPorchPoints(),
            hall: HALL_BANQUET,
          }),
          ...generateSiteLighting({
            compound: BAWN,
            gateToDock: { from: { x: 0, z: 222 }, to: { x: 0, z: 300 } },
            lawn: LAWN,
            drive: { from: { x: -560, z: 250 }, to: { x: -230, z: 250 } },
          }),
        ];

  return {
    version: 1,
    id: `hcyc-${marinaPhase}`,
    name: `Hill Country Yacht Club — castle + ${marinaPhase} marina`,
    units: 'ft',
    site: { ...SITE, marinaPhase },
    containers: [...castle.containers, ...lodging.containers],
    decor: [...castle.decor, ...lodging.decor, ...furnishings],
    features,
    notes:
      'Parametric build-out. Castle containers carry zone "castle"; lodging ' +
      'containers carry zone "lodging" so the reference cost validation is ' +
      'never inflated by the lodging or marina programme.',
  };
}
