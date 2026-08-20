import { describe, expect, it } from 'vitest';
import { SNAP_ACROSS_FT, SNAP_ALONG_FT, dimsOf } from './dimensions';
import { boxOf, findIntersections, snapPosition } from './geometry';
import { SEED_HALL_SPAN_FT, SEED_LAYOUT } from './seedLayout';

describe('seed layout', () => {
  it('is the six-container test fragment', () => {
    expect(SEED_LAYOUT.containers).toHaveLength(6);
    expect(SEED_LAYOUT.units).toBe('ft');
  });

  it('has unique container ids', () => {
    const ids = new Set(SEED_LAYOUT.containers.map((c) => c.id));
    expect(ids.size).toBe(SEED_LAYOUT.containers.length);
  });

  it('has unique opening ids across the whole layout', () => {
    const openingIds = SEED_LAYOUT.containers.flatMap((c) => c.openings.map((o) => o.id));
    expect(new Set(openingIds).size).toBe(openingIds.length);
  });

  it('places no container inside another', () => {
    expect(findIntersections(SEED_LAYOUT.containers)).toEqual([]);
  });

  it('sits every container on the castle grid', () => {
    for (const c of SEED_LAYOUT.containers) {
      const snapped = snapPosition(c.position, c.type, c.rotation);
      expect({ id: c.id, x: snapped.x, z: snapped.z }).toEqual({
        id: c.id,
        x: c.position.x,
        z: c.position.z,
      });
    }
  });

  it('lands every stacked container exactly on the roof below it', () => {
    const stacked = SEED_LAYOUT.containers.filter((c) => c.position.y > 0);
    expect(stacked.length).toBeGreaterThan(0);
    for (const upper of stacked) {
      const below = SEED_LAYOUT.containers.find(
        (c) =>
          c.id !== upper.id &&
          c.position.x === upper.position.x &&
          c.position.z === upper.position.z &&
          boxOf(c).max.y === upper.position.y,
      );
      expect(below, `${upper.id} has nothing under it`).toBeDefined();
      // Corner casting to corner casting: same footprint, no offset (rule R1).
      expect(below?.type).toBe(upper.type);
      expect(below?.rotation).toBe(upper.rotation);
    }
  });

  it('keeps the great hall span open between the two wall stacks', () => {
    const west = SEED_LAYOUT.containers.find((c) => c.id === 'wall-w-l1');
    const east = SEED_LAYOUT.containers.find((c) => c.id === 'wall-e-l1');
    expect(west).toBeDefined();
    expect(east).toBeDefined();
    const span = east!.position.z - boxOf(west!).max.z;
    expect(span).toBe(SEED_HALL_SPAN_FT);
  });

  it('keeps openings inside the face they are cut into', () => {
    for (const c of SEED_LAYOUT.containers) {
      const d = dimsOf(c.type);
      for (const o of c.openings) {
        const faceWidth = o.face === 'endA' || o.face === 'endB' ? d.width : d.length;
        const faceHeight = o.face === 'roof' ? d.width : d.height;
        expect(o.offsetU + o.width, `${o.id} runs off its face`).toBeLessThanOrEqual(
          faceWidth,
        );
        expect(o.offsetV + o.height, `${o.id} runs off its face`).toBeLessThanOrEqual(
          faceHeight,
        );
      }
    }
  });

  it('uses grid modules that match the container catalogue', () => {
    expect(SNAP_ACROSS_FT).toBe(dimsOf('40HC').width);
    expect(SNAP_ALONG_FT['40HC']).toBe(dimsOf('40HC').length);
    expect(SNAP_ALONG_FT['20ST']).toBe(dimsOf('20ST').length);
  });
});
