import { describe, expect, it } from 'vitest';
import { featuresOfKind } from '../types';
import {
  DEFAULT_HEX_MARINA,
  FLOAT,
  apothem,
  hexAreaSqFt,
  hexMarinaFeatures,
  hexVertices,
  planHexMarina,
} from './hexMarina';

const plan = planHexMarina();

describe('hexagon geometry', () => {
  it('gives a 60-foot hexagon a 52-foot apothem', () => {
    expect(apothem(60)).toBeCloseTo(51.96, 2);
  });

  it('measures the area of a 60-foot hexagon', () => {
    expect(hexAreaSqFt(60)).toBeCloseTo(9353.07, 1);
  });

  it('spaces the six vertices evenly at the circumradius', () => {
    const vertices = hexVertices({ x: 10, z: -4 }, 60, 0);
    expect(vertices).toHaveLength(6);
    for (const v of vertices) {
      expect(Math.hypot(v.x - 10, v.z + 4)).toBeCloseTo(60, 6);
    }
    // Each side of a regular hexagon equals its circumradius.
    for (let i = 0; i < 6; i++) {
      const a = vertices[i]!;
      const b = vertices[(i + 1) % 6]!;
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeCloseTo(60, 6);
    }
  });
});

describe('the marina plan', () => {
  it('is a hub and six satellites', () => {
    expect(plan.modules).toHaveLength(7);
    expect(plan.modules.filter((m) => m.role === 'hub')).toHaveLength(1);
    expect(plan.modules.filter((m) => m.role === 'satellite')).toHaveLength(6);
  });

  it('puts a fifty-foot walkway between each pair of facing corners', () => {
    expect(plan.walkways).toHaveLength(6);
    for (const w of plan.walkways) {
      expect(Math.hypot(w.to.x - w.from.x, w.to.z - w.from.z)).toBeCloseTo(50, 6);
      expect(w.retractable).toBe(true);
    }
  });

  it('keeps the satellites clear of one another', () => {
    const satellites = plan.modules.filter((m) => m.role === 'satellite');
    for (let i = 0; i < satellites.length; i++) {
      for (let j = i + 1; j < satellites.length; j++) {
        const a = satellites[i]!.centre;
        const b = satellites[j]!.centre;
        // Two hexagons touch when their centres close to twice the apothem.
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(
          2 * apothem(DEFAULT_HEX_MARINA.sideFt),
        );
      }
    }
  });

  it('leaves three edges of every satellite open', () => {
    for (const m of plan.modules.filter((s) => s.role === 'satellite')) {
      expect(m.entranceEdges).toHaveLength(3);
    }
  });

  it('carries no berths on the hub, which is the store', () => {
    expect(plan.modules.find((m) => m.role === 'hub')?.slips).toEqual([]);
  });

  it('packs every satellite with berths and numbers them once each', () => {
    expect(plan.slipCount).toBeGreaterThan(60);
    const numbers = plan.modules.flatMap((m) => m.slips.map((s) => s.slipNumber));
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(Math.min(...numbers)).toBe(1);
    expect(Math.max(...numbers)).toBe(numbers.length);
  });

  it('gives an entrance edge fewer berths than a closed one', () => {
    const satellite = plan.modules.find((m) => m.role === 'satellite')!;
    const onEdge = (e: number) => satellite.slips.filter((s) => s.edgeIndex === e).length;
    const open = DEFAULT_HEX_MARINA.entranceEdges[0]!;
    const closed = [0, 1, 2, 3, 4, 5].find(
      (e) => !DEFAULT_HEX_MARINA.entranceEdges.includes(e),
    )!;
    expect(onEdge(open)).toBeLessThan(onEdge(closed));
    expect(onEdge(open)).toBeGreaterThan(0);
  });

  it('keeps every berth inside its own hexagon', () => {
    for (const m of plan.modules) {
      for (const s of m.slips) {
        const r = Math.hypot(s.center.x - m.centre.x, s.center.z - m.centre.z);
        expect(r, s.id).toBeLessThan(DEFAULT_HEX_MARINA.sideFt);
      }
    }
  });

  it('leaves a turning basin a boat can actually use', () => {
    // A fairway wants about one and a half boat lengths.
    expect(plan.turningBasinFt).toBeGreaterThan(DEFAULT_HEX_MARINA.slipLengthFt * 1.5);
  });

  it('counts the floats the deck needs', () => {
    expect(FLOAT.areaSqFt).toBe(FLOAT.widthFt * FLOAT.lengthFt);
    expect(plan.floatCount).toBe(Math.ceil(plan.deckSqFt / FLOAT.areaSqFt));
    expect(plan.floatCount).toBeGreaterThan(500);
  });

  it('sizes the array from the roof it covers', () => {
    expect(plan.roofSqFt).toBeCloseTo(7 * hexAreaSqFt(60), 1);
    expect(plan.solarSqFt).toBeCloseTo(plan.roofSqFt * DEFAULT_HEX_MARINA.solarCoverage, 6);
    expect(plan.solarKwDc).toBeGreaterThan(400);
  });

  it('re-cuts itself when the berth size changes', () => {
    const wider = planHexMarina({ ...DEFAULT_HEX_MARINA, slipWidthFt: 16 });
    expect(wider.slipCount).toBeLessThan(plan.slipCount);
  });
});

describe('as site features', () => {
  const features = hexMarinaFeatures(plan);

  it('emits a hex dock for every module', () => {
    expect(featuresOfKind(features, 'hexDock')).toHaveLength(7);
  });

  it('emits a slip for every berth, tiered', () => {
    const slips = featuresOfKind(features, 'slip');
    expect(slips).toHaveLength(plan.slipCount);
    expect(slips.some((s) => s.tier === 'premier')).toBe(true);
    expect(slips.some((s) => s.tier === 'standard')).toBe(true);
  });

  it('emits six retractable walkways', () => {
    const walks = featuresOfKind(features, 'walkway');
    expect(walks).toHaveLength(6);
    expect(walks.every((w) => w.retractable)).toBe(true);
  });

  it('floats every deck at the same freeboard', () => {
    for (const d of featuresOfKind(features, 'hexDock')) {
      expect(d.position.y).toBeCloseTo(
        DEFAULT_HEX_MARINA.waterLevelFt + DEFAULT_HEX_MARINA.freeboardFt,
        6,
      );
    }
  });
});
