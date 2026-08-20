import { describe, expect, it } from 'vitest';
import { CORNER_CASTING_COUNT, D20ST, D40HC, INTERIOR_WIDTH_FT } from './dimensions';
import {
  boxOf,
  centerOf,
  cornerCastings,
  findIntersections,
  footprint,
  grossSqFt,
  intersects,
  layoutBounds,
  snapPosition,
  snapTo,
} from './geometry';
import type { Container } from './types';

function box(
  id: string,
  overrides: Partial<Container> = {},
): Container {
  return {
    id,
    type: '40HC',
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    role: 'structural',
    finish: 'painted',
    openings: [],
    ...overrides,
  };
}

describe('dimensions', () => {
  it('uses real ISO container dimensions in feet', () => {
    expect(D40HC).toMatchObject({ length: 40, width: 8, height: 9.5 });
    expect(D20ST).toMatchObject({ length: 20, width: 8, height: 8.5 });
  });

  it('interior clear width is 7 feet 8 inches, not 8 feet', () => {
    expect(INTERIOR_WIDTH_FT).toBeCloseTo(7.6667, 4);
    expect(INTERIOR_WIDTH_FT).toBeLessThan(D40HC.width);
  });
});

describe('footprint', () => {
  it('runs the long axis along X at 0 degrees', () => {
    expect(footprint('40HC', 0)).toEqual({ sizeX: 40, sizeZ: 8 });
  });

  it('swaps the axes at 90 degrees', () => {
    expect(footprint('40HC', 90)).toEqual({ sizeX: 8, sizeZ: 40 });
    expect(footprint('20ST', 90)).toEqual({ sizeX: 8, sizeZ: 20 });
  });
});

describe('boxOf / centerOf', () => {
  it('treats position as the minimum corner', () => {
    const b = boxOf(box('a', { position: { x: 10, y: 9.5, z: -4 } }));
    expect(b.min).toEqual({ x: 10, y: 9.5, z: -4 });
    expect(b.max).toEqual({ x: 50, y: 19, z: 4 });
  });

  it('reports the centroid the mesh needs', () => {
    expect(centerOf(box('a'))).toEqual({ x: 20, y: 4.75, z: 4 });
  });
});

describe('cornerCastings', () => {
  it('produces the eight rated load points', () => {
    const corners = cornerCastings(box('a'));
    expect(corners).toHaveLength(CORNER_CASTING_COUNT);
    const unique = new Set(corners.map((c) => `${c.x},${c.y},${c.z}`));
    expect(unique.size).toBe(8);
  });
});

describe('intersects', () => {
  it('does not count containers sitting shoulder to shoulder', () => {
    const a = box('a');
    const b = box('b', { position: { x: 0, y: 0, z: 8 } });
    expect(intersects(a, b)).toBe(false);
  });

  it('does not count a container stacked directly on another', () => {
    const a = box('a');
    const b = box('b', { position: { x: 0, y: 9.5, z: 0 } });
    expect(intersects(a, b)).toBe(false);
  });

  it('catches shared volume', () => {
    const a = box('a');
    const b = box('b', { position: { x: 20, y: 0, z: 0 } });
    expect(intersects(a, b)).toBe(true);
  });

  it('reports every overlapping pair', () => {
    const containers = [
      box('a'),
      box('b', { position: { x: 20, y: 0, z: 0 } }),
      box('c', { position: { x: 0, y: 0, z: 40 } }),
    ];
    expect(findIntersections(containers)).toEqual([[0, 1]]);
  });
});

describe('snapping', () => {
  it('snaps to arbitrary steps', () => {
    expect(snapTo(37, 8)).toBe(40);
    expect(snapTo(-3, 8)).toBe(0);
    // Negative zero is collapsed so a snapped position round-trips through JSON.
    expect(Object.is(snapTo(-3, 8), -0)).toBe(false);
  });

  it('snaps 8 feet across the box and a full length along it', () => {
    expect(snapPosition({ x: 37, y: 0, z: 5 }, '40HC', 0)).toEqual({
      x: 40,
      y: 0,
      z: 8,
    });
    expect(snapPosition({ x: 5, y: 0, z: 37 }, '40HC', 90)).toEqual({
      x: 8,
      y: 0,
      z: 40,
    });
    expect(snapPosition({ x: 5, y: 0, z: 27 }, '20ST', 90)).toEqual({
      x: 8,
      y: 0,
      z: 20,
    });
  });

  it('leaves elevation alone — stacking is governed by container height', () => {
    expect(snapPosition({ x: 0, y: 9.5, z: 0 }, '40HC', 0).y).toBe(9.5);
  });
});

describe('layoutBounds', () => {
  it('is null for an empty layout', () => {
    expect(layoutBounds([])).toBeNull();
  });

  it('spans every container', () => {
    const bounds = layoutBounds([
      box('a'),
      box('b', { position: { x: 0, y: 9.5, z: 48 } }),
    ]);
    expect(bounds?.min).toEqual({ x: 0, y: 0, z: 0 });
    expect(bounds?.max).toEqual({ x: 40, y: 19, z: 56 });
  });
});

describe('grossSqFt', () => {
  it('is plan area regardless of rotation', () => {
    expect(grossSqFt(box('a'))).toBe(320);
    expect(grossSqFt(box('a', { rotation: 90 }))).toBe(320);
    expect(grossSqFt(box('a', { type: '20ST' }))).toBe(160);
  });
});
