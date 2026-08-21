/**
 * Domain model for the container castle designer.
 *
 * World units are FEET. One Three.js unit == one foot.
 *
 * Axis convention:
 *   +X  east/west run of the site
 *   +Y  up (elevation)
 *   +Z  north/south run of the site
 *
 * A container's `position` is the MINIMUM CORNER of its axis-aligned bounding
 * box: the smallest x, the base elevation (y = 0 sits on grade), the smallest z.
 * Storing the min corner rather than the centroid is what makes grid snapping
 * and corner-casting alignment (rule R1) exact integer comparisons instead of
 * half-dimension floating point arithmetic.
 */

export type ContainerType = '40HC' | '20ST';

/** Containers only ever sit square to the grid. Free rotation is not a thing. */
export type Rotation = 0 | 90;

/**
 * How a container participates in the castle.
 *  - `structural` — load-bearing box in the main massing
 *  - `sealed`     — conditioned envelope (insulated, thermally broken)
 *  - `wall`       — one leaf of a wall assembly, e.g. a great hall side
 *  - `tower`      — part of a stacked corner tower
 */
export type ContainerRole = 'structural' | 'sealed' | 'wall' | 'tower';

export type Finish = 'painted' | 'stone';

/**
 * Which programme a container belongs to. The reference cost validation is
 * run against the castle zone alone, so lodging and marina build-out never
 * quietly inflate the castle's dollars per square foot.
 */
export type ContainerZone = 'castle' | 'lodging' | 'marina' | 'backOfHouse';

/**
 * Which face of a container an opening is cut into, in the container's own
 * local frame (before rotation is applied).
 *  - `sideA` / `sideB` — the two long walls (40' or 20' x wall height)
 *  - `endA` / `endB`   — the two 8'-wide ends (endB is the door end)
 *  - `roof`            — a roof penetration
 */
export type WallFace = 'sideA' | 'sideB' | 'endA' | 'endB' | 'roof';

/**
 * A cut in a container wall. Every one of these costs welded tube-steel
 * reinforcement, which is the whole pedagogical point of the tool.
 *
 * `offsetU` runs along the face from its origin corner; `offsetV` runs up from
 * the container floor (or, for a roof cut, across the 8' width).
 */
export interface Opening {
  id: string;
  face: WallFace;
  /** Feet, along the face. */
  width: number;
  /** Feet, up the face. */
  height: number;
  /** Feet from the face's origin corner, along the face. */
  offsetU: number;
  /** Feet from the container floor, up the face. */
  offsetV: number;
  label?: string;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Container {
  id: string;
  type: ContainerType;
  /** Minimum corner of the bounding box, in feet. See module docblock. */
  position: Vec3;
  rotation: Rotation;
  role: ContainerRole;
  openings: Opening[];
  finish: Finish;
  /** Optional human name, e.g. "NW tower L2". Shown in the inspector. */
  label?: string;
  /** Defaults to `castle` when absent. */
  zone?: ContainerZone;
  /** Display layer. Falls back to `layerOfContainer` when absent. */
  layer?: ModelLayer;
}

export interface Layout {
  /** Schema version, bumped when the serialized shape changes. */
  version: number;
  id: string;
  name: string;
  /** Declared for forward compatibility; feet is the only supported unit. */
  units: 'ft';
  containers: Container[];
  /** Non-structural castle trim emitted by the vocabulary generators. */
  decor: Decor[];
  /** The dragon, the fire pits, the stages, the marina, the lodging. */
  features: SiteFeature[];
  /** Water, shoreline and which marina scheme is being shown. */
  site: SiteDefinition;
  notes?: string;
}

/** Which marina is on screen: what is there today, or the build-out. */
export type MarinaPhase = 'existing' | 'enhanced';

export interface SiteDefinition {
  /** Parcel width along X, in feet. */
  sizeX: number;
  /** Parcel depth along Z, from the road down to the water. */
  sizeZ: number;
  /**
   * Nominal shoreline on the centre line. The real one curves — see
   * `shorelineZAt` — and this is only for code that needs a single number.
   */
  shorelineZ: number;
  /**
   * Water surface elevation. Zero: the lake is the datum, and everything on
   * land is feet above it.
   */
  waterLevelFt: number;
  marinaPhase: MarinaPhase;
  /**
   * Which landform the layout stands on. `flat` is a table top, used by the
   * small test fragments; `cypressCreek` is the real parcel with its terraces.
   */
  terrain: TerrainModel;
}

export type TerrainModel = 'flat' | 'cypressCreek';

/* ------------------------------------------------------------------ *
 * Decorative geometry
 *
 * The castle vocabulary generators emit containers (which are structure,
 * and which the rule checker and cost engine care about) plus decor,
 * which is everything that makes the massing read as a castle rather
 * than as a stack of boxes. Decor is cheap, non-structural, and does not
 * participate in the stacking rules.
 * ------------------------------------------------------------------ */

export type DecorKind =
  /** One tooth of a crenellated parapet. */
  | 'merlon'
  /** Solid parapet run behind the merlons. */
  | 'parapet'
  /** Overhanging corner turret. */
  | 'bartizan'
  /** Conical cap on a bartizan or tower. */
  | 'conicalRoof'
  /** Sloped plinth panel at the base of a wall. */
  | 'batter'
  /** Truss bay spanning a great hall. */
  | 'truss'
  /** Wall-head walkway deck. */
  | 'walkway'
  /** Hanging banner. */
  | 'banner'
  /** Stone arch surround around an opening. */
  | 'archStone'
  /** Gate leaf. */
  | 'gate'
  /** Timber deck or tent platform. */
  | 'deck'
  /** Shed or gable roof over a lodging unit. */
  | 'shedRoof'
  /** Column, piling, or light post. */
  | 'post'
  /** Canvas glamping tent. */
  | 'tent'
  /** Open shade structure. */
  | 'pergola'
  /** Dining or cocktail table. */
  | 'table'
  /** Seat. */
  | 'chair'
  /** Sun lounger. */
  | 'lounger'
  /** Table umbrella or shade sail. */
  | 'umbrella'
  /** Area light on a pole. */
  | 'poleLight'
  /** Path bollard. */
  | 'bollard'
  /** Ground-mounted uplight washing a wall. */
  | 'uplight';

/**
 * Display layers.
 *
 * These are a property of the model, not of the viewer: a generator knows that
 * the deck it just emitted belongs to the bunkhouse and not to the glamping
 * platforms, and nothing downstream can work that out from geometry alone.
 * The viewer just toggles them.
 */
export type ModelLayer =
  // Castle
  | 'outerWall'
  | 'moat'
  | 'bridges'
  | 'knights'
  | 'torches'
  | 'curtainWall'
  | 'towers'
  | 'greatHall'
  | 'keep'
  | 'crenellation'
  | 'wallWalk'
  | 'bartizans'
  | 'batter'
  | 'gate'
  // Lodging
  | 'cabins'
  | 'bunkhouse'
  | 'glamping'
  // Marina
  | 'docks'
  | 'roofDecks'
  | 'shipStore'
  | 'slipsStandard'
  | 'slipsPremier'
  | 'patios'
  | 'boats'
  | 'swimToys'
  // Programme
  | 'bars'
  | 'furniture'
  | 'stages'
  | 'overwaterStage'
  | 'firePits'
  | 'dragon'
  | 'dragonFire'
  // Site
  | 'stringLights'
  | 'areaLighting'
  | 'trees'
  | 'people'
  | 'water'
  | 'contours'
  | 'terraces'
  | 'grid'
  | 'capacity'
  | 'edges';

export interface Decor {
  id: string;
  kind: DecorKind;
  /** Centroid in feet. */
  center: Vec3;
  /** Box extents in feet. Ignored by decor drawn from `radius`. */
  size: Vec3;
  /** Radius in feet for cylindrical and conical decor. */
  radius?: number;
  /** Outward tilt in radians, used by battered plinth panels. */
  slope?: number;
  /** Rotation about Y, in radians. Decor is not restricted to the grid. */
  rotationY?: number;
  finish?: Finish;
  /** Override colour; otherwise the kind's default is used. */
  color?: string;
  /** Which programme this trim belongs to. Defaults to `castle`. */
  zone?: ContainerZone;
  /** Display layer. Falls back to `layerOfDecor` when absent. */
  layer?: ModelLayer;
}

/* ------------------------------------------------------------------ *
 * Site features
 *
 * Everything on the property that is not a container and not castle
 * trim: the dragon, the fire pits, the stages. These carry their own
 * cost lines and are deliberately kept out of the container takeoff so
 * the $/sq ft on the building itself stays honest.
 * ------------------------------------------------------------------ */

export interface DragonFeature {
  id: string;
  kind: 'dragon';
  /** Ground point under the dragon's chest, in feet. */
  position: Vec3;
  rotationY: number;
  /** Nose to tail tip, in feet. */
  lengthFt: number;
  /** Wingtip to wingtip, in feet. */
  wingspanFt: number;
  /** Height at the shoulder, in feet. */
  shoulderHeightFt: number;
  /** Whether the flame effect runs. */
  breathingFire: boolean;
  /** Seconds between fire bursts. */
  burstPeriodS: number;
  label?: string;
}

export interface FirePitFeature {
  id: string;
  kind: 'firePit';
  position: Vec3;
  /** Radius of the stone ring, in feet. */
  radiusFt: number;
  /** Base hue in degrees; the rainbow cycle starts here. */
  hue: number;
  /** Cycle the flame through the spectrum rather than burning amber. */
  rainbow: boolean;
  label?: string;
}

export type StageRoof = 'open' | 'truss' | 'container';

export interface StageFeature {
  id: string;
  kind: 'stage';
  position: Vec3;
  rotationY: number;
  widthFt: number;
  depthFt: number;
  /** Deck height above grade, in feet. */
  heightFt: number;
  roof: StageRoof;
  name: string;
}

/* ------------------------------------------------------------------ *
 * Marina
 * ------------------------------------------------------------------ */

export type DockRole =
  /** The spine running out from shore. */
  | 'main'
  /** A finger between two berths. */
  | 'finger'
  /** The hinged ramp from the bank down to the floating dock. */
  | 'gangway'
  /** A wide deck platform — bar, lounge, stage apron. */
  | 'platform';

export interface DockFeature {
  id: string;
  kind: 'dock';
  /**
   * Centre of the deck surface, in feet. `lengthFt` runs along the local +X
   * axis and `widthFt` along local +Z, both then turned by `rotationY`.
   */
  position: Vec3;
  rotationY: number;
  lengthFt: number;
  widthFt: number;
  role: DockRole;
  /** Party lights strung down the length of it. */
  stringLights: boolean;
  label?: string;
}

/**
 * Standard slips are a berth and a cleat. Premier slips are the product:
 * a shaded over-slip patio, furnishings, a bar, lights, and the swim toys —
 * things a slip rental almost never includes, which is exactly why they can
 * be sold separately or bundled into a higher rate.
 */
export type SlipTier = 'standard' | 'premier';

export type BoatKind = 'none' | 'runabout' | 'pontoon' | 'cruiser';

export interface SlipFeature {
  id: string;
  kind: 'slip';
  /** Centre of the berth's water footprint, at the water surface. */
  position: Vec3;
  rotationY: number;
  /** Beam clearance between the fingers, in feet. */
  widthFt: number;
  lengthFt: number;
  tier: SlipTier;
  slipNumber: number;
  /** Shade structure and deck built over the berth. */
  patio: boolean;
  /** Rented furniture package — the add-on revenue line. */
  furnished: boolean;
  ropeSwing: boolean;
  jumpPlatform: boolean;
  bar: boolean;
  stringLights: boolean;
  boat: BoatKind;
  label?: string;
}

/**
 * One hexagon of the marina: a floating ring of dock, sixty feet a side,
 * roofed at sixteen feet with a clear deck over photovoltaic.
 *
 * Berths hang off the outside; the middle is left open as a swimming lagoon
 * with a safety net below it. The hub carries the ship store and the roof
 * stage instead of berths and water.
 */
export interface HexDockFeature {
  id: string;
  kind: 'hexDock';
  /** Centre of the hexagon, at deck level. */
  position: Vec3;
  rotationY: number;
  /** Side length, which for a regular hexagon is also its circumradius. */
  sideFt: number;
  /** Width of the walkway ringing the inside of the hexagon. */
  perimeterWalkFt: number;
  role: 'hub' | 'satellite';
  /** Height of the roof deck above the dock deck. */
  roofHeightFt: number;
  /** How far the roof reaches past the hexagon to cover the berths. */
  roofOffsetFt: number;
  /** Floating deck area, in square feet. */
  deckSqFt: number;
  roofSqFt: number;
  /** Roof area carrying panels under the clear decking. */
  solarSqFt: number;
  /** Open swimming water inside the ring, in square feet. */
  swimSqFt: number;
  /** Depth of the safety net below the lagoon surface, in feet. */
  netDepthFt: number;
  /** Which corner the walkway lands on, by vertex index. */
  walkwayVertex: number;
  /** What is on the roof deck. */
  amenities: { bar: boolean; jumpPlatform: boolean; ropeSwing: boolean };
  label?: string;
}

/**
 * A walkway between two docks.
 *
 * The ones out to the satellites retract: pulling them in before a storm
 * leaves seven independent hexagons rather than one rigid raft, which is the
 * difference between riding out a blow and losing the marina.
 */
export interface WalkwayFeature {
  id: string;
  kind: 'walkway';
  from: Vec3;
  to: Vec3;
  widthFt: number;
  retractable: boolean;
}

export interface OverwaterStageFeature {
  id: string;
  kind: 'overwaterStage';
  position: Vec3;
  rotationY: number;
  widthFt: number;
  depthFt: number;
  /** Deck height above the water surface, in feet. */
  deckHeightFt: number;
  roof: StageRoof;
  name: string;
}

export interface PatioBarFeature {
  id: string;
  kind: 'patioBar';
  position: Vec3;
  rotationY: number;
  widthFt: number;
  depthFt: number;
  heightFt: number;
  overWater: boolean;
  name: string;
}

/** A catenary run of party lights between two points. */
export interface StringLightsFeature {
  id: string;
  kind: 'stringLights';
  from: Vec3;
  to: Vec3;
  /** How far the run dips at midspan, in feet. */
  sagFt: number;
  bulbSpacingFt: number;
  /** Cycle the bulbs through the spectrum instead of warm white. */
  rainbow: boolean;
  hue?: number;
}

/* ------------------------------------------------------------------ *
 * Lodging
 * ------------------------------------------------------------------ */

export type AccommodationStyle =
  | 'containerCabin'
  | 'towerSuite'
  | 'bunkhouse'
  | 'glamping'
  | 'gatehouseLoft';

/**
 * A lodging cluster. The containers that make it up live in `containers`
 * with `zone: 'lodging'`; this record carries the programme numbers — keys,
 * heads in beds, conditioned area — that the containers alone cannot express.
 */
export interface AccommodationFeature {
  id: string;
  kind: 'accommodation';
  position: Vec3;
  rotationY: number;
  style: AccommodationStyle;
  /** Rentable keys in this cluster. */
  units: number;
  /** Total heads in beds. */
  sleeps: number;
  /** Conditioned square feet across the cluster. */
  sqFt: number;
  name: string;
}


/* ------------------------------------------------------------------ *
 * The outer works: enceinte, moat, bridges, torches, guard.
 * ------------------------------------------------------------------ */

export interface Point2 {
  x: number;
  z: number;
}

/** A way through the enceinte, on one of its six faces. */
export interface EnceinteGate {
  id: string;
  /** Which face, by edge index. */
  edgeIndex: number;
  /** Middle of the opening, on the wall line. */
  centre: Point2;
  /** Unit vector pointing out of the castle through this gate. */
  outward: Point2;
  /** Heading for anything standing in the opening. */
  rotationY: number;
  widthFt: number;
  /** Grade at the sill. */
  sillY: number;
  drawbridge: boolean;
  label: string;
}

/**
 * The outer enceinte: a hexagon of wall around the whole castle, with a drum
 * tower on every corner and three ways in.
 */
export interface EnceinteFeature {
  id: string;
  kind: 'enceinte';
  /** Corners of the wall line, counter-clockwise. */
  vertices: Point2[];
  /** Grade at each corner, in the same order. */
  vertexY: number[];
  wallHeightFt: number;
  wallThicknessFt: number;
  merlonEveryFt: number;
  towerRadiusFt: number;
  towerHeightFt: number;
  gates: EnceinteGate[];
  /** Length of wall on the ground, in feet. */
  perimeterFt: number;
  /** Both faces of the wall, in square feet — what gets clad. */
  faceSqFt: number;
  label?: string;
}

/**
 * One basin of the moat.
 *
 * The moat is six basins rather than one ring because the ground falls fifty
 * feet from the road corner to the lake corner. Water does not do that. Each
 * run is level, and the corners between them are weirs.
 */
export interface MoatFeature {
  id: string;
  kind: 'moat';
  /** Basin in plan, outer bank then inner bank. */
  outer: Point2[];
  inner: Point2[];
  /** Water surface elevation. */
  waterY: number;
  /** Bed of the basin. */
  bedY: number;
  /** Top of the bank that holds the water in. */
  bankTopY: number;
  /** How far the bank is built up on the castle side and the field side. */
  innerBankHeightFt: number;
  outerBankHeightFt: number;
  /** Face area of built bank, in square feet. */
  bankSqFt: number;
  widthFt: number;
  /** Surface area of water, in square feet. */
  waterSqFt: number;
  /** Excavation, in cubic yards. */
  cutCuYd: number;
  /** Weir wall at the low end of this basin, in feet of retained head. */
  weirHeightFt: number;
  label?: string;
}

/** A crossing of the moat: a fixed timber bridge, or a drawbridge. */
export interface BridgeFeature {
  id: string;
  kind: 'bridge';
  /** Outer bank end. */
  from: Vec3;
  /** Gate sill end, which is the hinge on a drawbridge. */
  to: Vec3;
  widthFt: number;
  drawbridge: boolean;
  /**
   * Where the leaf sits, 0 down and 1 vertical. The model animates this; the
   * number here is where it starts.
   */
  raised: number;
  /** Timber leaf weight, in pounds. */
  leafWeightLb: number;
  /** Radius the counterweight hangs at, in feet. */
  counterweightArmFt: number;
  /** Sandbags in the drop crate. */
  sandbagCount: number;
  sandbagWeightLb: number;
  /** Height of the gaff the lifting chains run over. */
  gaffHeightFt: number;
  label?: string;
}

/**
 * A kerosene torch.
 *
 * Rainbow ones burn a mineral-salt wick in the kerosene, so the colour is in
 * the flame rather than in a light pointed at it.
 */
export interface TorchFeature {
  id: string;
  kind: 'torch';
  position: Vec3;
  /** Post height to the bowl, in feet. */
  heightFt: number;
  hue: number;
  rainbow: boolean;
  /** Kerosene burn, in gallons an hour. */
  gphKerosene: number;
  /** Whether this one throws a light, or is only a flame. */
  castLight: boolean;
  mount: 'tower' | 'wall' | 'gate' | 'bridge' | 'walkway' | 'shore';
  label?: string;
}

/** A knight on guard, standing outside a bridge head. */
export interface KnightFeature {
  id: string;
  kind: 'knight';
  position: Vec3;
  rotationY: number;
  heightFt: number;
  /** Livery hue, which is also the shield. */
  hue: number;
  /** Which crossing this one is posted on. */
  post: string;
  label?: string;
}

export type SiteFeature =
  | HexDockFeature
  | WalkwayFeature
  | DragonFeature
  | FirePitFeature
  | StageFeature
  | DockFeature
  | SlipFeature
  | OverwaterStageFeature
  | PatioBarFeature
  | StringLightsFeature
  | AccommodationFeature
  | EnceinteFeature
  | MoatFeature
  | BridgeFeature
  | TorchFeature
  | KnightFeature;

/** Narrowing helper so panels can filter a mixed feature array by kind. */
export function featuresOfKind<K extends SiteFeature['kind']>(
  features: SiteFeature[],
  kind: K,
): Extract<SiteFeature, { kind: K }>[] {
  return features.filter((f): f is Extract<SiteFeature, { kind: K }> => f.kind === kind);
}

/* ------------------------------------------------------------------ *
 * Layer resolution
 *
 * Generators set `layer` explicitly wherever the answer is not obvious from
 * the geometry. These fallbacks cover everything else, so a hand-written or
 * imported layout still lands on a sensible layer.
 * ------------------------------------------------------------------ */

const DECOR_LAYER: Record<DecorKind, ModelLayer> = {
  merlon: 'crenellation',
  parapet: 'crenellation',
  banner: 'crenellation',
  bartizan: 'bartizans',
  conicalRoof: 'bartizans',
  batter: 'batter',
  truss: 'greatHall',
  walkway: 'wallWalk',
  archStone: 'gate',
  gate: 'gate',
  deck: 'cabins',
  shedRoof: 'cabins',
  post: 'cabins',
  tent: 'glamping',
  pergola: 'patios',
  table: 'furniture',
  chair: 'furniture',
  lounger: 'furniture',
  umbrella: 'furniture',
  poleLight: 'areaLighting',
  bollard: 'areaLighting',
  uplight: 'areaLighting',
};

export function layerOfDecor(decor: Decor): ModelLayer {
  return decor.layer ?? DECOR_LAYER[decor.kind];
}

export function layerOfContainer(container: Container): ModelLayer {
  if (container.layer) return container.layer;
  if (container.zone === 'lodging') return 'cabins';
  switch (container.role) {
    case 'tower':
      return 'towers';
    case 'wall':
      return 'greatHall';
    case 'sealed':
      return 'keep';
    default:
      return 'curtainWall';
  }
}
