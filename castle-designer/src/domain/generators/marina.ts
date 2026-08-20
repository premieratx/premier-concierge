import type {
  DockFeature,
  MarinaPhase,
  PatioBarFeature,
  SiteFeature,
  SlipFeature,
  SlipTier,
  StringLightsFeature,
  BoatKind,
} from '../types';
import { gid } from './common';

export interface MarinaSpec {
  phase: MarinaPhase;
  /** X coordinate the main dock runs out along. */
  centerX: number;
  /** Where the land ends. The gangway starts here. */
  shorelineZ: number;
  /** Water surface elevation, in feet. */
  waterLevelFt: number;
  /** Freeboard: how far the deck sits above the water. */
  deckFreeboardFt: number;
  mainDockLengthFt: number;
  mainDockWidthFt: number;
  fingerLengthFt: number;
  fingerWidthFt: number;
  slipWidthFt: number;
  slipsPerSide: number;
  /** How many of the outermost slips on each side are premier. */
  premierSlipsPerSide: number;
  /** Deck platform at the head of the dock. */
  headPlatform: boolean;
  overwaterStage: boolean;
  stringLights: boolean;
  /** Standalone bars on the fixed decks, over and above the per-patio bars. */
  deckBars: number;
}

/**
 * What is on the water today: a short floating spine, a dozen berths, a
 * gangway, and nothing else. This is the baseline the enhanced scheme is
 * measured against.
 */
export const EXISTING_MARINA: MarinaSpec = {
  phase: 'existing',
  centerX: 0,
  shorelineZ: 300,
  waterLevelFt: -6,
  deckFreeboardFt: 1.5,
  mainDockLengthFt: 160,
  mainDockWidthFt: 8,
  fingerLengthFt: 26,
  fingerWidthFt: 3,
  slipWidthFt: 13,
  slipsPerSide: 6,
  premierSlipsPerSide: 0,
  headPlatform: false,
  overwaterStage: false,
  stringLights: false,
  deckBars: 0,
};

/**
 * The build-out: a longer spine, twice the berths, and — the actual product —
 * over-slip patios on the outer berths with shade, furniture, a bar, party
 * lights, a rope swing and a jump platform, plus an overwater stage and a
 * head-of-dock deck.
 */
export const ENHANCED_MARINA: MarinaSpec = {
  phase: 'enhanced',
  centerX: 0,
  shorelineZ: 300,
  waterLevelFt: -6,
  deckFreeboardFt: 1.5,
  mainDockLengthFt: 260,
  mainDockWidthFt: 10,
  fingerLengthFt: 32,
  fingerWidthFt: 4,
  slipWidthFt: 14,
  slipsPerSide: 13,
  premierSlipsPerSide: 5,
  headPlatform: true,
  overwaterStage: true,
  stringLights: true,
  deckBars: 2,
};

export const MARINA_SPECS: Record<MarinaPhase, MarinaSpec> = {
  existing: EXISTING_MARINA,
  enhanced: ENHANCED_MARINA,
};

export interface MarinaResult {
  features: SiteFeature[];
  /** Handy for the panels without re-filtering the union. */
  slips: SlipFeature[];
}

/** Berths run out from shore; the far ones get the view and the premier tier. */
function tierFor(index: number, slipsPerSide: number, premier: number): SlipTier {
  return index >= slipsPerSide - premier ? 'premier' : 'standard';
}

const BOAT_CYCLE: BoatKind[] = ['runabout', 'pontoon', 'cruiser', 'none', 'pontoon'];

/** Docks run along +Z, so their local +X axis is turned a quarter turn. */
const ALONG_Z = -Math.PI / 2;

export function generateMarina(spec: MarinaSpec): MarinaResult {
  const features: SiteFeature[] = [];
  const slips: SlipFeature[] = [];
  const deckY = spec.waterLevelFt + spec.deckFreeboardFt;
  const dockZ0 = spec.shorelineZ + 10;
  const dockZ1 = dockZ0 + spec.mainDockLengthFt;

  // Gangway from the bank down to the floating deck.
  features.push({
    id: gid('marina', 'gangway'),
    kind: 'dock',
    position: { x: spec.centerX, y: (0 + deckY) / 2, z: spec.shorelineZ + 5 },
    rotationY: ALONG_Z,
    lengthFt: 14,
    widthFt: 6,
    role: 'gangway',
    stringLights: spec.stringLights,
    label: 'Gangway',
  } satisfies DockFeature);

  features.push({
    id: gid('marina', 'main'),
    kind: 'dock',
    position: { x: spec.centerX, y: deckY, z: (dockZ0 + dockZ1) / 2 },
    rotationY: ALONG_Z,
    lengthFt: spec.mainDockLengthFt,
    widthFt: spec.mainDockWidthFt,
    role: 'main',
    stringLights: spec.stringLights,
    label: 'Main dock',
  } satisfies DockFeature);

  const pitch = spec.slipWidthFt + spec.fingerWidthFt;
  const halfMain = spec.mainDockWidthFt / 2;
  let slipNumber = 1;

  for (const side of [-1, 1] as const) {
    for (let i = 0; i <= spec.slipsPerSide; i++) {
      // One more finger than there are slips: they bracket every berth.
      const fz = dockZ0 + spec.fingerWidthFt / 2 + i * pitch;
      features.push({
        id: gid('marina', 'finger', side, i),
        kind: 'dock',
        position: {
          x: spec.centerX + side * (halfMain + spec.fingerLengthFt / 2),
          y: deckY,
          z: fz,
        },
        rotationY: 0,
        lengthFt: spec.fingerLengthFt,
        widthFt: spec.fingerWidthFt,
        role: 'finger',
        stringLights: false,
      } satisfies DockFeature);
    }

    for (let i = 0; i < spec.slipsPerSide; i++) {
      const tier = tierFor(i, spec.slipsPerSide, spec.premierSlipsPerSide);
      const premier = tier === 'premier';
      const slip: SlipFeature = {
        id: gid('marina', 'slip', side, i),
        kind: 'slip',
        position: {
          x: spec.centerX + side * (halfMain + spec.fingerLengthFt / 2),
          y: spec.waterLevelFt,
          z: dockZ0 + spec.fingerWidthFt + spec.slipWidthFt / 2 + i * pitch,
        },
        rotationY: 0,
        widthFt: spec.slipWidthFt,
        lengthFt: spec.fingerLengthFt,
        tier,
        slipNumber: slipNumber++,
        patio: premier,
        furnished: premier,
        ropeSwing: premier,
        jumpPlatform: premier,
        bar: premier,
        stringLights: premier && spec.stringLights,
        boat: BOAT_CYCLE[i % BOAT_CYCLE.length] ?? 'none',
        label: `Slip ${slipNumber - 1}${premier ? ' (premier)' : ''}`,
      };
      features.push(slip);
      slips.push(slip);

      if (slip.stringLights) {
        // A run of bulbs around the outboard edge of the patio.
        const x0 = spec.centerX + side * halfMain;
        const x1 = spec.centerX + side * (halfMain + spec.fingerLengthFt);
        const y = deckY + 9;
        features.push({
          id: gid('marina', 'slip-lights', side, i),
          kind: 'stringLights',
          from: { x: x0, y, z: slip.position.z - spec.slipWidthFt / 2 },
          to: { x: x1, y, z: slip.position.z + spec.slipWidthFt / 2 },
          sagFt: 1.6,
          bulbSpacingFt: 2.5,
          rainbow: false,
          hue: 38,
        } satisfies StringLightsFeature);
      }
    }
  }

  if (spec.headPlatform) {
    features.push({
      id: gid('marina', 'head-platform'),
      kind: 'dock',
      position: { x: spec.centerX, y: deckY, z: dockZ1 + 14 },
      rotationY: 0,
      lengthFt: 56,
      widthFt: 28,
      role: 'platform',
      stringLights: spec.stringLights,
      label: 'Head-of-dock deck',
    } satisfies DockFeature);
  }

  if (spec.overwaterStage) {
    features.push({
      id: gid('marina', 'overwater-stage'),
      kind: 'overwaterStage',
      position: { x: spec.centerX, y: deckY, z: dockZ1 + 46 },
      rotationY: 0,
      widthFt: 40,
      depthFt: 26,
      deckHeightFt: 3.5,
      roof: 'truss',
      name: 'Overwater stage',
    });
  }

  for (let i = 0; i < spec.deckBars; i++) {
    features.push({
      id: gid('marina', 'deck-bar', i),
      kind: 'patioBar',
      position: {
        x: spec.centerX + (i === 0 ? -18 : 18),
        y: deckY,
        z: dockZ1 + 14,
      },
      rotationY: i === 0 ? 0 : Math.PI,
      widthFt: 16,
      depthFt: 4,
      heightFt: 3.6,
      overWater: true,
      name: i === 0 ? 'Dock bar' : 'Service bar',
    } satisfies PatioBarFeature);
  }

  if (spec.stringLights) {
    // A zigzag of bulbs down the spine between light posts on alternate sides.
    const posts = Math.max(2, Math.round(spec.mainDockLengthFt / 30));
    for (let i = 0; i < posts; i++) {
      const z0 = dockZ0 + (spec.mainDockLengthFt * i) / posts;
      const z1 = dockZ0 + (spec.mainDockLengthFt * (i + 1)) / posts;
      const sign = i % 2 === 0 ? 1 : -1;
      features.push({
        id: gid('marina', 'spine-lights', i),
        kind: 'stringLights',
        from: { x: spec.centerX + sign * halfMain, y: deckY + 11, z: z0 },
        to: { x: spec.centerX - sign * halfMain, y: deckY + 11, z: z1 },
        sagFt: 2.4,
        bulbSpacingFt: 3,
        rainbow: true,
        hue: (i * 47) % 360,
      } satisfies StringLightsFeature);
    }
  }

  return { features, slips };
}
