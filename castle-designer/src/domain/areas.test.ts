import { describe, expect, it } from 'vitest';
import {
  capacitySummary,
  LOAD_FACTOR_SQFT,
  propertyAreas,
  USE_COLOR,
  USE_LABEL,
  type OccupancyUse,
} from './areas';
import { generateProperty } from './property';
import { featuresOfKind } from './types';

const layout = generateProperty({ marinaPhase: 'enhanced' });
const areas = propertyAreas(layout);

describe('occupancy factors', () => {
  it('uses the IBC numbers for each assembly type', () => {
    expect(LOAD_FACTOR_SQFT.assemblyStanding).toBe(5);
    expect(LOAD_FACTOR_SQFT.assemblyConcentrated).toBe(7);
    expect(LOAD_FACTOR_SQFT.assemblyUnconcentrated).toBe(15);
    expect(LOAD_FACTOR_SQFT.business).toBe(150);
  });

  it('has a label and a key colour for every use', () => {
    const uses: OccupancyUse[] = [
      'assemblyStanding',
      'assemblyUnconcentrated',
      'assemblyConcentrated',
      'dock',
      'business',
      'lodging',
    ];
    for (const use of uses) {
      expect(USE_LABEL[use], use).toBeTruthy();
      expect(USE_COLOR[use], use).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('property areas', () => {
  it('measures every part of the programme', () => {
    const names = areas.map((a) => a.name);
    expect(names).toContain('Great hall');
    expect(names).toContain('Courtyard');
    expect(names).toContain('Arrival lawn');
    expect(names).toContain('Keep');
    expect(names).toContain('Docks and fingers');
    expect(names.some((n) => n.startsWith('Premier patios'))).toBe(true);
    expect(names.some((n) => n.startsWith('Fire terrace'))).toBe(true);
  });

  it('gives every area a unique id', () => {
    const ids = areas.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('derives capacity from area, factor and occupiable share', () => {
    for (const a of areas) {
      if (a.use === 'lodging') continue;
      expect(a.capacity, a.name).toBe(
        Math.floor((a.sqFt * a.usableFraction) / LOAD_FACTOR_SQFT[a.use]),
      );
    }
  });

  it('never claims more than the gross area allows', () => {
    for (const a of areas) {
      expect(a.usableFraction, a.name).toBeGreaterThan(0);
      expect(a.usableFraction, a.name).toBeLessThanOrEqual(1);
      expect(a.sqFt, a.name).toBeGreaterThan(0);
    }
  });

  it('takes lodging capacity from beds, not from floor area', () => {
    const cabins = areas.find((a) => a.name === 'Lake cabins')!;
    const feature = featuresOfKind(layout.features, 'accommodation').find(
      (f) => f.name === 'Lake cabins',
    )!;
    expect(cabins.capacity).toBe(feature.sleeps);
  });

  it('measures the great hall as its truss-roofed span', () => {
    const hall = areas.find((a) => a.name === 'Great hall')!;
    // 44-foot span over a 160-foot run.
    expect(hall.sqFt).toBe(44 * 160);
    expect(hall.use).toBe('assemblyUnconcentrated');
  });

  it('puts every area on a layer the viewer can switch off', () => {
    for (const a of areas) {
      expect(typeof a.layer, a.name).toBe('string');
    }
  });

  it('shrinks with the marina when the build-out is not there', () => {
    const existing = propertyAreas(generateProperty({ marinaPhase: 'existing' }));
    expect(existing.some((a) => a.name.startsWith('Premier patios'))).toBe(false);
    expect(capacitySummary(existing).assembly).toBeLessThan(capacitySummary(areas).assembly);
  });
});

describe('capacity summary', () => {
  const summary = capacitySummary(areas);

  it('separates assembly, beds, docks and back of house', () => {
    expect(summary.assembly).toBeGreaterThan(0);
    expect(summary.beds).toBe(88);
    expect(summary.dock).toBeGreaterThan(0);
    expect(summary.business).toBeGreaterThan(0);
  });

  it('counts each area exactly once', () => {
    const total = summary.assembly + summary.beds + summary.dock + summary.business;
    expect(total).toBe(areas.reduce((a, x) => a + x.capacity, 0));
  });
});
