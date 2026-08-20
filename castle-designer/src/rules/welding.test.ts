import { describe, expect, it } from 'vitest';
import { RATES } from '../cost/rates';
import type { Container } from '../domain/types';
import {
  isLargeOpening,
  openingsToEliminate,
  weldingHoursFor,
  weldingTakeoff,
  WELDING_CAP_HOURS,
} from './welding';

function withOpenings(id: string, openings: Container['openings']): Container {
  return {
    id,
    type: '40HC',
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    role: 'structural',
    finish: 'painted',
    openings,
  };
}

describe('opening size', () => {
  it('treats anything over 3 feet in either direction as significant', () => {
    expect(isLargeOpening({ width: 3, height: 3 })).toBe(false);
    expect(isLargeOpening({ width: 3.5, height: 3 })).toBe(true);
    expect(isLargeOpening({ width: 3, height: 7 })).toBe(true);
  });

  it('prices 18 hours for large and 6 for small', () => {
    expect(weldingHoursFor({ width: 6, height: 7 })).toBe(RATES.welding.hoursPerLargeOpening);
    expect(weldingHoursFor({ width: 2, height: 2 })).toBe(RATES.welding.hoursPerSmallOpening);
  });
});

describe('the budget cap', () => {
  it('is 526 hours: $50,000 at $95 an hour', () => {
    expect(WELDING_CAP_HOURS).toBeCloseTo(526.3, 1);
    expect(WELDING_CAP_HOURS * RATES.welding.hourlyRate).toBeCloseTo(RATES.welding.budgetCap, 6);
  });

  it('stays inside the cap for a modest number of cuts', () => {
    const t = weldingTakeoff([
      withOpenings('a', [
        { id: 'o1', face: 'sideA', width: 6, height: 7, offsetU: 0, offsetV: 0 },
        { id: 'o2', face: 'sideA', width: 2, height: 2, offsetU: 10, offsetV: 4 },
      ]),
    ]);
    expect(t.totalHours).toBe(24);
    expect(t.totalCost).toBe(24 * 95);
    expect(t.overBudget).toBe(false);
  });

  it('blows the cap past 526 hours', () => {
    const containers = Array.from({ length: 30 }, (_, i) =>
      withOpenings(`c${i}`, [
        { id: `o${i}`, face: 'sideA', width: 6, height: 7, offsetU: 0, offsetV: 0 },
      ]),
    );
    const t = weldingTakeoff(containers);
    expect(t.totalHours).toBe(540);
    expect(t.overBudget).toBe(true);
    expect(t.hoursRemaining).toBeLessThan(0);
    expect(t.utilisation).toBeGreaterThan(1);
  });
});

describe('openingsToEliminate', () => {
  it('proposes nothing when the budget holds', () => {
    const t = weldingTakeoff([
      withOpenings('a', [{ id: 'o', face: 'sideA', width: 6, height: 7, offsetU: 0, offsetV: 0 }]),
    ]);
    expect(openingsToEliminate(t)).toEqual([]);
  });

  it('proposes the largest cuts first, and just enough of them', () => {
    const containers = [
      ...Array.from({ length: 30 }, (_, i) =>
        withOpenings(`big${i}`, [
          { id: `b${i}`, face: 'sideA' as const, width: 8, height: 8, offsetU: 0, offsetV: 0 },
        ]),
      ),
      withOpenings('small', [
        { id: 's', face: 'sideA', width: 2, height: 2, offsetU: 0, offsetV: 0 },
      ]),
    ];
    const t = weldingTakeoff(containers);
    const cuts = openingsToEliminate(t);

    expect(cuts.every((c) => c.large)).toBe(true);
    const savedHours = cuts.reduce((a, c) => a + c.hours, 0);
    expect(t.totalHours - savedHours).toBeLessThanOrEqual(t.capHours);
    // And not one opening more than it takes.
    const lastCut = cuts.at(-1)!;
    expect(t.totalHours - savedHours + lastCut.hours).toBeGreaterThan(t.capHours);
  });
});
