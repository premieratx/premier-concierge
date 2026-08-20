import type {
  DragonFeature,
  FirePitFeature,
  SiteFeature,
  StageFeature,
  StringLightsFeature,
  Vec3,
} from '../types';
import { gid } from './common';

export interface DragonSpec {
  /** Ground point under the chest. */
  position: Vec3;
  /** Which way it faces, in radians about Y. */
  rotationY: number;
  /** Nose to tail tip, in feet. */
  lengthFt: number;
  /** Wingtip to wingtip, in feet. */
  wingspanFt: number;
  shoulderHeightFt: number;
  breathingFire: boolean;
  burstPeriodS: number;
}

/**
 * The dragon: a scrap-metal beast on the arrival lawn.
 *
 * Not a fabricated sculpture — a junkyard build. Car hoods and doors for the
 * wing membrane, wheel rims at the joints, leaf springs for ribs and legs,
 * exhaust pipe for the neck, brake discs for the feet, headlights for the
 * eyes, chain for teeth, all cut and welded onto a used-pipe spine and
 * left in whatever faded paint the donor cars arrived in.
 *
 * Forty-eight feet nose to tail is what a $20,000 parts-and-rigging budget
 * actually buys with the labour donated. It still stands three storeys at the
 * head and throws fire out over the water; it just is not a hundred and fifty
 * feet of anything, and pretending otherwise would put the budget out by more
 * than a factor of two.
 *
 * It is an original beast — a long-necked, four-limbed wyvern — not a
 * reproduction of any particular film or television creature.
 */
export const DEFAULT_DRAGON: DragonSpec = {
  position: { x: 0, y: 0, z: 248 },
  rotationY: 0,
  lengthFt: 48,
  wingspanFt: 58,
  shoulderHeightFt: 14,
  breathingFire: true,
  burstPeriodS: 9,
};

export function generateDragon(spec: DragonSpec = DEFAULT_DRAGON): DragonFeature {
  return {
    id: 'dragon-primary',
    kind: 'dragon',
    position: { ...spec.position },
    rotationY: spec.rotationY,
    lengthFt: spec.lengthFt,
    wingspanFt: spec.wingspanFt,
    shoulderHeightFt: spec.shoulderHeightFt,
    breathingFire: spec.breathingFire,
    burstPeriodS: spec.burstPeriodS,
    label: 'Scrap dragon',
  };
}

export interface FirePitRingSpec {
  center: { x: number; z: number };
  /** Radius of the ring the pits sit on, in feet. */
  ringRadiusFt: number;
  count: number;
  pitRadiusFt: number;
  rainbow: boolean;
  /** Hue of the first pit; the rest are spaced evenly around the wheel. */
  startHue: number;
}

export const DEFAULT_FIRE_PIT_RING: FirePitRingSpec = {
  center: { x: 0, z: 258 },
  ringRadiusFt: 76,
  count: 7,
  pitRadiusFt: 5,
  rainbow: true,
  startHue: 0,
};

/**
 * Rainbow fire pits: a ring of gas pits, each burning a different colour and
 * drifting through the spectrum. Mineral-salt burners, not projection — the
 * colour is in the flame.
 */
export function generateFirePitRing(
  spec: FirePitRingSpec = DEFAULT_FIRE_PIT_RING,
): FirePitFeature[] {
  return Array.from({ length: spec.count }, (_, i) => {
    const angle = (i / spec.count) * Math.PI * 2;
    return {
      id: gid('firepit', i),
      kind: 'firePit' as const,
      position: {
        x: spec.center.x + Math.cos(angle) * spec.ringRadiusFt,
        y: 0,
        z: spec.center.z + Math.sin(angle) * spec.ringRadiusFt,
      },
      radiusFt: spec.pitRadiusFt,
      hue: (spec.startHue + (i * 360) / spec.count) % 360,
      rainbow: spec.rainbow,
      label: `Fire pit ${i + 1}`,
    };
  });
}

export interface LandStageSpec {
  name: string;
  position: Vec3;
  rotationY: number;
  widthFt: number;
  depthFt: number;
  heightFt: number;
  roof: StageFeature['roof'];
}

/**
 * Three small stages spread across the property so a single event can run
 * three acts at once without any of them fighting the others for sound.
 */
export const LAND_STAGES: LandStageSpec[] = [
  {
    name: 'Courtyard stage',
    position: { x: 0, y: 0, z: 104 },
    rotationY: 0,
    widthFt: 28,
    depthFt: 18,
    heightFt: 3,
    roof: 'container',
  },
  {
    name: 'Fire ring stage',
    position: { x: 0, y: 0, z: 330 },
    rotationY: Math.PI,
    widthFt: 24,
    depthFt: 16,
    heightFt: 2.5,
    roof: 'truss',
  },
  {
    name: 'Grove stage',
    position: { x: -178, y: 0, z: 236 },
    rotationY: Math.PI / 2,
    widthFt: 22,
    depthFt: 14,
    heightFt: 2.5,
    roof: 'open',
  },
];

export function generateLandStages(specs: LandStageSpec[] = LAND_STAGES): StageFeature[] {
  return specs.map((s, i) => ({
    id: gid('stage', i),
    kind: 'stage' as const,
    position: { ...s.position },
    rotationY: s.rotationY,
    widthFt: s.widthFt,
    depthFt: s.depthFt,
    heightFt: s.heightFt,
    roof: s.roof,
    name: s.name,
  }));
}

/**
 * Party lights strung between poles around the lawn, so the ground between
 * the castle and the water is lit at night rather than a black gap.
 */
export function generateLawnLights(
  center: { x: number; z: number },
  radiusFt: number,
  runs = 12,
): StringLightsFeature[] {
  return Array.from({ length: runs }, (_, i) => {
    const a0 = (i / runs) * Math.PI * 2;
    const a1 = ((i + 1) / runs) * Math.PI * 2;
    return {
      id: gid('lawnlights', i),
      kind: 'stringLights' as const,
      from: {
        x: center.x + Math.cos(a0) * radiusFt,
        y: 18,
        z: center.z + Math.sin(a0) * radiusFt,
      },
      to: {
        x: center.x + Math.cos(a1) * radiusFt,
        y: 18,
        z: center.z + Math.sin(a1) * radiusFt,
      },
      sagFt: 4,
      bulbSpacingFt: 4,
      rainbow: true,
      hue: (i * 360) / runs,
    };
  });
}

export function spectacleFeatures(): SiteFeature[] {
  return [
    generateDragon(),
    ...generateFirePitRing(),
    ...generateLandStages(),
    ...generateLawnLights({ x: 0, z: 258 }, 96),
  ];
}
