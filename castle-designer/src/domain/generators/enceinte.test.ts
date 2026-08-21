import { describe, expect, it } from 'vitest';
import { featuresOfKind } from '../types';
import {
  COUNTERWEIGHT_MARGIN,
  DEFAULT_ENCEINTE,
  DRAWBRIDGE_DECK_PSF,
  SANDBAG_LB,
  drawbridgeMechanism,
  enceinteFeatures,
  hexCorners,
  offsetConvexPolygon,
  planEnceinte,
  torchLine,
} from './enceinte';

const spec = { ...DEFAULT_ENCEINTE, groundAt: (_x: number, z: number) => 60 - z / 8 };
const plan = planEnceinte(spec);

describe('the hexagon the walls follow', () => {
  const corners = hexCorners({ x: 0, z: 0 }, 290, 240);

  it('has six corners', () => {
    expect(corners).toHaveLength(6);
  });

  it('puts a flat face square to the lake and a matching one to the road', () => {
    // Corners 1 and 2 share a z, and so do 4 and 5: those are the two flats.
    expect(corners[1]!.z).toBeCloseTo(corners[2]!.z, 6);
    expect(corners[4]!.z).toBeCloseTo(corners[5]!.z, 6);
    expect(corners[1]!.z).toBeCloseTo(-corners[4]!.z, 6);
  });

  it('reaches the stated half-width along each axis', () => {
    expect(Math.max(...corners.map((c) => c.x))).toBeCloseTo(290, 6);
    expect(Math.max(...corners.map((c) => c.z))).toBeCloseTo(240 * (Math.sqrt(3) / 2), 6);
  });
});

describe('offsetting a convex polygon', () => {
  const source = hexCorners({ x: 4, z: -9 }, 290, 240);
  const offset = offsetConvexPolygon(source, 26);

  it('keeps every edge parallel to the one it came from', () => {
    for (let i = 0; i < 6; i++) {
      const a = source[i]!;
      const b = source[(i + 1) % 6]!;
      const p = offset[i]!;
      const q = offset[(i + 1) % 6]!;
      const cross =
        (b.x - a.x) * (q.z - p.z) - (b.z - a.z) * (q.x - p.x);
      expect(Math.abs(cross) / (Math.hypot(b.x - a.x, b.z - a.z) ** 2)).toBeLessThan(1e-6);
    }
  });

  it('moves every edge out by exactly the offset', () => {
    for (let i = 0; i < 6; i++) {
      const a = source[i]!;
      const b = source[(i + 1) % 6]!;
      const p = offset[i]!;
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      // Perpendicular distance from the offset corner to the source edge.
      const distance =
        Math.abs((b.x - a.x) * (a.z - p.z) - (a.x - p.x) * (b.z - a.z)) / len;
      expect(distance).toBeCloseTo(26, 6);
    }
  });

  it('leaves the polygon alone at zero offset', () => {
    const same = offsetConvexPolygon(source, 0);
    for (let i = 0; i < 6; i++) {
      expect(same[i]!.x).toBeCloseTo(source[i]!.x, 6);
      expect(same[i]!.z).toBeCloseTo(source[i]!.z, 6);
    }
  });
});

describe('the enceinte plan', () => {
  it('opens three ways in, two of them drawbridges', () => {
    expect(plan.gates).toHaveLength(3);
    expect(plan.gates.filter((g) => g.drawbridge)).toHaveLength(2);
  });

  it('faces the two drawbridges at each other across the castle', () => {
    const water = plan.gates.find((g) => g.label === 'water gate')!;
    const road = plan.gates.find((g) => g.label === 'road gate')!;
    // Directly opposite: the outward normals are exact opposites, and the two
    // openings sit on the same centre line.
    expect(water.outward.x).toBeCloseTo(-road.outward.x, 6);
    expect(water.outward.z).toBeCloseTo(-road.outward.z, 6);
    expect(water.centre.x).toBeCloseTo(road.centre.x, 6);
  });

  it('points every gate out of the castle, not into it', () => {
    for (const gate of plan.gates) {
      const toCentre = {
        x: spec.centre.x - gate.centre.x,
        z: spec.centre.z - gate.centre.z,
      };
      expect(gate.outward.x * toCentre.x + gate.outward.z * toCentre.z).toBeLessThan(0);
      expect(Math.hypot(gate.outward.x, gate.outward.z)).toBeCloseTo(1, 6);
    }
  });

  it('cuts the moat as a chain of level pools, not one impossible ring', () => {
    // Six faces, each split into pools short enough to hold a level.
    expect(plan.basins.length).toBeGreaterThan(6);
    expect(new Set(plan.basins.map((b) => b.edgeIndex)).size).toBe(6);
    for (const basin of plan.basins) {
      const run = Math.hypot(
        basin.inner[1]!.x - basin.inner[0]!.x,
        basin.inner[1]!.z - basin.inner[0]!.z,
      );
      expect(run).toBeLessThan(spec.basinRunFt * 1.6);
    }
    for (const basin of plan.basins) {
      expect(basin.bedY).toBeCloseTo(basin.waterY - spec.moatDepthFt, 6);
      expect(basin.waterSqFt).toBeGreaterThan(0);
    }
    // On a slope the basins are at different levels, which is the whole point.
    const levels = new Set(plan.basins.map((b) => b.waterY.toFixed(2)));
    expect(levels.size).toBeGreaterThan(1);
    expect(plan.moatFallFt).toBeGreaterThan(0);
  });

  it('holds every step between basins with a weir', () => {
    const held = plan.basins.reduce((a, b) => a + b.weirHeightFt, 0);
    // On a plane the ring has one descending arc and one climbing one, so the
    // downhill steps add up to exactly the fall. Every one of them is a dam.
    expect(held).toBeCloseTo(plan.moatFallFt, 4);
    expect(plan.basins.filter((b) => b.weirHeightFt > 0.1).length).toBeGreaterThan(1);
  });

  it('has no fall at all on level ground', () => {
    const flat = planEnceinte({ ...DEFAULT_ENCEINTE, groundAt: () => 40 });
    expect(flat.moatFallFt).toBeCloseTo(0, 6);
    for (const basin of flat.basins) expect(basin.weirHeightFt).toBeCloseTo(0, 6);
  });

  it('measures the wall it has to build', () => {
    expect(plan.perimeterFt).toBeGreaterThan(1500);
    const openFt = plan.gates.length * spec.gateWidthFt;
    expect(plan.faceSqFt).toBeCloseTo((plan.perimeterFt - openFt) * spec.wallHeightFt * 2, 6);
  });
});

describe('the drawbridge counterweight', () => {
  const mech = drawbridgeMechanism(42, 14, 12);

  it('weighs the leaf from its own deck', () => {
    expect(mech.leafWeightLb).toBeCloseTo(42 * 14 * DRAWBRIDGE_DECK_PSF, 6);
  });

  it('answers the leaf moment with a margin, not a balance', () => {
    expect(mech.momentFtLb).toBeCloseTo((mech.leafWeightLb * 42) / 2, 6);
    expect(mech.counterweightLb * 12).toBeCloseTo(mech.momentFtLb * COUNTERWEIGHT_MARGIN, 4);
    expect(COUNTERWEIGHT_MARGIN).toBeGreaterThan(1);
  });

  it('counts the sandbags a person actually has to stack', () => {
    expect(mech.sandbagWeightLb).toBe(SANDBAG_LB);
    expect(mech.sandbagCount).toBe(Math.ceil(mech.counterweightLb / SANDBAG_LB));
    expect(mech.sandbagCount).toBeGreaterThan(0);
  });

  it('needs more bags for a longer leaf and fewer for a longer arm', () => {
    expect(drawbridgeMechanism(60, 14, 12).sandbagCount).toBeGreaterThan(mech.sandbagCount);
    expect(drawbridgeMechanism(42, 14, 20).sandbagCount).toBeLessThan(mech.sandbagCount);
  });
});

describe('a run of torches', () => {
  const run = torchLine(
    'test',
    { x: 0, z: 0 },
    { x: 0, z: 120 },
    60,
    () => 12,
    'walkway',
    { both: true },
  );

  it('lights both kerbs and reaches both ends', () => {
    expect(run).toHaveLength(3 * 2);
    expect(Math.min(...run.map((t) => t.position.z))).toBeCloseTo(0, 6);
    expect(Math.max(...run.map((t) => t.position.z))).toBeCloseTo(120, 6);
    expect(new Set(run.map((t) => t.position.x)).size).toBe(2);
  });

  it('stands every torch on the ground it is given', () => {
    for (const torch of run) expect(torch.position.y).toBe(12);
  });
});

describe('as site features', () => {
  const features = enceinteFeatures(plan);

  it('emits one wall, a pool for every basin and three crossings', () => {
    expect(featuresOfKind(features, 'enceinte')).toHaveLength(1);
    expect(featuresOfKind(features, 'moat')).toHaveLength(plan.basins.length);
    expect(featuresOfKind(features, 'bridge')).toHaveLength(3);
  });

  it('gives the moat fewer, longer pools when the runs are allowed to be longer', () => {
    const coarse = planEnceinte({ ...spec, basinRunFt: 120 });
    expect(coarse.basins.length).toBeLessThan(plan.basins.length);
    // Longer pools have to hold a bigger step, so more of them are wall.
    expect(coarse.moatBankSqFt).toBeGreaterThan(plan.moatBankSqFt);
  });

  it('builds the two drawbridges identically', () => {
    const draws = featuresOfKind(features, 'bridge').filter((b) => b.drawbridge);
    expect(draws).toHaveLength(2);
    expect(draws[0]!.sandbagCount).toBe(draws[1]!.sandbagCount);
    expect(draws[0]!.leafWeightLb).toBeCloseTo(draws[1]!.leafWeightLb, 6);
    expect(draws[0]!.widthFt).toBe(draws[1]!.widthFt);
    const span = (b: (typeof draws)[number]) =>
      Math.hypot(b.to.x - b.from.x, b.to.z - b.from.z);
    expect(span(draws[0]!)).toBeCloseTo(span(draws[1]!), 6);
  });

  it('gives the fixed crossing no counterweight to speak of', () => {
    const fixed = featuresOfKind(features, 'bridge').find((b) => !b.drawbridge)!;
    expect(fixed.sandbagCount).toBe(0);
  });

  it('posts two knights outside every crossing', () => {
    const knights = featuresOfKind(features, 'knight');
    expect(knights).toHaveLength(plan.gates.length * 2);
    for (const knight of knights) {
      const gate = plan.gates.find((g) => g.label === knight.post)!;
      const away = {
        x: knight.position.x - gate.centre.x,
        z: knight.position.z - gate.centre.z,
      };
      // Outside the wall, which is the only side a guard is any use on.
      expect(away.x * gate.outward.x + away.z * gate.outward.z).toBeGreaterThan(0);
    }
  });

  it('lights the corners, the wall head and every gate', () => {
    const torches = featuresOfKind(features, 'torch');
    expect(torches.filter((t) => t.mount === 'tower')).toHaveLength(6);
    expect(torches.filter((t) => t.mount === 'gate')).toHaveLength(plan.gates.length * 2);
    expect(torches.filter((t) => t.mount === 'wall').length).toBeGreaterThan(12);
    expect(torches.every((t) => t.rainbow)).toBe(true);
    expect(torches.every((t) => t.gphKerosene > 0)).toBe(true);
  });

  it('stands the wall torches on the wall head', () => {
    for (const torch of featuresOfKind(features, 'torch').filter((t) => t.mount === 'wall')) {
      const grade = spec.groundAt(torch.position.x, torch.position.z);
      expect(torch.position.y).toBeCloseTo(grade + spec.wallHeightFt, 6);
    }
  });

  it('keeps the torches out of the gate openings', () => {
    for (const torch of featuresOfKind(features, 'torch').filter((t) => t.mount === 'wall')) {
      for (const gate of plan.gates) {
        expect(
          Math.hypot(torch.position.x - gate.centre.x, torch.position.z - gate.centre.z),
        ).toBeGreaterThan(gate.widthFt / 2);
      }
    }
  });

  it('throws light only where light is worth a draw call', () => {
    const torches = featuresOfKind(features, 'torch');
    const lit = torches.filter((t) => t.castLight);
    expect(lit.length).toBeGreaterThan(0);
    expect(lit.length).toBeLessThan(torches.length / 2);
  });
});

describe('holding water on a hill', () => {
  it('sets each basin between its two banks, not on the uphill one', () => {
    for (const basin of plan.basins) {
      const grades = [...basin.inner, ...basin.outer].map((p) =>
        spec.groundAt(p.x, p.z),
      );
      expect(basin.waterY).toBeLessThan(Math.max(...grades));
      expect(basin.bankTopY).toBeCloseTo(basin.waterY + spec.moatFreeboardFt, 6);
    }
  });

  it('walls up the downhill side rather than pretending water stays put', () => {
    // Every run on this slope falls across its own width, so every run needs
    // bank on one side. If this is ever zero the moat is a drawing, not a moat.
    expect(plan.moatBankSqFt).toBeGreaterThan(0);
    for (const basin of plan.basins) {
      expect(basin.innerBankHeightFt + basin.outerBankHeightFt).toBeGreaterThan(0);
      expect(basin.bankSqFt).toBeGreaterThan(0);
    }
  });

  it('needs no bank at all on level ground', () => {
    const flat = planEnceinte({ ...DEFAULT_ENCEINTE, groundAt: () => 40 });
    expect(flat.moatBankSqFt).toBeCloseTo(0, 6);
    for (const basin of flat.basins) {
      expect(basin.waterY).toBeCloseTo(40 - DEFAULT_ENCEINTE.moatFreeboardFt, 6);
    }
  });
})
