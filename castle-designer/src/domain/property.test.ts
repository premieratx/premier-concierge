import { describe, expect, it } from 'vitest';
import { takeoff } from '../cost/takeoff';
import { findIntersections, snapPosition } from './geometry';
import { generateProperty } from './property';
import { TERRACE_BY_ID, naturalGrade, shorelineZAt } from './terrain';
import { featuresOfKind } from './types';

describe('the generated property', () => {
  const layout = generateProperty({ marinaPhase: 'enhanced' });

  it('places no container inside another, anywhere on the site', () => {
    expect(findIntersections(layout.containers)).toEqual([]);
  });

  it('keeps every container on whole-foot coordinates', () => {
    // The 8-foot cross module and the 20/40-foot along module are anchored to
    // each wall run rather than to the world origin — a curtain wall inset to
    // clear its corner towers is deliberately off the origin lattice — so the
    // invariant that holds property-wide is whole feet in plan and exact
    // container heights in elevation. Origin-anchored snapping is what the
    // editor applies to a container the user drags, and the store tests cover
    // that.
    for (const c of layout.containers) {
      expect(Number.isInteger(c.position.x), `${c.id} x`).toBe(true);
      expect(Number.isInteger(c.position.z), `${c.id} z`).toBe(true);
      expect((c.position.y * 2) % 1, `${c.id} y`).toBe(0);
    }
  });

  it('snaps a container the editor moves back onto the origin lattice', () => {
    const c = layout.containers[0]!;
    const snapped = snapPosition({ x: 37, y: 0, z: 5 }, c.type, c.rotation);
    expect(snapped.x % 8).toBe(0);
    expect(snapped.z % 8).toBe(0);
  });

  it('gives every container and every opening a unique id', () => {
    const ids = layout.containers.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const openings = layout.containers.flatMap((c) => c.openings.map((o) => o.id));
    expect(new Set(openings).size).toBe(openings.length);
  });

  it('gives every piece of decor and every feature a unique id', () => {
    const decor = layout.decor.map((d) => d.id);
    expect(new Set(decor).size).toBe(decor.length);
    const features = layout.features.map((f) => f.id);
    expect(new Set(features).size).toBe(features.length);
  });

  it('builds a castle of roughly the reference size', () => {
    const castle = takeoff(layout, 'castle');
    expect(castle.containerCount).toBeGreaterThan(85);
    expect(castle.containerCount).toBeLessThan(110);
  });

  it('is deterministic: the same call twice gives the same model', () => {
    const again = generateProperty({ marinaPhase: 'enhanced' });
    expect(again.containers).toEqual(layout.containers);
    expect(again.decor).toEqual(layout.decor);
    expect(again.features).toEqual(layout.features);
  });

  it('carries one dragon, seven fire pits and three land stages', () => {
    expect(featuresOfKind(layout.features, 'dragon')).toHaveLength(1);
    expect(featuresOfKind(layout.features, 'firePit')).toHaveLength(7);
    expect(featuresOfKind(layout.features, 'stage')).toHaveLength(3);
  });

  it('sizes the dragon to its budget and points it away from the castle', () => {
    const dragon = featuresOfKind(layout.features, 'dragon')[0]!;
    // Forty-eight feet is what $20,000 of donor parts and rigging buys.
    expect(dragon.lengthFt).toBe(48);
    expect(dragon.breathingFire).toBe(true);
    // Facing +Z, which is the water. The jet goes over the lake.
    expect(dragon.rotationY).toBe(0);
  });

  it('keeps the dragon and the fire pits on the lawn terrace', () => {
    const lawn = TERRACE_BY_ID.lawn!;
    for (const f of [
      ...featuresOfKind(layout.features, 'dragon'),
      ...featuresOfKind(layout.features, 'firePit'),
    ]) {
      expect(f.position.z, f.id).toBeGreaterThan(lawn.rect.z);
      expect(f.position.z, f.id).toBeLessThan(lawn.rect.z + lawn.rect.sizeZ);
      expect(f.position.x, f.id).toBeGreaterThan(lawn.rect.x);
      expect(f.position.x, f.id).toBeLessThan(lawn.rect.x + lawn.rect.sizeX);
      // Standing on the terrace, not floating over it or buried in it.
      expect(f.position.y, f.id).toBe(lawn.elevation);
    }
  });

  it('puts the marina in the water and the buildings on land', () => {
    for (const slip of featuresOfKind(layout.features, 'slip')) {
      // The cove bites in west of centre, so the shoreline is checked where
      // the slip actually is rather than against one nominal number.
      expect(slip.position.z, slip.id).toBeGreaterThan(shorelineZAt(slip.position.x));
    }
    for (const c of layout.containers) {
      expect(naturalGrade(c.position.x, c.position.z), c.id).toBeGreaterThan(0);
    }
  });

  it('switches the marina without touching the castle', () => {
    const existing = generateProperty({ marinaPhase: 'existing' });
    expect(existing.containers).toEqual(layout.containers);
    expect(featuresOfKind(existing.features, 'slip').length).toBeLessThan(
      featuresOfKind(layout.features, 'slip').length,
    );
    expect(existing.site.marinaPhase).toBe('existing');
  });

  it('can be generated without the lodging or the lawn', () => {
    const bare = generateProperty({ includeLodging: false, includeLawn: false });
    expect(bare.containers.every((c) => (c.zone ?? 'castle') === 'castle')).toBe(true);
    expect(featuresOfKind(bare.features, 'dragon')).toHaveLength(0);
    expect(featuresOfKind(bare.features, 'slip').length).toBeGreaterThan(0);
  });
});
