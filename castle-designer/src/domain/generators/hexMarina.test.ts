import { describe, expect, it } from 'vitest';
import { featuresOfKind } from '../types';
import {
  DEFAULT_HEX_MARINA,
  FLOAT,
  apothem,
  hexAreaSqFt,
  hexMarinaFeatures,
  hexVertices,
  offsetHexagon,
  planHexMarina,
  polygonAreaSqFt,
} from './hexMarina';

const plan = planHexMarina();
const spec = DEFAULT_HEX_MARINA;

/** Apothem of the swim lagoon: the hexagon inboard of the perimeter walkway. */
const lagoonApothem = apothem(spec.sideFt) - spec.perimeterWalkFt;
const lagoonRadius = lagoonApothem / (Math.sqrt(3) / 2);

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

  it('measures a polygon by the shoelace formula', () => {
    expect(polygonAreaSqFt(hexVertices({ x: 0, z: 0 }, 60, 0.3))).toBeCloseTo(
      hexAreaSqFt(60),
      6,
    );
  });
});

describe('the offset outline the roof needs', () => {
  const offset = 24;
  const outline = offsetHexagon({ x: 0, z: 0 }, 60, 0, offset, 6);

  it('never reaches further than the corner radius', () => {
    for (const p of outline) {
      expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(60 + offset + 1e-9);
    }
  });

  it('clears the hexagon by the offset on every edge', () => {
    // Straight runs sit exactly one offset outboard of each edge.
    const flats = outline.map((p) => Math.hypot(p.x, p.z)).filter((r) => r < 60 + offset - 1);
    expect(flats.length).toBeGreaterThan(0);
    for (const r of flats) expect(r).toBeGreaterThan(apothem(60) + offset - 1e-6);
  });

  it('reaches less far than the plain hexagon that would cover the same berths', () => {
    // This is the whole reason it exists. To cover a berth off every edge, a
    // plain hexagon needs its apothem grown by the offset, which pushes its
    // corners out to 88 feet; the offset outline gets there at 84 and only at
    // six isolated points. On this layout that is the difference between roofs
    // that clear their neighbours and roofs that collide.
    const plainRadius = (apothem(60) + offset) / (Math.sqrt(3) / 2);
    const maxReach = Math.max(...outline.map((p) => Math.hypot(p.x, p.z)));
    expect(maxReach).toBeCloseTo(60 + offset, 6);
    expect(maxReach).toBeLessThan(plainRadius);
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
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(2 * apothem(spec.sideFt));
      }
    }
  });

  it('keeps the covering roofs clear of one another too', () => {
    // The roof reaches past the hexagon to cover the berths, so this is the
    // clearance that really binds, not the one between the decks.
    expect(plan.roofClearanceFt).toBeGreaterThan(0);
  });

  it('carries no berths on the hub, which is the store', () => {
    expect(plan.modules.find((m) => m.role === 'hub')?.slips).toEqual([]);
  });

  it('hangs every berth off the outside of its hexagon', () => {
    for (const m of plan.modules) {
      for (const s of m.slips) {
        const r = Math.hypot(s.center.x - m.centre.x, s.center.z - m.centre.z);
        // Outboard of the hexagon, and no further out than the berth is long.
        expect(r, s.id).toBeGreaterThan(apothem(spec.sideFt));
        expect(r, s.id).toBeLessThan(spec.sideFt + spec.slipLengthFt);
      }
    }
  });

  it('points every berth away from the hexagon it belongs to', () => {
    for (const m of plan.modules) {
      for (const s of m.slips) {
        // rotationY is a heading: local +X runs along the berth, bow inward.
        const ax = Math.cos(s.rotationY);
        const az = -Math.sin(s.rotationY);
        const out = { x: s.center.x - m.centre.x, z: s.center.z - m.centre.z };
        const len = Math.hypot(out.x, out.z);
        expect((ax * out.x + az * out.z) / len, s.id).toBeGreaterThan(0.7);
      }
    }
  });

  it('fits four berths on a sixty-foot edge and skips two at the landing', () => {
    const pitch = spec.slipWidthFt + spec.fingerWidthFt;
    const perEdge = Math.floor(spec.sideFt / pitch);
    expect(perEdge).toBe(4);
    for (const m of plan.modules.filter((s) => s.role === 'satellite')) {
      expect(m.slips).toHaveLength(perEdge * 6 - 2 * spec.walkwayClearBerths);
    }
    expect(plan.slipCount).toBe(6 * (perEdge * 6 - 2 * spec.walkwayClearBerths));
  });

  it('leaves the landing corner clear on both of its edges', () => {
    for (const m of plan.modules.filter((s) => s.role === 'satellite')) {
      const onEdge = (e: number) => m.slips.filter((s) => s.edgeIndex === e).length;
      const before = (m.walkwayVertex + 5) % 6;
      const full = [0, 1, 2, 3, 4, 5].find((e) => e !== m.walkwayVertex && e !== before)!;
      expect(onEdge(m.walkwayVertex)).toBeLessThan(onEdge(full));
      expect(onEdge(before)).toBeLessThan(onEdge(full));
    }
  });

  it('numbers every berth once', () => {
    const numbers = plan.modules.flatMap((m) => m.slips.map((s) => s.slipNumber));
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(Math.min(...numbers)).toBe(1);
    expect(Math.max(...numbers)).toBe(numbers.length);
  });

  it('opens the middle of each satellite as a swimming lagoon', () => {
    const lagoon = hexAreaSqFt(lagoonRadius);
    expect(plan.lagoonWidthFt).toBeCloseTo(lagoonApothem * 2, 6);
    expect(plan.lagoonWidthFt).toBeGreaterThan(75);
    expect(plan.swimSqFt).toBeCloseTo(6 * lagoon, 4);
    // The hub is the store, so it has no lagoon.
    expect(plan.modules.find((m) => m.role === 'hub')!.swimSqFt).toBe(0);
  });

  it('nets every lagoon at the same depth as the water it covers', () => {
    expect(plan.netSqFt).toBeCloseTo(plan.swimSqFt, 6);
    expect(spec.swimNetDepthFt).toBe(12);
  });

  it('leaves the lagoon open to the sky and roofs everything else', () => {
    const hub = plan.modules.find((m) => m.role === 'hub')!;
    expect(hub.roofSqFt).toBeCloseTo(hexAreaSqFt(spec.sideFt), 4);
    for (const m of plan.modules.filter((s) => s.role === 'satellite')) {
      expect(m.roofSqFt).toBeCloseTo(
        polygonAreaSqFt(m.roofOutline) - hexAreaSqFt(lagoonRadius),
        4,
      );
      // It has to cover the berths, so it is bigger than the deck it sits on.
      expect(m.roofSqFt).toBeGreaterThan(hexAreaSqFt(spec.sideFt));
    }
  });

  it('counts the floats the deck needs', () => {
    expect(FLOAT.areaSqFt).toBe(FLOAT.widthFt * FLOAT.lengthFt);
    expect(plan.floatCount).toBe(Math.ceil(plan.deckSqFt / FLOAT.areaSqFt));
    expect(plan.floatCount).toBeGreaterThan(500);
  });

  it('sizes the array from the roof it covers', () => {
    expect(plan.roofSqFt).toBeCloseTo(
      plan.modules.reduce((sum, m) => sum + m.roofSqFt, 0),
      6,
    );
    expect(plan.solarSqFt).toBeCloseTo(plan.roofSqFt * spec.solarCoverage, 6);
    expect(plan.solarKwDc).toBeGreaterThan(400);
  });

  it('re-cuts itself when the berth size changes', () => {
    const wider = planHexMarina({ ...spec, slipWidthFt: 16 });
    expect(wider.slipCount).toBeLessThan(plan.slipCount);
  });

  it('re-cuts the lagoon when the walkway widens', () => {
    const wider = planHexMarina({ ...spec, perimeterWalkFt: 20 });
    expect(wider.lagoonWidthFt).toBeCloseTo(plan.lagoonWidthFt - 16, 6);
    expect(wider.swimSqFt).toBeLessThan(plan.swimSqFt);
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
      expect(d.position.y).toBeCloseTo(spec.waterLevelFt + spec.freeboardFt, 6);
    }
  });

  it('carries the lagoon and its net onto the satellites only', () => {
    for (const d of featuresOfKind(features, 'hexDock')) {
      if (d.role === 'hub') {
        expect(d.swimSqFt).toBe(0);
        expect(d.netDepthFt).toBe(0);
        expect(d.roofOffsetFt).toBe(0);
      } else {
        expect(d.swimSqFt).toBeGreaterThan(5000);
        expect(d.netDepthFt).toBe(spec.swimNetDepthFt);
        expect(d.roofOffsetFt).toBe(spec.slipLengthFt + spec.roofOverhangFt);
      }
    }
  });
});
