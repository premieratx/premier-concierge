import { dimsOf } from './dimensions';
import {
  DEFAULT_ACCOMMODATIONS,
  cabinPorchPoints,
  generateAccommodations,
} from './generators/accommodations';
import { generateBatter } from './generators/batter';
import {
  DEFAULT_ENCEINTE,
  enceinteFeatures,
  planEnceinte,
  torchLine,
} from './generators/enceinte';
import { generateBawn } from './generators/bawn';
import {
  type GeneratorResult,
  type Rect,
  gid,
  merge,
  raise,
  resetGeneratorIds,
} from './generators/common';
import { generateFurnishings, type BanquetSpec } from './generators/furnishings';
import { generateGreatHall } from './generators/greatHall';
import {
  DEFAULT_HEX_MARINA,
  hexMarinaFeatures,
  planHexMarina,
} from './generators/hexMarina';
import { MARINA_SPECS, generateMarina } from './generators/marina';
import { generateSiteLighting } from './generators/siteLighting';
import {
  generateDragon,
  generateFirePitRing,
  generateLandStages,
  generateLawnLights,
} from './generators/spectacle';
import { generateTower } from './generators/tower';
import {
  NOMINAL_SHORELINE_Z,
  PARCEL,
  finishedGrade,
  naturalGrade,
  padUnder,
  terraceElevation,
} from './terrain';
import type { Container, Layout, MarinaPhase, SiteFeature, SiteDefinition } from './types';

/* ------------------------------------------------------------------ *
 * The site plan.
 *
 * Laid out on the Cypress Creek parcel: a thousand feet across, six hundred
 * deep, falling ninety-odd feet from the road at the back to the lake at the
 * front. +Z runs downhill toward the water.
 *
 * The castle is terraced into the hill rather than sitting on it. The keep
 * takes the crest, the great hall and courtyard the bench below, the gatehouse
 * a bench below that, and the lawn with the dragon and the fire a bench below
 * that again. Each step is twelve to eighteen feet, and the curtain wall on
 * the hall terrace does double duty as the retaining wall for its own pad.
 * ------------------------------------------------------------------ */

export const SITE: SiteDefinition = {
  sizeX: PARCEL.sizeX,
  sizeZ: PARCEL.sizeZ,
  shorelineZ: NOMINAL_SHORELINE_Z,
  waterLevelFt: 0,
  marinaPhase: 'enhanced',
  terrain: 'cypressCreek',
};

/** Terrace elevations, named where the layout reads better for it. */
export const KEEP_LEVEL = terraceElevation('upper');
export const HALL_LEVEL = terraceElevation('middle');
export const GATE_LEVEL = terraceElevation('lower');
export const LAWN_LEVEL = terraceElevation('lawn');

/** Outer footprint of the bawn on the hall terrace. */
export const BAWN: Rect = { x: -200, z: -152, sizeX: 400, sizeZ: 144 };

/** Glamping platforms sit on the east bench below the cabins. */

/** The gate faces downhill, toward the water. */
const GATE_BAYS = 2;

const D40 = dimsOf('40HC');
const D20 = dimsOf('20ST');

/** Pad elevation for a building that follows natural grade, to the nearest foot. */
export function padElevation(x: number, z: number): number {
  return Math.round(naturalGrade(x, z));
}

/**
 * One extra course of curtain wall along the water-facing side, so the
 * elevation you see from the lake is two containers tall over an eighteen-foot
 * retaining face. Nothing spans the gate opening — a container bridging an
 * opening with no support under its corner castings is exactly the cantilever
 * the checker is there to catch.
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

/** The keep: the tall block on the crest, three levels over the courtyard. */
function keep(): GeneratorResult {
  const containers: Container[] = [];
  const levels = 3;
  const xs = [-40, 0];
  const zs = [-216, -208, -200];
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
            level === 0 && z === zs[2]
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

  /* Hall terrace ---------------------------------------------------- */
  parts.push(
    raise(
      merge(
        generateBawn(BAWN, 1, {
          gateSide: 'south',
          gateBays: GATE_BAYS,
          idPrefix: 'bawn',
          finish: 'stone',
        }),
        curtainUpperCourse(BAWN, GATE_BAYS),
        generateGreatHall(44, 160, 2, {
          origin: { x: -80, z: -120 },
          idPrefix: 'hall',
          finish: 'stone',
        }),
      ),
      HALL_LEVEL,
    ),
  );

  // Towers standing proud of the curtain on the downhill corners, where the
  // retaining face is tallest and a tower is the cheapest way to hold it.
  for (const [i, x] of [BAWN.x - D20.length, BAWN.x + BAWN.sizeX].entries()) {
    parts.push(
      raise(
        generateTower(x, BAWN.z + BAWN.sizeZ - D20.width * 2, 3, '20ST', {
          idPrefix: `tower-front-${i}`,
          role: 'tower',
          finish: 'stone',
        }),
        HALL_LEVEL,
      ),
    );
  }

  parts.push(
    raise(
      generateBatter(
        { x: BAWN.x, z: BAWN.z, sizeX: BAWN.sizeX, sizeZ: BAWN.sizeZ },
        1 / 6,
        8,
        { idPrefix: 'bawn-batter' },
      ),
      HALL_LEVEL,
    ),
  );

  /* Keep terrace ---------------------------------------------------- */
  parts.push(raise(keep(), KEEP_LEVEL));

  // Pulled forward off the parcel line so they stand clear of the hexagonal
  // enceinte, whose road face and moat run behind them.
  for (const [i, x] of [-150, 130].entries()) {
    parts.push(
      raise(
        generateTower(x, -236, 3, '20ST', {
          idPrefix: `tower-back-${i}`,
          role: 'tower',
          finish: 'stone',
        }),
        KEEP_LEVEL,
      ),
    );
  }

  /* Gate terrace ---------------------------------------------------- */
  for (const [i, x] of [-60, 40].entries()) {
    parts.push(
      raise(
        generateTower(x, 0, 2, '20ST', {
          idPrefix: `gatetower-${i}`,
          role: 'sealed',
          finish: 'stone',
          bartizans: false,
        }),
        GATE_LEVEL,
      ),
    );
  }

  return { ...merge(...parts), features: [] };
}

/**
 * The banquet in the great hall, on the hall terrace.
 */
export const HALL_BANQUET: BanquetSpec = {
  center: { x: 0, z: -90 },
  y: HALL_LEVEL,
  rowZ: [-100, -78],
  tablesPerRow: 8,
  tableLengthFt: 8,
  tableWidthFt: 2.5,
  runFt: 152,
};

/** The arrival lawn, on its own terrace between the gatehouse and the bank. */
export const LAWN = { x: -140, z: 64, sizeX: 280, sizeZ: 88 };

/** The lawn between the gate and the water: dragon, fire, stages, lights. */
export function generateLawn(): SiteFeature[] {
  const features: SiteFeature[] = [];

  features.push(
    generateDragon({
      position: { x: 0, y: LAWN_LEVEL, z: 110 },
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
      center: { x: -140, z: 106 },
      ringRadiusFt: 28,
      count: 4,
      pitRadiusFt: 5,
      rainbow: true,
      startHue: 0,
      y: LAWN_LEVEL,
    }),
    ...generateFirePitRing({
      center: { x: 140, z: 106 },
      ringRadiusFt: 28,
      count: 3,
      pitRadiusFt: 5,
      rainbow: true,
      startHue: 180,
      y: LAWN_LEVEL,
    }),
  );

  features.push(
    ...generateLandStages([
      {
        name: 'Great hall stage',
        position: { x: 0, y: HALL_LEVEL, z: -90 },
        rotationY: 0,
        widthFt: 28,
        depthFt: 18,
        heightFt: 3,
        roof: 'container',
      },
      {
        name: 'Fire ring stage',
        position: { x: -140, y: LAWN_LEVEL, z: 106 },
        rotationY: Math.PI / 2,
        widthFt: 22,
        depthFt: 14,
        heightFt: 2.5,
        roof: 'truss',
      },
      {
        name: 'Grove stage',
        position: { x: 140, y: LAWN_LEVEL, z: 106 },
        rotationY: -Math.PI / 2,
        widthFt: 22,
        depthFt: 14,
        heightFt: 2.5,
        roof: 'open',
      },
    ]),
  );

  features.push(...generateLawnLights({ x: 0, z: 108 }, 150, 16, LAWN_LEVEL + 18));

  return features;
}

/* ------------------------------------------------------------------ *
 * The outer works.
 *
 * A hexagon of wall round the whole compound, a moat outside it, and three
 * ways in — water, road and drive. The water and road faces are directly
 * opposite one another and get identical drawbridges, so the castle presents
 * the same face whether you come up from the lake or down from the road.
 * ------------------------------------------------------------------ */

export const ENCEINTE = {
  ...DEFAULT_ENCEINTE,
  groundAt: finishedGrade,
};

/**
 * The enceinte, the moat, the three crossings, the guard on each, and the
 * torch runs: on the wall head, on the corner drums, on the castle's own
 * towers, and all the way down the walk to the water.
 */
export function generateOuterWorks(): SiteFeature[] {
  const plan = planEnceinte(ENCEINTE);
  const features: SiteFeature[] = [...enceinteFeatures(plan)];

  // The castle's own towers, inside the enceinte, each with a torch on top.
  const innerTowers: { x: number; z: number; y: number }[] = [
    { x: BAWN.x - D20.length / 2, z: BAWN.z + BAWN.sizeZ - D20.width, y: HALL_LEVEL + D20.height * 3 },
    { x: BAWN.x + BAWN.sizeX + D20.length / 2, z: BAWN.z + BAWN.sizeZ - D20.width, y: HALL_LEVEL + D20.height * 3 },
    { x: -150 + D20.length / 2, z: -236, y: KEEP_LEVEL + D20.height * 3 },
    { x: 130 + D20.length / 2, z: -236, y: KEEP_LEVEL + D20.height * 3 },
    { x: -60 + D20.length / 2, z: 0, y: GATE_LEVEL + D20.height * 2 },
    { x: 40 + D20.length / 2, z: 0, y: GATE_LEVEL + D20.height * 2 },
  ];
  for (const [i, t] of innerTowers.entries()) {
    features.push({
      id: `torch-castle-tower-${i}`,
      kind: 'torch',
      position: { x: t.x, y: t.y, z: t.z },
      heightFt: 4,
      hue: (i * 51) % 360,
      rainbow: true,
      gphKerosene: 0.24,
      castLight: true,
      mount: 'tower',
      label: `Castle tower torch ${i + 1}`,
    });
  }

  // The walk from the water gate down to the marina gangway, lit both sides,
  // and the courtyard walk from the gatehouse up to the hall.
  features.push(
    ...torchLine(
      'torch-shore',
      { x: 0, z: 200 },
      { x: -110, z: 196 },
      64,
      finishedGrade,
      'shore',
      { both: true, startHue: 210 },
    ),
    ...torchLine(
      'torch-court',
      { x: 0, z: 40 },
      { x: 0, z: -140 },
      66,
      finishedGrade,
      'walkway',
      { both: true, startHue: 40 },
    ),
  );

  return features;
}

/**
 * Footprints the landscape has to stay out of: everything built, the terraces,
 * the drive, and the walk down to the water.
 */
export const KEEP_CLEAR: Rect[] = [
  { x: -230, z: -286, sizeX: 460, sizeZ: 300 },
  { x: -300, z: -20, sizeX: 600, sizeZ: 200 },
  // Lodging benches.
  { x: 300, z: -160, sizeX: 200, sizeZ: 260 },
  { x: 270, z: 70, sizeX: 200, sizeZ: 150 },
  { x: -500, z: -200, sizeX: 140, sizeZ: 120 },
  // Approach drive off the road.
  { x: 120, z: -300, sizeX: 130, sizeZ: 130 },
];

/** The hexagonal marina, sat in the cove west of the centre line. */
export const HEX_MARINA = {
  ...DEFAULT_HEX_MARINA,
  center: { x: -120, z: 440 },
  waterLevelFt: SITE.waterLevelFt,
};

/**
 * The build-out marina: seven hexagons, the shore gangway that reaches the
 * one nearest the bank, the stage on the store roof, and the festoon runs
 * out along each retractable walkway.
 */
export function enhancedMarinaFeatures(): SiteFeature[] {
  const plan = planHexMarina(HEX_MARINA);
  const features: SiteFeature[] = [...hexMarinaFeatures(plan)];
  const deckY = HEX_MARINA.waterLevelFt + HEX_MARINA.freeboardFt;

  // The satellite pointing back at the bank is the one the ramp lands on.
  const landward = plan.modules
    .filter((m) => m.role === 'satellite')
    .reduce((a, b) => (a.centre.z < b.centre.z ? a : b));
  const landingZ = landward.centre.z - HEX_MARINA.sideFt;

  features.push({
    id: 'marina-gangway',
    kind: 'dock',
    position: { x: landward.centre.x, y: deckY / 2, z: (196 + landingZ) / 2 },
    rotationY: -Math.PI / 2,
    lengthFt: Math.max(12, landingZ - 196),
    widthFt: 8,
    role: 'gangway',
    stringLights: true,
    label: 'Shore gangway',
  });

  const hub = plan.modules.find((m) => m.role === 'hub')!;
  features.push({
    id: 'marina-roof-stage',
    kind: 'overwaterStage',
    position: { x: hub.centre.x, y: deckY + HEX_MARINA.roofHeightFt, z: hub.centre.z },
    rotationY: 0,
    widthFt: 44,
    depthFt: 28,
    deckHeightFt: 3,
    roof: 'truss',
    name: 'Store roof stage',
  });

  // Festoon down every walkway, and a ring around the store roof.
  for (const [i, walk] of plan.walkways.entries()) {
    features.push({
      id: `marina-walk-lights-${i}`,
      kind: 'stringLights',
      from: { x: walk.from.x, y: deckY + 11, z: walk.from.z },
      to: { x: walk.to.x, y: deckY + 11, z: walk.to.z },
      sagFt: 2,
      bulbSpacingFt: 3,
      rainbow: true,
      hue: (i * 60) % 360,
    });
  }
  for (let i = 0; i < 6; i++) {
    const a = hub.vertices[i]!;
    const b = hub.vertices[(i + 1) % 6]!;
    features.push({
      id: `marina-roof-lights-${i}`,
      kind: 'stringLights',
      from: { x: a.x, y: deckY + HEX_MARINA.roofHeightFt + 9, z: a.z },
      to: { x: b.x, y: deckY + HEX_MARINA.roofHeightFt + 9, z: b.z },
      sagFt: 1.6,
      bulbSpacingFt: 2.5,
      rainbow: true,
      hue: (i * 47 + 20) % 360,
    });
  }

  return features;
}

export interface PropertyOptions {
  marinaPhase?: MarinaPhase;
  includeLodging?: boolean;
  includeLawn?: boolean;
  /** Furniture and site lighting. On by default. */
  includeFurnishings?: boolean;
  /** Enceinte, moat, bridges, guard and torches. On by default. */
  includeOuterWorks?: boolean;
}

/**
 * The whole property as one layout: castle, lodging, lawn spectacle and
 * whichever marina scheme is selected.
 */
export function generateProperty(options: PropertyOptions = {}): Layout {
  resetGeneratorIds();
  const marinaPhase = options.marinaPhase ?? 'enhanced';

  const castle = generateCastle();
  const lodging =
    options.includeLodging === false
      ? { containers: [], decor: [], features: [] }
      : generateAccommodations({
          ...DEFAULT_ACCOMMODATIONS,
          padUnder,
          groundAt: naturalGrade,
        });
  const lawn = options.includeLawn === false ? [] : generateLawn();
  const outerWorks = options.includeOuterWorks === false ? [] : generateOuterWorks();
  const marinaFeatures =
    marinaPhase === 'enhanced'
      ? enhancedMarinaFeatures()
      : generateMarina({
          ...MARINA_SPECS[marinaPhase],
          // The cove bites in west of centre; that is where the docks go.
          centerX: -120,
          shorelineZ: 196,
          waterLevelFt: SITE.waterLevelFt,
        }).features;

  const features = [...outerWorks, ...lawn, ...lodging.features, ...marinaFeatures];

  const furnishings =
    options.includeFurnishings === false
      ? []
      : [
          ...generateFurnishings({
            features,
            cabinPorches:
              options.includeLodging === false
                ? []
                : cabinPorchPoints({
                    ...DEFAULT_ACCOMMODATIONS,
                    padUnder,
                    groundAt: naturalGrade,
                  }),
            hall: HALL_BANQUET,
          }),
          ...generateSiteLighting({
            compound: { x: BAWN.x, z: BAWN.z, sizeX: BAWN.sizeX, sizeZ: BAWN.sizeZ },
            compoundY: HALL_LEVEL,
            gateToDock: { from: { x: 0, z: 70 }, to: { x: -110, z: 190 } },
            lawn: LAWN,
            lawnY: LAWN_LEVEL,
            drive: { from: { x: 200, z: -292 }, to: { x: 120, z: -30 } },
            groundAt: finishedGrade,
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
      'A hexagonal enceinte rings the whole compound, with three ways in: the ' +
      'water face and the road face are directly opposite and carry identical ' +
      'counterweighted drawbridges, and the north-east face takes the drive. ' +
      'The moat is a chain of short level pools weired at every step, because ' +
      'the ground round the ring falls about sixty feet and water will not. ' +
      'Terraced onto the Cypress Creek parcel: 1,000 by 600 feet, falling about ' +
      '90 feet from the road to the lake. Elevations are read off aerial imagery, ' +
      'not survey data. Castle containers carry zone "castle"; lodging containers ' +
      'carry zone "lodging" so the reference cost validation is never inflated by ' +
      'the lodging or marina programme.',
  };
}
