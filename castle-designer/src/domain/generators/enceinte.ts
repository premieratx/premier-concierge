import type {
  BridgeFeature,
  EnceinteFeature,
  EnceinteGate,
  KnightFeature,
  MoatFeature,
  Point2,
  SiteFeature,
  TorchFeature,
} from '../types';
import { gid, headingOf } from './common';

/**
 * The outer works.
 *
 * A hexagonal enceinte around the whole castle, a moat outside it, three ways
 * in, and a bridge over each. Two of those are drawbridges on directly
 * opposite faces — one to the water, one to the road — built identically, so
 * the castle reads the same whether you arrive by boat or by car.
 *
 * The hexagon is the organising idea the marina already uses, brought ashore:
 * six faces, six corner drums, and gates on the faces rather than the corners,
 * so you always approach a wall head-on and never a point.
 *
 * Three things here are worth reading before the geometry:
 *
 *  - The moat is six separate basins, not a ring. Ground falls about fifty
 *    feet from the road corner to the lake corner and water will not do that.
 *    Each run is level and the corners between them are weirs, which is how a
 *    hillside moat has to be built and is the single largest hidden cost in
 *    this whole gesture.
 *  - The drawbridge counterweight is dimensioned, not decorative. Sandbag
 *    count comes out of the leaf's own weight and the arm it hangs on.
 *  - Torches are kerosene, and a kerosene flame that burns coloured is a
 *    mineral salt in the wick, not a coloured light pointed at fire. So the
 *    colour is a property of the torch, and the model draws it that way.
 */

export type GroundAt = (x: number, z: number) => number;

export interface EnceinteSpec {
  centre: Point2;
  /**
   * Half-width of the hexagon along X and along Z.
   *
   * A regular hexagon big enough to hold this castle would be six hundred and
   * thirty feet across the flats, and the parcel is six hundred deep. So the
   * hexagon is stretched to the parcel's own proportion — wide across the
   * hill, shallower down it. Six sides and six corners either way; the only
   * thing given up is that two of the six faces are longer than the other
   * four, which nobody standing in front of one will notice.
   */
  radiusXFt: number;
  radiusZFt: number;
  wallHeightFt: number;
  wallThicknessFt: number;
  merlonEveryFt: number;
  towerRadiusFt: number;
  towerHeightFt: number;
  /** Which faces get a way through, by edge index. */
  gateEdges: number[];
  /** Of those, which are drawbridges rather than fixed timber. */
  drawbridgeEdges: number[];
  gateWidthFt: number;
  /** Flat ground between the wall foot and the near bank of the moat. */
  bermFt: number;
  moatWidthFt: number;
  moatDepthFt: number;
  /** Freeboard from the near bank down to the water surface. */
  moatFreeboardFt: number;
  /**
   * Length of one level basin, in feet.
   *
   * This is the number that makes a moat on a hillside possible at all. Four
   * of the six faces run down the slope, falling forty or fifty feet end to
   * end, and water will not do that. So the trench is cut as a chain of short
   * level pools with a weir between each — a canal with steps in it. Shorter
   * runs mean less cut and more weirs; longer runs, the reverse.
   */
  basinRunFt: number;
  /** Spacing of torches along the wall head, in feet. */
  torchSpacingFt: number;
  groundAt: GroundAt;
}

/**
 * A three-inch oak deck on six-by-eight stringers, in pounds per square foot.
 * This is what sets the counterweight, so it is stated rather than guessed at
 * the point of use.
 */
export const DRAWBRIDGE_DECK_PSF = 14;

/** One filled sandbag. Fifty to sixty pounds is what a person can stack. */
export const SANDBAG_LB = 60;

/**
 * Margin on the counterweight over dead balance. At exactly balanced the leaf
 * hangs and does nothing; fifteen per cent is what makes it actually lift.
 */
export const COUNTERWEIGHT_MARGIN = 1.15;

/**
 * Corners of the hexagon, counter-clockwise from the +X corner.
 *
 * Corner zero is on +X and the two flats face +Z and −Z, which is what puts a
 * face square to the lake and a matching face square to the road.
 */
/**
 * The enceinte as built here.
 *
 * Fitted to the parcel: the two long faces square to the lake and the road,
 * the corners clear of the cabins to the east, and the back face far enough
 * forward that the moat behind it still lands inside the property line.
 */
export const DEFAULT_ENCEINTE: EnceinteSpec = {
  centre: { x: 0, z: -50 },
  radiusXFt: 290,
  radiusZFt: 240,
  wallHeightFt: 18,
  wallThicknessFt: 6,
  merlonEveryFt: 9,
  towerRadiusFt: 13,
  towerHeightFt: 30,
  // Water and road are directly opposite one another and both get a
  // drawbridge; the north-east face takes the drive off the road.
  gateEdges: [1, 4, 5],
  drawbridgeEdges: [1, 4],
  gateWidthFt: 16,
  bermFt: 12,
  moatWidthFt: 26,
  moatDepthFt: 10,
  moatFreeboardFt: 3,
  basinRunFt: 42,
  torchSpacingFt: 62,
  groundAt: () => 0,
};

export function hexCorners(centre: Point2, radiusX: number, radiusZ: number): Point2[] {
  return Array.from({ length: 6 }, (_, k) => {
    const angle = (k * Math.PI) / 3;
    return {
      x: centre.x + radiusX * Math.cos(angle),
      z: centre.z + radiusZ * Math.sin(angle),
    };
  });
}

/**
 * A convex polygon pushed outward by a constant distance, mitred at the
 * corners.
 *
 * Scaling would do for a regular hexagon — every edge stays parallel and moves
 * out by the same amount — but this one is stretched, so scaling would widen
 * the trench on the long faces and narrow it on the short ones. Offsetting
 * each edge along its own normal and intersecting the neighbours keeps the
 * moat one width all the way round, which is the thing that has to be true.
 */
export function offsetConvexPolygon(points: Point2[], distance: number): Point2[] {
  const n = points.length;
  const centroid = points.reduce(
    (acc, p) => ({ x: acc.x + p.x / n, z: acc.z + p.z / n }),
    { x: 0, z: 0 },
  );

  // Each edge as a line pushed out along its outward normal.
  const lines = points.map((p, i) => {
    const q = points[(i + 1) % n]!;
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    let nx = -dz / len;
    let nz = dx / len;
    const mid = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 };
    if (nx * (mid.x - centroid.x) + nz * (mid.z - centroid.z) < 0) {
      nx = -nx;
      nz = -nz;
    }
    return { px: p.x + nx * distance, pz: p.z + nz * distance, dx, dz };
  });

  // Corner i of the result is where edge i-1 and edge i cross.
  return Array.from({ length: n }, (_, i) => {
    const a = lines[(i + n - 1) % n]!;
    const b = lines[i]!;
    const denominator = a.dx * b.dz - a.dz * b.dx;
    if (Math.abs(denominator) < 1e-9) return { x: b.px, z: b.pz };
    const t = ((b.px - a.px) * b.dz - (b.pz - a.pz) * b.dx) / denominator;
    return { x: a.px + a.dx * t, z: a.pz + a.dz * t };
  });
}

function unitOut(centre: Point2, p: Point2): Point2 {
  const len = Math.hypot(p.x - centre.x, p.z - centre.z) || 1;
  return { x: (p.x - centre.x) / len, z: (p.z - centre.z) / len };
}

function midpoint(a: Point2, b: Point2): Point2 {
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
}

const FACE_NAME = [
  'south-east',
  'water',
  'south-west',
  'north-west',
  'road',
  'north-east',
];

export interface EnceinteBasin {
  edgeIndex: number;
  outer: Point2[];
  inner: Point2[];
  waterY: number;
  bedY: number;
  /** Top of the bank that holds the water in. */
  bankTopY: number;
  /** How far the bank has to be built up, castle side and field side. */
  innerBankHeightFt: number;
  outerBankHeightFt: number;
  /** Face area of built bank, in square feet. */
  bankSqFt: number;
  waterSqFt: number;
  cutCuYd: number;
  weirHeightFt: number;
}

export interface EnceintePlan {
  spec: EnceinteSpec;
  vertices: Point2[];
  vertexY: number[];
  gates: EnceinteGate[];
  basins: EnceinteBasin[];
  perimeterFt: number;
  faceSqFt: number;
  /** Water in the moat when every basin is full, in square feet. */
  moatWaterSqFt: number;
  moatCutCuYd: number;
  /** Built bank holding the trench on the downhill side, in square feet. */
  moatBankSqFt: number;
  /** Fall from the highest basin to the lowest, in feet. */
  moatFallFt: number;
}

/** Area of any simple polygon, by the shoelace formula. */
function polygonAreaSqFt(points: Point2[]): number {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    total += a.x * b.z - b.x * a.z;
  }
  return Math.abs(total) / 2;
}

/**
 * Lay out the enceinte, its gates and its moat.
 *
 * The moat rings are plain scaled hexagons rather than offset outlines: a
 * regular hexagon scaled about its centre keeps every edge parallel to the one
 * it came from, so the trench is a constant width all the way round without
 * any offsetting arithmetic.
 */
export function planEnceinte(spec: EnceinteSpec): EnceintePlan {
  const { centre, groundAt } = spec;
  const vertices = hexCorners(centre, spec.radiusXFt, spec.radiusZFt);
  const vertexY = vertices.map((v) => groundAt(v.x, v.z));

  const innerRing = offsetConvexPolygon(vertices, spec.bermFt + spec.wallThicknessFt / 2);
  const outerRing = offsetConvexPolygon(
    vertices,
    spec.bermFt + spec.wallThicknessFt / 2 + spec.moatWidthFt,
  );

  /* Gates ---------------------------------------------------------- */
  const gates: EnceinteGate[] = spec.gateEdges.map((edgeIndex) => {
    const p = vertices[edgeIndex]!;
    const q = vertices[(edgeIndex + 1) % 6]!;
    const mid = midpoint(p, q);
    const outward = unitOut(centre, mid);
    return {
      id: gid('gate', edgeIndex),
      edgeIndex,
      centre: mid,
      outward,
      rotationY: headingOf(outward.x, outward.z),
      widthFt: spec.gateWidthFt,
      sillY: groundAt(mid.x, mid.z),
      drawbridge: spec.drawbridgeEdges.includes(edgeIndex),
      label: `${FACE_NAME[edgeIndex] ?? `face ${edgeIndex}`} gate`,
    };
  });

  /* Moat ----------------------------------------------------------- */
  // Each pool is level, so the trench steps down the hill in short runs
  // instead of pretending water climbs. Within a pool the ground still falls
  // a little across the width of the trench, so each one is part cut and part
  // embankment: dug into the uphill bank, walled up on the downhill one.
  // Setting the water at the mean of the two banks balances those against
  // each other.
  const basins: EnceinteBasin[] = [];
  for (let e = 0; e < 6; e++) {
    const innerA = innerRing[e]!;
    const innerB = innerRing[(e + 1) % 6]!;
    const outerA = outerRing[e]!;
    const outerB = outerRing[(e + 1) % 6]!;
    const edgeRun = Math.hypot(innerB.x - innerA.x, innerB.z - innerA.z);
    const pools = Math.max(1, Math.round(edgeRun / spec.basinRunFt));

    for (let p = 0; p < pools; p++) {
      const t0 = p / pools;
      const t1 = (p + 1) / pools;
      const lerp = (a: Point2, b: Point2, t: number): Point2 => ({
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
      });
      const inner = [lerp(innerA, innerB, t0), lerp(innerA, innerB, t1)];
      const outer = [lerp(outerA, outerB, t0), lerp(outerA, outerB, t1)];
      const quad = [inner[0]!, inner[1]!, outer[1]!, outer[0]!];
      const waterSqFt = polygonAreaSqFt(quad);

      const innerMid = midpoint(inner[0]!, inner[1]!);
      const outerMid = midpoint(outer[0]!, outer[1]!);
      const samples = [...quad, innerMid, outerMid].map((q) => groundAt(q.x, q.z));
      const low = Math.min(...samples);
      const high = Math.max(...samples);

      const waterY = (low + high) / 2 - spec.moatFreeboardFt;
      const bedY = waterY - spec.moatDepthFt;
      const bankTopY = waterY + spec.moatFreeboardFt;

      // What decides the bank is the lowest point on it, not its middle:
      // water leaves by the lowest point it can find.
      const lowestOn = (points: Point2[]) =>
        Math.min(...points.map((q) => groundAt(q.x, q.z)));
      const innerBankHeightFt = Math.max(0, bankTopY - lowestOn([...inner, innerMid]));
      const outerBankHeightFt = Math.max(0, bankTopY - lowestOn([...outer, outerMid]));
      const runFt = Math.hypot(inner[1]!.x - inner[0]!.x, inner[1]!.z - inner[0]!.z);
      const meanGrade = samples.reduce((a, g) => a + g, 0) / samples.length;

      basins.push({
        edgeIndex: e,
        inner,
        outer,
        waterY,
        bedY,
        bankTopY,
        innerBankHeightFt,
        outerBankHeightFt,
        bankSqFt: runFt * (innerBankHeightFt + outerBankHeightFt),
        waterSqFt,
        // Plan area by mean depth of cut. Where the ground is already below
        // the bed it is fill, and the bank line above carries that cost.
        cutCuYd: (waterSqFt * Math.max(0, meanGrade - bedY)) / 27,
        weirHeightFt: 0,
      });
    }
  }

  // A weir between every pair of pools holds the step between them. Round the
  // whole ring these add up to the fall, which is the price of the gesture.
  for (const [i, basin] of basins.entries()) {
    const next = basins[(i + 1) % basins.length]!;
    basin.weirHeightFt = Math.max(0, basin.waterY - next.waterY);
  }

  const edgeLengths = vertices.map((p, i) => {
    const q = vertices[(i + 1) % 6]!;
    return Math.hypot(q.x - p.x, q.z - p.z);
  });
  const perimeterFt = edgeLengths.reduce((s, l) => s + l, 0);
  const openFt = gates.length * spec.gateWidthFt;
  const waterYs = basins.map((b) => b.waterY);

  return {
    spec,
    vertices,
    vertexY,
    gates,
    basins,
    perimeterFt,
    // Both faces, less the openings.
    faceSqFt: (perimeterFt - openFt) * spec.wallHeightFt * 2,
    moatWaterSqFt: basins.reduce((s, b) => s + b.waterSqFt, 0),
    moatCutCuYd: basins.reduce((s, b) => s + b.cutCuYd, 0),
    moatBankSqFt: basins.reduce((s, b) => s + b.bankSqFt, 0),
    moatFallFt: Math.max(...waterYs) - Math.min(...waterYs),
  };
}

/**
 * What a drawbridge leaf weighs and what it takes to lift it.
 *
 * The leaf is a cantilever hinged at the sill, so its dead load acts at half
 * its length. The counterweight hangs on a short arm the other side of the
 * hinge, which is why the crate is heavy: a twelve-foot arm has to answer a
 * seventeen-foot one.
 */
export function drawbridgeMechanism(lengthFt: number, widthFt: number, armFt: number) {
  const leafWeightLb = lengthFt * widthFt * DRAWBRIDGE_DECK_PSF;
  const momentFtLb = (leafWeightLb * lengthFt) / 2;
  const counterweightLb = (momentFtLb / armFt) * COUNTERWEIGHT_MARGIN;
  return {
    leafWeightLb,
    momentFtLb,
    counterweightLb,
    sandbagCount: Math.ceil(counterweightLb / SANDBAG_LB),
    sandbagWeightLb: SANDBAG_LB,
  };
}

/** A run of torches from one point to another, inclusive of both ends. */
export function torchLine(
  idPrefix: string,
  from: { x: number; z: number },
  to: { x: number; z: number },
  spacingFt: number,
  groundAt: GroundAt,
  mount: TorchFeature['mount'],
  options: { heightFt?: number; startHue?: number; castLight?: boolean; both?: boolean } = {},
): TorchFeature[] {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const run = Math.hypot(dx, dz);
  const count = Math.max(2, Math.round(run / spacingFt) + 1);
  const ux = dx / run;
  const uz = dz / run;
  // Perpendicular, so a walkway can be lit from both kerbs.
  const px = -uz;
  const pz = ux;
  const sides = options.both ? [-1, 1] : [0];
  const heightFt = options.heightFt ?? 7;
  const out: TorchFeature[] = [];

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    for (const side of sides) {
      const x = from.x + dx * t + px * side * 5;
      const z = from.z + dz * t + pz * side * 5;
      out.push({
        id: gid(idPrefix, i, side + 1),
        kind: 'torch',
        position: { x, y: groundAt(x, z), z },
        heightFt,
        // Walk the spectrum along the path, so the way in reads as a run of
        // colour rather than a line of identical lamps.
        hue: ((options.startHue ?? 0) + i * 34 + (side + 1) * 17) % 360,
        rainbow: true,
        gphKerosene: 0.14,
        castLight: options.castLight ?? false,
        mount,
      });
    }
  }
  return out;
}

/** The enceinte, its moat, its crossings, its guard and its torches. */
export function enceinteFeatures(plan: EnceintePlan): SiteFeature[] {
  const spec = plan.spec;
  const features: SiteFeature[] = [];

  features.push({
    id: 'enceinte',
    kind: 'enceinte',
    vertices: plan.vertices,
    vertexY: plan.vertexY,
    wallHeightFt: spec.wallHeightFt,
    wallThicknessFt: spec.wallThicknessFt,
    merlonEveryFt: spec.merlonEveryFt,
    towerRadiusFt: spec.towerRadiusFt,
    towerHeightFt: spec.towerHeightFt,
    gates: plan.gates,
    perimeterFt: plan.perimeterFt,
    faceSqFt: plan.faceSqFt,
    label: 'Outer enceinte',
  } satisfies EnceinteFeature);

  for (const basin of plan.basins) {
    features.push({
      id: gid('moat', basin.edgeIndex),
      kind: 'moat',
      outer: basin.outer,
      inner: basin.inner,
      waterY: basin.waterY,
      bedY: basin.bedY,
      bankTopY: basin.bankTopY,
      innerBankHeightFt: basin.innerBankHeightFt,
      outerBankHeightFt: basin.outerBankHeightFt,
      bankSqFt: basin.bankSqFt,
      widthFt: spec.moatWidthFt,
      waterSqFt: basin.waterSqFt,
      cutCuYd: basin.cutCuYd,
      weirHeightFt: basin.weirHeightFt,
      label: `Moat basin ${basin.edgeIndex + 1}`,
    } satisfies MoatFeature);
  }

  /* Crossings ------------------------------------------------------ */
  for (const gate of plan.gates) {
    // From the sill, out across the berm and the moat, landing on the far
    // bank with a couple of feet to spare.
    const spanFt = spec.bermFt + spec.moatWidthFt + 4;
    const landX = gate.centre.x + gate.outward.x * spanFt;
    const landZ = gate.centre.z + gate.outward.z * spanFt;
    const landY = spec.groundAt(landX, landZ);
    const widthFt = gate.widthFt - 2;
    const mech = drawbridgeMechanism(spanFt, widthFt, 12);

    features.push({
      id: gid('bridge', gate.edgeIndex),
      kind: 'bridge',
      from: { x: landX, y: landY, z: landZ },
      to: { x: gate.centre.x, y: gate.sillY, z: gate.centre.z },
      widthFt,
      drawbridge: gate.drawbridge,
      raised: 0,
      leafWeightLb: mech.leafWeightLb,
      counterweightArmFt: 12,
      sandbagCount: gate.drawbridge ? mech.sandbagCount : 0,
      sandbagWeightLb: mech.sandbagWeightLb,
      gaffHeightFt: spec.wallHeightFt + 16,
      label: gate.drawbridge ? `${gate.label} drawbridge` : `${gate.label} bridge`,
    } satisfies BridgeFeature);

    /* The guard: two knights on the outer bank, facing out. */
    for (const side of [-1, 1] as const) {
      const px = -gate.outward.z * side * (widthFt / 2 + 4);
      const pz = gate.outward.x * side * (widthFt / 2 + 4);
      const x = landX + gate.outward.x * 5 + px;
      const z = landZ + gate.outward.z * 5 + pz;
      features.push({
        id: gid('knight', gate.edgeIndex, side + 1),
        kind: 'knight',
        position: { x, y: spec.groundAt(x, z), z },
        // Facing out, away from the gate, which is the only direction a
        // guard on a bridge head is any use.
        rotationY: gate.rotationY,
        heightFt: 6.2,
        hue: (gate.edgeIndex * 60 + (side + 1) * 24) % 360,
        post: gate.label,
        label: `Guard, ${gate.label}`,
      } satisfies KnightFeature);
    }

    /* Torches either side of the opening, and at the bridge head. */
    for (const side of [-1, 1] as const) {
      const px = -gate.outward.z * side * (gate.widthFt / 2 + 3);
      const pz = gate.outward.x * side * (gate.widthFt / 2 + 3);
      const gx = gate.centre.x + px;
      const gz = gate.centre.z + pz;
      features.push({
        id: gid('torch-gate', gate.edgeIndex, side + 1),
        kind: 'torch',
        position: { x: gx, y: gate.sillY, z: gz },
        heightFt: 11,
        hue: (gate.edgeIndex * 60 + (side + 1) * 30) % 360,
        rainbow: true,
        gphKerosene: 0.2,
        castLight: true,
        mount: 'gate',
        label: `${gate.label} torch`,
      } satisfies TorchFeature);

      const bx = landX + px;
      const bz = landZ + pz;
      features.push({
        id: gid('torch-bridge', gate.edgeIndex, side + 1),
        kind: 'torch',
        position: { x: bx, y: spec.groundAt(bx, bz), z: bz },
        heightFt: 8,
        hue: (gate.edgeIndex * 60 + (side + 1) * 30 + 40) % 360,
        rainbow: true,
        gphKerosene: 0.14,
        castLight: false,
        mount: 'bridge',
      } satisfies TorchFeature);
    }
  }

  /* Torches on every corner drum, and along every wall head. */
  for (let k = 0; k < 6; k++) {
    const v = plan.vertices[k]!;
    features.push({
      id: gid('torch-tower', k),
      kind: 'torch',
      position: { x: v.x, y: plan.vertexY[k]! + spec.towerHeightFt, z: v.z },
      heightFt: 4,
      hue: (k * 60) % 360,
      rainbow: true,
      gphKerosene: 0.24,
      castLight: true,
      mount: 'tower',
      label: `Corner drum ${k + 1}`,
    } satisfies TorchFeature);

    const p = plan.vertices[k]!;
    const q = plan.vertices[(k + 1) % 6]!;
    const run = Math.hypot(q.x - p.x, q.z - p.z);
    const steps = Math.max(1, Math.round(run / spec.torchSpacingFt));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = p.x + (q.x - p.x) * t;
      const z = p.z + (q.z - p.z) * t;
      // Skip the ones that would stand in a gate opening.
      const inGate = plan.gates.some(
        (g) =>
          g.edgeIndex === k && Math.hypot(x - g.centre.x, z - g.centre.z) < g.widthFt / 2 + 6,
      );
      if (inGate) continue;
      features.push({
        id: gid('torch-wall', k, i),
        kind: 'torch',
        position: {
          x,
          y: spec.groundAt(x, z) + spec.wallHeightFt,
          z,
        },
        heightFt: 3.4,
        hue: (k * 60 + i * 25) % 360,
        rainbow: true,
        gphKerosene: 0.14,
        castLight: false,
        mount: 'wall',
      } satisfies TorchFeature);
    }
  }

  return features;
}
